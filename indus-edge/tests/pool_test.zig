const std = @import("std");
const WarmPool = @import("../src/runtime/pool.zig").WarmPool;
const PoolStats = @import("../src/runtime/pool.zig").PoolStats;
const FunctionDef = @import("../src/runtime/function.zig").FunctionDef;

test "Pool initialization" {
    const allocator = std.testing.allocator;
    
    // Create empty function registry
    var registry = std.StringHashMap(FunctionDef).init(allocator);
    defer {
        var it = registry.iterator();
        while (it.next()) |entry| {
            entry.value_ptr.deinit(allocator);
        }
        registry.deinit();
    }
    
    var pool = WarmPool.init(
        allocator,
        &registry,
        "/usr/local/bin/bun",
        "/opt/handler.ts",
        128,
        3,
    );
    defer pool.deinit();
    
    // Check initial stats
    const stats = pool.getStats();
    try std.testing.expectEqual(@as(usize, 0), stats.total_workers);
    try std.testing.expectEqual(@as(usize, 0), stats.busy_workers);
    try std.testing.expectEqual(@as(usize, 0), stats.idle_workers);
}

test "Pool stats with empty workers" {
    const allocator = std.testing.allocator;
    
    var registry = std.StringHashMap(FunctionDef).init(allocator);
    defer {
        var it = registry.iterator();
        while (it.next()) |entry| {
            entry.value_ptr.deinit(allocator);
        }
        registry.deinit();
    }
    
    var pool = WarmPool.init(
        allocator,
        &registry,
        "/usr/local/bin/bun",
        "/opt/handler.ts",
        128,
        3,
    );
    defer pool.deinit();
    
    const stats = pool.getStats();
    try std.testing.expectEqual(@as(u64, 0), stats.total_invocations);
}

test "FunctionDef in registry" {
    const allocator = std.testing.allocator;
    
    var registry = std.StringHashMap(FunctionDef).init(allocator);
    defer {
        var it = registry.iterator();
        while (it.next()) |entry| {
            entry.value_ptr.deinit(allocator);
        }
        registry.deinit();
    }
    
    // Add a function to the registry
    const func_name = "test_func";
    const func_path = "/functions/test_func.ts";
    var func_def = FunctionDef.init(allocator, func_name, func_path);
    try func_def.setRoutePattern(allocator, "/api/test");
    
    try registry.put(func_name, func_def);
    
    // Verify function was added
    try std.testing.expectEqual(@as(usize, 1), registry.count());
    
    const retrieved = registry.get(func_name).?;
    try std.testing.expectEqualStrings(func_name, retrieved.name);
    try std.testing.expectEqualStrings("/api/test", retrieved.route_pattern);
}

test "Config defaults" {
    const Config = @import("../src/config/config.zig").Config;
    
    const config = Config{};
    
    try std.testing.expectEqual(@as(u16, 8006), config.server_port);
    try std.testing.expectEqual(@as(u32, 100), config.max_concurrent_invocations);
    try std.testing.expectEqual(@as(u32, 128), config.worker_memory_limit_mb);
    try std.testing.expectEqual(@as(u64, 30000), config.worker_timeout_ms);
    try std.testing.expectEqual(@as(u32, 3), config.warmpool_size);
}

test "HealthChecker initialization" {
    const HealthChecker = @import("../src/health/health.zig").HealthChecker;
    
    var health = HealthChecker.init();
    
    try std.testing.expect(health.isReady());
    try std.testing.expect(health.isAlive());
}

test "HealthStatus variants" {
    const HealthStatus = @import("../src/health/health.zig").HealthStatus;
    
    const healthy = HealthStatus.healthy(5, 100);
    try std.testing.expectEqualStrings("healthy", healthy.status);
    try std.testing.expectEqual(@as(usize, 5), healthy.functions_loaded);
    try std.testing.expectEqual(@as(u64, 100), healthy.uptime_seconds);
    
    const degraded = HealthStatus.degraded(3, 50);
    try std.testing.expectEqualStrings("degraded", degraded.status);
    
    const unhealthy = HealthStatus.unhealthy(0, 10);
    try std.testing.expectEqualStrings("unhealthy", unhealthy.status);
}

test "InvokeRequest initialization" {
    const invoke = @import("../src/http/invoke.zig");
    const allocator = std.testing.allocator;
    
    const request_id = "req-123";
    const function_name = "my_func";
    
    var req = invoke.InvokeRequest.init(allocator, request_id, function_name);
    defer req.deinit(allocator);
    
    try std.testing.expectEqualStrings(request_id, req.id);
    try std.testing.expectEqualStrings(function_name, req.function_name);
    try std.testing.expectEqualStrings("GET", req.method);
    try std.testing.expectEqualStrings("/", req.path);
}

test "InvokeResponse initialization" {
    const invoke = @import("../src/http/invoke.zig");
    const allocator = std.testing.allocator;
    
    var res = invoke.InvokeResponse.init(allocator, "req-123", 200);
    defer res.deinit(allocator);
    
    try std.testing.expectEqualStrings("req-123", res.id);
    try std.testing.expectEqual(@as(u16, 200), res.status);
    try std.testing.expectEqual(@as(?[]const u8, null), res.error_msg);
}