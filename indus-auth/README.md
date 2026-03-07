# Indus Auth

A Go-based authentication microservice for the Indus platform providing user management, JWT authentication, OAuth2 integration, and multi-factor authentication.

## Purpose

Indus Auth handles:
- User registration and authentication
- JWT token generation and validation (RS256)
- OAuth2 login (Google, GitHub)
- Email OTP verification
- Passkey/WebAuthn support (planned)
- Session management
- Admin user management

## Local Setup

### Prerequisites

- Go 1.23+
- PostgreSQL 15+
- Redis 7+
- Make (optional)

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `8001` |
| `ENV` | Environment (dev/staging/prod) | `dev` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/indus_auth?sslmode=disable` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `JWT_PRIVATE_KEY` | RSA private key for signing | (required) |
| `JWT_PUBLIC_KEY` | RSA public key for verification | (required) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | (optional) |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | (optional) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | (optional) |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | (required) |
| `SMTP_PASSWORD` | SMTP password | (required) |
| `OTP_TTL_MINUTES` | OTP expiration time | `10` |
| `ACCESS_TOKEN_TTL` | Access token expiration | `15m` |
| `REFRESH_TOKEN_TTL` | Refresh token expiration | `7d` |

### Quick Start

```bash
# 1. Clone and navigate
cd indus-auth

# 2. Install dependencies
go mod download

# 3. Set up environment
cp .env.example .env
# Edit .env with your credentials

# 4. Run migrations
go run cmd/migrate/main.go up

# 5. Start the server
go run cmd/server/main.go
```

### Docker

```bash
# Build and run
docker build -t indus-auth .
docker run -p 8001:8001 --env-file .env indus-auth
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/signin` | Login with email/password |
| POST | `/auth/signout` | Logout and invalidate session |
| POST | `/auth/verify-otp` | Verify email OTP |
| POST | `/auth/refresh` | Refresh access token |

### OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/oauth/google` | Initiate Google OAuth |
| GET | `/auth/oauth/google/callback` | Google OAuth callback |
| GET | `/auth/oauth/github` | Initiate GitHub OAuth |
| GET | `/auth/oauth/github/callback` | GitHub OAuth callback |

### Passkey (WebAuthn)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/passkey/register/begin` | Start passkey registration |
| POST | `/auth/passkey/register/finish` | Complete passkey registration |
| GET | `/auth/passkey/login/begin` | Start passkey login |
| POST | `/auth/passkey/login/finish` | Complete passkey login |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/user` | Get current user |
| PATCH | `/auth/user` | Update user profile |
| DELETE | `/auth/user` | Delete account |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List all users |
| GET | `/admin/users/:id` | Get user by ID |
| PATCH | `/admin/users/:id` | Update user (admin) |
| DELETE | `/admin/users/:id` | Delete user (admin) |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/health/ready` | Readiness probe |

## Connections

### Upstream Services
- **PostgreSQL**: Primary data store for users, sessions, OAuth accounts
- **Redis**: OTP codes, session cache, rate limiting
- **SMTP**: Email delivery for OTP and notifications

### Downstream Services
- **indus-gate**: API gateway routes auth requests here
- **indus-core**: Core business service validates tokens

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  indus-gate │────▶│  indus-auth │────▶│  PostgreSQL │
│  (Gateway)  │     │  (This svc) │     └─────────────┘
└─────────────┘     └──────┬──────┘
                           │       ┌─────────────┐
                           └──────▶│    Redis    │
                                   └─────────────┘
```

## Development

```bash
# Run tests
go test ./...

# Run with live reload (requires air)
air

# Run linter
golangci-lint run

# Generate JWT keys
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

## License

MIT