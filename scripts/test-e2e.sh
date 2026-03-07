#!/bin/bash
#
# IndusBase - End-to-End Integration Test Script
# This script runs integration tests against a running IndusBase stack
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Configuration
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
TIMEOUT=300  # 5 minutes timeout for service startup
POLL_INTERVAL=5

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# ============================================================================
# Docker Compose Helpers
# ============================================================================

compose_cmd() {
    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" "$@"
    else
        docker-compose -f "$COMPOSE_FILE" "$@"
    fi
}

# ============================================================================
# Service Health Checks
# ============================================================================

wait_for_service() {
    local service="$1"
    local health_check="$2"
    local max_attempts=$((TIMEOUT / POLL_INTERVAL))
    local attempt=1
    
    print_info "Waiting for $service to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if eval "$health_check" &> /dev/null; then
            print_success "$service is healthy"
            return 0
        fi
        
        echo -n "."
        sleep $POLL_INTERVAL
        ((attempt++))
    done
    
    print_error "$service failed to become healthy within ${TIMEOUT}s"
    return 1
}

check_http_service() {
    local name="$1"
    local url="$2"
    wait_for_service "$name" "curl -sf $url/health || curl -sf $url"
}

check_tcp_service() {
    local name="$1"
    local host="$2"
    local port="$3"
    wait_for_service "$name" "nc -z $host $port"
}

check_postgres() {
    local name="$1"
    local host="$2"
    local port="$3"
    local user="$4"
    local db="$5"
    wait_for_service "$name" "pg_isready -h $host -p $port -U $user -d $db"
}

wait_for_all_services() {
    print_header "Waiting for Services"
    
    # Database
    check_postgres "PostgreSQL" "localhost" "5432" "indus_admin" "indusbase" || return 1
    
    # Redis
    check_tcp_service "Redis" "localhost" "6379" || return 1
    
    # Services
    check_http_service "indus-gate" "http://localhost:8000" || return 1
    check_http_service "indus-auth" "http://localhost:8001" || return 1
    check_http_service "indus-query" "http://localhost:8002" || return 1
    check_http_service "indus-meta" "http://localhost:8003" || return 1
    check_http_service "indus-live" "http://localhost:8004" || return 1
    check_http_service "indus-store" "http://localhost:8005" || return 1
    check_http_service "indus-studio" "http://localhost:3000" || return 1
    
    print_success "All services are healthy"
}

# ============================================================================
# API Tests
# ============================================================================

test_auth_service() {
    print_header "Testing Auth Service"
    
    local base_url="http://localhost:8001"
    local response
    local http_code
    
    # Health check
    response=$(curl -sf "$base_url/health" 2>/dev/null) && \
        print_success "Health endpoint" || \
        print_error "Health endpoint failed"
    
    # Signup endpoint (should exist)
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$base_url/auth/signup" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test123","name":"E2E Test"}' 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "400" ]; then
        print_success "Signup endpoint exists"
    else
        print_error "Signup endpoint failed (HTTP $http_code)"
    fi
    
    # Signin endpoint (should exist)
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$base_url/auth/signin" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test123"}' 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "401" ] || [ "$http_code" = "400" ]; then
        print_success "Login endpoint exists"
    else
        print_error "Login endpoint failed (HTTP $http_code)"
    fi
}

test_query_service() {
    print_header "Testing Query Service"
    
    local base_url="http://localhost:8002"
    local response
    
    # Health check
    response=$(curl -sf "$base_url/health" 2>/dev/null) && \
        print_success "Health endpoint" || \
        print_error "Health endpoint failed"
    
    # SQL endpoint (test with valid SQL)
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$base_url/v1/sql" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer test-token" \
        -d '{"query":"SELECT 1"}' 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "401" ] || [ "$http_code" = "400" ]; then
        print_success "SQL endpoint exists"
    else
        print_error "SQL endpoint failed (HTTP $http_code)"
    fi
}

