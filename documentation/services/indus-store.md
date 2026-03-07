# indus-store - Object Storage

> S3-compatible object storage API with PostgreSQL metadata (Go)

## Overview

`indus-store` is a Go microservice that provides S3-compatible object storage with PostgreSQL for metadata. It supports bucket management, object uploads/downloads, signed URLs, and multiple storage backends.

## Features

- **Bucket Management**: Create, configure, and manage storage buckets
- **Object Storage**: Upload, download, and delete files
- **Access Control**: Public/private buckets with JWT-based authentication
- **Signed URLs**: Generate temporary access URLs for secure sharing
- **Storage Backends**: Local filesystem or S3/MinIO compatible storage
- **MIME Type Filtering**: Configure allowed file types per bucket
- **Size Limits**: Per-bucket file size restrictions

## Architecture

```mermaid
graph TB
    subgraph "indus-store"
        API["REST API<br/>:8080"]
        AUTH["JWT Auth"]
        STORAGE["Storage<br/>Backend"]
    end
    
    CLIENT((Client)) --> API
    API --> AUTH
    AUTH --> STORAGE
    STORAGE --> |metadata| DB[(PostgreSQL)]
    
    style API fill:#f9f,color:#000
    style AUTH fill:#bbf,color:#000
    style STORAGE fill:#dfd,color:#000
```

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

### Buckets

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/storage/v1/bucket` | Create bucket |
| GET | `/storage/v1/bucket` | List buckets |
| GET | `/storage/v1/bucket/:id` | Get bucket by ID |
| GET | `/storage/v1/bucket/name/:name` | Get bucket by name |
| PATCH | `/storage/v1/bucket/:id` | Update bucket |
| DELETE | `/storage/v1/bucket/:id` | Delete bucket |

### Objects

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/storage/v1/object/:bucket/*filepath` | Upload object |
| GET | `/storage/v1/object/:bucket/*filepath` | Download object (auth) |
| GET | `/storage/v1/object/public/:bucket/*filepath` | Download object (public) |
| DELETE | `/storage/v1/object/:bucket/*filepath` | Delete object |
| GET | `/storage/v1/object/list/:bucket` | List objects |

### Signed URLs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/storage/v1/object/sign/:bucket/*filepath` | Generate download URL |
| POST | `/storage/v1/object/sign/upload/:bucket/*filepath` | Generate upload token |
| GET | `/storage/v1/object/authenticated/:bucket/*filepath` | Access via signed URL |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `8080` | HTTP server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `INTERNAL_SECRET` | - | Internal API secret |
| `JWT_PUBLIC_KEY_PATH` | - | Path to JWT public key |
| `STORAGE_BACKEND` | `local` | Storage backend (local/s3) |
| `LOCAL_STORAGE_PATH` | `/data/storage` | Local storage path |
| `S3_ENDPOINT` | - | S3/MinIO endpoint |
| `S3_ACCESS_KEY` | - | S3 access key |
| `S3_SECRET_KEY` | - | S3 secret key |
| `S3_BUCKET` | - | S3 bucket name |
| `S3_REGION` | `us-east-1` | S3 region |
| `MAX_FILE_SIZE_MB` | `100` | Max file size in MB |
| `SIGNED_URL_EXPIRY_SECS` | `3600` | Signed URL expiry |

## Quick Start

```bash
# Run the server
go run ./cmd/server

# Docker
docker build -t indus-store .
docker run -p 8080:8080 \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -e STORAGE_BACKEND=local \
  -v /path/to/storage:/data/storage \
  indus-store
```

## Example Usage

### Create Bucket

```bash
curl -X POST http://localhost:8080/storage/v1/bucket \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-bucket",
    "public": false,
    "allowed_mime_types": ["image/jpeg", "image/png"],
    "file_size_limit": 52428800
  }'
```

### Upload File

```bash
curl -X POST http://localhost:8080/storage/v1/object/my-bucket/documents/report.pdf \
  -H "Authorization: Bearer <jwt-token>" \
  -F "file=@/path/to/report.pdf"
```

### Generate Signed URL

```bash
curl -X POST http://localhost:8080/storage/v1/object/sign/my-bucket/documents/report.pdf \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"expires": 3600}'
```

Response:
```json
{
  "url": "https://host/storage/v1/object/authenticated/...",
  "path": "my-bucket/documents/report.pdf",
  "expires_in": 3600
}
```

### Download Public File

```bash
curl -O http://localhost:8080/storage/v1/object/public/my-bucket/avatar.png
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

## Storage Backends

### Local Storage

```bash
export STORAGE_BACKEND=local
export LOCAL_STORAGE_PATH=/data/storage
```

### S3/MinIO

```bash
export STORAGE_BACKEND=s3
export S3_ENDPOINT=http://localhost:9000
export S3_ACCESS_KEY=minioadmin
export S3_SECRET_KEY=minioadmin
export S3_BUCKET=indus-storage
export S3_REGION=us-east-1
```

## License

MIT License
