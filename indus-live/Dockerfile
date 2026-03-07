# Build stage
FROM ghcr.io/gleam-lang/gleam:v1.6.0-erlang-alpine AS builder

WORKDIR /build

# Copy project files
COPY gleam.toml .
COPY src ./src

# Build the project
RUN gleam deps download
RUN gleam build --target erlang

# Release stage
FROM erlang:27-alpine

WORKDIR /app

# Copy built application from builder
COPY --from=builder /build/build ./build
COPY --from=builder /build/gleam.toml .

# Create non-root user
RUN adduser -D -u 1000 appuser
USER appuser

# Expose port (default 8004, configurable via SERVER_PORT env var)
EXPOSE 8004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8004/health || exit 1

# Run the application
ENTRYPOINT ["gleam", "run", "--target", "erlang", "--"]