test_meta_service() {
    print_header "Testing Meta Service"
    
    local base_url="http://localhost:8003"
    
    # Health check
    curl -sf "$base_url/health" &>/dev/null && \
        print_success "Health endpoint" || \
        print_error "Health endpoint failed"
}

test_gate_service() {
    print_header "Testing Gate Service"
    
    local base_url="http://localhost:8000"
    
    # Health check
    curl -sf "$base_url/health" &>/dev/null && \
        print_success "Health endpoint" || \
        print_error "Health endpoint failed"
    
    # Proxy to auth service
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/auth/user" 2>/dev/null || echo "000")
    if [ "$http_code" = "200" ] || [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
        print_success "Auth proxy routing"
    else
        print_error "Auth proxy routing failed (HTTP $http_code)"
    fi
}

test_store_service() {
    print_header "Testing Store Service"
    
    local base_url="http://localhost:8005"
    
    # Health check
    curl -sf "$base_url/health" &>/dev/null && \
        print_success "Health endpoint" || \
        print_error "Health endpoint failed"
}

test_studio_service() {
    print_header "Testing Studio Service"
    
    local base_url="http://localhost:3000"
    
    # Check if studio responds
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$base_url" 2>/dev/null || echo "000")
    if [ "$http_code" = "200" ] || [ "$http_code" = "307" ] || [ "$http_code" = "302" ]; then
        print_success "Studio responds"
    else
        print_error "Studio failed to respond (HTTP $http_code)"
    fi
}

# ============================================================================
# Database Connectivity Test
# ============================================================================

test_database_connectivity() {
    print_header "Testing Database Connectivity"
    
    # Test through pooler
    if PGPASSWORD=indus_secure_pass psql -h localhost -p 5433 -U indus_admin -d indusbase -c "SELECT 1" &>/dev/null; then
        print_success "PostgreSQL via indus-pool (port 5433)"
    else
        print_error "PostgreSQL via indus-pool failed"
    fi
    
    # Test direct connection
    if PGPASSWORD=indus_secure_pass psql -h localhost -p 5432 -U indus_admin -d indusbase -c "SELECT 1" &>/dev/null; then
        print_success "PostgreSQL direct (port 5432)"
    else
        print_error "PostgreSQL direct connection failed"
    fi
}

# ============================================================================
# Integration Test Runner
# ============================================================================

run_integration_tests() {
    print_header "Running Integration Tests"
    
    test_auth_service
    test_query_service
    test_meta_service
    test_gate_service
    test_store_service
    test_studio_service
    test_database_connectivity
}

# ============================================================================
# Cleanup
# ============================================================================

cleanup() {
    print_header "Cleanup"
    
    print_info "Stopping services..."
    compose_cmd down -v --remove-orphans 2>/dev/null || true
    
    print_success "Cleanup complete"
}

# ============================================================================
# Main
# ============================================================================

main() {
    local skip_cleanup=false
    local skip_start=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-cleanup)
                skip_cleanup=true
                shift
                ;;
            --skip-start)
                skip_start=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-cleanup    Skip cleanup after tests"
                echo "  --skip-start      Assume services are already running"
                echo "  --help            Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    print_header "IndusBase E2E Tests"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Start services if needed
    if [ "$skip_start" = false ]; then
        print_info "Starting services..."
        compose_cmd up -d --build
    else
        print_info "Skipping service start (--skip-start)"
    fi
    
    # Wait for services
    if ! wait_for_all_services; then
        print_error "Services failed to start properly"
        compose_cmd logs --tail=50
        exit 1
    fi
    
    # Run tests
    run_integration_tests
    
    # Print results
    print_header "Test Results"
    echo ""
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo ""
    
    # Cleanup if not skipped
    if [ "$skip_cleanup" = false ] && [ "$skip_start" = false ]; then
        cleanup
    fi
    
    # Exit with appropriate code
    if [ $TESTS_FAILED -gt 0 ]; then
        exit 1
    else
        print_success "All tests passed!"
        exit 0
    fi
}

# Handle Ctrl+C
trap 'print_warning "Interrupted"; cleanup; exit 130' INT

# Run main
main "$@"
