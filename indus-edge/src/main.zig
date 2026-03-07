const std = @import("std");
const Config = @import("config/config.zig").Config;
const WarmPool = @import("runtime/pool.zig").WarmPool;
const FunctionRegistry = @import("registry/registry.zig").FunctionRegistry;
const Server = @import("http/server.zig").Server;
const HealthChecker = @import("health/health.zig").HealthChecker;

/// Global flag for graceful shutdown
var running = std.atomic.Value(bool).init(true);

/// Signal handler for SIGTERM
fn handleSigTerm(sig: i32, info: *const std.posix.siginfo_t, ctx: ?*const anyopaque) callconv(.C) void {
    _ = sig;
    _ = info;
    _ = ctx;
    std.log.info("Received SIGTERM, shutting down gracefully...");
    running.store(false, .seq_cst);
}

/// Signal handler for SIGINT
fn handleSigInt(sig: i32, info: *const std.posix.siginfo_t, ctx: ?*const anyopaque) callconv(.C) void {
    _ = sig;
    _ = info;
    _ = ctx;
    std.log.info("Received SIGINT, shutting down gracefully...");
    running.store(false, .seq_cst);
}

/// Setup signal handlers
fn setupSignalHandlers() !void {
    const sa = std.posix.Sigaction{
        .handler = .{ .sigaction = handleSigTerm },
        .mask = std.posix.empty_sigset,
        .flags = std.posix.SA.SIGINFO,
    };
    
    try std.posix.sigaction(std.posix.SIG.TERM, &sa, null);
    
    const sa_int = std.posix.Sigaction{
        .handler = .{ .sigaction = handleSigInt },
        .mask = std.posix.empty_sigset,
        .flags = std.posix.SA.SIGINFO,
    };
    
    try std.posix.sigaction(std.posix.SIG.INT, &sa_int, null);
}

/// Background task to warm the pool
fn poolWarmer(pool: *WarmPool) void {
    while (running.load(.seq_cst)) {
        pool.ensureWarmed() catch |err| {
            std.log.err("Failed to warm pool: {s}", .{@errorName(err)});
        };
        
        std.time.sleep(5 * std.time.ns_per_s); // Check every 5 seconds
    }
}

/// Background task to monitor pool health
fn poolMonitor(pool: *WarmPool) void {
    while (running.load(.seq_cst)) {
        pool.replaceDeadWorkers() catch |err| {
            std.log.err("Failed to replace dead workers: {s}", .{@errorName(err)});
        };
        
        std.time.sleep(10 * std.time.ns_per_s); // Check every 10 seconds
    }
}

/// Background task to watch for file changes
fn fileWatcher(registry: *FunctionRegistry) void {
    while (running.load(.seq_cst)) {
        registry.checkForChanges() catch |err| {
            std.log.err("Failed to check for file changes: {s}", .{@errorName(err)});
        };
        
        std.time.sleep(1 * std.time.ns_per_s); // Check every second
    }
}

pub fn main() !void {
    // Initialize allocator
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.log.info("Starting Indus Edge Runtime v0.1.0");

    // Setup signal handlers
    try setupSignalHandlers();

    // Load configuration
    const config = try Config.fromEnv(allocator);
    defer config.deinit(allocator);

    std.log.info("Configuration loaded:");
    std.log.info("  Server port: {d}", .{config.server_port});
    std.log.info("  Functions dir: {s}", .{config.functions_dir});
    std.log.info("  Worker memory limit: {d}MB", .{config.worker_memory_limit_mb});
    std.log.info("  Warm pool size: {d}", .{config.warmpool_size});

    // Initialize function registry
    var registry = try FunctionRegistry.init(allocator, config.functions_dir);
    defer registry.deinit();

    // Scan and load functions
    try registry.scanAndLoad();

    // Initialize worker pool
    var pool = WarmPool.init(
        allocator,
        &registry.functions,
        config.bun_binary_path,
        config.handler_script_path,
        config.worker_memory_limit_mb,
        config.warmpool_size,
    );
    defer pool.deinit();

    // Initialize health checker
    var health = HealthChecker.init();
    health.setPool(&pool);
    health.setRegistry(&registry);
    health.setConfig(&config);

    // Start background threads
    const warmer_thread = try std.Thread.spawn(.{}, poolWarmer, .{&pool});
    const monitor_thread = try std.Thread.spawn(.{}, poolMonitor, .{&pool});
    const watcher_thread = try std.Thread.spawn(.{}, fileWatcher, .{&registry});

    defer {
        warmer_thread.join();
        monitor_thread.join();
        watcher_thread.join();
    }

    // Give pool a moment to warm up
    std.time.sleep(2 * std.time.ns_per_s);

    // Initialize and start HTTP server
    var server = try Server.init(allocator, &config, &pool, &registry);
    defer server.deinit();

    std.log.info("Indus Edge Runtime started successfully");

    // Start server in a separate thread so we can handle shutdown
    const server_thread = try std.Thread.spawn(.{}, struct {
        fn run(s: *Server) !void {
            try s.start();
        }
    }.run, .{&server});

    // Wait for shutdown signal
    while (running.load(.seq_cst)) {
        std.time.sleep(100 * std.time.ns_per_ms);
    }

    std.log.info("Shutting down...");

    // Shutdown server
    server.deinit();

    // Wait for server thread
    server_thread.join();

    std.log.info("Indus Edge Runtime stopped");
}