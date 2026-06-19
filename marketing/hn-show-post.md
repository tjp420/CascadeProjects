# Show HN: SimpleBeacon — catch AI-generated slop before it ships

**TL;DR:** A CLI + IDE extension that scans your codebase for AI hallucinations, hardcoded credentials, and copy-paste bloat. Runs entirely offline. Generates board-ready PDF certificates for compliance audits.

## Why I built this

By mid-2026, 51% of GitHub commits are AI-assisted. That's great for velocity, terrible for code quality. I've seen:
- Mock data with hardcoded `admin@company.com` passwords committed to production
- Empty `// filler` blocks left by Copilot that pass code review
- The same AI-generated helper function copied into 12 different files

Existing tools (Snyk, SonarQube) catch security bugs and code smells. None of them specifically target *AI-generated artifacts*.

## What it does

**CLI scan** (`npx simplebeacon scan --gate`):
- Detects hardcoded AI responses, filler stubs, unbounded LLM calls
- Credential pattern scanning with allowlists for test data
- Duplicate file detection via content hashing
- Works offline — no source code ever leaves your machine

**IDE Extension** (VS Code):
- Runs gate scan on file save
- Shows slop score in status bar
- Pops upgrade CTA when gate fails

**GitHub Action**:
- Posts PR comments with severity breakdown
- Fails CI if gate doesn't pass

**Executive Certificate** ($499):
- Upload scan JSON → get board-ready PDF with SHA-256 integrity seal
- EU AI Act Sprint ($2,499) for regulatory readiness

## What's different

- **Offline-first:** Zero network calls. Works in air-gapped environments.
- **AI-specific:** AST-based detection of AI hallucination patterns, not just general linting
- **Compliance-ready:** Generates evidence packs auditors can independently verify

## Free tier

- 5 findings per scan
- Quality score hidden
- Upgrade CTA in output

Paid tiers unlock unlimited findings, quality score, PDF certificates, and team dashboard.

## Links

- Website: https://simplebeacon.ai
- CLI: `npm install -g simplebeacon-cli`
- GitHub Action: `simplebeacon/guardrails`
- VS Code Extension: Marketplace link (coming)

## Ask me anything

Particularly interested in feedback from:
- Teams using AI coding tools in regulated industries
- Compliance officers dealing with EU AI Act deadlines
- Anyone who's shipped AI-generated slop to production

---

*Built solo over 6 months. Revenue so far: $0. Let's see if HN changes that.*
