#!/usr/bin/env python3
"""Generate aggregated backup verification/restore drill report."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def load_reports(paths: list[Path]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in paths:
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            continue
    return out


def summarize(reports: list[dict[str, Any]]) -> dict[str, Any]:
    verify = [r for r in reports if r.get("type") == "backup_verification"]
    drill = [r for r in reports if r.get("type") == "restore_drill"]
    latest_verify = max(verify, key=lambda r: r.get("completed_at_utc", ""), default=None)
    latest_drill = max(drill, key=lambda r: r.get("completed_at_utc", ""), default=None)
    now = datetime.now(timezone.utc)
    latest_backup_age_hours = None
    if latest_verify and latest_verify.get("completed_at_utc"):
        latest_backup_age_hours = round(
            (now - parse_ts(latest_verify["completed_at_utc"])).total_seconds() / 3600.0, 2
        )
    return {
        "generated_at_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_reports": len(reports),
        "verify_reports": len(verify),
        "restore_drill_reports": len(drill),
        "latest_verify": latest_verify,
        "latest_restore_drill": latest_drill,
        "latest_report_age_hours": latest_backup_age_hours,
        "verification_failures": sum(1 for r in verify if r.get("status") != "success"),
        "restore_drill_failures": sum(1 for r in drill if r.get("status") != "success"),
    }


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp")
    files = sorted(root.glob("backup_verify_*.json")) + sorted(root.glob("restore_drill_*.json"))
    reports = load_reports(files)
    summary = summarize(reports)
    print(json.dumps(summary, indent=2))
    print("\nBackup Health Summary")
    print("=====================")
    print(f"Total reports: {summary['total_reports']}")
    print(f"Verification failures: {summary['verification_failures']}")
    print(f"Restore drill failures: {summary['restore_drill_failures']}")
    if summary["latest_verify"]:
        print(f"Latest verification status: {summary['latest_verify'].get('status')}")
    if summary["latest_restore_drill"]:
        print(f"Latest restore drill status: {summary['latest_restore_drill'].get('status')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
