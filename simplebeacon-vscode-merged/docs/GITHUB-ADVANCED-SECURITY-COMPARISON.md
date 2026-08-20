# SimpleBeacon vs. GitHub Advanced Security

## Why Enterprises Need a Dedicated AI Code Governance Layer

> **One-pager for technical evaluators, engineering managers, and CISOs**  
> _Last updated: June 20, 2026_

---

## The Problem GitHub Advanced Security Cannot Solve

GitHub Advanced Security (GHAS) is excellent at **traditional static analysis**: known CVEs, secret scanning, dependency vulnerabilities, and CodeQL structural analysis. But AI-generated code introduces an entirely new class of risks that GHAS was never designed to detect:

| Risk Category                        | Example                                                             | GHAS Detection                 | SimpleBeacon Detection                         |
| ------------------------------------ | ------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------- |
| **Hallucinated imports**             | `import { validate } from 'security-utils'` (package doesn't exist) | ❌ No                          | ✅ Yes — `hallucinatedImport` rule             |
| **AI slop / boilerplate bloat**      | Redundant `try/catch` around every function                         | ❌ No                          | ✅ Yes — `llmSlop` pattern matching            |
| **Generic error swallowing**         | `catch(e){ /* ignore */ }`                                          | ❌ No                          | ✅ Yes — `aiResidueSwallow` rule               |
| **Placeholder secrets left in prod** | `const API_KEY = 'your-api-key-here'`                               | ⚠️ Sometimes (secret scanning) | ✅ Yes — `credentials` + context filters       |
| **Copyleft license contamination**   | GPL-licensed code pasted from Stack Overflow                        | ❌ No                          | ✅ Yes — `governanceMarker` + snippet matching |
| **Behavioral context**               | 200-line paste block at 14:32 with zero keystrokes                  | ❌ No                          | ✅ Yes — IDE telemetry engine                  |
| **EU AI Act compliance**             | Undisclosed AI-generated code in regulated systems                  | ❌ No                          | ✅ Yes — `eu-ai-act-patterns` engine           |

---

## Side-by-Side Capability Matrix

| Capability                | GitHub Advanced Security   | SimpleBeacon                                    |
| ------------------------- | -------------------------- | ----------------------------------------------- |
| **Scan location**         | Cloud (repository) only    | Local IDE + CLI + CI/CD                         |
| **AI-specific patterns**  | None                       | 20+ specialized rules                           |
| **Behavioral telemetry**  | None                       | Keystroke/paste correlation                     |
| **EU AI Act indicators**  | None                       | Built-in compliance engine                      |
| **False positive tuning** | Limited rule customization | Per-rule context filters + `simplebeaconignore` |
| **Developer friction**    | PR gate delays (async)     | Real-time IDE feedback (sync)                   |
| **Data residency**        | Code leaves your perimeter | 100% local — no cloud upload                    |
| **Pricing model**         | Per-seat SaaS ($$$)        | Free / open-core                                |

---

## The Strategic Difference: Prevention vs. Detection

**GitHub Advanced Security** detects problems **after** code is committed and pushed. It is a **reactive** gate.

**SimpleBeacon** detects problems **while** code is being written. It is a **proactive** shield.

```
Developer writes AI-generated code
         │
         ├──► SimpleBeacon IDE extension ──► Flag in real-time (5s)
         │                                    │
         │                                    ▼
         │                              Fix before commit
         │                                    │
         ▼                                    ▼
    Git commit                        Clean commit
         │                                    │
         ▼                                    ▼
    GitHub PR ──► GHAS scan ──► No issues found (already fixed)
```

---

## When to Use GitHub Advanced Security

- You need **enterprise-grade secret scanning** at repository scale
- You need **CodeQL structural analysis** for complex vulnerability classes
- You need **dependency vulnerability alerts** (Dependabot)
- You are already deeply integrated into the GitHub ecosystem

## When to Use SimpleBeacon

- Your team uses **AI coding assistants** (Copilot, Cursor, Claude Code)
- You need **EU AI Act compliance** or governance attribution
- You want **zero-cloud** scanning for proprietary codebases
- You need **real-time IDE feedback** before commit
- You want to detect **AI-specific anti-patterns** (slop, hallucinations, boilerplate)

---

## The Complementary Play

SimpleBeacon does not replace GHAS. They are **complementary layers**:

| Layer          | Tool                     | Role                                            |
| -------------- | ------------------------ | ----------------------------------------------- |
| **Pre-commit** | SimpleBeacon             | Catch AI slop, hallucinations, placeholders     |
| **Commit/PR**  | GitHub Advanced Security | Catch secrets, CVEs, structural vulnerabilities |
| **CI/CD**      | Both                     | Gate enforcement, compliance certification      |

**Recommended stack:** SimpleBeacon (IDE + pre-commit) → GHAS (PR review) → SimpleBeacon CLI (CI/CD gate)

---

## Defensibility: Why GitHub Won't Build This

Microsoft (GitHub) has thousands of engineers, but they face structural constraints:

1. **Cloud-first architecture**: GHAS is designed to scan repos in the cloud. SimpleBeacon's "local-first" moat requires re-architecting their entire delivery model.
2. **Generic detection engine**: CodeQL is optimized for traditional vulnerability classes. AI-specific patterns (hallucinated imports, paste telemetry) require a fundamentally different detection philosophy.
3. **IDE behavioral context**: Detecting how code arrived (paste vs. keystrokes) requires deep VS Code/JetBrains integration that GHAS does not have today.
4. **EU AI Act specialization**: Compliance frameworks evolve rapidly. A dedicated tool can iterate faster than a platform adding a checkbox feature.

---

## Bottom Line

> **GitHub Advanced Security protects your repository.**  
> **SimpleBeacon protects your developer.**

For teams shipping AI-generated code into production, both are necessary. SimpleBeacon fills the gap that GHAS cannot — the moment code is created, before it ever reaches a repository.

---

_For technical documentation, see `ROADMAP-60day.md` and `TELEMETRY-ENGINE-SPEC.md`._
