# SimpleBeacon Product Positioning

## What SimpleBeacon Actually Is

SimpleBeacon is an **offline AI code-audit tool** that catches AI-generated code debt — fiction KPIs, mock/sample paths leaked into production routes, credential patterns, LLM placeholder text — before it ships. It runs locally as a CLI, a VS Code extension, an MCP server for coding agents, and a CI gate. No source code is uploaded.

**Tagline (from the live site):** "Turn AI Code Debt Into Audit Evidence Before Regulators Find It."

---

## Target Personas

### 1. Developer using AI coding tools (Cursor, Copilot, Windsurf, Cline, Aider)
- **Profile:** Individual contributor or solo developer shipping code written with AI assistance
- **Pain point:** AI agents produce plausible-looking code that contains fabricated metrics, mock paths in production routes, placeholder text, and leaked credentials. You can't review every line by hand.
- **Goal:** Catch AI slop before it reaches commit, without slowing down
- **Budget:** $49/mo (Developer tier) or free CLI with limited features

### 2. Engineering team lead / VP Engineering
- **Profile:** Leads a team of 5+ developers using AI coding tools across a real codebase
- **Pain point:** AI-assisted PRs introduce subtle defects — fake KPIs that look real, sample JSON in prod endpoints, credentials in test fixtures that pass unit tests but leak in production. Reviewers can't tell what's real from what's hallucinated.
- **Goal:** A gate that blocks AI fiction at pre-commit and CI, with board-ready evidence for compliance reviews
- **Budget:** $149/mo (Team Pro, 5 seats) or $1,490/yr

### 3. Compliance officer / risk manager (EU AI Act, SOC 2)
- **Profile:** Responsible for AI system documentation and audit trails under EU AI Act Article 13, SOC 2, or internal governance
- **Pain point:** Can't verify whether AI-assisted code meets documentation requirements. No evidence that AI-generated artifacts were reviewed for hallucinations or credential leaks.
- **Goal:** Board-ready audit certificates and EU AI Act gap reports generated from local scan data — no source code leaves the machine
- **Budget:** $149 one-time (Audit Certificate), $499 (Executive Risk Certificate), $2,499 (EU AI Act Sprint), or custom enterprise

---

## Core Value Propositions

### 1. Catches what AI coding agents get wrong
38 deterministic analyzer engines detect AI fiction KPIs, mock/sample paths in production routes, credential patterns, LLM placeholder text, and token bleed — the specific failure modes of AI-assisted code. Not a general linter. Not a security operations platform. Purpose-built for AI code debt.

### 2. Zero source-code upload
Everything runs locally. The CLI scans on your machine. The MCP server runs in your editor. The VS Code extension runs in your sidebar. Only anonymized metadata (issue counts, type codes, repo fingerprint) leaves the machine — and only if telemetry is enabled. This is verifiable: the CLI works fully offline.

### 3. Works in every layer of your workflow
- **Pre-commit hook** — blocks AI fiction before it enters git history
- **CI gate** — `--gate` mode fails the build on blocking findings (credentials, AI heuristics)
- **MCP server** — coding agents (Cursor, Windsurf, Cline, Copilot, Aider) call `scan_snippet` before applying edits, `scan_file` after saves, `gate_status` before PRs
- **VS Code extension** — sidebar dashboard with scan results, certificates, and remediation playbooks
- **GitHub Action** — runs on every PR

---

## Elevator Pitch

*"AI coding agents ship code fast — but they hallucinate fake KPIs, leak credentials, and leave mock paths in production routes. SimpleBeacon is the offline gate that catches AI code debt before it ships. CLI, VS Code extension, MCP server for any coding agent, CI gate. 48 analyzers, 25 scan engines, zero source-code upload, board-ready audit certificates for EU AI Act and SOC 2."*

---

## What SimpleBeacon Is NOT

| Not this | Why it matters |
|---|---|
| Not a security operations platform (SIEM/SOAR) | It doesn't ingest threat intelligence, manage incidents, or do SIEM correlation |
| Not a compliance certification body | It generates gap reports and audit evidence from local scans — it doesn't certify you for SOC 2 or EU AI Act |
| Not a general-purpose linter | ESLint and Prettier catch syntax and style. SimpleBeacon catches AI-specific failure modes (fiction KPIs, mock paths in prod, LLM placeholders) |
| Not a SAST/DAST scanner | It doesn't do taint analysis or runtime vulnerability scanning. It catches AI code debt patterns. |
| Not an AI code generator | It doesn't write code. It audits code that AI tools wrote. |

