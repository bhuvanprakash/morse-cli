const std = @import("std");

pub const ProjectContext = struct {
    project_id: []const u8,
    db_schema: []const u8,
    jwt_secret: []const u8,
    plan: []const u8,
    is_service_role: bool,

    pub fn deinit(self: *ProjectContext, allocator: std.mem.Allocator) void {
        allocator.free(self.project_id);
        allocator.free(self.db_schema);
        allocator.free(self.jwt_secret);
        allocator.free(self.plan);
    }
};

pub const ExtractedApiKey = struct {
    key: []const u8,
    from_authorization: bool,
};

pub const ProjectCache = struct {
    entries: std.StringHashMap(CacheEntry),
    mutex: std.Thread.Mutex = .{},
    allocator: std.mem.Allocator,
    max_entries: usize = 1000,
    ttl_seconds: i64 = 60,

    const CacheEntry = struct {
        ctx: ProjectContext,
        expires_at: i64,
    };

    pub fn init(allocator: std.mem.Allocator) ProjectCache {
        return .{
            .entries = std.StringHashMap(CacheEntry).init(allocator),
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *ProjectCache) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        var it = self.entries.iterator();
        while (it.next()) |entry| {
            self.allocator.free(entry.key_ptr.*);
            var ctx = entry.value_ptr.ctx;
            ctx.deinit(self.allocator);
        }
        self.entries.deinit();
    }

    pub fn get(self: *ProjectCache, key: []const u8) ?ProjectContext {
        self.mutex.lock();
        defer self.mutex.unlock();

        const now = std.time.timestamp();
        const entry = self.entries.get(key) orelse return null;
        if (now > entry.expires_at) {
            self.removeInternal(key);
            return null;
        }
        return cloneContext(self.allocator, entry.ctx) catch null;
    }

    pub fn put(self: *ProjectCache, key: []const u8, ctx: ProjectContext) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.entries.count() >= self.max_entries) {
            // Best-effort eviction to keep memory bounded.
            if (self.entries.iterator().next()) |entry| {
                self.removeInternal(entry.key_ptr.*);
            }
        }

        const key_copy = self.allocator.dupe(u8, key) catch return;
        const ctx_copy = cloneContext(self.allocator, ctx) catch {
            self.allocator.free(key_copy);
            return;
        };
        self.entries.put(key_copy, .{
            .ctx = ctx_copy,
            .expires_at = std.time.timestamp() + self.ttl_seconds,
        }) catch {
            self.allocator.free(key_copy);
            var copy_to_free = ctx_copy;
            copy_to_free.deinit(self.allocator);
        };
    }

    fn removeInternal(self: *ProjectCache, key: []const u8) void {
        if (self.entries.fetchRemove(key)) |removed| {
            self.allocator.free(removed.key);
            var ctx = removed.value.ctx;
            ctx.deinit(self.allocator);
        }
    }
};

pub const ResolveError = error{
    ProjectPaused,
    UpstreamError,
    InvalidResponse,
};

pub fn extractApiKey(headers: std.http.Headers) ?ExtractedApiKey {
    if (headers.get("apikey")) |key| {
        const trimmed = std.mem.trim(u8, key, " ");
        if (trimmed.len > 0) {
            return .{ .key = trimmed, .from_authorization = false };
        }
    }
    if (headers.get("Authorization")) |authorization| {
        if (authorization.len > 7 and std.mem.startsWith(u8, authorization, "Bearer ")) {
            const token = std.mem.trim(u8, authorization[7..], " ");
            if (token.len > 0) {
                return .{ .key = token, .from_authorization = true };
            }
        }
    }
    return null;
}

