# indus-queue

A Go 1.23 background job queue + webhooks + cron service.

## Purpose

- **Background Job Queue**: Durable PostgreSQL-backed queue (PGMQ-style with FOR UPDATE SKIP LOCKED)
- **Webhook Delivery**: HTTP webhook triggers with retry logic
- **Cron Scheduling**: Cron-based job scheduling with Asia/Kolkata (IST) timezone support

## Quick Start

```bash
# Run migrations
psql $DATABASE_URL -f internal/db/migrations/001_create_queue_schema.sql
psql $DATABASE_URL -f internal/db/migrations/002_create_webhooks_schema.sql

# Run server
go run cmd/server/main.go
```

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://localhost:5432/indusbase` |
| `PORT` | HTTP server port | `8008` |
| `WORKER_POOL_SIZE` | Number of concurrent workers | `10` |
| `POLL_INTERVAL` | Queue poll interval (ms) | `1000` |
| `DEFAULT_TIMEZONE` | Default timezone for cron | `Asia/Kolkata` |

## API Reference

### Queues

#### Create Queue
```
POST /queue/queues
Content-Type: application/json

{
  "name": "notifications",
  "description": "Push notification queue"
}
```

#### List Queues
```
GET /queue/queues
```

#### Delete Queue
```
DELETE /queue/queues/:name
```

### Jobs

#### Enqueue Job
```
POST /queue/jobs
Content-Type: application/json

{
  "queue_name": "notifications",
  "payload": {"user_id": "123", "message": "Hello"},
  "priority": 1,
  "scheduled_at": "2026-03-05T10:00:00Z",
  "retry_count": 3
}
```

#### Enqueue Batch Jobs
```
POST /queue/jobs/batch
Content-Type: application/json

{
  "jobs": [
    {"queue_name": "notifications", "payload": {...}},
    {"queue_name": "notifications", "payload": {...}}
  ]
}
```

#### List Jobs
```
GET /queue/jobs?queue_name=notifications&status=pending&limit=50
```

#### Acknowledge Job (Success)
```
POST /queue/jobs/:id/ack
```

#### Fail Job
```
POST /queue/jobs/:id/fail
Content-Type: application/json

{
  "error_message": "Failed to send notification"
}
```

#### Delete Job
```
DELETE /queue/jobs/:id
```

### Webhooks

#### Create Webhook
```
POST /queue/webhooks
Content-Type: application/json

{
  "name": "Order Created",
  "url": "https://example.com/webhooks/order",
  "event": "order.created",
  "secret": "whsec_xxx",
  "enabled": true
}
```

#### List Webhooks
```
GET /queue/webhooks
```

#### Update Webhook
```
PATCH /queue/webhooks/:id
Content-Type: application/json

{
  "enabled": false
}
```

#### Delete Webhook
```
DELETE /queue/webhooks/:id
```

#### Test Webhook
```
POST /queue/webhooks/:id/test
```

### Cron Schedules

#### Create Cron Schedule
```
POST /queue/cron
Content-Type: application/json

{
  "name": "Daily Report",
  "cron_expression": "0 9 * * *",
  "timezone": "Asia/Kolkata",
  "job_payload": {
    "queue_name": "reports",
    "payload": {"type": "daily"}
  },
  "enabled": true
}
```

#### List Cron Schedules
```
GET /queue/cron
```

#### Update Cron Schedule
```
PATCH /queue/cron/:id
Content-Type: application/json

{
  "enabled": false
}
```

#### Delete Cron Schedule
```
DELETE /queue/cron/:id
```

#### Run Cron Job Now
```
POST /queue/cron/:id/run-now
```

## Cron Presets for India

All cron expressions use Asia/Kolkata (IST = UTC+5:30) timezone by default.

| Description | Cron Expression | Notes |
|-------------|------------------|-------|
| Every day at 9am IST | `0 9 * * *` | TZ=Asia/Kolkata |
| Every hour | `0 * * * *` | At minute 0 |
| Every Monday morning | `0 9 * * 1` | Monday at 9am |
| Every 1st of month | `0 0 1 * *` | Midnight |
| Every 5 minutes | `*/5 * * * *` | Frequent jobs |
| Weekdays only at 10am | `0 10 * * 1-5` | Mon-Fri at 10am |
| Every 30 minutes | `*/30 * * * *` | Half-hourly |
| End of month at 11pm | `0 23 28-31 * *` | Last days |
| Every Sunday at 6pm | `0 18 * * 0` | Weekend cleanup |

## Architecture

```
                    ┌─────────────────┐
                    │   HTTP Server   │
                    │    (Port 8008)  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Job Handlers   │ │ Webhook Handler │ │  Cron Handler   │
└────────┬────────┘ └─────────────────┘ └────────┬────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────────────────────────────────────────────┐
│                   Worker Dispatcher                     │
│  - Polls queues (FOR UPDATE SKIP LOCKED)               │
│  - Spawns goroutines per job                          │
│  - Handles retries with exponential backoff           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL Queue Backend                   │
│  - queues table                                         │
│  - jobs table                                           │
│  - webhooks table                                       │
│  - cron_schedules table                                 │
└─────────────────────────────────────────────────────────┘
```

## Job Status Flow

```
pending → running → completed
   │         │
   │         └─→ failed → (retry) → pending
   │
   └─→ cancelled
```

## Retry Strategy

- Exponential backoff: 1s, 2s, 4s, 8s, 16s...
- Max retry count configurable per job
- Dead letter queue for exhausted retries
