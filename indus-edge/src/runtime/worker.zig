const std = @import("std");
const posix = std.posix;
const FunctionDef = @import("function.zig").FunctionDef;
const ResourceLimits = @import("limits.zig").ResourceLimits;

/// Worker represents a Bun child process that can invoke a function
pub const Worker = struct {
    /// Unique worker ID
    id: u64,
    
    /// Function this worker is assigned to
    function_name: []const u8,
    
    /// Child process ID
    pid: posix.pid_t,
    
    /// stdin pipe (for sending requests)
    stdin: std.fs.File,
    
    /// stdout pipe (for receiving responses)
    stdout: std.fs.File,
    
    /// Resource limits applied to this worker
    limits: ResourceLimits,
    
    /// Whether the worker is currently busy
    is_busy: bool,
    
    /// Last used timestamp (for idle timeout)
    last_used_at: i64,
    
    /// Creation timestamp
    created_at: i64,
    
    /// Number of invocations processed
    invocations: u64,
    
    /// Allocator for this worker
    allocator: std.mem.Allocator,

    /// Response buffer
    response_buffer: std.ArrayList(u8),

    const Self = @This();

    /// Spawn a new Bun worker process
    pub fn spawn(
        allocator: std.mem.Allocator,
        id: u64,
        function_def: *const FunctionDef,
        bun_path: []const u8,
        handler_path: []const u8,
        memory_limit_mb: u32,
    ) !*Worker {
        const worker = try allocator.create(Worker);
        errdefer allocator.destroy(worker);

        // Create pipes for stdin and stdout
        var stdin_pipe: [2]posix.fd_t = undefined;
        var stdout_pipe: [2]posix.fd_t = undefined;
        
        try posix.pipe(&stdin_pipe);
        errdefer {
            posix.close(stdin_pipe[0]);
            posix.close(stdin_pipe[1]);
        }
        
        try posix.pipe(&stdout_pipe);
        errdefer {
            posix.close(stdout_pipe[0]);
            posix.close(stdout_pipe[1]);
        }

        // Fork child process
        const pid = try posix.fork();
        
        if (pid == 0) {
            // Child process
            
            // Close unused pipe ends
            posix.close(stdin_pipe[1]);
            posix.close(stdout_pipe[0]);
            
            // Redirect stdin and stdout
            try posix.dup2(stdin_pipe[0], posix.STDIN_FILENO);
            try posix.dup2(stdout_pipe[1], posix.STDOUT_FILENO);
            
            // Close original pipe ends after dup2
            posix.close(stdin_pipe[0]);
            posix.close(stdout_pipe[1]);
            
            // Apply resource limits
            const limits = ResourceLimits.init(memory_limit_mb, 30, 64, 10);
            limits.apply() catch {};
            
            // Set up environment variables
            var env_map = std.process.EnvMap.init(allocator);
            defer env_map.deinit();
            
            // Copy parent environment
            var parent_env = std.process.getEnvMap(allocator) catch null;
            if (parent_env) |*pe| {
                defer pe.deinit();
                var it = pe.iterator();
                while (it.next()) |entry| {
                    try env_map.put(entry.key_ptr.*, entry.value_ptr.*);
                }
            }
            
            // Set function-specific environment
            try env_map.put("INDUS_FUNCTION_PATH", function_def.path);
            try env_map.put("INDUS_FUNCTION_NAME", function_def.name);
            
            // Copy function env vars
            var func_env_it = function_def.env_vars.iterator();
            while (func_env_it.next()) |entry| {
                try env_map.put(entry.key_ptr.*, entry.value_ptr.*);
            }
            
            // Build argv
            const argv = &[_:null]?[*:0]const u8{
                bun_path.ptr,
                "run",
                handler_path.ptr,
                null,
            };
            
            // Convert env_map to envp
            var env_list = std.ArrayList([*:0]const u8).init(allocator);
            defer env_list.deinit();
            
            var env_it = env_map.iterator();
            while (env_it.next()) |entry| {
                const env_str = try std.fmt.allocPrintZ(allocator, "{s}={s}", .{ entry.key_ptr.*, entry.value_ptr.* });
                try env_list.append(env_str.ptr);
            }
            try env_list.append(null);
            
            // Execute Bun
            const err = posix.execvpeZ(bun_path.ptr, argv, env_list.items.ptr);
            std.log.err("Failed to exec Bun: {s}", .{@errorName(err)});
            posix.exit(1);
        }

        // Parent process
        posix.close(stdin_pipe[0]);
        posix.close(stdout_pipe[1]);

        worker.* = .{
            .id = id,
            .function_name = try allocator.dupe(u8, function_def.name),
            .pid = pid,
            .stdin = std.fs.File{ .handle = stdin_pipe[1] },
            .stdout = std.fs.File{ .handle = stdout_pipe[0] },
            .limits = ResourceLimits.init(memory_limit_mb, 30, 64, 10),
            .is_busy = false,
            .last_used_at = std.time.milliTimestamp(),
            .created_at = std.time.milliTimestamp(),
            .invocations = 0,
            .allocator = allocator,
            .response_buffer = std.ArrayList(u8).init(allocator),
        };

        return worker;
    }

    /// Invoke the function with the given request
    pub fn invoke(self: *Self, request_json: []const u8, timeout_ms: u64) ![]const u8 {
        if (self.is_busy) {
            return error.WorkerBusy;
        }

        self.is_busy = true;
        defer self.is_busy = false;
        
        self.response_buffer.clearRetainingCapacity();

        // Write request to stdin
        try self.stdin.writeAll(request_json);
        try self.stdin.writeAll("\n");
        try self.stdin.sync();

        // Read response with timeout
        const start_time = std.time.milliTimestamp();
        
        var buf: [4096]u8 = undefined;
        while (true) {
            const elapsed = @as(u64, @intCast(std.time.milliTimestamp() - start_time));
            if (elapsed > timeout_ms) {
                return error.Timeout;
            }

            // Check if data is available
            var pollfd = posix.pollfd{
                .fd = self.stdout.handle,
                .events = posix.POLL.IN,
                .revents = 0,
            };
            
            const poll_timeout = @min(timeout_ms - elapsed, 100);
            const ready = posix.poll(&[_]posix.pollfd{pollfd}, @intCast(poll_timeout)) catch |err| {
                if (err == error.EINTR) continue;
                return err;
            };

            if (ready == 0) continue;

            const bytes_read = self.stdout.read(&buf) catch |err| {
                if (err == error.WouldBlock) continue;
                return err;
            };

            if (bytes_read == 0) {
                return error.ProcessClosed;
            }

            // Append to buffer
            try self.response_buffer.appendSlice(buf[0..bytes_read]);

            // Check for complete JSON response (newline terminated)
            if (std.mem.indexOfScalar(u8, self.response_buffer.items, '\n')) |newline_pos| {
                const response = self.response_buffer.items[0..newline_pos];
                return self.allocator.dupe(u8, response);
            }
        }
    }

    /// Check if the process is still alive
    pub fn isAlive(self: *Self) bool {
        const result = posix.waitpid(self.pid, posix.W.NOHANG);
        return result.pid == 0; // 0 means still running
    }

    /// Terminate the worker process
    pub fn kill(self: *Self) void {
        // Try graceful shutdown first
        _ = posix.kill(self.pid, posix.SIG.TERM) catch {};
        
        // Give it 1 second to terminate
        std.time.sleep(1 * std.time.ns_per_s);
        
        // Force kill if still alive
        if (self.isAlive()) {
            _ = posix.kill(self.pid, posix.SIG.KILL) catch {};
        }

        self.stdin.close();
        self.stdout.close();
    }

    /// Release resources
    pub fn deinit(self: *Self) void {
        self.allocator.free(self.function_name);
        self.response_buffer.deinit();
        self.allocator.destroy(self);
    }
};