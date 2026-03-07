const std = @import("std");

/// JWT token claims
pub const Claims = struct {
    /// Subject (user ID)
    sub: []const u8,
    
    /// Issued at timestamp
    iat: i64,
    
    /// Expiration timestamp
    exp: i64,
    
    /// Roles/permissions
    roles: [][]const u8,

    pub fn isExpired(self: *const Claims) bool {
        const now = std.time.timestamp();
        return now > self.exp;
    }

    pub fn hasRole(self: *const Claims, role: []const u8) bool {
        for (self.roles) |r| {
            if (std.mem.eql(u8, r, role)) return true;
        }
        return false;
    }
};

/// Extract JWT token from Authorization header
pub fn extractToken(allocator: std.mem.Allocator, auth_header: []const u8) ?[]const u8 {
    const prefix = "Bearer ";
    if (!std.mem.startsWith(u8, auth_header, prefix)) {
        return null;
    }
    
    const token = auth_header[prefix.len..];
    if (token.len == 0) return null;
    
    return allocator.dupe(u8, token) catch null;
}

/// Validate and parse JWT token
pub fn validateToken(allocator: std.mem.Allocator, token: []const u8, secret: []const u8) !Claims {
    // JWT tokens are base64url encoded: header.payload.signature
    var parts = std.mem.splitScalar(u8, token, '.');
    
    const header_b64 = parts.next() orelse return error.InvalidToken;
    const payload_b64 = parts.next() orelse return error.InvalidToken;
    const signature_b64 = parts.next() orelse return error.InvalidToken;
    
    // Verify signature (simplified - real implementation needs HMAC)
    _ = signature_b64;
    _ = secret;
    
    // Decode payload
    const payload_json = try base64UrlDecode(allocator, payload_b64);
    defer allocator.free(payload_json);
    
    // Parse claims (simplified - real implementation needs proper JSON parsing)
    return try parseClaims(allocator, payload_json);
}

/// Parse JWT claims from JSON
fn parseClaims(allocator: std.mem.Allocator, json: []const u8) !Claims {
    // This is a simplified implementation
    // In production, use a proper JSON parser
    
    var claims = Claims{
        .sub = "",
        .iat = 0,
        .exp = 0,
        .roles = &[_][]const u8{},
    };
    
    // Extract sub
    if (extractJsonString(json, "\"sub\":\"")) |val| {
        claims.sub = try allocator.dupe(u8, val);
    }
    
    // Extract exp
    if (extractJsonNumber(json, "\"exp\":")) |val| {
        claims.exp = val;
    }
    
    return claims;
}

/// Extract string value from JSON
fn extractJsonString(json: []const u8, key: []const u8) ?[]const u8 {
    const idx = std.mem.indexOf(u8, json, key) orelse return null;
    const start = idx + key.len;
    const end = std.mem.indexOfPos(u8, json, start, "\"") orelse return null;
    return json[start..end];
}

/// Extract number value from JSON
fn extractJsonNumber(json: []const u8, key: []const u8) ?i64 {
    const idx = std.mem.indexOf(u8, json, key) orelse return null;
    const start = idx + key.len;
    var end = start;
    while (end < json.len and (std.ascii.isDigit(json[end]) or json[end] == '-')) : (end += 1) {}
    return std.fmt.parseInt(i64, json[start..end], 10) catch null;
}

/// Base64URL decode
fn base64UrlDecode(allocator: std.mem.Allocator, input: []const u8) ![]const u8 {
    // Convert base64url to standard base64
    var std_b64 = try allocator.alloc(u8, input.len + 4); // Extra space for padding
    defer allocator.free(std_b64);
    
    for (input, 0..) |c, i| {
        std_b64[i] = switch (c) {
            '-' => '+',
            '_' => '/',
            else => c,
        };
    }
    
    // Add padding
    const padding = (4 - (input.len % 4)) % 4;
    for (input.len..input.len + padding) |i| {
        std_b64[i] = '=';
    }
    
    const result_len = try std.base64.standard.Decoder.calcSizeForSlice(std_b64[0 .. input.len + padding]);
    const result = try allocator.alloc(u8, result_len);
    try std.base64.standard.Decoder.decode(result, std_b64[0 .. input.len + padding]);
    
    return result;
}

/// Internal authentication middleware
pub fn authenticateInternal(allocator: std.mem.Allocator, auth_header: ?[]const u8, internal_secret: []const u8) bool {
    if (auth_header == null) return false;
    
    const token = extractToken(allocator, auth_header.?) orelse return false;
    defer allocator.free(token);
    
    // For internal auth, just compare the token with the secret
    // In production, use proper JWT validation
    return std.mem.eql(u8, token, internal_secret);
}