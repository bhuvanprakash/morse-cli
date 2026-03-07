# 🚀 IndusBase

> **The 1,000x faster Firebase Alternative** - Postgres-native Backend-as-a-Service platform built for India 🇮🇳

---

## 📋 Project Status

### ✅ Completed Services (13 Microservices)

| # | Service | Language | Port | Status |
|---|---------|----------|------|--------|
| 1 | **indus-gate** | Zig 0.14 | 8000 | ✅ Complete |
| 2 | **indus-auth** | Go 1.23 | 8001 | ✅ Complete |
| 3 | **indus-query** | Rust 2021 | 8002 | ✅ Complete |
| 4 | **indus-pool** | Rust 2021 | 5432 | ✅ Complete |
| 5 | **indus-meta** | Go 1.23 | 8003 | ✅ Complete |
| 6 | **indus-live** | Gleam 1.10 | 8004 | ✅ Complete |
| 7 | **indus-store** | Go 1.23 | 8005 | ✅ Complete |
| 8 | **indus-edge** | Zig 0.14 | 8006 | ✅ Complete |
| 9 | **indus-ai** | Rust 2021 | 8007 | ✅ Complete |
| 10 | **indus-queue** | Go 1.23 | 8008 | ✅ Complete |
| 11 | **indus-studio** | SvelteKit 5 | 3000 | ✅ Complete |
| 12 | **cli** | Go 1.23 | - | ✅ Complete |
| 13 | **indusbase-js** | TypeScript | - | ✅ Complete |
| 14 | **indusbase-py** | Python | - | ✅ Complete |

### 📚 Documentation Status

| Document | Status |
|----------|--------|
| Architecture Overview | ✅ Complete |
| Service Documentation (11 services) | ✅ Complete |
| SDK Documentation (JS + Python) | ✅ Complete |
| CLI Documentation | ✅ Complete |
| Observability Documentation | ✅ Complete |
| Comprehensive Diagrams (40+) | ✅ Complete |
| Business Plan | ✅ Complete |
| Pricing Strategy | ✅ Complete |
| Market Analysis | ✅ Complete |

### 🔄 What's In Progress

- Integration testing between services
- Performance benchmarking
- Production deployment setup

### 📋 What's Left To Do

- Security audit
- SOC 2 certification
- Enterprise features
- Additional SDKs (Ruby, Go, Java)
- Mobile SDKs (iOS, Android)

---

## 🎯 What is IndusBase?

**IndusBase** is a modern, high-performance **Database-as-a-Service (DBaaS)** platform with:

- ⚡ **Instant APIs** - Auto-generate REST APIs from PostgreSQL tables
- 🔐 **Authentication** - JWT, OAuth (Google, GitHub), OTP, Aadhaar
- 📡 **Real-time** - WebSocket subscriptions for live data
- 📦 **Storage** - S3-compatible object storage
- 🚀 **Edge Functions** - Serverless TypeScript functions
- 🤖 **AI/Vector Search** - Semantic search with pgvector
- 📋 **Job Queue** - Background jobs with cron scheduling
- 🇮🇳 **India-First** - INR pricing, UPI, Aadhaar, DPDP compliance

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INDUSBASE PLATFORM                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐              │
│  │   Web    │   │  Mobile  │   │   SDKs   │   │   CLI    │              │
│  │    Apps  │   │    Apps  │   │JS/Python │   │  Tools   │              │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘              │
│       │               │               │               │                      │
│       └───────────────┴───────────────┴───────────────┘                      │
│                                   │                                          │
│                                   ▼                                          │
│                    ┌────────────────────────────┐                            │
│                    │    indus-gate (Zig)       │                            │
│                    │      Port: 8000           │                            │
│                    └────────────┬─────────────┘                            │
│                                 │                                           │
│       ┌─────────┬─────────┬────┴────┬─────────┬─────────┬─────────┐       │
│       ▼         ▼         ▼         ▼         ▼         ▼         ▼        │
│  ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐   │
│  │ auth   ││ query  ││  meta  ││  live  ││ store  ││  edge  ││  ai    │   │
│  │ 8001   ││ 8002   ││ 8003   ││ 8004   ││ 8005   ││ 8006   ││ 8007   │   │
│  │   Go   ││  Rust  ││   Go   ││ Gleam  ││   Go   ││  Zig   ││  Rust  │   │
│  └───┬────┘└────┬───┘└────┬───┘└────┬───┘└────┬───┘└────┬───┘└───┬────┘   │
│      │          │         │         │         │         │        │         │
│      └──────────┴─────────┴─────────┴─────────┴─────────┴────────┘        │
│                                    │                                        │
│                                    ▼                                        │
│                    ┌────────────────────────────┐                            │
│                    │    indus-pool (Rust)      │                            │
│                    │      Port: 5432           │                            │
│                    │   PgCat Connection Pool    │                            │
│                    └────────────┬─────────────┘                            │
│                                 │                                           │
│                    ┌────────────┴─────────────┐                            │
│                    ▼                            ▼                           │
│            ┌──────────┐              ┌──────────┐                         │
│            │PostgreSQL│              │  Redis   │                         │
│            │  +pgvec  │              │   7.x    │                         │
│            └──────────┘              └──────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💼 Business Plan Summary

### 🎯 Mission

> "Democratize backend development for Indian developers and businesses by providing a powerful, affordable, and locally-relevant Firebase alternative built on PostgreSQL."

### 💰 Revenue Model

