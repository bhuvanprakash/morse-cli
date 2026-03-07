# indus-status

Status and incident management service for IndusBase operations.

## Features

- Public status feed
- Incident lifecycle (create, update, resolve)
- Maintenance windows
- Incident subscribers
- Alertmanager webhook receiver for automatic incident creation

## Endpoints

- `GET /health`
- `GET /metrics`
- `GET /status/public`
- `GET /status/incidents/public`
- `POST /status/incidents`
- `PATCH /status/incidents/:id`
- `POST /status/incidents/:id/resolve`
- `GET /status/incidents`
- `POST /status/maintenance`
- `GET /status/maintenance`
- `POST /status/subscribe`
- `POST /status/webhooks/alertmanager`
