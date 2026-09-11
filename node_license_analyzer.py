#!/usr/bin/env python3
import os
import json
import argparse
from tools.ast_secret_scanner import run_ast_secret_scan
import urllib.request
import urllib.parse
import sys
import time

# Define strict corporate risk rubric
LICENSE_RISK_MAP = {
    "AGPL-3.0": "CRITICAL", "AGPL-1.0": "CRITICAL", "GPL-2.0": "HIGH", "GPL-3.0": "HIGH",
    "LGPL-2.0": "MEDIUM", "LGPL-2.1": "MEDIUM", "LGPL-3.0": "MEDIUM", "MPL-2.0": "LOW",
    "CDDL-1.0": "LOW", "EPL-1.0": "LOW", "EPL-2.0": "LOW",
    "MIT": "SAFE", "Apache-2.0": "SAFE", "BSD-2-Clause": "SAFE", "BSD-3-Clause": "SAFE", "ISC": "SAFE"
}

RISK_DESCRIPTIONS = {
    "CRITICAL": "Viral Copyleft (Network). Forces whole codebase to be open-sourced if served over a network.",
    "HIGH": "Viral Copyleft (Standard). Requires distributing source code if software is distributed.",
    "MEDIUM": "Weak Copyleft. Modifications to this specific library must be open-sourced.",
    "LOW": "File-level Copyleft / Notice requirement. Low immediate risk but requires legal compliance documentation.",
    "SAFE": "Permissive License. Completely safe for commercial enterprise usage.",
    "UNKNOWN": "Unrecognized or missing license metadata. Requires manual legal evaluation."
}

CACHE_FILE = os.path.join('.cache', 'npm-licenses.json')


def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_cache(cache):
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


def fetch_live_npm_license(package_name, version, cache):
    cache_key = f"{package_name}@{version}"
    if cache_key in cache:
        return cache[cache_key]

    # Encode package name so scoped names become %40scope%2Fname
    safe_name = urllib.parse.quote(package_name, safe='')
    url = f"https://registry.npmjs.org/{safe_name}/{version}"

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'SimpleBeacon-License-Scanner/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            raw = response.read()
            try:
                data = json.loads(raw.decode('utf-8'))
            except Exception:
                data = {}

            license_val = data.get('license')
            if isinstance(license_val, dict):
                license_val = license_val.get('type')
            if not license_val and 'licenses' in data:
                lic_list = data.get('licenses')
                if isinstance(lic_list, list) and len(lic_list) > 0 and isinstance(lic_list[0], dict):
                    license_val = lic_list[0].get('type')

            if license_val:
                license_str = str(license_val).strip()
                cache[cache_key] = license_str
                # be gentle to registry
                time.sleep(0.05)
                return license_str
    except Exception:
        # network or parsing errors -> mark unknown
        pass

    cache[cache_key] = 'UNKNOWN'
    return 'UNKNOWN'