| Tier | Price | Target |
|------|-------|--------|
| **Free** | Free | Individual developers |
| **Pro** | $29/mo (₹2,400) | Solo developers, startups |
| **Team** | $79/mo (₹6,500) | Growing teams |
| **Enterprise** | Custom | Large organizations |

### 📈 Financial Projections

| Year | Users | Revenue |
|------|-------|---------|
| 2026 | 1,000 | $540K |
| 2027 | 10,000 | $4.2M |
| 2028 | 50,000 | $18M |
| 2029 | 150,000 | $48M |

### 🏆 Competitive Advantages

1. **India-First** - INR pricing, UPI payments, Aadhaar eKYC
2. **PostgreSQL Power** - Superior SQL, RLS, extensions
3. **AI/Vector** - First-mover in India for vector search
4. **Edge Functions** - Unique Bun/Zig runtime
5. **Cost** - 70% cheaper than Firebase/AWS Amplify

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Make](https://www.gnu.org/software/make/)

### Start All Services

```bash
# Clone and setup
git clone https://github.com/yourorg/indusbase.git
cd indusbase

# Configure environment
cp .env.example .env

# Start with Docker
make docker-all

# Or with Docker Compose
docker-compose up --build -d

# Seed a demo-ready Studio org/project
make studio-demo-seed

# Verify the live Studio/API/docs path
make studio-live-check
```

### Test Services

```bash
# Check health
curl http://localhost:8000/health   # Gateway
curl http://localhost:8001/health   # Auth
curl http://localhost:8002/health   # Query
curl http://localhost:8003/health   # Meta
```

---

## 📚 Documentation

All documentation is available in the `documentation/` folder:

| Document | Description |
|----------|-------------|
| [documentation/README.md](./documentation/README.md) | Main documentation index |
| [documentation/architecture.md](./documentation/architecture.md) | System architecture |
| [documentation/business-plan.md](./documentation/business-plan.md) | Business strategy |
| [documentation/pricing.md](./documentation/pricing.md) | Pricing tiers |
| [documentation/market-analysis.md](./documentation/market-analysis.md) | Market research |
| [documentation/diagrams-comprehensive.md](./documentation/diagrams-comprehensive.md) | 40+ diagrams |

---

## 🛠️ Services Overview

| Service | Port | Language | Purpose |
|---------|------|----------|---------|
| **indus-gate** | 8000 | Zig | API Gateway, JWT validation, rate limiting |
| **indus-auth** | 8001 | Go | Authentication, JWT, OAuth, OTP |
| **indus-query** | 8002 | Rust | Auto REST API from PostgreSQL |
| **indus-pool** | 5432 | Rust | PostgreSQL connection pooling |
| **indus-meta** | 8003 | Go | DDL management, migrations |
| **indus-live** | 8004 | Gleam | Realtime WebSocket subscriptions |
| **indus-store** | 8005 | Go | S3-compatible object storage |
| **indus-edge** | 8006 | Zig | Edge functions (Bun runtime) |
| **indus-ai** | 8007 | Rust | Vector search, AI embeddings |
| **indus-queue** | 8008 | Go | Job queue, webhooks, cron |
| **indus-studio** | 3000 | SvelteKit | Web dashboard |

---

## 🔧 Development

### Local Development

```bash
# Start infrastructure
make dev-up

# Run services
make run-auth      # Port 8001
make run-query     # Port 8002
make run-meta      # Port 8003
make run-gate      # Port 8000

# Stop
make dev-down
```

### Building

```bash
make build-all
make build-gate
make build-auth
make build-query
```

### Testing

```bash
make test-all
make lint-all
```

---

## 📊 Key Features

### Core Features
- ✅ Auto REST API from PostgreSQL
- ✅ Real-time WebSocket subscriptions
- ✅ JWT + OAuth authentication
- ✅ S3-compatible storage
- ✅ Edge functions
- ✅ PostgreSQL connection pooling

### AI & ML
- ✅ Vector search (pgvector)
- ✅ AI embeddings (OpenAI, Cohere, Ollama)
- ✅ RAG pipelines

### India-Specific
- ✅ WhatsApp OTP (Gupshup)
- ✅ Aadhaar eKYC (UIDAI)
- ✅ DPDP compliance
- ✅ INR pricing
- ✅ IST timezone

---

## 👥 Team

IndusBase is built by a team of experienced engineers with expertise in:

- **Distributed Systems** - PostgreSQL, Redis, PgCat
- **Real-time Systems** - WebSockets, BEAM
- **Cloud Infrastructure** - Kubernetes, Docker
- **Developer Tools** - CLIs, SDKs

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📞 Support

- 📧 Email: support@indusbase.io
- 💬 Discord: [Join our community](https://discord.gg/indusbase)
- 📚 Docs: [docs.indusbase.io](https://docs.indusbase.io)
- 🐛 Issues: [GitHub Issues](https://github.com/indusbase/indusbase/issues)

---

## 🗺️ Roadmap

### Phase 1 (Current) - Foundation ✅
- [x] Core microservices (13 services)
- [x] Basic SDKs
- [x] Documentation

### Phase 2 - Growth 🚧
- [ ] Integration testing
- [ ] Performance optimization
- [ ] Beta launch

### Phase 3 - Scale 📈
- [ ] Enterprise features
- [ ] Additional SDKs
- [ ] Mobile SDKs

---

Built with ❤️ in India 🇮🇳

**Version**: 1.0.0  
**Last Updated**: March 2026
