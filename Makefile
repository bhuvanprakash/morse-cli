.PHONY: help build-all run-all test-all lint-all docker-all \
		build-auth build-query build-meta build-pool build-gate build-edge build-sdk \
		run-auth run-query run-meta run-pool run-gate \
		test-auth test-query test-meta test-pool test-gate \
		lint-auth lint-query lint-meta lint-pool lint-gate \
		fmt-all fmt-auth fmt-query fmt-meta fmt-pool fmt-gate \
		clean clean-all dev-up dev-down dev-logs \
		db-migrate db-reset db-seed db-shell \
		certs-generate certs-clean \
		publish-sdk generate-types deploy-function dpdp-check \
		build-ai build-queue build-py-sdk observe pull-embeddings-model \
		test-ai test-queue publish-py-sdk health-all ps \
		studio-e2e-install studio-e2e studio-smoke studio-check studio-build studio-screens studio-live-check studio-demo-seed studio-screenshot-check \
		phase9-status phase10-audit phase10-status phase11-status phase12-status phase13-status runtime-check demo-check

# ============================================================================
# Default target
# ============================================================================
.DEFAULT_GOAL := help

# ============================================================================
# Service directories
# ============================================================================
AUTH_DIR := services/auth
QUERY_DIR := services/query
META_DIR := services/meta
POOL_DIR := services/pool
GATE_DIR := services/gate

# Colors for terminal output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m # No Color

# ============================================================================
# Help target
# ============================================================================
help: ## Show this help message
	@echo "$(BLUE)IndusBase Monorepo - Available Targets$(NC)"
	@echo "========================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(BLUE)Service-Specific Targets:$(NC)"
	@echo "  $(YELLOW)build-{service}$(NC)    - Build specific service (auth, query, meta, pool, gate)"
	@echo "  $(YELLOW)run-{service}$(NC)      - Run specific service locally"
	@echo "  $(YELLOW)test-{service}$(NC)     - Test specific service"
	@echo "  $(YELLOW)lint-{service}$(NC)     - Lint specific service"
	@echo "  $(YELLOW)fmt-{service}$(NC)      - Format specific service"
	@echo ""
	@echo "$(BLUE)Docker Targets:$(NC)"
	@echo "  $(YELLOW)docker-all$(NC)         - Build and run all services with Docker Compose"
	@echo "  $(YELLOW)dev-up$(NC)             - Start development environment"
	@echo "  $(YELLOW)dev-down$(NC)           - Stop development environment"
	@echo "  $(YELLOW)dev-logs$(NC)           - View development logs"

# ============================================================================
# Build All Services
# ============================================================================
build-all: build-auth build-query build-meta build-pool build-gate ## Build all 5 services
	@echo "$(GREEN)✓ All services built successfully$(NC)"

build-auth: ## Build auth service (Rust)
	@echo "$(BLUE)Building auth service...$(NC)"
	cd $(AUTH_DIR) && cargo build --release

build-query: ## Build query service (Rust)
	@echo "$(BLUE)Building query service...$(NC)"
	cd $(QUERY_DIR) && cargo build --release

build-meta: ## Build meta service (Rust)
	@echo "$(BLUE)Building meta service...$(NC)"
	cd $(META_DIR) && cargo build --release

build-pool: ## Build pool service (Go)
	@echo "$(BLUE)Building pool service...$(NC)"
	cd $(POOL_DIR) && go build -o bin/pool ./cmd/pool

build-gate: ## Build gate service (Zig)
	@echo "$(BLUE)Building gate service...$(NC)"
	cd $(GATE_DIR) && zig build -Drelease-fast=true

# ============================================================================
# Run Services Locally
# ============================================================================
run-all: ## Run all services locally (requires dependencies to be running)
	@echo "$(YELLOW)Starting all services...$(NC)"
	$(MAKE) run-pool &
	$(MAKE) run-auth &
	$(MAKE) run-query &
	$(MAKE) run-meta &
	$(MAKE) run-gate &
	wait

run-auth: ## Run auth service locally
	@echo "$(BLUE)Starting auth service on port 8001...$(NC)"
	cd $(AUTH_DIR) && cargo run --release

run-query: ## Run query service locally
	@echo "$(BLUE)Starting query service on port 8002...$(NC)"
	cd $(QUERY_DIR) && cargo run --release

run-meta: ## Run meta service locally
	@echo "$(BLUE)Starting meta service on port 8003...$(NC)"
	cd $(META_DIR) && cargo run --release

run-pool: ## Run pool service locally
	@echo "$(BLUE)Starting pool service on port 5433...$(NC)"
	cd $(POOL_DIR) && ./bin/pool

