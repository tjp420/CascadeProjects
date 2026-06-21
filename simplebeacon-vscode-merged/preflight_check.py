#!/usr/bin/env python3
"""Pre-flight verification script to prevent debug overrides from reaching production."""

import os
import sys
import json

CRITICAL_CHECKS = {
    "no_localhost": {
        "files": [
            "./docs/SHOW-HN-ANNOUNCEMENT.md",
            "./docs/GITHUB-ADVANCED-SECURITY-COMPARISON.md",
            "./docs/ENTERPRISE-OUTREACH.md",
            "../coming-soon/terminal-walkthrough.html"
        ],
        "forbidden": ["localhost:", "127.0.0.1"],
        "error_msg": "Production marketing assets contain development server URLs!"
    },
    "no_temporary_keys": {
        "files": ["./test_pipeline.py", "./test_scan_wrapper.js"],
        "forbidden": ["sk_live_production_real_key_placeholder"],
        "error_msg": "Test arrays contain unsafe mock credential structural formats."
    }
}

def run_preflight_checks():
    print("[...] Executing final asset verification rules...")
    all_clear = True
    base_dir = os.path.dirname(os.path.abspath(__file__))

    for check_name, rules in CRITICAL_CHECKS.items():
        for rel_path in rules["files"]:
            file_path = os.path.join(base_dir, rel_path)
            if not os.path.exists(file_path):
                continue
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                for item in rules["forbidden"]:
                    if item in content:
                        print(f"[X] CRITICAL ERROR [{check_name}]: {rules['error_msg']} Found in {file_path}")
                        all_clear = False

    if all_clear:
        print("[ok] Pre-flight structural validation complete. All assets clear.")
    return all_clear

if __name__ == "__main__":
    if not run_preflight_checks():
        sys.exit(1)
    sys.exit(0)
