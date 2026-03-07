# Indus Pool

A Rust microservice that wraps [PgCat](https://github.com/postgresml/pgcat) - a high-performance PostgreSQL connection pooler. This service manages the PgCat child process and exposes health check and Prometheus metrics endpoints.

## Purpose

Indus Pool provides:
- Process management for PgCat (spawn, monitor, restart on crash)
- Health check endpoint at `/health`
- Prometheus metrics at `/metrics`
- Admin endpoints for pool management (`/pool/reload`, `/pool/stats`)
- PostgreSQL protocol proxy on port 5432

## Local Setup

### Prerequisites

- Rust 1.75+
- PostgreSQL instance(s) for PgCat to connect to
- PgCat binary installed (or use Docker)

### Build

```bash
cargo build --release
```

### Run

```bash
# Set required environment variables
export PGCAT_CONFIG_PATH=./config/pgcat.toml
export PGCAT_BINARY_PATH=/usr/local/bin/pgcat
export METRICS_PORT=9090
export PG_PORT=5432

# Run the service
cargo run
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PGCAT_CONFIG_PATH` | `./config/pgcat.toml` | Path to PgCat configuration file |
| `PGCAT_BINARY_PATH` | `/usr/local/bin/pgcat` | Path to PgCat binary |
| `METRICS_PORT` | `9090` | Port for health/metrics endpoints |
| `PG_PORT` | `5432` | Port for PostgreSQL protocol (handled by PgCat) |
| `RUST_LOG` | `info` | Log level (trace, debug, info, warn, error) |
| `RESTART_DELAY_SECS` | `5` | Seconds to wait before restarting crashed PgCat |

## API Endpoints

### Health Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check - returns 200 if PgCat is running and healthy |
| `/health/ready` | GET | Readiness probe - checks PostgreSQL connectivity |
| `/health/live` | GET | Liveness probe - checks if service is alive |

### Metrics Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/metrics` | GET | Prometheus metrics in text format |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pool/reload` | POST | Reload PgCat configuration |
| `/pool/stats` | GET | Get pool statistics |

## Connections

### PostgreSQL Protocol

The service proxies PostgreSQL connections through PgCat on port 5432 (configurable via `PG_PORT`).

### Internal Architecture

```
┌─────────────────┐
│   Indus Pool    │
│  ┌───────────┐  │
│  │ HTTP API  │  │ ← Port 9090 (/health, /metrics)
│  └───────────┘  │
│  ┌───────────┐  │
│  │  PgCat    │  │ ← Port 5432 (PostgreSQL protocol)
│  │  Process  │  │
│  └───────────┘  │
└────────┬────────┘
         │
         ▼
   PostgreSQL Instances
```

## Configuration

See [`config/pgcat.toml`](config/pgcat.toml) for the main configuration and [`config/pgcat.example.toml`](config/pgcat.example.toml) for a fully documented example.

## Docker

```bash
docker build -t indus-pool .
docker run -p 5432:5432 -p 9090:9090 indus-pool
```
