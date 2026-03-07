---
title: Secret Rotation
description: Rotate and rollback secrets safely in production.
---

## Rotate Secret

```bash
curl -X POST http://localhost:8000/secrets/RAZORPAY_KEY_SECRET/rotate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"rzp_live_new_value"}'
```

## List Versions

```bash
curl http://localhost:8000/secrets/RAZORPAY_KEY_SECRET/versions \
  -H "Authorization: Bearer $TOKEN"
```

## Rollback

```bash
curl -X POST http://localhost:8000/secrets/RAZORPAY_KEY_SECRET/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":2}'
```

All operations are audited to `indus-audit`.