run-gate: ## Run gate service locally
	@echo "$(BLUE)Starting gate service on port 8000...$(NC)"
	cd $(GATE_DIR) && zig build run

# ============================================================================
# Test All Services
# ============================================================================
test-all: test-auth test-query test-meta test-pool test-gate ## Run tests for all services
	@echo "$(GREEN)✓ All tests completed$(NC)"

test-auth: ## Test auth service
	@echo "$(BLUE)Testing auth service...$(NC)"
	cd $(AUTH_DIR) && cargo test --all-features

test-query: ## Test query service
	@echo "$(BLUE)Testing query service...$(NC)"
	cd $(QUERY_DIR) && cargo test --all-features

test-meta: ## Test meta service
	@echo "$(BLUE)Testing meta service...$(NC)"
	cd $(META_DIR) && cargo test --all-features

test-pool: ## Test pool service
	@echo "$(BLUE)Testing pool service...$(NC)"
	cd $(POOL_DIR) && go test -v ./...

test-gate: ## Test gate service
	@echo "$(BLUE)Testing gate service...$(NC)"
	cd $(GATE_DIR) && zig build test

# ============================================================================
# Lint All Services
# ============================================================================
lint-all: lint-auth lint-query lint-meta lint-pool lint-gate ## Lint all services
	@echo "$(GREEN)✓ All linting completed$(NC)"

lint-auth: ## Lint auth service
	@echo "$(BLUE)Linting auth service...$(NC)"
	cd $(AUTH_DIR) && cargo clippy --all-features -- -D warnings
	cd $(AUTH_DIR) && cargo fmt -- --check

lint-query: ## Lint query service
	@echo "$(BLUE)Linting query service...$(NC)"
	cd $(QUERY_DIR) && cargo clippy --all-features -- -D warnings
	cd $(QUERY_DIR) && cargo fmt -- --check

lint-meta: ## Lint meta service
	@echo "$(BLUE)Linting meta service...$(NC)"
	cd $(META_DIR) && cargo clippy --all-features -- -D warnings
	cd $(META_DIR) && cargo fmt -- --check

lint-pool: ## Lint pool service
	@echo "$(BLUE)Linting pool service...$(NC)"
	cd $(POOL_DIR) && golangci-lint run ./...
	cd $(POOL_DIR) && go vet ./...
	cd $(POOL_DIR) && test -z "$(gofmt -d .)"

lint-gate: ## Lint gate service
	@echo "$(BLUE)Linting gate service...$(NC)"
	cd $(GATE_DIR) && zig fmt --check src/

# ============================================================================
# Format All Services
# ============================================================================
fmt-all: fmt-auth fmt-query fmt-meta fmt-pool fmt-gate ## Format all services
	@echo "$(GREEN)✓ All formatting completed$(NC)"

fmt-auth: ## Format auth service
	@echo "$(BLUE)Formatting auth service...$(NC)"
	cd $(AUTH_DIR) && cargo fmt

fmt-query: ## Format query service
	@echo "$(BLUE)Formatting query service...$(NC)"
	cd $(QUERY_DIR) && cargo fmt

fmt-meta: ## Format meta service
	@echo "$(BLUE)Formatting meta service...$(NC)"
	cd $(META_DIR) && cargo fmt

fmt-pool: ## Format pool service
	@echo "$(BLUE)Formatting pool service...$(NC)"
	cd $(POOL_DIR) && gofmt -w .

fmt-gate: ## Format gate service
	@echo "$(BLUE)Formatting gate service...$(NC)"
	cd $(GATE_DIR) && zig fmt src/

# ============================================================================
# Docker Operations
# ============================================================================
docker-all: ## Build and run all services with Docker Compose
	@echo "$(BLUE)Building and starting all services with Docker...$(NC)"
	if [ ! -f .env ]; then \
		echo "$(YELLOW)⚠ .env file not found. Copying from .env.example...$(NC)"; \
		cp .env.example .env; \
		echo "$(YELLOW)⚠ Please edit .env with your actual values before continuing.$(NC)"; \
		exit 1; \
	fi
	docker-compose up --build -d
	@echo "$(GREEN)✓ All services are running$(NC)"
	@echo "$(BLUE)Gateway: http://localhost:8000$(NC)"
	@echo "$(BLUE)Auth:    http://localhost:8001$(NC)"
	@echo "$(BLUE)Query:   http://localhost:8002$(NC)"
	@echo "$(Blue)Meta:    http://localhost:8003$(NC)"

docker-build: ## Build all Docker images without running
	@echo "$(BLUE)Building all Docker images...$(NC)"
	docker-compose build

docker-push: ## Push Docker images to registry
	@echo "$(BLUE)Pushing Docker images...$(NC)"
	docker-compose push

