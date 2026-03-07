# Contributing to IndusBase

Thank you for your interest in contributing to IndusBase! This document provides guidelines for contributing to our monorepo.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Pull Request Process](#pull-request-process)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Service-Specific Guidelines](#service-specific-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** (>= 24.0) and **Docker Compose** (>= 2.20)
- **Make**
- **Git**

Optional (for local development without Docker):

- **Go** (>= 1.23)
- **Rust** (>= 1.75)
- **Zig** (>= 0.14.0)
- **Node.js** (>= 20)
- **Gleam** (>= 1.5.0)

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/indusbase/indusbase.git
cd indusbase

# Run the setup script
./scripts/setup.sh
```

The setup script will:
1. Check for required dependencies
2. Create `.env` from `.env.example`
3. Generate TLS certificates (if needed)
4. Build all services

## Development Setup

### Repository Structure

```
indusbase/
├── indus-gate/      # Zig - Edge gateway/proxy
├── indus-auth/      # Go - Authentication service
├── indus-query/     # Rust - Query engine
├── indus-pool/      # Rust - Connection pooler
├── indus-meta/      # Go - Metadata service
├── indus-live/      # Gleam - Realtime WebSocket engine
├── indus-store/     # Go - Storage service
├── indus-studio/    # SvelteKit - Web UI
├── cli/             # Go - CLI tool
├── scripts/         # Utility scripts
├── docker-compose.yml
└── Makefile
```

### Running Services

```bash
# Start all services with Docker Compose
docker compose up -d

# Or use Make
dev-up

# View logs
docker compose logs -f [service-name]

# Stop all services
docker compose down
```

### Working on Individual Services

Each service can be developed independently. Refer to the `README.md` in each service directory for specific instructions.

```bash
# Example: Working on indus-auth
cd indus-auth
go mod download
go run ./...
```

## Branch Naming Conventions

All branches should follow this naming pattern:

```
<type>/<service>/<description>
```

### Types

- `feature` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `test` - Test-related changes
- `chore` - Maintenance tasks

### Examples

```
feature/auth/oauth-github
fix/query/sql-injection
docs/gate/readme-update
refactor/pool/connection-handling
test/meta/unit-tests
chore/deps/update-go-mod
```

## Pull Request Process

### Before Creating a PR

1. **Update your branch** with the latest `main`
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run tests** for affected services
   ```bash
   # Run tests for a specific service
   make test-auth
   
   # Or run all tests
   make test-all
   ```

3. **Run linters**
   ```bash
   make lint-all
   ```

4. **Verify your changes** work with Docker Compose
   ```bash
   docker compose up -d --build
   ```

### PR Requirements

1. **Title format**: `[service] Description` (e.g., `[auth] Add OAuth2 support`)
2. **Description**: Include:
   - What changed and why
   - How to test the changes
   - Any breaking changes
3. **Tests**: Add tests for new functionality
4. **Documentation**: Update relevant documentation
5. **Changelog**: Add entry to CHANGELOG.md if applicable

### PR Review Process

1. All PRs require at least **2 approvals** from code owners
2. CI checks must pass
3. Branch must be up to date with `main`
4. Squash and merge strategy is used

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Formatting (no code change)
- `refactor` - Code restructuring
- `perf` - Performance improvement
- `test` - Adding tests
- `chore` - Maintenance

### Scope

Use service name or `*` for multiple services:

```
feat(auth): add JWT refresh token support
fix(query): resolve race condition in connection pool
docs(*): update API documentation
```

### Examples

```
feat(gate): implement rate limiting middleware

Add token bucket rate limiter with configurable limits
per endpoint and per user.

Closes #123
```

## Service-Specific Guidelines

### Go Services (auth, meta, store, cli)

- Follow [Effective Go](https://golang.org/doc/effective_go)
- Run `gofmt` and `golangci-lint`
- Write table-driven tests
- Use `testify` for assertions

```bash
# Lint
golangci-lint run

# Test
go test -v ./...

# Format
gofmt -w .
```

### Rust Services (query, pool)

- Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Run `clippy` and `rustfmt`
- Use `cargo test` for testing

```bash
# Lint
cargo clippy -- -D warnings

# Format
cargo fmt

# Test
cargo test
```

### Zig Service (gate)

- Follow [Zig Style Guide](https://ziglang.org/documentation/master/
- Run `zig fmt`

```bash
# Build
zig build

# Test
zig build test

# Format
zig fmt src/
```

### Gleam Service (live)

- Follow [Gleam Style Guide](https://gleam.run/book/tour/)

```bash
# Build
gleam build

# Test
gleam test

# Format
gleam format
```

### SvelteKit Service (studio)

- Use TypeScript for all new code
- Follow existing component patterns
- Run `svelte-check` for type checking

```bash
# Install dependencies
npm ci

# Type check
npm run check

# Build
npm run build
```

## Testing

### Unit Tests

Each service should have unit tests:

```bash
# Go
go test ./...

# Rust
cargo test

# Gleam
gleam test

# Zig
zig build test
```

### Integration Tests

Run full integration tests:

```bash
./scripts/test-e2e.sh
```

This script:
1. Starts all services via Docker Compose
2. Waits for health checks
3. Runs E2E tests
4. Cleans up

### Adding E2E Tests

E2E tests are located in `tests/e2e/`. Add new tests following the existing patterns.

## Documentation

- Update `README.md` if you change setup or usage instructions
- Add inline comments for complex logic
- Update API documentation for endpoint changes
- Add examples for new features

### Documentation Locations

- Service-level: `indus-*/README.md`
- API docs: `docs/api/`
- Architecture: `docs/architecture/`

## Questions?

- Open an issue for bugs or feature requests
- Join our [Discord](https://discord.gg/indusbase) for discussions
- Check existing issues and PRs before creating new ones

---

Thank you for contributing to IndusBase! 🚀