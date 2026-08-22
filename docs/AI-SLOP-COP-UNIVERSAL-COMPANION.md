# AI Slop Cop — Universal Code-Quality Companion

**Version:** 1.0 · **Date:** 2026-08-19 · **Status:** Living document

---

## 1. Product Brief (One Page)

### What it is

SimpleBeacon AI Slop Cop is a **universal, local-first code-quality companion** that catches AI-generated slop, credential leaks, compliance gaps, and technical debt before they reach production. It runs in three surfaces:

- **VS Code extension** — real-time gutter icons, exposure $ in the status bar, AI session summary popups, and quick-fix lightbulbs as you type
- **CLI / CI gate** — full-repo scanning with `--gate` blocking, board-ready certificates, and EU AI Act / SOC 2 mapping
- **MCP server** — AI agent integration so coding agents (Cursor, Windsurf, Continue, Copilot, Cline, Aider) can self-validate generated code before applying it

### Why it's different

| Traditional linters | AI Slop Cop |
|---|---|
| Language-specific | Universal core + language adapters |
| Static rule set | 130+ rules across 12 categories, 40+ languages |
| No AI context | Detects AI-specific patterns (boilerplate, placeholders, hallucinated APIs, mock returns) |
| No compliance | EU AI Act, OWASP LLM Top 10, 19 regional AI safety frameworks |
| No exposure framing | Each finding carries a cited dollar/risk exposure badge |
| No agent integration | MCP tools let AI agents self-validate before committing |
| Uploads source | Zero source upload — runs locally in the IDE, CLI, or MCP |

### Who it's for

- **Developers** using AI coding agents who want a safety net ($49/mo)
- **Teams** who need CI gates, compliance mapping, and board-ready certificates ($149/mo)
- **Enterprises** who need air-gapped scanning, SSO, and dedicated analysts (custom)

### Entry point

The free VS Code extension (`/downloads/simplebeacon.vsix`) is the primary entry point. The browser demo at `/slop-cop` is a teaser. Paid tiers unlock unlimited scans, the CI gate, and compliance certificates.

---

## 2. Architecture Spec

### 2.1 System topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                            │
│  (simplebeacon-vscode-merged)                                       │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │ RealtimeMonitor │  │ QuickFixProvider │  │ Dashboard/Sidebar │  │
│  │ - gutter icons  │  │ - auto-fix bulbs │  │ - findings tree   │  │
│  │ - line highlights│ │ - env var replace│  │ - exposure $      │  │
│  │ - AI session pop│  │ - remove slop    │  │ - gate status     │  │
│  │ - exposure $    │  │ - ignore comment │  │ - certificate gen │  │
│  └────────┬────────┘  └──────────────────┘  └───────────────────┘  │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Layer 1: Universal Intake                      │   │
│  │  - file classification (app/config/test/docs/vendor/gen)    │   │
│  │  - extension routing (.js→JS adapter, .py→Python adapter)   │   │
│  │  - skip patterns (node_modules, .git, dist, coverage)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Layer 2: Generic Detectors                      │   │
│  │  - hardcoded secrets (passwords, API keys, tokens)          │   │
│  │  - AI slop (boilerplate, placeholders, Lorem Ipsum)         │   │
│  │  - TODO/FIXME/HACK in release paths                         │   │
│  │  - mock/sample paths in production code                      │   │
│  │  - dead code, empty catch blocks, unreachable logic         │   │
│  │  - 15 universal AI rules (SB-AI-001..015)                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Layer 3: Language Adapters                      │   │
│  │  JS/TS: eval, innerHTML, ==, var, IIFE                      │   │
│  │  Python: print, bare except, mutable defaults, shell=True   │   │
│  │  JSON: trailing comma, unquoted keys                         │   │
│  │  Go: (planned) exec.Command, unchecked errors               │   │
│  │  Rust: (planned) unsafe blocks, unwrap(), panic!            │   │
│  │  Java/Kotlin: (planned) raw types, synchronized misuse      │   │
│  │  C#: (planned) async/await, IDisposable                     │   │
│  │  SQL: (planned) string interpolation, missing params        │   │
│  │  Bash: (planned) curl|sh, rm -rf /, undeclared vars         │   │
│  │  Docker/YAML: (planned) root user, exposed ports            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Layer 4: Policy + Suppression + Gate           │   │
│  │  - .simplebeacon/config.json (rules, gate, allowlist)       │   │
│  │  - .simplebeaconignore (gitignore-style exclusions)         │   │
│  │  - inline: // simplebeacon-ignore / slop-cop-disable-next   │   │
│  │  - file-level suppression headers                            │   │
│  │  - tier-gated allowlists (free/pro/team/enterprise)         │   │
│  │  - gate modes: on-save / PR-diff / full-repo                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
           │
           │ MCP stdio
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CLI + MCP Server                             │
│  (packages/simplebeacon-cli)                                        │
│                                                                     │
│  130+ rules across 12 categories:                                   │
│  - Fiction/AI Slop (8)    - Security (23)    - OWASP LLM (10)      │
│  - EU AI Act (16)         - Regional AI (19)  - Enterprise (5)     │
│  - Architecture (11)      - Performance (8)   - Token Bleed (5)    │
│  - Deployment (6)         - File Naming (4)   - Type Safety (2)    │
│  - Universal AI (15)                                               │
│                                                                     │
│  MCP tools: scan_snippet, scan_file, scan_project, gate_status,    │
│  suggest_fixes, explain_finding, list_rulesets, compliance_check  │
│                                                                     │
│  Gate engine: failOn=[high], warnOn=[medium,low]                   │
│  Reporters: JSON, text, GitHub comment, audit report               │
│  Certificates: .sbcert (board-ready, signed)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Layer mapping to existing code

