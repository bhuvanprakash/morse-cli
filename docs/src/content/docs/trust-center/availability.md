---
title: Availability
description: Availability design, incident handling, and maintenance transparency.
---

## Uptime and Reliability

- Multi-service health checks via `/health`
- Runtime telemetry and alerts via Prometheus/Grafana
- Centralized logs with Loki

## Backup and Recovery

- Automated backups to S3-compatible storage
- Restore verification drills
- Backup health dashboard for operations monitoring

## Incident Handling

- Incident creation and updates via status service APIs
- Public status history and postmortems
- Internal timeline and impact tracking in Studio
