# Procurement Q&A — Edge Case Technical Responses

**For:** Enterprise procurement, security architecture reviews, vendor assessments
**Purpose:** Detailed technical answers for questions that go beyond the top 10 in the demo script
**Updated:** August 22, 2026

---

## Tier 1: Questions That Can Kill Deals

These are questions where a vague or incorrect answer will end the conversation. Be precise.

### Q11: "Can you show us the actual network calls the CLI makes during a scan?"

**Answer:**
> "Yes. The CLI is Node.js — you can inspect every line. During a standard scan (`simplebeacon scan --gate --offline`), zero network calls are made. The `--offline` flag activates a network guard that throws if any `fetch()`, `http.request()`, or `https.request()` is invoked. You can verify this in `src/lib/offline-guard.js`.

> Without `--offline`, the only network call is optional CI telemetry — and only if three conditions are met: (1) the user has a paid license token, (2) the `SIMPLEBEACON_LICENSE_TOKEN` env var is set, and (3) the `--offline` flag is not passed. The telemetry payload contains aggregate counts only — severity rollup, category rollup, file count. No source code, file paths, or issue descriptions. You can see the exact payload in `src/lib/ci-telemetry.js`."

### Q12: "What's your SSO/SAML implementation and which IdPs do you support?"

**Answer (honest):**
> "SSO/SAML is on the Enterprise roadmap but is not yet implemented. The current authentication is JWT-based license tokens validated locally. For your enterprise tier, we'd implement SAML 2.0 integration with your IdP (Okta, Azure AD, Google Workspace) as part of the onboarding — typically a 2-4 week implementation.

> If SSO is a hard requirement for your procurement process, we can scope it as a Phase 1 deliverable in the enterprise contract. The license token system is already JWT-based, so SSO integration is an authentication layer change, not an architecture rewrite."

**Why this matters:** Do NOT claim SSO is implemented. It's not. Procurement teams will verify.

### Q13: "Do you have a Docker image for air-gapped deployment?"

**Answer (honest):**
> "The CLI runs as a Node.js package (`npx simplebeacon` or `npm install -g simplebeacon-cli`). For air-gapped environments, you install it from a local npm registry or bundle the `node_modules` directory. We don't currently ship a Docker image, but it's straightforward to containerize — the CLI has no external runtime dependencies beyond Node.js 18+.

> If a Docker image is a procurement requirement, we can provide one as part of the enterprise onboarding. The license validation is already local (JWT HS256), so no network connectivity is needed after installation."

**Why this matters:** Do NOT claim a Docker image exists. It doesn't. But the path to one is trivial.

### Q14: "Can we write custom rules in our own format, or only in your format?"

**Answer:**
> "Custom rules are supported via the `.simplebeacon/config.json` file. The config schema includes an `allowlist` array for suppressing false positives and a `rules` section for custom patterns. Rules are JSON-based — you define a regex pattern, severity, and category. The rule engine applies them alongside the 48 built-in analyzers.

> For more complex rules, the scanner supports JavaScript-based custom analyzers. Your AppSec team can write a Node.js module that exports an `analyze()` function and place it in the SimpleBeacon config directory. The AST scanner (`javascript-ast-scanner.js`) is also extensible for JS/TS-specific structural rules.

> What we don't currently support: a standalone `.simplebeacon/rules/` directory for drop-in rule files. That's on the roadmap. Today, custom rules go in the config file."

### Q15: "What happens if your backend goes down? Does the CLI stop working?"

**Answer:**
> "No. The CLI has no runtime dependency on our backend. Scanning, the CI gate, and the VS Code extension all work with zero internet connectivity. The only thing that requires our backend is:
> 1. Initial license activation (one-time, generates a local JWT)
> 2. Stripe checkout (payment processing)
> 3. Certificate signing (optional, sends only a hash)
> 4. CI telemetry (optional, opt-in, paid tokens only)

> If our backend is completely down, your developers can still scan, gate PRs, and use the VS Code extension. Existing license tokens remain valid until their expiration date (1 year). The CLI validates tokens locally using HMAC-SHA256 — no network call needed."

---

## Tier 2: Questions That Signal Deep Technical Evaluation

