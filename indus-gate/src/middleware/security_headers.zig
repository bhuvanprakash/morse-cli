const std = @import("std");

pub fn addSecurityHeaders(headers: *std.http.Headers) !void {
    try headers.append("X-Content-Type-Options", "nosniff");
    try headers.append("X-Frame-Options", "DENY");
    try headers.append("X-XSS-Protection", "1; mode=block");
    try headers.append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    try headers.append("Referrer-Policy", "strict-origin-when-cross-origin");
    try headers.append("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    try headers.append(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'none'; object-src 'none'",
    );
}
