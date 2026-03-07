const std = @import("std");

/// Represents a function definition loaded from disk
pub const FunctionDef = struct {
    /// Function name (unique identifier)
    name: []const u8,
    
    /// Absolute path to the function file
    path: []const u8,
    
    /// Environment variables for this function
    env_vars: std.StringHashMap([]const u8),
    
    /// Route pattern (e.g., "/api/users/:id")
    route_pattern: []const u8,
    
    /// Function version (from metadata)
    version: []const u8,
    
    /// Last modified timestamp
    last_modified: i64,
    
    /// Function metadata from JSDoc
    metadata: FunctionMetadata,

    pub fn init(allocator: std.mem.Allocator, name: []const u8, path: []const u8) FunctionDef {
        return .{
            .name = allocator.dupe(u8, name) catch unreachable,
            .path = allocator.dupe(u8, path) catch unreachable,
            .env_vars = std.StringHashMap([]const u8).init(allocator),
            .route_pattern = "/",
            .version = "0.1.0",
            .last_modified = 0,
            .metadata = FunctionMetadata.init(allocator),
        };
    }

    pub fn deinit(self: *FunctionDef, allocator: std.mem.Allocator) void {
        allocator.free(self.name);
        allocator.free(self.path);
        
        var env_iter = self.env_vars.iterator();
        while (env_iter.next()) |entry| {
            allocator.free(entry.key_ptr.*);
            allocator.free(entry.value_ptr.*);
        }
        self.env_vars.deinit();
        
        if (self.route_pattern.len > 0 and self.route_pattern[0] != '/') {
            allocator.free(self.route_pattern);
        }
        
        if (self.version.len > 0) {
            allocator.free(self.version);
        }
        
        self.metadata.deinit(allocator);
    }

    pub fn setRoutePattern(self: *FunctionDef, allocator: std.mem.Allocator, pattern: []const u8) !void {
        self.route_pattern = try allocator.dupe(u8, pattern);
    }

    pub fn setVersion(self: *FunctionDef, allocator: std.mem.Allocator, version: []const u8) !void {
        self.version = try allocator.dupe(u8, version);
    }

    pub fn addEnvVar(self: *FunctionDef, allocator: std.mem.Allocator, key: []const u8, value: []const u8) !void {
        const key_copy = try allocator.dupe(u8, key);
        errdefer allocator.free(key_copy);
        const value_copy = try allocator.dupe(u8, value);
        errdefer allocator.free(value_copy);
        try self.env_vars.put(key_copy, value_copy);
    }
};

/// Function metadata extracted from JSDoc comments
pub const FunctionMetadata = struct {
    /// Function description
    description: ?[]const u8 = null,
    
    /// Author information
    author: ?[]const u8 = null,
    
    /// Required permissions
    permissions: std.ArrayList([]const u8),
    
    /// Timeout override in ms
    timeout_ms: ?u64 = null,
    
    /// Memory limit override in MB
    memory_limit_mb: ?u32 = null,
    
    /// Whether the function is public (no auth required)
    public_access: bool = false,

    pub fn init(allocator: std.mem.Allocator) FunctionMetadata {
        return .{
            .permissions = std.ArrayList([]const u8).init(allocator),
        };
    }

    pub fn deinit(self: *FunctionMetadata, allocator: std.mem.Allocator) void {
        if (self.description) |d| allocator.free(d);
        if (self.author) |a| allocator.free(a);
        for (self.permissions.items) |p| {
            allocator.free(p);
        }
        self.permissions.deinit();
    }
};