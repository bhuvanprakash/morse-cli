const std = @import("std");
const httpz = @import("httpz");
const WarmPool = @import("../runtime/pool.zig").WarmPool;
const FunctionRegistry = @import("../registry/registry.zig").FunctionRegistry;
const Config = @import("../config/config.zig").Config;
const bun_worker = @import("../runtime/bun_worker.zig");

var g_pool: ?*WarmPool = null;
var g_registry: ?*FunctionRegistry = null;
var g_config: ?*const Config = null;

/// HTTP Server for handling function invocations
pub const Server = struct {
    /// HTTP server instance
    http_server: httpz.Server(void),
    
    /// Worker pool
    pool: *WarmPool,
    
    /// Function registry
    registry: *FunctionRegistry,
    
    /// Configuration
    config: *const Config,
    
    /// Allocator
    allocator: std.mem.Allocator,

    const Self = @This();

    pub fn init(
        allocator: std.mem.Allocator,
        config: *const Config,
        pool: *WarmPool,
        registry: *FunctionRegistry,
    ) !Server {
        // Create HTTP server
        var server = try httpz.Server(void).init(allocator, .{
            .port = config.server_port,
            .address = "0.0.0.0",
        });

        // Set up routes
        var router = server.router();
        
        // Health check
        router.get("/health", getHealth, .{});
        
        // Function list
        router.get("/functions", listFunctions, .{});
        
        // Function health check
        router.get("/functions/:name/health", getFunctionHealth, .{});
        
        // Function invoke (alias)
        router.post("/functions/:name/invoke", invokeFunction, .{});
        
        // Function invoke (main route)
        router.post("/functions/:name", invokeFunction, .{});
        
        // Also support GET for functions that handle GET
        router.get("/functions/:name", invokeFunction, .{});
        router.put("/functions/:name", invokeFunction, .{});
        router.delete("/functions/:name", invokeFunction, .{});

        g_pool = pool;
        g_registry = registry;
        g_config = config;

        return .{
            .http_server = server,
            .pool = pool,
            .registry = registry,
            .config = config,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *Self) void {
        self.http_server.stop();
        self.http_server.deinit();
    }

    /// Start the HTTP server
    pub fn start(self: *Self) !void {
        std.log.info("Starting HTTP server on port {d}", .{self.config.server_port});
        try self.http_server.listen();
    }

    /// Health check handler
    fn getHealth(req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;
        
        const health = .{
            .status = "healthy",
            .service = "indus-edge",
            .version = "0.1.0",
        };
        
        res.status = 200;
        res.content_type = .JSON;
        try res.json(health, .{});
    }

    /// List all functions
    fn listFunctions(req: *httpz.Request, res: *httpz.Response) !void {
        _ = req;

        const registry = g_registry orelse {
            res.status = 500;
            res.content_type = .JSON;
            try res.json(.{ .error = "function registry unavailable" }, .{});
            return;
        };

        var functions = std.ArrayList(struct {
            name: []const u8,
            route_pattern: []const u8,
            version: []const u8,
            public_access: bool,
            status: []const u8,
        }).init(req.arena);

        var it = registry.functions.iterator();
        while (it.next()) |entry| {
            const func_def = entry.value_ptr.*;
            try functions.append(.{
                .name = func_def.name,
                .route_pattern = func_def.route_pattern,
                .version = func_def.version,
                .public_access = func_def.metadata.public_access,
                .status = "loaded",
            });
        }

        res.status = 200;
        res.content_type = .JSON;
        try res.json(.{ .functions = functions.items }, .{});
    }

    /// Function health check
    fn getFunctionHealth(req: *httpz.Request, res: *httpz.Response) !void {
        const name = req.param("name").?;

        const registry = g_registry orelse {
            res.status = 500;
            res.content_type = .JSON;
            try res.json(.{ .error = "function registry unavailable" }, .{});
            return;
        };

        const pool = g_pool orelse {
            res.status = 500;
            res.content_type = .JSON;
            try res.json(.{ .error = "worker pool unavailable" }, .{});
            return;
        };

        const func_def = registry.getFunction(name) orelse {
            res.status = 404;
            res.content_type = .JSON;
            try res.json(.{ .error = "function not found" }, .{});
            return;
        };

        var workers_total: usize = 0;
        var workers_available: usize = 0;
        if (pool.workers.getPtr(name)) |worker_list| {
            workers_total = worker_list.items.len;
            for (worker_list.items) |worker| {
                if (!worker.is_busy and worker.isAlive()) {
                    workers_available += 1;
                }
            }
        }

        res.status = 200;
        res.content_type = .JSON;
        try res.json(.{
            .name = name,
            .loaded = true,
            .workers_total = workers_total,
            .workers_available = workers_available,
            .route_pattern = func_def.route_pattern,
            .version = func_def.version,
        }, .{});
    }

    /// Invoke a function
    fn invokeFunction(req: *httpz.Request, res: *httpz.Response) !void {
        const allocator = req.arena;
        const function_name = req.param("name") orelse {
            res.status = 400;
            res.content_type = .JSON;
            try res.json(.{ .error = "function name required" }, .{});
            return;
        };

        const registry = g_registry orelse {
            res.status = 500;
            res.content_type = .JSON;
            try res.json(.{ .error = "function registry unavailable" }, .{});
            return;
        };
        const cfg = g_config orelse {
            res.status = 500;
            res.content_type = .JSON;
            try res.json(.{ .error = "config unavailable" }, .{});
            return;
        };

        const function_def = registry.getFunction(function_name) orelse {
            res.status = 404;
            res.content_type = .JSON;
            try res.json(.{ .error = "function not found" }, .{});
            return;
        };

        const project_id = req.header("X-IndusBase-Project-ID") orelse req.header("x-indusbase-project-id");

        const function_code = std.fs.cwd().readFileAlloc(allocator, function_def.path, 1024 * 1024) catch {
            res.status = 500;
            res.content_type = .JSON;
            try res.json(.{ .error = "failed to read function source" }, .{});
            return;
        };

        var env_entries = std.ArrayList([]const u8).init(allocator);
        defer {
            for (env_entries.items) |entry| allocator.free(entry);
            env_entries.deinit();
        }

        var func_env_it = function_def.env_vars.iterator();
        while (func_env_it.next()) |entry| {
            if (std.mem.startsWith(u8, entry.value_ptr.*, "secret://")) {
                const secret_name = entry.value_ptr.*["secret://".len..];
                if (secret_name.len == 0) continue;

                const secret_value = fetchSecretValue(
                    allocator,
                    cfg,
                    secret_name,
                    project_id,
                    function_name,
                ) catch null;
                if (secret_value) |value| {
                    defer allocator.free(value);
                    const env_line = std.fmt.allocPrint(allocator, "{s}={s}", .{ entry.key_ptr.*, value }) catch continue;
                    try env_entries.append(env_line);
                    continue;
                }
            }

            const raw_env = std.fmt.allocPrint(allocator, "{s}={s}", .{ entry.key_ptr.*, entry.value_ptr.* }) catch continue;
            try env_entries.append(raw_env);
        }

        const body = req.body() orelse "";
        const request_json = std.json.stringifyAlloc(allocator, .{
            .method = @tagName(req.method),
            .path = req.url.path,
            .body = body,
            .__indusbase_url = cfg.indusbase_api_url,
            .__anon_key = "internal",
        }, .{}) catch {
            res.status = 500;
            res.content_type = .JSON;
            try res.json(.{ .error = "failed to encode invoke request" }, .{});
            return;
        };

        const worker_cfg = bun_worker.WorkerConfig{
            .bun_path = cfg.bun_binary_path,
            .timeout_ms = @intCast(cfg.worker_timeout_ms),
            .memory_limit_mb = cfg.worker_memory_limit_mb,
            .env_vars = env_entries.items,
        };
        var result = bun_worker.executeFunction(allocator, worker_cfg, function_code, request_json) catch |err| {
            res.status = 500;
            res.content_type = .JSON;
            try res.json(.{ .error = @errorName(err) }, .{});
            return;
        };
        defer result.deinit(allocator);

        res.status = @intCast(result.status_code);
        try res.body(result.body);
    }

    fn fetchSecretValue(
        allocator: std.mem.Allocator,
        cfg: *const Config,
        secret_name: []const u8,
        project_id: ?[]const u8,
        function_name: []const u8,
    ) !?[]const u8 {
        var payload = std.ArrayList(u8).init(allocator);
        defer payload.deinit();
        const writer = payload.writer();

        try writer.writeByte('{');
        try writer.writeAll("\"name\":");
        try writeJSONString(writer, secret_name);
        if (project_id) |pid| {
            try writer.writeAll(",\"project_id\":");
            try writeJSONString(writer, pid);
        }
        try writer.writeAll(",\"function_id\":");
        try writeJSONString(writer, function_name);
        try writer.writeByte('}');

        const url = try std.fmt.allocPrint(allocator, "{s}/secrets/internal/fetch", .{cfg.secrets_service_url});
        defer allocator.free(url);
        var uri = try std.Uri.parse(url);

        var client = std.http.Client{ .allocator = allocator };
        defer client.deinit();

        var headers = std.http.Headers{ .allocator = allocator };
        defer headers.deinit();
        try headers.append("Content-Type", "application/json");
        if (cfg.internal_secret.len > 0) {
            try headers.append("X-IndusBase-Internal", cfg.internal_secret);
        }

        var server_header_buffer: [8192]u8 = undefined;
        const response = client.fetch(.{
            .location = .{ .uri = uri },
            .method = .POST,
            .headers = headers,
            .payload = payload.items,
            .server_header_buffer = &server_header_buffer,
        }) catch return null;

        if (response.status != .ok) {
            return null;
        }

        const raw = response.body orelse return null;
        var parsed = std.json.parseFromSlice(std.json.Value, allocator, raw, .{}) catch return null;
        defer parsed.deinit();

        const root = parsed.value.object;
        const data = root.get("data") orelse return null;
        if (data != .object) return null;
        const value = data.object.get("value") orelse return null;
        if (value != .string) return null;
        return try allocator.dupe(u8, value.string);
    }

    fn writeJSONString(writer: anytype, value: []const u8) !void {
        try writer.writeByte('"');
        for (value) |ch| {
            switch (ch) {
                '"' => try writer.writeAll("\\\""),
                '\\' => try writer.writeAll("\\\\"),
                '\n' => try writer.writeAll("\\n"),
                '\r' => try writer.writeAll("\\r"),
                '\t' => try writer.writeAll("\\t"),
                else => try writer.writeByte(ch),
            }
        }
        try writer.writeByte('"');
    }
};
