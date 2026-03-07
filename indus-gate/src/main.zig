const std = @import("std");
const config = @import("config/config.zig");
const routes = @import("config/routes.zig");
const auth = @import("middleware/auth.zig");
const ratelimit = @import("middleware/ratelimit.zig");
const cors = @import("middleware/cors.zig");
const logger = @import("middleware/logger.zig");
const security_headers = @import("middleware/security_headers.zig");
const project = @import("middleware/project.zig");
const proxy = @import("proxy/proxy.zig");
const health = @import("health/health.zig");
const gateway_metrics = @import("metrics/metrics.zig");

const VERSION = "0.1.0";

/// Global shutdown flag for graceful shutdown
var shutdown_requested: std.atomic.Value(bool) = std.atomic.Value(bool).init(false);
var global_metrics: gateway_metrics.Metrics = .{};

/// Signal handler for SIGTERM
fn handleSigTerm(sig: i32, info: *const std.posix.siginfo_t, ctx: ?*const anyopaque) callconv(.C) void {
    _ = sig;
    _ = info;
    _ = ctx;
    shutdown_requested.store(true, .monotonic);
}

/// Setup signal handlers
fn setupSignalHandlers() !void {
    const sa = std.posix.Sigaction{
        .handler = .{ .sigaction = handleSigTerm },
        .mask = std.posix.empty_sigset,
        .flags = std.posix.SA.SIGINFO,
    };
    try std.posix.sigaction(std.posix.SIG.TERM, &sa, null);
    try std.posix.sigaction(std.posix.SIG.INT, &sa, null);
}

/// Extract client IP from request
fn getClientIp(request: *std.http.Server.Request) []const u8 {
    // Check X-Forwarded-For header first
    if (request.headers.get("X-Forwarded-For")) |xff| {
        // Take the first IP in the chain
        if (std.mem.indexOfScalar(u8, xff, ',')) |comma| {
            return std.mem.trim(u8, xff[0..comma], " ");
        }
        return xff;
    }
    // Fall back to X-Real-Ip
    if (request.headers.get("X-Real-Ip")) |xri| {
        return xri;
    }
    // Return placeholder for direct connection
    return "unknown";
}

fn requiresProjectContext(path: []const u8) bool {
    if (std.mem.eql(u8, path, "/health") or std.mem.eql(u8, path, "/metrics")) return false;
    if (std.mem.startsWith(u8, path, "/auth/")) return false;
    if (std.mem.startsWith(u8, path, "/meta/")) return false;
    return std.mem.startsWith(u8, path, "/rest/") or
        std.mem.startsWith(u8, path, "/graphql") or
        std.mem.startsWith(u8, path, "/storage/") or
        std.mem.startsWith(u8, path, "/ai/") or
        std.mem.startsWith(u8, path, "/queue/") or
        std.mem.startsWith(u8, path, "/notify/") or
        std.mem.startsWith(u8, path, "/config/") or
        std.mem.startsWith(u8, path, "/billing/") or
        std.mem.startsWith(u8, path, "/secrets/") or
        std.mem.startsWith(u8, path, "/realtime/") or
        std.mem.startsWith(u8, path, "/functions/");
}