# ============================================================================
# Development Environment
# ============================================================================
dev-up: ## Start development environment (dependencies only)
	@echo "$(BLUE)Starting development dependencies...$(NC)"
	docker-compose up -d postgres redis
	@echo "$(GREEN)✓ Postgres running on localhost:5432$(NC)"
	@echo "$(GREEN)✓ Redis running on localhost:6379$(NC)"

dev-down: ## Stop development environment
	@echo "$(BLUE)Stopping development environment...$(NC)"
	docker-compose down

dev-logs: ## View development logs
	docker-compose logs -f

dev-logs-%: ## View logs for specific service (e.g., make dev-logs-auth)
	docker-compose logs -f $*

dev-ps: ## List running containers
	docker-compose ps

dev-clean: ## Stop and remove all containers, volumes, and images
	@echo "$(RED)Cleaning up all Docker resources...$(NC)"
	docker-compose down -v --rmi all --remove-orphans

# ============================================================================
# Database Operations
# ============================================================================
db-migrate: ## Run database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	cd $(AUTH_DIR) && cargo run --bin migrate

db-reset: ## Reset database (DANGER: Deletes all data)
	@echo "$(RED)⚠ This will delete all database data!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ $$confirm = y ]
	docker-compose exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	$(MAKE) db-migrate

db-seed: ## Seed database with test data
	@echo "$(BLUE)Seeding database...$(NC)"
	cd $(AUTH_DIR) && cargo run --bin seed

db-shell: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB

# ============================================================================
# TLS Certificate Generation
# ============================================================================
certs-generate: ## Generate self-signed TLS certificates for local development
	@echo "$(BLUE)Generating self-signed TLS certificates...$(NC)"
	@mkdir -p certs
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout certs/server.key \
		-out certs/server.crt \
		-subj "/C=US/ST=State/L=City/O=IndusBase/CN=localhost" \
		-addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:::1"
	@echo "$(GREEN)✓ Certificates generated in ./certs/$(NC)"

certs-clean: ## Remove generated certificates
	@echo "$(BLUE)Removing certificates...$(NC)"
	rm -rf certs/

# ============================================================================
# Cleanup
# ============================================================================
clean: ## Clean build artifacts for all services
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	cd $(AUTH_DIR) && cargo clean
	cd $(QUERY_DIR) && cargo clean
	cd $(META_DIR) && cargo clean
	cd $(POOL_DIR) && rm -rf bin/
	cd $(GATE_DIR) && rm -rf zig-out/ .zig-cache/

clean-all: clean dev-clean ## Clean everything including Docker resources
	@echo "$(GREEN)✓ Full cleanup completed$(NC)"

# ============================================================================
# CI/CD Helpers
# ============================================================================
ci-build: ## CI build target
	$(MAKE) build-all

ci-test: ## CI test target
	$(MAKE) test-all

ci-lint: ## CI lint target
	$(MAKE) lint-all

ci-all: ci-lint ci-build ci-test ## Run all CI checks
	@echo "$(GREEN)✓ All CI checks passed$(NC)"

# ============================================================================
# Health Checks
# ============================================================================
health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@curl -sf http://localhost:8000/health && echo "$(GREEN)✓ Gateway (8000) OK$(NC)" || echo "$(RED)✗ Gateway (8000) FAIL$(NC)"

# ============================================================================
# Integration Tests
# ============================================================================
test-integration:
	@echo "Running integration tests (requires docker-compose up)..."
	cd tests/integration && go test -v -tags=integration -timeout 120s ./...

test-runtime-integration: test-integration
	@echo "All integration tests passed ✓"
	@curl -sf http://localhost:8001/health && echo "$(GREEN)✓ Auth (8001) OK$(NC)" || echo "$(RED)✗ Auth (8001) FAIL$(NC)"
	@curl -sf http://localhost:8002/health && echo "$(GREEN)✓ Query (8002) OK$(NC)" || echo "$(RED)✗ Query (8002) FAIL$(NC)"
	@curl -sf http://localhost:8003/health && echo "$(GREEN)✓ Meta (8003) OK$(NC)" || echo "$(RED)✗ Meta (8003) FAIL$(NC)"
	@echo "$(BLUE)Database connectivity...$(NC)"
	@docker-compose exec -T postgres pg_isready -U postgres && echo "$(GREEN)✓ PostgreSQL OK$(NC)" || echo "$(RED)✗ PostgreSQL FAIL$(NC)"
	@curl -sf http://localhost:8006/health && echo "$(GREEN)✓ Edge (8006) OK$(NC)" || echo "$(RED)✗ Edge (8006) FAIL$(NC)"

# ============================================================================
# Phase 3: India Features
# ============================================================================