| Layer | What's built | What's missing |
|---|---|---|
| **Layer 1: Universal Intake** | File extension routing in `realtimeMonitor.ts getTypeSpecificPatterns()`, skip patterns in `analyzeFile()`, `.simplebeaconignore` loading in CLI | File role classification (app/config/test/docs/vendor/generated) is implicit, not explicit. No `FileRole` enum or classifier. |
| **Layer 2: Generic Detectors** | 15 universal AI rules (`universal-ai-rules.json`), 8 fiction rules, 13 inline AI slop patterns, 7 base patterns (secrets, console.log, debugger, eval, innerHTML, TODO) | Empty catch detection (SB-AI-004 exists in CLI but not in extension). Unreachable code detection. Duplicated block detection. |
| **Layer 3: Language Adapters** | JS/TS (3 rules), JSON (2 rules), Python (2 rules) in extension. CLI has broader coverage via `universal-ai-rules.json` (40+ languages for debug print, TODO, SSL, eval, credentials) | Go, Rust, Java/Kotlin, C#, Ruby, PHP, SQL, Bash, Docker/YAML language-specific patterns in the **extension**. CLI covers them generically but not with syntax-aware rules. |
| **Layer 4: Policy + Suppression** | `.simplebeacon/config.json`, `.simplebeaconignore`, inline `// simplebeacon-ignore`, `slop-cop-disable-next-line`, file-level suppression headers, tier-gated allowlists, gate engine with `failOn`/`warnOn` | No custom rule DSL (JSON/YAML user-defined rules). No org-level policy distribution. No cross-editor config sync. |

### 2.3 Component inventory

**VS Code Extension** (`simplebeacon-vscode-merged/src/`):

| Component | File | Status |
|---|---|---|
| Realtime monitor | `realtimeMonitor.ts` | ✅ Active — gutter icons, exposure $, AI session popups (added today) |
| Quick-fix provider | `fixes/slopCopQuickFixProvider.ts` | ✅ Active — auto-fix lightbulbs (added today) |
| Engine API client | `aiPlatform/engineApiClient.ts` | ✅ Connects to localhost:3000 |
| Context guard | `aiPlatform/contextGuard.ts` | ✅ Truncates large payloads |
| Diagnostics | `aiPlatform/diagnostics.ts` | ✅ Problems panel integration |
| Dashboard | `dashboard4_0.ts`, `welcomeDashboard.ts` | ✅ Webview dashboard |
| Sidebar | `modernSidebarProvider.ts` | ✅ Findings tree |
| Fix engine | `fixes/fixEngine.ts` | ✅ Remediation engine |
| Local Ollama | `fixes/localOllamaRemediation.ts` | ✅ Optional local LLM fixes |
| Rule catalogs | `rules/*.json` | ✅ 4 JSON catalogs (security, OWASP, compliance, slop) |

**CLI** (`packages/simplebeacon-cli/src/`):

| Component | Path | Status |
|---|---|---|
| Rule engine | `rules/*.js` (30+ scanners) | ✅ 130+ rules |
| MCP server | `mcp/stdio-server.js`, `mcp/tools.js` | ✅ 12 MCP tools |
| Gate engine | `gate.js` | ✅ failOn/warnOn |
| Scan orchestrator | `scan.js` | ✅ Profile-based |
| Reporters | `reporters/*.js` | ✅ JSON, text, GitHub |
| Certificates | `lib/certify-client.js` | ✅ .sbcert signed |
| Compliance | `compliance-rules/*.js` | ✅ 14 compliance rules |
| Analyzers | `analyzers/data-cleanup/`, `analyzers/file-reduction/` | ✅ 12 analyzers |

### 2.4 Data flow

**On-save / IDE mode:**
```
User edits file → onDidChangeTextDocument (500ms debounce)
  → classify file by extension
  → run Layer 2 generic detectors (regex)
  → run Layer 3 language adapter (if file type matches)
  → collect findings
  → apply Layer 4 suppression (ignore comments, allowlists)
  → publish diagnostics (Problems panel + gutter icons + line highlights)
  → update status bar (findings count + exposure $)
  → if AI session ended → show summary popup
```

