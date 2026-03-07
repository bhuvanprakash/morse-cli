# indus-config

Feature flags and remote config service for IndusBase.

## Endpoints

- `POST /config/evaluate`
- `POST /config/flags`
- `GET /config/flags`
- `GET /config/flags/:key`
- `PATCH /config/flags/:key`
- `DELETE /config/flags/:key`
- `POST /config/remote`
- `GET /config/remote`
- `GET /config/remote/:key`
- `PATCH /config/remote/:key`
- `DELETE /config/remote/:key`
- `GET /config/remote/export`
- `GET /config/environments`

All admin endpoints require a valid JWT. All responses follow:

```json
{"data": {...}, "error": null}
```

```json
{"data": null, "error": {"code":"ERROR_CODE", "message":"Human readable"}}
```
