#!/bin/bash
# IndusBase automated PostgreSQL backup script
# Run via cron: 0 2 * * * /opt/indusbase/backup/pg_backup.sh

set -euo pipefail

: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=indusbase}"
: "${POSTGRES_USER:=indusbase}"
: "${PGPASSWORD:?PGPASSWORD must be set}"
: "${BACKUP_BUCKET:=indusbase-backups}"
: "${BACKUP_RETENTION_DAYS:=30}"
: "${S3_ENDPOINT:=}"
: "${AWS_DEFAULT_REGION:=ap-south-1}"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="indusbase_${TIMESTAMP}.dump"
TMP_PATH="/tmp/${BACKUP_FILE}"

echo "[$(date)] Starting backup: ${BACKUP_FILE}"

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[DRY-RUN] pg_dump --host=${POSTGRES_HOST} --port=${POSTGRES_PORT} --username=${POSTGRES_USER} --format=custom --compress=9 --file=${TMP_PATH} ${POSTGRES_DB}"
else
  pg_dump \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="${TMP_PATH}" \
    "${POSTGRES_DB}"
fi

BACKUP_SIZE=$([[ "${DRY_RUN}" == "true" ]] && echo "0B" || du -sh "${TMP_PATH}" | cut -f1)
echo "[$(date)] Dump complete: ${BACKUP_SIZE}"

S3_OPTS=()
if [ -n "${S3_ENDPOINT}" ]; then
  S3_OPTS+=(--endpoint-url "${S3_ENDPOINT}")
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[DRY-RUN] aws s3 cp ${TMP_PATH} s3://${BACKUP_BUCKET}/daily/${BACKUP_FILE} ${S3_OPTS[*]} --storage-class STANDARD_IA"
else
  aws s3 cp "${TMP_PATH}" \
    "s3://${BACKUP_BUCKET}/daily/${BACKUP_FILE}" \
    "${S3_OPTS[@]}" \
    --storage-class STANDARD_IA \
    --metadata "timestamp=${TIMESTAMP},size=${BACKUP_SIZE}"
  rm -f "${TMP_PATH}"
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[DRY-RUN] retention cleanup for backups older than ${BACKUP_RETENTION_DAYS} days"
else
  aws s3 ls "s3://${BACKUP_BUCKET}/daily/" "${S3_OPTS[@]}" \
    | awk '{print $4}' \
    | while read -r file; do
        file_date=$(echo "${file}" | grep -oE '[0-9]{8}' | head -1)
        if [ -n "${file_date}" ]; then
          cutoff=$(date -d "-${BACKUP_RETENTION_DAYS} days" +%Y%m%d)
          if [[ "${file_date}" < "${cutoff}" ]]; then
            echo "[$(date)] Deleting old backup: ${file}"
            aws s3 rm "s3://${BACKUP_BUCKET}/daily/${file}" "${S3_OPTS[@]}"
          fi
        fi
      done
fi

echo "[$(date)] Backup complete: s3://${BACKUP_BUCKET}/daily/${BACKUP_FILE}"
