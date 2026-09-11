#!/usr/bin/env python3
"""Simple Leads Manager for SimpleBeacon outreach.

Usage examples:
  Add a lead:
    python tools/leads_manager.py add --file leads/leads_template.csv --company "DevDoc Inc" --contact "Marcus Vance" --title "VP Eng" --linkedin "https://..." --trigger "Hiring Node Devs" --funding "$2M" --eng 7

  List leads:
    python tools/leads_manager.py list --file leads/leads_template.csv

  Update status:
    python tools/leads_manager.py update --file leads/leads_template.csv --contact "Marcus Vance" --status "Contacted" --date "2026-09-05"

  Generate outreach messages for a contact:
    python tools/leads_manager.py message --file leads/leads_template.csv --contact "Marcus Vance" --channel linkedin

This is intentionally dependency-free (stdlib only).
"""
import csv
import argparse
import sys
import json
from pathlib import Path
import re
from html import unescape


def clean_linkedin_url(url: str) -> str:
    if not url:
        return ""
    u = url.strip().lower()
    u = re.sub(r"^https?://", "", u)
    u = re.sub(r"^www\.", "", u)
    if u.endswith("/"):
        u = u[:-1]
    return u

TEMPLATE_FIELDS = [
    "Company",
    "ContactName",
    "Title",
    "LinkedIn",
    "GitHub",
    "TriggerEvent",
    "Funding",
    "EngTeamSize",
    "Status",
    "DateContacted",
    "NextAction",
    "Notes",
    "LockfileReceived",
    "ReportSent",
    "PipelineValue",
]

LINKEDIN_MSG = (
    "Hey {first}, congrats on growing the engineering team post-funding! Quick question: "
    "A major roadblock for B2B teams closing enterprise procurement is hidden, viral AGPL/copyleft licenses buried deep in sub-dependencies. "
    "I built a local parser that scans `package-lock.json` metadata for these legal blockers without accessing source code. "
    "I’m running a few confidential audits this week — would you be open to dropping a lockfile so I can run a quick check?"
)

EMAIL_TEMPLATE = (
    "Subject: Code supply chain risks at {company}\n\n"
    "Hi {first},\n\n"
    "When B2B startups hit unexpected legal friction during enterprise acquisition, it's often due to an open-source package with a viral license (e.g., AGPL-3.0) buried in sub-dependencies. "
    "I reached out on LinkedIn about SimpleBeacon's localized Node license analyzer — it only parses dependency metadata, so your actual source stays private.\n\n"
    "If you'd like an executive HTML compliance ledger to review with your team or board, reply with your project's lockfile and I'll send the dashboard within 24 hours.\n\n"
    "Best regards,\n"
    "[Your Name]\n"
)


def ensure_file(path: Path):
    if not path.exists():
        # create with header
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=TEMPLATE_FIELDS)
            writer.writeheader()


def add_lead(args):
    path = Path(args.file)
    ensure_file(path)
    row = {k: "" for k in TEMPLATE_FIELDS}
    row["Company"] = args.company
    row["ContactName"] = args.contact
    row["Title"] = args.title or ""
    row["LinkedIn"] = args.linkedin or ""
    row["GitHub"] = args.github or ""
    row["TriggerEvent"] = args.trigger or ""
    row["Funding"] = args.funding or ""
    row["EngTeamSize"] = str(args.eng or "")
    row["Status"] = "New"
    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=TEMPLATE_FIELDS)
        writer.writerow(row)
    print(f"Added lead {args.contact} @ {args.company} to {path}")


def list_leads(args):
    path = Path(args.file)
    ensure_file(path)
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        if not rows:
            print("No leads yet.")
            return
        for r in rows:
            print(f"{r['ContactName']} (@ {r['Company']}) — {r['Title']} — Status: {r['Status']}")


def update_lead(args):
    path = Path(args.file)
    ensure_file(path)
    updated = False
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r["ContactName"] == args.contact:
                if args.status:
                    r["Status"] = args.status
                if args.date:
                    r["DateContacted"] = args.date
                if args.next:
                    r["NextAction"] = args.next
                updated = True
            rows.append(r)
    if not updated:
        print(f"Contact {args.contact} not found.")
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=TEMPLATE_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Updated {args.contact} in {path}")


