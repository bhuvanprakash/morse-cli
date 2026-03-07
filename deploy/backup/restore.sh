#!/bin/bash
# IndusBase PostgreSQL restore from backup
# Usage: ./restore.sh s3://indusbase-backups/daily/indusbase_20260301_020000.dump

set -euo pipefail

: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=indusbase}"
: "${POSTGRES_USER:=indusbase}"
: "${PGPASSWORD:?PGPASSWORD must be set}"
: "${S3_ENDPOINT:=}"

BACKUP_S3_PATH="${1:?Usage: $0 <s3://bucket/path/backup.dump>}"
TMP_PATH="/tmp/restore_$(date +%s).dump"

echo "WARNING: This will REPLACE the database '${POSTGRES_DB}'"
echo "Backup: ${BACKUP_S3_PATH}"
read -r -p "Type 'yes' to continue: " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

S3_OPTS=()
if [ -n "${S3_ENDPOINT}" ]; then
  S3_OPTS+=(--endpoint-url "${S3_ENDPOINT}")
fi

echo "[$(date)] Downloading backup..."
aws s3 cp "${BACKUP_S3_PATH}" "${TMP_PATH}" "${S3_OPTS[@]}"

echo "[$(date)] Restoring database..."
pg_restore \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --jobs=4 \
  --verbose \
  --clean \
  --if-exists \
  "${TMP_PATH}"

rm -f "${TMP_PATH}"
echo "[$(date)] Restore complete"