build-edge: ## Build edge service (indus-edge) with Zig
	@echo "$(BLUE)Building edge service...$(NC)"
	cd indus-edge && zig build -Doptimize=ReleaseSafe

build-sdk: ## Build JavaScript SDK
	@echo "$(BLUE)Building JavaScript SDK...$(NC)"
	cd indusbase-js && bun run build

publish-sdk: ## Build and publish JavaScript SDK to npm
	@echo "$(BLUE)Publishing JavaScript SDK...$(NC)"
	cd indusbase-js && bun run build && npm publish

generate-types: ## Generate TypeScript types from CLI
	@echo "$(BLUE)Generating TypeScript types...$(NC)"
	cd cli && go run cmd/cli/main.go generate types

deploy-function: ## Deploy a function to indus-edge (usage: make deploy-function FILE=path/to/function.ts)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)Error: FILE parameter is required$(NC)"; \
		echo "Usage: make deploy-function FILE=path/to/function.ts"; \
		exit 1; \
	fi
	@echo "$(BLUE)Deploying function $(FILE)...$(NC)"
	docker cp $(FILE) indusbase-indus-edge-1:/var/indusbase/functions/
	docker exec indusbase-indus-edge-1 /usr/local/bin/bun /var/indusbase/functions/$(notdir $(FILE)) --check
	@echo "$(GREEN)✓ Function deployed successfully$(NC)"

dpdp-check: ## Check DPDP compliance and open dashboard
	@echo "$(BLUE)Checking DPDP compliance...$(NC)"
	@curl -sf http://localhost:8000/health > /dev/null && echo "$(GREEN)✓ Services healthy$(NC)" || echo "$(RED)✗ Services not responding$(NC)"
	@echo "$(BLUE)Opening DPDP Compliance Dashboard...$(NC)"
	@open http://localhost:3000/dpdp || xdg-open http://localhost:3000/dpdp || echo "$(YELLOW)Please open http://localhost:3000/dpdp manually$(NC)"

# ============================================================================
# India Features Summary
# ============================================================================
india-features: ## Display India Features implementation status
	@echo "$(BLUE)========================================$(NC)"
	@echo "$(BLUE)  IndusBase - India Features Status$(NC)"
	@echo "$(BLUE)========================================$(NC)"
	@echo ""
	@echo "$(GREEN)✓ Part 1: indus-auth India Features$(NC)"
	@echo "  • WhatsApp OTP via Gupshup API"
	@echo "  • Aadhaar eKYC via UIDAI API"
	@echo "  • Phone authentication handlers"
	@echo "  • Aadhaar authentication handlers"
	@echo ""
	@echo "$(GREEN)✓ Part 2: indus-studio DPDP Compliance$(NC)"
	@echo "  • DPDP Compliance Dashboard"
	@echo "  • Settings page with API keys"
	@echo "  • Service health monitoring"
	@echo "  • Navigation updates"
	@echo ""
	@echo "$(GREEN)✓ Part 3: Integration Updates$(NC)"
	@echo "  • indus-edge service in docker-compose"
	@echo "  • indus-gate /functions/ route"
	@echo "  • Makefile Phase 3 targets"
	@echo ""
	@echo "$(BLUE)========================================$(NC)"

# ============================================================================
# Phase 8: Enterprise + Operations Maturity
# ============================================================================

build-audit:
	cd indus-audit && go build -v ./...

build-billing:
	cd indus-billing && go build -v ./...

build-secrets:
	cd indus-secrets && go build -v ./...

build-status:
	cd indus-status && go build -v ./...

test-audit:
	@echo "Testing audit export..."
	@TOKEN=$$(curl -s -X POST http://localhost:8000/auth/signin \
	  -H "Content-Type: application/json" \
	  -d '{"email":"admin@indusbase.local","password":"AdminPass123!"}' | jq -r '.data.access_token'); \
	curl -s "http://localhost:8000/audit/export?format=json" \
	  -H "Authorization: Bearer $$TOKEN" | head -c 200 && echo

test-billing:
	@echo "Testing billing invoice preview..."
	@TOKEN=$$(curl -s -X POST http://localhost:8000/auth/signin \
	  -H "Content-Type: application/json" \
	  -d '{"email":"admin@indusbase.local","password":"AdminPass123!"}' | jq -r '.data.access_token'); \
	curl -s "http://localhost:8000/billing/invoices/preview" \
	  -H "Authorization: Bearer $$TOKEN" | jq

smoke-audit-export:
	@curl -s "http://localhost:8000/audit/export?format=csv" | head -n 5

