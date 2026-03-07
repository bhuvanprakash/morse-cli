const std = @import("std");
const json = std.json;

/// JWT claims structure for pre-validation
pub const JWTClaims = struct {
    sub: []const u8,
    role: []const u8,
    exp: i64,

    pub fn deinit(self: *JWTClaims, allocator: std.mem.Allocator) void {
        allocator.free(self.sub);
        allocator.free(self.role);
    }
};

/// Auth error types
pub const AuthError = error{
    MissingToken,
    InvalidTokenFormat,
    TokenExpired,
    InvalidBase64,
    InvalidJson,
};

/// Extract and pre-validate JWT token from Authorization header
/// Returns JWTClaims if valid, null if no token present, or error if invalid
pub fn prevalidateToken(allocator: std.mem.Allocator, auth_header: ?[]const u8) !?JWTClaims {
    const header = auth_header orelse return null;

    // Check Bearer prefix
    const prefix = "Bearer ";
    if (!std.mem.startsWith(u8, header, prefix)) {
        return AuthError.InvalidTokenFormat;
    }

    const token = header[prefix.len..];
    if (token.len == 0) {
        return AuthError.MissingToken;
    }

    // Split token into parts (header.payload.signature)
    var parts_iter = std.mem.splitScalar(u8, token, '.');
    const header_b64 = parts_iter.next() orelse return AuthError.InvalidTokenFormat;
    const payload_b64 = parts_iter.next() orelse return AuthError.InvalidTokenFormat;
    _ = parts_iter.next() orelse return AuthError.InvalidTokenFormat; // signature

    // Decode payload (base64url decode)
    const payload_json = try base64UrlDecode(allocator, payload_b64);
    defer allocator.free(payload_json);

    // Parse JSON payload
    const claims = try parseJwtPayload(allocator, payload_json);

    // Check expiration
    const now = std.time.timestamp();
    if (claims.exp < now) {
        return AuthError.TokenExpired;
    }

    return claims;
}

/// Parse JWT payload JSON
fn parseJwtPayload(allocator: std.mem.Allocator, payload: []const u8) !JWTClaims {
    // Use a simple JSON parser approach
    var parsed = try json.parseFromSlice(
        struct {
            sub: ?[]const u8 = null,
            role: ?[]const u8 = null,
            exp: ?i64 = null,
        },
        allocator,
        payload,
        .{},
    );
    defer parsed.deinit();

    const value = parsed.value;

    if (value.exp == null) {
        return AuthError.InvalidJson;
    }

    return JWTClaims{
        .sub = if (value.sub) |s| try allocator.dupe(u8, s) else try allocator.dupe(u8, ""),
        .role = if (value.role) |r| try allocator.dupe(u8, r) else try allocator.dupe(u8, ""),
        .exp = value.exp.?,
    };
}

/// Base64URL decode (JWT specific - no padding)
fn base64UrlDecode(allocator: std.mem.Allocator, input: []const u8) ![]u8 {
    // Replace URL-safe characters with standard base64 characters
    var buf = try allocator.alloc(u8, input.len);
    defer allocator.free(buf);

    for (input, 0..) |c, i| {
        buf[i] = switch (c) {
            '-' => '+',
            '_' => '/',
            else => c,
        };
    }

    // Add padding if needed
    const padding_needed = (4 - (input.len % 4)) % 4;
    const padded_len = input.len + padding_needed;
    var padded = try allocator.alloc(u8, padded_len);
    defer allocator.free(padded);

    @memcpy(padded[0..input.len], buf);
    for (input.len..padded_len) |i| {
        padded[i] = '=';
    }

    // Calculate decoded length
    const decoded_len = try std.base64.standard_decoder.calcSizeForSlice(padded);
    const output = try allocator.alloc(u8, decoded_len);
    errdefer allocator.free(output);

    try std.base64.standard_decoder.decode(output, padded);

    return output;
}

/// Generate 401 Unauthorized response for token errors
pub fn getTokenExpiredError() []const u8 {
    return "{\"error\":{\"code\":\"TOKEN_EXPIRED\",\"message\":\"Access token expired\"}}";
}

/// Generate 401 Unauthorized response for invalid token
pub fn getInvalidTokenError() []const u8 {
    return "{\"error\":{\"code\":\"INVALID_TOKEN\",\"message\":\"Invalid or missing access token\"}}";
}

/// Auth middleware struct for managing JWT validation
pub const AuthMiddleware = struct {
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) AuthMiddleware {
        return AuthMiddleware{
            .allocator = allocator,
        };
    }

    /// Extract and validate token from headers
    pub fn validate(self: AuthMiddleware, headers: std.http.Headers) !?JWTClaims {
        const auth_header = headers.get("Authorization");
        return try prevalidateToken(self.allocator, auth_header);
    }
};
