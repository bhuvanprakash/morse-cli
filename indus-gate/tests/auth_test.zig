const std = @import("std");
const auth = @import("../src/middleware/auth.zig");

// Test JWT token extraction and validation
test "jwt token extraction" {
    const allocator = std.testing.allocator;

    // Create a mock JWT token (header.payload.signature)
    // This is an expired token for testing
    const valid_token = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InVzZXIiLCJleHAiOjk5OTk5OTk5OTl9.signature";

    // Test token extraction with future expiration date
    const claims = try auth.prevalidateToken(allocator, valid_token);
    if (claims) |c| {
        defer c.deinit(allocator);
        try std.testing.expect(c.exp > 0);
    }
}

// Test JWT token with missing Bearer prefix
test "jwt invalid format - missing bearer" {
    const allocator = std.testing.allocator;

    const invalid_token = "invalid_token";

    const result = auth.prevalidateToken(allocator, invalid_token);
    try std.testing.expectError(auth.AuthError.InvalidTokenFormat, result);
}

// Test JWT token expired
test "jwt token expired" {
    const allocator = std.testing.allocator;

    // Token with past expiration
    const expired_token = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InVzZXIiLCJleHAiOjF9.signature";

    const result = auth.prevalidateToken(allocator, expired_token);
    try std.testing.expectError(auth.AuthError.TokenExpired, result);
}

// Test missing token returns null
test "jwt no token returns null" {
    const allocator = std.testing.allocator;

    const claims = try auth.prevalidateToken(allocator, null);
    try std.testing.expect(claims == null);
}

// Test JWT error messages
comptime {
    _ = auth.getTokenExpiredError();
    _ = auth.getInvalidTokenError();
}
