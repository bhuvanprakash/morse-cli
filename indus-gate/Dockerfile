# Stage 1: Builder
FROM ziglang/zig:0.14 AS builder

WORKDIR /app

# Copy build files first for better layer caching
COPY build.zig build.zig.zon ./
COPY src ./src
COPY config ./config

# Build the executable with optimizations
RUN zig build -Doptimize=ReleaseFast

# Stage 2: Runtime
FROM debian:bookworm-slim

# Install ca-certificates for TLS connections to upstreams
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/false indusgate

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/zig-out/bin/indus-gate ./

# Copy config
COPY --from=builder /app/config ./config

# Change ownership
RUN chown -R indusgate:indusgate /app

# Switch to non-root user
USER indusgate

# Expose gateway port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ./indus-gate --health-check || exit 1

# Run the gateway
ENTRYPOINT ["./indus-gate"]