These questions mean the prospect is seriously evaluating. Answer well and you advance to procurement.

### Q16: "How do you handle monorepo structures with shared dependencies?"

**Answer:**
> "The scanner walks the directory tree from the project root. It respects `.gitignore` by default and supports a `.simplebeaconignore` file for additional exclusions. For monorepos, you can scope scans to specific packages using `simplebeacon scan --path packages/api` or scan the entire workspace. The `--diff-only` flag scans only changed files, which is useful for CI in large monorepos."

### Q17: "What's your false positive rate and how do you measure it?"

**Answer:**
> "We don't publish a false positive rate because it's highly dependent on the codebase. What I can tell you: the default gate only blocks on critical and high severity findings. Medium and low are reported but don't fail the gate. Your team can allowlist false positives in `.simplebeacon/config.json` — once allowlisted, they won't appear in future scans.

> The rule definitions are in `src/rules/*.json` — you can inspect every pattern before running a scan. There are 50 rule entries across 5 files. Each rule has a clear pattern, severity, and category. If a rule produces too many false positives in your codebase, you can disable it individually."

### Q18: "How does the AST scanner work and what does it catch that regex doesn't?"

**Answer:**
> "The AST scanner (`javascript-ast-scanner.js`) parses JavaScript and TypeScript using @babel/parser (with jsx and typescript plugins). It's an optional layer — if @babel/parser isn't installed, the scanner falls back to regex-only mode. It currently has 4 structural rules:
> - SB-JS-FICTION-001: Hardcoded placeholder or mock-path string detected via AST
> - SB-JS-FICTION-002: Function returns only null/undefined — likely AI stub
> - SB-JS-TB-001: LLM call without max_tokens / max_completion_tokens
> - SB-JS-EU-001: EU AI Act Annex III high-risk identifier matching
>
> These catch structural patterns that regex can't — like a function body that only returns null (an AI-generated stub). Regex would see the `return null`; the AST scanner sees the full function context and flags it as a likely stub.

> AST scanning is currently JavaScript/TypeScript-specific. For Python, Go, and other languages, we use the 50 regex-based rules. Multi-language AST support is on the Q4 2026 roadmap."

### Q19: "Can you integrate with our SIEM (Splunk, Datadog, Elastic)?"

**Answer:**
> "The CLI outputs JSON reports (`--format json --output report.json`). You can forward these to any SIEM via a log shipper (Filebeat, Fluentd, Datadog Agent). The JSON schema includes: severity, category, file path, line number, rule ID, and remediation suggestion. We don't have a native Splunk integration, but the JSON export is structured for easy ingestion.

> For CI telemetry, the aggregate payload (severity rollup, category rollup) can be sent to a webhook URL of your choice via the `SIMPLEBEACON_CI_TELEMETRY_URL` env var. This lets you route telemetry to your SIEM instead of our backend."

### Q20: "What's your vulnerability disclosure policy and bug bounty program?"

**Answer:**
> "We have a SECURITY.md at https://simplebeacon.ai/security with our vulnerability disclosure policy. Researchers can report issues to admin@simplebeacon.ai. We commit to a 72-hour initial response and a 90-day disclosure timeline. We don't currently run a bug bounty program, but we're evaluating platforms (HackerOne, Bugcrowd) for Q4 2026.

> For critical vulnerabilities, we issue a security advisory via GitHub Security Advisories and notify all active license holders via email."

---

## Tier 3: Questions About Competitive Positioning

### Q21: "We already use Snyk. Why do we need SimpleBeacon?"

**Answer:**
> "Snyk scans for known vulnerabilities in dependencies (CVEs) and container images. SimpleBeacon scans for AI-generated code defects — hallucinated imports, fake KPIs, placeholder code, mock paths in production. These are different problem spaces. Snyk won't catch a `TODO: replace with real data` in a production route. SimpleBeacon won't catch a CVE in `lodash@4.17.20`.

> Run both. Snyk for dependency vulnerabilities, SimpleBeacon for AI code hygiene. They're complementary. The CI gate can run sequentially — Snyk first, SimpleBeacon second."

### Q22: "GitHub Copilot has built-in security features. Why do we need a separate scanner?"