**PR / diff mode (CLI):**
```
git diff --name-only base...head
  → for each changed file:
    → run enabled rules from profile
    → collect findings
    → apply suppression
  → evaluate gate (failOn=[high])
  → output JSON report
  → exit 1 if gate fails
```

**MCP / AI agent mode:**
```
AI agent calls scan_snippet(content, filePath)
  → run snippet scanner (credentials, production-leak, fiction, slop)
  → return { findings, blockingCount, gate }
  → if blockingCount > 0 → agent fixes before applying
  → agent calls scan_file after save → verify fix
  → agent calls gate_status before PR → verify gate passes
```

---

## 3. Rule Taxonomy

### 3.1 By layer and severity

#### Layer 2: Generic Detectors (language-agnostic)

| Rule ID | Category | What it detects | Severity | Exposure |
|---|---|---|---|---|
| SB-SEC-007a | Security | Hardcoded password | high | $4.45M avg breach |
| SB-SEC-007b | Security | Hardcoded API key | high | $4.45M avg breach |
| SB-SEC-007c | Security | Hardcoded token | high | $4.45M avg breach |
| SB-SEC-007e | Security | AWS access key ID | error | $4.45M avg breach |
| SB-SEC-007f | Security | DB connection string with creds | high | $4.45M avg breach |
| SB-SEC-010b | Security | Credential/password logged | error | Info leak |
| SB-SEC-010c | Security | SSN/national ID logged | error | GDPR fine |
| SB-SEC-010d | Security | Credit card logged | error | PCI fine |
| SB-FICTION-001 | AI Slop | LLM placeholder / conversational debris | high | Audit finding |
| SB-FICTION-002 | AI Slop | Markdown code fence in source | high | Tech debt |
| SB-FICTION-004 | AI Slop | Hardcoded fake metric / Lorem Ipsum | medium | €35M EU AI Act |
| SB-FICTION-005 | AI Slop | Hallucinated SDK/API method | high | $100K+ incident |
| SB-FICTION-006 | AI Slop | AI debris in TODO/FIXME | medium | Audit finding |
| SB-FICTION-007 | AI Slop | Mock return value + placeholder | high | $80K–$200K |
| SB-FICTION-008 | AI Slop | Boilerplate comment restating code | low | Tech debt |
| SB-AI-001 | Universal | Debug print in non-JS language | low | Info leak |
| SB-AI-002 | Universal | TODO/FIXME/HACK marker | low | Audit finding |
| SB-AI-003 | Universal | Disabled SSL/TLS verification | medium | MITM risk |
| SB-AI-004 | Universal | Empty catch swallows errors | medium | Silent failure |
| SB-AI-005 | Universal | eval/exec/Function constructor | medium | RCE risk |
| SB-AI-006 | Universal | Hardcoded credential assignment | medium | $4.45M breach |
| SB-AI-007 | Universal | Debug mode in config | medium | Info leak |
| SB-AI-008 | Universal | Broad exception catch | low | Hidden bugs |
| SB-AI-009 | Universal | Hardcoded filesystem path | low | Portability |
| SB-AI-011 | Universal | Bare string exception | medium | Error handling |
| SB-AI-013 | Universal | Disabled auth check | medium | Auth bypass |
| SB-AI-015 | Universal | Wildcard CORS/permissions | medium | CSRF risk |

#### Layer 3: Language Adapters

**JavaScript/TypeScript (current: 3 rules):**

| Rule ID | What it detects | Severity |
|---|---|---|
| var-declaration | `var` instead of `let`/`const` | info |
| equality-comparison | `==` instead of `===` | warning |
| immediately-invoked-function | IIFE pattern | info |

**JavaScript/TypeScript (planned additions):**

| Rule ID | What it detects | Severity |
|---|---|---|
| SB-JS-001 | `dangerouslySetInnerHTML` | high |
| SB-JS-002 | `fetch()` to localhost in production | medium |
| SB-JS-003 | `new Function()` constructor | medium |
| SB-JS-004 | `Object.assign` prototype pollution | high |
| SB-JS-005 | `setInterval` without `clearInterval` | info |

**Python (current: 2 rules, planned additions):**

| Rule ID | What it detects | Severity |
|---|---|---|
| print-statement | `print()` in production | warning |
| bare-except | Bare `except:` clause | warning |
| SB-PY-001 (planned) | `subprocess` with `shell=True` | high |
| SB-PY-002 (planned) | `pickle.loads()` on untrusted data | high |
| SB-PY-003 (planned) | `yaml.load()` without `Loader` | medium |
| SB-PY-004 (planned) | `open()` on untrusted path | medium |

**Go (planned):**

| Rule ID | What it detects | Severity |
|---|---|---|
| SB-GO-001 | `os/exec.Command` with string-built command | high |
| SB-GO-002 | Unchecked `err` return | medium |
| SB-GO-003 | `panic!` in library code | medium |
| SB-GO-004 | `defer` in loop | low |