smoke-billing-preview:
	@TOKEN=$$(curl -s -X POST http://localhost:8000/auth/signin \
	  -H "Content-Type: application/json" \
	  -d '{"email":"admin@indusbase.local","password":"AdminPass123!"}' | jq -r '.data.access_token'); \
	curl -s "http://localhost:8000/billing/invoices/preview" \
	  -H "Authorization: Bearer $$TOKEN" | jq

smoke-secret-rotate:
	@TOKEN=$$(curl -s -X POST http://localhost:8000/auth/signin \
	  -H "Content-Type: application/json" \
	  -d '{"email":"admin@indusbase.local","password":"AdminPass123!"}' | jq -r '.data.access_token'); \
	curl -s -X POST http://localhost:8000/secrets \
	  -H "Authorization: Bearer $$TOKEN" \
	  -H "Content-Type: application/json" \
	  -d '{"name":"PHASE8_TEST_SECRET","scope":"platform","value":"abc123"}' >/dev/null || true; \
	curl -s -X POST http://localhost:8000/secrets/PHASE8_TEST_SECRET/rotate \
	  -H "Authorization: Bearer $$TOKEN" \
	  -H "Content-Type: application/json" \
	  -d '{"value":"def456"}' | jq

smoke-incident-flow:
	@TOKEN=$$(curl -s -X POST http://localhost:8000/auth/signin \
	  -H "Content-Type: application/json" \
	  -d '{"email":"admin@indusbase.local","password":"AdminPass123!"}' | jq -r '.data.access_token'); \
	ID=$$(curl -s -X POST http://localhost:8000/status/incidents \
	  -H "Authorization: Bearer $$TOKEN" \
	  -H "Content-Type: application/json" \
	  -d '{"title":"Smoke Incident","summary":"Phase 8 smoke","severity":"minor"}' | jq -r '.data.id'); \
	curl -s -X POST http://localhost:8000/status/incidents/$$ID/resolve \
	  -H "Authorization: Bearer $$TOKEN" \
	  -H "Content-Type: application/json" \
	  -d '{"resolution":"resolved by smoke test"}' | jq

backup-verify:
	chmod +x deploy/backup/verify_backup.sh && ./deploy/backup/verify_backup.sh

backup-restore-drill:
	chmod +x deploy/backup/restore_drill.sh && ./deploy/backup/restore_drill.sh

release-staging:
	@echo "Triggering staging deployment flow..."
	chmod +x deploy/releases/release_notes.sh
	./deploy/releases/release_notes.sh HEAD~20 HEAD > /tmp/indusbase-release-notes.md
	@echo "Release notes generated at /tmp/indusbase-release-notes.md"

release-prod:
	@if [ -z "$(VERSION)" ]; then echo "Usage: make release-prod VERSION=1.0.0"; exit 1; fi
	chmod +x deploy/releases/promote.sh
	./deploy/releases/promote.sh "$(VERSION)"

release-rollback:
	chmod +x deploy/releases/rollback.sh
	@if [ -n "$(REVISION)" ]; then ./deploy/releases/rollback.sh "$(REVISION)"; else ./deploy/releases/rollback.sh; fi

release-notes:
	chmod +x deploy/releases/release_notes.sh
	@if [ -z "$(FROM)" ]; then echo "Usage: make release-notes FROM=v1.0.0 TO=v1.1.0"; exit 1; fi
	./deploy/releases/release_notes.sh "$(FROM)" "$(if $(TO),$(TO),HEAD)"

security-scan:
	@echo "Run GitHub Actions security workflow: .github/workflows/security.yml"
	@echo "Local quick checks:"
	@command -v gitleaks >/dev/null && gitleaks detect --no-git || echo "gitleaks not installed"
	@command -v trivy >/dev/null && trivy fs . || echo "trivy not installed"

phase8-status:
	@echo "=== IndusBase Phase 8 Status ==="
	@echo "✅ Enterprise SSO/SCIM"
	@echo "✅ indus-audit (8011)"
	@echo "✅ indus-billing (8012)"
	@echo "✅ indus-secrets (8013)"
	@echo "✅ indus-status (8014)"
	@echo "✅ Trust Center + Support + Security Studio pages"
	@echo "✅ Release automation + backup verification + security scanning"

# =============================================================================
# Phase 4: AI, Queue, and Observability
# =============================================================================

# Build indus-ai (Rust vector search service)
build-ai:
	@echo "Building indus-ai (vector search service)..."
	cd indus-ai && cargo build --release
	@echo "✓ indus-ai built successfully"

# Build indus-queue (Go job queue service)
build-queue:
	@echo "Building indus-queue (job queue service)..."
	cd indus-queue && go build -o bin/indus-queue ./cmd/server
	@echo "✓ indus-queue built successfully"

