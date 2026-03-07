# indus-gate

A high-performance API Gateway built with Zig 0.14. Routes requests to upstream services with support for rate limiting, JWT authentication, CORS, and load balancing.

## Purpose

indus-gate acts as the entry point for the IndusBase microservices architecture. It handles:

- Request routing to upstream services
- JWT authentication and authorization
- Rate limiting per IP address
- CORS handling
- Load balancing across upstream instances
- Health checks and circuit breaking
- Structured logging

## Local Setup

### Prerequisites

- Zig 0.14.0 or later
- Docker (optional, for containerized deployment)

### Building

```bash
# Build the executable
zig build

# Build with optimizations
zig build -Doptimize=ReleaseFast

# Run the gateway
zig build run
```

### Running Tests

```bash
# Run all unit tests
zig build test

# Run integration tests
zig build test-integration

# Check formatting
zig build lint

# Format code
zig build fmt
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INDUS_GATE_PORT` | HTTP server port | `8000` |
| `INDUS_GATE_CONFIG_PATH` | Path to config file | `config/default.json` |
| `INDUS_GATE_JWT_SECRET` | Secret key for JWT validation | (required) |
| `INDUS_GATE_TLS_CERT` | Path to TLS certificate | (optional) |
| `INDUS_GATE_TLS_KEY` | Path to TLS private key | (optional) |
| `INDUS_GATE_LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `INDUS_GATE_RATE_LIMIT_RPS` | Rate limit requests per second | `100` |
| `INDUS_GATE_RATE_LIMIT_BURST` | Rate limit burst capacity | `150` |

## API Endpoints

### Gateway Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check endpoint |
| `*` | `/api/*` | Proxied to API service |
| `*` | `/auth/*` | Proxied to Auth service |
| `*` | `/ws/*` | Proxied to WebSocket service |
| `*` | `/realtime/*` | WebSocket endpoint for realtime changes |
| `*` | `/storage/*` | Object storage API |

### Health Endpoint

```bash
GET /health

Response:
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 3600
}
```

## Upstream Connections

Configured in `config/default.json`:

| Service | Upstream URL | Health Check |
|---------|--------------|--------------|
| API Service | `http://localhost:8081` | `/health` |
| Auth Service | `http://localhost:8082` | `/health` |
| WebSocket Service | `http://localhost:8083` | `/health` |
| Live Service | `http://indus-live:8004` | `/health` |
| Store Service | `http://indus-store:8005` | `/health` |

## Architecture

```
Client -> indus-gate (port 8000)
    |
    +---> Rate Limit Middleware
    +---> Auth Middleware (JWT)
    +---> CORS Middleware
    +---> Logger Middleware
    |
    +---> Route Matcher
            |
            +---> Load Balancer
                    |
                    +---> Upstream Service
```

## Docker Deployment

```bash
# Build image
docker build -t indus-gate:latest .

# Run container
docker run -p 8000:8000 \
  -e INDUS_GATE_JWT_SECRET=your-secret \
  -v $(pwd)/config:/app/config \
  indus-gate:latest
```

## License

MIT
