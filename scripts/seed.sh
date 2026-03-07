#!/bin/bash
# IndusBase first-run seed script

set -euo pipefail

: "${BASE_URL:=http://localhost:8000}"
: "${ADMIN_EMAIL:=admin@indusbase.local}"
: "${ADMIN_PASSWORD:=AdminPass123!}"
: "${ORG_NAME:=My Organization}"
: "${PROJECT_NAME:=my-first-project}"
: "${PROJECT_SLUG:=my-first-project}"
: "${ORG_SLUG:=default-org}"

echo "IndusBase First-Run Seed"
echo "================================"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to seed the platform"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to parse API responses during seeding"
  echo "Install jq, then rerun scripts/seed.sh"
  exit 1
fi

echo "Waiting for platform..."
for i in $(seq 1 30); do
  if curl -sf "${BASE_URL}/health" > /dev/null 2>&1; then
    echo "Platform is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Platform not ready after 60s. Run: docker-compose up -d --build"
    exit 1
  fi
  sleep 2
done

echo "Creating admin user: ${ADMIN_EMAIL}"
curl -sf -X POST "${BASE_URL}/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" >/dev/null || true

echo "Signing in as admin..."
SIGNIN_RES=$(curl -sf -X POST "${BASE_URL}/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
TOKEN=$(echo "$SIGNIN_RES" | jq -r '.data.access_token')
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Could not get admin token. Response: $SIGNIN_RES"
  exit 1
fi
echo "Admin token obtained"

echo "Creating organization: ${ORG_NAME}"
ORG_RES=$(curl -sf -X POST "${BASE_URL}/meta/organizations" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${ORG_NAME}\",\"slug\":\"${ORG_SLUG}\",\"owner_email\":\"${ADMIN_EMAIL}\"}" || echo '{"data":null}')
ORG_ID=$(echo "$ORG_RES" | jq -r '.data.id // empty')
if [ -z "$ORG_ID" ]; then
  echo "Org may already exist, fetching..."
  ORG_LIST=$(curl -sf "${BASE_URL}/meta/organizations" -H "Authorization: Bearer ${TOKEN}" || echo '{"data":null}')
  ORG_ID=$(echo "$ORG_LIST" | jq -r '.data.id // .data[0].id // empty')
fi
if [ -z "$ORG_ID" ]; then
  echo "Failed to resolve organization id"
  exit 1
fi
echo "Organization ID: ${ORG_ID}"

echo "Creating project: ${PROJECT_NAME}"
PROJ_RES=$(curl -sf -X POST "${BASE_URL}/meta/projects" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${PROJECT_NAME}\",\"slug\":\"${PROJECT_SLUG}\",\"org_id\":\"${ORG_ID}\",\"region\":\"ap-south-1\"}" || echo '{"data":null}')
PROJECT_ID=$(echo "$PROJ_RES" | jq -r '.data.id // empty')
if [ -z "$PROJECT_ID" ]; then
  echo "Project may already exist, fetching..."
  PROJECTS_RES=$(curl -sf "${BASE_URL}/meta/projects?org_id=${ORG_ID}" -H "Authorization: Bearer ${TOKEN}" || echo '{"data":[]}')
  PROJECT_ID=$(echo "$PROJECTS_RES" | jq -r --arg slug "$PROJECT_SLUG" '.data[]? | select(.slug == $slug) | .id' | head -n1)
  if [ -n "$PROJECT_ID" ]; then
    PROJ_RES=$(curl -sf "${BASE_URL}/meta/projects/${PROJECT_ID}" -H "Authorization: Bearer ${TOKEN}" || echo '{"data":null}')
  fi
fi
ANON_KEY=$(echo "$PROJ_RES" | jq -r '.data.anon_key')
SERVICE_KEY=$(echo "$PROJ_RES" | jq -r '.data.service_role_key')
if [ -z "$PROJECT_ID" ]; then
  echo "Failed to resolve project id"
  exit 1
fi

echo "Resolving production environment..."
ENV_RES=$(curl -sf "${BASE_URL}/config/environments" -H "Authorization: Bearer ${TOKEN}" || echo '{"data":[]}')
PROD_ENV_ID=$(echo "$ENV_RES" | jq -r '.data[]? | select(.name == "production") | .id' | head -n1)
if [ -z "$PROD_ENV_ID" ]; then
  echo "Failed to resolve production environment id"
  exit 1
fi

echo "Seeding default feature flags..."
for flag in \
  "{\"key\":\"whatsapp_otp_enabled\",\"environment_id\":\"${PROD_ENV_ID}\",\"value_type\":\"boolean\",\"default_value\":\"true\",\"description\":\"Enable WhatsApp OTP\"}" \
  "{\"key\":\"hindi_ui_enabled\",\"environment_id\":\"${PROD_ENV_ID}\",\"value_type\":\"boolean\",\"default_value\":\"true\",\"description\":\"Enable Hindi UI\"}" \
  "{\"key\":\"aadhaar_kyc_enabled\",\"environment_id\":\"${PROD_ENV_ID}\",\"value_type\":\"boolean\",\"default_value\":\"false\",\"description\":\"Enable Aadhaar KYC\"}" \
  "{\"key\":\"upi_autopay_enabled\",\"environment_id\":\"${PROD_ENV_ID}\",\"value_type\":\"boolean\",\"default_value\":\"false\",\"description\":\"Enable UPI Autopay\"}"; do
  curl -sf -X POST "${BASE_URL}/config/flags" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$flag" > /dev/null || true
done
echo "Feature flags seeded"

echo "Pulling Ollama embedding model (if available)..."
curl -sf -X POST http://localhost:11434/api/pull \
  -d '{"name":"nomic-embed-text"}' | tail -1 | jq -r '.status' || \
  echo "Ollama not available — set EMBEDDING_PROVIDER=openai or cohere"

echo ""
echo "IndusBase is ready"
echo "================================"
echo "Studio:        http://localhost:3000"
echo "Docs:          http://localhost:4321"
echo "Admin:         ${ADMIN_EMAIL}"
echo "Project ID:    ${PROJECT_ID}"
echo "Anon Key:      ${ANON_KEY}"
echo "Service Key:   ${SERVICE_KEY}"
echo ""
echo "Quick test:"
echo "  curl http://localhost:8000/health | jq"
echo "  make studio-live-check"
echo "  cd indus-studio && npm run test:e2e:install && npm run test:e2e"
