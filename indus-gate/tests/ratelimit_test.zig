const std = @import("std");
const ratelimit = @import("../src/middleware/ratelimit.zig");

// Test token bucket initialization
test "token bucket initialization" {
    var bucket = ratelimit.TokenBucket.init(100, 20);

    // Initial tokens should equal burst
    const now = std.time.milliTimestamp();
    const remaining = bucket.getRemaining(now);
    try std.testing.expectEqual(@as(u32, 20), remaining);
}

// Test token consumption
test "token bucket consume" {
    var bucket = ratelimit.TokenBucket.init(10, 5);

    const now = std.time.milliTimestamp();

    // First 5 requests should succeed
    try std.testing.expect(bucket.checkLimit(now));
    try std.testing.expect(bucket.checkLimit(now));
    try std.testing.expect(bucket.checkLimit(now));
    try std.testing.expect(bucket.checkLimit(now));
    try std.testing.expect(bucket.checkLimit(now));

    // Sixth request should fail (burst = 5)
    try std.testing.expect(!bucket.checkLimit(now));
}

// Test rate limiter with IP-based tracking
test "rate limiter initialization" {
    const allocator = std.testing.allocator;

    var limiter = ratelimit.RateLimiter.init(allocator, 100, 20);
    defer limiter.deinit();

    const now = std.time.milliTimestamp();

    // First request should be allowed
    try std.testing.expect(limiter.checkLimit("192.168.1.1", now));

    // Same IP should be tracked
    try std.testing.expect(limiter.checkLimit("192.168.1.1", now));
}

// Test rate limiter with different IPs
test "rate limiter separate ips" {
    const allocator = std.testing.allocator;

    var limiter = ratelimit.RateLimiter.init(allocator, 100, 5);
    defer limiter.deinit();

    const now = std.time.milliTimestamp();

    // Exhaust burst for first IP
    _ = limiter.checkLimit("192.168.1.1", now);
    _ = limiter.checkLimit("192.168.1.1", now);
    _ = limiter.checkLimit("192.168.1.1", now);
    _ = limiter.checkLimit("192.168.1.1", now);
    _ = limiter.checkLimit("192.168.1.1", now);

    // First IP should be blocked
    try std.testing.expect(!limiter.checkLimit("192.168.1.1", now));

    // Different IP should still be allowed
    try std.testing.expect(limiter.checkLimit("192.168.1.2", now));
}

// Test cleanup
test "rate limiter cleanup" {
    const allocator = std.testing.allocator;

    var limiter = ratelimit.RateLimiter.init(allocator, 100, 20);
    defer limiter.deinit();

    const now = std.time.milliTimestamp();

    // Add some entries
    _ = limiter.checkLimit("192.168.1.1", now);
    _ = limiter.checkLimit("192.168.1.2", now);

    // Cleanup shouldn't crash
    limiter.cleanup();
}

// Test retry after calculation
test "token bucket retry after" {
    var bucket = ratelimit.TokenBucket.init(10, 5);

    const now = std.time.milliTimestamp();

    // Exhaust tokens
    _ = bucket.checkLimit(now);
    _ = bucket.checkLimit(now);
    _ = bucket.checkLimit(now);
    _ = bucket.checkLimit(now);
    _ = bucket.checkLimit(now);

    // Check retry after is positive when empty
    const retry_after = bucket.getRetryAfterMs();
    // Should need to wait for at least some time to get a token
    // At 10 RPS, we need 100ms per token
    try std.testing.expect(retry_after > 0);
}
