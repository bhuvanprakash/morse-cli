#!/usr/bin/env bash
set -euo pipefail

# Generate release notes from git log.
# Usage:
#   ./deploy/releases/release_notes.sh v1.0.0 v1.1.0
#   ./deploy/releases/release_notes.sh HEAD~20 HEAD

FROM_REF="${1:-}"
TO_REF="${2:-HEAD}"

if [[ -z "${FROM_REF}" ]]; then
  echo "Usage: $0 <from-ref> [to-ref]"
  exit 1
fi

echo "# IndusBase Release Notes"
echo
echo "- Range: \`${FROM_REF}..${TO_REF}\`"
echo "- Generated at (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo
echo "## Commits"
git log --pretty=format:"- %h %s (%an)" "${FROM_REF}..${TO_REF}"
echo
echo
echo "## Changed Services"
git diff --name-only "${FROM_REF}..${TO_REF}" \
  | awk -F/ '/^indus-/{print $1}' \
  | sort -u \
  | sed 's/^/- /'
