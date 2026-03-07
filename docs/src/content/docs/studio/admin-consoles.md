---
title: Studio Admin Consoles
description: Operational and enterprise admin pages available in Studio.
---

Studio includes dedicated admin consoles for enterprise and operations teams.

## Admin Modules

- Enterprise SSO (`/enterprise/sso`)
- Audit Logs (`/audit`)
- Billing (`/billing`)
- Trust Center (`/trust-center`)
- Secrets Manager (`/secrets`)
- Status & Incidents (`/status`)
- Security Scans (`/security`)
- Support Console (`/support`)

## Role-Aware Behavior

- Admin/owner users can perform mutations.
- Non-admin users see read-only restrictions in sensitive pages.
- Destructive actions require explicit confirmation dialogs.

## End-to-End Verification

```bash
cd indus-studio && npm run test:e2e
```

## Useful Operator Links

- Studio: `http://localhost:3000`
- Docs: `http://localhost:4321`
- Public status page: `http://localhost:4321/status`
