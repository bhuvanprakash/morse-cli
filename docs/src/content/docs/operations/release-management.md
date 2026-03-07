---
title: Release Management
description: Staging deploy, production promote, canary rollout, and rollback.
---

## Staging Release

```bash
make release-staging
```

## Promote to Production

```bash
make release-prod VERSION=1.0.0
```

## Rollback

```bash
make release-rollback REVISION=12
```

## Canary

Use canary values file:

```bash
helm upgrade --install indusbase ./deploy/helm/indusbase \
  --values ./deploy/helm/indusbase/values.yaml \
  --values ./deploy/releases/canary_values.yaml
```
