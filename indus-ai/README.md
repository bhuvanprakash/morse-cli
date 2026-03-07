# indus-ai

AI-native vector search and embeddings service built on pgvector. Stores embeddings in PostgreSQL, supports semantic search, RAG pipelines, and plugs into any embedding model (OpenAI, Cohere, or local via Ollama).

## Overview

indus-ai is a Rust 2021 microservice that provides:

- **Vector Storage**: Store high-dimensional embeddings in PostgreSQL using pgvector
- **Semantic Search**: Perform cosine similarity search using SQL operators
- **Multi-Provider Support**: OpenAI, Cohere, or local Ollama models
- **RAG Pipelines**: Full document ingestion and retrieval for AI applications

## Features

- RESTful API for collections and documents management
- Semantic search with configurable similarity thresholds
- Support for multiple embedding providers
- JWT authentication middleware
- Comprehensive health checks
- Multi-stage Docker build for production deployment

## Prerequisites

- PostgreSQL 15+ with pgvector extension
- Rust 1.75+ (for local development)
- Docker (for containerized deployment)

## Setup

### Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8007

# Database Configuration
DATABASE_URL=postgres://user:password@localhost:5432/indusbase

# JWT Configuration (for auth middleware)
JWT_SECRET=your-secret-key

# Embedding Provider Configuration
EMBEDDING_PROVIDER=openai  # Options: openai, cohere, local

# OpenAI Configuration (if using OpenAI)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=text-embedding-3-small

# Cohere Configuration (if using Cohere)
COHERE_API_KEY=...
COHERE_MODEL=embed-multilingual-v3.0

# Ollama Configuration (if using local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=nomic-embed-text
```

### Database Setup

Ensure your PostgreSQL database has the pgvector extension enabled. The service will automatically create the required schema on startup.

## Provider Setup

### OpenAI

Uses `text-embedding-3-small` by default (1536 dimensions). Set environment variables:

```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=text-embedding-3-small
```

### Cohere (Recommended for India)

Uses `embed-multilingual-v3.0` which supports Hindi and all Indic languages. Set environment variables:

```env
EMBEDDING_PROVIDER=cohere
COHERE_API_KEY=...
COHERE_MODEL=embed-multilingual-v3.0
```

### Ollama (Local)

Run local embedding models. Install Ollama and pull the model:

```bash
ollama pull nomic-embed-text
```

Set environment variables:

```env
EMBEDDING_PROVIDER=local
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=nomic-embed-text
```

## API Reference

### Health Check

```
GET /health
```

Returns service health status.

### Collections

#### List Collections

```
GET /ai/collections
```

Returns all collections.

#### Create Collection

```
POST /ai/collections
Content-Type: application/json

{
  "name": "my-collection",
  "description": "My document collection"
}
```

#### Delete Collection

```
DELETE /ai/collections/:name
```

### Documents

#### Upsert Documents

```
POST /ai/collections/:name/documents
Content-Type: application/json

{
  "documents": [
    {
      "id": "doc-1",
      "content": "The capital of France is Paris",
      "metadata": {"category": "geography"}
    }
  ]
}
```

#### Get Document

```
GET /ai/collections/:name/documents/:id
```

#### Delete Document

```
DELETE /ai/collections/:name/documents/:id
```

### Search

#### Semantic Search

```
POST /ai/collections/:name/search
Content-Type: application/json

{
  "query": "What is the capital of France?",
  "limit": 10,
  "min_similarity": 0.7,
  "filter": {"category": "geography"}
}
```

Response:

```json
{
  "results": [
    {
      "id": "doc-1",
      "content": "The capital of France is Paris",
      "metadata": {"category": "geography"},
      "similarity": 0.95,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Embeddings

#### Generate Embeddings

```
POST /ai/embed
Content-Type: application/json

{
  "texts": ["Hello world", "How are you?"]
}
```

Response:

```json
{
  "embeddings": [
    [0.1, 0.2, ...],
    [0.3, 0.4, ...]
  ],
  "model": "text-embedding-3-small",
  "dimensions": 1536
}
```

## RAG Example

Here's a complete RAG (Retrieval-Augmented Generation) pipeline example:

```bash
# 1. Create a collection
curl -X POST http://localhost:8007/ai/collections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"name": "knowledge-base", "description": "Company knowledge base"}'

# 2. Add documents
curl -X POST http://localhost:8007/ai/collections/knowledge-base/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{
    "documents": [
      {"id": "doc1", "content": "IndusBase is a database platform for AI applications"},
      {"id": "doc2", "content": "PostgreSQL is our primary database with vector support"}
    ]
  }'

# 3. Search for relevant documents
curl -X POST http://localhost:8007/ai/collections/knowledge-base/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{
    "query": "What database does IndusBase use?",
    "limit": 3
  }'

# 4. Use retrieved context with your LLM
# The search results provide relevant context that can be used
# to augment prompts for language models
```

## Authentication

All endpoints except `/health` require JWT authentication. The gateway (indus-gate) handles JWT validation before forwarding requests to indus-ai.

Include the JWT in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Docker Deployment

Build and run with Docker:

```bash
# Build the image
docker build -t indus-ai:latest .

# Run the container
docker run -p 8007:8007 \
  -e DATABASE_URL=postgres://user:password@host:5432/indusbase \
  -e JWT_SECRET=your-secret \
  -e EMBEDDING_PROVIDER=cohere \
  -e COHERE_API_KEY=your-key \
  indus-ai:latest
```

## Architecture

```
┌─────────────┐     JWT      ┌─────────────┐    SQL     ┌─────────────┐
│   Client    │ ───────────► │  indus-gate  │ ─────────► │  indus-ai   │
└─────────────┘              └─────────────┘            └──────┬──────┘
                                                                │
                                                                │ pgvector
                                                                ▼
                                                        ┌─────────────┐
                                                        │ PostgreSQL  │
                                                        └─────────────┘
```

## Development

```bash
# Install dependencies
cargo build

# Run tests
cargo test

# Run with custom environment
cargo run -- --env-file .env

# Check formatting
cargo fmt --check

# Run lints
cargo clippy
```

## License

Proprietary - All rights reserved
