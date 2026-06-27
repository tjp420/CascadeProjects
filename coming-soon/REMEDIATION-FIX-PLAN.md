# SimpleBeacon Remediation Fix Plan

> Generated from filtered scan report (`1782588232913-report-filtered.json`)  
> **Adjusted Quality Score:** 77% | **Gate Status:** REVIEW | **Remaining Issues:** 72

---

## 🚨 Phase 1: Security Hardening (Immediate Action Required)

### 1.1 Sensitive Data Exposure — HIGH
- **Type:** `SENSITIVE_DATA_PATTERN`
- **Severity:** High (5 matches across 3 files)
- **Files:**
  - `simplebeacon-vscode-merged/dashboard-web/js/views/AnalyzeTargetConfig.js:20`
  - `simplebeacon-vscode-merged/dashboard-web/js-es2018/views/AnalyzeTargetConfig.js:17`
  - `simplebeacon-vscode-merged/src/dataServer.ts:769`, `:774`, `:791`
- **Evidence:** Local dev paths (`C:\dev\my-app`), git remotes, and mock user objects with email `local@simplebeacon.ai` embedded in source.
- **Action:**
  1. Replace hardcoded path examples in `AnalyzeTargetConfig.js` with generic placeholders (`https://example.com`).
  2. In `dataServer.ts`, remove or tokenize the mock user object; ensure `***REDACTED***` tokens are not shipped in production bundles.
  3. Add a pre-commit lint rule blocking local filesystem paths and email literals in `src/` and `dashboard-web/js/`.

### 1.2 Credential Pattern — MEDIUM
- **Type:** `CREDENTIAL_PATTERN_HEURISTIC`
- **Severity:** Medium (2 matches across 2 files)
- **Files:**
  - `coming-soon/archive/test-certificate.js:4`
  - `coming-soon/archive/test-technical-audit.js:93`
- **Evidence:** JWT-style token literal and inline `openai` require string inside test fixtures.
- **Action:**
  1. Move `test-certificate.js` token to a `.env.test` file consumed by the test runner.
  2. The `test-technical-audit.js` match is fixture data inside a JSON blob — ensure it is never executed as real code (verify it is wrapped in a string/template context).
  3. Add `archive/` to `.simplebeaconignore` or ensure archive files are excluded from production scans.

---

## 🔧 Phase 2: Structural Integrity & Configuration Drift

### 2.1 Configuration Drift — MEDIUM
- **Type:** `CONFIG_DRIFT_PATTERN`
- **Severity:** Medium (6 matches across 4 files)
- **Files:**
  - `simplebeacon-vscode-merged/dashboard-web/js/views/AnalyzeEngineGrid.js:23`
  - `simplebeacon-vscode-merged/dashboard-web/js-es2018/views/AnalyzeEngineGrid.js:21`
  - `simplebeacon-vscode-merged/src/modernSidebarProvider.ts:499`, `:2015`, `:2047`
  - `simplebeacon-vscode-merged/src/fixes/remediationProvider.ts:755`
- **Evidence:** Hardcoded fallback URL (`http://127.0.0.1:55000`), inline config object strings, and hardcoded CSS class references in TypeScript.
- **Action:**
  1. Move `apiServerUrl` fallback to a `package.json` contribution default, not a string literal.
  2. Replace inline engine-grid config descriptors with an imported JSON config module.
  3. Ensure `remediationProvider.ts` helper strings are localized or pulled from a constants file.

### 2.2 Missing Security Headers — MEDIUM
- **Type:** `SECURITY_HEADER_PATTERN`
- **Severity:** Medium (2 matches across 2 files)
- **Files:**
  - `simplebeacon-vscode-merged/dashboard-web/js/views/AnalyzeEngineGrid.js:22`
  - `simplebeacon-vscode-merged/dashboard-web/js-es2018/views/AnalyzeEngineGrid.js:20`
- **Evidence:** UI descriptor objects reference "Security Headers" as a scan category but do not assert their presence in the actual server response pipeline.
- **Action:**
  1. If `AnalyzeEngineGrid.js` renders server configuration status, verify the backend `serve.cjs` / server middleware actually emits `Content-Security-Policy`, `X-Frame-Options`, and `Strict-Transport-Security`.
  2. Add an explicit security-header check to the scan engine so the UI label matches runtime behavior.

### 2.3 Production Leak — MEDIUM
- **Type:** `PRODUCTION_LEAK_PATTERN`
- **Severity:** Medium (4 matches across 2 files)
- **Files:**
  - `simplebeacon-vscode-merged/dashboard-web/js/views/AnalyzeEngineGrid.js:65-66`
  - `simplebeacon-vscode-merged/dashboard-web/js-es2018/views/AnalyzeEngineGrid.js:63-64`
- **Evidence:** Descriptor strings for "Mock/Fixture Path in Production" and "Mock Path Leak" exist inside production UI source.
- **Action:**
  1. These are likely scan-category labels, not actual leaks, but confirm they are not rendered unless the scan engine is active.
  2. If they ship in the production bundle, extract them to a lazy-loaded JSON manifest.

---

## 🛠️ Phase 3: Hygiene & Quality Alignment

### 3.1 Debug Artifact — LOW
- **Type:** `DEBUG_ARTIFACT`
- **Severity:** Low (10 matches across 2 files)
- **Files:**
  - `coming-soon/analyze-directory.js` (lines 138-171 — banner + stats output)
  - `coming-soon/server.cjs` (lines 22, 23, 472, 583, 593)
