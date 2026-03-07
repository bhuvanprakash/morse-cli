# Multi-stage build for indus-pool

# Stage 1: Builder
FROM rust:1.75-slim as builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src
COPY config ./config

# Build release binary
RUN cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Download and install PgCat binary
# PgCat is a PostgreSQL connection pooler written in Rust
RUN curl -L -o /usr/local/bin/pgcat \
    https://github.com/postgresml/pgcat/releases/latest/download/pgcat-linux-amd64 \
    && chmod +x /usr/local/bin/pgcat

# Copy binary from builder
COPY --from=builder /app/target/release/indus-pool /usr/local/bin/indus-pool

# Copy config files
COPY config/pgcat.toml /app/config/pgcat.toml

# Create non-root user
RUN useradd -m -u 1000 indus && \
    chown -R indus:indus /app

USER indus

# Expose ports
# 5432: PostgreSQL protocol (handled by PgCat)
# 9090: Health and metrics endpoints
EXPOSE 5432 9090

# Environment variables
ENV PGCAT_CONFIG_PATH=/app/config/pgcat.toml \
    PGCAT_BINARY_PATH=/usr/local/bin/pgcat \
    METRICS_PORT=9090 \
    PG_PORT=5432 \
    RUST_LOG=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9090/health || exit 1

# Run the service
ENTRYPOINT ["/usr/local/bin/indus-pool"]
