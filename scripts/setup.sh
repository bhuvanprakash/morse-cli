#!/bin/bash
#
# IndusBase - One-Command Setup Script
# This script sets up a new contributor's development environment
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
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ============================================================================
# Dependency Checks
# ============================================================================

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 found: $(command -v $1)"
        return 0
    else
        print_error "$1 not found"
        return 1
    fi
}

check_dependency_version() {
    local cmd="$1"
    local version_flag="$2"
    local min_version="$3"
    
    if command -v "$cmd" &> /dev/null; then
        local version=$($cmd $version_flag 2>&1 | head -1)
        print_success "$cmd found: $version"
        return 0
    else
        return 1
    fi
}

check_docker() {
    print_header "Checking Docker"
    
    if check_command "docker"; then
        if docker info &> /dev/null; then
            print_success "Docker daemon is running"
        else
            print_error "Docker daemon is not running"
            print_info "Please start Docker and try again"
            exit 1
        fi
    else
        print_error "Docker is not installed"
        print_info "Install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check docker compose
    if docker compose version &> /dev/null; then
        print_success "Docker Compose (plugin) found"
    elif docker-compose version &> /dev/null; then
        print_success "Docker Compose (standalone) found"
    else
        print_error "Docker Compose not found"
        print_info "Docker Compose is included with Docker Desktop"
        exit 1
    fi
}

check_optional_deps() {
    print_header "Checking Optional Dependencies"
    
    check_dependency_version "go" "version" "1.23" || print_warning "Go not found (optional for local dev)"
    check_dependency_version "rustc" "--version" "1.75" || print_warning "Rust not found (optional for local dev)"
    check_dependency_version "zig" "version" "0.14" || print_warning "Zig not found (optional for local dev)"
    check_command "node" || print_warning "Node.js not found (optional for local dev)"
    check_command "gleam" || print_warning "Gleam not found (optional for local dev)"
    check_command "make" || print_warning "Make not found (optional)"
    check_command "jq" || print_warning "jq not found (recommended for seeding and smoke checks)"
    check_command "curl" || print_warning "curl not found (recommended for live checks)"
}

# ============================================================================
# Environment Setup
# ============================================================================

setup_environment() {
    print_header "Setting up Environment"
    
    cd "$PROJECT_ROOT"
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env from .env.example"
            print_warning "Please review and update .env with your actual values"
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_warning ".env already exists, skipping"
    fi
}

# ============================================================================
# Certificate Generation
# ============================================================================

generate_certs() {
    print_header "Generating TLS Certificates"
    
    local certs_dir="${PROJECT_ROOT}/certs"
    
    if [ ! -d "$certs_dir" ]; then
        mkdir -p "$certs_dir"
    fi
    
    if [ -f "${certs_dir}/server.crt" ] && [ -f "${certs_dir}/server.key" ]; then
        print_warning "Certificates already exist, skipping generation"
        return 0
    fi
    
    if command -v openssl &> /dev/null; then
        print_info "Generating self-signed certificates..."
        
        openssl req -x509 -newkey rsa:4096 \
            -keyout "${certs_dir}/server.key" \
            -out "${certs_dir}/server.crt" \
            -days 365 -nodes \
            -subj "/C=US/ST=State/L=City/O=IndusBase/OU=Dev/CN=localhost" \
            2>/dev/null
        
        if [ $? -eq 0 ]; then
            print_success "TLS certificates generated in ${certs_dir}/"
        else
            print_error "Failed to generate certificates"
        fi
    else
        print_warning "OpenSSL not found, skipping certificate generation"
        print_info "Certificates can be generated later with: make certs-generate"
    fi
}

# ============================================================================
# Build Services
# ============================================================================

build_services() {
    print_header "Building Services with Docker"
    
    cd "$PROJECT_ROOT"
    
    print_info "This may take a few minutes on first run..."
    
    if docker compose build; then
        print_success "All services built successfully"
    else
        print_error "Failed to build services"
        exit 1
    fi
}

# ============================================================================
# Post-Setup Summary
# ============================================================================

print_summary() {
    print_header "Setup Complete!"
    
    echo ""
    echo -e "${GREEN}Your IndusBase development environment is ready!${NC}"
    echo ""
    echo -e "${BLUE}Quick Start Commands:${NC}"
    echo "  docker compose up -d          # Start all services"
    echo "  docker compose logs -f        # View logs"
    echo "  docker compose down           # Stop all services"
    echo ""
    echo -e "${BLUE}Development URLs:${NC}"
    echo "  Studio:     http://localhost:3000"
    echo "  API Docs:   http://localhost:4321"
    echo "  Gate:       http://localhost:8000"
    echo ""
    echo -e "${BLUE}Service Ports:${NC}"
    echo "  indus-gate:   8000"
    echo "  indus-auth:   8001"
    echo "  indus-query:  8002"
    echo "  indus-meta:   8003"
    echo "  indus-pool:   5433 (PostgreSQL proxy)"
    echo "  indus-live:   8004"
    echo "  indus-store:  8005"
    echo "  indus-studio: 3000"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Review and update ${YELLOW}.env${NC} with your configuration"
    echo "  2. Run ${YELLOW}docker compose up -d${NC} to start services"
    echo "  3. Run ${YELLOW}make studio-demo-seed${NC} to create admin/org/project demo data"
    echo "  4. Run ${YELLOW}make studio-live-check${NC} to verify Studio/API/docs reachability"
    echo "  5. Visit ${YELLOW}http://localhost:3000${NC} to access the Studio"
    echo "  6. Visit ${YELLOW}http://localhost:4321${NC} for public docs"
    echo ""
    echo -e "${BLUE}Contributing:${NC}"
    echo "  See CONTRIBUTING.md for contribution guidelines"
    echo ""
}

# ============================================================================
# Main
# ============================================================================

main() {
    print_header "IndusBase Setup"
    
    echo ""
    echo "This script will set up your IndusBase development environment."
    echo ""
    
    # Check required dependencies
    check_docker
    
    # Check optional dependencies
    check_optional_deps
    
    # Setup environment
    setup_environment
    
    # Generate certificates
    generate_certs
    
    # Build services
    read -p "Build all services now? (this may take a few minutes) [Y/n]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        build_services
    else
        print_info "Skipping build. Run 'docker compose build' when ready."
    fi
    
    # Print summary
    print_summary
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
