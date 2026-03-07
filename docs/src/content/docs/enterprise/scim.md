---
title: SCIM Provisioning
description: SCIM 2.0 user lifecycle provisioning in IndusBase for enterprise IdPs.
---

## Overview

IndusBase exposes SCIM v2 endpoints:
- `GET /scim/v2/Users`
- `POST /scim/v2/Users`
- `PATCH /scim/v2/Users/:id`
- `DELETE /scim/v2/Users/:id`

SCIM uses dedicated bearer tokens, separate from JWT auth.

## Create/Rotate SCIM Token

Use Studio Enterprise SSO page or CLI:

```bash
indus auth scim token-create --connection-id CONNECTION_UUID --name "Okta Prod"
```

## SCIM Example: Create User

```bash
curl -X POST http://localhost:8000/scim/v2/Users \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userName":"sre@example.co.in",
    "name":{"givenName":"Sre","familyName":"Lead"},
    "emails":[{"value":"sre@example.co.in","primary":true}],
    "active":true
  }'
```

## SCIM Example: Disable User

```bash
curl -X PATCH http://localhost:8000/scim/v2/Users/USER_UUID \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"Operations":[{"op":"Replace","path":"active","value":false}]}'
```

## Security

- Rotate SCIM tokens every 90 days.
- Use separate tokens per IdP environment (staging/prod).
- Monitor SCIM endpoint error-rate alerts in Grafana.
