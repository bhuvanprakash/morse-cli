# Build stage
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Set working directory
WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o indus-store ./cmd/server

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Create non-root user
RUN addgroup -g 1000 -S indus && \
    adduser -u 1000 -S indus -G indus

# Create storage directory
RUN mkdir -p /data/storage && chown -R indus:indus /data

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/indus-store .

# Copy migrations
COPY --from=builder /build/internal/db/migrations ./internal/db/migrations

# Change to non-root user
USER indus

# Expose port (default 8005, configurable via SERVER_PORT env var)
EXPOSE 8005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8005/health || exit 1

# Run the server
ENTRYPOINT ["./indus-store"]
