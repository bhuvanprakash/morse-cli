---
title: Docker Compose Setup
description: Run IndusBase locally with Docker Compose in under 5 minutes.
---

## Prerequisites

- Docker 24+ and Docker Compose v2
- 4GB RAM minimum (8GB recommended for all services)
- Ports 8000, 3000, 5432 available

## Step 1: Clone and Configure

```bash
git clone https://github.com/indusbase/indusbase
cd indusbase
cp .env.example .env
```

Edit `.env` with your secrets:

```bash
POSTGRES_PASSWORD=your_strong_password_here
INTERNAL_SECRET=your_32_char_random_secret_here
JWT_SECRET=your_jwt_secret_here
TWOFACTOR_API_KEY=
COHERE_API_KEY=
FCM_CREDENTIALS_JSON=
```

## Step 2: Generate RSA Keys

```bash
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
```

## Step 3: Start

```bash
docker-compose up -d --build
```

This starts 13 services. First build takes 3-5 minutes.

## Step 4: Verify

```bash
docker-compose ps
curl http://localhost:8000/health | jq
open http://localhost:3000
```

## Services Map

| URL | Service |
|-----|---------|
| http://localhost:8000 | API Gateway (use this for all API calls) |
| http://localhost:3000 | IndusBase Studio (dashboard) |
| http://localhost:9091 | Prometheus metrics |
| http://localhost:3001 | Grafana dashboards |

## Stopping

```bash
docker-compose down
docker-compose down -v
```
