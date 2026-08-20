# Dashboard Analysis → VS Code Extension Improvements

## Executive Summary

After analyzing `upload.html` (browser sandbox) and the server analyze view (`AnalyzeView.js`), I've identified **15 major capabilities** the dashboard has that the VS Code extension lacks. These represent the highest-impact improvements for the extension.

---

## 1. Build Readiness Module (High Impact)

**What the dashboard does:**

- Computes a `readinessScore` (0-100%) across 17 checklist items
- Classifies each as **critical** or **recommended**
- Detects monorepo root files at any path depth (`findAtAnyDepth`)
- Status: READY (>=80%), NEEDS WORK (>=50%), BLOCKED (<50%)
- Checklist: package.json, lockfile, README, CHANGELOG, tests, CI/CD, Docker, linting, TypeScript, build tools, dev server, .env.example, .gitignore, build artifacts ignored, Git LFS, build cache, .npmignore

**VS Code gap:** No build readiness analysis whatsoever.

**Implementation:** Add a `BuildReadinessAnalyzer` to `workspaceAnalyzer.ts` using the same `LANGUAGE_REGISTRY` + `buildChecks` pattern from `scanner-patterns.js`.

---

## 2. EU AI Act Compliance Controls (High Impact)

**What the dashboard does:**

- `buildEuAiActControls()` generates article-specific compliance checks:
  - **Art. 5** — Prohibited AI Practices (critical if AI SDKs detected)
  - **Art. 6** — High-risk Classification (Annex III)
  - **Art. 50** — Transparency Obligations
  - **Art. 9** — Risk Management System
- Each control has: controlId, title, article citation, status (PASS/WARN/REVIEW), severity, description, evidence, action

**VS Code gap:** No EU AI Act module in the sidebar or dashboard.

**Implementation:** Port `buildEuAiActControls()` from `ui-renderer.js` to a new `EuAiActProvider.ts` in the extension.

---

## 3. Roadmap / Phased Remediation (High Impact)

**What the dashboard does:**

- Generates a **12-phase roadmap** with task completion tracking
- Phases: buildreadiness → security → integrity → consistency → cleanup → compliance → euaiact → mockdata → npmaudit → optimization → junkfiles → vulns
- Each phase has: status (completed/blocked/inProgress/pending), progress %, taskSummary (total/done/todo), tasks with `done` flags
- Auto-completes phases when `scanIsClean` (gate passes + 0 issues)

**VS Code gap:** No roadmap view. The `ScanPhaseProvider` exists but doesn't show structured phases with task completion.

**Implementation:** Create a `RoadmapProvider.ts` tree view or add a roadmap panel to `EnhancedDashboard20`.

---

## 4. Rich Suggested Fixes with Patches (High Impact)

**What the dashboard does:**

- `buildSuggestedFixes()` returns prioritized fixes with:
  - `file`, `line`, `action`, `effort` (e.g., "20 min")
  - `currentCode` / `replacement` (before/after snippets)
  - `suggestedPatch` (unified diff string)
  - `context` (surrounding code lines)
  - `autoFixable` boolean
  - `verificationCommand` (shell command to verify)
- Severity-ranked: critical → high → medium → low

**VS Code gap:** `RemediationProvider.ts` has basic fix templates but no patch generation, no verification commands, no autoFixable flag.

**Implementation:** Enhance `RemediationProvider` to generate unified diffs and expose `autoFixable` fixes as Code Actions (lightbulb).

---

## 5. Dependency Vulnerability Audit (Medium-High Impact)

**What the dashboard does:**

- Module 12: "Dependency Vulns" showing:
  - Total vulnerability count
  - Critical / high / medium breakdown with colored badges
  - Affected packages list
  - Fix recommendation: `npm audit fix`

**VS Code gap:** No npm audit integration. The extension analyzes source files but doesn't run `npm audit`.

**Implementation:** Add `npm audit --json` execution to the scan pipeline, parse results into the report.

---

## 6. File Reduction / Cleanup Analysis (Medium Impact)

**What the dashboard does:**

- Detects: junk files, duplicates, empty files, invalid JSON, uncommitted build artifacts
- Shows: totalRemovable, totalRemovableBytes, categories breakdown
- Suggests `.simplebeaconignore` patterns

**VS Code gap:** No cleanup module. `workspaceAnalyzer.ts` skips build artifacts but doesn't report them.

**Implementation:** Add a `CleanupAnalyzer` that inventories files and flags bloat/junk.

---

## 7. Certificate / Token UI (Medium Impact)

**What the dashboard does:**

- Full token validation with decoded tier badge, expiry, project name
- Unlocked modules grid showing which analyzers are active
- Scan command generator (`npx simplebeacon scan --gate --offline`)
- Free developer sandbox token generation

**VS Code gap:** `generateCertificate()` exists as a command but has no UI. Users can't see tier or unlocked modules.

**Implementation:** Add a certificate panel to `EnhancedDashboard20` with token inspector UI.

---

## 8. Real-time Scan Progress (Medium Impact)

**What the dashboard does:**

- Animated loader with spinner
- Per-file progress: `ScanProgressNode` shows phase, progress count, current file
- `setScanning(isScanning, progress)` updates UI in real-time

**VS Code gap:** `RealtimeMonitor` exists but only logs to output channel. No visual progress in the sidebar.

**Implementation:** Hook `RealtimeMonitor` into `ModernSidebarProvider` to show a progress bar and current file name.

---

## 9. Data Quality Scoring (Medium Impact)

**What the dashboard does:**

- `schemaCompliance` score (e.g., 100%)
- `consistencyScore` (e.g., 95%)
- `duplicateGroups` count
- `invalidJson` / `emptyFiles` counts

