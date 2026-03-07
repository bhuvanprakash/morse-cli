---
title: Usage Metering
description: How usage events roll up into billable metrics and invoice previews.
---

## Metered Metrics

- `api_requests`
- `db_rows`
- `storage_bytes`
- `vector_search_requests`
- `emails_sent`
- `sms_sent`
- `webhook_deliveries`
- `edge_invocations`

## Usage Summary

```bash
curl "http://localhost:8000/billing/usage/summary?project_id=PROJECT_UUID" \
  -H "Authorization: Bearer $TOKEN"
```

## Invoice Preview (INR)

```bash
curl "http://localhost:8000/billing/invoices/preview?project_id=PROJECT_UUID&period=2026-03" \
  -H "Authorization: Bearer $TOKEN"
```

Typical preview includes base plan + overages with INR examples (`Rs.`).
