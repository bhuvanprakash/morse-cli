# indus-query

**Indus Query Service** - A dynamic REST/GraphQL API layer over PostgreSQL.

## Purpose

The Query Service provides auto-generated REST and GraphQL endpoints based on PostgreSQL schema introspection. It supports:

- Dynamic CRUD operations on any PostgreSQL table
- Row Level Security (RLS) integration
- JWT-based authentication
- Query filtering, pagination, and sorting
- GraphQL schema generation

## Local Setup

### Prerequisites

- Rust 1.75+
- PostgreSQL 14+
- Docker (optional)

### Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=8002
HOST=0.0.0.0
RUST_LOG=info

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/indus

# JWT
JWT_SECRET=your-secret-key
JWT_ISSUER=indus-auth

# Schema Cache
SCHEMA_CACHE_TTL=300
```

### Running Locally

```bash
# Install dependencies and build
cargo build

# Run migrations (if needed)
sqlx migrate run

# Start the server
cargo run
```

The service will be available at `http://localhost:8002`.

## API Endpoints

### Health Check

```bash
GET /health
```

### REST API

The REST API provides dynamic endpoints based on your database schema:

```bash
# List records
GET /rest/{table}?select=*,col1,col2&filter=col1:eq:value&page=1&limit=20

# Get single record
GET /rest/{table}/{id}

# Create record
POST /rest/{table}
Body: { "col1": "value1", "col2": "value2" }

# Update record
PATCH /rest/{table}/{id}
Body: { "col1": "new_value" }

# Delete record
DELETE /rest/{table}/{id}
```

### GraphQL

```bash
POST /graphql
Content-Type: application/json

{
  "query": "query { users { id name email } }"
}
```

GraphQL Playground available at `/graphiql`.

## Connections

### Database

- **PostgreSQL**: Primary data store with RLS support
- **Connection Pool**: Configurable via `DATABASE_URL`

### Upstream Services

- **indus-auth**: JWT validation and claims extraction
- **indus-gate**: API Gateway routing

### Downstream Services

- **PostgreSQL**: Schema introspection and query execution

## Architecture

```
┌─────────────┐
│  indus-gate │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ indus-query │◄────┐
└──────┬──────┘     │
       │            │
       ▼            │
  ┌─────────┐       │
  │PostgreSQL│── Schema Cache
  └─────────┘
```

## Development

```bash
# Run tests
cargo test

# Run with hot reload (requires cargo-watch)
cargo watch -x run

# Format code
cargo fmt

# Run linter
cargo clippy -- -D warnings

# Run benchmarks
cargo bench
```

## License

MIT