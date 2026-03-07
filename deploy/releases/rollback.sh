#!/usr/bin/env bash
set -euo pipefail

# Rollback Helm release to previous or explicit revision.
# Usage:
#   ./deploy/releases/rollback.sh                 # previous revision
#   ./deploy/releases/rollback.sh 12              # specific revision

RELEASE_NAME="${RELEASE_NAME:-indusbase}"
NAMESPACE="${NAMESPACE:-indusbase}"
REVISION="${1:-}"

if [[ -z "${REVISION}" ]]; then
  CURRENT="$(helm history "${RELEASE_NAME}" -n "${NAMESPACE}" -o json | jq '.[-1].revision')"
  if [[ -z "${CURRENT}" || "${CURRENT}" == "null" || "${CURRENT}" -le 1 ]]; then
    echo "No previous revision available for rollback."
    exit 1
  fi
  REVISION="$((CURRENT - 1))"
fi

echo "[release] Rolling back ${RELEASE_NAME} in ${NAMESPACE} to revision ${REVISION}"
helm rollback "${RELEASE_NAME}" "${REVISION}" -n "${NAMESPACE}" --wait --timeout 10m
echo "[release] Rollback completed"
