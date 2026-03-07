---
title: Security Scanning and Dependency Audits
description: How IndusBase runs automated vulnerability scans, dependency audits, secret scans, and SBOM generation.
---

## Automated Security Scanning

IndusBase runs an automated security pipeline in GitHub Actions (`.github/workflows/security.yml`) with:

- Trivy container/filesystem vulnerability scanning
- `npm audit` for JavaScript/TypeScript packages
- `pip-audit` for Python packages
- `cargo audit` for Rust dependencies
- `govulncheck` for Go modules
- Gitleaks secret scanning
- SBOM generation (SPDX and CycloneDX)

## Scan Cadence

- On every push to `main`
- On pull requests to `main`
- Daily scheduled run at 02:00 UTC (07:30 IST)
- Manual run via workflow dispatch

## Artifacts

Security workflow uploads:
- Trivy SARIF report
- Dependency audit reports per ecosystem
- Secret scan findings
- `sbom/` directory with SPDX + CycloneDX outputs

## Enterprise Visibility

Studio security dashboard (`/security`) displays:
- Last scan status
- Dependency issues summary
- Container scan summary
- SBOM links
- Secret scan health

## Remediation Policy

IndusBase remediation priorities:
1. Critical CVEs (24h target)
2. High CVEs (72h target)
3. Medium CVEs (sprint target)
4. Low CVEs (backlog)

Security advisories and procurement responses are available via the Trust Center and enterprise support channels.
