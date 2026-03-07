const std = @import("std");
const upstream = @import("upstream.zig");

/// Load balancing strategy
pub const BalancingStrategy = enum {
    round_robin,
    least_connections,
    ip_hash,
    random,
};

/// Round-robin load balancer
pub const RoundRobinBalancer = struct {
    allocator: std.mem.Allocator,
    instances: std.ArrayList([]const u8),
    current_index: usize,
    mutex: std.Thread.Mutex,

    /// Initialize round-robin balancer
    pub fn init(allocator: std.mem.Allocator) RoundRobinBalancer {
        return RoundRobinBalancer{
            .allocator = allocator,
            .instances = std.ArrayList([]const u8).init(allocator),
            .current_index = 0,
            .mutex = std.Thread.Mutex{},
        };
    }

    /// Deinitialize balancer
    pub fn deinit(self: *RoundRobinBalancer) void {
        for (self.instances.items) |url| {
            self.allocator.free(url);
        }
        self.instances.deinit();
    }

    /// Add an instance to the pool
    pub fn addInstance(self: *RoundRobinBalancer, url: []const u8) !void {
        // Validate URL format
        if (url.len == 0) return error.InvalidUrl;
        
        // Check for duplicates
        for (self.instances.items) |existing| {
            if (std.mem.eql(u8, existing, url)) {
                return error.DuplicateInstance;
            }
        }
        
        const url_copy = try self.allocator.dupe(u8, url);
        errdefer self.allocator.free(url_copy);
        try self.instances.append(url_copy);
    }

    /// Remove an instance from the pool
    pub fn removeInstance(self: *RoundRobinBalancer, url: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        for (self.instances.items, 0..) |existing, idx| {
            if (std.mem.eql(u8, existing, url)) {
                self.allocator.free(existing);
                _ = self.instances.orderedRemove(idx);
                if (self.instances.items.len == 0) {
                    self.current_index = 0;
                } else if (self.current_index >= self.instances.items.len) {
                    self.current_index = 0;
                }
                break;
            }
        }
    }

    /// Get next instance using round-robin
    pub fn next(self: *RoundRobinBalancer) ?[]const u8 {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.instances.items.len == 0) {
            return null;
        }

        const idx = self.current_index;
        self.current_index = (self.current_index + 1) % self.instances.items.len;

        return self.instances.items[idx];
    }

    /// Get next healthy instance
    pub fn nextHealthy(
        self: *RoundRobinBalancer,
        health_check: fn ([]const u8) bool,
    ) ?[]const u8 {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.instances.items.len == 0) {
            return null;
        }

        const start_idx = self.current_index;
        var checked: usize = 0;
        while (checked < self.instances.items.len) : (checked += 1) {
            const idx = (start_idx + checked) % self.instances.items.len;
            const instance = self.instances.items[idx];
            if (health_check(instance)) {
                self.current_index = (idx + 1) % self.instances.items.len;
                return instance;
            }
        }
        return null;
    }

    /// Get instance count
    pub fn count(self: RoundRobinBalancer) usize {
        return self.instances.items.len;
    }
};

/// Least connections load balancer
pub const LeastConnectionsBalancer = struct {
    allocator: std.mem.Allocator,
    instances: std.ArrayList(InstanceEntry),
    mutex: std.Thread.Mutex,

    const InstanceEntry = struct {
        url: []const u8,
        active_connections: u32,
    };

    /// Initialize least connections balancer
    pub fn init(allocator: std.mem.Allocator) LeastConnectionsBalancer {
        return LeastConnectionsBalancer{
            .allocator = allocator,
            .instances = std.ArrayList(InstanceEntry).init(allocator),
            .mutex = std.Thread.Mutex{},
        };
    }

    /// Deinitialize balancer
    pub fn deinit(self: *LeastConnectionsBalancer) void {
        self.instances.deinit();
    }

    /// Add an instance
    pub fn addInstance(self: *LeastConnectionsBalancer, url: []const u8) !void {
        try self.instances.append(InstanceEntry{
            .url = url,
            .active_connections = 0,
        });
    }

    /// Get instance with least active connections
    pub fn next(self: *LeastConnectionsBalancer) ?[]const u8 {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.instances.items.len == 0) {
            return null;
        }

        var min_idx: usize = 0;
        var min_connections = self.instances.items[0].active_connections;
        for (self.instances.items[1..], 1..) |entry, idx| {
            if (entry.active_connections < min_connections) {
                min_connections = entry.active_connections;
                min_idx = idx;
            }
        }

        self.instances.items[min_idx].active_connections += 1;
        return self.instances.items[min_idx].url;
    }

    /// Release connection for an instance
    pub fn releaseConnection(self: *LeastConnectionsBalancer, url: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        for (self.instances.items) |*entry| {
            if (std.mem.eql(u8, entry.url, url)) {
                if (entry.active_connections > 0) {
                    entry.active_connections -= 1;
                }
                break;
            }
        }
    }
};

/// IP hash load balancer for session affinity
pub const IpHashBalancer = struct {
    allocator: std.mem.Allocator,
    instances: std.ArrayList([]const u8),

    /// Initialize IP hash balancer
    pub fn init(allocator: std.mem.Allocator) IpHashBalancer {
        return IpHashBalancer{
            .allocator = allocator,
            .instances = std.ArrayList([]const u8).init(allocator),
        };
    }

    /// Deinitialize balancer
    pub fn deinit(self: *IpHashBalancer) void {
        self.instances.deinit();
    }

    /// Add an instance
    pub fn addInstance(self: *IpHashBalancer, url: []const u8) !void {
        try self.instances.append(url);
    }

    /// Get instance for client IP
    pub fn getInstance(self: IpHashBalancer, client_ip: []const u8) ?[]const u8 {
        if (self.instances.items.len == 0) {
            return null;
        }

        var hasher = std.hash.Wyhash.init(0);
        hasher.update(client_ip);
        const hash = hasher.final();
        const idx = @as(usize, @intCast(hash % self.instances.items.len));
        return self.instances.items[idx];
    }
};
