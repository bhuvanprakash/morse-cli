const std = @import("std");
const Config = @import("config.zig").Config;

/// Route match result containing upstream URL and metadata
pub const RouteMatch = struct {
    upstream_url: []const u8,
    strip_prefix: bool,
    internal_only: bool,
    websocket_upgrade: bool,
};

/// Match a request path to an upstream URL
/// Returns null if no route matches
pub fn matchRoute(path: []const u8, config: *const Config) ?RouteMatch {
    // Check for exact match on /health first
    if (std.mem.eql(u8, path, "/health")) {
        return RouteMatch{
            .upstream_url = "local",
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    // Check for /pool/health
    if (std.mem.eql(u8, path, "/pool/health") or std.mem.startsWith(u8, path, "/pool/health")) {
        return RouteMatch{
            .upstream_url = config.upstream_pool_health,
            .strip_prefix = true,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    // /auth/ prefix
    if (std.mem.startsWith(u8, path, "/auth/")) {
        return RouteMatch{
            .upstream_url = config.upstream_auth,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    // /rest/ prefix
    if (std.mem.startsWith(u8, path, "/rest/")) {
        return RouteMatch{
            .upstream_url = config.upstream_query,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    if (std.mem.eql(u8, path, "/graphql")) {
        return RouteMatch{
            .upstream_url = config.upstream_query,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    // /meta/ prefix - requires internal only check
    if (std.mem.startsWith(u8, path, "/meta/")) {
        return RouteMatch{
            .upstream_url = config.upstream_meta,
            .strip_prefix = false,
            .internal_only = true,
            .websocket_upgrade = false,
        };
    }

    // /realtime/ prefix - WebSocket endpoint for realtime changes
    if (std.mem.startsWith(u8, path, "/realtime/")) {
        return RouteMatch{
            .upstream_url = config.upstream_live,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = true,
        };
    }

    // /storage/ prefix - Object storage API
    if (std.mem.startsWith(u8, path, "/storage/")) {
        return RouteMatch{
            .upstream_url = config.upstream_store,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    // /ai/ prefix - AI service (vector search + embeddings)
    if (std.mem.startsWith(u8, path, "/ai/")) {
        return RouteMatch{
            .upstream_url = config.upstream_ai,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    // /queue/ prefix - Queue service (background jobs + cron)
    if (std.mem.startsWith(u8, path, "/queue/")) {
        return RouteMatch{
            .upstream_url = config.upstream_queue,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    // Feature flag evaluation is intentionally public for pre-login clients.
    if (std.mem.startsWith(u8, path, "/config/evaluate")) {
        return RouteMatch{
            .upstream_url = config.upstream_config,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    if (std.mem.startsWith(u8, path, "/config/")) {
        return RouteMatch{
            .upstream_url = config.upstream_config,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    if (std.mem.startsWith(u8, path, "/notify/")) {
        return RouteMatch{
            .upstream_url = config.upstream_notify,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    if (std.mem.startsWith(u8, path, "/audit/")) {
        return RouteMatch{
            .upstream_url = config.upstream_audit,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    if (std.mem.startsWith(u8, path, "/billing/")) {
        return RouteMatch{
            .upstream_url = config.upstream_billing,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    if (std.mem.startsWith(u8, path, "/secrets/")) {
        return RouteMatch{
            .upstream_url = config.upstream_secrets,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    if (std.mem.startsWith(u8, path, "/status/")) {
        return RouteMatch{
            .upstream_url = config.upstream_status,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    // /functions/ prefix - Edge Functions API (JWT validation required)
    if (std.mem.startsWith(u8, path, "/functions/")) {
        return RouteMatch{
            .upstream_url = config.upstream_edge,
            .strip_prefix = false,
            .internal_only = false,
            .websocket_upgrade = false,
        };
    }

    return null;
}

/// Route table for managing routes
pub const RouteTable = struct {
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) RouteTable {
        return RouteTable{
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *RouteTable) void {
        _ = self;
    }
};

/// Check if a request is from an internal source
/// Used for internal-only routes like /meta/
pub fn isInternalRequest(client_ip: []const u8) bool {
    // Check for common internal IP ranges
    // 127.0.0.1/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    
    if (std.mem.eql(u8, client_ip, "127.0.0.1")) {
        return true;
    }
    
    if (std.mem.startsWith(u8, client_ip, "10.")) {
        return true;
    }
    
    if (std.mem.startsWith(u8, client_ip, "192.168.")) {
        return true;
    }
    
    if (std.mem.startsWith(u8, client_ip, "172.")) {
        // Check for 172.16-31.x.x
        if (client_ip.len >= 7) {
            const octet2_str = client_ip[4..std.mem.indexOfScalar(u8, client_ip[4..], '.').?];
            if (std.fmt.parseUnsigned(u8, octet2_str, 10)) |octet2| {
                if (octet2 >= 16 and octet2 <= 31) {
                    return true;
                }
            } else |_| {}
        }
    }
    
    return false;
}

/// Build target URL from upstream base and request path
pub fn buildTargetUrl(
    allocator: std.mem.Allocator,
    upstream_url: []const u8,
    path: []const u8,
    query: ?[]const u8,
) ![]const u8 {
    var buf = std.ArrayList(u8).init(allocator);
    errdefer buf.deinit();

    // Add upstream URL
    try buf.appendSlice(upstream_url);

    // Handle path prefix stripping if needed
    // For now, we pass the full path
    if (!std.mem.eql(u8, upstream_url, "local")) {
        try buf.appendSlice(path);
    }

    // Add query string if present
    if (query) |q| {
        try buf.append('?');
        try buf.appendSlice(q);
    }

    return buf.toOwnedSlice();
}
