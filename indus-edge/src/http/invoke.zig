const std = @import("std");

/// Request structure for function invocation
pub const InvokeRequest = struct {
    /// Unique request ID
    id: []const u8,
    
    /// Function name to invoke
    function_name: []const u8,
    
    /// HTTP method
    method: []const u8,
    
    /// Request path
    path: []const u8,
    
    /// HTTP headers
    headers: std.StringHashMap([]const u8),
    
    /// Request body
    body: []const u8,
    
    /// Query parameters
    query_params: std.StringHashMap([]const u8),

    pub fn init(allocator: std.mem.Allocator, id: []const u8, function_name: []const u8) InvokeRequest {
        return .{
            .id = id,
            .function_name = function_name,
            .method = "GET",
            .path = "/",
            .headers = std.StringHashMap([]const u8).init(allocator),
            .body = "",
            .query_params = std.StringHashMap([]const u8).init(allocator),
        };
    }

    pub fn deinit(self: *InvokeRequest, allocator: std.mem.Allocator) void {
        var header_it = self.headers.iterator();
        while (header_it.next()) |entry| {
            allocator.free(entry.key_ptr.*);
            allocator.free(entry.value_ptr.*);
        }
        self.headers.deinit();
        
        var query_it = self.query_params.iterator();
        while (query_it.next()) |entry| {
            allocator.free(entry.key_ptr.*);
            allocator.free(entry.value_ptr.*);
        }
        self.query_params.deinit();
    }

    pub fn setMethod(self: *InvokeRequest, method: []const u8) void {
        self.method = method;
    }

    pub fn setPath(self: *InvokeRequest, path: []const u8) void {
        self.path = path;
    }

    pub fn setBody(self: *InvokeRequest, body: []const u8) void {
        self.body = body;
    }

    pub fn addHeader(self: *InvokeRequest, allocator: std.mem.Allocator, key: []const u8, value: []const u8) !void {
        const key_copy = try allocator.dupe(u8, key);
        errdefer allocator.free(key_copy);
        const value_copy = try allocator.dupe(u8, value);
        errdefer allocator.free(value_copy);
        try self.headers.put(key_copy, value_copy);
    }

    pub fn addQueryParam(self: *InvokeRequest, allocator: std.mem.Allocator, key: []const u8, value: []const u8) !void {
        const key_copy = try allocator.dupe(u8, key);
        errdefer allocator.free(key_copy);
        const value_copy = try allocator.dupe(u8, value);
        errdefer allocator.free(value_copy);
        try self.query_params.put(key_copy, value_copy);
    }
};

/// Response structure from function invocation
pub const InvokeResponse = struct {
    /// Request ID (echoed back)
    id: []const u8,
    
    /// HTTP status code
    status: u16,
    
    /// HTTP headers
    headers: std.StringHashMap([]const u8),
    
    /// Response body
    body: []const u8,
    
    /// Error message (if any)
    error_msg: ?[]const u8,

    pub fn init(allocator: std.mem.Allocator, id: []const u8, status: u16) InvokeResponse {
        return .{
            .id = id,
            .status = status,
            .headers = std.StringHashMap([]const u8).init(allocator),
            .body = "",
            .error_msg = null,
        };
    }

    pub fn deinit(self: *InvokeResponse, allocator: std.mem.Allocator) void {
        var header_it = self.headers.iterator();
        while (header_it.next()) |entry| {
            allocator.free(entry.key_ptr.*);
            allocator.free(entry.value_ptr.*);
        }
        self.headers.deinit();
        
        if (self.error_msg) |err| {
            allocator.free(err);
        }
    }
};

/// Serialize an InvokeRequest to JSON string
pub fn serializeRequest(allocator: std.mem.Allocator, req: *const InvokeRequest) ![]const u8 {
    var buf = std.ArrayList(u8).init(allocator);
    defer buf.deinit();
    
    const writer = buf.writer();
    
    // Write JSON
    try writer.writeAll("{");
    
    // ID
    try writer.print("\"id\":\"{s}\",", .{escapeJsonString(allocator, req.id)});
    
    // Function name
    try writer.print("\"function_name\":\"{s}\",", .{escapeJsonString(allocator, req.function_name)});
    
    // Method
    try writer.print("\"method\":\"{s}\",", .{escapeJsonString(allocator, req.method)});
    
    // Path
    try writer.print("\"path\":\"{s}\",", .{escapeJsonString(allocator, req.path)});
    
    // Headers
    try writer.writeAll("\"headers\":{");
    var first = true;
    var header_it = req.headers.iterator();
    while (header_it.next()) |entry| {
        if (!first) try writer.writeAll(",");
        try writer.print("\"{s}\":\"{s}\"", .{
            escapeJsonString(allocator, entry.key_ptr.*),
            escapeJsonString(allocator, entry.value_ptr.*),
        });
        first = false;
    }
    try writer.writeAll("},");
    
    // Body (base64 encoded for binary safety)
    try writer.writeAll("\"body\":");
    if (req.body.len > 0) {
        try writer.print("\"{s}\"", .{std.base64.standard.Encoder.encode(allocator, req.body)});
    } else {
        try writer.writeAll("\"\"");
    }
    try writer.writeAll(",");
    
    // Query params
    try writer.writeAll("\"query_params\":{");
    first = true;
    var query_it = req.query_params.iterator();
    while (query_it.next()) |entry| {
        if (!first) try writer.writeAll(",");
        try writer.print("\"{s}\":\"{s}\"", .{
            escapeJsonString(allocator, entry.key_ptr.*),
            escapeJsonString(allocator, entry.value_ptr.*),
        });
        first = false;
    }
    try writer.writeAll("}");
    
    try writer.writeAll("}");
    
    return buf.toOwnedSlice();
}

/// Parse an InvokeResponse from JSON string
pub fn parseResponse(allocator: std.mem.Allocator, json_str: []const u8) !InvokeResponse {
    // Simple JSON parsing - in production, use a proper JSON library
    // This is a placeholder implementation
    var response = InvokeResponse.init(allocator, "", 500);
    
    // Parse status
    if (std.mem.indexOf(u8, json_str, "\"status\":")) |idx| {
        const start = idx + 9;
        var end = start;
        while (end < json_str.len and std.ascii.isDigit(json_str[end])) : (end += 1) {}
        response.status = try std.fmt.parseInt(u16, json_str[start..end], 10);
    }
    
    // Parse body
    if (std.mem.indexOf(u8, json_str, "\"body\":\"")) |idx| {
        const start = idx + 8;
        if (std.mem.indexOfPos(u8, json_str, start, "\"")) |end| {
            const encoded = json_str[start..end];
            // Base64 decode
            const decoded_len = try std.base64.standard.Decoder.calcSizeForSlice(encoded);
            response.body = try allocator.alloc(u8, decoded_len);
            try std.base64.standard.Decoder.decode(response.body, encoded);
        }
    }
    
    return response;
}

/// Escape a string for JSON
fn escapeJsonString(allocator: std.mem.Allocator, str: []const u8) []const u8 {
    // Simple escape - in production, handle all escape sequences
    _ = allocator;
    return str;
}

/// Generate a unique request ID
pub fn generateRequestId(allocator: std.mem.Allocator) ![]const u8 {
    const timestamp = std.time.milliTimestamp();
    const random = std.crypto.random.int(u64);
    return std.fmt.allocPrint(allocator, "{d}-{x}", .{ timestamp, random });
}