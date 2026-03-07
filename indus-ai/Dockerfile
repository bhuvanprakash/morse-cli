# =============================================================================
# Stage 1: Build
# =============================================================================
FROM rust:1.75-alpine AS builder

# Install build dependencies
RUN apk add --no-cache musl-dev openssl-dev pkgconfig libressl-dev

# Create app directory
WORKDIR /app

# Copy dependency files
COPY Cargo.toml Cargo.lock ./
COPY src ./src

# Build dependencies first (cached layer)
RUN cargo build --release --locked || cargo build --release

# Build the application
RUN cargo build --release --bin indus-ai

# =============================================================================
# Stage 2: Runtime
# =============================================================================
FROM alpine:3.19 AS runtime

# Install runtime dependencies
RUN apk add --no-cache ca-certificates libpq

# Create non-root user
RUN adduser -D -u 1000 appuser

# Copy binary from builder
COPY --from=builder /app/target/release/indus-ai /usr/local/bin/indus-ai

# Set ownership
USER appuser

# Expose port
EXPOSE 8007

# Set environment
ENV RUST_LOG=info \
    RUST_BACKTRACE=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8007/health || exit 1

# Run the application
CMD ["indus-ai"]
