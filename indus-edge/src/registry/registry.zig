const std = @import("std");
const FunctionDef = @import("../runtime/function.zig").FunctionDef;
const loader = @import("loader.zig");

/// FunctionRegistry manages loading and hot-reloading of functions
pub const FunctionRegistry = struct {
    /// Maps function name to FunctionDef
    functions: std.StringHashMap(FunctionDef),
    
    /// Directory to scan for functions
    functions_dir: []const u8,
    
    /// Inotify file descriptor (Linux only)
    inotify_fd: i32,
    
    /// Watch descriptors for loaded functions
    watch_descriptors: std.AutoHashMap(i32, []const u8),
    
    /// Allocator
    allocator: std.mem.Allocator,

    const Self = @This();

    pub fn init(allocator: std.mem.Allocator, functions_dir: []const u8) !FunctionRegistry {
        // Create inotify instance
        const inotify_fd = try std.posix.inotify_init1(std.os.linux.IN.NONBLOCK);
        
        return .{
            .functions = std.StringHashMap(FunctionDef).init(allocator),
            .functions_dir = try allocator.dupe(u8, functions_dir),
            .inotify_fd = inotify_fd,
            .watch_descriptors = std.AutoHashMap(i32, []const u8).init(allocator),
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *Self) void {
        // Close all watch descriptors
        var wd_it = self.watch_descriptors.iterator();
        while (wd_it.next()) |entry| {
            _ = std.posix.inotify_rm_watch(self.inotify_fd, entry.key_ptr.*);
            self.allocator.free(entry.value_ptr.*);
        }
        self.watch_descriptors.deinit();
        
        // Close inotify
        std.posix.close(self.inotify_fd);
        
        // Free functions
        var func_it = self.functions.iterator();
        while (func_it.next()) |entry| {
            entry.value_ptr.deinit(self.allocator);
        }
        self.functions.deinit();
        
        self.allocator.free(self.functions_dir);
    }

    /// Scan functions_dir and load all TypeScript functions
    pub fn scanAndLoad(self: *Self) !void {
        const dir = std.fs.cwd().openDir(self.functions_dir, .{ .iterate = true }) catch |err| {
            std.log.warn("Functions directory not found: {s}", .{@errorName(err)});
            return;
        };
        defer dir.close();
        
        var iter = dir.iterate();
        while (try iter.next()) |entry| {
            // Only process .ts files
            if (!std.mem.endsWith(u8, entry.name, ".ts")) continue;
            
            const function_name = entry.name[0 .. entry.name.len - 3]; // Remove .ts
            const file_path = try std.fs.path.join(self.allocator, &[_][]const u8{ self.functions_dir, entry.name });
            
            // Load the function
            try self.loadFunction(function_name, file_path);
        }
        
        std.log.info("Loaded {d} functions from {s}", .{ self.functions.count(), self.functions_dir });
    }

    /// Load a single function
    pub fn loadFunction(self: *Self, name: []const u8, path: []const u8) !void {
        std.log.info("Loading function: {s} from {s}", .{ name, path });
        
        // Remove existing function if present
        if (self.functions.getPtr(name)) |existing| {
            existing.deinit(self.allocator);
            _ = self.functions.remove(name);
        }
        
        // Create new function definition
        var func_def = FunctionDef.init(self.allocator, name, path);

        // Extract metadata from JSDoc comments
        try loader.extractMetadata(self.allocator, &func_def);

        // Load function-level .env values from the function directory
        const function_dir = std.fs.path.dirname(path) orelse self.functions_dir;
        try loader.loadEnvFile(self.allocator, function_dir, &func_def);
        
        // Get file modification time
        const stat = try std.fs.cwd().statFile(path);
        func_def.last_modified = @intCast(stat.mtime);
        
        // Add inotify watch for hot reload
        const wd = std.posix.inotify_add_watch(
            self.inotify_fd,
            path,
            std.os.linux.IN.MODIFY | std.os.linux.IN.CLOSE_WRITE,
        ) catch |err| {
            std.log.warn("Failed to add watch for {s}: {s}", .{ path, @errorName(err) });
            -1
        };
        
        if (wd >= 0) {
            const name_copy = try self.allocator.dupe(u8, name);
            try self.watch_descriptors.put(wd, name_copy);
        }
        
        // Store function
        try self.functions.put(name, func_def);
    }

    /// Get a function by name
    pub fn getFunction(self: *Self, name: []const u8) ?*FunctionDef {
        return self.functions.getPtr(name);
    }

    /// List all loaded functions
    pub fn listFunctions(self: *Self) []const FunctionDef {
        // This is a simplified version - in practice, return an iterator or array
        _ = self;
        return &[_]FunctionDef{};
    }

    /// Check for file changes and reload if needed
    pub fn checkForChanges(self: *Self) !void {
        var buffer: [4096]u8 = undefined;
        
        const bytes_read = std.posix.read(self.inotify_fd, &buffer) catch |err| {
            if (err == error.WouldBlock) return; // No events
            return err;
        };
        
        if (bytes_read == 0) return;
        
        var offset: usize = 0;
        while (offset < bytes_read) {
            const event = @as(*std.os.linux.inotify_event, @ptrCast(@alignCast(&buffer[offset])));
            
            if (event.mask & std.os.linux.IN.MODIFY != 0 or 
                event.mask & std.os.linux.IN.CLOSE_WRITE != 0) {
                
                if (self.watch_descriptors.get(event.wd)) |function_name| {
                    std.log.info("Function {s} changed, reloading...", .{function_name});
                    
                    if (self.functions.getPtr(function_name)) |func_def| {
                        const path_copy = try self.allocator.dupe(u8, func_def.path);
                        defer self.allocator.free(path_copy);
                        
                        try self.loadFunction(function_name, path_copy);
                    }
                }
            }
            
            // Move to next event
            offset += @sizeOf(std.os.linux.inotify_event) + event.len;
        }
    }

    /// Unload a function
    pub fn unloadFunction(self: *Self, name: []const u8) void {
        if (self.functions.getPtr(name)) |func_def| {
            func_def.deinit(self.allocator);
            _ = self.functions.remove(name);
            std.log.info("Unloaded function: {s}", .{name});
        }
    }
};
