---
title: Billing Overview
description: Plans, quotas, and subscriptions in IndusBase enterprise billing.
---

## Plans

IndusBase supports:
- `free`
- `pro`
- `growth`
- `enterprise`

## Billing API

```bash
curl http://localhost:8000/billing/plans \
  -H "Authorization: Bearer $TOKEN"
```

Create subscription:

```bash
curl -X POST http://localhost:8000/billing/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id":"PROJECT_UUID",
    "plan_key":"pro",
    "business_name":"Acme Pvt Ltd",
    "gstin":"27ABCDE1234F1Z5",
    "billing_address":"Mumbai, Maharashtra, India",
    "state_code":"27",
    "country_code":"IN"
  }'
```
