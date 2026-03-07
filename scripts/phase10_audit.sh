#!/bin/bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

pass() {
  printf 'PASS %s\n' "$1"
}

warn() {
  printf 'WARN %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1"
  exit 1
}

check_file() {
  local path="$1"
  if [ -e "${ROOT}/${path}" ]; then
    pass "found ${path}"
  else
    fail "missing ${path}"
  fi
}

check_contains() {
  local path="$1"
  local pattern="$2"
  if rg -q "$pattern" "${ROOT}/${path}"; then
    pass "${path} contains ${pattern}"
  else
    fail "${path} missing ${pattern}"
  fi
}

echo "Phase 10 audit"
echo "=============="

check_file "docker-compose.yml"
check_file ".env.example"
check_file "indus-studio/package.json"
check_file "indus-studio/playwright.config.ts"
check_file "indus-studio/e2e/studio-flows.spec.ts"
check_file "docs/src/routes/status/index.astro"
check_file "docs/src/routes/trust-center/index.astro"
check_file "scripts/test-e2e.sh"
check_file "scripts/seed.sh"

check_contains "indus-studio/package.json" "\"test:e2e:install\""
check_contains "Makefile" "^phase10-status:"
check_contains "Makefile" "^studio-e2e-install:"
check_contains "Makefile" "^runtime-check:"
check_contains "Makefile" "^demo-check:"
check_contains "scripts/test-e2e.sh" "http://localhost:8000"
check_contains "indus-studio/src/lib/utils/urls.ts" "realtime/v1/websocket"
check_contains "indus-studio/src/lib/api/client.ts" "X-IndusBase-Project-ID"
check_contains "indus-studio/src/lib/api/client.ts" "X-IndusBase-Organization-ID"

if [ -x "${ROOT}/indus-studio/node_modules/.bin/playwright" ]; then
  pass "Playwright binary installed"
else
  warn "Playwright binary not installed yet; run 'make studio-e2e-install'"
fi

echo "Phase 10 audit complete"
