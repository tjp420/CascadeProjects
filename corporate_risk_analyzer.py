#!/usr/bin/env python3
import os
import re
import argparse
import sys
import json

# Simple enterprise-focused risk analyzer
# Scans files under a path for configured regex rules and exits non-zero
# when findings meet or exceed the configured fail severity.

RULES = {
    "SECRET_LEAK": {
        "severity": "CRITICAL",
        "description": "Exposed infrastructure credentials or private encryption keys.",
        "patterns": [
            r"(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}",
            r"-----BEGIN [A-Z ]+ PRIVATE KEY-----",
            r"AWS_SECRET_ACCESS_KEY\s*=\s*[\'\"][A-Za-z0-9/+=]{20,}\b",
            r"(?i)aws_secret_access_key\b",
        ],
    },
    "VIRAL_LICENSE": {
        "severity": "HIGH",
        "description": "Viral open-source license that forces proprietary code to become public domain.",
        "patterns": [
            r"AGPL-3\\.0",
            r"GPL-3\\.0",
            r"GNU Affero General Public License",
        ],
    },
    "RAW_PII": {
        "severity": "MEDIUM",
        "description": "Unencrypted personally identifiable information (PII) pattern.",
        "patterns": [
            r"\b[\w.%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b",
            r"\b\d{3}-\d{2}-\d{4}\b",
        ],
    },
}

FILE_EXT_WHITELIST = ('.py', '.js', '.ts', '.go', '.java', '.json', '.txt', '.md', '.yml', '.yaml', '.cfg', '.ini')
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', 'venv', '.venv', 'dist', 'build'}

severity_weights = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}


def scan_file(file_path):
    findings = []
    try:
        # avoid reading very large binary blobs
        if os.path.getsize(file_path) > 10 * 1024 * 1024:
            return findings

        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            for rule_name, rule_meta in RULES.items():
                for pat in rule_meta['patterns']:
                    try:
                        for m in re.finditer(pat, content):
                            line_no = content.count('\n', 0, m.start()) + 1
                            findings.append({
                                'file': file_path,
                                'line': line_no,
                                'issue_type': rule_name,
                                'severity': rule_meta['severity'],
                                'description': rule_meta['description'],
                                'match': m.group(0)[:200]
                            })
                    except re.error:
                        # malformed pattern — skip
                        continue
    except Exception:
        # unreadable file, ignore
        pass
    return findings


def walk_and_scan(root_path):
    all_findings = []
    for root, dirs, files in os.walk(root_path):
        # prune ignored dirs
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            if file.lower().endswith(FILE_EXT_WHITELIST):
                fp = os.path.join(root, file)
                all_findings.extend(scan_file(fp))
    return all_findings


def main():
    parser = argparse.ArgumentParser(description='Enterprise Corporate Risk Analyzer Engine')
    parser.add_argument('--path', default='.', help='Target directory to scan')
    parser.add_argument('--fail-severity', default='HIGH', choices=['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
                        help='Minimum severity threshold required to trigger a CI build failure')
    parser.add_argument('--out', default='compliance-report.json', help='Report output path')
    args = parser.parse_args()

    fail_threshold = severity_weights.get(args.fail_severity, 3)

    print(f"Scanning path: {args.path}")
    findings = walk_and_scan(args.path)

    report = {
        'generatedBy': 'corporate_risk_analyzer',
        'path': os.path.abspath(args.path),
        'summary': {
            'total_issues': len(findings),
        },
        'findings': findings,
    }

    try:
        with open(args.out, 'w', encoding='utf-8') as fh:
            json.dump(report, fh, indent=2)
        print(f"Wrote report to {args.out}")
    except Exception as e:
        print(f"Failed to write report: {e}")

    should_fail = False
    for f in findings:
        sev = f.get('severity', 'LOW')
        print(f"[{sev}] {f.get('issue_type')} in {f.get('file')}:{f.get('line')}")
        if severity_weights.get(sev, 0) >= fail_threshold:
            should_fail = True

    if should_fail:
        print(f"\n[FAILURE] Codebase violates enterprise threshold ({args.fail_severity}+). Blocking build.")
        sys.exit(1)

    print('\n[SUCCESS] Compliance check passed successfully.')
    sys.exit(0)


if __name__ == '__main__':
    main()
