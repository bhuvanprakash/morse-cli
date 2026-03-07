---
title: Security Scanning Operations
description: Run and review vulnerability scanning automation for IndusBase.
---

## CI Workflow

Security workflow file:

```text
.github/workflows/security.yml
```

It runs Trivy, npm/pip/cargo/go audits, gitleaks, and SBOM generation.

## Manual Trigger

```bash
gh workflow run security.yml
```

## Studio

Security dashboard:

```text
http://localhost:3000/security
```

It shows latest scan status, findings summary, and SBOM links.
