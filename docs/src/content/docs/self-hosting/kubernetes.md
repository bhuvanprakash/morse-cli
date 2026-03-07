---
title: Kubernetes
description: Deploy IndusBase to Kubernetes with the official Helm chart.
---

Use the Helm chart in `/deploy/helm/indusbase` to deploy to EKS, GKE, AKS, or on-prem.

```bash
helm install indusbase ./deploy/helm/indusbase \
  --namespace indusbase \
  --create-namespace \
  --values ./deploy/helm/indusbase/values.prod.yaml
```
