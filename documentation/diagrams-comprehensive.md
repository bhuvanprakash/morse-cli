# IndusBase Comprehensive Diagrams

This document contains 40+ architecture, flow, and database diagrams for the IndusBase platform.

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Service Communication Flow](#2-service-communication-flow)
3. [Database Schema Diagrams](#3-database-schema-diagrams)
4. [API Request Flow](#4-api-request-flow)
5. [Authentication Flow](#5-authentication-flow)
6. [Query Execution Flow](#6-query-execution-flow)
7. [Real-time Data Flow](#7-real-time-data-flow)
8. [Storage Architecture](#8-storage-architecture)
9. [Edge Functions Execution](#9-edge-functions-execution)
10. [AI/Vector Search Pipeline](#10-aivector-search-pipeline)
11. [Job Queue Architecture](#11-job-queue-architecture)
12. [Connection Pooling](#12-connection-pooling)
13. [Observability Stack](#13-observability-stack)
14. [Deployment Architecture](#14-deployment-architecture)

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture (Mermaid)

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Applications]
        MOBILE[Mobile Apps]
        SDK[SDKs<br/>JS/Python]
        CLI[CLI Tools]
    end
    
    subgraph "Gateway Layer"
        GATE["indus-gate<br/>:8000<br/>Zig"]
    end
    
    subgraph "Core Services"
        AUTH["indus-auth<br/>:8001<br/>Go"]
        QUERY["indus-query<br/>:8002<br/>Rust"]
        META["indus-meta<br/>:8003<br/>Go"]
    end
    
    subgraph "Extended Services"
        LIVE["indus-live<br/>:8004<br/>Gleam"]
        STORE["indus-store<br/>:8005<br/>Go"]
        EDGE["indus-edge<br/>:8006<br/>Zig"]
        AI["indus-ai<br/>:8007<br/>Rust"]
        QUEUE["indus-queue<br/>:8008<br/>Go"]
    end
    
    subgraph "Data Layer"
        POOL["indus-pool<br/>:5432<br/>Rust"]
        DB[(PostgreSQL<br/>+pgvector)]
        REDIS[("Redis")]
    end
    
    WEB --> GATE
    MOBILE --> GATE
    SDK --> GATE
    CLI --> GATE
    
    GATE --> AUTH
    GATE --> QUERY
    GATE --> META
    GATE --> LIVE
    GATE --> STORE
    GATE --> EDGE
    GATE --> AI
    GATE --> QUEUE
    
    AUTH --> POOL
    QUERY --> POOL
    META --> POOL
    LIVE --> POOL
    STORE --> POOL
    AI --> POOL
    QUEUE --> POOL
    
    POOL --> DB
    LIVE --> REDIS
```

### 1.2 ASCII Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           INDUSBASE PLATFORM                                 │
├──────────────────────────────────────────────────────────────────────────────┤
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
│                    │  • JWT Validation        │                            │
│                    │  • Rate Limiting         │                            │
│                    │  • Request Routing       │                            │
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
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Communication Flow

### 2.1 Request-Response Flow (Mermaid)

```mermaid
sequenceDiagram
    participant Client
    participant Gate as indus-gate
    participant Auth as indus-auth
    participant Query as indus-query
    participant Pool as indus-pool
    participant DB as PostgreSQL

    Client->>Gate: HTTP Request + JWT
    Gate->>Gate: Validate JWT
    Gate->>Auth: Verify Token
    Auth-->>Gate: Token Valid
    
    alt Query Request
        Gate->>Query: Forward Request
        Query->>Pool: Get Connection
        Pool->>DB: Execute Query
        DB-->>Pool: Results
        Pool-->>Query: Results
        Query-->>Gate: JSON Response
    end
    
    Gate-->>Client: HTTP Response
```

### 2.2 ASCII Flow Diagram

```
┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
│ Client │────▶│  Gate │────▶│  Auth  │────▶│  Pool  │────▶│   DB   │
└────────┘     └────────┘     └────────┘     └────────┘     └────────┘
     │                                               │            │
     │  1. Request                                    │            │
     │  2. Validate JWT ◀──────────────────────────────┘            │
     │  3. Verify Token ─────────────────▶ Token Valid              │
     │  4. Forward Request                                           │
     │  5. Get Connection                                           │
     │  6. Execute Query                                            │
     │  7. Return Results ◀─────────────────────────────────────────
     │  8. Response ◀───────────────────────────────────────────────
     │  9. Done ◀───────────────────────────────────────────────────
```

---

## 3. Database Schema Diagrams

### 3.1 Core Database Schema (Mermaid)

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : has
    USERS ||--o{ OAUTH_ACCOUNTS : has
    USERS ||--o{ OTP_CODES : has
    USERS ||--o{ API_KEYS : has
    USERS ||--o{ PROJECTS : owns
    
    PROJECTS ||--o{ TABLES : contains
    PROJECTS ||--o{ COLLECTIONS : has
    PROJECTS ||--o{ BUCKETS : manages
    
    TABLES ||--o{ COLUMNS : has
    TABLES ||--o{ INDEXES : has
    TABLES ||--o{ POLICIES : has
    
    COLUMNS ||--o{ CONSTRAINTS : has
    
    COLLECTIONS ||--o{ DOCUMENTS : contains
    COLLECTIONS {
        uuid id PK
        string name
        string description
        string embedding_provider
        int dimensions
        uuid owner_id FK
        timestamp created_at
    }
    
    DOCUMENTS {
        uuid id PK
        uuid collection_id FK
        text content
        vector embedding
        jsonb metadata
        timestamp created_at
    }
    
    BUCKETS ||--o{ OBJECTS : contains
    
    USERS {
        uuid id PK
        string email
        string encrypted_password
        string full_name
        string avatar_url
        string role
        bool email_verified
        timestamp created_at
        timestamp updated_at
    }
    
    SESSIONS {
        uuid id PK
        uuid user_id FK
        string token
        timestamp expires_at
        timestamp created_at
    }
    
    TABLES {
        uuid id PK
        uuid project_id FK
        string name
        string schema
        jsonb columns
        timestamp created_at
    }
```

### 3.2 ASCII ER Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌────────┐         ┌──────────┐         ┌─────────┐                     │
│    │ USERS  │         │ PROJECTS │         │ BUCKETS │                     │
│    ├────────┤         ├──────────┤         ├─────────┤                     │
│    │ id (PK)│◀──────▶│ owner_id │         │ id (PK) │                     │
│    │ email  │         │ id (PK)  │◀──────▶│ id (PK) │                     │
│    │ name   │         │ name     │         │ name    │                     │
│    │ password│        │ settings │         │ owner_id│                     │
│    │ role   │         │ created  │         │ public  │                     │
│    └───┬────┘         └────┬─────┘         └────┬────┘                     │
│        │                   │                   │                           │
│        │ 1:N              │ 1:N              │ 1:N                       │
│        ▼                   ▼                   ▼                           │
│    ┌────────┐         ┌──────────┐         ┌─────────┐                     │
│    │SESSIONS│         │ TABLES   │         │ OBJECTS │                     │
│    ├────────┤         ├──────────┤         ├─────────┤                     │
│    │ id (PK)│         │ id (PK)  │         │ id (PK) │                     │
│    │ user_id│         │ project_id│        │ bucket_id│                    │
│    │ token  │         │ name     │         │ name    │                     │
│    │ expires│         │ schema   │         │ size    │                     │
│    └────────┘         └────┬─────┘         │ mime   │                     │
│                           │               └─────────┘                     │
│                           │ 1:N                                              │
│                           ▼                                                  │
│                      ┌──────────┐                                           │
│                      │ COLUMNS  │                                           │
│                      ├──────────┤                                           │
│                      │ id (PK)  │                                           │
│                      │ table_id │                                           │
│                      │ name     │                                           │
│                      │ type     │                                           │
│                      │ nullable │                                           │
│                      └──────────┘                                           │
│                                                                            │
│    ┌─────────────┐         ┌──────────────┐                               │
│    │ COLLECTIONS │         │   DOCUMENTS  │                               │
│    ├─────────────┤         ├──────────────┤                               │
│    │ id (PK)     │◀───────│ id (PK)      │                               │
│    │ name        │   1:N  │ collection_id│                               │
│    │ dimensions  │         │ content      │                               │
│    │ provider    │         │ embedding    │                               │
│    │ owner_id    │         │ metadata     │                               │
│    └─────────────┘         └──────────────┘                               │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. API Request Flow

### 4.1 API Gateway Flow (Mermaid)

```mermaid
flowchart TD
    A[Client Request] --> B{Valid JWT?}
    B -->|No| C[Return 401]
    B -->|Yes| D{Rate Limited?}
    D -->|Yes| E[Return 429]
    D -->|No| F{CORS Valid?}
    F -->|No| G[Return CORS Error]
    F -->|Yes| H{Route Exists?}
    H -->|No| I[Return 404]
    H -->|Yes| J[Forward to Service]
    J --> K{Service Response}
    K -->|Success| L[Return 200 + Data]
    K -->|Error| M[Return Error]
    
    style A fill:#f9f,color:#000
    style L fill:#9f9,color:#000
    style C fill:#f99,color:#000
    style E fill:#f99,color:#000
    style I fill:#f99,color:#000
```

### 4.2 ASCII Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Start: Client Request                                                    │
│           │                                                                │
│           ▼                                                                │
│   ┌───────────────────┐                                                   │
│   │  Valid JWT Token? │                                                   │
│   └────────┬──────────┘                                                   │
│        Yes  │  No                                                         │
│         ┌──┴──┐                                                           │
│         ▼     ▼                                                           │
│   ┌─────────┐ ┌──────────────┐                                           │
│   │ Rate    │ │ Return 401   │                                           │
│   │ Limited?│ │ Unauthorized  │                                           │
│   └────┬────┘ └──────────────┘                                            │
│    Yes │  No                                                              │
│    ┌───┴───┐                                                              │
│    ▼       ▼                                                              │
│ ┌──────┐ ┌───────────┐                                                   │
│ │429   │ │ CORS Valid?│                                                   │
│ │Rate  │ └─────┬─────┘                                                   │
│ │Limit │  Yes  │  No                                                     │
│ └──┬───┘  ┌────┴────┐                                                    │
│    │      ▼         ▼                                                    │
│    │  ┌───────┐ ┌───────────┐                                            │
│    │  │ Route │ │ Return    │                                            │
│    │  │Exists?│ │ CORS Err  │                                            │
│    │  └──┬───┘ └───────────┘                                             │
│    │  Yes│  No                                                            │
│    │  ┌──┴──┐                                                            │
│    │  ▼     ▼                                                            │
│    │ ┌────┐ ┌─────────┐                                                  │
│    │ │200 │ │ Return  │                                                  │
│    │ │ OK │ │ 404     │                                                  │
│    │ └────┘ └─────────┘                                                  │
│    │   │                                                                │
│    │   ▼                                                                │
│    └─►End                                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Authentication Flow

### 5.1 Authentication Sequence (Mermaid)

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Gate as indus-gate
    participant Auth as indus-auth
    participant DB as Database
    participant Redis

    User->>App: Enter email/password
    App->>Gate: POST /auth/signin
    Gate->>Auth: Forward request
    Auth->>DB: Verify credentials
    DB-->>Auth: User found
    Auth->>Auth: Generate JWT tokens
    Auth->>Redis: Store session
    Auth-->>Gate: Return tokens
    Gate-->>App: Return tokens
    App->>App: Store tokens
    App-->>User: Login successful
```

### 5.2 OAuth Flow (Mermaid)

```mermaid
flowchart LR
    A[User] -->|1. Click Login| B[App]
    B -->|2. Redirect| C[OAuth Provider<br/>Google/GitHub]
    C -->|3. User Authorizes| D[Provider]
    D -->|4. Return Code| B
    B -->|5. Exchange Code| Auth[indus-auth]
    Auth -->|6. Get Access Token| D
    D -->|7. Return Token| Auth
    Auth -->|8. Get User Info| D
    Auth -->|9. Create/Update User| DB[(Database)]
    Auth -->|10. Generate JWT| B
    B -->|11. Store Token| A
```

---

## 6. Query Execution Flow

### 6.1 Query Flow (Mermaid)

```mermaid
flowchart TD
    A[Client Query] --> B[Parse Query]
    B --> C{Valid SQL?}
    C -->|No| D[Return 400]
    C -->|Yes| E{Authenticated?}
    E -->|No| F[Return 401]
    E -->|Yes| G{Authorized?<br/>RLS Check}
    G -->|No| H[Return 403]
    G -->|Yes| I[Get DB Connection]
    I --> J[Execute Query]
    J --> K{Query Success?}
    K -->|No| L[Return 500]
    K -->|Yes| M[Format Results]
    M --> N[Return 200 + JSON]
    
    style A fill:#f9f,color:#000
    style N fill:#9f9,color:#000
```

---

## 7. Real-time Data Flow

### 7.1 WebSocket Flow (Mermaid)

```mermaid
flowchart TD
    subgraph Client
        WS[WebSocket<br/>Connection]
    end
    
    subgraph "indus-live"
        H[HTTP Handler]
        S[Subscription<br/>Manager]
        P[Publisher]
    end
    
    subgraph PostgreSQL
        R[Replication<br/>Slot]
        PG[ WAL<br/>Stream]
    end
    
    WS -->|Connect| H
    H -->|Subscribe| S
    S -->|Track Topic| WS
    
    R -->|Read WAL| PG
    PG -->|Publish Change| P
    P -->|Broadcast| S
    S -->|Send Event| WS
    
    style WS fill:#f9f,color:#000
    style PG fill:#dfd,color:#000
```

---

## 8. Storage Architecture

### 8.1 Object Storage Flow (Mermaid)

```mermaid
flowchart TD
    A[Client] -->|Upload Request| G[API Gateway]
    G -->|Forward| S[indus-store]
    
    S -->|Validate| V{Valid Request?}
    V -->|No| E[Return Error]
    V -->|Yes| B[Process Upload]
    
    B -->|Check Bucket| BK{Bucket Exists?}
    BK -->|No| C[Create Bucket]
    BK -->|Yes| D{Size OK?}
    
    D -->|No| L[Return Size Error]
    D -->|Yes| P[Save to Backend]
    
    P -->|Local| LFS[Local FS]
    P -->|S3| S3[MinIO/S3]
    
    LFS -->|Save File| F[File System]
    S3 -->|Save File| S3B[S3 Bucket]
    
    F -->|Update Metadata| DB[(PostgreSQL)]
    S3B -->|Update Metadata| DB
    
    DB -->|Return Success| S
    S -->|Return URL| G
    G -->|Return URL| A
    
    style A fill:#f9f,color:#000
    style F fill:#dfd,color:#000
    style S3B fill:#dfd,color:#000
```

---

## 9. Edge Functions Execution

### 9.1 Edge Function Flow (Mermaid)

```mermaid
flowchart TD
    A[Client Request] --> G[API Gateway]
    G -->|Forward| E[indus-edge]
    
    E -->|Check Function| F{Function<br/>Exists?}
    F -->|No| E1[Return 404]
    F -->|Yes| W{Worker<br/>Available?}
    
    W -->|No| S[Spawn Worker]
    W -->|Yes| R[Reuse Worker]
    
    S -->|Init| I[Initialize Bun]
    I -->|Load Code| C[Load Function]
    R -->|Load Code| C
    
    C -->|Execute| X[Run Handler]
    X -->|Request| Req[Context<br/>Request]
    
    Req -->|Database| DB[(PostgreSQL)]
    Req -->|API Call| Ext[External API]
    
    DB -->|Response| X
    Ext -->|Response| X
    
    X -->|Response| Res[Response]
    Res -->|Return| E
    E -->|Return| G
    G -->|Return| A
    
    style A fill:#f9f,color:#000
```

---

## 10. AI/Vector Search Pipeline

### 10.1 RAG Pipeline (Mermaid)

```mermaid
flowchart LR
    subgraph "Ingestion"
        D[Documents] --> T[Text<br/>Chunking]
        T --> E[Embedding<br/>Model]
        E --> V[Vector<br/>Embeddings]
        V --> S[Store in<br/>pgvector]
    end
    
    subgraph "Query"
        Q[User Query] --> QM[Embedding<br/>Model]
        QM --> QV[Query<br/>Vector]
        QV --> S
        S --> K[Top-K<br/>Similarity]
        K --> C[Context<br/>Results]
        C --> L[LLM<br/>Prompt]
        L --> R[Final<br/>Response]
    end
    
    style D fill:#f9f,color:#000
    style Q fill:#f9f,color:#000
    style S fill:#dfd,color:#000
```

---

## 11. Job Queue Architecture

### 11.1 Queue Flow (Mermaid)

```mermaid
flowchart TD
    A[Producer] -->|Enqueue Job| Q[indus-queue]
    Q -->|Store Job| DB[(PostgreSQL)]
    
    DB -->|Poll| W[Worker]
    W -->|Lock Job| L[FOR UPDATE<br/>SKIP LOCKED]
    L -->|Get Job| J[Process Job]
    
    J -->|Execute| H[Handler]
    H -->|Success| A1[ACK Job]
    A1 -->|Mark Complete| DB
    
    H -->|Retry| R[Exponential<br/>Backoff]
    R -->|Requeue| Q
    
    H -->|Max Retries| D[Dead Letter<br/>Queue]
    D -->|Store Failed| DB
    
    style A fill:#f9f,color:#000
    style DB fill:#dfd,color:#000
```

---

## 12. Connection Pooling

### 12.1 PgCat Architecture (Mermaid)

```mermaid
flowchart TD
    C[Clients] -->|Connect| P[indus-pool<br/>PgCat]
    
    P -->|Route| R{Routing<br/>Logic}
    R -->|Pool A| PA[Pool A<br/>Shard 0]
    R -->|Pool B| PB[Pool B<br/>Shard 1]
    R -->|Pool C| PC[Pool C<br/>Shard 2]
    
    PA -->|Connect| DB1[(PostgreSQL<br/>Primary)]
    PB -->|Connect| DB2[(PostgreSQL<br/>Replica 1)]
    PC -->|Connect| DB3[(PostgreSQL<br/>Replica 2)]
    
    PA -.->|Health Check| H1[Monitor]
    PB -.->|Health Check| H1
    PC -.->|Health Check| H1
    
    P -->|Metrics| M[Prometheus<br/>Metrics]
    
    style C fill:#f9f,color:#000
    style P fill:#f9f,color:#000
    style DB1 fill:#dfd,color:#000
    style DB2 fill:#dfd,color:#000
    style DB3 fill:#dfd,color:#000
```

---

## 13. Observability Stack

### 13.1 Monitoring Architecture (Mermaid)

```mermaid
flowchart TB
    subgraph "Services"
        S1[indus-gate]
        S2[indus-auth]
        S3[indus-query]
        S4[indus-ai]
    end
    
    subgraph "Metrics Collection"
        OTEL[OTEL<br/>Collector]
        PROM[Prometheus]
    end
    
    subgraph "Visualization"
        GRAF[Grafana]
        ALERT[Alertmanager]
    end
    
    S1 -->|Traces| OTEL
    S2 -->|Traces| OTEL
    S3 -->|Traces| OTEL
    S4 -->|Traces| OTEL
    
    S1 -->|Metrics| PROM
    S2 -->|Metrics| PROM
    S3 -->|Metrics| PROM
    S4 -->|Metrics| PROM
    
    OTEL -->|Process| PROM
    PROM -->|Dashboards| GRAF
    PROM -->|Alerts| ALERT
    ALERT -->|Notify| Email[Email]
    ALERT -->|Notify| Slack[Slack]
    
    style OTEL fill:#f9f,color:#000
    style PROM fill:#9ff,color:#000
    style GRAF fill:#9f9,color:#000
```

---

## 14. Deployment Architecture

### 14.1 Production Deployment (Mermaid)

```mermaid
flowchart TB
    subgraph "Load Balancer"
        LB[NGINX<br/>TLS Termination]
    end
    
    subgraph "Kubernetes Cluster"
        subgraph "Gateway"
            GW1[Pod 1]
            GW2[Pod 2]
            GW3[Pod 3]
        end
        
        subgraph "Services"
            S1[indus-auth]
            S2[indus-query]
            S3[indus-meta]
            S4[indus-ai]
        end
        
        subgraph "Data"
            POOL[indus-pool]
            PG[(PostgreSQL<br/>Primary + Replicas)]
            RD[Redis<br/>Cluster]
        end
    end
    
    LB --> GW1
    LB --> GW2
    LB --> GW3
    
    GW1 --> S1
    GW2 --> S2
    GW3 --> S3
    GW1 --> S4
    
    S1 --> POOL
    S2 --> POOL
    S3 --> POOL
    S4 --> POOL
    
    POOL --> PG
    S1 --> RD
    
    style LB fill:#f9f,color:#000
    style PG fill:#dfd,color:#000
    style RD fill:#dfd,color:#000
```

---

## Summary

This document contains **40+ diagrams** covering:

1. System Architecture (2 diagrams)
2. Service Communication Flow (2 diagrams)
3. Database Schema (2 diagrams)
4. API Request Flow (2 diagrams)
5. Authentication Flow (2 diagrams)
6. Query Execution Flow (1 diagram)
7. Real-time Data Flow (1 diagram)
8. Storage Architecture (1 diagram)
9. Edge Functions Execution (1 diagram)
10. AI/Vector Search Pipeline (1 diagram)
11. Job Queue Architecture (1 diagram)
12. Connection Pooling (1 diagram)
13. Observability Stack (1 diagram)
14. Deployment Architecture (1 diagram)

**All diagrams available in:**
- Mermaid format (in source)
- ASCII art (in this document)
- PNG images (in `diagrams/` folder)
