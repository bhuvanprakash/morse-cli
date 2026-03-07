const std = @import("std");
const posix = std.posix;

/// Resource limits for worker processes
pub const ResourceLimits = struct {
    /// Memory limit in bytes
    memory_limit_bytes: usize,
    
    /// CPU time limit in seconds
    cpu_time_limit_sec: u64,
    
    /// Maximum number of open files
    max_open_files: u32,
    
    /// Maximum number of processes
    max_processes: u32,

    pub fn init(memory_limit_mb: u32, cpu_time_sec: u64, max_files: u32, max_procs: u32) ResourceLimits {
        return .{
            .memory_limit_bytes = @as(usize, memory_limit_mb) * 1024 * 1024,
            .cpu_time_limit_sec = cpu_time_sec,
            .max_open_files = max_files,
            .max_processes = max_procs,
        };
    }

    /// Apply resource limits to current process
    /// Should be called after fork() but before exec()
    pub fn apply(self: *const ResourceLimits) !void {
        // Set memory limit (RLIMIT_AS)
        const mem_limit = posix.rlimit{
            .cur = self.memory_limit_bytes,
            .max = self.memory_limit_bytes,
        };
        posix.setrlimit(.AS, mem_limit) catch |err| {
            std.log.warn("Failed to set memory limit: {s}", .{@errorName(err)});
        };

        // Set CPU time limit (RLIMIT_CPU)
        const cpu_limit = posix.rlimit{
            .cur = self.cpu_time_limit_sec,
            .max = self.cpu_time_limit_sec,
        };
        posix.setrlimit(.CPU, cpu_limit) catch |err| {
            std.log.warn("Failed to set CPU limit: {s}", .{@errorName(err)});
        };

        // Set open files limit (RLIMIT_NOFILE)
        const file_limit = posix.rlimit{
            .cur = self.max_open_files,
            .max = self.max_open_files,
        };
        posix.setrlimit(.NOFILE, file_limit) catch |err| {
            std.log.warn("Failed to set file limit: {s}", .{@errorName(err)});
        };

        // Set process limit (RLIMIT_NPROC)
        const proc_limit = posix.rlimit{
            .cur = self.max_processes,
            .max = self.max_processes,
        };
        posix.setrlimit(.NPROC, proc_limit) catch |err| {
            std.log.warn("Failed to set process limit: {s}", .{@errorName(err)});
        };

        // Set stack size limit to prevent stack overflow
        const stack_limit = posix.rlimit{
            .cur = 8 * 1024 * 1024, // 8MB stack
            .max = 8 * 1024 * 1024,
        };
        posix.setrlimit(.STACK, stack_limit) catch |err| {
            std.log.warn("Failed to set stack limit: {s}", .{@errorName(err)});
        };
    }

    /// Get current resource usage
    pub fn getCurrentUsage() ResourceUsage {
        var usage: posix.rusage = undefined;
        
        // This is a placeholder - actual implementation would use getrusage
        return .{
            .memory_bytes = 0,
            .cpu_time_sec = 0,
            .cpu_time_usec = 0,
        };
    }
};

/// Resource usage statistics
pub const ResourceUsage = struct {
    /// Memory usage in bytes
    memory_bytes: usize,
    
    /// CPU time in seconds
    cpu_time_sec: u64,
    
    /// CPU time microseconds
    cpu_time_usec: u64,
};