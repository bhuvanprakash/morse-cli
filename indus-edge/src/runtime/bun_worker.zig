const std = @import("std");

pub const WorkerConfig = struct {
    bun_path: []const u8 = "/usr/local/bin/bun",
    timeout_ms: u32 = 5000,
    memory_limit_mb: u32 = 128,
    env_vars: []const []const u8 = &.{},
};

pub const FunctionResult = struct {
    status_code: u16,
    body: []const u8,
    headers: std.StringHashMap([]const u8),

    pub fn deinit(self: *FunctionResult, allocator: std.mem.Allocator) void {
        allocator.free(self.body);
        var it = self.headers.iterator();
        while (it.next()) |entry| {
            allocator.free(entry.key_ptr.*);
            allocator.free(entry.value_ptr.*);
        }
        self.headers.deinit();
    }
};

/// Executes a JavaScript function by spawning a Bun process.
/// The function code is written to a temp file, then run with Bun.
/// The HTTP request is passed as stdin JSON.
/// The function's response is read from stdout.
pub fn executeFunction(
    allocator: std.mem.Allocator,
    config: WorkerConfig,
    function_code: []const u8,
    request_json: []const u8,
) !FunctionResult {
    const tmp_dir = try std.fs.cwd().openDir("/tmp", .{});
    defer tmp_dir.close();

    const fn_filename = try std.fmt.allocPrint(allocator, "fn_{d}.mjs", .{std.time.milliTimestamp()});
    defer allocator.free(fn_filename);

    const wrapped = try std.fmt.allocPrint(
        allocator,
        \\const __req = JSON.parse(await Bun.stdin.text());
        \\const __secrets = __req.__secrets || {};
        \\globalThis.indusbase = globalThis.indusbase || {};
        \\globalThis.indusbase.getSecret = (name) => __secrets[name] ?? Bun.env[name] ?? process.env[name] ?? null;
        \\{s}
        \\const __result = await handler(__req);
        \\const __status = __result?.status ?? 200;
        \\let __body = '';
        \\if (typeof __result?.text === 'function') {{
        \\  __body = await __result.text();
        \\}} else if (typeof __result?.body === 'string') {{
        \\  __body = __result.body;
        \\}} else if (__result?.body != null) {{
        \\  __body = JSON.stringify(__result.body);
        \\}}
        \\const __headers = __result?.headers && typeof __result.headers.entries === 'function'
        \\  ? Object.fromEntries(__result.headers.entries())
        \\  : {};
        \\process.stdout.write(JSON.stringify({ status: __status, body: __body, headers: __headers }));
        ,
        .{function_code},
    );
    defer allocator.free(wrapped);

    try tmp_dir.writeFile(.{ .sub_path = fn_filename, .data = wrapped });
    defer tmp_dir.deleteFile(fn_filename) catch {};

    const fn_path = try std.fmt.allocPrint(allocator, "/tmp/{s}", .{fn_filename});
    defer allocator.free(fn_path);

    var child = std.process.Child.init(&.{ config.bun_path, "run", fn_path }, allocator);
    child.stdin_behavior = .Pipe;
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = .Pipe;

    var env_map = std.process.getEnvMap(allocator) catch std.process.EnvMap.init(allocator);
    defer env_map.deinit();
    for (config.env_vars) |entry| {
        if (std.mem.indexOfScalar(u8, entry, '=')) |eq_idx| {
            const key = std.mem.trim(u8, entry[0..eq_idx], " ");
            const value = std.mem.trim(u8, entry[eq_idx + 1 ..], " ");
            if (key.len > 0) {
                try env_map.put(key, value);
            }
        }
    }
    child.env_map = &env_map;

    try child.spawn();

    try child.stdin.?.writeAll(request_json);
    child.stdin.?.close();
    child.stdin = null;

    const stdout = try child.stdout.?.readToEndAlloc(allocator, 1024 * 1024);
    defer allocator.free(stdout);
    const stderr = try child.stderr.?.readToEndAlloc(allocator, 64 * 1024);
    defer allocator.free(stderr);
    _ = stderr;

    const term = try child.wait();
    _ = term;

    const parsed = try std.json.parseFromSlice(
        struct {
            status: u16 = 200,
            body: []const u8 = "",
        },
        allocator,
        stdout,
        .{ .ignore_unknown_fields = true },
    );
    defer parsed.deinit();

    return FunctionResult{
        .status_code = parsed.value.status,
        .body = try allocator.dupe(u8, parsed.value.body),
        .headers = std.StringHashMap([]const u8).init(allocator),
    };
}
