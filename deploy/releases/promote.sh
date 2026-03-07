#!/usr/bin/env bash
set -euo pipefail

# Promote a tested staging release to production.
# Usage:
#   ./deploy/releases/promote.sh 1.2.3
# Environment:
#   RELEASE_NAME (default: indusbase)
#   NAMESPACE (default: indusbase)
#   CHART_PATH (default: ./deploy/helm/indusbase)

VERSION="${1:-}"
if [[ -z "${VERSION}" ]]; then
  echo "Usage: $0 <image-tag-version>"
  exit 1
fi

RELEASE_NAME="${RELEASE_NAME:-indusbase}"
NAMESPACE="${NAMESPACE:-indusbase}"
CHART_PATH="${CHART_PATH:-./deploy/helm/indusbase}"
MANIFEST_DIR="${MANIFEST_DIR:-./deploy/releases/manifests}"

mkdir -p "${MANIFEST_DIR}"
GIT_SHA="$(git rev-parse --short HEAD)"
DATE_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SERVICES_CHANGED="$(git diff --name-only HEAD~1..HEAD | awk -F/ '/^indus-/{print $1}' | sort -u | tr '\n' ',' | sed 's/,$//')"

echo "[release] Promoting version=${VERSION} sha=${GIT_SHA} namespace=${NAMESPACE}"

helm upgrade --install "${RELEASE_NAME}" "${CHART_PATH}" \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  --set global.imageTag="${VERSION}" \
  --wait --timeout 10m

cat > "${MANIFEST_DIR}/release-${VERSION}.json" <<EOF
{
  "version": "${VERSION}",
  "git_sha": "${GIT_SHA}",
  "promoted_at_utc": "${DATE_UTC}",
  "namespace": "${NAMESPACE}",
  "release_name": "${RELEASE_NAME}",
  "services_changed": "${SERVICES_CHANGED}"
}
EOF

echo "[release] Manifest written: ${MANIFEST_DIR}/release-${VERSION}.json"