**Rust (planned):**

| Rule ID | What it detects | Severity |
|---|---|---|
| SB-RS-001 | `unsafe` block | high |
| SB-RS-002 | `.unwrap()` on `Option`/`Result` | medium |
| SB-RS-003 | `panic!` in library code | medium |
| SB-RS-004 | Weak hash (`md5` crate) | medium |

**SQL (planned):**

| Rule ID | What it detects | Severity |
|---|---|---|
| SB-SQL-001 | String interpolation in query | high |
| SB-SQL-002 | Missing parameterization | high |

**Bash (planned):**

| Rule ID | What it detects | Severity |
|---|---|---|
| SB-SH-001 | `curl | sh` pipe | high |
| SB-SH-002 | `rm -rf /` pattern | critical |
| SB-SH-003 | Undeclared env var assumption | medium |

**Docker/YAML (planned):**

| Rule ID | What it detects | Severity |
|---|---|---|
| SB-SEC-017 | `privileged: true` | high |
| SB-SEC-018 | `USER root` | high |
| SB-SEC-019 | Hardcoded secret in ENV | high |
| SB-SEC-020 | Missing HEALTHCHECK | medium |

#### Compliance & AI Safety (Layer 4, CLI-only currently)

| Category | Rules | Frameworks |
|---|---|---|
| OWASP LLM Top 10 | 10 rules | LLM01-LLM10 (2025) |
| EU AI Act | 16 rules | Annex III, Articles 9-15, 26-27, 50 |
| Regional AI Safety | 19 rules | CA SB 1047, NIST AI RMF, CO SB 24-205, UT SB 149, NYC LL 144, Canada AIDA, UK DSIT, ISO 42001, Singapore, Brazil, TX HB 4045, IL, Japan, Australia, South Korea, China, India, OECD |
| Enterprise Guardrails | 5 rules | Data leakage, token budget, loop budget, resilience, stream safety |
| Token Bleed | 5 rules | Unchunked context, large serialization, long strings, unbounded tokens |
| Deployment Readiness | 6 rules | Workspace membership, env vars, schema conflicts, CORS, render.yaml |

### 3.2 Severity distribution (current)

```
Critical  ████████░░░░░░░░░░░░  8 rules (6%)
Error     ██████████████████░░  25 rules (19%)
High      ██████████████████████████████░░  35 rules (27%)
Medium    ██████████████████████████████████████░░  45 rules (35%)
Low       ████████████████░░░░  15 rules (12%)
Info      ███████░░░░░░░░░░░░░  7 rules (5%)
```

### 3.3 Language coverage matrix

| Language | Generic (Layer 2) | Language-specific (Layer 3) | Compliance (Layer 4) | Total |
|---|---|---|---|---|
| JavaScript/TypeScript | ✅ 15 rules | ✅ 3 rules (planned: 5 more) | ✅ OWASP, EU AI Act | 40+ |
| Python | ✅ 15 rules | ✅ 2 rules (planned: 4 more) | ✅ OWASP, EU AI Act | 30+ |
| Go | ✅ 15 rules | ❌ (planned: 4 rules) | ✅ Regional | 20+ |
| Rust | ✅ 15 rules | ❌ (planned: 4 rules) | ✅ Regional | 20+ |
| Java/Kotlin | ✅ 15 rules | ❌ (planned: 4 rules) | ✅ Regional | 20+ |
| C# | ✅ 15 rules | ❌ (planned: 4 rules) | ✅ Regional | 20+ |
| Ruby | ✅ 15 rules | ❌ (planned: 3 rules) | ✅ Regional | 15+ |
| PHP | ✅ 15 rules | ❌ (planned: 3 rules) | ✅ Regional | 15+ |
| SQL | ❌ | ❌ (planned: 2 rules) | ❌ | 0 (planned: 2) |
| Bash | ✅ 15 rules | ❌ (planned: 3 rules) | ❌ | 15+ |
| Docker/YAML | ✅ 15 rules | ✅ 4 rules (in CLI) | ❌ | 19+ |
| JSON | ✅ 15 rules | ✅ 2 rules | ❌ | 17+ |
| 40+ others | ✅ 15 rules | ❌ | varies | 15+ |

---

## 4. Product Roadmap

### Phase 1: Extension polish (current sprint — 1-2 weeks)

**Goal:** Make the real-time impact undeniable.

- [x] Gutter icons + line highlight decorations (done today)
- [x] Exposure $ in status bar (done today)
- [x] AI session summary popup (done today)
- [x] Quick-fix lightbulbs with deterministic auto-fixes (done today)
- [ ] **File role classifier** — explicit `FileRole` enum (app/config/test/docs/vendor/generated/infra/sample) so the scanner knows intent, not just extension
- [ ] **Refresh decorations on editor switch** — `onDidChangeActiveTextEditor` should re-apply decorations for the new active file
- [ ] **Decoration hover tooltips** — hovering a gutter icon shows the finding message + exposure + fix suggestion
- [ ] **Settings UI** — toggle gutter icons, exposure $, session popups, decoration intensity

