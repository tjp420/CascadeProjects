# SimpleBeacon — 60-Day MVP Roadmap

> **Goal:** A developer installs SimpleBeacon with one command, runs a local scan, and gets a precise compliance/security report in under 5 seconds. No cloud dependency. No friction.

---

## 1. MVP Boundary: In-Scope vs. Out-of-Scope

### MVP-Complete (Weeks 1-8)
| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Local CLI scanner (`npx simplebeacon scan`) | ✅ Done | Core | `--offline`, `--gate`, `--full` flags working |
| VS Code extension (VSIX) | ✅ Done | Core | Dashboard, sidebar, Code Map, settings panel |
| Signature-based AI-slop detection engine | ✅ Done | Core | 20+ pattern rules in `workspaceAnalyzer.ts` |
| JSON / SQLite local state storage | ✅ Done | Core | `report.json`, gate status, scan history |
| EU AI Act compliance indicators | ✅ Done | Core | `eu-ai-act-patterns` rule engine |
| Pre-commit hook integration | ✅ Done | DX | Husky + gate scan on commit |
| Basic telemetry (local only) | 🔄 WIP | Core | Keystroke/paste detection in IDE |
| Scan location chooser | ✅ Done | DX | `pickWorkspaceFolder()` for any directory |
| Profile-based scanning | ✅ Done | Core | Essential, Security, Full, Custom presets |

### Post-MVP (Month 3+)
| Feature | Rationale |
|---------|-----------|
| SSO / SAML auth | Enterprise procurement cycle; not needed for first 5 beta users |
| RBAC / team permissions | Single-user MVP focus |
| Cloud dashboard | Violates "local-first" moat; build only if teams demand it |
| Real-time collaborative review | Requires cloud infra; GitHub PR comments are sufficient for MVP |
| JetBrains plugin | VS Code has 70% market share; delay until 100+ active users |

---

## 2. High-Moat Features (Defensible Against GitHub/GitLab)

GitHub Advanced Security does AST + CVE tracking well. SimpleBeacon wins on **AI-generated code traits** that static analyzers miss.

### 2.1 AST Structural Fingerprinting
**What:** Detect boilerplate patterns LLMs repeat across files.
**Current state:** Regex-based rules in `workspaceAnalyzer.ts`.
**60-day target:** Add AST-level detection for:
- Redundant `try/catch` wrappers around every function
- Identical comment blocks repeated across files (`// Helper function`, `// Main logic`)
- Predictable variable naming (`result`, `data`, `response`, `temp` in 80%+ of functions)
- Excessive `.then().catch()` chains with identical error handling

**Implementation:** Add `typescript` / `espree` parser pass in `workspaceAnalyzer.ts` before regex scanning.

