# indus-audit

`indus-audit` is the platform audit trail service for IndusBase.

## Purpose

- Ingest internal audit events from all services.
- Query audit history by actor, project, action, severity, and time range.
- Export audit data as JSON or CSV.
- Provide summary counters for operations dashboards.

## Endpoints

- `GET /health`
- `GET /metrics`
- `POST /audit/internal/events` (requires `X-IndusBase-Internal`)
- `GET /audit/events`
- `GET /audit/events/:id`
- `GET /audit/export?format=json|csv`
- `GET /audit/summary`