/// Handle a single HTTP request
fn handleRequest(
    allocator: std.mem.Allocator,
    cfg: *const config.Config,
    rate_limiter: *ratelimit.RateLimiter,
    project_cache: *project.ProjectCache,
    server_request: *std.http.Server.Request,
    proxy_client: *proxy.Proxy,
    request_id: []const u8,
) !void {
    const start_time = std.time.milliTimestamp();
    const method = @tagName(server_request.head.method);
    const target = server_request.head.target;
    const client_ip = getClientIp(server_request);

    // Initialize response headers
    var response_headers = std.http.Headers{ .allocator = allocator };
    defer response_headers.deinit();
    try security_headers.addSecurityHeaders(&response_headers);

    // Local metrics endpoint
    if (std.mem.eql(u8, target, "/metrics")) {
        var body = std.ArrayList(u8).init(allocator);
        defer body.deinit();
        try global_metrics.renderPrometheus(body.writer());
        try response_headers.append("Content-Type", "text/plain; version=0.0.4");
        try server_request.respond(body.items, .{
            .status = .ok,
            .headers = response_headers,
        });
        logger.logRequest(method, target, 200, @intCast(std.time.milliTimestamp() - start_time), client_ip);
        return;
    }

    // Add CORS headers
    const cors_config = cors.CorsConfig.fromOrigins(cfg.cors_origins);
    const is_preflight = try cors.CorsMiddleware.init(cors_config).process(
        method,
        server_request.headers,
        &response_headers,
    );

    // Handle preflight request
    if (is_preflight) {
        try server_request.respond("", .{
            .status = .no_content,
            .headers = response_headers,
        });
        logger.logRequest(method, target, 204, @intCast(std.time.milliTimestamp() - start_time), client_ip);
        return;
    }

    // Rate limit check
    const now_ms = std.time.milliTimestamp();
    const allowed = if (std.mem.startsWith(u8, target, "/auth/"))
        rate_limiter.allowAuth(client_ip, now_ms)
    else
        rate_limiter.allow(client_ip, now_ms);
    if (!allowed) {
        const retry_after = rate_limiter.getRetryAfterMs(client_ip);
        try response_headers.append("Retry-After", try std.fmt.allocPrint(allocator, "{d}", .{retry_after / 1000}));
        try server_request.respond(ratelimit.getRateLimitResponse(retry_after), .{
            .status = .too_many_requests,
            .headers = response_headers,
        });
        global_metrics.increment(.total);
        global_metrics.increment(.c4xx);
        logger.logRequest(method, target, 429, @intCast(std.time.milliTimestamp() - start_time), client_ip);
        return;
    }

    var project_ctx: ?project.ProjectContext = null;
    defer {
        if (project_ctx) |*ctx| {
            ctx.deinit(allocator);
        }
    }
    var auth_used_for_project_key = false;
    if (requiresProjectContext(target)) {
        const key = project.extractApiKey(server_request.headers) orelse {
            try server_request.respond(
                "{\"data\":null,\"error\":{\"code\":\"INVALID_API_KEY\",\"message\":\"Project API key is missing or invalid\"}}",
                .{
                    .status = .unauthorized,
                    .headers = response_headers,
                },
            );
            global_metrics.increment(.total);
            global_metrics.increment(.c4xx);
            logger.logRequest(method, target, 401, @intCast(std.time.milliTimestamp() - start_time), client_ip);
            return;
        };

        auth_used_for_project_key = key.from_authorization;
        project_ctx = project.resolveProject(allocator, cfg.upstream_meta, project_cache, key.key) catch |err| {
            const response = switch (err) {
                project.ResolveError.ProjectPaused => .{
                    .status = std.http.Status.service_unavailable,
                    .body = "{\"data\":null,\"error\":{\"code\":\"PROJECT_PAUSED\",\"message\":\"Project is paused\"}}",
                },
                else => .{
                    .status = std.http.Status.internal_server_error,
                    .body = "{\"data\":null,\"error\":{\"code\":\"PROJECT_RESOLUTION_FAILED\",\"message\":\"Could not resolve project context\"}}",
                },
            };
            try server_request.respond(response.body, .{
                .status = response.status,
                .headers = response_headers,
            });
            global_metrics.increment(.total);
            if (@intFromEnum(response.status) >= 500) {
                global_metrics.increment(.c5xx);
            } else {
                global_metrics.increment(.c4xx);
            }
            logger.logRequest(method, target, @intFromEnum(response.status), @intCast(std.time.milliTimestamp() - start_time), client_ip);
            return;
        };
        if (project_ctx == null) {
            try server_request.respond(
                "{\"data\":null,\"error\":{\"code\":\"INVALID_API_KEY\",\"message\":\"Project API key is invalid\"}}",
                .{
                    .status = .unauthorized,
                    .headers = response_headers,
                },
            );
            global_metrics.increment(.total);
            global_metrics.increment(.c4xx);
            logger.logRequest(method, target, 401, @intCast(std.time.milliTimestamp() - start_time), client_ip);
            return;
        }
    }

    // JWT pre-validation (optional - only if Authorization header present)
    const auth_header = server_request.headers.get("Authorization");
    if (auth_header != null and !auth_used_for_project_key) {
        const claims = auth.prevalidateToken(allocator, auth_header) catch |err| {
            const error_body = switch (err) {
                auth.AuthError.TokenExpired => auth.getTokenExpiredError(),
                else => auth.getInvalidTokenError(),
            };
            try server_request.respond(error_body, .{
                .status = .unauthorized,
                .headers = response_headers,
            });
            global_metrics.increment(.total);
            global_metrics.increment(.c4xx);
            logger.logRequest(method, target, 401, @intCast(std.time.milliTimestamp() - start_time), client_ip);
            return;
        };
        if (claims) |c| {
            // Add claims to headers for upstream
            try response_headers.append("X-User-ID", c.sub);
            try response_headers.append("X-User-Role", c.role);
            c.deinit(allocator);
        }
    }

    // Route matching
    const route_match = routes.matchRoute(target, cfg);
    if (route_match == null) {
        try server_request.respond(
            "{\"error\":{\"code\":\"NOT_FOUND\",\"message\":\"Route not found\"}}",
            .{
                .status = .not_found,
                .headers = response_headers,
            },
        );
        global_metrics.increment(.total);
        global_metrics.increment(.c4xx);
        logger.logRequest(method, target, 404, @intCast(std.time.milliTimestamp() - start_time), client_ip);
        return;
    }

    const matched_route = route_match.?;

    // Check internal-only routes
    if (matched_route.internal_only and !routes.isInternalRequest(client_ip)) {
        try server_request.respond(
            "{\"error\":{\"code\":\"FORBIDDEN\",\"message\":\"Internal access only\"}}",
            .{
                .status = .forbidden,
                .headers = response_headers,
            },
        );
        global_metrics.increment(.total);
        global_metrics.increment(.c4xx);
        logger.logRequest(method, target, 403, @intCast(std.time.milliTimestamp() - start_time), client_ip);
        return;
    }

    // Handle local health endpoint
    if (std.mem.eql(u8, matched_route.upstream_url, "local")) {
        const health_response = health.checkGatewayHealth();
        try server_request.respond(health_response, .{
            .status = .ok,
            .headers = response_headers,
        });
        global_metrics.increment(.total);
        logger.logRequest(method, target, 200, @intCast(std.time.milliTimestamp() - start_time), client_ip);
        return;
    }

    // Proxy request to upstream
    const upstream_response = proxy_client.forward(
        matched_route.upstream_url,
        server_request.*,
        client_ip,
        request_id,
        if (project_ctx) |ctx| proxy.UpstreamContext{
            .project_id = ctx.project_id,
            .db_schema = ctx.db_schema,
            .is_service_role = ctx.is_service_role,
        } else null,
    ) catch |err| {
        const error_body = switch (err) {
            proxy.ProxyError.ConnectionRefused => proxy.getConnectionRefusedError(),
            proxy.ProxyError.Timeout => proxy.getTimeoutError(),
            else => "{\"error\":{\"code\":\"INTERNAL_ERROR\",\"message\":\"Failed to proxy request\"}}",
        };
        const status: std.http.Status = switch (err) {
            proxy.ProxyError.ConnectionRefused => .service_unavailable,
            proxy.ProxyError.Timeout => .gateway_timeout,
            else => .internal_server_error,
        };
        try server_request.respond(error_body, .{
            .status = status,
            .headers = response_headers,
        });
        global_metrics.increment(.total);
        if (@intFromEnum(status) >= 500) {
            global_metrics.increment(.c5xx);
        } else if (@intFromEnum(status) >= 400) {
            global_metrics.increment(.c4xx);
        }
        logger.logRequest(method, target, @intFromEnum(status), @intCast(std.time.milliTimestamp() - start_time), client_ip);
        return;
    };
    defer upstream_response.deinit(allocator);

    // Forward upstream response
    try server_request.respond(upstream_response.body, .{
        .status = @enumFromInt(upstream_response.status_code),
        .headers = response_headers,
    });
    global_metrics.increment(.total);
    if (upstream_response.status_code >= 500) {
        global_metrics.increment(.c5xx);
    } else if (upstream_response.status_code >= 400) {
        global_metrics.increment(.c4xx);
    }
    _ = global_metrics.bytes_proxied.fetchAdd(upstream_response.body.len, .monotonic);

    logger.logRequest(method, target, upstream_response.status_code, @intCast(std.time.milliTimestamp() - start_time), client_ip);
}

