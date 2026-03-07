const std = @import("std");

/// CORS middleware configuration
pub const CorsConfig = struct {
    origins: []const u8,
    methods: []const u8,
    headers: []const u8,
    max_age: []const u8,

    pub fn default() CorsConfig {
        return CorsConfig{
            .origins = "*",
            .methods = "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            .headers = "Authorization,Content-Type,apikey,X-Client-Info",
            .max_age = "86400",
        };
    }

    pub fn fromOrigins(origins: []const u8) CorsConfig {
        return CorsConfig{
            .origins = origins,
            .methods = "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            .headers = "Authorization,Content-Type,apikey,X-Client-Info",
            .max_age = "86400",
        };
    }
};

/// Check if request is a preflight (OPTIONS) request
pub fn isPreflightRequest(method: []const u8) bool {
    return std.mem.eql(u8, method, "OPTIONS");
}

/// Handle preflight request and return response body
pub fn handlePreflight(allocator: std.mem.Allocator, config: CorsConfig) ![]const u8 {
    // Return empty body for preflight
    _ = config;
    return allocator.dupe(u8, "");
}

/// CORS headers structure
pub const CorsHeaders = struct {
    allow_origin: []const u8,
    allow_methods: []const u8,
    allow_headers: []const u8,
    max_age: []const u8,

    pub fn writeToResponse(self: CorsHeaders, headers: *std.http.Headers) !void {
        try headers.append("Access-Control-Allow-Origin", self.allow_origin);
        try headers.append("Access-Control-Allow-Methods", self.allow_methods);
        try headers.append("Access-Control-Allow-Headers", self.allow_headers);
        try headers.append("Access-Control-Max-Age", self.max_age);
    }
};

/// CORS middleware for handling requests
pub const CorsMiddleware = struct {
    config: CorsConfig,

    pub fn init(config: CorsConfig) CorsMiddleware {
        return CorsMiddleware{
            .config = config,
        };
    }

    /// Process CORS for a request, returns true if handled (preflight)
    pub fn process(
        self: CorsMiddleware,
        method: []const u8,
        request_headers: std.http.Headers,
        response_headers: *std.http.Headers,
    ) !bool {
        // Get origin from request
        const origin = request_headers.get("Origin") orelse self.config.origins;

        // Determine allowed origin
        const allowed_origin = blk: {
            if (std.mem.eql(u8, self.config.origins, "*")) {
                break :blk "*";
            }
            // Check if origin is in allowed list
            if (std.mem.indexOf(u8, self.config.origins, origin) != null) {
                break :blk origin;
            }
            break :blk self.config.origins;
        };

        // Add CORS headers to response
        try response_headers.append("Access-Control-Allow-Origin", allowed_origin);
        try response_headers.append("Access-Control-Allow-Methods", self.config.methods);
        try response_headers.append("Access-Control-Allow-Headers", self.config.headers);
        try response_headers.append("Access-Control-Max-Age", self.config.max_age);

        // Handle preflight request
        if (isPreflightRequest(method)) {
            return true;
        }

        return false;
    }
};

/// Add CORS headers to response (for non-preflight requests)
pub fn addCorsHeaders(
    headers: *std.http.Headers,
    config: CorsConfig,
    request_origin: ?[]const u8,
) !void {
    const origin = request_origin orelse config.origins;

    // If specific origins configured, check match
    const allowed_origin = blk: {
        if (std.mem.eql(u8, config.origins, "*")) {
            break :blk "*";
        }
        if (std.mem.eql(u8, config.origins, origin)) {
            break :blk origin;
        }
        // Check comma-separated origins
        var iter = std.mem.splitScalar(u8, config.origins, ',');
        while (iter.next()) |allowed| {
            const trimmed = std.mem.trim(u8, allowed, " ");
            if (std.mem.eql(u8, trimmed, origin)) {
                break :blk origin;
            }
        }
        break :blk config.origins;
    };

    try headers.append("Access-Control-Allow-Origin", allowed_origin);
    try headers.append("Access-Control-Allow-Methods", config.methods);
    try headers.append("Access-Control-Allow-Headers", config.headers);
    try headers.append("Access-Control-Max-Age", config.max_age);
}

/// Get preflight response status
pub fn getPreflightStatus() u16 {
    return 204;
}
