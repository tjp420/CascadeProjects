#!/usr/bin/env python3
"""Generate remediation markdown from SimpleBeacon E2E JSON output."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple


SEVERITY_ORDER = ["Critical", "High", "Medium", "Low"]


def _classify_failure(reason: str) -> str:
    normalized = reason.lower()

    critical_patterns = [
        r"http return failure code:\s*5\d\d",
        r"timeout",
        r"no response",
        r"connection reset",
        r"dns",
    ]
    high_patterns = [
        r"http return failure code:\s*4\d\d",
        r"matched known error text pattern",
        r"assert",
        r"missing",
        r"not found",
    ]
    medium_patterns = [
        r"blocked",
        r"forbidden",
        r"rate limit",
        r"unauthorized",
    ]

    for pattern in critical_patterns:
        if re.search(pattern, normalized):
            return "Critical"
    for pattern in high_patterns:
        if re.search(pattern, normalized):
            return "High"
    for pattern in medium_patterns:
        if re.search(pattern, normalized):
            return "Medium"
    return "Low"


def _summarize_severity(failures: List[Tuple[str, str]]) -> Tuple[Dict[str, int], List[Tuple[str, str, str]]]:
    counts = {key: 0 for key in SEVERITY_ORDER}
    enriched: List[Tuple[str, str, str]] = []
    for route, reason in failures:
        severity = _classify_failure(reason)
        counts[severity] += 1
        enriched.append((severity, route, reason))

    rank = {name: idx for idx, name in enumerate(SEVERITY_ORDER)}
    enriched.sort(key=lambda row: (rank[row[0]], row[1]))
    return counts, enriched


def _safe_get_failures(report: Dict[str, object]) -> List[Tuple[str, str]]:
    failed = report.get("failedRoutes", {})
    if not isinstance(failed, dict):
        return []
    rows: List[Tuple[str, str]] = []
    for route, reason in failed.items():
        rows.append((str(route), str(reason)))
    return rows


def _safe_get_failures_detailed(report: Dict[str, object]) -> List[Tuple[str, str, str]]:
    detailed = report.get("failedRoutesDetailed", {})
    if not isinstance(detailed, dict):
        return []

    rows: List[Tuple[str, str, str]] = []
    for route, meta in detailed.items():
        if not isinstance(meta, dict):
            continue
        severity = str(meta.get("severity", "")).upper() or "LOW"
        reason = str(meta.get("reason", ""))
        rows.append((severity, str(route), reason))
    return rows


def _normalize_severity_counts(raw_counts: Dict[str, object]) -> Dict[str, int]:
    return {
        "Critical": int(raw_counts.get("CRITICAL", 0) or 0),
        "High": int(raw_counts.get("HIGH", 0) or 0),
        "Medium": int(raw_counts.get("MEDIUM", 0) or 0),
        "Low": int(raw_counts.get("LOW", 0) or 0),
    }


def _build_markdown(report: Dict[str, object], generated_at: str) -> str:
    totals = report.get("totals", {}) if isinstance(report.get("totals"), dict) else {}
    visited = totals.get("visited", 0)
    passed = totals.get("passed", 0)
    failed = totals.get("failed", 0)
    interactions = totals.get("interactions", 0)
    console_errors = totals.get("consoleErrors", 0)

    failures = _safe_get_failures(report)
    detailed_failures = _safe_get_failures_detailed(report)
    raw_severity_counts = report.get("severityCounts", {}) if isinstance(report.get("severityCounts"), dict) else {}

    if detailed_failures:
        rank = {name: idx for idx, name in enumerate(["CRITICAL", "HIGH", "MEDIUM", "LOW"])}
        detailed_failures.sort(key=lambda row: (rank.get(row[0], 99), row[1]))
        enriched_failures = [(sev.title(), route, reason) for sev, route, reason in detailed_failures]
        severity_counts = _normalize_severity_counts(raw_severity_counts)
    else:
        severity_counts, enriched_failures = _summarize_severity(failures)
    start_url = str(report.get("startUrl", ""))
    domain = str(report.get("domain", ""))
    started_at = str(report.get("startedAt", ""))
    finished_at = str(report.get("finishedAt", ""))

    lines: List[str] = []
    lines.append(f"# SimpleBeacon E2E Remediation Report ({generated_at})")
    lines.append("")
    lines.append("## Summary")
    lines.append(f"- Visited routes: {visited}")
    lines.append(f"- Passed routes: {passed}")
    lines.append(f"- Failed routes: {failed}")
    lines.append(f"- UI interactions: {interactions}")
    lines.append(f"- Console errors: {console_errors}")
    lines.append("")

    lines.append("## Severity Summary")
    lines.append(f"- Critical: {severity_counts['Critical']}")
    lines.append(f"- High: {severity_counts['High']}")
    lines.append(f"- Medium: {severity_counts['Medium']}")
    lines.append(f"- Low: {severity_counts['Low']}")
    lines.append("")

    has_failures = bool(enriched_failures)

    if has_failures:
        lines.append("## Route Failures")
        for severity, route, reason in enriched_failures:
            lines.append(f"- [{severity}] Route: {route}")
            lines.append(f"  Reason: {reason}")
        lines.append("")
        lines.append("## Remediation Checklist")
        for severity, route, _reason in enriched_failures:
            lines.append(f"- [ ] ({severity}) Investigate and fix route: {route}")
    else:
        lines.append("## Route Failures")
        lines.append("- None")
        lines.append("")
        lines.append("## Remediation Checklist")
        lines.append("- [x] No blocking route failures detected")

    lines.append("")
    lines.append("## Execution Metadata")
    lines.append(f"- Start URL: {start_url or 'unknown'}")
    lines.append(f"- Domain: {domain or 'unknown'}")
    lines.append(f"- Started At (raw): {started_at or 'unknown'}")
    lines.append(f"- Finished At (raw): {finished_at or 'unknown'}")
    lines.append("")
    lines.append("## Notes")
    lines.append("- Source: .simplebeacon/logs/simplebeacon-e2e-report.json")
    lines.append("- Generated by: ai-platform/tests/generate_e2e_remediation_log.py")

    return "\n".join(lines) + "\n"


def _append_to_manifest(manifest_path: Path, report_markdown: str) -> None:
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    if not manifest_path.exists():
        manifest_path.write_text("# Security Tracking Manifest\n\n", encoding="utf-8")

    with manifest_path.open("a", encoding="utf-8") as handle:
        handle.write("\n---\n\n")
        handle.write(report_markdown)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate E2E remediation markdown and append manifest entry")
    parser.add_argument("--report", required=True, help="Path to E2E JSON report")
    parser.add_argument("--output", required=True, help="Path to output markdown report")
    parser.add_argument("--manifest", required=True, help="Path to persistent manifest markdown")
    args = parser.parse_args()

    report_path = Path(args.report)
    output_path = Path(args.output)
    manifest_path = Path(args.manifest)

    if not report_path.exists():
        raise SystemExit(f"Report not found: {report_path}")

    report = json.loads(report_path.read_text(encoding="utf-8"))
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    markdown = _build_markdown(report, generated_at)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    _append_to_manifest(manifest_path, markdown)

    print(f"Remediation report written: {output_path}")
    print(f"Manifest updated: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
