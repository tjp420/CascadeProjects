# Enterprise Technical Demo — Architectural Deep-Dive Script

**For:** Enterprise procurement teams, CISOs, CTOs, security architects
**Duration:** 30 minutes (20 min demo + 10 min Q&A)
**Format:** Screen share via Zoom/Google Meet
**Prepared:** August 22, 2026

---

## Pre-Demo Preparation

### Environment Setup (15 min before call)
- [ ] Close unnecessary apps, clean desktop
- [ ] Open terminal with SimpleBeacon CLI ready
- [ ] Open VS Code with a demo repo loaded
- [ ] Open browser with dashboard at `https://simplebeacon.ai/app/`
- [ ] Have sample compliance certificate PDF open
- [ ] Have enterprise one-pager ready to share in chat
- [ ] Test screen share audio/video
- [ ] Have the DPA and security whitepaper URLs ready

### Demo Repo Preparation
Use a real-looking codebase with planted findings:
- 1 hardcoded API key (credential leak)
- 1 mock data path in production route (production leak)
- 1 TODO/FIXME in shipped code (AI slop)
- 1 hallucinated npm import (AI slop)
- 1 fake KPI value (AI slop)

---

## Demo Script (20 minutes)

### 1. Introduction & Problem Statement (2 min)

> "Thanks for taking the time. I'll keep this tight — 20 minutes of demo, then 10 minutes for your questions.

> The problem we're solving: AI coding assistants (Copilot, Cursor, Claude) ship code fast, but they introduce a new class of defects that traditional SAST tools don't catch — hallucinated dependencies, fake KPIs, placeholder code in production routes, and mock data paths that look valid but were never meant for production.

> SimpleBeacon is a local-first scanner that catches these before they ship. It runs entirely on your developers' machines — no source code leaves your infrastructure."

### 2. CLI Scan Demo (5 min)

**Screen: Terminal**

```bash
# Show the trust banner
npx simplebeacon scan --gate --offline

# Walk through the output:
# 1. Trust banner: "Local-only scan — code is not transmitted"
# 2. File count and scan time
# 3. Findings by severity
# 4. Gate result (PASS/FAIL)
```

**Talking points:**
- "The `--offline` flag makes the scan fail if ANY network activity is detected. This is your air-gapped guarantee."
- "The `--gate` flag returns a non-zero exit code if blocking findings exist — this is what wires into your CI/CD."
- "Notice the trust banner: 'Local-only scan — code is not transmitted.' This is printed on every run."
- "6,000 files scanned in 89 seconds on local hardware. No cloud round-trip."

### 3. VS Code Extension Demo (4 min)

**Screen: VS Code**

- Open a file with a planted finding
- Show the Problems panel with SimpleBeacon diagnostics
- Hover over a squiggly line to show the finding detail
- Open the SimpleBeacon sidebar — show the dashboard view
- Click through to a remediation suggestion

**Talking points:**
- "Developers see findings in real-time, before they even save the file."
- "The sidebar gives a project-wide view — severity breakdown, category counts, gate status."
- "No cloud API is invoked. The extension shells out to the local CLI."
- "48 analyzers across 8 categories — Technical AI Issues, Ethical & Societal, Economic & Regulatory, etc."

### 4. CI/CD Gate Demo (3 min)

**Screen: Browser — GitHub Actions**

- Show a sample PR with a blocking finding
- Show the GitHub Action comment with findings
- Show the gate status check failing

**Talking points:**
- "The GitHub Action runs the same scan as the CLI. If blocking findings exist, the PR is blocked."
- "This catches AI slop before it reaches your main branch."
- "Works with any CI — GitHub Actions, GitLab CI, Jenkins, Azure DevOps. It's just a CLI command."

### 5. Compliance Certificate Demo (3 min)

**Screen: Browser — sample certificate PDF**

- Show the Executive Risk Certificate PDF
- Walk through the structure: severity summary, finding details, EU AI Act mapping, SHA-256 seal
- Show the JSON export for regulatory submissions

**Talking points:**
- "This is what your auditor sees. It's a technical attestation — not a legal certification."
- "The SHA-256 seal anchors the report. Any tampering invalidates the certificate."
- "EU AI Act mappings reference specific articles — Article 13 (documentation), Annex III (high-risk requirements)."
- "For full legal conformity, you'd engage a qualified EU legal firm. We provide the technical evidence; they provide the legal sign-off."

### 6. Architecture & Security (3 min)

**Screen: Share enterprise one-pager in chat**

- Walk through the security architecture diagram
- Explain what leaves the machine (hash + aggregate counts only)
- Explain what never leaves (source code, file paths, issue descriptions)
- Explain the license token flow (JWT, local validation, offline)

**Talking points:**
- "Zero source-code upload is architecturally enforced, not just a policy."
- "The certify endpoint sends only a SHA-256 hash and aggregate counts. The full report never leaves the client."
- "License tokens are JWT (HS256) validated locally. After activation, no network is required."
- "Air-gapped mode: full functionality with zero internet after Docker image pull."

