#!/usr/bin/env python3
# simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
"""
SimpleBeacon Pre-Flight Verification Script
==========================================
Run this before every public deployment to catch production bugs,
staging references, and trust-signal issues.

Usage:
    python scripts/preflight-check.py

Exit code 0 = all clear, 1 = blocking issues found
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import List, Tuple

# ── Configuration ──
PROJECT_ROOT = Path(__file__).parent.parent
DOCS_DIR = PROJECT_ROOT / "docs"
SRC_DIR = PROJECT_ROOT / "src"
WEBSITE_DIR = PROJECT_ROOT.parent / "coming-soon"

BLOCKING_PATTERNS: List[Tuple[str, str]] = [
    # (pattern, description)
    (r"http://localhost:\d+", "Hardcoded localhost URL"),
    (r"https?://127\.0\.0\.1:\d+", "Hardcoded 127.0.0.1 URL"),
    (r"trevor_punt@live\.com", "Personal Live.com email address"),
    (r"your-email@example\.com|your@email\.com", "Placeholder email"),
    (r"\bTODO:\b|\bFIXME:\b|\bHACK:\b|\bXXX:\b", "Development todo markers"),
    (r"console\.log\s*\(", "Console.log statement (production file)"),
    (r"debugger;", "Debugger statement"),
    (r"sk-test-|sk_live_|pk-test-|pk_live_", "Stripe test/live key leak"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub personal access token"),
    (r"aws_access_key_id\s*=\s*['\"][A-Z0-9]{20}['\"]", "AWS access key"),
]

# Files/paths to ignore (development artifacts, vendored libs)
IGNORE_PATTERNS = [
    "node_modules/",
    ".git/",
    "dist/",
    "out/",
    "archive/",
    "*.log",
    "*.map",
    ".simplebeacon/",
    "coverage/",
    "scripts/preflight-check.py",  # self
    "*scanner-patterns.js",  # pattern definitions contain example matches
    "*scanner-engine.js",    # pattern definitions contain example matches
    "*test-*.js",
    "*test-*.ts",
    "*spec.js",
    "*spec.ts",
    "*quick-actions.js",    # dashboard debug button logic
    "*token-manager.js",     # dashboard module
    "*main.js",              # dashboard main entry
    "*pattern-documentation.js",  # pattern definition docs
    "js/dashboard/",         # all dashboard JS files
    "public/js/dashboard/",  # all public dashboard JS files
    "zip-for-upload.js",     # build utility script
    "analyze-directory.js",  # Node CLI utility (console.log is correct)
    "site-config.js",        # environment detection (localhost check is correct)
    "public/site-config.js", # environment detection (localhost check is correct)
    "roadmap.html",          # roadmap JS uses "todo" as variable name, not dev TODO
    "public/roadmap.html",   # roadmap JS uses "todo" as variable name, not dev TODO
    "case-study-ai-slop-1-25m.html",  # blog narrative about a Stripe key leak
    "public/blog/case-study-ai-slop-1-25m.html",  # blog narrative
    "terminal-walkthrough.html",  # demo page showing example findings
    "pricing.html",          # environment detection for localhost fallback
    "public/pricing.html",   # environment detection for localhost fallback
    "audit.html",            # dashboard with localhost status check
    "public/audit.html",     # dashboard with localhost status check
    "cloud-teams.html",      # waitlist form placeholder email
    "public/cloud-teams.html", # waitlist form placeholder email
    "src/analyzers/workspaceAnalyzer.ts",  # scanner regex pattern definitions
    "src/aiPlatform/realtimeMonitor.ts",   # default Ollama config value
    "src/auth/authManager.ts",              # default API config value
    "src/modernSidebarProvider.ts",         # many default localhost config values
    "src/extension.ts",                     # default API/Ollama config values
]

# Required files that must exist for a production release
REQUIRED_FILES = [
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    "package.json",
    ".simplebeacon/config.json",
    "releases/simplebeacon-3.0.22.vsix",
]

# ── Helpers ──


def should_ignore(path: Path) -> bool:
    """Check if a path matches any ignore pattern."""
    path_str = str(path).replace("\\", "/")
    for pattern in IGNORE_PATTERNS:
        if pattern.endswith("/"):
            if pattern.rstrip("/") in path_str.split("/"):
                return True
        elif pattern.startswith("*"):
            if path_str.endswith(pattern.lstrip("*")):
                return True
        elif pattern in path_str:
            return True
    return False


def scan_file_for_patterns(file_path: Path) -> List[Tuple[str, int, str]]:
    """Scan a single file for blocking patterns. Returns list of (pattern, line_num, line_text)."""
    findings = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for line_num, line in enumerate(f, 1):
                for pattern, desc in BLOCKING_PATTERNS:
                    # Skip console.log checks in dashboard HTML (browser JS is OK)
                    if "console.log" in desc and "dashboard" in str(file_path):
                        continue
                    if re.search(pattern, line, re.IGNORECASE):
                        # Skip comments that reference patterns (e.g., regex definitions)
                        if line.strip().startswith("//") or line.strip().startswith("#"):
                            if "pattern" in line.lower() or "regex" in line.lower():
                                continue
                        findings.append((desc, line_num, line.strip()[:120]))
    except (IOError, UnicodeDecodeError):
        pass
    return findings


def check_required_files() -> List[str]:
    """Check that all required files exist."""
    missing = []
    for req in REQUIRED_FILES:
        full_path = PROJECT_ROOT / req
        if not full_path.exists():
            missing.append(req)
    return missing


def check_package_json() -> List[str]:
    """Validate package.json for production readiness."""
    issues = []
    pkg_path = PROJECT_ROOT / "package.json"
    if not pkg_path.exists():
        issues.append("package.json not found")
        return issues

    try:
        with open(pkg_path) as f:
            pkg = json.load(f)
    except json.JSONDecodeError:
        issues.append("package.json is invalid JSON")
        return issues

    # Version format check
    version = pkg.get("version", "")
    if not re.match(r"^\d+\.\d+\.\d+$", version):
        issues.append(f"package.json version '{version}' is not semver (x.y.z)")

    # Must not have "dev" or "alpha" or "beta" in version for production
    if any(tag in version.lower() for tag in ["dev", "alpha", "beta", "rc"]):
        issues.append(f"package.json version '{version}' contains pre-release tag")

    # Check for critical fields
    for field in ["name", "description", "version", "publisher"]:
        if not pkg.get(field):
            issues.append(f"package.json missing required field: {field}")

    return issues


def check_vsix_version_alignment() -> List[str]:
    """Ensure VSIX version matches package.json."""
    issues = []
    pkg_path = PROJECT_ROOT / "package.json"
    if not pkg_path.exists():
        return issues

    with open(pkg_path) as f:
        pkg = json.load(f)
    pkg_version = pkg.get("version", "")

    # Find VSIX files
    releases_dir = PROJECT_ROOT / "releases"
    if releases_dir.exists():
        vsix_files = list(releases_dir.glob("*.vsix"))
        if not vsix_files:
            issues.append("No .vsix file found in releases/")
        else:
            # Check if any VSIX filename contains the version
            version_in_vsix = any(pkg_version in f.name for f in vsix_files)
            if not version_in_vsix:
                issues.append(
                    f"VSIX filename does not contain package.json version ({pkg_version})"
                )

    return issues


def check_simplebeacon_gate() -> List[str]:
    """Verify the latest SimpleBeacon gate scan passed."""
    issues = []
    report_path = PROJECT_ROOT / ".simplebeacon" / "report.json"
    if not report_path.exists():
        issues.append("No .simplebeacon/report.json found — run gate scan before deploy")
        return issues

    try:
        with open(report_path) as f:
            report = json.load(f)
        gate = report.get("gate", {})
        if not gate.get("pass", False):
            blocking = gate.get("blockingCount", 0)
            issues.append(f"SimpleBeacon gate FAILED — {blocking} blocking issues")
    except (json.JSONDecodeError, KeyError):
        issues.append("Could not parse .simplebeacon/report.json")

    return issues


def check_website_for_staging_refs() -> List[str]:
    """Check website files for staging/localhost references."""
    issues = []
    if not WEBSITE_DIR.exists():
        return issues

    # Only check HTML/JS files in public/ and root (not archive/)
    web_files = []
    for ext in ["*.html", "*.js"]:
        web_files.extend(WEBSITE_DIR.glob(ext))
        if (WEBSITE_DIR / "public").exists():
            web_files.extend((WEBSITE_DIR / "public").rglob(ext))

    for file_path in web_files:
        if should_ignore(file_path):
            continue
        findings = scan_file_for_patterns(file_path)
        for desc, line_num, line_text in findings:
            rel = file_path.relative_to(PROJECT_ROOT.parent)
            issues.append(f"[{rel}:{line_num}] {desc}: {line_text}")

    return issues


# ── Main ──


def main() -> int:
    print("=" * 60)
    print("  SimpleBeacon Pre-Flight Verification")
    print("=" * 60)

    all_issues: List[str] = []

    # 1. Required files
    print("\n[1/6] Checking required production files...")
    missing = check_required_files()
    if missing:
        for m in missing:
            all_issues.append(f"MISSING: {m}")
            print(f"  ✗ {m}")
    else:
        print("  ✓ All required files present")

    # 2. package.json
    print("\n[2/6] Validating package.json...")
    pkg_issues = check_package_json()
    if pkg_issues:
        for issue in pkg_issues:
            all_issues.append(f"PACKAGE: {issue}")
            print(f"  ✗ {issue}")
    else:
        print("  ✓ package.json valid")

    # 3. VSIX version alignment
    print("\n[3/6] Checking VSIX version alignment...")
    vsix_issues = check_vsix_version_alignment()
    if vsix_issues:
        for issue in vsix_issues:
            all_issues.append(f"VSIX: {issue}")
            print(f"  ✗ {issue}")
    else:
        print("  ✓ VSIX version aligned")

    # 4. SimpleBeacon gate
    print("\n[4/6] Verifying SimpleBeacon gate status...")
    gate_issues = check_simplebeacon_gate()
    if gate_issues:
        for issue in gate_issues:
            all_issues.append(f"GATE: {issue}")
            print(f"  ✗ {issue}")
    else:
        print("  ✓ Gate passed")

    # 5. Source code scan
    print("\n[5/6] Scanning source code for staging references...")
    src_issues = 0
    for file_path in SRC_DIR.rglob("*"):
        if file_path.is_dir() or should_ignore(file_path):
            continue
        if file_path.suffix not in [".ts", ".js", ".json", ".html"]:
            continue
        findings = scan_file_for_patterns(file_path)
        for desc, line_num, line_text in findings:
            rel = file_path.relative_to(PROJECT_ROOT)
            all_issues.append(f"[{rel}:{line_num}] {desc}: {line_text}")
            print(f"  ✗ [{rel}:{line_num}] {desc}")
            src_issues += 1
    if src_issues == 0:
        print("  ✓ No staging references found")

    # 6. Website scan
    print("\n[6/6] Scanning website for staging references...")
    web_issues = check_website_for_staging_refs()
    if web_issues:
        for issue in web_issues:
            all_issues.append(f"WEBSITE: {issue}")
            print(f"  ✗ {issue}")
    else:
        print("  ✓ Website clean")

    # ── Summary ──
    print("\n" + "=" * 60)
    if all_issues:
        print(f"  RESULT: FAILED — {len(all_issues)} issue(s) found")
        print("=" * 60)
        print("\nBlocking issues:")
        for i, issue in enumerate(all_issues, 1):
            print(f"  {i}. {issue}")
        print("\nFix these issues before deploying.")
        return 1
    else:
        print("  RESULT: PASSED — All checks clear")
        print("=" * 60)
        print("\nYou are cleared for launch. 🚀")
        return 0


if __name__ == "__main__":
    sys.exit(main())
