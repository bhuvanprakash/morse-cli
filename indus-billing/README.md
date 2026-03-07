# indus-billing

Billing and usage metering service for IndusBase enterprise plans.

## Features

- Plan catalog (`free`, `pro`, `growth`, `enterprise`)
- Usage rollups from `indusbase_platform.usage_events`
- Quota checks and overage preview
- INR invoice previews with GST scaffold fields
- Stripe webhook verification scaffold

## Endpoints

- `GET /health`
- `GET /metrics`
- `GET /billing/plans`
- `GET /billing/usage`
- `GET /billing/usage/summary`
- `GET /billing/invoices`
- `GET /billing/invoices/:id`
- `GET /billing/invoices/preview`
- `POST /billing/subscriptions`
- `PATCH /billing/subscriptions/:id`
- `POST /billing/webhooks/stripe`
