const std = @import("std");

/// Log level enumeration
pub const LogLevel = enum {
    debug,
    info,
    warn,
    error,

    pub fn asString(self: LogLevel) []const u8 {
        return switch (self) {
            .debug => "DEBUG",
            .info => "INFO",
            .warn => "WARN",
            .error => "ERROR",
        };
    }
};

/// Structured log entry
pub const LogEntry = struct {
    /// Timestamp
    timestamp: i64,
    
    /// Log level
    level: LogLevel,
    
    /// Message
    message: []const u8,
    
    /// Additional fields
    fields: std.StringHashMap([]const u8),

    pub fn init(allocator: std.mem.Allocator, level: LogLevel, message: []const u8) LogEntry {
        return .{
            .timestamp = std.time.milliTimestamp(),
            .level = level,
            .message = message,
            .fields = std.StringHashMap([]const u8).init(allocator),
        };
    }

    pub fn deinit(self: *LogEntry) void {
        var it = self.fields.iterator();
        while (it.next()) |entry| {
            self.fields.allocator.free(entry.key_ptr.*);
            self.fields.allocator.free(entry.value_ptr.*);
        }
        self.fields.deinit();
    }

    pub fn addField(self: *LogEntry, key: []const u8, value: []const u8) !void {
        const key_copy = try self.fields.allocator.dupe(u8, key);
        errdefer self.fields.allocator.free(key_copy);
        const value_copy = try self.fields.allocator.dupe(u8, value);
        errdefer self.fields.allocator.free(value_copy);
        try self.fields.put(key_copy, value_copy);
    }
};

/// Logger for structured logging
pub const Logger = struct {
    /// Output file (default: stderr)
    output: std.fs.File,
    
    /// Minimum log level
    min_level: LogLevel,
    
    /// Allocator for temporary allocations
    allocator: std.mem.Allocator,

    const Self = @This();

    pub fn init(allocator: std.mem.Allocator, min_level: LogLevel) Logger {
        return .{
            .output = std.io.getStdErr(),
            .min_level = min_level,
            .allocator = allocator,
        };
    }

    pub fn log(self: *Self, level: LogLevel, message: []const u8) void {
        if (@intFromEnum(level) < @intFromEnum(self.min_level)) return;

        const timestamp = std.time.milliTimestamp();
        const writer = self.output.writer();

        // JSON formatted log entry
        writer.print("{{\"timestamp\":{d},\"level\":\"{s}\",\"message\":\"{s}\"}}\n", .{
            timestamp,
            level.asString(),
            message,
        }) catch {};
    }

    pub fn logWithFields(self: *Self, level: LogLevel, message: []const u8, fields: anytype) void {
        if (@intFromEnum(level) < @intFromEnum(self.min_level)) return;

        const timestamp = std.time.milliTimestamp();
        const writer = self.output.writer();

        // Start JSON
        writer.print("{{\"timestamp\":{d},\"level\":\"{s}\",\"message\":\"{s}\"", .{
            timestamp,
            level.asString(),
            message,
        }) catch {};

        // Add fields
        inline for (@typeInfo(@TypeOf(fields)).Struct.fields) |field| {
            const value = @field(fields, field.name);
            writer.print(",\"{s}\":\"{s}\"", .{ field.name, value }) catch {};
        }

        // Close JSON
        writer.writeAll("}\n") catch {};
    }

    pub fn debug(self: *Self, message: []const u8) void {
        self.log(.debug, message);
    }

    pub fn info(self: *Self, message: []const u8) void {
        self.log(.info, message);
    }

    pub fn warn(self: *Self, message: []const u8) void {
        self.log(.warn, message);
    }

    pub fn err(self: *Self, message: []const u8) void {
        self.log(.error, message);
    }
};

/// HTTP request logging middleware
pub fn logRequest(
    allocator: std.mem.Allocator,
    method: []const u8,
    path: []const u8,
    status: u16,
    duration_ms: u64,
) void {
    const entry = LogEntry.init(allocator, .info, "HTTP request");
    defer entry.deinit();

    entry.addField("method", method) catch {};
    entry.addField("path", path) catch {};
    entry.addField("status", std.fmt.allocPrint(allocator, "{d}", .{status}) catch "unknown") catch {};
    entry.addField("duration_ms", std.fmt.allocPrint(allocator, "{d}", .{duration_ms}) catch "unknown") catch {};

    // Output structured log
    const writer = std.io.getStdErr().writer();
    writer.print("{{\"timestamp\":{d},\"level\":\"INFO\",\"message\":\"HTTP request\",", .{entry.timestamp}) catch {};
    writer.print("\"method\":\"{s}\",\"path\":\"{s}\",\"status\":{d},\"duration_ms\":{d}}}\n", .{
        method,
        path,
        status,
        duration_ms,
    }) catch {};
}

/// Create request context for tracking
pub const RequestContext = struct {
    /// Request ID
    request_id: []const u8,
    
    /// Start time
    start_time: i64,
    
    /// Method
    method: []const u8,
    
    /// Path
    path: []const u8,

    pub fn init(allocator: std.mem.Allocator, method: []const u8, path: []const u8) !RequestContext {
        const random = std.crypto.random.int(u64);
        const request_id = try std.fmt.allocPrint(allocator, "{x}", .{random});
        
        return .{
            .request_id = request_id,
            .start_time = std.time.milliTimestamp(),
            .method = method,
            .path = path,
        };
    }

    pub fn deinit(self: *RequestContext, allocator: std.mem.Allocator) void {
        allocator.free(self.request_id);
    }

    pub fn durationMs(self: *const RequestContext) u64 {
        return @intCast(std.time.milliTimestamp() - self.start_time);
    }
};