### Phase 2: Language adapters (next 4 weeks)

**Goal:** Move from "JS/TS/Python only" to "truly universal."

- [ ] **Go adapter** — `exec.Command`, unchecked errors, `panic!` in libs, `defer` in loops
- [ ] **Rust adapter** — `unsafe` blocks, `.unwrap()`, `panic!` in libs, weak hash crates
- [ ] **Java/Kotlin adapter** — raw types, `synchronized` misuse, `System.exit` in libs
- [ ] **C# adapter** — `async/await` without `ConfigureAwait`, missing `IDisposable` disposal
- [ ] **SQL adapter** — string interpolation in queries, missing parameterization
- [ ] **Bash adapter** — `curl|sh`, `rm -rf /`, undeclared env vars
- [ ] **Docker/YAML adapter** — port `SB-SEC-017..020` from CLI to extension
- [ ] **Ruby adapter** — `eval`, symbol coercion, SQL injection
- [ ] **PHP adapter** — `eval`, `unserialize`, SQL injection
- [ ] **Consolidate rule catalogs** — merge `security-patterns.json` + `security-pattern-scanner.js` duplicates into a single source of truth

### Phase 3: False-positive suppression (weeks 5-8)

**Goal:** If the system is noisy, users stop trusting it.

- [ ] **File role-aware severity** — a `console.log` in a test file is info, in production code is warning
- [ ] **Intent classification** — before raising high severity, classify whether the match is in app code, a test fixture, a demo, or a vendor file
- [ ] **Smart allowlists** — auto-suggest allowlist entries for repeated dismissed findings
- [ ] **Context-aware credential detection** — skip credentials in test fixtures, demo files, and scanner rule definitions (partially implemented, needs hardening)
- [ ] **Suppression persistence** — `// slop-cop-disable-next-line` should persist across sessions and sync to `.simplebeacon/config.json`
- [ ] **Noise dashboard** — show which rules produce the most false positives so users can tune

### Phase 4: AI agent integration (weeks 9-12)

**Goal:** AI becomes both author and validator.

- [ ] **`scan_diff` MCP tool** — scan only the changed lines in a git diff (not the whole file)
- [ ] **`suggest_fix` MCP tool enhancement** — return deterministic fix patches, not just descriptions
- [ ] **`suppress_finding` MCP tool** — let agents add `// simplebeacon-ignore` with a reason
- [ ] **`read_rules` MCP tool** — let agents read the rule catalog before writing code so they avoid patterns proactively
- [ ] **`gate_check` MCP tool** — let agents verify the gate will pass before opening a PR
- [ ] **Auto-validate on agent edit** — when an AI agent edits a file, automatically run `scan_snippet` on the changed content and surface findings to the agent
- [ ] **Refuse-to-commit hook** — MCP tool that agents call before committing; if gate fails, the agent gets instructions to fix

### Phase 5: Repo-specific rules (weeks 13-16)

**Goal:** Turn from "generic scanner" into "your codebase's quality cop."

- [ ] **Custom rule DSL** — JSON/YAML format for user-defined rules:
  ```json
  {
    "id": "CUSTOM-001",
    "regex": "console\\.warn\\(",
    "severity": "warning",
    "message": "console.warn not allowed in this repo",
    "suggestion": "Use the project logger instead"
  }
  ```
- [ ] **Domain-specific rule packs** — installable rule packs for:
  - Game mod projects (ZScript, DECORATE, ACS)
  - React/Next.js apps
  - FastAPI/Flask services
  - Go microservices
  - Infrastructure-as-code (Terraform, Pulumi)
- [ ] **Per-path rule targeting** — enable/disable rules by glob pattern (`src/api/**` enforces stricter rules than `scripts/**`)
- [ ] **Severity overrides** — let repos override the default severity of any rule
- [ ] **Rule pack marketplace** — community-contributed rule packs installable via `npx simplebeacon install-rule-pack <name>`

### Phase 6: Universal reach (weeks 17-24)

**Goal:** Work everywhere, not just VS Code.

- [ ] **LSP daemon** — language server protocol implementation so the engine works in Neovim, Emacs, Sublime, JetBrains, and any LSP-compatible editor
- [ ] **JetBrains plugin** — native IntelliJ/PyCharm/GoLand plugin
- [ ] **Neovim plugin** — Lua-based plugin using the LSP daemon
- [ ] **GitHub Actions template** — standardized CI workflow with PR comments and gate enforcement
- [ ] **GitLab CI template** — `.gitlab-ci.yml` template
- [ ] **Azure DevOps pipeline** — pipeline extension
- [ ] **Pre-commit framework hook** — `pre-commit-hooks.yaml` for the pre-commit framework
- [ ] **Cross-editor config sync** — `.simplebeacon/` config is shared across all editors and CI