pub fn resolveProject(
    allocator: std.mem.Allocator,
    meta_upstream: []const u8,
    cache: *ProjectCache,
    apikey: []const u8,
) ResolveError!?ProjectContext {
    if (cache.get(apikey)) |project| {
        return project;
    }

    const escaped_key = escapeSqlLiteral(allocator, apikey) catch return ResolveError.UpstreamError;
    defer allocator.free(escaped_key);

    const query = std.fmt.allocPrint(
        allocator,
        "SELECT p.id::text, p.db_schema, p.jwt_secret, COALESCE(o.plan, 'free') AS plan, p.status, (p.service_role_key = '{s}') AS is_service_role FROM indusbase_platform.projects p JOIN indusbase_platform.organizations o ON o.id = p.org_id WHERE p.anon_key = '{s}' OR p.service_role_key = '{s}' LIMIT 1",
        .{ escaped_key, escaped_key, escaped_key },
    ) catch return ResolveError.UpstreamError;
    defer allocator.free(query);

    const payload = std.json.stringifyAlloc(allocator, .{ .query = query }, .{}) catch return ResolveError.UpstreamError;
    defer allocator.free(payload);

    const url = std.fmt.allocPrint(allocator, "{s}/meta/query", .{meta_upstream}) catch return ResolveError.UpstreamError;
    defer allocator.free(url);
    var uri = std.Uri.parse(url) catch return ResolveError.UpstreamError;

    var client = std.http.Client{ .allocator = allocator };
    defer client.deinit();

    var headers = std.http.Headers{ .allocator = allocator };
    defer headers.deinit();
    headers.append("Content-Type", "application/json") catch return ResolveError.UpstreamError;

    var server_header_buffer: [8192]u8 = undefined;
    const resp = client.fetch(.{
        .location = .{ .uri = uri },
        .method = .POST,
        .headers = headers,
        .payload = payload,
        .server_header_buffer = &server_header_buffer,
    }) catch return ResolveError.UpstreamError;

    if (resp.status != .ok) {
        return null;
    }

    const body = resp.body orelse return ResolveError.InvalidResponse;
    var parsed = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return ResolveError.InvalidResponse;
    defer parsed.deinit();

    const root = parsed.value.object;
    const success = root.get("success") orelse return ResolveError.InvalidResponse;
    if (success != .bool or !success.bool) return null;

    const result = root.get("result") orelse return ResolveError.InvalidResponse;
    if (result != .object) return ResolveError.InvalidResponse;
    const rows = result.object.get("rows") orelse return ResolveError.InvalidResponse;
    if (rows != .array or rows.array.items.len == 0) return null;
    const row = rows.array.items[0];
    if (row != .array or row.array.items.len < 6) return ResolveError.InvalidResponse;

    const project_id = jsonString(row.array.items[0]) orelse return ResolveError.InvalidResponse;
    const db_schema = jsonString(row.array.items[1]) orelse return ResolveError.InvalidResponse;
    const jwt_secret = jsonString(row.array.items[2]) orelse return ResolveError.InvalidResponse;
    const plan = jsonString(row.array.items[3]) orelse "free";
    const status = jsonString(row.array.items[4]) orelse "active";
    const is_service_role = switch (row.array.items[5]) {
        .bool => |b| b,
        .string => |s| std.mem.eql(u8, s, "true"),
        else => false,
    };

    if (std.mem.eql(u8, status, "paused")) {
        return ResolveError.ProjectPaused;
    }
    if (std.mem.eql(u8, status, "deleted")) {
        return null;
    }

    const ctx = ProjectContext{
        .project_id = allocator.dupe(u8, project_id) catch return ResolveError.UpstreamError,
        .db_schema = allocator.dupe(u8, db_schema) catch return ResolveError.UpstreamError,
        .jwt_secret = allocator.dupe(u8, jwt_secret) catch return ResolveError.UpstreamError,
        .plan = allocator.dupe(u8, plan) catch return ResolveError.UpstreamError,
        .is_service_role = is_service_role,
    };
    cache.put(apikey, ctx);
    return ctx;
}

fn cloneContext(allocator: std.mem.Allocator, ctx: ProjectContext) !ProjectContext {
    return .{
        .project_id = try allocator.dupe(u8, ctx.project_id),
        .db_schema = try allocator.dupe(u8, ctx.db_schema),
        .jwt_secret = try allocator.dupe(u8, ctx.jwt_secret),
        .plan = try allocator.dupe(u8, ctx.plan),
        .is_service_role = ctx.is_service_role,
    };
}

fn escapeSqlLiteral(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    var out = std.ArrayList(u8).init(allocator);
    errdefer out.deinit();
    for (value) |ch| {
        if (ch == '\'') {
            try out.append('\'');
            try out.append('\'');
        } else {
            try out.append(ch);
        }
    }
    return out.toOwnedSlice();
}

fn jsonString(value: std.json.Value) ?[]const u8 {
    return switch (value) {
        .string => |s| s,
        else => null,
    };
}