### 2.2 Prompt-Style Pattern Analysis
**What:** Flag logic gaps unique to AI hallucinations.
**Current state:** Basic regex for `eval`, `innerHTML`, mock data paths.
**60-day target:** Harden rules for:
- Hallucinated imports (importing modules that don't exist in `node_modules` or `package.json`)
- Generic error swallowing (`catch(e){}` or `catch{/* ignore */}`)
- Unverified regex patterns (`new RegExp(userInput)` without escape)
- Placeholder strings left in production (`TODO: implement`, `your-api-key-here`)

### 2.3 Local Telemetry Correlation (The IDE Moat)
**What:** Use IDE context to flag suspicious code insertion patterns.
**Current state:** `modernSidebarProvider.ts` has canvas interaction telemetry.
**60-day target:**
- Detect 50+ line paste events with near-zero keystroke delay
- Flag files where >60% of code was inserted in single paste blocks
- Correlate paste timestamps with scan findings ("This block was likely AI-generated at 14:32")

**Why defensible:** GitHub scans repos statically. We see *how* code arrived. Requires IDE integration they can't replicate without owning the editor.

---

## 3. Scanner Rule Hardening: Top 10 AI-Slop Patterns

Priority = (Enterprise Fear × Detection Accuracy) / False Positive Rate

| Rank | Pattern | Why It Matters | Current Rule | Hardening Task |
|------|---------|--------------|------------|----------------|
| 1 | **Hardcoded secrets in AI output** | #1 legal/ops fear | `credentials`, `sensitiveData` | Add API key placeholder detection (`sk-...`, `ghp_...`) |
| 2 | **Copyleft license contamination** | #1 legal fear for enterprises | `governanceMarker` | Add GPL snippet matching against known open-source corpora |
| 3 | **Generic error swallowing** | Creates silent failures | `aiResidueSwallow` | Reduce false positives on valid `.catch()` usage |
| 4 | **Hallucinated imports** | Build breaks, supply chain risk | None | New rule: import vs. `package.json` dependency check |
| 5 | **Deadweight helper functions** | Technical debt multiplier | `maintainabilityIssue` | AST-based: detect exported functions with 0 call sites |
| 6 | **Placeholder strings left in prod** | Looks unprofessional, breaks APIs | `mockDataPath` | Expand to detect `your_`, `my_`, `example_`, `placeholder` prefixes |
| 7 | **Unverified regex on user input** | ReDoS, injection risk | `evalDanger` | Split into dedicated `regexDanger` rule |
| 8 | **Excessive nested conditionals** | LLMs generate deeply nested `if/else` | None | New rule: cyclomatic complexity >15 from AI-suggested blocks |
| 9 | **Identical comment blocks** | Hallucinated documentation | `llmSlop` | Cross-file comment similarity detection |
| 10 | **Type safety gaps (`any`)** | Maintainability killer | `typeSafetyAny` | Reduce false positives on valid boundary types |

---

## 4. Weekly Sprint Breakdown

### Week 1-2: Foundation
- [ ] Lock MVP boundary (this doc)
- [ ] Harden top 3 scanner rules (secrets, swallow, placeholders)
- [ ] Add AST parser dependency (`typescript` or `acorn`)
- [ ] Implement basic paste-detection telemetry in IDE

### Week 3-4: Accuracy
- [ ] Reduce false positive rate on `typeSafetyAny` and `llmSlop` rules
- [ ] Add hallucinated import detection
- [ ] Build EU AI Act report export (PDF/markdown)
- [ ] Add scan comparison (diff between two scans)

### Week 5-6: Moat
- [ ] Implement deadweight function detection (AST call-graph analysis)
- [ ] Add unverified regex rule
- [ ] Correlate paste telemetry with scan findings
- [ ] Build pre-commit hook auto-fix suggestions

### Week 7-8: Polish
- [ ] End-to-end performance: scan 1000 files in <5 seconds
- [ ] Onboarding flow: first-run tutorial in VS Code
- [ ] Beta tester recruitment (5 target users)
- [ ] Documentation: API docs, rule authoring guide, contributing.md

---

## 5. 60-Day Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Scan speed (1000 files) | <5s | `time npx simplebeacon scan` |
| False positive rate | <10% | Manual audit of 50 findings |
| IDE install-to-first-scan | <60s | Stopwatch test on fresh VS Code |
| Gate pass rate (clean repos) | >95% | Run against 10 clean open-source repos |
| Beta testers active | 5+ | Daily usage telemetry (opt-in) |
| Rulesets coverage | 10 hardened | Rule accuracy scorecard |

---

## 6. Immediate Next Actions

1. **This week:** Harden `credentials` rule — add API key placeholder detection
2. **This week:** Add `hallucinatedImport` rule (import vs. package.json check)
3. **Next week:** Implement paste-telemetry correlation in `modernSidebarProvider.ts`
4. **Next week:** Reduce `typeSafetyAny` false positives by 50%

---

*Last updated: June 20, 2026*
*Owner: SimpleBeacon Core Team*
