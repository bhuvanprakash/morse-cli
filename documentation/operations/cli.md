# CLI - Developer Command Line Interface

> The official CLI tool for IndusBase local development and deployment (Go)

## Installation

```bash
# Build from source
make build

# Install to /usr/local/bin
make install
```

## Commands

### `indus init`

Initialize a new IndusBase project with interactive prompts.

```bash
indus init
```

Creates:
- `indusbase.yaml` - Project configuration
- `migrations/` - Database migrations folder
- `docker-compose.override.yml` - Docker override template

### `indus start`

Start all IndusBase services.

```bash
indus start
```

- Checks for docker-compose.yml
- Pulls images if needed
- Starts services with health checks
- Displays service URLs

### `indus stop`

Stop all IndusBase services.

```bash
indus stop
indus stop --volumes  # Also remove volumes
```

### `indus logs`

View service logs.

```bash
indus logs              # All services
indus logs postgres     # Specific service
indus logs --tail 100  # Last 100 lines
```

### `indus db`

Database management commands.

```bash
indus db reset     # Truncate all user tables
indus db migrate   # Run migrations
indus db seed      # Run seed script
indus db psql      # Open psql console
```

### `indus deploy`

Deploy to IndusBase Cloud (coming soon).

```bash
indus deploy
```

Requires `INDUSBASE_DEPLOY_TOKEN` environment variable.

### `indus login`

Authenticate with IndusBase Cloud.

```bash
indus login
```

Opens browser for OAuth authentication and saves token to `~/.indus/token`.

### `indus logout`

Sign out and remove local credentials.

```bash
indus logout
```

### `indus whoami`

Display current user.

```bash
indus whoami
```

### `indus projects`

List your projects.

```bash
indus projects
```

### `indus keys`

Manage API keys.

```bash
indus keys list          # List keys
indus keys create        # Create new key
indus keys delete <key>  # Delete a key
```

### `indus functions`

Manage edge functions.

```bash
indus functions list     # List functions
indus functions deploy   # Deploy functions
indus functions invoke   # Invoke function locally
```

### `indus ssl`

Manage SSL certificates.

```bash
indus ssl list           # List certificates
indus ssl add domain.crt # Add certificate
indus ssl remove domain  # Remove certificate
```

## Configuration

### indusbase.yaml

```yaml
project:
  name: my-project
  version: 1.0.0

database:
  name: myproject_db
  host: localhost
  port: 5432

services:
  studio:
    port: 3000
  auth:
    port: 8080
  query:
    port: 8081
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `INDUSBASE_DEPLOY_TOKEN` | Deployment token for IndusBase Cloud |
| `DOCKER_HOST` | Docker daemon socket |
| `INDUSBASE_URL` | IndusBase API URL |

## Development

```bash
# Run tests
make test

# Format code
make fmt

# Run linter
make lint

# Clean build artifacts
make clean
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `indus` | Show help |
| `indus --version` | Show version |
| `indus init` | Initialize project |
| `indus start` | Start services |
| `indus stop` | Stop services |
| `indus logs` | View logs |
| `indus db` | Database commands |
| `indus login` | Authenticate |
| `indus deploy` | Deploy to cloud |

## License

MIT License
