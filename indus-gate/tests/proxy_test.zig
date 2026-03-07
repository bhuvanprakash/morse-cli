const std = @import("std");
const proxy = @import("../src/proxy/proxy.zig");
const upstream = @import("../src/proxy/upstream.zig");
const balancer = @import("../src/proxy/balancer.zig");

// Test proxy initialization
test "proxy initialization" {
    const allocator = std.testing.allocator;

    var proxy_client = proxy.Proxy.init(allocator, "test-secret");
    defer proxy_client.deinit();
}

// Test round robin balancer
test "round robin balancer" {
    const allocator = std.testing.allocator;

    var rr = balancer.RoundRobinBalancer.init(allocator);
    defer rr.deinit();

    // Add instances
    try rr.addInstance("http://localhost:8001");
    try rr.addInstance("http://localhost:8002");
    try rr.addInstance("http://localhost:8003");

    // Test round-robin selection
    const first = rr.next();
    try std.testing.expect(first != null);

    const second = rr.next();
    try std.testing.expect(second != null);

    const third = rr.next();
    try std.testing.expect(third != null);

    // Should cycle back
    const fourth = rr.next();
    try std.testing.expect(fourth != null);
}

// Test balancer with no instances
test "balancer empty" {
    const allocator = std.testing.allocator;

    var rr = balancer.RoundRobinBalancer.init(allocator);
    defer rr.deinit();

    const next = rr.next();
    try std.testing.expect(next == null);
}

// Test circuit breaker initialization
test "circuit breaker initialization" {
    const cb = upstream.CircuitBreaker.init(5, 30);

    try std.testing.expectEqual(@as(u32, 5), cb.failure_threshold);
    try std.testing.expectEqual(@as(u32, 30), cb.reset_timeout_sec);
}

// Test circuit breaker state
test "circuit breaker allows requests initially" {
    var cb = upstream.CircuitBreaker.init(5, 30);

    // Initially closed, should allow requests
    try std.testing.expect(cb.allowRequest());
}

// Test proxy error responses
comptime {
    _ = proxy.getConnectionRefusedError();
    _ = proxy.getTimeoutError();
}
