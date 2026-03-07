const std = @import("std");
const Worker = @import("../src/runtime/worker.zig").Worker;
const FunctionDef = @import("../src/runtime/function.zig").FunctionDef;

test "Worker lifecycle" {
    const allocator = std.testing.allocator;
    
    // Create a temporary function file for testing
    const test_function_name = "test_function";
    const test_function_path = "/tmp/test_function.ts";
    
    // Write a test function file
    const test_function_code =
        \\export default async function handler(ctx: any) {
        \\  return new Response(JSON.stringify({ message: "Hello" }), {
        \\    status: 200,
        \\    headers: { "Content-Type": "application/json" }
        \\  });
        \\}
    ;
    
    try std.fs.cwd().writeFile(.{
        .sub_path = test_function_path,
        .data = test_function_code,
    });
    defer std.fs.cwd().deleteFile(test_function_path) catch {};
    
    // Create function definition
    var func_def = FunctionDef.init(allocator, test_function_name, test_function_path);
    defer func_def.deinit(allocator);
    
    // Note: We can't actually spawn workers in unit tests because they require Bun
    // This test verifies the struct initialization
    
    try std.testing.expectEqualStrings(test_function_name, func_def.name);
    try std.testing.expectEqualStrings(test_function_path, func_def.path);
}

test "FunctionDef initialization" {
    const allocator = std.testing.allocator;
    
    const name = "my_function";
    const path = "/functions/my_function.ts";
    
    var func_def = FunctionDef.init(allocator, name, path);
    defer func_def.deinit(allocator);
    
    try std.testing.expectEqualStrings(name, func_def.name);
    try std.testing.expectEqualStrings(path, func_def.path);
    try std.testing.expectEqual(@as(usize, 0), func_def.env_vars.count());
}

test "FunctionDef with env vars" {
    const allocator = std.testing.allocator;
    
    var func_def = FunctionDef.init(allocator, "test", "/test.ts");
    defer func_def.deinit(allocator);
    
    // Add environment variables
    try func_def.addEnvVar(allocator, "API_KEY", "secret123");
    try func_def.addEnvVar(allocator, "DEBUG", "true");
    
    try std.testing.expectEqual(@as(usize, 2), func_def.env_vars.count());
    
    // Verify values
    const api_key = func_def.env_vars.get("API_KEY").?;
    try std.testing.expectEqualStrings("secret123", api_key);
}

test "FunctionDef route pattern" {
    const allocator = std.testing.allocator;
    
    var func_def = FunctionDef.init(allocator, "test", "/test.ts");
    defer func_def.deinit(allocator);
    
    try func_def.setRoutePattern(allocator, "/api/users/:id");
    try std.testing.expectEqualStrings("/api/users/:id", func_def.route_pattern);
}

test "FunctionDef version" {
    const allocator = std.testing.allocator;
    
    var func_def = FunctionDef.init(allocator, "test", "/test.ts");
    defer func_def.deinit(allocator);
    
    try func_def.setVersion(allocator, "1.2.3");
    try std.testing.expectEqualStrings("1.2.3", func_def.version);
}

test "ResourceLimits initialization" {
    const ResourceLimits = @import("../src/runtime/limits.zig").ResourceLimits;
    
    const limits = ResourceLimits.init(128, 30, 64, 10);
    
    try std.testing.expectEqual(@as(usize, 128 * 1024 * 1024), limits.memory_limit_bytes);
    try std.testing.expectEqual(@as(u64, 30), limits.cpu_time_limit_sec);
    try std.testing.expectEqual(@as(u32, 64), limits.max_open_files);
    try std.testing.expectEqual(@as(u32, 10), limits.max_processes);
}