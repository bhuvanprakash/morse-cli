---
title: Studio Overview
description: Premium control-plane experience in Indus Studio and how it maps to IndusBase services.
---

Indus Studio is the operational control plane for your IndusBase deployment. It is fully wired to gateway-backed APIs and project context.

## What Studio Covers

- Project dashboard and context switching
- Database tools: table editor and SQL editor
- AI collections and vector search workflows
- Queue jobs, cron schedules, and webhooks
- Notifications, templates, delivery history, and stats
- Feature flags and remote config by environment
- Enterprise SSO/SCIM management
- Audit, billing, trust center, secrets, status, security, and support consoles

## Default Access URL

```bash
open http://localhost:3000
```

## Session + Context Model

- Auth session is stored in browser local storage.
- Active project and environment are persisted and attached to API requests.
- Studio sends `Authorization`, project context headers, and `apikey` (when available) through the shared API client.

## Command Palette

Open with `Cmd/Ctrl + K`:

- Navigate to major modules
- Switch projects
- Trigger common admin actions quickly
