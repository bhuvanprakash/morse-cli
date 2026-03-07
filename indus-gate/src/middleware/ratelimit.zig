const std = @import("std");

/// Token bucket for rate limiting
pub const TokenBucket = struct {
    tokens: f64,
    last_refill_ms: i64,
    rps: u32,
    burst: u32,

    pub fn init(rps: u32, burst: u32) TokenBucket {
        return TokenBucket{
            .tokens = @floatFromInt(burst),
            .last_refill_ms = std.time.milliTimestamp(),
            .rps = rps,
            .burst = burst,
        };
    }

    /// Check if request is allowed and consume a token
    pub fn checkLimit(self: *TokenBucket, now_ms: i64) bool {
        // Refill tokens based on elapsed time
        const elapsed_ms = now_ms - self.last_refill_ms;
        if (elapsed_ms > 0) {
            const tokens_to_add = (@as(f64, @floatFromInt(elapsed_ms)) / 1000.0) * @as(f64, @floatFromInt(self.rps));
            self.tokens = @min(@as(f64, @floatFromInt(self.burst)), self.tokens + tokens_to_add);
            self.last_refill_ms = now_ms;
        }

        // Check if we can consume a token
        if (self.tokens >= 1.0) {
            self.tokens -= 1.0;
            return true;
        }

        return false;
    }

    /// Get current token count (for headers)
    pub fn getRemaining(self: *TokenBucket, now_ms: i64) u32 {
        // Refill first
        const elapsed_ms = now_ms - self.last_refill_ms;
        if (elapsed_ms > 0) {
            const tokens_to_add = (@as(f64, @floatFromInt(elapsed_ms)) / 1000.0) * @as(f64, @floatFromInt(self.rps));
            self.tokens = @min(@as(f64, @floatFromInt(self.burst)), self.tokens + tokens_to_add);
            self.last_refill_ms = now_ms;
        }
        return @intFromFloat(self.tokens);
    }

    /// Get retry after in milliseconds
    pub fn getRetryAfterMs(self: TokenBucket) i64 {
        if (self.tokens >= 1.0) return 0;
        const tokens_needed = 1.0 - self.tokens;
        const ms_per_token = 1000.0 / @as(f64, @floatFromInt(self.rps));
        return @intFromFloat(tokens_needed * ms_per_token);
    }
};

/// Rate limiter entry with IP as key
pub const RateLimitEntry = struct {
    bucket: TokenBucket,
    last_access_ms: i64,
};

