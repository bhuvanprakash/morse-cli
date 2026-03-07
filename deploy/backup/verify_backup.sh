#!/usr/bin/env bash
set -euo pipefail

# Verify latest backup object exists and can be inspected with pg_restore -l.
# Produces JSON report and optionally uploads it to S3.
#
# Usage:
#   ./deploy/backup/verify_backup.sh
#   ./deploy/backup/verify_backup.sh s3://bucket/daily/file.dump

: "${BACKUP_BUCKET:=indusbase-backups}"
: "${BACKUP_PREFIX:=daily}"
: "${S3_ENDPOINT:=}"
: "${MAX_BACKUP_AGE_HOURS:=24}"
: "${AWS_DEFAULT_REGION:=ap-south-1}"

S3_OPTS=()
if [[ -n "${S3_ENDPOINT}" ]]; then
  S3_OPTS+=(--endpoint-url "${S3_ENDPOINT}")
fi

TARGET_PATH="${1:-}"
if [[ -z "${TARGET_PATH}" ]]; then
  LATEST_LINE="$(aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/" "${S3_OPTS[@]}" | tail -1 || true)"
  if [[ -z "${LATEST_LINE}" ]]; then
    echo "No backups found in s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/"
    exit 1
  fi
  LATEST_FILE="$(awk '{print $4}' <<<"${LATEST_LINE}")"
  TARGET_PATH="s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${LATEST_FILE}"
fi

TMP_DUMP="/tmp/verify_backup_$(date +%s).dump"
TMP_LIST="/tmp/verify_backup_$(date +%s)_toc.txt"
REPORT_DIR="${REPORT_DIR:-/tmp}"
REPORT_FILE="${REPORT_DIR}/backup_verify_$(date +%Y%m%d_%H%M%S).json"
mkdir -p "${REPORT_DIR}"

START_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_EPOCH="$(date +%s)"
STATUS="success"
ERROR_MSG=""

cleanup() {
  rm -f "${TMP_DUMP}" "${TMP_LIST}"
}
trap cleanup EXIT

echo "[verify] downloading ${TARGET_PATH}"
if ! aws s3 cp "${TARGET_PATH}" "${TMP_DUMP}" "${S3_OPTS[@]}"; then
  STATUS="failed"
  ERROR_MSG="download_failed"
fi

BACKUP_SIZE_BYTES=0
CHECKSUM=""
TOC_ENTRIES=0
BACKUP_AGE_HOURS=-1
STALE=false

if [[ "${STATUS}" == "success" ]]; then
  BACKUP_SIZE_BYTES="$(wc -c <"${TMP_DUMP}" | tr -d ' ')"
  CHECKSUM="$(sha256sum "${TMP_DUMP}" | awk '{print $1}')"
  if ! pg_restore -l "${TMP_DUMP}" > "${TMP_LIST}" 2>/dev/null; then
    STATUS="failed"
    ERROR_MSG="pg_restore_list_failed"
  else
    TOC_ENTRIES="$(wc -l <"${TMP_LIST}" | tr -d ' ')"
  fi
fi

if [[ "${STATUS}" == "success" ]]; then
  # Parse timestamp from filename: indusbase_YYYYMMDD_HHMMSS.dump
  FILE_BASENAME="$(basename "${TARGET_PATH}")"
  FILE_DATE="$(sed -n 's/.*_\([0-9]\{8\}\)_\([0-9]\{6\}\)\.dump/\1\2/p' <<< "${FILE_BASENAME}")"
  if [[ -n "${FILE_DATE}" ]]; then
    BACKUP_EPOCH="$(date -d "${FILE_DATE:0:8} ${FILE_DATE:8:2}:${FILE_DATE:10:2}:${FILE_DATE:12:2}" +%s || echo 0)"
    NOW_EPOCH="$(date +%s)"
    if [[ "${BACKUP_EPOCH}" -gt 0 ]]; then
      BACKUP_AGE_HOURS="$(( (NOW_EPOCH - BACKUP_EPOCH) / 3600 ))"
      if [[ "${BACKUP_AGE_HOURS}" -gt "${MAX_BACKUP_AGE_HOURS}" ]]; then
        STALE=true
        STATUS="failed"
        ERROR_MSG="backup_stale"
      fi
    fi
  fi
fi

END_EPOCH="$(date +%s)"
DURATION_SECONDS="$((END_EPOCH - START_EPOCH))"
END_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat > "${REPORT_FILE}" <<EOF
{
  "type": "backup_verification",
  "status": "${STATUS}",
  "started_at_utc": "${START_TS}",
  "completed_at_utc": "${END_TS}",
  "duration_seconds": ${DURATION_SECONDS},
  "target_path": "${TARGET_PATH}",
  "backup_size_bytes": ${BACKUP_SIZE_BYTES},
  "checksum_sha256": "${CHECKSUM}",
  "toc_entries": ${TOC_ENTRIES},
  "backup_age_hours": ${BACKUP_AGE_HOURS},
  "stale": ${STALE},
  "max_backup_age_hours": ${MAX_BACKUP_AGE_HOURS},
  "error": "${ERROR_MSG}"
}
EOF

echo "[verify] report written: ${REPORT_FILE}"

REPORT_S3_PATH="s3://${BACKUP_BUCKET}/reports/$(basename "${REPORT_FILE}")"
aws s3 cp "${REPORT_FILE}" "${REPORT_S3_PATH}" "${S3_OPTS[@]}" >/dev/null 2>&1 || true
echo "[verify] report uploaded: ${REPORT_S3_PATH}"

if [[ "${STATUS}" != "success" ]]; then
  echo "[verify] failed: ${ERROR_MSG}"
  exit 1
fi

echo "[verify] success"
