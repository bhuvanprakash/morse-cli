---
title: Enterprise SSO (SAML + OIDC)
description: Configure enterprise SSO in IndusBase with verified domains, SAML/OIDC connections, and SP/IdP initiated login.
---

## Overview

IndusBase Enterprise SSO supports:
- SAML 2.0 (`/auth/sso/:slug/start`, `/auth/sso/:slug/acs`)
- OIDC enterprise connections
- Domain verification and automatic org/project mapping
- IdP-initiated and SP-initiated flows

## 1) Verify Domain

```bash
curl -X POST http://localhost:8000/auth/enterprise/domains/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain":"example.co.in",
    "org_id":"ORG_UUID",
    "project_id":"PROJECT_UUID"
  }'
```

## 2) Create SSO Connection

```bash
curl -X POST http://localhost:8000/auth/enterprise/connections \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Acme SSO",
    "slug":"acme",
    "provider_type":"saml",
    "domain":"example.co.in",
    "project_id":"PROJECT_UUID",
    "saml_entrypoint":"https://idp.example.co.in/sso",
    "saml_issuer":"indusbase-acme"
  }'
```

## 3) Start SP-initiated Login

```bash
open "http://localhost:8000/auth/sso/acme/start"
```

## 4) Metadata

```bash
curl http://localhost:8000/auth/sso/acme/metadata
```

## Notes

- All SSO events are captured in audit trails and `sso_login_events`.
- Existing email/password, OTP, and WhatsApp auth remains unchanged.
