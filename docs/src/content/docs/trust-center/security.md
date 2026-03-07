---
title: Security
description: IndusBase security controls and hardening posture.
---

## Encryption

- TLS for public and internal traffic.
- PostgreSQL and object storage encrypted at rest.
- Secret values encrypted before persistence in secret/config systems.

## Access Control

- JWT authentication for user APIs.
- Service-to-service authorization with `X-IndusBase-Internal`.
- Role-based access in Studio admin surfaces.

## Monitoring and Detection

- Prometheus metrics
- Grafana dashboards
- Loki centralized logs
- Security scans in CI (Trivy, dependency audits, secret scanning)

## Auditability

All sensitive admin actions and security-relevant events are written to the audit service and queryable from Studio Audit Logs.
