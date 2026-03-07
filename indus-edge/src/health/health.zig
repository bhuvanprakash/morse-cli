const std = @import("std");
const WarmPool = @import("../runtime/pool.zig").WarmPool;
const FunctionRegistry = @import("../registry/registry.zig").FunctionRegistry;
const Config = @import("../config/config.zig").Config;

/// Health status for the service
pub const HealthStatus = struct {
    /// Overall status: healthy, degraded, or unhealthy
    status: []const u8,
    
    /// Service name
    service: []const u8,
    
    /// Version
    version: []const u8,
    
    /// Timestamp
    timestamp: i64,
    
    /// Worker pool statistics
    pool_stats: ?PoolStats,
    
    /// Function count
    functions_loaded: usize,
    
    /// Uptime in seconds
    uptime_seconds: u64,

    pub fn healthy(functions_loaded: usize, uptime: u64) HealthStatus {
        return .{
            .status = "healthy",
            .service = "indus-edge",
            .version = "0.1.0",
            .timestamp = std.time.milliTimestamp(),
            .pool_stats = null,
            .functions_loaded = functions_loaded,
            .uptime_seconds = uptime,
        };
    }

    pub fn degraded(functions_loaded: usize, uptime: u64) HealthStatus {
        return .{
            .status = "degraded",
            .service = "indus-edge",
            .version = "0.1.0",
            .timestamp = std.time.milliTimestamp(),
            .pool_stats = null,
            .functions_loaded = functions_loaded,
            .uptime_seconds = uptime,
        };
    }

    pub fn unhealthy(functions_loaded: usize, uptime: u64) HealthStatus {
        return .{
            .status = "unhealthy",
            .service = "indus-edge",
            .version = "0.1.0",
            .timestamp = std.time.milliTimestamp(),
            .pool_stats = null,
            .functions_loaded = functions_loaded,
            .uptime_seconds = uptime,
        };
    }
};

/// Pool statistics for health reporting
pub const PoolStats = struct {
    /// Total workers
    total_workers: usize,
    
    /// Busy workers
    busy_workers: usize,
    
    /// Idle workers
    idle_workers: usize,
    
    /// Dead workers
    dead_workers: usize,
    
    /// Total invocations processed
    total_invocations: u64,
};

/// Health checker for monitoring service health
pub const HealthChecker = struct {
    /// Start time for uptime calculation
    start_time: i64,
    
    /// Reference to worker pool
    pool: ?*WarmPool,
    
    /// Reference to function registry
    registry: ?*FunctionRegistry,
    
    /// Configuration
    config: ?*const Config,

    const Self = @This();

    pub fn init() HealthChecker {
        return .{
            .start_time = std.time.milliTimestamp(),
            .pool = null,
            .registry = null,
            .config = null,
        };
    }

    pub fn setPool(self: *Self, pool: *WarmPool) void {
        self.pool = pool;
    }

    pub fn setRegistry(self: *Self, registry: *FunctionRegistry) void {
        self.registry = registry;
    }

    pub fn setConfig(self: *Self, config: *const Config) void {
        self.config = config;
    }

    /// Get current health status
    pub fn getHealth(self: *Self) HealthStatus {
        const uptime = @as(u64, @intCast((std.time.milliTimestamp() - self.start_time) / 1000));
        
        var functions_loaded: usize = 0;
        if (self.registry) |registry| {
            functions_loaded = registry.functions.count();
        }

        // Check worker pool health
        if (self.pool) |pool| {
            const stats = pool.getStats();
            
            // Consider unhealthy if too many dead workers
            if (stats.dead_workers > stats.total_workers / 2) {
                return HealthStatus.unhealthy(functions_loaded, uptime);
            }
            
            // Consider degraded if no idle workers
            if (stats.idle_workers == 0 and stats.total_workers > 0) {
                return HealthStatus.degraded(functions_loaded, uptime);
            }
        }

        return HealthStatus.healthy(functions_loaded, uptime);
    }

    /// Get detailed pool statistics
    pub fn getPoolStats(self: *Self) ?PoolStats {
        if (self.pool) |pool| {
            const stats = pool.getStats();
            return .{
                .total_workers = stats.total_workers,
                .busy_workers = stats.busy_workers,
                .idle_workers = stats.idle_workers,
                .dead_workers = stats.dead_workers,
                .total_invocations = stats.total_invocations,
            };
        }
        return null;
    }

    /// Get uptime in seconds
    pub fn getUptime(self: *Self) u64 {
        return @as(u64, @intCast((std.time.milliTimestamp() - self.start_time) / 1000));
    }

    /// Check if service is ready to handle requests
    pub fn isReady(self: *Self) bool {
        if (self.registry) |registry| {
            // Ready if we have functions loaded
            if (registry.functions.count() > 0) {
                return true;
            }
        }
        
        // Also ready if no functions are expected
        return true;
    }

    /// Check if service is alive
    pub fn isAlive(self: *Self) bool {
        // Check worker pool health
        if (self.pool) |pool| {
            const stats = pool.getStats();
            // Dead if all workers are dead
            if (stats.total_workers > 0 and stats.dead_workers == stats.total_workers) {
                return false;
            }
        }
        
        return true;
    }
};