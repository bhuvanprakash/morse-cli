const std = @import("std");

// Public exports for the indus-gate library

// Config module
pub const config = @import("config/config.zig");
pub const routes = @import("config/routes.zig");

// Proxy module
pub const proxy = @import("proxy/proxy.zig");

// Middleware module
pub const auth = @import("middleware/auth.zig");
pub const ratelimit = @import("middleware/ratelimit.zig");
pub const cors = @import("middleware/cors.zig");
pub const logger = @import("middleware/logger.zig");

// Health module
pub const health = @import("health/health.zig");

// Version info
pub const version = "0.1.0";

// Re-export commonly used types
pub const Config = config.Config;
pub const RouteMatch = routes.RouteMatch;
pub const JWTClaims = auth.JWTClaims;
pub const RateLimiter = ratelimit.RateLimiter;
pub const CorsConfig = cors.CorsConfig;
pub const Proxy = proxy.Proxy;
pub const ProxyResponse = proxy.ProxyResponse;

/// Library tests
comptime {
    _ = @import("config/config.zig");
    _ = @import("config/routes.zig");
    _ = @import("middleware/auth.zig");
    _ = @import("middleware/ratelimit.zig");
    _ = @import("middleware/cors.zig");
    _ = @import("middleware/logger.zig");
    _ = @import("proxy/proxy.zig");
    _ = @import("health/health.zig");
}
