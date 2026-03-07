---
title: Incident Management
description: Manage incidents, maintenance windows, and public status updates.
---

## Create Incident

```bash
curl -X POST http://localhost:8000/status/incidents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"API latency in Mumbai region",
    "summary":"P95 latency elevated above SLO",
    "severity":"major",
    "impact":"high"
  }'
```

## Resolve Incident

```bash
curl -X POST http://localhost:8000/status/incidents/INCIDENT_UUID/resolve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"Scaled query + gate replicas to 6"}'
```

## Public Status

```bash
curl http://localhost:8000/status/public
```
