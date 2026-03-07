#!/usr/bin/env bash
set -euo pipefail

# Restore drill:
# 1) Download latest backup
# 2) Restore into temporary DB
# 3) Run smoke queries
# 4) Emit JSON report and upload to S3

: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=indusbase}"
: "${PGPASSWORD:?PGPASSWORD must be set}"
: "${BACKUP_BUCKET:=indusbase-backups}"
: "${BACKUP_PREFIX:=daily}"
: "${S3_ENDPOINT:=}"
: "${AWS_DEFAULT_REGION:=ap-south-1}"

S3_OPTS=()
if [[ -n "${S3_ENDPOINT}" ]]; then
  S3_OPTS+=(--endpoint-url "${S3_ENDPOINT}")
fi

LATEST_LINE="$(aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/" "${S3_OPTS[@]}" | tail -1 || true)"
if [[ -z "${LATEST_LINE}" ]]; then
  echo "No backups found in s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/"
  exit 1
fi
LATEST_FILE="$(awk '{print $4}' <<<"${LATEST_LINE}")"
BACKUP_S3_PATH="s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${LATEST_FILE}"

TMP_DUMP="/tmp/restore_drill_$(date +%s).dump"
DRILL_DB="indusbase_restore_drill_$(date +%s)"
REPORT_DIR="${REPORT_DIR:-/tmp}"
REPORT_FILE="${REPORT_DIR}/restore_drill_$(date +%Y%m%d_%H%M%S).json"
mkdir -p "${REPORT_DIR}"

STATUS="success"
ERROR_MSG=""
START_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_EPOCH="$(date +%s)"
RESTORE_DURATION_SECONDS=0
TABLE_COUNT=0
USERS_COUNT=-1

cleanup() {
  dropdb --if-exists -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${DRILL_DB}" >/dev/null 2>&1 || true
  rm -f "${TMP_DUMP}"
}
trap cleanup EXIT

echo "[restore-drill] downloading ${BACKUP_S3_PATH}"
if ! aws s3 cp "${BACKUP_S3_PATH}" "${TMP_DUMP}" "${S3_OPTS[@]}"; then
  STATUS="failed"
  ERROR_MSG="download_failed"
fi

if [[ "${STATUS}" == "success" ]]; then
  createdb -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${DRILL_DB}"
  RESTORE_START="$(date +%s)"
  if ! pg_restore \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${DRILL_DB}" \
    --jobs=4 \
    --clean \
    --if-exists \
    "${TMP_DUMP}" >/tmp/restore_drill.log 2>&1; then
    STATUS="failed"
    ERROR_MSG="pg_restore_failed"
  fi
  RESTORE_END="$(date +%s)"
  RESTORE_DURATION_SECONDS="$((RESTORE_END - RESTORE_START))"
fi

if [[ "${STATUS}" == "success" ]]; then
  TABLE_COUNT="$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${DRILL_DB}" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');" | tr -d ' ')"
  USERS_COUNT="$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${DRILL_DB}" -tAc "SELECT COUNT(*) FROM pg_tables WHERE tablename='users';" | tr -d ' ')"
  if [[ -z "${TABLE_COUNT}" || "${TABLE_COUNT}" -eq 0 ]]; then
    STATUS="failed"
    ERROR_MSG="smoke_query_failed"
  fi
fi

END_EPOCH="$(date +%s)"
END_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TOTAL_DURATION="$((END_EPOCH - START_EPOCH))"

cat > "${REPORT_FILE}" <<EOF
{
  "type": "restore_drill",
  "status": "${STATUS}",
  "started_at_utc": "${START_TS}",
  "completed_at_utc": "${END_TS}",
  "duration_seconds": ${TOTAL_DURATION},
  "restore_duration_seconds": ${RESTORE_DURATION_SECONDS},
  "backup_path": "${BACKUP_S3_PATH}",
  "temporary_database": "${DRILL_DB}",
  "smoke_checks": {
    "table_count": ${TABLE_COUNT},
    "users_table_exists_count": ${USERS_COUNT}
  },
  "error": "${ERROR_MSG}"
}
EOF

echo "[restore-drill] report written: ${REPORT_FILE}"
REPORT_S3_PATH="s3://${BACKUP_BUCKET}/reports/$(basename "${REPORT_FILE}")"
aws s3 cp "${REPORT_FILE}" "${REPORT_S3_PATH}" "${S3_OPTS[@]}" >/dev/null 2>&1 || true
echo "[restore-drill] report uploaded: ${REPORT_S3_PATH}"

if [[ "${STATUS}" != "success" ]]; then
  echo "[restore-drill] failed: ${ERROR_MSG}"
  exit 1
fi

echo "[restore-drill] success"
