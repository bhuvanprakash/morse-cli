const std = @import("std");
const Worker = @import("worker.zig").Worker;
const FunctionDef = @import("function.zig").FunctionDef;

/// Pool statistics
pub const PoolStats = struct {
    /// Total workers across all functions
    total_workers: usize,
    
    /// Busy workers (currently processing)
    busy_workers: usize,
    
    /// Idle workers (available for use)
    idle_workers: usize,
    
    /// Dead workers (crashed, needs replacement)
    dead_workers: usize,
    
    /// Total invocations processed
    total_invocations: u64,
    
    /// Average response time in ms
    avg_response_time_ms: u64,
};

/// WarmPool manages a pool of pre-warmed workers per function
pub const WarmPool = struct {
    /// Maps function name to list of workers
    workers: std.StringHashMap(std.ArrayList(*Worker)),
    
    /// Reference to function definitions
    function_registry: *const std.StringHashMap(FunctionDef),
    
    /// Configuration
    bun_path: []const u8,
    handler_path: []const u8,
    memory_limit_mb: u32,
    warmpool_size: u32,
    
    /// Next worker ID
    next_worker_id: u64,
    
    /// Total invocations counter
    total_invocations: u64,
    
    /// Allocator
    allocator: std.mem.Allocator,

    const Self = @This();

    pub fn init(
        allocator: std.mem.Allocator,
        function_registry: *const std.StringHashMap(FunctionDef),
        bun_path: []const u8,
        handler_path: []const u8,
        memory_limit_mb: u32,
        warmpool_size: u32,
    ) WarmPool {
        return .{
            .workers = std.StringHashMap(std.ArrayList(*Worker)).init(allocator),
            .function_registry = function_registry,
            .bun_path = bun_path,
            .handler_path = handler_path,
            .memory_limit_mb = memory_limit_mb,
            .warmpool_size = warmpool_size,
            .next_worker_id = 1,
            .total_invocations = 0,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *Self) void {
        var func_it = self.workers.iterator();
        while (func_it.next()) |entry| {
            for (entry.value_ptr.items) |worker| {
                worker.kill();
                worker.deinit();
            }
            entry.value_ptr.deinit();
        }
        self.workers.deinit();
    }

    /// Get an idle worker for the specified function, or null if none available
    pub fn checkout(self: *Self, function_name: []const u8) ?*Worker {
        const worker_list = self.workers.getPtr(function_name) orelse return null;
        
        for (worker_list.items) |worker| {
            if (!worker.is_busy and worker.isAlive()) {
                worker.is_busy = true;
                worker.last_used_at = std.time.milliTimestamp();
                return worker;
            }
        }
        
        return null;
    }

    /// Return a worker to the pool (mark as idle)
    pub fn checkin(self: *Self, worker: *Worker) void {
        worker.is_busy = false;
        worker.last_used_at = std.time.milliTimestamp();
        self.total_invocations += 1;
    }

    /// Pre-warm workers up to warmpool_size for each function
    pub fn ensureWarmed(self: *Self) !void {
        var func_it = self.function_registry.iterator();
        while (func_it.next()) |entry| {
            const func_name = entry.key_ptr.*;
            const func_def = entry.value_ptr;
            
            // Get or create worker list for this function
            const result = try self.workers.getOrPut(func_name);
            if (!result.found_existing) {
                result.value_ptr.* = std.ArrayList(*Worker).init(self.allocator);
            }
            
            const worker_list = result.value_ptr;
            
            // Count healthy idle workers
            var idle_count: u32 = 0;
            for (worker_list.items) |worker| {
                if (!worker.is_busy and worker.isAlive()) {
                    idle_count += 1;
                }
            }
            
            // Spawn workers up to warmpool_size
            while (idle_count < self.warmpool_size) {
                const worker = Worker.spawn(
                    self.allocator,
                    self.next_worker_id,
                    func_def,
                    self.bun_path,
                    self.handler_path,
                    self.memory_limit_mb,
                ) catch |err| {
                    std.log.err("Failed to spawn worker for {s}: {s}", .{ func_name, @errorName(err) });
                    break;
                };
                
                try worker_list.append(worker);
                self.next_worker_id += 1;
                idle_count += 1;
                
                std.log.info("Spawned worker {d} for function {s}", .{ worker.id, func_name });
            }
        }
    }

    /// Scan and replace dead workers
    pub fn replaceDeadWorkers(self: *Self) !void {
        var func_it = self.workers.iterator();
        while (func_it.next()) |entry| {
            const func_name = entry.key_ptr.*;
            const worker_list = entry.value_ptr;
            
            var i: usize = 0;
            while (i < worker_list.items.len) {
                const worker = worker_list.items[i];
                
                if (!worker.isAlive()) {
                    std.log.warn("Worker {d} for {s} is dead, replacing", .{ worker.id, func_name });
                    
                    // Remove dead worker
                    worker.kill();
                    worker.deinit();
                    _ = worker_list.orderedRemove(i);
                    
                    // Get function definition
                    if (self.function_registry.getPtr(func_name)) |func_def| {
                        // Spawn replacement
                        const new_worker = Worker.spawn(
                            self.allocator,
                            self.next_worker_id,
                            func_def,
                            self.bun_path,
                            self.handler_path,
                            self.memory_limit_mb,
                        ) catch |err| {
                            std.log.err("Failed to replace worker for {s}: {s}", .{ func_name, @errorName(err) });
                            continue;
                        };
                        
                        try worker_list.append(new_worker);
                        self.next_worker_id += 1;
                        std.log.info("Replaced worker for {s} with new worker {d}", .{ func_name, new_worker.id });
                    }
                } else {
                    i += 1;
                }
            }
        }
    }

    /// Get pool statistics
    pub fn getStats(self: *Self) PoolStats {
        var total: usize = 0;
        var busy: usize = 0;
        var dead: usize = 0;
        
        var func_it = self.workers.iterator();
        while (func_it.next()) |entry| {
            for (entry.value_ptr.items) |worker| {
                total += 1;
                if (worker.is_busy) {
                    busy += 1;
                }
                if (!worker.isAlive()) {
                    dead += 1;
                }
            }
        }
        
        return .{
            .total_workers = total,
            .busy_workers = busy,
            .idle_workers = total - busy,
            .dead_workers = dead,
            .total_invocations = self.total_invocations,
            .avg_response_time_ms = 0, // TODO: Track response times
        };
    }

    /// Get or create workers list for a function
    pub fn getOrCreateWorkerList(self: *Self, function_name: []const u8) !*std.ArrayList(*Worker) {
        const result = try self.workers.getOrPut(function_name);
        if (!result.found_existing) {
            result.value_ptr.* = std.ArrayList(*Worker).init(self.allocator);
        }
        return result.value_ptr;
    }
};