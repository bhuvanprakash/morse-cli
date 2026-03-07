# indus-secrets

Encrypted secret manager for IndusBase enterprise operations.

## Features

- Versioned encrypted secrets
- Scopes: `platform`, `organization`, `project`, `function`
- Rotate and rollback flows
- Internal fetch endpoint for trusted services
- Audit events for read/write/rotate/rollback

## Endpoints

- `GET /health`
- `GET /metrics`
- `POST /secrets`
- `GET /secrets`
- `GET /secrets/:name`
- `POST /secrets/:name/rotate`
- `POST /secrets/:name/rollback`
- `GET /secrets/:name/versions`
- `POST /secrets/internal/fetch`