def generate_html_report(findings, summary, output_path):
    status_bg = "#10b981" if summary["critical"] == 0 and summary["high"] == 0 else "#ef4444"
    status_text = "COMPLIANCE PASSED" if status_bg == "#10b981" else "RISK MITIGATION REQUIRED"
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SimpleBeacon // Enterprise Compliance Ledger</title>
    <style>
        :root {{
            --bg-main: #0b0f19;
            --bg-card: #111827;
            --border: #1f2937;
            --text-muted: #9ca3af;
            --risk-critical: #ef4444;
            --risk-high: #f97316;
            --risk-medium: #eab308;
            --risk-safe: #10b981;
        }}
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            background-color: var(--bg-main); 
            color: #f3f4f6; 
            margin: 0; 
            padding: 40px;
            line-height: 1.5;
        }}
        .container {{ max-width: 1100px; margin: 0 auto; }}
        .header {{ 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            background: var(--bg-card);
            padding: 24px 32px;
            border-radius: 12px;
            border: 1px solid var(--border);
            margin-bottom: 24px;
        }}
        .brand {{ display: flex; align-items: center; gap: 12px; }}
        .brand-logo {{ font-weight: 800; font-size: 20px; letter-spacing: -0.05em; color: #fff; }}
        .brand-logo span {{ color: #6366f1; }}
        .badge {{ background: {status_bg}; color: white; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; letter-spacing: 0.05em; }}
        .metrics {{ display: flex; gap: 16px; margin-bottom: 32px; }}
        .metric-card {{ 
            flex: 1; 
            background: var(--bg-card); 
            padding: 24px; 
            border-radius: 12px; 
            border: 1px solid var(--border);
            position: relative;
            overflow: hidden;
        }}
        .metric-card::before {{
            content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--border);
        }}
        .metric-card.critical::before {{ background: var(--risk-critical); }}
        .metric-card.high::before {{ background: var(--risk-high); }}
        .metric-card.medium::before {{ background: var(--risk-medium); }}
        .metric-label {{ font-size: 12px; font-weight: 600; color: var(--text-muted); letter-spacing: 0.05em; text-transform: uppercase; }}
        .metric-val {{ font-size: 36px; font-weight: 800; display: block; margin-top: 4px; color: #fff; }}
        .section-title {{ font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #fff; display: flex; align-items: center; gap: 8px; }}
        table {{ width: 100%; border-collapse: separate; border-spacing: 0; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; }}
        th {{ text-align: left; background-color: #1f2937; padding: 16px; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }}
        td {{ padding: 16px; border-bottom: 1px solid var(--border); font-size: 14px; vertical-align: middle; }}
        tr:last-child td {{ border-bottom: none; }}
        .sev-tag {{ display: inline-block; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }}
        .sev-CRITICAL {{ background: rgba(239, 68, 68, 0.15); color: var(--risk-critical); border: 1px solid rgba(239, 68, 68, 0.3); }}
        .sev-HIGH {{ background: rgba(249, 115, 22, 0.15); color: var(--risk-high); border: 1px solid rgba(249, 115, 22, 0.3); }}
        .sev-MEDIUM {{ background: rgba(234, 179, 8, 0.15); color: var(--risk-medium); border: 1px solid rgba(234, 179, 8, 0.3); }}
        .sev-SAFE {{ background: rgba(16, 185, 129, 0.15); color: var(--risk-safe); border: 1px solid rgba(16, 185, 129, 0.3); }}
        .upsell-banner {{
            background: linear-gradient(135deg, #1e1b4b 0%, #111827 100%);
            border: 1px solid #3730a3;
            padding: 24px;
            border-radius: 12px;
            margin-top: 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .upsell-btn {{
            background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; transition: background 0.2s;
        }}
        .upsell-btn:hover {{ background: #4338ca; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="brand">
                <div class="brand-logo">Simple<span>Beacon</span></div>
                <div style="width: 1px; height: 24px; background: var(--border);"></div>
                <div style="font-size: 14px; color: var(--text-muted);">Supply Chain License Audit</div>
            </div>
            <div class="badge">{status_text}</div>
        </div>

        <div class="metrics">
            <div class="metric-card critical"><span class="metric-label">Critical Vulnerabilities</span><span class="metric-val">{summary['critical']}</span></div>
            <div class="metric-card high"><span class="metric-label">High Risk Violations</span><span class="metric-val">{summary['high']}</span></div>
            <div class="metric-card medium"><span class="metric-label">Warning Advisories</span><span class="metric-val">{summary['medium']}</span></div>
            <div class="metric-card"><span class="metric-label">Total Dependencies</span><span class="metric-val">{summary['total']}</span></div>
        </div>

        <div class="section-title">🛡️ Open Source Compliance Ledger</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 25%;">Package Module</th>
                    <th style="width: 12%;">Version</th>
                    <th style="width: 15%;">License Found</th>
                    <th style="width: 15%;">Risk Index</th>
                    <th style="width: 33%;">Enterprise Governance Impact</th>
                </tr>
            </thead>
            <tbody>
    """

    for f in findings:
        html_content += f"""
                <tr>
                    <td><strong style="color: #fff;">{f['package']}</strong></td>
                    <td><code style="color: #6366f1; background: #1e1b4b; padding: 2px 6px; border-radius: 4px; font-size: 13px;">{f['version']}</code></td>
                    <td><span style="color: #e5e7eb;">{f['license']}</span></td>
                    <td><span class="sev-tag sev-{f['severity']}">{f['severity']}</span></td>
                    <td style="color: var(--text-muted); font-size: 13px;">{f['description']}</td>
                </tr>
        """
    
    html_content += f"""
            </tbody>
        </table>

        <div class="upsell-banner">
            <div>
                <h3 style="margin: 0 0 4px 0; color: #fff; font-size: 16px;">Automate this gate continuously</h3>
                <p style="margin: 0; color: var(--text-muted); font-size: 14px;">Prevent rogue copyleft code or leaked cloud keys from hitting your production branch. Block broken PRs instantly.</p>
            </div>
            <a href="https://simplebeacon.ai" class="upsell-btn">Deploy CI Actions Gate ($99/mo)</a>
        </div>
    </div>
</body>
</html>
    """
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)


def main():
    parser = argparse.ArgumentParser(description="Deep Node Supply Chain License Analyzer")
    parser.add_argument("--package-json", default="package.json")
    parser.add_argument("--lockfile", default="package-lock.json")
    parser.add_argument("--output", default="license-compliance-report.html")
    parser.add_argument("--dry-run", action="store_true", help="Simulate a scan with mock dependencies to verify report generation")
    args = parser.parse_args()

    cache = load_cache()
    raw_dependencies = {}

    if args.dry_run:
        print("[*] Running dry-run simulation mode with standard startup packages...")
        raw_dependencies = {
            "react": {"version": "18.2.0", "license": "MIT"},
            "lodash": {"version": "4.17.21", "license": "MIT"},
            "corrupt-net-module": {"version": "1.0.4", "license": "AGPL-3.0"},
            "legacy-parser": {"version": "3.2.1", "license": "GPL-3.0"},
            "unknown-utility": {"version": "0.0.1", "license": None}
        }
    else:
        if not os.path.exists(args.lockfile):
            print(f"[!] Critical Error: lockfile target '{args.lockfile}' not found. Cannot perform nested resolution.")
            sys.exit(1)

        print(f"[*] Parsing local Lockfile tree: {args.lockfile}...")
        try:
            with open(args.lockfile, 'r', encoding='utf-8') as f:
                lock_data = json.load(f)

            # Handle package-lock v2/v3 structures safely
            packages_dict = lock_data.get("packages", {})
            if packages_dict:
                for pkg_path, meta in packages_dict.items():
                    # skip root key ("" or "/")
                    if not pkg_path:
                        continue
                    # extract the package name after the last node_modules/
                    if 'node_modules/' in pkg_path:
                        name = pkg_path.split('node_modules/')[-1].strip('/')
                    else:
                        name = pkg_path.strip('/')
                    if name and "version" in meta:
                        raw_dependencies[name] = {
                            "version": meta["version"],
                            "license": meta.get("license")
                        }
            else:
                # Handle old package-lock v1 fallback structures
                deps_dict = lock_data.get("dependencies", {})
                for name, meta in deps_dict.items():
                    raw_dependencies[name] = {"version": meta.get("version"), "license": meta.get("license")}
        except Exception as e:
            print(f"[!] Parsing error failed: {str(e)}")
            sys.exit(1)

    print(f"[*] Resolving licensing types for {len(raw_dependencies)} unique components...")
    findings = []
    summary = {"critical": 0, "high": 0, "medium": 0, "total": len(raw_dependencies)}

    for pkg_name, info in raw_dependencies.items():
        license_str = info.get("license")

        # If license metadata isn't local, perform a registry lookup
        if not license_str or license_str == "UNKNOWN":
            license_str = fetch_live_npm_license(pkg_name, info.get("version") or "latest", cache)

        severity = LICENSE_RISK_MAP.get(license_str, "UNKNOWN")
        if severity == "CRITICAL":
            summary["critical"] += 1
        elif severity == "HIGH":
            summary["high"] += 1
        elif severity == "MEDIUM":
            summary["medium"] += 1

        findings.append({
            "package": pkg_name,
            "version": info.get("version") or "(unknown)",
            "license": license_str or "NOT DISCLOSED",
            "severity": severity,
            "description": RISK_DESCRIPTIONS.get(severity, RISK_DESCRIPTIONS["UNKNOWN"])
        })

    save_cache(cache)
    # Sort findings so critical risks always float to the top section of the ledger
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "UNKNOWN": 4, "SAFE": 5}
    findings.sort(key=lambda x: severity_order.get(x["severity"], 5))

    # Run AST secret scanner against the target directory and merge findings
    try:
        print("[*] Running localized Abstract Syntax Tree (AST) secret scanning pass...")
        ast_findings = run_ast_secret_scan(os.path.dirname(os.path.abspath(args.lockfile)))
        # Normalize and merge AST results into the compliance ledger
        for secret in ast_findings:
            sev = secret.get("severity", "CRITICAL")
            if sev == "CRITICAL":
                summary["critical"] += 1
            elif sev == "HIGH":
                summary["high"] += 1

            findings.append({
                "package": f"Source File: {os.path.basename(secret.get('file',''))}",
                "version": f"Line {secret.get('line','?')}",
                "license": "INTERNAL CODEBASE",
                "severity": sev,
                "description": f"⚠️ {secret.get('issue')}: {secret.get('description')}"
            })

        summary["total"] += len(ast_findings)
    except Exception:
        # If AST scanning fails, continue with the license-only report (do not crash the whole tool)
        pass
    generate_html_report(findings, summary, args.output)
    print(f"[+] Audit Report successfully written to local disk: {args.output}")

    # Evaluate against the enterprise failure threshold
    if summary.get("critical", 0) > 0 or summary.get("high", 0) > 0:
        print(f"\n[FAILURE] Compliance check failed! Found {summary.get('critical',0)} Critical and {summary.get('high',0)} High legal risks.")
        print("[-] Blocking deployment pipeline until dependencies are remediated.")
        sys.exit(1)

    print("\n[SUCCESS] No Critical or High license liabilities found. Compliance gate passed.")
    sys.exit(0)


if __name__ == "__main__":
    main()