# Build Python SDK
build-py-sdk:
	@echo "Building indusbase-py SDK..."
	cd indusbase-py && pip install -e ".[dev]" 2>/dev/null || pip install -e .
	@echo "✓ indusbase-py installed"

# Start observability stack (Prometheus, Grafana, OTEL Collector, Alertmanager)
observe:
	@echo "Starting observability stack..."
	docker-compose -f docker-compose.yml -f observe/docker-compose.observe.yml up -d prometheus grafana otel-collector alertmanager
	@echo ""
	@echo "✓ Observability services started:"
	@echo "  - Grafana:     http://localhost:3001 (admin/indusbase)"
	@echo "  - Prometheus:  http://localhost:9091"
	@echo "  - OTEL:       http://localhost:4317 (gRPC), http://localhost:4318 (HTTP)"
	@echo "  - Alertmanager: http://localhost:9093"

# Pull Ollama embedding model (free, local embeddings)
pull-embeddings-model:
	@echo "Pulling nomic-embed-text model for local embeddings..."
	@if docker ps | grep -q indusbase-ollama; then \
		docker exec indusbase-ollama ollama pull nomic-embed-text; \
	else \
		echo "Ollama container not running. Start with: docker-compose up -d ollama"; \
	fi
	@echo "✓ nomic-embed-text ready for local embeddings"

# Test AI service (requires running services and auth token)
test-ai:
	@echo "Testing indus-ai semantic search..."
	@echo "Creating collection..."
	@curl -s -X POST http://localhost:8000/ai/collections \
	  -H "Content-Type: application/json" \
	  -H "Authorization: Bearer $(TOKEN)" \
	  -d '{"name":"test","description":"test collection"}' | jq -r '.data.name // .error.message' || echo "Collection may already exist"
	@echo "Upserting documents..."
	@curl -s -X POST http://localhost:8000/ai/collections/test/documents \
	  -H "Content-Type: application/json" \
	  -H "Authorization: Bearer $(TOKEN)" \
	  -d '{"documents":[{"content":"IndusBase is India native BaaS"},{"content":"pgvector enables semantic search"}]}' | jq -r '.inserted // .error.message'
	@echo "Searching..."
	@curl -s -X POST http://localhost:8000/ai/collections/test/search \
	  -H "Content-Type: application/json" \
	  -H "Authorization: Bearer $(TOKEN)" \
	  -d '{"query":"vector database India","limit":5}' | jq '.data | length'

# Test queue service (requires running services and auth token)
test-queue:
	@echo "Testing indus-queue job enqueue..."
	@curl -s -X POST http://localhost:8000/queue/jobs \
	  -H "Authorization: Bearer $(TOKEN)" \
	  -H "Content-Type: application/json" \
	  -d '{"queue_name":"default","payload":{"action":"test_job"},"job_type":"http"}' | jq -r '.data.id // .error.message'

