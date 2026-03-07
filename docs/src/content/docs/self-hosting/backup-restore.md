---
title: Backup Verification and Restore Drills
description: Verify PostgreSQL backups, run restore drills, and generate operational reports for IndusBase.
---

## Overview

IndusBase includes daily PostgreSQL backups and automated retention.  
Phase 8 adds operational verification and restore drills so backups are continuously proven restorable.

Default assumptions:
- Region: `ap-south-1`
- Timezone: `Asia/Kolkata`
- Bucket path: `s3://{BACKUP_BUCKET}/daily/`

## Verify Latest Backup

This checks:
1. S3 object exists
2. Dump can be read using `pg_restore -l`
3. SHA-256 checksum can be generated
4. Backup age is under threshold (`MAX_BACKUP_AGE_HOURS`, default `24`)

```bash
PGPASSWORD=your_password \
BACKUP_BUCKET=indusbase-backups-prod \
./deploy/backup/verify_backup.sh
```

Verify a specific dump:

```bash
PGPASSWORD=your_password \
./deploy/backup/verify_backup.sh \
  s3://indusbase-backups-prod/daily/indusbase_20260306_020000.dump
```

## Run Restore Drill

The restore drill:
1. Downloads latest dump
2. Restores into temporary DB
3. Runs smoke checks
4. Writes JSON report and uploads it to `s3://{BACKUP_BUCKET}/reports/`

```bash
PGPASSWORD=your_password \
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_USER=indusbase \
BACKUP_BUCKET=indusbase-backups-prod \
./deploy/backup/restore_drill.sh
```

## Generate Consolidated Report

```bash
python3 ./deploy/backup/backup_report.py /tmp
```

This prints:
- latest verification status
- latest restore drill status
- failure counts
- report generation time

## Make Targets

```bash
make backup-verify
make backup-restore-drill
```

## Operational Guidance

- Run `verify_backup.sh` at least every 6 hours.
- Run `restore_drill.sh` at least weekly.
- Alert if backup age exceeds 24 hours.
- Alert if restore drill fails twice consecutively.
- Keep reports for 90 days in S3 for audits and procurement review.