**VS Code gap:** No schema or consistency analysis.

**Implementation:** Add JSON validation and duplicate detection to `workspaceAnalyzer.ts`.

---

## 10. Modular UI Architecture (Medium Impact)

**What the dashboard does:**

- `pushModule(id, icon, title, metrics, summary, color, detailHtml)` dynamically builds modules
- 13+ modules rendered independently
- Each module has: metric cards, summary text, expandable detail view

**VS Code gap:** `EnhancedDashboard20.getEnhancedHtml()` generates one massive HTML string. Adding a new module requires editing a huge template.

**Implementation:** Refactor dashboard HTML generation to use a module registry (array of module renderers), similar to `pushModule()`.

---

## 11. AI Context / Reader Guide (Low-Medium Impact)

**What the dashboard does:**

- `aiContext.readerGuide` explains how to use the report
- `aiContext.suggestedFixes[]` prioritized actionable tasks
- `aiContext.moduleDependencies[]` shows fix ordering (security → cleanup → performance → types → tests → docs)
- `aiContext.completionCriteria[]` defines done-state for each phase

**VS Code gap:** The extension generates reports but doesn't surface the AI context to users.

**Implementation:** Add an "AI Guide" panel to the dashboard that renders `readerGuide` and `completionCriteria`.

---

## 12. Pattern Documentation Explorer (Low-Medium Impact)

**What the dashboard does:**

- `pattern-documentation.js` provides inline docs for each analyzer pattern
- Users can learn what each pattern detects and why

**VS Code gap:** No pattern explorer. Users don't know what `configDrift` or `tokenBleed` means.

**Implementation:** Add a "Pattern Docs" command that opens a webview listing all `PATTERN_REGISTRY` entries with descriptions.

---

## 13. Server Detection & Mode Switching (Low Impact)

**What the dashboard does:**

- `serverDetectedBanner` appears when `http://127.0.0.1:3000` responds
- Suggests using server dashboard for "complete results (npm audit, AST analysis, unlimited files)"
- Mode tabs: Terminal (CLI) vs Browser Sandbox

**VS Code gap:** No server detection. The extension always runs local analysis.

**Implementation:** On startup, ping `http://127.0.0.1:3000/api/health` and show a notification if server is available.

---

## 14. Gate Status with Blocking Counts (Low Impact)

**What the dashboard does:**

- Shows: `gate.pass`, `gate.blockingCount`, `gate.warningCount`
- Color-coded: green (pass), red (blocking issues), yellow (warnings only)

**VS Code gap:** Status bar shows "PASS" or "FAIL" but not counts.

**Implementation:** Update `updateStatusBar()` to include blocking/warning counts in the tooltip.

---

## 15. Quick Actions & One-Click Install (Low Impact)

**What the dashboard does:**

- One-click CLI install button
- Copy-to-clipboard for scan commands
- Quick actions: Scan, View Dashboard, Clear, Export, Generate Certificate, Settings

**VS Code gap:** Quick actions exist in the sidebar but lack command copy and one-click install.

**Implementation:** Add a "Copy Scan Command" quick action and a "Check CLI" action that verifies `npx simplebeacon` is available.

---

## Priority Implementation Order

| Priority | Feature                        | Effort | Impact      |
| -------- | ------------------------------ | ------ | ----------- |
| P0       | Build Readiness Analyzer       | Medium | High        |
| P0       | EU AI Act Controls             | Medium | High        |
| P0       | Roadmap / Phased Remediation   | Medium | High        |
| P1       | Rich Suggested Fixes (patches) | Medium | High        |
| P1       | Dependency Vulnerability Audit | Low    | Medium-High |
| P1       | Modular Dashboard Refactor     | Medium | Medium      |
| P2       | File Reduction / Cleanup       | Medium | Medium      |
| P2       | Certificate / Token UI         | Medium | Medium      |
| P2       | Real-time Progress in Sidebar  | Low    | Medium      |
| P2       | Data Quality Scoring           | Low    | Medium      |
| P3       | AI Context / Reader Guide      | Low    | Low-Medium  |
| P3       | Pattern Documentation          | Low    | Low-Medium  |
| P3       | Server Detection               | Low    | Low         |
| P3       | Gate Counts in Status Bar      | Low    | Low         |
| P3       | Quick Actions Enhancement      | Low    | Low         |

---

## Key Code References

### Dashboard (source of truth)

- `coming-soon/js/dashboard/scanner-engine.js` — 52 analyzer engines, `buildSuggestedFixes()`, `findAtAnyDepth()`
- `coming-soon/js/dashboard/ui-renderer.js` — `pushModule()`, `buildEuAiActControls()`, build readiness scoring
- `coming-soon/js/dashboard/scanner-patterns.js` — `LANGUAGE_REGISTRY`, `PATTERN_REGISTRY`, `ANALYZER_SCHEMA`
- `coming-soon/roadmap.html` — Phase generation, `donePredicates`, `scanIsClean` fallback

### VS Code Extension (target)

- `simplebeacon-vscode/src/analyzers/workspaceAnalyzer.ts` — Pattern definitions, `extractMatches()`, `computeDynamicSeverity()`
- `simplebeacon-vscode/src/enhancedScanProvider.ts` — Sidebar tree view, `extractCategories()`, `extractAllFindings()`
- `simplebeacon-vscode/src/enhancedDashboard2_0.ts` — Dashboard HTML generation
- `simplebeacon-vscode/src/realtimeMonitor.ts` — File watchers, issue tracking
- `simplebeacon-vscode/src/extension.ts` — Command registration, scan orchestration