---

## Q&A Preparation (10 min)

### Top 10 Likely Questions

**Q1: "How do we verify that no source code is transmitted?"**
> "Three ways: (1) Run with `--offline` — the scan fails if any network activity is detected. (2) Review the source code — the CLI is Node.js, you can inspect every network call. (3) We provide a technical whitepaper with an independent verification methodology: https://simplebeacon.ai/security-whitepaper"

**Q2: "Can we run this in our own VPC / on-premise?"**
> "Yes. Three deployment options: SaaS (CLI + web dashboard), self-hosted (Render backend + Cloudflare Worker, or deploy to your own infrastructure), or air-gapped (Docker image with local license validation)."

**Q3: "How do you handle false positives?"**
> "Every finding includes the matched pattern, file path, and line number. Your team can review and allowlist false positives in `.simplebeacon/config.json`. The gate only blocks on critical/high severity by default — you configure the threshold."

**Q4: "What's your SOC 2 / ISO 27001 status?"**
> "SimpleBeacon is not SOC 2 Type II certified itself. We produce evidence-based artifacts that map to SOC 2 Trust Services Criteria. If you need a certified vendor, we can provide our security whitepaper and DPA for your procurement process."

**Q5: "How does pricing work for enterprise?"**
> "Enterprise is custom — air-gapped deployment, SSO/SAML, dedicated compliance analyst, custom rule development. The Compliance Suite at $399/mo covers most mid-market needs. Developer tier at $49/mo per seat for individual engineers."

**Q6: "Can we write custom rules?"**
> "Yes. Custom rules go in `.simplebeacon/config.json` via the `rules` and `allowlist` sections. Regex-based rules are supported in JSON format. Your AppSec team can author policy-specific rules that integrate with the 48 built-in analyzers. A standalone `.simplebeacon/rules/` directory for drop-in rule files is on the roadmap."

**Q7: "What languages does it support?"**
> "The regex rule engine is language-agnostic — 50 JSON rules apply to any language. The optional AST scanner uses @babel/parser for JavaScript/TypeScript only (4 structural rules). For Python, Go, and other languages, we use regex-based rules. Multi-language AST support is on the Q4 2026 roadmap."

**Q8: "How does this integrate with our existing SAST tools (Snyk, SonarQube)?"**
> "SimpleBeacon is complementary, not competitive. SAST tools scan for security vulnerabilities (SQL injection, XSS). SimpleBeacon scans for AI-specific patterns (hallucinated imports, fake KPIs, placeholder code). Run both — they catch different things."

**Q9: "What's your data retention policy?"**
> "We don't retain your source code — it never leaves your machine. The only data we store is: (1) license tokens (JWT, 1-year expiry), (2) Stripe customer records (payment processing), (3) aggregate scan counts (if you opt in to CI telemetry). Prospect data is deleted 180 days after last contact."

**Q10: "Who else is using this?"**
> "We're in late-stage beta with [N] companies. [If you have beta users, name them with permission. If not, say: 'We're launching our first enterprise pilots this month — you'd be among the first, which means you get direct founder access and influence on the roadmap.']"

---

## Post-Demo Follow-Up

### Within 2 hours:
- [ ] Send thank-you email with links to: enterprise one-pager, DPA, security whitepaper, pricing
- [ ] Share the sample certificate PDF and JSON export
- [ ] Offer a technical trial: "I can set up a 30-day enterprise trial for your team — no credit card required"

### Within 24 hours:
- [ ] Send a personalized follow-up addressing any specific questions from the call
- [ ] Share the GitHub repo link for their security team to review
- [ ] Offer a security architecture review session with their team

### Within 7 days:
- [ ] Send the DPA for signature if they're moving forward
- [ ] Schedule a technical onboarding session if trial is approved
- [ ] Connect them with a reference customer (if available)

### Within 30 days:
- [ ] Check in on trial usage
- [ ] Offer to run a scan on their actual codebase (under NDA, on their machine)
- [ ] Move to commercial discussion if trial is successful

---

## Demo Assets Checklist

| Asset | Location | Status |
|-------|----------|--------|
| Enterprise one-pager | `marketing/outreach/enterprise-one-pager.md` | Ready |
| DPA | https://simplebeacon.ai/dpa | Live |
| Security whitepaper | https://simplebeacon.ai/security-whitepaper | Live |
| Sample certificate | https://simplebeacon.ai/sample-certificate | Live |
| Pricing page | https://simplebeacon.ai/pricing | Live |
| GitHub repo | https://github.com/tjp420/simplebeacon | Verify public |
| VS Code extension | Search "SimpleBeacon" in marketplace | Published |
| CLI | `npx simplebeacon scan` | Live |
| Demo repo with planted findings | Prepare locally | Needed |
