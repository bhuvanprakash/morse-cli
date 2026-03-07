const std = @import("std");

/// JWT configuration
pub const JwtConfig = struct {
    public_key_path: []const u8,
};

/// Rate limit configuration
pub const RateLimitConfig = struct {
    rps: u32,
    burst: u32,
};

/// Main configuration struct loaded from environment variables
pub const Config = struct {
    server_port: u16,
    upstream_auth: []const u8,
    upstream_query: []const u8,
    upstream_meta: []const u8,
    upstream_pool_health: []const u8,
    upstream_live: []const u8,
    upstream_store: []const u8,
    upstream_edge: []const u8,
    upstream_ai: []const u8,
    upstream_queue: []const u8,
    upstream_notify: []const u8,
    upstream_config: []const u8,
    upstream_audit: []const u8,
    upstream_billing: []const u8,
    upstream_secrets: []const u8,
    upstream_status: []const u8,
    jwt_public_key_path: []const u8,
    internal_secret: []const u8,
    rate_limit_rps: u32,
    rate_limit_burst: u32,
    cors_origins: []const u8,
    tls_cert_path: ?[]const u8,
    tls_key_path: ?[]const u8,

    /// Load configuration from environment variables
    pub fn fromEnv(allocator: std.mem.Allocator) !Config {
        const server_port = try parseU16(getEnvDefault("SERVER_PORT", "8000"));
        const rate_limit_rps = try parseU32(getEnvDefault("RATE_LIMIT_RPS", "100"));
        const rate_limit_burst = try parseU32(getEnvDefault("RATE_LIMIT_BURST", "20"));

        const upstream_auth = try allocator.dupe(u8, getEnvDefault("UPSTREAM_AUTH", "http://indus-auth:8001"));
        errdefer allocator.free(upstream_auth);

        const upstream_query = try allocator.dupe(u8, getEnvDefault("UPSTREAM_QUERY", "http://indus-query:8002"));
        errdefer allocator.free(upstream_query);

        const upstream_meta = try allocator.dupe(u8, getEnvDefault("UPSTREAM_META", "http://indus-meta:8003"));
        errdefer allocator.free(upstream_meta);

        const upstream_pool_health = try allocator.dupe(u8, getEnvDefault("UPSTREAM_POOL_HEALTH", "http://indus-pool:9091"));
        errdefer allocator.free(upstream_pool_health);

        const upstream_live = try allocator.dupe(u8, getEnvDefault("UPSTREAM_LIVE", "http://indus-live:8004"));
        errdefer allocator.free(upstream_live);

        const upstream_store = try allocator.dupe(u8, getEnvDefault("UPSTREAM_STORE", "http://indus-store:8005"));
        errdefer allocator.free(upstream_store);

        const upstream_edge = try allocator.dupe(u8, getEnvDefault("UPSTREAM_EDGE", "http://indus-edge:8006"));
        errdefer allocator.free(upstream_edge);

        const upstream_ai = try allocator.dupe(u8, getEnvDefault("UPSTREAM_AI", "http://indus-ai:8007"));
        errdefer allocator.free(upstream_ai);

        const upstream_queue = try allocator.dupe(u8, getEnvDefault("UPSTREAM_QUEUE", "http://indus-queue:8008"));
        errdefer allocator.free(upstream_queue);

        const upstream_notify = try allocator.dupe(u8, getEnvDefault("UPSTREAM_NOTIFY", "http://indus-notify:8009"));
        errdefer allocator.free(upstream_notify);

        const upstream_config = try allocator.dupe(u8, getEnvDefault("UPSTREAM_CONFIG", "http://indus-config:8010"));
        errdefer allocator.free(upstream_config);

        const upstream_audit = try allocator.dupe(u8, getEnvDefault("UPSTREAM_AUDIT", "http://indus-audit:8011"));
        errdefer allocator.free(upstream_audit);

        const upstream_billing = try allocator.dupe(u8, getEnvDefault("UPSTREAM_BILLING", "http://indus-billing:8012"));
        errdefer allocator.free(upstream_billing);

        const upstream_secrets = try allocator.dupe(u8, getEnvDefault("UPSTREAM_SECRETS", "http://indus-secrets:8013"));
        errdefer allocator.free(upstream_secrets);

        const upstream_status = try allocator.dupe(u8, getEnvDefault("UPSTREAM_STATUS", "http://indus-status:8014"));
        errdefer allocator.free(upstream_status);

        const jwt_public_key_path = std.process.getEnvVarOwned(allocator, "JWT_PUBLIC_KEY_PATH") catch |err| {
            std.log.err("JWT_PUBLIC_KEY_PATH environment variable is required", .{});
            return err;
        };
        errdefer allocator.free(jwt_public_key_path);

        const internal_secret = std.process.getEnvVarOwned(allocator, "INTERNAL_SECRET") catch |err| {
            std.log.err("INTERNAL_SECRET environment variable is required", .{});
            return err;
        };
        errdefer allocator.free(internal_secret);

        const cors_origins = try allocator.dupe(u8, getEnvDefault("CORS_ORIGINS", "*"));
        errdefer allocator.free(cors_origins);

        const tls_cert_path = if (std.process.getEnvVarOwned(allocator, "TLS_CERT_PATH")) |path| path catch |err| switch (err) {
            error.EnvironmentVariableNotFound => null,
            else => return err,
        } else null;

        const tls_key_path = if (std.process.getEnvVarOwned(allocator, "TLS_KEY_PATH")) |path| path catch |err| switch (err) {
            error.EnvironmentVariableNotFound => null,
            else => return err,
        } else null;

        return Config{
            .server_port = server_port,
            .upstream_auth = upstream_auth,
            .upstream_query = upstream_query,
            .upstream_meta = upstream_meta,
            .upstream_pool_health = upstream_pool_health,
            .upstream_live = upstream_live,
            .upstream_store = upstream_store,
            .upstream_edge = upstream_edge,
            .upstream_ai = upstream_ai,
            .upstream_queue = upstream_queue,
            .upstream_notify = upstream_notify,
            .upstream_config = upstream_config,
            .upstream_audit = upstream_audit,
            .upstream_billing = upstream_billing,
            .upstream_secrets = upstream_secrets,
            .upstream_status = upstream_status,
            .jwt_public_key_path = jwt_public_key_path,
            .internal_secret = internal_secret,
            .rate_limit_rps = rate_limit_rps,
            .rate_limit_burst = rate_limit_burst,
            .cors_origins = cors_origins,
            .tls_cert_path = tls_cert_path,
            .tls_key_path = tls_key_path,
        };
    }

    /// Free configuration resources
    pub fn deinit(self: *Config, allocator: std.mem.Allocator) void {
        allocator.free(self.upstream_auth);
        allocator.free(self.upstream_query);
        allocator.free(self.upstream_meta);
        allocator.free(self.upstream_pool_health);
        allocator.free(self.upstream_live);
        allocator.free(self.upstream_store);
        allocator.free(self.upstream_edge);
        allocator.free(self.upstream_ai);
        allocator.free(self.upstream_queue);
        allocator.free(self.upstream_notify);
        allocator.free(self.upstream_config);
        allocator.free(self.upstream_audit);
        allocator.free(self.upstream_billing);
        allocator.free(self.upstream_secrets);
        allocator.free(self.upstream_status);
        allocator.free(self.jwt_public_key_path);
        allocator.free(self.internal_secret);
        allocator.free(self.cors_origins);
        if (self.tls_cert_path) |path| allocator.free(path);
        if (self.tls_key_path) |path| allocator.free(path);
    }

    /// Validate configuration
    pub fn validate(self: Config) !void {
        if (self.server_port == 0) {
            return error.InvalidPort;
        }

        if (self.jwt_public_key_path.len == 0) {
            return error.EmptyJwtPublicKeyPath;
        }

        if (self.internal_secret.len == 0) {
            return error.EmptyInternalSecret;
        }

        if (self.tls_cert_path != null and self.tls_key_path == null) {
            return error.TlsKeyMissing;
        }

        if (self.tls_key_path != null and self.tls_cert_path == null) {
            return error.TlsCertMissing;
        }

        // Validate upstream URLs are not empty
        if (self.upstream_auth.len == 0) return error.EmptyUpstreamAuth;
        if (self.upstream_query.len == 0) return error.EmptyUpstreamQuery;
        if (self.upstream_meta.len == 0) return error.EmptyUpstreamMeta;
        if (self.upstream_pool_health.len == 0) return error.EmptyUpstreamPoolHealth;
        if (self.upstream_live.len == 0) return error.EmptyUpstreamLive;
        if (self.upstream_store.len == 0) return error.EmptyUpstreamStore;
        if (self.upstream_edge.len == 0) return error.EmptyUpstreamEdge;
        if (self.upstream_ai.len == 0) return error.EmptyUpstreamAi;
        if (self.upstream_queue.len == 0) return error.EmptyUpstreamQueue;
        if (self.upstream_notify.len == 0) return error.EmptyUpstreamNotify;
        if (self.upstream_config.len == 0) return error.EmptyUpstreamConfig;
        if (self.upstream_audit.len == 0) return error.EmptyUpstreamAudit;
        if (self.upstream_billing.len == 0) return error.EmptyUpstreamBilling;
        if (self.upstream_secrets.len == 0) return error.EmptyUpstreamSecrets;
        if (self.upstream_status.len == 0) return error.EmptyUpstreamStatus;
    }
};

/// Get environment variable with default value
fn getEnvDefault(name: []const u8, default_value: []const u8) []const u8 {
    return std.process.getEnvVarOwned(std.heap.page_allocator, name) catch |err| switch (err) {
        error.EnvironmentVariableNotFound => default_value,
        else => default_value,
    };
}

/// Parse u16 from string
fn parseU16(value: []const u8) !u16 {
    return std.fmt.parseUnsigned(u16, value, 10) catch |err| {
        std.log.err("Failed to parse '{s}' as u16: {s}", .{ value, @errorName(err) });
        return err;
    };
}

/// Parse u32 from string
fn parseU32(value: []const u8) !u32 {
    return std.fmt.parseUnsigned(u32, value, 10) catch |err| {
        std.log.err("Failed to parse '{s}' as u32: {s}", .{ value, @errorName(err) });
        return err;
    };
}
