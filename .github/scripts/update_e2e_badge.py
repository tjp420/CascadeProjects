#!/usr/bin/env python3
"""Update README with a dynamic E2E severity badge from report JSON."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

BADGE_START = "[//]: # (simplebeacon-e2e-badge:start)"
BADGE_END = "[//]: # (simplebeacon-e2e-badge:end)"
BADGE_ALT = "SimpleBeacon E2E State"


def _badge_markdown(severity: str) -> str:
    token = (severity or "UNKNOWN").strip().upper()
    message_map = {
        "CRITICAL": "CRITICAL",
        "HIGH": "HIGH",
        "MEDIUM": "MEDIUM",
        "LOW": "LOW",
        "NONE": "HEALTHY",
        "UNKNOWN": "UNKNOWN",
    }
    color_map = {
        "CRITICAL": "red",
        "HIGH": "orange",
        "MEDIUM": "yellow",
        "LOW": "blue",
        "NONE": "brightgreen",
        "UNKNOWN": "lightgrey",
    }
    message = message_map.get(token, "UNKNOWN")
    color = color_map.get(token, "lightgrey")
    url = f"https://img.shields.io/badge/SimpleBeacon%20E2E-{message}-{color}"
    return f"![{BADGE_ALT}]({url})"


def _read_severity(report_path: Path) -> str:
    if not report_path.exists():
        return "UNKNOWN"
    try:
        payload = json.loads(report_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return "UNKNOWN"
    if not isinstance(payload, dict):
        return "UNKNOWN"
    value = payload.get("highestActiveSeverity", "UNKNOWN")
    return str(value or "UNKNOWN").upper()


def _replace_or_insert_badge(readme_text: str, badge_line: str) -> str:
    block = f"{BADGE_START}\n{badge_line}\n{BADGE_END}"

    if BADGE_START in readme_text and BADGE_END in readme_text:
        before, _, rest = readme_text.partition(BADGE_START)
        _, _, after = rest.partition(BADGE_END)
        return f"{before}{block}{after}"

    lines = readme_text.splitlines()
    insert_at = 1 if lines else 0
    if lines and lines[0].startswith("#"):
        insert_at = 2 if len(lines) > 1 and lines[1].strip() == "" else 1

    new_lines = lines[:insert_at] + [block, ""] + lines[insert_at:]
    return "\n".join(new_lines) + ("\n" if readme_text.endswith("\n") or not readme_text else "")


def main() -> int:
    parser = argparse.ArgumentParser(description="Update README E2E severity badge from report JSON")
    parser.add_argument("--report", required=True, help="Path to report JSON")
    parser.add_argument("--readme", default="README.md", help="Path to README")
    args = parser.parse_args()

    report_path = Path(args.report)
    readme_path = Path(args.readme)

    if not readme_path.exists():
        raise SystemExit(f"README not found: {readme_path}")

    severity = _read_severity(report_path)
    badge_line = _badge_markdown(severity)

    original = readme_path.read_text(encoding="utf-8")
    updated = _replace_or_insert_badge(original, badge_line)
    if updated != original:
        readme_path.write_text(updated, encoding="utf-8")

    print(f"E2E badge severity: {severity}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