/// Server context for passing to connection handlers
const ServerContext = struct {
    allocator: std.mem.Allocator,
    cfg: *const config.Config,
    rate_limiter: *ratelimit.RateLimiter,
    project_cache: *project.ProjectCache,
};

/// Handle a single connection
fn handleConnection(ctx: ServerContext, connection: std.net.Server.Connection) void {
    _ = global_metrics.active_connections.fetchAdd(1, .monotonic);
    defer _ = global_metrics.active_connections.fetchSub(1, .monotonic);
    defer connection.stream.close();

    var read_buffer: [8192]u8 = undefined;
    var server = std.http.Server.init(connection, &read_buffer);

    var proxy_client = proxy.Proxy.init(ctx.allocator, ctx.cfg.internal_secret);
    defer proxy_client.deinit();

    const request_id = std.fmt.allocPrint(ctx.allocator, "{d}", .{logger.generateRequestId()}) catch return;
    defer ctx.allocator.free(request_id);

    // Read and handle one request (keep-alive can be implemented later)
    var request = server.receiveHead() catch |err| {
        logger.logError("Failed to receive request head", err);
        return;
    };

    handleRequest(
        ctx.allocator,
        ctx.cfg,
        ctx.rate_limiter,
        ctx.project_cache,
        &request,
        &proxy_client,
        request_id,
    ) catch |err| {
        logger.logError("Failed to handle request", err);
    };
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Initialize logger
    logger.init(allocator);
    defer logger.deinit();

    // Log startup
    logger.info("Starting indus-gate v" ++ VERSION);

    // Load configuration
    var cfg = config.Config.fromEnv(allocator) catch |err| {
        std.log.err("Failed to load configuration: {s}", .{@errorName(err)});
        return err;
    };
    defer cfg.deinit(allocator);

    // Validate configuration
    cfg.validate() catch |err| {
        std.log.err("Invalid configuration: {s}", .{@errorName(err)});
        return err;
    };

    logger.info("Configuration loaded successfully");

    // Initialize rate limiter
    var rate_limiter = ratelimit.RateLimiter.init(
        allocator,
        cfg.rate_limit_rps,
        cfg.rate_limit_burst,
    );
    defer rate_limiter.deinit();
    var project_cache = project.ProjectCache.init(allocator);
    defer project_cache.deinit();

    // Setup signal handlers for graceful shutdown
    try setupSignalHandlers();
    logger.info("Signal handlers registered");

    // Create server address
    const addr = try std.net.Address.parseIp4("0.0.0.0", cfg.server_port);
    var tcp_server = try addr.listen(.{
        .reuse_address = true,
    });
    defer tcp_server.deinit();

    logger.info(try std.fmt.allocPrint(allocator, "Server listening on port {d}", .{cfg.server_port}));

    // Accept loop
    const ctx = ServerContext{
        .allocator = allocator,
        .cfg = &cfg,
        .rate_limiter = &rate_limiter,
        .project_cache = &project_cache,
    };

    while (!shutdown_requested.load(.monotonic)) {
        // Set accept timeout to allow checking shutdown flag
        tcp_server.kernel_backlog = 128;

        const connection = tcp_server.accept() catch |err| {
            if (err == error.WouldBlock) {
                std.time.sleep(10 * std.time.ns_per_ms);
                continue;
            }
            if (shutdown_requested.load(.monotonic)) break;
            logger.logError("Accept error", err);
            continue;
        };

        // Spawn thread to handle connection
        const thread = std.Thread.spawn(.{}, handleConnection, .{ ctx, connection }) catch |err| {
            logger.logError("Failed to spawn thread", err);
            connection.stream.close();
            continue;
        };
        thread.detach();
    }

    logger.info("Shutdown requested, waiting for active connections...");

    // Give active requests time to complete
    std.time.sleep(1 * std.time.ns_per_s);

    logger.info("Shutdown complete");
}
