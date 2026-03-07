# IndusBase Kubernetes Deployment

## Prerequisites

- `kubectl`
- Helm `3.14+`
- Access to a Kubernetes cluster

## Quick Deploy: AWS EKS Mumbai

```bash
# 1. Create EKS cluster in ap-south-1 (Mumbai)
eksctl create cluster --name indusbase --region ap-south-1 --nodes 3 --node-type t3.medium

# 2. Create secrets
kubectl create namespace indusbase
kubectl create secret generic indusbase-secrets \
  --from-env-file=.env \
  -n indusbase

# 3. Install cert-manager for TLS
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set installCRDs=true

# 4. Deploy IndusBase
helm install indusbase ./deploy/helm/indusbase \
  --namespace indusbase \
  --values values.prod.yaml
```

## Quick Deploy: GCP GKE Mumbai

```bash
gcloud container clusters create indusbase \
  --region asia-south1 \
  --num-nodes 3 \
  --machine-type e2-standard-4

kubectl create namespace indusbase
kubectl create secret generic indusbase-secrets \
  --from-env-file=.env \
  -n indusbase

helm install indusbase ./deploy/helm/indusbase \
  --namespace indusbase \
  --values values.prod.yaml
```

## Scaling

- Update replica counts in `deploy/helm/indusbase/values.prod.yaml`
- Apply with `helm upgrade indusbase ./deploy/helm/indusbase --namespace indusbase --values values.prod.yaml`
- Enable HPAs for `indus-gate`, `indus-auth`, and `indus-live` when CPU-based autoscaling is required

## Upgrading

```bash
helm upgrade indusbase ./deploy/helm/indusbase
```