---

## 5. Design Principles

1. **Universal at the core, adaptive at the edges** — the generic detector layer works on any text file; language adapters add precision
2. **Local-first, zero upload** — no source code ever leaves the developer's machine
3. **Fast enough for every edit** — 500ms debounce, regex-based detection, no network calls
4. **Strict enough to catch AI slop** — 130+ deterministic rules, not probabilistic
5. **Smart enough to suppress noise** — file role classification, context-aware severity, allowlists
6. **Exposure-framed** — every finding shows dollar/risk impact so the value is obvious
7. **Agent-native** — MCP tools let AI coding agents self-validate before committing
8. **Extension-first** — the VS Code extension is the primary entry point, not the CLI

---

## 6. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Extension installs | 10K in 6 months | VS Code marketplace |
| Real-time findings shown | 50K+ per day across all users | Telemetry (opt-in) |
| Quick-fix acceptance rate | >40% of offered fixes applied | Extension telemetry |
| AI session popup CTR | >15% click "Review findings" | Extension telemetry |
| Gate pass rate (paid users) | >90% of PRs pass on first scan | CI telemetry |
| Language coverage | 10+ languages with adapter-specific rules | Rule catalog audit |
| False positive rate | <10% of findings dismissed | Dismissal tracking |
| MCP tool usage | 1K+ agents calling scan_snippet daily | MCP server logs |

---

## 6.1 Quantified Impact Model

The biggest improvement isn't "finding more issues." It's:
- finding the **right** issues
- suppressing the **wrong** ones
- enforcing the repo's **actual** rules
- blocking bad changes **before merge**

### What it does well

| Capability | Mechanism | Milestone |
|---|---|---|
| Stop secret leaks | Credential detection + safe-value suppression | M1 |
| Stop prod/test contamination | File role classifier + severity calibration | M1 |
| Stop mock/sample data in production paths | Smart suppressor + path-role targeting | M1 + M2 |
| Stop AI-generated dead code and placeholders | AI slop detection + confidence calibration | M1 |
| Stop insecure defaults in config | Config role detection + custom rules | M1 + M2 |
| Reduce noisy findings so developers trust the tool | Dismissal tracking + noise dashboard + allowlist suggester | M1 + M2 |
| Enforce repo-specific conventions | Custom rule DSL + severity overrides | M2 |
| Block bad changes before merge | Diff-based gating (changed files only) | M3 |

### What it cannot do

- Replace tests
- Replace code review
- Replace architecture judgment
- Fully understand business logic

### Impact by repo type

#### Small team repo (2-5 devs, mixed manual + AI code)

| Metric | Before | After | Improvement |
|---|---|---|---|
| Obvious slop reaching review | ~15 issues/week | ~5 issues/week | **67% reduction** |
| Review time on trivial issues | ~3h/week/dev | ~1h/week/dev | **67% reduction** |
| Placeholder values shipped to prod | ~2/month | ~0-1/month | **75% reduction** |
| Secret leak incidents | ~1/quarter | ~0/year | **~100% reduction** |
| Developer trust in scanner | N/A | >80% | New capability |

#### Medium monorepo (10-20 devs, multi-language, CI-gated)

| Metric | Before | After | Improvement |
|---|---|---|---|
| PR review churn on trivial issues | ~30% of review comments | ~10% | **67% reduction** |
| CI gate false-positive rate | ~40% (noisy scanners) | <10% | **75% reduction** |
| Time from PR open to merge (quality holds) | ~2-3 days | ~1 day | **50-67% faster** |
| Cross-language pattern coverage | 1-2 languages | 10+ via adapters | **5-10x** |
| Repo convention drift | ~10 violations/week | ~2/week | **80% reduction** |

#### AI-generated codebase (agent-heavy, 50%+ AI-authored)

| Metric | Before | After | Improvement |
|---|---|---|---|
| AI slop reaching review | ~40 issues/week | ~12/week | **70% reduction** |
| Fake production paths shipped | ~5/month | ~0-1/month | **80-100% reduction** |
| Placeholder config values | ~8/month | ~1/month | **87% reduction** |
| Duplicate boilerplate blocks | ~15/week | ~4/week | **73% reduction** |
| Sample data accidentally shipped | ~3/month | ~0/month | **~100% reduction** |
| AI agent self-correction rate | 0% (no feedback) | >60% (via MCP scan_snippet) | New capability |
| Time spent reviewing AI drafts | ~4h/day/dev | ~1.5h/day/dev | **62% reduction** |

### One-sentence summary

> This can materially improve codebase quality by reducing risky AI-generated mistakes and repo drift, especially when the tool is tuned for low-noise, repo-specific rules and diff-based gating.

### Why the trust layer (M1) is the foundation

