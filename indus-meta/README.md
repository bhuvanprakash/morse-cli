# indus-meta

A Go 1.23 Metadata Management API microservice for managing PostgreSQL database metadata including schemas, tables, columns, indexes, roles, extensions, functions, RLS policies, and migrations.

## Purpose

indus-meta provides a RESTful API for database administrators and applications to programmatically manage PostgreSQL metadata structures. It serves as the internal metadata management layer for the IndusBase platform, handling all DDL operations and schema migrations.

## Architecture

- **Language**: Go 1.23
- **Framework**: Gin
- **Database**: PostgreSQL (via sqlx)
- **Port**: 8003
- **Auth**: Internal-only (verified from indus-gate)

## Local Setup

### Prerequisites

- Go 1.23+
- PostgreSQL 14+
- Make (optional)

### Environment Variables

Create a `.env` file:

```bash
# Database
DATABASE_URL=postgres://user:password@localhost:5432/indus_meta?sslmode=disable

# Server
PORT=8003

# Internal Auth
INTERNAL_AUTH_SECRET=your-internal-secret-key
```

### Running Locally

```bash
# Install dependencies
go mod download

# Run the server
go run cmd/server/main.go
```

### Running with Docker

```bash
# Build the image
docker build -t indus-meta .

# Run the container
docker run -p 8003:8003 --env-file .env indus-meta
```

## API Endpoints

### Schemas
- `GET /meta/schemas` - List all schemas
- `POST /meta/schemas` - Create a new schema
- `DELETE /meta/schemas/:name` - Drop a schema

### Tables
- `GET /meta/tables` - List tables (optionally filter by schema)
- `POST /meta/tables` - Create a new table
- `PATCH /meta/tables/:schema/:name` - Alter a table
- `DELETE /meta/tables/:schema/:name` - Drop a table

### Columns
- `GET /meta/columns/:schema/:table` - List columns for a table
- `POST /meta/columns/:schema/:table` - Add a column
- `PATCH /meta/columns/:schema/:table/:column` - Alter a column
- `DELETE /meta/columns/:schema/:table/:column` - Drop a column

### Indexes
- `GET /meta/indexes/:schema/:table` - List indexes
- `POST /meta/indexes` - Create an index
- `DELETE /meta/indexes/:schema/:name` - Drop an index

### Roles
- `GET /meta/roles` - List all roles
- `POST /meta/roles` - Create a role
- `PATCH /meta/roles/:name` - Alter a role
- `DELETE /meta/roles/:name` - Drop a role
- `POST /meta/roles/:name/grant` - Grant privileges

### Extensions
- `GET /meta/extensions` - List available/enabled extensions
- `POST /meta/extensions` - Enable an extension
- `DELETE /meta/extensions/:name` - Disable an extension

### Functions
- `GET /meta/functions/:schema` - List functions
- `POST /meta/functions` - Create a function
- `DELETE /meta/functions/:schema/:name` - Drop a function

### RLS Policies
- `GET /meta/policies/:schema/:table` - List RLS policies
- `POST /meta/policies` - Create a policy
- `PATCH /meta/policies/:schema/:table/:name` - Alter a policy
- `DELETE /meta/policies/:schema/:table/:name` - Drop a policy

### Migrations
- `GET /meta/migrations` - Get migration history
- `POST /meta/migrations/run` - Run a migration
- `POST /meta/migrations/rollback` - Rollback a migration

### Query
- `POST /meta/query` - Execute raw SQL (read-only or DDL)

## Connections

### Internal Services
- **indus-gate**: Receives proxied requests with internal auth headers
- **indus-pool**: May reference for connection pooling metadata

### External Dependencies
- **PostgreSQL**: Primary metadata store

## Testing

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific test file
go test ./tests -run TestTables
```

## CI/CD

GitHub Actions workflow includes:
- Build verification
- Unit tests (`go test`)
- Linting (`golangci-lint`)

## License

MIT