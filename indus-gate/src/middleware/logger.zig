const std = @import("std");

/// Log level
pub const LogLevel = enum {
    debug,
    info,
    warn,
    error,

    pub fn toString(self: LogLevel) []const u8 {
        return switch (self) {
            .debug => "DEBUG",
            .info => "INFO",
            .warn => "WARN",
            .error => "ERROR",
        };
    }
};

/// JSON logger for structured logging
pub const Logger = struct {
    allocator: std.mem.Allocator,
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator) Logger {
        return Logger{
            .allocator = allocator,
            .mutex = std.Thread.Mutex{},
        };
    }

    /// Log request details as JSON
    pub fn logRequest(
        self: *Logger,
        method: []const u8,
        path: []const u8,
        status: u16,
        duration_ms: u64,
        client_ip: []const u8,
    ) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const timestamp = std.time.timestamp();
        const stdout = std.io.getStdOut().writer();

        stdout.print(
            "{{\"timestamp\":{d},\"level\":\"INFO\",\"method\":\"{s}\",\"path\":\"{s}\",\"status\":{d},\"duration_ms\":{d},\"client_ip\":\"{s}\"}}\n",
            .{ timestamp, method, path, status, duration_ms, client_ip },
        ) catch {};
    }

    /// Log error as JSON
    pub fn logError(
        self: *Logger,
        message: []const u8,
        err: anyerror,
    ) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const timestamp = std.time.timestamp();
        const stdout = std.io.getStdOut().writer();

        stdout.print(
            "{{\"timestamp\":{d},\"level\":\"ERROR\",\"message\":\"{s}\",\"error\":\"{s}\"}}\n",
            .{ timestamp, message, @errorName(err) },
        ) catch {};
    }

    /// Log info message as JSON
    pub fn logInfo(
        self: *Logger,
        message: []const u8,
    ) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const timestamp = std.time.timestamp();
        const stdout = std.io.getStdOut().writer();

        stdout.print(
            "{{\"timestamp\":{d},\"level\":\"INFO\",\"message\":\"{s}\"}}\n",
            .{ timestamp, message },
        ) catch {};
    }

    /// Log structured event
    pub fn logEvent(
        self: *Logger,
        level: LogLevel,
        event: []const u8,
        fields: []const struct { []const u8, []const u8 },
    ) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const timestamp = std.time.timestamp();
        const stdout = std.io.getStdOut().writer();

        stdout.print(
            "{{\"timestamp\":{d},\"level\":\"{s}\",\"event\":\"{s}"",
            .{ timestamp, level.toString(), event },
        ) catch {};

        for (fields) |field| {
            stdout.print(",\"{s}\":\"{s}"", .{ field[0], field[1] }) catch {};
        }

        stdout.writeAll("}}\n") catch {};
    }
};

// Global logger instance
var global_logger: ?Logger = null;

/// Initialize global logger
pub fn init(allocator: std.mem.Allocator) void {
    global_logger = Logger.init(allocator);
}

/// Deinitialize global logger
pub fn deinit() void {
    global_logger = null;
}

/// Get global logger instance
pub fn get() ?*Logger {
    if (global_logger) |*logger| {
        return logger;
    }
    return null;
}

/// Log request helper
pub fn logRequest(
    method: []const u8,
    path: []const u8,
    status: u16,
    duration_ms: u64,
    client_ip: []const u8,
) void {
    if (get()) |logger| {
        logger.logRequest(method, path, status, duration_ms, client_ip);
    }
}

/// Log error helper
pub fn logError(message: []const u8, err: anyerror) void {
    if (get()) |logger| {
        logger.logError(message, err);
    }
}

/// Log info helper
pub fn info(message: []const u8) void {
    if (get()) |logger| {
        logger.logInfo(message);
    }
}

/// Generate unique request ID
pub fn generateRequestId() u64 {
    return @intCast(std.time.milliTimestamp());
}