**Answer:**
> "Copilot's built-in features are real-time IDE suggestions — they help developers write better code in the moment. SimpleBeacon is a batch scanner that runs across the entire codebase, including code that was written before Copilot's security features existed, code written by other AI tools (Cursor, Claude, ChatGPT-pasted code), and code written by humans that has AI-generated patterns.

> Copilot catches issues at write time. SimpleBeacon catches issues at commit time and CI time. Different checkpoints, different value."

### Q23: "SonarQube has AI Code Assurance. How are you different?"

**Answer:**
> "SonarQube's AI Code Assurance is a badge system — it confirms that a developer used SonarQube to review AI-generated code. It doesn't specifically detect AI-generated patterns. SimpleBeacon's 48 analyzers are built specifically to detect AI slop: hallucinated imports, fake KPIs, placeholder code, mock paths. The rule taxonomy is AI-native, not a general-purpose quality gate repurposed for AI.

> SonarQube is excellent for code quality (complexity, duplication, code smells). SimpleBeacon is for AI code hygiene. They can coexist."

---

## Tier 4: Questions About Roadmap and Longevity

### Q24: "What's on your roadmap for the next 12 months?"

**Answer:**
> "Q3 2026 (current): Launch — CLI, VS Code extension, MCP server, 48 analyzers, 5 pricing tiers.
> Q4 2026: SSO/SAML for Enterprise, Docker image for air-gapped, custom rules directory, expanded AST support (Python, Go).
> Q1 2027: Team dashboard with role-based access, audit trail for compliance officers, Slack/Teams integration for findings.
> Q2 2027: SOC 2 Type II process initiation, expanded EU AI Act coverage (Annex IV technical documentation), multi-language support (Rust, Java).

> We prioritize based on customer feedback. Enterprise customers get direct input on the roadmap through quarterly reviews."

### Q25: "What happens if your company goes out of business?"

**Answer:**
> "The CLI continues to work — it's a Node.js package with no runtime dependency on our servers. Existing license tokens remain valid until expiration (1 year). The VS Code extension continues to work as long as it's installed.

> What you'd lose: certificate signing (requires our backend), new license issuance, CI telemetry, and the web dashboard. The core scanning, CI gate, and VS Code extension would continue to function.

> For enterprise customers with air-gapped deployments, there's no dependency on our infrastructure at all. Everything runs locally."

---

## Red Flags — What NOT to Say

| Don't Say | Say Instead |
|-----------|-------------|
| "We have SSO/SAML" | "SSO/SAML is on the Enterprise roadmap, we can scope it as Phase 1" |
| "We have a Docker image" | "The CLI is containerizable, we can provide a Docker image as part of onboarding" |
| "We're SOC 2 certified" | "We produce SOC 2 evidence artifacts; we're not SOC 2 certified ourselves" |
| "It's 100% accurate" | "The gate blocks on critical/high severity. False positives can be allowlisted." |
| "We support all languages" | "Rules are language-agnostic. AST scanning is JS/TS-specific. Python/Go AST is on the roadmap." |
| "We have a bug bounty" | "We have a disclosure policy. Bug bounty platform evaluation is in Q4 2026." |
| "60+ rules" / "52 engines" | "48 analyzers, 50 JSON rule entries, 25 scan engine categories" |
| "10,000 files in 38 seconds" | "6,000 files in 89 seconds on local hardware" |
| "Zero upload, period" | "Zero source-code upload. The certify endpoint sends only a SHA-256 hash and aggregate counts." |
| "It's a legal certification" | "It's a technical attestation. For legal conformity, engage a qualified EU legal firm." |

---

## Decision Matrix: When to Escalate to Founder

| Question Type | Demo Presenter Handles | Escalate to Founder |
|---------------|----------------------|---------------------|
| Technical architecture | Yes | — |
| Pricing | Yes for standard tiers | Custom enterprise pricing |
| Roadmap commitments | General roadmap | Specific date commitments |
| SSO/SAML timeline | "Roadmap" | "We can scope it for your contract" |
| Security incident history | — | Always (founder answers directly) |
| Competitive positioning | Yes | — |
| Custom integration requests | "Let me check" | Scoping and timeline |
| Legal/contractual terms | — | Always (DPA, EULA negotiation) |
