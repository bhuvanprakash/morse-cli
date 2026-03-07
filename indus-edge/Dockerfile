# Build stage
FROM ziglang/zig:0.14.0 AS builder

WORKDIR /build

# Copy build files
COPY build.zig build.zig.zon ./
COPY src ./src

# Build the application
RUN zig build -Doptimize=ReleaseFast

# Runtime stage
FROM oven/bun:1.2-slim

WORKDIR /opt/indus-edge

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy built binary
COPY --from=builder /build/zig-out/bin/indus-edge /usr/local/bin/indus-edge

# Copy runtime files
COPY runtime ./runtime

# Create functions directory
RUN mkdir -p /var/indusbase/functions

# Set environment variables
ENV INDUS_EDGE_PORT=8006
ENV INDUS_FUNCTIONS_DIR=/var/indusbase/functions
ENV INDUS_BUN_PATH=/usr/local/bin/bun
ENV INDUS_HANDLER_PATH=/opt/indus-edge/runtime/handler.ts
ENV INDUS_WARMPOOL_SIZE=3
ENV INDUS_WORKER_MEMORY_MB=128
ENV INDUS_WORKER_TIMEOUT_MS=30000

# Expose port
EXPOSE 8006

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8006/health || exit 1

# Run the server
CMD ["/usr/local/bin/indus-edge"]