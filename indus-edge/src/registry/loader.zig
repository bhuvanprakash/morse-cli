const std = @import("std");
const FunctionDef = @import("../runtime/function.zig").FunctionDef;
const FunctionMetadata = @import("../runtime/function.zig").FunctionMetadata;

/// Extract metadata from JSDoc comments in the function file
pub fn extractMetadata(allocator: std.mem.Allocator, func_def: *FunctionDef) !void {
    // Read the file
    const content = std.fs.cwd().readFileAlloc(allocator, func_def.path, 1024 * 1024) catch |err| {
        std.log.warn("Failed to read function file {s}: {s}", .{ func_def.path, @errorName(err) });
        return;
    };
    defer allocator.free(content);
    
    // Parse JSDoc comments
    var metadata = FunctionMetadata.init(allocator);
    
    var lines = std.mem.splitScalar(u8, content, '\n');
    while (lines.next()) |line| {
        const trimmed = std.mem.trim(u8, line, " \t");
        
        // Look for JSDoc comments
        if (std.mem.startsWith(u8, trimmed, "/**")) {
            // Start of JSDoc block
            continue;
        }
        
        if (std.mem.startsWith(u8, trimmed, "* ")) {
            const tag_line = trimmed[2..]; // Skip "* "
            
            // Parse @route tag
            if (std.mem.startsWith(u8, tag_line, "@route ")) {
                const route = std.mem.trim(u8, tag_line[7..], " \"");
                try func_def.setRoutePattern(allocator, route);
            }
            
            // Parse @version tag
            if (std.mem.startsWith(u8, tag_line, "@version ")) {
                const version = std.mem.trim(u8, tag_line[9..], " ");
                try func_def.setVersion(allocator, version);
            }
            
            // Parse @description tag
            if (std.mem.startsWith(u8, tag_line, "@description ")) {
                const desc = std.mem.trim(u8, tag_line[13..], " ");
                metadata.description = try allocator.dupe(u8, desc);
            }
            
            // Parse @author tag
            if (std.mem.startsWith(u8, tag_line, "@author ")) {
                const author = std.mem.trim(u8, tag_line[8..], " ");
                metadata.author = try allocator.dupe(u8, author);
            }
            
            // Parse @permission tag
            if (std.mem.startsWith(u8, tag_line, "@permission ")) {
                const perm = std.mem.trim(u8, tag_line[12..], " ");
                const perm_copy = try allocator.dupe(u8, perm);
                try metadata.permissions.append(perm_copy);
            }
            
            // Parse @timeout tag
            if (std.mem.startsWith(u8, tag_line, "@timeout ")) {
                const timeout_str = std.mem.trim(u8, tag_line[9..], " ");
                metadata.timeout_ms = std.fmt.parseInt(u64, timeout_str, 10) catch null;
            }
            
            // Parse @memory tag
            if (std.mem.startsWith(u8, tag_line, "@memory ")) {
                const memory_str = std.mem.trim(u8, tag_line[8..], " ");
                metadata.memory_limit_mb = std.fmt.parseInt(u32, memory_str, 10) catch null;
            }
            
            // Parse @public tag
            if (std.mem.startsWith(u8, tag_line, "@public")) {
                metadata.public_access = true;
            }
        }
    }
    
    func_def.metadata = metadata;
}

/// Validate a function file for syntax errors
pub fn validateFunction(allocator: std.mem.Allocator, path: []const u8) !bool {
    // Read file content
    const content = std.fs.cwd().readFileAlloc(allocator, path, 1024 * 1024) catch |err| {
        std.log.err("Failed to read function file {s}: {s}", .{ path, @errorName(err) });
        return false;
    };
    defer allocator.free(content);
    
    // Basic validation: check for export statement
    const has_export = std.mem.indexOf(u8, content, "export default") != null or
                       std.mem.indexOf(u8, content, "export const handler") != null or
                       std.mem.indexOf(u8, content, "export function") != null;
    
    if (!has_export) {
        std.log.err("Function file {s} missing export statement", .{path});
        return false;
    }
    
    // TODO: Run TypeScript/Bun syntax check
    // bun run --check-syntax path
    
    return true;
}

/// Get function name from file path
pub fn getFunctionNameFromPath(allocator: std.mem.Allocator, path: []const u8) ![]const u8 {
    const basename = std.fs.path.basename(path);
    
    // Remove .ts extension
    if (std.mem.endsWith(u8, basename, ".ts")) {
        return try allocator.dupe(u8, basename[0 .. basename.len - 3]);
    }
    
    return try allocator.dupe(u8, basename);
}

/// Get environment variables from .env file in function directory
pub fn loadEnvFile(allocator: std.mem.Allocator, dir_path: []const u8, func_def: *FunctionDef) !void {
    const env_path = try std.fs.path.join(allocator, &[_][]const u8{ dir_path, ".env" });
    defer allocator.free(env_path);
    
    const content = std.fs.cwd().readFileAlloc(allocator, env_path, 64 * 1024) catch |err| {
        if (err == error.FileNotFound) return; // No .env file is ok
        return err;
    };
    defer allocator.free(content);
    
    var lines = std.mem.splitScalar(u8, content, '\n');
    while (lines.next()) |line| {
        const trimmed = std.mem.trim(u8, line, " \t\r");
        
        // Skip comments and empty lines
        if (trimmed.len == 0 or trimmed[0] == '#') continue;
        
        // Parse KEY=VALUE
        if (std.mem.indexOfScalar(u8, trimmed, '=')) |eq_pos| {
            const key = std.mem.trim(u8, trimmed[0..eq_pos], " ");
            const value = std.mem.trim(u8, trimmed[eq_pos + 1 ..], " \"");
            
            if (key.len > 0) {
                try func_def.addEnvVar(allocator, key, value);
            }
        }
    }
}