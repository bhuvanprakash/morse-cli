---
title: Secrets Manager Overview
description: Scoped, encrypted, versioned secrets for platform, org, project, and function usage.
---

## Why

`indus-secrets` provides:
- Encrypted at-rest secrets (AES-256-GCM / envelope style)
- Versioning with active pointer
- Rotation and rollback workflows
- Scoped secrets (`platform`, `organization`, `project`, `function`)

## Create Secret

```bash
curl -X POST http://localhost:8000/secrets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"RAZORPAY_KEY_SECRET",
    "scope":"project",
    "project_id":"PROJECT_UUID",
    "value":"rzp_live_xxx"
  }'
```

## Resolve in Remote Config

Use `secret://NAME` in remote config for internal resolution:

```json
{"key":"payments.key_secret","value":"secret://RAZORPAY_KEY_SECRET","is_secret":true}
```
