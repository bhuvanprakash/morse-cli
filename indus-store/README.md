# indus-store

S3-compatible object storage API with PostgreSQL metadata. Part of the IndusBase platform.

## Features

- **Bucket Management**: Create, configure, and manage storage buckets
- **Object Storage**: Upload, download, and delete files
- **Access Control**: Public/private buckets with JWT-based authentication
- **Signed URLs**: Generate temporary access URLs for secure sharing
- **Storage Backends**: Local filesystem or S3/MinIO compatible storage
- **MIME Type Filtering**: Configure allowed file types per bucket
- **Size Limits**: Per-bucket file size restrictions

## Architecture

```
┌─────────────────┐
│  indus-store    │  Object Storage Service
│  (Go/Gin)       │
├─────────────────┤
│  REST API       │  /storage/v1/*
│  JWT Auth       │  ECDSA signature validation
│  Signed URLs    │  HMAC-SHA256 tokens
├─────────────────┤
│  PostgreSQL     │  Bucket & object metadata
│  Local/S3       │  File storage backend
└─────────────────┘
```

## Quick Start

### Prerequisites

- Go 1.23+
- PostgreSQL 14+
- (Optional) S3/MinIO for remote storage

### Environment Variables

```bash
# Required
export DATABASE_URL="postgres://user:pass@localhost:5432/indus_store?sslmode=disable"
export INTERNAL_SECRET="your-internal-secret-for-signing"
export JWT_PUBLIC_KEY_PATH="/path/to/jwt-public-key.pem"

# Server
export SERVER_PORT="8080"

# Storage Backend (local or s3)
export STORAGE_BACKEND="local"
export LOCAL_STORAGE_PATH="/data/storage"

# S3/MinIO (when STORAGE_BACKEND=s3)
export S3_ENDPOINT="http://localhost:9000"
export S3_ACCESS_KEY="minioadmin"
export S3_SECRET_KEY="minioadmin"
export S3_BUCKET="indus-storage"
export S3_REGION="us-east-1"

# Limits
export MAX_FILE_SIZE_MB="100"
export SIGNED_URL_EXPIRY_SECS="3600"
```

### Run Locally

```bash
# Install dependencies
go mod download

# Run migrations and start server
go run ./cmd/server
```

### Docker

```bash
# Build image
docker build -t indus-store .

# Run container
docker run -p 8080:8080 \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -e INTERNAL_SECRET="secret" \
  -e JWT_PUBLIC_KEY_PATH="/keys/jwt.pub" \
  -v /path/to/storage:/data/storage \
  -v /path/to/keys:/keys \
  indus-store
```

## API Endpoints

### Health Check

```bash
GET /health
```

### Buckets

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/storage/v1/bucket` | Create bucket |
| GET | `/storage/v1/bucket` | List buckets |
| GET | `/storage/v1/bucket/:id` | Get bucket by ID |
| GET | `/storage/v1/bucket/name/:name` | Get bucket by name |
| PATCH | `/storage/v1/bucket/:id` | Update bucket |
| DELETE | `/storage/v1/bucket/:id` | Delete bucket |

#### Create Bucket

```bash
POST /storage/v1/bucket
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "my-bucket",
  "public": false,
  "allowed_mime_types": ["image/jpeg", "image/png"],
  "file_size_limit": 52428800
}
```

### Objects

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/storage/v1/object/:bucket/*filepath` | Upload object |
| GET | `/storage/v1/object/:bucket/*filepath` | Download object (auth) |
| GET | `/storage/v1/object/public/:bucket/*filepath` | Download object (public) |
| DELETE | `/storage/v1/object/:bucket/*filepath` | Delete object |
| GET | `/storage/v1/object/list/:bucket` | List objects |

#### Upload Object

```bash
POST /storage/v1/object/my-bucket/documents/report.pdf
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data

file: <binary-data>
metadata: key1=value1,key2=value2
```

#### Download Object

```bash
GET /storage/v1/object/my-bucket/documents/report.pdf
Authorization: Bearer <jwt-token>
```

### Signed URLs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/storage/v1/object/sign/:bucket/*filepath` | Generate download URL |
| POST | `/storage/v1/object/sign/upload/:bucket/*filepath` | Generate upload token |
| GET | `/storage/v1/object/authenticated/:bucket/*filepath?token=&expires=` | Access via signed URL |

#### Generate Signed Download URL

```bash
POST /storage/v1/object/sign/my-bucket/documents/report.pdf
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "expires": 3600
}

Response:
{
  "url": "https://host/storage/v1/object/authenticated/...",
  "path": "my-bucket/documents/report.pdf",
  "expires_in": 3600
}
```

## Authentication

The service validates JWT tokens issued by `indus-auth`. Expected claims:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "user",
  "type": "access",
  "exp": 1234567890
}
```

Provide the token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

## Database Schema

### Buckets Table

```sql
CREATE TABLE indusbase_storage.buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    owner_id UUID NOT NULL,
    public BOOLEAN DEFAULT false,
    allowed_mime_types TEXT[],
    file_size_limit BIGINT DEFAULT 52428800,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Objects Table

```sql
CREATE TABLE indusbase_storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id UUID NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner_id UUID NOT NULL,
    size BIGINT NOT NULL,
    mime_type TEXT,
    etag TEXT,
    storage_backend VARCHAR(50),
    storage_path TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bucket_id, name)
);
```

## Testing

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific test
go test -run TestBucketValidation ./tests/

# Benchmarks
go test -bench=. ./tests/
```

## Development

### Project Structure

```
indus-store/
├── cmd/server/          # Application entry point
├── internal/
│   ├── api/            # HTTP server, middleware, routes
│   ├── config/         # Configuration management
│   ├── db/             # Database connection & migrations
│   ├── handlers/       # HTTP handlers
│   ├── models/         # Data models
│   ├── repository/     # Database repositories
│   ├── signing/        # URL signing utilities
│   └── storage/        # Storage backends (local, S3)
├── tests/              # Integration tests
├── Dockerfile
└── go.mod
```

### Adding Migrations

Add new migration files to `internal/db/migrations/` with sequential numbering:

```sql
-- internal/db/migrations/002_add_new_field.sql
ALTER TABLE indusbase_storage.buckets ADD COLUMN new_field TEXT;
```

## License

MIT License - See LICENSE file for details.

## Integration with IndusBase

This service is part of the IndusBase platform:

- `indus-auth`: Authentication service (JWT issuer)
- `indus-store`: Object storage (this service)
- `indus-query`: SQL query service
- `indus-gate`: API gateway
