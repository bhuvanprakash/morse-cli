# indus-live

**IndusBase Realtime WebSocket Engine** — PostgreSQL change streaming over BEAM.

## Overview

`indus-live` is a high-performance Realtime WebSocket service built with Gleam that streams PostgreSQL changes to connected clients. It uses PostgreSQL's logical replication (pgoutput) to capture database changes and fan them out to WebSocket subscribers based on topic filters.

## Features

- **WebSocket API**: Real-time bidirectional communication
- **PostgreSQL Logical Replication**: Native change data capture via pgoutput
- **Topic-based Pub/Sub**: Subscribe to specific tables with filters
- **JWT Authentication**: Secure connections with token validation
- **Change Event Streaming**: Insert, Update, Delete, Truncate events
- **High Performance**: Built on BEAM VM with Gleam's type safety

## Architecture

```
┌─────────────┐      WebSocket       ┌──────────────┐
│   Client    │◄────────────────────►│ indus-live   │
│             │                      │  WebSocket   │
└─────────────┘                      └──────┬───────┘
                                            │
                                            │ Actor Msg
                                            ▼
                                    ┌──────────────┐
                                    │    Broker    │
                                    │   (Pub/Sub)  │
                                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │ Replication  │
                                    │   (epgsql)   │
                                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  PostgreSQL  │
                                    │   (pgoutput) │
                                    └──────────────┘
```

## Quick Start

### Prerequisites

- Gleam 1.6.0+
- Erlang/OTP 27+
- PostgreSQL 14+ with logical replication enabled

### Environment Variables

```bash
# Required
export SERVER_PORT=4000
export DATABASE_URL=postgres://user:pass@localhost:5432/db
export REPLICATION_URL=postgres://user:pass@localhost:5432/db

# Optional
export JWT_PUBLIC_KEY_PATH=/path/to/jwt.pub
export INTERNAL_SECRET=internal-api-secret
export AUTH_SERVICE_URL=http://localhost:8080
export MAX_CONNECTIONS_PER_TOPIC=1000
export REPLICATION_SLOT=indus_live_slot
export PUBLICATION_NAME=indus_live_pub
```

### Running

```bash
# Install dependencies
gleam deps

# Run tests
gleam test

# Run the service
gleam run
```

### Docker

```bash
docker build -t indus-live .
docker run -p 4000:4000 \
  -e DATABASE_URL=postgres://user:pass@db:5432/db \
  -e REPLICATION_URL=postgres://user:pass@db:5432/db \
  indus-live
```

## WebSocket Protocol

### Connection

Connect to `/realtime/v1/websocket?token=<jwt_token>`

### Client Messages

```json
{"type": "subscribe", "topic": "public:posts"}
{"type": "unsubscribe", "topic": "public:posts"}
{"type": "ping"}
```

### Server Messages

```json
{"type": "connected", "connection_id": "uuid"}
{"type": "subscribed", "topic": "public:posts"}
{"type": "unsubscribed", "topic": "public:posts"}
{"type": "event", "topic": "public:posts", "payload": {...}}
{"type": "error", "message": "..."}
{"type": "pong"}
```

## Topic Format

- `public:posts` — All changes to `posts` table
- `public:posts:user_id=eq.abc123` — Filtered by column value

## License

MIT