---

## Competitor Landscape (honest)

| Tool | What it does | Where SimpleBeacon differs |
|---|---|---|
| ESLint / Prettier | Syntax and style linting | SimpleBeacon catches AI-specific patterns (fiction KPIs, mock paths, LLM placeholders) that linters don't detect |
| GitHub Copilot Chat | Inline AI assistance | Copilot writes code; SimpleBeacon audits what Copilot (and other agents) write |
| Snyk / Semgrep | Vulnerability scanning | Snyk finds known CVEs and dependency issues; SimpleBeacon finds AI hallucination patterns in source code |
| SonarQube | Code quality and technical debt | SonarQube measures complexity and coverage; SimpleBeacon detects AI-generated fiction and credential leaks |
| Manual code review | Human review of PRs | SimpleBeacon runs in seconds and catches patterns humans miss when reviewing AI-generated code at volume |

**Honest gap:** SimpleBeacon does not replace any of these tools. It fills a specific gap they don't cover: detecting the failure modes unique to AI-assisted code.

---

## Pricing (matches live site)

| Tier | Price | What you get |
|---|---|---|
| Free CLI | $0 | Local scans, limited analyzers, community use |
| Developer | $49/mo or $490/yr | Unlimited scans, CI gate, 48 analyzers |
| Team Pro | $149/mo or $1,490/yr | EU AI Act gap reports, SOC 2 board-ready certs, 5 seats |
| Audit Certificate | $149 one-time | Board-ready audit certificate from a single scan |
| Executive Risk Certificate | $499 one-time | Executive-grade risk clearance report |
| EU AI Act Sprint | $2,499 one-time | EU AI Act compliance sprint deliverable |
| Enterprise | Custom | Air-gapped, SSO/SAML, dedicated analyst, Book Demo |

---

## Priority Use Cases (real, not fabricated)

### Use Case 1: Pre-commit AI fiction gate
A developer using Cursor asks the AI to implement a billing endpoint. The AI writes code that looks correct but uses a mock Stripe key, hardcodes a sample customer ID, and reports a fake conversion rate KPI. SimpleBeacon's pre-commit hook blocks the commit and flags: credential pattern, mock/sample path in production route, fiction KPI.

### Use Case 2: CI gate on AI-assisted PRs
A team opens a PR where an AI agent refactored 40 files. The CI gate scan finds LLM placeholder text (`// TODO: implement this`) that passed through the agent, a `Math.random()` used for a security-relevant value, and an unpinned dependency. The gate fails. The developer fixes the findings and re-pushes.

### Use Case 3: EU AI Act audit evidence
A company building a high-risk AI system under EU AI Act Article 13 needs evidence that AI-assisted code was reviewed for hallucinations and credential leaks. They run `simplebeacon scan --gate --full` and generate a `.sbcert` certificate file that proves the scan ran, what it found, and that blocking issues were resolved. The certificate is board-ready and generated locally — no source code uploaded.

---

## Distribution Channels (all live as of 2026-08-20)

| Channel | Status | URL |
|---|---|---|
| Website | Live | https://simplebeacon.ai |
| npm CLI | Published (v1.1.5) | `npm install -g simplebeacon` |
| VS Code Marketplace | Published (v3.0.507) | `ext install simplebeacon.simplebeacon-vscode` |
| Stripe checkout | Live (Payment Links) | https://simplebeacon.ai/pricing |
| Email (Zoho SMTP) | Live | admin@simplebeacon.ai |
| GitHub repo | Live | github.com/tjp420/simplebeacon |

---

## Next Steps
- Validate messaging with 3-5 developers who use AI coding tools (Cursor, Copilot, Windsurf)
- Get the VS Code extension install count above 100 (currently 5)
- Write case studies from real usage (not fabricated metrics)
- Create demo video showing SimpleBeacon catching AI fiction in real-time
- Consider Hacker News launch post (draft exists in `marketing/hn-show-post.md`)
