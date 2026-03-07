#!/bin/bash
set -euo pipefail

: "${API_BASE_URL:=http://localhost:8000}"
: "${STUDIO_BASE_URL:=http://localhost:3000}"
: "${DOCS_BASE_URL:=http://localhost:4321}"

echo "IndusBase Studio Live Check"
echo "==========================="

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for live checks"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed in this environment."
  echo "Install Docker Desktop or Docker Engine, then run:"
  echo "  docker-compose up -d --build"
  echo "  make studio-demo-seed"
  echo "  make studio-live-check"
  exit 1
fi

check_url() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || true)
  if [ -z "$status" ]; then
    status="000"
  fi
  if [ "$status" = "$expected" ] || { [ "$expected" = "redirect" ] && { [ "$status" = "200" ] || [ "$status" = "302" ] || [ "$status" = "307" ]; }; }; then
    echo "✓ $label ($status)"
  else
    echo "! $label unexpected HTTP $status"
  fi
}

echo ""
echo "Core surfaces"
check_url "API gateway health" "${API_BASE_URL}/health"
check_url "Studio login" "${STUDIO_BASE_URL}/login" "redirect"
check_url "Docs home" "${DOCS_BASE_URL}/"

echo ""
echo "Demo routes"
check_url "Studio dashboard" "${STUDIO_BASE_URL}/dashboard" "redirect"
check_url "Studio queue" "${STUDIO_BASE_URL}/queue" "redirect"
check_url "Studio billing" "${STUDIO_BASE_URL}/billing" "redirect"
check_url "Studio enterprise SSO" "${STUDIO_BASE_URL}/enterprise/sso" "redirect"
check_url "Studio security" "${STUDIO_BASE_URL}/security" "redirect"

echo ""
echo "Next steps"
echo "  1. make studio-demo-seed"
echo "  2. make studio-smoke"
echo "  3. make studio-e2e"
