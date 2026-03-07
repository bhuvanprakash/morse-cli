const std = @import("std");

pub const Metrics = struct {
    requests_total: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),
    requests_4xx: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),
    requests_5xx: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),
    active_connections: std.atomic.Value(i64) = std.atomic.Value(i64).init(0),
    bytes_proxied: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),

    pub fn increment(self: *Metrics, field: enum { total, c4xx, c5xx }) void {
        switch (field) {
            .total => _ = self.requests_total.fetchAdd(1, .monotonic),
            .c4xx => _ = self.requests_4xx.fetchAdd(1, .monotonic),
            .c5xx => _ = self.requests_5xx.fetchAdd(1, .monotonic),
        }
    }

    pub fn renderPrometheus(self: *const Metrics, writer: anytype) !void {
        try writer.print(
            \\# HELP indusgate_requests_total Total requests proxied
            \\# TYPE indusgate_requests_total counter
            \\indusgate_requests_total {d}
            \\# HELP indusgate_requests_4xx_total 4xx responses
            \\# TYPE indusgate_requests_4xx_total counter
            \\indusgate_requests_4xx_total {d}
            \\# HELP indusgate_requests_5xx_total 5xx responses
            \\# TYPE indusgate_requests_5xx_total counter
            \\indusgate_requests_5xx_total {d}
            \\# HELP indusgate_active_connections Current active connections
            \\# TYPE indusgate_active_connections gauge
            \\indusgate_active_connections {d}
            \\# HELP indusgate_bytes_proxied_total Total bytes proxied by gateway
            \\# TYPE indusgate_bytes_proxied_total counter
            \\indusgate_bytes_proxied_total {d}
        , .{
            self.requests_total.load(.monotonic),
            self.requests_4xx.load(.monotonic),
            self.requests_5xx.load(.monotonic),
            self.active_connections.load(.monotonic),
            self.bytes_proxied.load(.monotonic),
        });
    }
};