def generate_message(args):
    path = Path(args.file)
    ensure_file(path)
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if getattr(args, 'batch', False):
        if not rows:
            print("No leads to message.")
            return

        # Build generated output list
        generated_output = []
        for i, r in enumerate(rows, start=1):
            contact_name = (r.get("ContactName") or r.get("contact") or "").strip()
            if not contact_name:
                continue
            first = contact_name.split()[0]
            company = (r.get("Company") or r.get("company") or "").strip()
            trigger = (r.get("TriggerEvent") or r.get("trigger") or r.get("Trigger") or "recent engineering growth").strip()

            if args.channel == "linkedin":
                msg = (
                    f"--- LINKEDIN MESSAGE FOR: {contact_name} ({company}) ---\n"
                    f"Hey {first}, congrats on growing the engineering team post-funding! Quick question for you: A major roadblock for B2B teams moving upmarket right now is compliance rejection due to hidden, viral AGPL/copyleft licenses buried deep in sub-dependencies or hardcoded credentials.\n\n"
                    f"I noticed your team's trigger: '{trigger}'. I built a completely air-gapped, local parser that scans lockfiles and AST nodes without accessing actual source code. I'm running a few complementary, confidential audits for CTOs this week to get product feedback. Would you be open to dropping a lockfile over to see what it catches?\n"
                )
            else:
                msg = (
                    f"--- EMAIL TO: {contact_name} ({company}) ---\n"
                    f"Subject: Code supply chain risks at {company}\n\n"
                    f"Hi {first},\n\n"
                    f"When B2B startups hit unexpected legal friction or delays during enterprise acquisition cycles, it's rarely due to their core product. Usually, a corporate legal audit flags an open-source package wrapped in a viral license (like AGPL-3.0) that technically compromises their proprietary IP.\n\n"
                    f"Context: {trigger}\n\n"
                    f"I built SimpleBeacon's localized Node license analyzer to protect pipelines. Because it only parses dependency metadata, your actual source code remains 100% private and never leaves your local system.\n\n"
                    f"If you'd like a clean, executive HTML compliance ledger to review with your team, simply reply with your project's lockfile. I'll run the audit and send the dashboard back within 24 hours.\n\n"
                    f"Best regards,\n[Your Name]\n"
                )

            generated_output.append(f"[{i}] To: {contact_name} (@ {company})\n{msg}")

        full_text = "\n\n".join(generated_output)

        out_path = getattr(args, 'out', None)
        if out_path:
            try:
                outp = Path(out_path)
                outp.parent.mkdir(parents=True, exist_ok=True)
                append_mode = getattr(args, 'append', False)
                mode = 'a' if append_mode else 'w'
                # If appending and file exists, write a header to separate runs
                if append_mode and outp.exists() and outp.stat().st_size > 0:
                    with open(outp, 'a', encoding='utf-8') as f:
                        f.write(f"\n=== APPENDED BATCH RUN: {args.channel.upper()} ===\n")
                with open(outp, mode, encoding='utf-8') as f:
                    f.write(full_text)
                action_verb = "appended to" if append_mode else "written to"
                print(f"[+] Bulk outreach copy successfully {action_verb} local disk: {out_path}")
                print(f"[*] Total customized scripts compiled: {len(generated_output)}")
            except Exception as e:
                print(f"[!] Writing batch file failed: {e}")
        else:
            print(f"--- Batch message preview ({len(generated_output)} leads) ---")
            print(full_text)
            print("--- End batch preview ---")
        return

    # single contact flow
    for r in rows:
        if r["ContactName"] == args.contact:
            first = r["ContactName"].split()[0]
            if args.channel == "linkedin":
                print(LINKEDIN_MSG.format(first=first))
            else:
                print(EMAIL_TEMPLATE.format(first=first, company=r["Company"]))
            return
    print(f"Contact {args.contact} not found in {path}")