Without false-positive suppression, none of the other capabilities matter:
- A scanner that cries wolf gets muted.
- A muted scanner catches nothing.
- A trusted scanner with 50 rules outperforms a muted scanner with 500 rules.

The file role classifier + severity calibrator + smart suppressor + confidence calibrator together ensure that when SimpleBeacon alerts, it means something.

### Why custom rules (M2) unlock per-repo value

Every repo has conventions that generic rules can't know:
- "No `console.warn` in `src/api/**`"
- "TODOs must have an assignee"
- "This legacy path is allowlisted"
- "This rule is error here, warning there"

Custom rules make the scanner correct for *your* repo, not just *a* repo.

### Why diff-based gating (M3) makes it practical

Full-repo scans are for compliance. Diff-based scans are for coding.
- IDE mode: scan only the file you're editing — instant feedback.
- PR mode: scan only changed files — fast gate, no noise from pre-existing issues.
- CI mode: full repo scan with baseline — compliance and audit.

This turns the tool from a compliance tax into a coding companion.

---

## 7. Execution Roadmap — 3 Milestones

**Strategic priority:** False-positive suppression and confidence calibration first.
A scanner with 130 rules that users mute is worth less than a scanner with 50 rules that users trust.
The signal-to-noise ratio is the real product bottleneck, not raw detection power.

### Milestone 1: Trust and Noise Reduction (4 weeks)

**Goal:** Developers trust the scanner because it stops crying wolf.

**Success metric:** False-positive dismissal rate drops below 10% of findings.

#### 1.1 File role classifier (week 1)

Build an explicit `FileRole` enum and classifier that runs before any rule fires.

```typescript
type FileRole =
  | 'app'        // production source code
  | 'config'     // configuration files
  | 'test'       // test files, specs, fixtures
  | 'docs'       // markdown, documentation
  | 'generated'  // build output, minified bundles, auto-generated
  | 'vendor'     // node_modules, third-party, vendor
  | 'infra'      // Dockerfiles, CI configs, IaC
  | 'sample';    // examples, demos, mock data
```

Classification signals:
- **Path patterns**: `__tests__/` → test, `node_modules/` → vendor, `dist/` → generated, `.github/` → infra
- **File name patterns**: `*.test.ts` → test, `*.spec.js` → test, `*.example.json` → sample, `*.md` → docs
- **Content markers**: `// generated by` / `DO NOT EDIT` → generated, `// simplebeacon-ignore` header → respect
- **Extension routing**: `.dockerfile` → infra, `.tf` → infra, `.sh` → infra

Files: `src/classifiers/fileRoleClassifier.ts`

#### 1.2 Intent-aware severity (week 2)

Before raising a finding, check the file role and downshift severity:

| Rule | App code | Test | Docs | Sample | Generated | Vendor |
|---|---|---|---|---|---|---|
| `console.log` | warning | info | skip | skip | skip | skip |
| `hardcoded-password` | error | info* | skip | info* | skip | skip |
| `TODO/FIXME` | info | info | skip | skip | skip | skip |
| `eval()` | warning | warning | skip | skip | skip | skip |
| `ai-boilerplate` | warning | info | skip | skip | skip | skip |

\* = only if the value matches known example/placeholder patterns (changeme, test-secret, etc.)

Files: `src/classifiers/severityCalibrator.ts`

#### 1.3 Smart suppression (week 2-3)

Hardened suppression for known false-positive categories:

- **Public/contact emails** — `admin@simplebeacon.ai`, `support@...` in contact form code
- **Example config values** — `your-api-key-here`, `changeme`, `placeholder`, `example.com`
- **Scanner self-references** — rule definitions that mention patterns they detect
- **Demo/sample paths** — `fixtures/`, `examples/`, `demo/`, `mock/` directories
- **Test fixture credentials** — `test-secret`, `fake-token`, `sample-key` (partially done, needs completion)
- **Build artifacts** — `.map`, `min.js`, `.next/`, `out/` (partially done)

Files: `src/suppression/smartSuppressor.ts`

#### 1.4 Confidence calibration (week 3)

- **File-role-aware confidence thresholds** — a `console.log` in a test file needs higher confidence to fire than in app code
- **Dismissal tracking** — count how often each rule's findings are dismissed; if a rule has >30% dismissal rate, auto-suggest allowlisting it
- **Per-rule confidence overrides** — let users tune confidence per rule in `.simplebeacon/config.json`

Files: `src/calibration/confidenceCalibrator.ts`, `src/calibration/dismissalTracker.ts`

#### 1.5 Noise dashboard (week 4)

A webview panel showing:
- Top 10 rules by finding count
- Top 10 rules by dismissal rate (false positive suspects)
- Rules with zero findings (candidates for removal)
- Suggested allowlist entries based on dismissal patterns
- File role distribution (how much of the workspace is app vs test vs vendor)

Files: `src/webviews/noiseDashboard.ts`

