const std = @import("std");

/// Configuration for the Indus Edge runtime
pub const Config = struct {
    /// HTTP server port
    server_port: u16 = 8006,
    
    /// Maximum concurrent function invocations
    max_concurrent_invocations: u32 = 100,
    
    /// Memory limit per worker in MB
    worker_memory_limit_mb: u32 = 128,
    
    /// Worker timeout in milliseconds
    worker_timeout_ms: u64 = 30000,
    
    /// Number of workers to keep warmed per function
    warmpool_size: u32 = 3,
    
    /// Directory containing function files
    functions_dir: []const u8 = "/var/indusbase/functions",
    
    /// Path to Bun binary
    bun_binary_path: []const u8 = "/usr/local/bin/bun",
    
    /// Path to the handler script
    handler_script_path: []const u8 = "/opt/indus-edge/runtime/handler.ts",
    
    /// Internal secret for authentication
    internal_secret: []const u8 = "",
    
    /// Indusbase API URL
    indusbase_api_url: []const u8 = "http://localhost:8000",

    /// Secrets service URL for runtime secret resolution
    secrets_service_url: []const u8 = "http://indus-secrets:8013",

    /// Load configuration from environment variables
    pub fn fromEnv(allocator: std.mem.Allocator) !Config {
        var config = Config{};

        if (std.process.getEnvVarOwned(allocator, "INDUS_EDGE_PORT")) |port_str| {
            defer allocator.free(port_str);
            config.server_port = try std.fmt.parseInt(u16, port_str, 10);
        } else |_| {
            if (std.process.getEnvVarOwned(allocator, "SERVER_PORT")) |port_str| {
                defer allocator.free(port_str);
                config.server_port = try std.fmt.parseInt(u16, port_str, 10);
            } else |_| {}
        }

        if (std.process.getEnvVarOwned(allocator, "INDUS_MAX_CONCURRENT")) |val| {
            defer allocator.free(val);
            config.max_concurrent_invocations = try std.fmt.parseInt(u32, val, 10);
        } else |_| {}

        if (std.process.getEnvVarOwned(allocator, "INDUS_WORKER_MEMORY_MB")) |val| {
            defer allocator.free(val);
            config.worker_memory_limit_mb = try std.fmt.parseInt(u32, val, 10);
        } else |_| {
            if (std.process.getEnvVarOwned(allocator, "WORKER_MEMORY_LIMIT_MB")) |val| {
                defer allocator.free(val);
                config.worker_memory_limit_mb = try std.fmt.parseInt(u32, val, 10);
            } else |_| {}
        }

        if (std.process.getEnvVarOwned(allocator, "INDUS_WORKER_TIMEOUT_MS")) |val| {
            defer allocator.free(val);
            config.worker_timeout_ms = try std.fmt.parseInt(u64, val, 10);
        } else |_| {
            if (std.process.getEnvVarOwned(allocator, "WORKER_TIMEOUT_MS")) |val| {
                defer allocator.free(val);
                config.worker_timeout_ms = try std.fmt.parseInt(u64, val, 10);
            } else |_| {}
        }

        if (std.process.getEnvVarOwned(allocator, "INDUS_WARMPOOL_SIZE")) |val| {
            defer allocator.free(val);
            config.warmpool_size = try std.fmt.parseInt(u32, val, 10);
        } else |_| {
            if (std.process.getEnvVarOwned(allocator, "WARMPOOL_SIZE")) |val| {
                defer allocator.free(val);
                config.warmpool_size = try std.fmt.parseInt(u32, val, 10);
            } else |_| {}
        }

        if (std.process.getEnvVarOwned(allocator, "INDUS_FUNCTIONS_DIR")) |val| {
            config.functions_dir = try allocator.dupe(u8, val);
        } else |_| {}

        if (std.process.getEnvVarOwned(allocator, "INDUS_BUN_PATH")) |val| {
            config.bun_binary_path = try allocator.dupe(u8, val);
        } else |_| {
            if (std.process.getEnvVarOwned(allocator, "BUN_BINARY_PATH")) |val| {
                config.bun_binary_path = try allocator.dupe(u8, val);
            } else |_| {}
        }

        if (std.process.getEnvVarOwned(allocator, "INDUS_HANDLER_PATH")) |val| {
            config.handler_script_path = try allocator.dupe(u8, val);
        } else |_| {}

        if (std.process.getEnvVarOwned(allocator, "INDUS_INTERNAL_SECRET")) |val| {
            config.internal_secret = try allocator.dupe(u8, val);
        } else |_| {
            if (std.process.getEnvVarOwned(allocator, "INTERNAL_SECRET")) |val| {
                config.internal_secret = try allocator.dupe(u8, val);
            } else |_| {}
        }

        if (std.process.getEnvVarOwned(allocator, "INDUS_API_URL")) |val| {
            config.indusbase_api_url = try allocator.dupe(u8, val);
        } else |_| {
            if (std.process.getEnvVarOwned(allocator, "INDUSBASE_API_URL")) |val| {
                config.indusbase_api_url = try allocator.dupe(u8, val);
            } else |_| {}
        }

        if (std.process.getEnvVarOwned(allocator, "SECRETS_SERVICE_URL")) |val| {
            config.secrets_service_url = try allocator.dupe(u8, val);
        } else |_| {}

        return config;
    }

    /// Free allocated memory
    pub fn deinit(self: *Config, allocator: std.mem.Allocator) void {
        // Free all allocated strings that differ from defaults
        // This is a simplified version - in production, track allocations properly
        _ = self;
        _ = allocator;
    }
};