def export_markdown(args):
    path = Path(args.file)
    ensure_file(path)
    out = Path(args.out or "leads/report.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    with open(out, "w", encoding="utf-8") as f:
        f.write("# Leads Report\n\n")
        for r in rows:
            f.write(f"- **{r['Company']}** — {r['ContactName']} ({r['Title']}) — Status: {r['Status']} — Trigger: {r['TriggerEvent']}\n")
    print(f"Wrote markdown report to {out}")


def parse_html_report(report_path):
    """Lightweight HTML parser to extract findings rows from the analyzer report."""
    html = Path(report_path).read_text(encoding='utf-8')
    # Find table body rows
    rows = []
    # Match <tr>...</tr>
    tr_matches = re.findall(r"<tr>\s*(.*?)\s*</tr>", html, flags=re.S | re.I)
    for tr in tr_matches:
        # find all td contents
        tds = re.findall(r"<td.*?>(.*?)</td>", tr, flags=re.S | re.I)
        if len(tds) >= 5:
            pkg = re.sub(r"<.*?>", "", tds[0]).strip()
            ver = re.sub(r"<.*?>", "", tds[1]).strip()
            lic = re.sub(r"<.*?>", "", tds[2]).strip()
            sev = re.sub(r"<.*?>", "", tds[3]).strip()
            desc = re.sub(r"<.*?>", "", tds[4]).strip()
            rows.append({
                'package': unescape(pkg).strip(),
                'version': unescape(ver).strip(),
                'license': unescape(lic).strip(),
                'severity': unescape(sev).strip(),
                'description': unescape(desc).strip(),
            })
    return rows


def suggest_replacement(package_name, license_name):
    """Return a suggested permissive replacement for common package patterns."""
    name = package_name.lower()
    # heuristics
    if any(k in name for k in ("parser", "xml", "html", "cheerio", "parse")):
        return ("cheerio", "MIT")
    if any(k in name for k in ("request", "fetch", "http", "net", "socket", "axios")):
        return ("axios / native fetch", "MIT")
    if any(k in name for k in ("lodash", "underscore", "utils", "util")):
        return ("lodash (latest, MIT) or native helpers", "MIT")
    if any(k in name for k in ("crypto", "encrypt", "jwt")):
        return ("use Node built-in `crypto` / vetted libs (MIT/Apache-2.0)", "MIT/Apache-2.0")
    # fallback by license
    if license_name and "agpl" in license_name.lower():
        return ("replace with permissive alternative (e.g., axios/fetch or a maintained MIT client)", "MIT")
    if license_name and "gpl" in license_name.lower():
        return ("replace with permissive alternative or vendor minimal utility under approved license", "MIT/Apache-2.0")
    return ("replace with a maintained permissive alternative (MIT/Apache-2.0)", "MIT/Apache-2.0")


def generate_remediation_markdown(findings, company=None, your_name=None):
    blocked = [f for f in findings if f['severity'].upper() in ("CRITICAL", "HIGH")]
    if not blocked:
        return "# No Critical/High license issues found. No remediation required.\n"

    md = []
    md.append("## 🛡️ Compliance Remediation: License Vulnerability Fix\n")
    md.append("### 1. The Conflict\n")
    for f in blocked:
        md.append(f"* **Blocked Package:** `{f['package']}@{f['version']}`\n  * **License:** `{f['license']}` ({f['severity'].title()} Risk)\n  * **Implication:** {f['description']}\n")

    md.append("---\n\n### 2. Resolution Summary\n")
    for f in blocked:
        replacement, repl_license = suggest_replacement(f['package'], f.get('license', ''))
        md.append(f"* **Removed / Replaced:** `{f['package']}`\n  * **Replaced With:** {replacement} (License: `{repl_license}`)\n")

    md.append("---\n\n### 3. Verification Checklist\n")
    md.append("- [ ] Run local compliance audit check: `python node_license_analyzer.py --package-json package.json --lockfile package-lock.json --output license-compliance-report.html`\n")
    md.append("- [ ] Verified local registry cache updated at `.cache/npm-licenses.json`\n")
    md.append("- [ ] Total Critical / High risks in generated `license-compliance-report.html` is now **0**.\n")
    md.append("- [ ] All deep sub-dependencies conform to permissive corporate standards (MIT, Apache-2.0, ISC, BSD).\n")

    md.append("---\n\n### 4. Files / Changes in this PR\n")
    md.append("- `package.json` — dependency removal / replacement\n- `package-lock.json` — updated lockfile\n")

    md.append("---\n\n### 5. Release / Rollout Notes\n")
    md.append("- This change is safe to ship after CI passes.\n- Monitor relevant production traces for 48 hours after deployment.\n")

    if your_name:
        md.append(f"\nBest regards,\n{your_name}\n")

    return "\n".join(md)


def remediate_cmd(args):
    report_path = Path(args.report)
    if not report_path.exists():
        print(f"Report not found: {report_path}")
        sys.exit(1)

    findings = parse_html_report(report_path)
    md = generate_remediation_markdown(findings, company=args.company, your_name=args.your_name)
    outp = Path(args.out)
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(md, encoding='utf-8')
    print(f"Wrote remediation markdown to {outp}")


def import_csv_cmd(args):
    src = Path(args.source)
    db = Path(args.file)
    if not src.exists():
        print(f"[!] Error: Source CSV '{src}' does not exist.")
        return

    print(f"[*] Ingesting leads from: {src} -> {db}")

    # Read source CSV
    with open(src, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        source_fieldnames = reader.fieldnames or []
        # validate minimal headers (case-insensitive)
        required = {"company", "contact", "title", "linkedin"}
        lower_fields = {h.lower() for h in source_fieldnames}
        if not required.issubset(lower_fields):
            print(f"[!] Structural Error: Source CSV is missing mandatory fields: {sorted(required - lower_fields)}")
            return
        src_rows = list(reader)

    # Read existing DB header (if present) to preserve canonical schema
    db_fieldnames = None
    existing_identifiers = set()
    existing_linkedin = set()
    if db.exists():
        with open(db, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            db_fieldnames = reader.fieldnames or []
            for r in reader:
                comp = (r.get("Company") or r.get("company") or r.get("CompanyName") or "").strip().lower()
                contact = (r.get("ContactName") or r.get("contact") or r.get("Contact") or "").strip().lower()
                li = clean_linkedin_url(r.get("LinkedIn") or r.get("linkedin") or r.get("Linkedin") or "")
                if comp and contact:
                    existing_identifiers.add((contact, comp))
                if li:
                    existing_linkedin.add(li)

    # If DB missing, build a reasonable target schema from source
    if not db_fieldnames:
        # prefer a normalized template if possible
        db_fieldnames = [h for h in TEMPLATE_FIELDS]

    imported = 0
    skipped = 0
    rows_to_append = []

    # helper to map source row keys case-insensitively and enhanced dedupe
    for r in src_rows:
        src_map = {k.lower(): (v or "") for k, v in r.items()}
        comp = src_map.get("company", "").strip()
        contact = src_map.get("contact", "").strip()
        linkedin_raw = src_map.get("linkedin", "") or src_map.get("linkedin_url", "")
        linkedin_norm = clean_linkedin_url(linkedin_raw)

        if not comp or not contact:
            skipped += 1
            continue

        idt = (contact.strip().lower(), comp.strip().lower())
        # enhanced dedupe: check existing identifiers and linkedin URLs
        if idt in existing_identifiers or (linkedin_norm and linkedin_norm in existing_linkedin):
            skipped += 1
            continue

        # build a row that matches db_fieldnames
        out_row = {k: "" for k in db_fieldnames}
        out_row_keys = {k.lower(): k for k in db_fieldnames}

        # map values
        if "company" in out_row_keys:
            out_row[out_row_keys["company"]] = comp
        if "contactname" in out_row_keys:
            out_row[out_row_keys["contactname"]] = contact
        if "title" in out_row_keys:
            out_row[out_row_keys["title"]] = src_map.get("title", "")
        if "linkedin" in out_row_keys:
            out_row[out_row_keys["linkedin"]] = linkedin_raw
        if "triggerevent" in out_row_keys:
            out_row[out_row_keys["triggerevent"]] = src_map.get("trigger", "")
        if "funding" in out_row_keys:
            out_row[out_row_keys["funding"]] = src_map.get("funding", "")
        if "engteamsize" in out_row_keys:
            out_row[out_row_keys["engteamsize"]] = src_map.get("eng_team", src_map.get("eng", ""))

        # status default
        status_key = out_row_keys.get("status")
        if status_key:
            out_row[status_key] = args.status or "NEW"

        rows_to_append.append(out_row)
        existing_identifiers.add(idt)
        if linkedin_norm:
            existing_linkedin.add(linkedin_norm)
        imported += 1

    # preview if requested
    if getattr(args, "preview", 0):
        n = int(args.preview)
        print(f"--- Preview first {n} rows from source ({len(src_rows)} total) ---")
        for i, r in enumerate(src_rows[:n], start=1):
            print(f"{i}. {r}")
        print("--- End preview ---")
        # interactive confirmation guard
        if getattr(args, "preview_confirm", False):
            try:
                ans = input(f"Proceed with importing these {min(n, len(rows_to_append))} deduplicated rows into '{db}'? (y/N): ")
            except KeyboardInterrupt:
                print("\n[!] Import cancelled by user.")
                return
            if ans.strip().lower() not in ("y", "yes"):
                print("[!] Import aborted by user.")
                return

    # Append to DB file
    db.parent.mkdir(parents=True, exist_ok=True)
    file_is_new = not db.exists() or db.stat().st_size == 0
    with open(db, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=db_fieldnames)
        if file_is_new:
            writer.writeheader()
        for nr in rows_to_append:
            writer.writerow(nr)

    print(f"[+] Bulk import complete: {imported} new leads added, {skipped} skipped.")


def add_bulk_cmd(args):
    src = Path(args.source)
    db = Path(args.file)
    if not src.exists():
        print(f"[!] Error: Source JSON '{src}' does not exist.")
        return

    print(f"[*] Adding bulk leads from JSON: {src} -> {db}")
    with open(src, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except Exception as e:
            print(f"[!] Failed to parse JSON: {e}")
            return

    if not isinstance(data, list):
        print("[!] Expected a JSON array of lead objects")
        return

    ensure_file(db)
    # load existing identifiers
    existing = set()
    with open(db, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            comp = (r.get("Company") or "").strip().lower()
            contact = (r.get("ContactName") or "").strip().lower()
            if comp and contact:
                existing.add((contact, comp))

    appended = 0
    rows = []
    for item in data:
        comp = (item.get("company") or item.get("Company") or "").strip()
        contact = (item.get("contact") or item.get("ContactName") or "").strip()
        if not comp or not contact:
            continue
        idt = (contact.lower(), comp.lower())
        if idt in existing:
            continue
        # create canonical row
        row = {k: "" for k in TEMPLATE_FIELDS}
        row["Company"] = comp
        row["ContactName"] = contact
        row["Title"] = item.get("title") or item.get("Title") or ""
        row["LinkedIn"] = item.get("linkedin") or item.get("LinkedIn") or ""
        row["TriggerEvent"] = item.get("trigger") or item.get("Trigger") or ""
        row["Funding"] = item.get("funding") or item.get("Funding") or ""
        row["EngTeamSize"] = str(item.get("eng_team") or item.get("eng") or item.get("EngTeamSize") or "")
        row["Status"] = item.get("status") or args.status or "NEW"
        rows.append(row)
        existing.add(idt)
        appended += 1

    # append rows
    with open(db, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=TEMPLATE_FIELDS)
        for r in rows:
            writer.writerow(r)

    print(f"[+] Added {appended} new leads to {db}")




def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd")

    a = sub.add_parser("add")
    a.add_argument("--file", default="leads/leads_template.csv")
    a.add_argument("--company", required=True)
    a.add_argument("--contact", required=True)
    a.add_argument("--title")
    a.add_argument("--linkedin")
    a.add_argument("--github")
    a.add_argument("--trigger")
    a.add_argument("--funding")
    a.add_argument("--eng", type=int)
    a.set_defaults(func=add_lead)

    l = sub.add_parser("list")
    l.add_argument("--file", default="leads/leads_template.csv")
    l.set_defaults(func=list_leads)

    u = sub.add_parser("update")
    u.add_argument("--file", default="leads/leads_template.csv")
    u.add_argument("--contact", required=True)
    u.add_argument("--status")
    u.add_argument("--date")
    u.add_argument("--next")
    u.set_defaults(func=update_lead)

    m = sub.add_parser("message")
    m.add_argument("--file", default="leads/leads_template.csv")
    m.add_argument("--contact", required=True)
    m.add_argument("--channel", choices=["linkedin", "email"], default="linkedin")
    m.add_argument("--batch", dest="batch", action="store_true", help="Send messages for all leads in the file (preview to console)")
    m.add_argument("--out", dest="out", help="When used with --batch, write the compiled messages to this file")
    m.add_argument("--append", dest="append", action="store_true", help="Append to the output file instead of overwriting when used with --out")
    m.set_defaults(func=generate_message)

    e = sub.add_parser("export")
    e.add_argument("--file", default="leads/leads_template.csv")
    e.add_argument("--out")
    e.set_defaults(func=export_markdown)

    r = sub.add_parser("remediate")
    r.add_argument("--report", default="license-compliance-report.html", help="Path to the HTML report generated by the scanner")
    r.add_argument("--out", default="outreach/remediation_body.md", help="Output markdown file for PR body")
    r.add_argument("--company", help="Company name to personalize the remediation")
    r.add_argument("--your-name", help="Your name to sign the remediation note")
    r.set_defaults(func=remediate_cmd)

    imp = sub.add_parser("import-csv")
    imp.add_argument("source", help="Path to source CSV to import")
    imp.add_argument("--file", default="leads/leads_template.csv", help="Target leads DB file")
    imp.add_argument("--status", default="NEW", help="Default status to assign to imported leads (NEW/PENDING)")
    imp.add_argument("--preview", type=int, default=0, help="Preview first N rows from source before importing")
    imp.add_argument("--preview-confirm", dest="preview_confirm", action="store_true", help="When previewing, require interactive confirmation before importing")
    imp.set_defaults(func=import_csv_cmd)

    ab = sub.add_parser("add-bulk")
    ab.add_argument("source", help="Path to JSON file containing an array of lead objects")
    ab.add_argument("--file", default="leads/leads_template.csv", help="Target leads DB file")
    ab.add_argument("--status", default="NEW", help="Default status for added leads")
    ab.set_defaults(func=add_bulk_cmd)

    args = p.parse_args()
    if not args.cmd:
        p.print_help()
        sys.exit(1)
    args.func(args)


if __name__ == "__main__":
    main()