/// Rate limiter with cleanup
pub const RateLimiter = struct {
    allocator: std.mem.Allocator,
    buckets: std.StringHashMap(RateLimitEntry),
    auth_buckets: std.StringHashMap(RateLimitEntry),
    mutex: std.Thread.Mutex,
    rps: u32,
    burst: u32,
    last_cleanup_ms: i64,

    /// Cleanup interval: 5 minutes
    const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
    
    /// Entry expiration: 10 minutes
    const ENTRY_EXPIRY_MS = 10 * 60 * 1000;

    pub fn init(allocator: std.mem.Allocator, rps: u32, burst: u32) RateLimiter {
        return RateLimiter{
            .allocator = allocator,
            .buckets = std.StringHashMap(RateLimitEntry).init(allocator),
            .auth_buckets = std.StringHashMap(RateLimitEntry).init(allocator),
            .mutex = std.Thread.Mutex{},
            .rps = rps,
            .burst = burst,
            .last_cleanup_ms = std.time.milliTimestamp(),
        };
    }

    pub fn deinit(self: *RateLimiter) void {
        // Free all allocated IP strings
        var iter = self.buckets.keyIterator();
        while (iter.next()) |key| {
            self.allocator.free(key.*);
        }
        self.buckets.deinit();

        var auth_iter = self.auth_buckets.keyIterator();
        while (auth_iter.next()) |key| {
            self.allocator.free(key.*);
        }
        self.auth_buckets.deinit();
    }

    /// Check if request from IP is allowed
    pub fn checkLimit(self: *RateLimiter, ip: []const u8, now_ms: i64) bool {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.checkWithMapLocked(&self.buckets, ip, now_ms, self.rps, self.burst);
    }

    /// Alias matching newer middleware API.
    pub fn allow(self: *RateLimiter, ip: []const u8, now_ms: i64) bool {
        return self.checkLimit(ip, now_ms);
    }

    /// Stricter auth endpoint limiter: 10 req/min per IP.
    pub fn allowAuth(self: *RateLimiter, ip: []const u8, now_ms: i64) bool {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.checkAuthMapLocked(ip, now_ms);
    }

    fn checkWithMapLocked(
        self: *RateLimiter,
        map: *std.StringHashMap(RateLimitEntry),
        ip: []const u8,
        now_ms: i64,
        rps: u32,
        burst: u32,
    ) bool {
        // Periodic cleanup
        if (now_ms - self.last_cleanup_ms > CLEANUP_INTERVAL_MS) {
            self.cleanupUnlocked(now_ms);
            self.last_cleanup_ms = now_ms;
        }

        const gop = map.getOrPut(ip) catch return true;

        if (!gop.found_existing) {
            // Create new entry - need to dupe the IP
            gop.key_ptr.* = self.allocator.dupe(u8, ip) catch return true;
            gop.value_ptr.* = RateLimitEntry{
                .bucket = TokenBucket{
                    .tokens = @floatFromInt(burst),
                    .last_refill_ms = now_ms,
                    .rps = rps,
                    .burst = burst,
                },
                .last_access_ms = now_ms,
            };
        } else {
            gop.value_ptr.last_access_ms = now_ms;
        }

        return gop.value_ptr.bucket.checkLimit(now_ms);
    }

    fn checkAuthMapLocked(self: *RateLimiter, ip: []const u8, now_ms: i64) bool {
        // Periodic cleanup
        if (now_ms - self.last_cleanup_ms > CLEANUP_INTERVAL_MS) {
            self.cleanupUnlocked(now_ms);
            self.last_cleanup_ms = now_ms;
        }

        const gop = self.auth_buckets.getOrPut(ip) catch return true;

        if (!gop.found_existing) {
            // Create new entry - need to dupe the IP
            gop.key_ptr.* = self.allocator.dupe(u8, ip) catch return true;
            gop.value_ptr.* = RateLimitEntry{
                .bucket = TokenBucket{
                    .tokens = 10.0,
                    .last_refill_ms = now_ms,
                    .rps = 1, // fallback integer rps for helper methods
                    .burst = 10,
                },
                .last_access_ms = now_ms,
            };
        } else {
            gop.value_ptr.last_access_ms = now_ms;
        }

        // 10 requests per minute => 1 token every 6 seconds.
        const elapsed_ms = now_ms - gop.value_ptr.bucket.last_refill_ms;
        if (elapsed_ms > 0) {
            const tokens_to_add = @as(f64, @floatFromInt(elapsed_ms)) / 6000.0;
            gop.value_ptr.bucket.tokens = @min(10.0, gop.value_ptr.bucket.tokens + tokens_to_add);
            gop.value_ptr.bucket.last_refill_ms = now_ms;
        }
        if (gop.value_ptr.bucket.tokens >= 1.0) {
            gop.value_ptr.bucket.tokens -= 1.0;
            return true;
        }
        return false;
    }

    /// Get remaining tokens for IP
    pub fn getRemaining(self: *RateLimiter, ip: []const u8, now_ms: i64) u32 {
        self.mutex.lock();
        defer self.mutex.unlock();

        const entry = self.buckets.getPtr(ip) orelse return self.burst;
        return entry.bucket.getRemaining(now_ms);
    }

    /// Get retry after time in milliseconds
    pub fn getRetryAfterMs(self: *RateLimiter, ip: []const u8) i64 {
        self.mutex.lock();
        defer self.mutex.unlock();

        const entry = self.buckets.getPtr(ip) orelse return 0;
        return entry.bucket.getRetryAfterMs();
    }

    /// Cleanup old entries (call periodically)
    pub fn cleanup(self: *RateLimiter) void {
        const now_ms = std.time.milliTimestamp();
        self.mutex.lock();
        defer self.mutex.unlock();
        self.cleanupUnlocked(now_ms);
    }

    fn cleanupUnlocked(self: *RateLimiter, now_ms: i64) void {
        var to_remove = std.ArrayList([]const u8).init(self.allocator);
        defer to_remove.deinit();

        var iter = self.buckets.iterator();
        while (iter.next()) |entry| {
            if (now_ms - entry.value_ptr.last_access_ms > ENTRY_EXPIRY_MS) {
                to_remove.append(entry.key_ptr.*) catch continue;
            }
        }

        for (to_remove.items) |key| {
            if (self.buckets.remove(key)) {
                self.allocator.free(key);
            }
        }

        var auth_iter = self.auth_buckets.iterator();
        while (auth_iter.next()) |entry| {
            if (now_ms - entry.value_ptr.last_access_ms > ENTRY_EXPIRY_MS) {
                if (self.auth_buckets.remove(entry.key_ptr.*)) {
                    self.allocator.free(entry.key_ptr.*);
                }
            }
        }
    }
};

/// Rate limit check result
pub const RateLimitResult = struct {
    allowed: bool,
    remaining: u32,
    retry_after_ms: i64,
};

/// Check rate limit and return detailed result
pub fn checkLimitDetailed(self: *RateLimiter, ip: []const u8, now_ms: i64) RateLimitResult {
    const allowed = self.checkLimit(ip, now_ms);
    const remaining = self.getRemaining(ip, now_ms);
    const retry_after_ms = if (!allowed) self.getRetryAfterMs(ip) else 0;

    return RateLimitResult{
        .allowed = allowed,
        .remaining = remaining,
        .retry_after_ms = retry_after_ms,
    };
}

/// Generate 429 Too Many Requests response
pub fn getRateLimitResponse(retry_after_ms: i64) []const u8 {
    if (retry_after_ms <= 0) {
        return "{\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests\"}}";
    }
    // This is a simple response, the caller should add Retry-After header
    return "{\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests, please retry later\"}}";
}
