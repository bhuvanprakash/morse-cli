const std = @import("std");

const VERSION = "0.1.0";
const HEALTH_TIMEOUT_MS = 3000;

/// Service health status
pub const ServiceStatus = struct {
    name: []const u8,
    status: []const u8,
    latency_ms: i64,
};

/// Overall health response
pub const HealthResponse = struct {
    status: []const u8,
    services: std.StringHashMap([]const u8),
    version: []const u8,

    pub fn toJson(self: HealthResponse, allocator: std.mem.Allocator) ![]const u8 {
        var buf = std.ArrayList(u8).init(allocator);
        defer buf.deinit();

        const writer = buf.writer();
        try writer.writeAll("{\"status\":\"");
        try writer.writeAll(self.status);
        try writer.writeAll("\",\"services\":{");

        var first = true;
        var iter = self.services.iterator();
        while (iter.next()) |entry| {
            if (!first) try writer.writeByte(',');
            first = false;
            try writer.writeByte('"');
            try writer.writeAll(entry.key_ptr.*);
            try writer.writeAll("\":\"");
            try writer.writeAll(entry.value_ptr.*);
            try writer.writeByte('"');
        }

        try writer.writeAll("},\"version\":\"");
        try writer.writeAll(self.version);
        try writer.writeAll(""");}
");

        return buf.toOwnedSlice();
    }
};

/// Health checker for upstream services
pub const HealthChecker = struct {
    allocator: std.mem.Allocator,
    client: std.http.Client,

    pub fn init(allocator: std.mem.Allocator) HealthChecker {
        return HealthChecker{
            .allocator = allocator,
            .client = std.http.Client{
                .allocator = allocator,
            },
        };
    }

    pub fn deinit(self: *HealthChecker) void {
        self.client.deinit();
    }

    /// Check all upstream services health
    pub fn checkAll(
        self: *HealthChecker,
        upstreams: struct {
            auth: []const u8,
            query: []const u8,
            meta: []const u8,
            pool: []const u8,
        },
    ) !HealthResponse {
        var services = std.StringHashMap([]const u8).init(self.allocator);
        errdefer services.deinit();

        var all_healthy = true;

        // Check auth service
        const auth_status = try self.checkService(upstreams.auth, "/health");
        try services.put("auth", if (auth_healthy: {
            if (auth_status) |s| break :auth_healthy s else break :auth_healthy false;
        }) "healthy" else "unhealthy");
        if (!auth_status.?) all_healthy = false;

        // Check query service
        const query_status = try self.checkService(upstreams.query, "/health");
        try services.put("query", if (query_status.?) "healthy" else "unhealthy");
        if (!query_status.?) all_healthy = false;

        // Check meta service
        const meta_status = try self.checkService(upstreams.meta, "/health");
        try services.put("meta", if (meta_status.?) "healthy" else "unhealthy");
        if (!meta_status.?) all_healthy = false;

        // Check pool service health endpoint
        const pool_status = try self.checkService(upstreams.pool, "/health");
        try services.put("pool", if (pool_status.?) "healthy" else "unhealthy");
        if (!pool_status.?) all_healthy = false;

        return HealthResponse{
            .status = if (all_healthy) "healthy" else "degraded",
            .services = services,
            .version = VERSION,
        };
    }

    /// Check individual service health
    fn checkService(self: *HealthChecker, base_url: []const u8, path: []const u8) !?bool {
        const url = try std.fmt.allocPrint(self.allocator, "{s}{s}", .{ base_url, path });
        defer self.allocator.free(url);

        const uri = std.Uri.parse(url) catch return null;

        var server_header_buffer: [4096]u8 = undefined;

        const response = self.client.fetch(.{
            .location = .{ .uri = uri },
            .method = .GET,
            .server_header_buffer = &server_header_buffer,
            .timeout_ms = HEALTH_TIMEOUT_MS,
        }) catch return false;

        const status = @intFromEnum(response.status);
        return status >= 200 and status < 300;
    }
};

/// Quick health check for gateway itself
pub fn checkGatewayHealth() []const u8 {
    return "{\"status\":\"healthy\",\"version\":\"0.1.0\"}";
}

/// Build full health check response
pub fn buildHealthResponse(
    allocator: std.mem.Allocator,
    services: []const ServiceStatus,
) ![]const u8 {
    var buf = std.ArrayList(u8).init(allocator);
    defer buf.deinit();

    const writer = buf.writer();

    // Determine overall status
    var all_healthy = true;
    for (services) |svc| {
        if (!std.mem.eql(u8, svc.status, "healthy")) {
            all_healthy = false;
            break;
        }
    }

    try writer.writeAll("{\"status\":\"");
    try writer.writeAll(if (all_healthy) "healthy" else "degraded");
    try writer.writeAll("\",\"services\":{");

    for (services, 0..) |svc, i| {
        if (i > 0) try writer.writeByte(',');
        try writer.writeByte('"');
        try writer.writeAll(svc.name);
        try writer.writeAll("\":\"");
        try writer.writeAll(svc.status);
        try writer.writeByte('"');
    }

    try writer.writeAll("},\"version\":\"");
    try writer.writeAll(VERSION);
    try writer.writeAll(""");}
");

    return buf.toOwnedSlice();
}
