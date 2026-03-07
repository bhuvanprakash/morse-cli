---
title: SMS Notifications
description: Send DLT-compliant transactional SMS to Indian phone numbers via 2Factor.in.
---

import IndiaFeatureBadge from '../../../components/IndiaFeatureBadge.astro';

<IndiaFeatureBadge />

## DLT Compliance (Mandatory in India)

Since 2021, TRAI mandates all transactional SMS in India must be registered
on the **DLT (Distributed Ledger Technology)** platform.

- Every SMS template must have a **DLT Template ID**
- Your **Sender ID** must be DLT-registered
- Non-DLT SMS are blocked by Indian telecom operators

## Send an SMS

```bash
curl -X POST http://localhost:8000/notify/sms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "919876543210",
    "body": "Dear Bhuvan, Rs.500 paid successfully. Ref: TXN123. -INDUBS",
    "dlt_template_id": "1007xxxxxxxxxxxxxxxx"
  }'
```