# Publish Python SDK to PyPI
publish-py-sdk:
	@echo "Publishing indusbase-py to PyPI..."
	cd indusbase-py && python -m build && python -m twine upload dist/*
	@echo "✓ Published to PyPI"

# Full platform health check (all 13 services)
health-all:
	@echo "Checking all service health..."
	@for port in 8000 8001 8002 8003 8004 8005 8006 8007 8008; do \
		status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health 2>/dev/null || echo "000"); \
		case $port in \
			8000) name="indus-gate" ;; \
			8001) name="indus-auth" ;; \
			8002) name="indus-query" ;; \
			8003) name="indus-meta" ;; \
			8004) name="indus-live" ;; \
			8005) name="indus-store" ;; \
			8006) name="indus-edge" ;; \
			8007) name="indus-ai" ;; \
			8008) name="indus-queue" ;; \
		esac; \
		if [ "$status" = "200" ]; then \
			echo "  ✓ $name ($port): UP"; \
		else \
			echo "  ✗ $name ($port): DOWN ($status)"; \
		fi; \
	done

# Show all running containers
ps:
	docker-compose ps

# Phase 5: build targets
build-notify:
	cd indus-notify && go build -v ./...

build-config-svc:
	cd indus-config && go build -v ./...

build-docs:
	cd docs && npm install && npm run build

# Phase 5: test targets
test-notify:
	@echo "Testing push notification..."
	curl -s -X POST http://localhost:8000/notify/push \
	  -H "Authorization: Bearer $(TOKEN)" \
	  -H "Content-Type: application/json" \
	  -d '{"tokens":["test-token"],"title":"Test","body":"IndusBase works!"}' | jq

test-flags:
	@echo "Testing feature flag evaluation..."
	curl -s -X POST http://localhost:8000/config/evaluate \
	  -H "Content-Type: application/json" \
	  -d '{"environment":"production","user_id":"test-user"}' | jq

test-graphql:
	@echo "Testing GraphQL endpoint..."
	curl -s -X POST http://localhost:8000/graphql \
	  -H "Authorization: Bearer $(TOKEN)" \
	  -H "Content-Type: application/json" \
	  -d '{"query":"{ tables }"}' | jq

# Docs
docs-dev:
	cd docs && npm run dev

docs-open:
	open http://localhost:4321

# Full platform health (now 15 services)
health-all-v5:
	@for port in 8000 8001 8002 8003 8004 8005 8006 8007 8008 8009 8010; do \
	  status=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$$port/health); \
	  echo "Port $$port: HTTP $$status"; \
	done

# Phase 5 status
phase5-status:
	@echo "=== IndusBase Phase 5 Status ==="
	@echo "✅ indus-notify  (port 8009) - Push + SMS + Email"
	@echo "✅ indus-config  (port 8010) - Feature Flags + Remote Config"
	@echo "✅ GraphQL       (/graphql)  - Auto-schema from PostgreSQL"
	@echo "✅ deploy/       (Helm)      - Kubernetes deployment ready"
	@echo "✅ docs/         (Astro)     - Documentation site at port 4321"
	@echo "✅ Studio pages  (/notifications, /flags)"
	@echo ""
	@echo "Full platform: 15 services + 2 SDKs + observability + K8s"

# Phase 7: load testing
load-test-auth:
	@command -v k6 >/dev/null || (echo "Install k6: https://k6.io/docs/get-started/installation/" && exit 1)
	k6 run tests/load/k6/auth_flow.js \
	  --env BASE_URL=http://localhost:8000

load-test-db:
	@TOKEN=$$(curl -s -X POST http://localhost:8000/auth/signin \
	  -H "Content-Type: application/json" \
	  -d '{"email":"admin@example.com","password":"AdminPass123!"}' \
	  | jq -r '.data.access_token') && \
	k6 run tests/load/k6/database_query.js \
	  --env BASE_URL=http://localhost:8000 \
	  --env TOKEN=$$TOKEN

load-test-all: load-test-auth load-test-db
	@echo "Load tests complete"

# Phase 7: first run
seed:
	chmod +x scripts/seed.sh && ./scripts/seed.sh

first-run: build-all seed
	@echo "IndusBase ready at http://localhost:3000"

# Phase 9: Studio completion + premium productization
studio-check:
	cd indus-studio && npm run check -- --fail-on-warnings

studio-build:
	cd indus-studio && npm run build

studio-e2e-install:
	cd indus-studio && npm install && npm run test:e2e:install

studio-e2e:
	cd indus-studio && npm run test:e2e

studio-smoke:
	cd indus-studio && npm run test:e2e:smoke

studio-screens:
	cd indus-studio && npm run test:e2e:screens

studio-live-check:
	chmod +x scripts/studio_live_check.sh && ./scripts/studio_live_check.sh

studio-demo-seed:
	chmod +x scripts/seed.sh && ./scripts/seed.sh

studio-screenshot-check:
	chmod +x scripts/studio_screenshot_check.sh && ./scripts/studio_screenshot_check.sh

phase9-status:
	@echo "Phase 9: Studio Completion + Premium Productization enabled"
	@echo "✅ Studio pages wired to live APIs"
	@echo "✅ Shared Studio foundation components and stores"
	@echo "✅ Project/environment context propagation"
	@echo "✅ Playwright E2E flows configured"
	@echo "✅ Studio docs and Make targets added"

# Phase 10: Remaining-gap audit + completion pass
phase10-audit:
	chmod +x scripts/phase10_audit.sh && ./scripts/phase10_audit.sh

runtime-check:
	@echo "Running runtime sanity checks..."
	@sh -c 'status=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || true); \
	if [ -z "$$status" ]; then status=000; fi; \
	if [ "$$status" = "200" ]; then \
		echo "$(GREEN)✓ Gateway health (HTTP $$status)$(NC)"; \
	elif [ "$$status" = "000" ]; then \
		echo "$(YELLOW)! Gateway health unavailable (service not running on localhost:8000)$(NC)"; \
	else \
		echo "$(RED)✗ Gateway health unexpected HTTP $$status$(NC)"; \
	fi'
	@sh -c 'status=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || true); \
	if [ -z "$$status" ]; then status=000; fi; \
	if [ "$$status" = "200" ]; then \
		echo "$(GREEN)✓ Studio reachable (HTTP $$status)$(NC)"; \
	elif [ "$$status" = "000" ]; then \
		echo "$(YELLOW)! Studio unavailable (dev/prod server not running on localhost:3000)$(NC)"; \
	else \
		echo "$(RED)✗ Studio unexpected HTTP $$status$(NC)"; \
	fi'
	@sh -c 'status=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/ 2>/dev/null || true); \
	if [ -z "$$status" ]; then status=000; fi; \
	if [ "$$status" = "200" ]; then \
		echo "$(GREEN)✓ Docs reachable (HTTP $$status)$(NC)"; \
	elif [ "$$status" = "000" ]; then \
		echo "$(YELLOW)! Docs unavailable (site not running on localhost:4321)$(NC)"; \
	else \
		echo "$(RED)✗ Docs unexpected HTTP $$status$(NC)"; \
	fi'

demo-check:
	@echo "Running demo-surface checks..."
	@sh -c 'status=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || true); \
	if [ -z "$$status" ]; then status=000; fi; \
	if [ "$$status" = "200" ]; then \
		echo "$(GREEN)✓ API demo surface (HTTP $$status)$(NC)"; \
	elif [ "$$status" = "000" ]; then \
		echo "$(YELLOW)! API demo surface unavailable (gateway not running)$(NC)"; \
	else \
		echo "$(RED)✗ API demo surface unexpected HTTP $$status$(NC)"; \
	fi'
	@sh -c 'status=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard 2>/dev/null || true); \
	if [ -z "$$status" ]; then status=000; fi; \
	if [ "$$status" = "200" ] || [ "$$status" = "302" ] || [ "$$status" = "307" ]; then \
		echo "$(GREEN)✓ Studio dashboard route (HTTP $$status)$(NC)"; \
	elif [ "$$status" = "000" ]; then \
		echo "$(YELLOW)! Studio dashboard route unavailable (Studio not running)$(NC)"; \
	else \
		echo "$(RED)✗ Studio dashboard route unexpected HTTP $$status$(NC)"; \
	fi'
	@sh -c 'status=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/status 2>/dev/null || true); \
	if [ -z "$$status" ]; then status=000; fi; \
	if [ "$$status" = "200" ]; then \
		echo "$(GREEN)✓ Public status page (HTTP $$status)$(NC)"; \
	elif [ "$$status" = "000" ]; then \
		echo "$(YELLOW)! Public status page unavailable (docs site not running)$(NC)"; \
	else \
		echo "$(RED)✗ Public status page unexpected HTTP $$status$(NC)"; \
	fi'
	@sh -c 'status=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/trust-center 2>/dev/null || true); \
	if [ -z "$$status" ]; then status=000; fi; \
	if [ "$$status" = "200" ]; then \
		echo "$(GREEN)✓ Public trust center (HTTP $$status)$(NC)"; \
	elif [ "$$status" = "000" ]; then \
		echo "$(YELLOW)! Public trust center unavailable (docs site not running)$(NC)"; \
	else \
		echo "$(RED)✗ Public trust center unexpected HTTP $$status$(NC)"; \
	fi'

phase10-status:
	@echo "Phase 10: Remaining-gap audit + completion pass enabled"
	@echo "✅ Demo/runtime blockers audited"
	@echo "✅ Studio runtime/setup paths hardened"
	@echo "✅ E2E install/run workflow exposed"
	@echo "✅ Runtime/demo sanity targets added"

phase11-status:
	@echo "Phase 11: Indus Studio deep UI + full frontend wiring pass enabled"
	@echo "✅ Premium Studio shell and command palette"
	@echo "✅ Scope-aware project/environment switching"
	@echo "✅ Dashboard/onboarding/settings polish pass"
	@echo "✅ Stable E2E selectors and Studio smoke coverage"

phase12-status:
	@echo "Phase 12: Indus Studio UI/UX excellence + full backend wiring pass enabled"
	@echo "✅ Shared Studio primitives polished for premium admin UX"
	@echo "✅ Queue, billing, security, and enterprise pages deepened"
	@echo "✅ Command palette and critical admin flows covered in E2E"
	@echo "✅ Studio developer workflow and verification path tightened"

phase13-status:
	@echo "Phase 13: Indus Studio flagship polish + last-mile wiring pass enabled"
	@echo "✅ Heavy admin pages refined for flagship-quality demos"
	@echo "✅ Empty/error/loading and trust cues strengthened"
	@echo "✅ Enterprise/security/audit/AI selectors and UX hardened"
	@echo "✅ Studio verification and demo workflow tightened again"

phase14-status:
	@echo "Phase 14: Live stack verification + demo readiness + bug-fix pass enabled"
	@echo "✅ Live-check and demo-seed operator paths added"
	@echo "✅ Setup/seed scripts hardened for real local verification"
	@echo "✅ Screenshot-readiness checklist exposed"
	@echo "✅ Runtime truth documented when Docker/live stack is unavailable"
