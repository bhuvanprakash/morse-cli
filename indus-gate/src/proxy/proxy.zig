const std = @import("std");

/// HTTP response from upstream
pub const ProxyResponse = struct {
    status_code: u16,
    headers: std.http.Headers,
    body: []const u8,
    body_owned: bool,

    pub fn deinit(self: *ProxyResponse, allocator: std.mem.Allocator) void {
        self.headers.deinit();
        if (self.body_owned and self.body.len > 0) {
            allocator.free(self.body);
        }
    }
};

/// Proxy error types
pub const ProxyError = error{
    ConnectionRefused,
    Timeout,
    InvalidUrl,
    UpstreamError,
};

pub const UpstreamContext = struct {
    project_id: []const u8,
    db_schema: []const u8,
    is_service_role: bool,
};

/// Proxy client for forwarding requests
pub const Proxy = struct {
    allocator: std.mem.Allocator,
    client: std.http.Client,
    internal_secret: []const u8,

    pub fn init(allocator: std.mem.Allocator, internal_secret: []const u8) Proxy {
        return Proxy{
            .allocator = allocator,
            .client = std.http.Client{
                .allocator = allocator,
            },
            .internal_secret = internal_secret,
        };
    }

    pub fn deinit(self: *Proxy) void {
        self.client.deinit();
    }

    /// Proxy a request to upstream
    /// - upstream_url: base URL of the upstream service
    /// - request: the incoming HTTP request
    /// - client_ip: original client IP for X-Forwarded-For
    /// - request_id: unique request ID for tracing
    pub fn forward(
        self: *Proxy,
        upstream_url: []const u8,
        request: std.http.Server.Request,
        client_ip: []const u8,
        request_id: []const u8,
        upstream_ctx: ?UpstreamContext,
    ) !ProxyResponse {
        // Build target URL
        const target_url = try self.buildTargetUrl(upstream_url, request.head.target);
        defer self.allocator.free(target_url);

        // Parse URL
        var uri = try std.Uri.parse(target_url);

        // Prepare headers
        var headers = std.http.Headers{ .allocator = self.allocator };
        defer headers.deinit();

        // Copy original headers
        var header_iter = request.headers.iterate();
        while (header_iter.next()) |header| {
            // Skip hop-by-hop headers
            if (isHopByHopHeader(header.name)) continue;
            try headers.append(header.name, header.value);
        }

        // Add internal headers
        try headers.append("X-IndusBase-Internal", self.internal_secret);
        try headers.append("X-Forwarded-For", client_ip);
        try headers.append("X-Request-ID", request_id);
        if (upstream_ctx) |ctx| {
            try headers.append("X-IndusBase-Project-ID", ctx.project_id);
            try headers.append("X-IndusBase-DB-Schema", ctx.db_schema);
            try headers.append("X-IndusBase-Is-Service-Role", if (ctx.is_service_role) "true" else "false");
        }

        // Read request body
        const body = try request.reader().readAllAlloc(self.allocator, 10 * 1024 * 1024); // 10MB limit
        defer self.allocator.free(body);

        // Make the request
        const method = request.head.method;
        const request_body: ?[]const u8 = if (body.len > 0) body else null;

        var server_header_buffer: [8192]u8 = undefined;
        
        const response = self.client.fetch(.{
            .location = .{ .uri = uri },
            .method = method,
            .headers = headers,
            .payload = request_body,
            .server_header_buffer = &server_header_buffer,
        }) catch |err| switch (err) {
            error.ConnectionRefused => return ProxyError.ConnectionRefused,
            error.ConnectionTimedOut => return ProxyError.Timeout,
            error.ReadTimeout => return ProxyError.Timeout,
            else => return ProxyError.UpstreamError,
        };

        // Copy response body
        const response_body = try self.allocator.dupe(u8, response.body orelse &[_]u8{});
        errdefer self.allocator.free(response_body);

        // Parse response headers from server_header_buffer
        var response_headers = std.http.Headers{ .allocator = self.allocator };
        
        // Add status headers
        // Note: In std.http.Client, response headers are available through response.headers
        // but we need to handle the fetch result properly

        return ProxyResponse{
            .status_code = @intFromEnum(response.status),
            .headers = response_headers,
            .body = response_body,
            .body_owned = true,
        };
    }

    /// Build target URL from upstream base and request target
    fn buildTargetUrl(self: Proxy, upstream_url: []const u8, target: []const u8) ![]const u8 {
        // Target may contain path and query string
        var buf = std.ArrayList(u8).init(self.allocator);
        defer buf.deinit();

        // Add upstream URL
        try buf.appendSlice(upstream_url);

        // Parse target to extract path and query
        if (std.mem.indexOfScalar(u8, target, '?')) |query_start| {
            try buf.appendSlice(target[0..query_start]);
            try buf.appendSlice(target[query_start..]);
        } else {
            try buf.appendSlice(target);
        }

        return buf.toOwnedSlice();
    }

    /// Check if header is hop-by-hop (should not be forwarded)
    fn isHopByHopHeader(name: []const u8) bool {
        const hop_by_hop_headers = [_][]const u8{
            "Connection",
            "Keep-Alive",
            "Proxy-Authenticate",
            "Proxy-Authorization",
            "TE",
            "Trailers",
            "Transfer-Encoding",
            "Upgrade",
        };

        for (hop_by_hop_headers) |h| {
            if (std.ascii.eqlIgnoreCase(name, h)) return true;
        }
        return false;
    }
};

/// Simple proxy function for direct forwarding
pub fn proxyRequest(
    allocator: std.mem.Allocator,
    upstream_url: []const u8,
    request: std.http.Server.Request,
    internal_secret: []const u8,
    client_ip: []const u8,
    request_id: []const u8,
) !ProxyResponse {
    var proxy = Proxy.init(allocator, internal_secret);
    defer proxy.deinit();
    return proxy.forward(upstream_url, request, client_ip, request_id, null);
}

/// Get error response for connection refused
pub fn getConnectionRefusedError() []const u8 {
    return "{\"error\":{\"code\":\"SERVICE_UNAVAILABLE\",\"message\":\"Upstream service unavailable\"}}";
}

/// Get error response for timeout
pub fn getTimeoutError() []const u8 {
    return "{\"error\":{\"code\":\"GATEWAY_TIMEOUT\",\"message\":\"Upstream service timeout\"}}";
}
