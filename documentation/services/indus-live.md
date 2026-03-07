# indus-live - Realtime WebSocket Engine

> PostgreSQL change streaming over BEAM (Gleam)

## Overview

`indus-live` is a high-performance Realtime WebSocket service built with **Gleam** that streams PostgreSQL changes to connected clients. It uses PostgreSQL's logical replication (pgoutput) to capture database changes and fans them out to WebSocket subscribers based on topic filters.

## Features

- **WebSocket API**: Real-time bidirectional communication
- **PostgreSQL Logical Replication**: Native change data capture via pgoutput
- **Topic-based Pub/Sub**: Subscribe to specific tables with filters
- **JWT Authentication**: Secure connections with token validation
- **Change Event Streaming**: Insert, Update, Delete, Truncate events
- **High Performance**: Built on BEAM VM with Gleam's type safety

## Architecture

```mermaid
graph LR
    subgraph "indus-live"
        WS[("WebSocket<br/>Server")]
        BRO("KER[Broker<br/>(Pub/Sub)")]
        REPL[("Replication<br/>(epgsql)")]
    end
    
    CLIENT((Client)) --> WS
    WS --> BROKER
    BROKER --> REPL
    REPL --> PG[(PostgreSQL<br/>pgoutput)]
    
    style WS fill:#f9f,color:#000
    style BROKER fill:#bbf,color:#000
    style REPL fill:#dfd,color:#000
    style PG fill:#dfd,color:#000
```

## WebSocket Protocol

### Connection

Connect to: `/realtime/v1/websocket?token=<jwt_token>`

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

| Format | Description |
|--------|-------------|
| `public:posts` | All changes to posts table |
| `public:posts:user_id=eq.abc123` | Filtered by column value |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | WebSocket server port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REPLICATION_URL` | PostgreSQL replication URL | - |
| `JWT_PUBLIC_KEY_PATH` | Path to JWT public key | - |
| `INTERNAL_SECRET` | Internal API secret | - |
| `AUTH_SERVICE_URL` | Auth service URL | `http://localhost:8080` |
| `MAX_CONNECTIONS_PER_TOPIC` | Max connections per topic | `1000` |
| `REPLICATION_SLOT` | Replication slot name | `indus_live_slot` |
| `PUBLICATION_NAME` | Publication name | `indus_live_pub` |

## Quick Start

### Running Locally

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

## Example Usage

### JavaScript Client

```javascript
import { createClient } from 'indusbase-js';

// Connect to realtime
const channel = client.realtime
  .channel('db-changes')
  .on('INSERT', { schema: 'public', table: 'todos' }, (payload) => {
    console.log('New record:', payload.new);
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Subscribed to changes');
    }
  });

// Unsubscribe when done
await channel.unsubscribe();
```

### Filtered Subscription

```javascript
// Subscribe to changes for a specific user
const channel = client.realtime
  .channel('user-todos')
  .on('*', { 
    schema: 'public', 
    table: 'todos',
    filter: 'user_id=eq.' + userId 
  }, (payload) => {
    console.log('User todo changed:', payload);
  })
  .subscribe();
```

## Database Setup

Enable logical replication on PostgreSQL:

```sql
-- Create publication
CREATE PUBLICATION indus_live_pub FOR ALL TABLES;

-- Create replication slot
SELECT pg_create_logical_replication_slot('indus_live_slot', 'pgoutput');
```

## Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| INSERT | New row inserted | `{ "new": {...} }` |
| UPDATE | Row updated | `{ "old": {...}, "new": {...} }` |
| DELETE | Row deleted | `{ "old": {...} }` |
| TRUNCATE | Table truncated | `{ "truncated": ["table1", "table2"] }` |

## Performance

- Built on BEAM VM for massive concurrency
- Actor-based message passing
- Efficient binary protocol
- Connection pooling via PgCat

## License

MIT License