- **Evidence:** `console.log` banner in CLI tool; `console.error`/`console.warn` for missing license secret; regex literal for debug artifacts inside server source.
- **Action:**
  1. `analyze-directory.js` is a CLI tool — `console.log` is acceptable here, but gate it behind `if (process.env.SILENT !== '1')`.
  2. In `server.cjs`, replace the `console.error`/`console.warn` with a structured logger that writes to stderr but does not print in production (check `NODE_ENV`).
  3. Line 472 is a regex pattern definition, not a runtime log — add a `simplebeacon-ignore` comment or move the pattern to a constants module.

### 3.2 AI Residue — LOW
- **Type:** `AI_RESIDUE_PATTERN`
- **Severity:** Low (3 matches across 2 files)
- **Files:**
  - `simplebeacon-vscode-merged/dashboard-web/js/services/authService.js:149`, `:168`
  - `simplebeacon-vscode-merged/dashboard-web/js/views/AnalyzeEngineGrid.js:12`
- **Evidence:** Empty `catch (e) {}` blocks in auth service; roadmap label string inside engine grid.
- **Action:**
  1. In `authService.js`, replace empty catches with at minimum `console.warn` or telemetry logging.
  2. In `AnalyzeEngineGrid.js`, verify the roadmap label is part of the legitimate engine descriptor list; if it is dead UI code, prune it.

### 3.3 Accessibility Gap — MEDIUM
- **Type:** `A11Y_PATTERN`
- **Severity:** Medium (11 matches across 5 files)
- **Files:**
  - `simplebeacon-vscode-merged/relay-server.js:128`
  - `simplebeacon-vscode-merged/dashboard-web/js/views/AnalyzeEngineGrid.js:243`, `:343`
  - `simplebeacon-vscode-merged/dashboard-web/js/views/HelpView.js:111`, `:115`, `:119`
  - `simplebeacon-vscode-merged/dashboard-web/js-es2018/views/AnalyzeEngineGrid.js:226`, `:321`
  - `simplebeacon-vscode-merged/dashboard-web/js-es2018/views/HelpView.js:101`, `:105`, `:109`
- **Evidence:** `<input type="checkbox">` elements without explicit `aria-label` or associated `<label for="...">` binding.
- **Action:**
  1. Add `aria-label` attributes to all standalone checkboxes in `HelpView.js` and `AnalyzeEngineGrid.js`.
  2. Ensure the `relay-server.js` generated HTML wraps inputs with proper `<label>` associations.
  3. Keep `js-es2018/` in sync with `js/` changes (or deprecate the ES2018 build if it is no longer needed).

### 3.4 High Complexity — LOW
- **Type:** `COMPLEXITY_PATTERN`
- **Severity:** Low (5 matches across 3 files)
- **Files:**
  - `simplebeacon-vscode-merged/relay-server.js:183-184`
  - `simplebeacon-vscode-merged/media/codeMapTemplate.html:80`
  - `simplebeacon-vscode-merged/media/panel.js:220-221`
- **Evidence:** Minified single-line function declarations (`closeTab`, `showNewTabMenu`, `classify`).
- **Action:**
  1. These are likely minified bundle artifacts. If so, add `media/` and `relay-server.js` to the scanner exclude list (`.simplebeaconignore`) or mark them as generated files.
  2. If they are hand-written, run Prettier and split into multi-line definitions.

### 3.5 API Contract Drift — LOW
- **Type:** `API_CONTRACT_PATTERN`
- **Severity:** Low (2 matches across 2 files)
- **Files:**
  - `simplebeacon-vscode-merged/dashboard-web/js/views/AnalyzeEngineGrid.js:64`
  - `simplebeacon-vscode-merged/dashboard-web/js-es2018/views/AnalyzeEngineGrid.js:62`
- **Evidence:** Descriptor string references "API Contract" scan category.
- **Action:** Verify the backend API surface is fully consumed by the frontend; remove dead endpoint descriptors from the engine grid config if the endpoints no longer exist.

### 3.6 License/Governance Marker — LOW
- **Type:** `GOVERNANCE_PATTERN`
- **Severity:** Low (9 matches across 5 files)
- **Files:** `coming-soon/server.cjs`, `site-config.js`, `js/scan-worker.js`, `js-es2018/scan-worker.js`, `lib/certificate-utils.cjs`
- **Evidence:** EU AI Act keyword matches (`transparencyGaps`, `highRiskIndicators`, etc.) inside certificate generation and scan-worker logic.
- **Action:** These are expected for a compliance-scanning product. No code change required; add `simplebeacon-ignore governance` comments if they recur in future scans.

### 3.7 AI System Indicator — LOW
- **Type:** `AI_IMPLEMENTATION_PATTERN`
- **Severity:** Low (1 match)
- **File:** `simplebeacon-vscode-merged/dashboard-web/serve.cjs:59`
- **Evidence:** Hardcoded OpenAI model list (`gpt-4`, `gpt-3.5-turbo`) in a mock/dev server response.
- **Action:**
  1. If this is a dev-only mock server, ensure it is never deployed to production.
  2. Move the model list to an environment-driven config or fetch it dynamically from the provider's `/models` endpoint.

---

## ✅ Verification Checklist

- [ ] No hardcoded local paths or mock emails in `src/dataServer.ts` or `AnalyzeTargetConfig.js`
- [ ] `server.cjs` license-secret warnings use structured logging, not raw `console.error`
- [ ] `authService.js` catch blocks log or report errors instead of swallowing
- [ ] Accessibility labels added to all checkboxes in `HelpView.js` and `AnalyzeEngineGrid.js`
- [ ] Security headers emitted by the backend and verified by the scan engine
- [ ] `coming-soon/archive/` test tokens moved to environment variables
- [ ] Run `node FilterAndRecalculate.js <report>` after fixes to verify score jumps above 85%