---

### Milestone 2: Repo-Specific Custom Rules (4 weeks)

**Goal:** Any project can define its own rules, severity, and allowlists.

**Success metric:** 100+ repos have custom rule files within 3 months of release.

#### 2.1 Custom rule DSL (week 5-6)

JSON/YAML format for user-defined rules:

```json
{
  "rules": [
    {
      "id": "CUSTOM-001",
      "regex": "console\\.warn\\(",
      "severity": "warning",
      "message": "console.warn not allowed in this repo",
      "suggestion": "Use the project logger instead",
      "fileGlob": "src/**",
      "fileRoles": ["app"],
      "confidence": 0.9
    }
  ]
}
```

Files: `src/rules/customRuleLoader.ts`, `src/rules/customRuleEngine.ts`

#### 2.2 Per-path rule targeting (week 6)

- Enable/disable rules by glob pattern
- Different severity for different paths (`src/api/**` is stricter than `scripts/**`)
- File role restrictions (a rule only fires on `app` code, not `test`)

Files: `src/rules/pathTargeting.ts`

#### 2.3 Severity overrides (week 7)

- Repos can override the default severity of any built-in rule
- Per-path severity overrides
- Tier-gated (team/enterprise only)

Files: `src/rules/severityOverride.ts`

#### 2.4 Domain rule packs (week 7-8)

Installable rule packs for common stacks:
- React/Next.js
- FastAPI/Flask
- Go microservices
- Infrastructure-as-code (Terraform, Pulumi)
- Game mod projects (ZScript, DECORATE)

Files: `src/rules/RulePackInstaller.ts`, `rule-packs/*.json`

#### 2.5 Allowlist suggestions (week 8)

- When a user dismisses the same finding signature 3+ times, auto-suggest adding it to `.simplebeacon/config.json` allowlist
- Show the suggested allowlist entry in a notification with "Add to allowlist" button

Files: `src/suppression/allowlistSuggester.ts`

---

### Milestone 3: AI Agent Workflow Integration (4 weeks)

**Goal:** AI coding agents self-validate, self-fix, and respect repo rules.

**Success metric:** 1K+ agents calling scan_snippet daily within 3 months.

#### 3.1 Enhanced MCP tools (week 9-10)

New and enhanced MCP tools:

| Tool | Purpose |
|---|---|
| `scan_diff` | Scan only changed lines in a git diff (not the whole file) |
| `suggest_fix` (enhanced) | Return deterministic fix patches, not just descriptions |
| `suppress_finding` | Let agents add `// simplebeacon-ignore` with a reason |
| `read_rules` | Let agents read the rule catalog before writing code |
| `gate_check` | Let agents verify the gate will pass before opening a PR |
| `read_custom_rules` | Let agents read repo-specific custom rules |

Files: `packages/simplebeacon-cli/src/mcp/hlers/agent-handlers.js`

#### 3.2 Auto-validate on agent edit (week 10)

When an AI agent edits a file:
1. Automatically run `scan_snippet` on the changed content
2. Surface findings to the agent via MCP
3. If blocking findings exist, the agent gets fix instructions
4. Agent applies fix, re-scans, confirms clean

Files: `src/aiPlatform/agentValidation.ts`

#### 3.3 Refuse-to-commit gate (week 11)

MCP tool that agents call before committing:
- If gate fails, the agent receives a structured list of blocking issues
- Agent gets deterministic fix suggestions for each
- Agent can call `suppress_finding` for false positives (with reason)
- Agent re-runs gate until pass

Files: `packages/simplebeacon-cli/src/mcp/hlers/gate-handlers.js`

#### 3.4 Diff-based gating (week 11-12)

- `scan_diff` scans only changed files in the branch
- Blocks only on new actionable issues (not pre-existing baseline)
- Full scans remain available for CI and compliance
- This turns the tool into a coding helper instead of a compliance tax

Files: `packages/simplebeacon-cli/src/lib/diff-scanner.js`

---

### Milestone dependency graph

```
Milestone 1 (Trust)          Milestone 2 (Custom Rules)    Milestone 3 (Agent)
┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
│ File role classifier│      │ Custom rule DSL    │      │ Enhanced MCP tools │
│ Intent-aware sev    │─────▶│ Per-path targeting │─────▶│ Auto-validate      │
│ Smart suppression   │      │ Severity overrides │      │ Refuse-to-commit   │
│ Confidence calib    │      │ Domain rule packs  │      │ Diff-based gating  │
│ Noise dashboard     │      │ Allowlist suggest  │      │                    │
└────────────────────┘      └────────────────────┘      └────────────────────┘
      4 weeks                    4 weeks                    4 weeks
```

**Milestone 1 is the foundation.** Without trust, custom rules and agent integration don't matter — users will have muted the scanner before they get to those features.

---

*This document is the source of truth for the AI Slop Cop universal companion direction. Update it as phases are completed.*
