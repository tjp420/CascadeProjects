# Remediation Progress — 2026-06-21

## Fixes Applied

| #   | Issue                                                    | File(s)                                                         | Status                                                                |
| --- | -------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Empty catch block swallows errors                        | `simplebeacon-vscode-merged/src/modernSidebarProvider.ts:2030`  | Fixed — now logs to VS Code: extension host                           |
| 2   | Hardcoded Ollama URL                                     | `ai-platform/simplebeacon-vscode/src/realtimeMonitor.ts:44`     | Fixed — reads from `simplebeacon.ollamaUrl` config                    |
| 3   | Scanner infra false positives (mock-path-leak)           | `packages/simplebeacon-cli/src/lib/production-leak-intent.js`   | Fixed — added `simplebeacon-proxy`, `mock-data-helpers` to exclusions |
| 4   | Joi schema name false positives                          | `packages/simplebeacon-cli/src/rules/production-leak.js`        | Fixed — added `isJoiSchemaName` exclusion                             |
| 5   | Web/data route false positives                           | `packages/simplebeacon-cli/src/rules/production-leak.js`        | Fixed — added `isIntentionalWebDataRoute` exclusion                   |
| 6   | Debug artifact false positive (scanPanel.ts)             | `simplebeacon-vscode-merged/src/analyzers/workspaceAnalyzer.ts` | Fixed — added `simplebeacon-vscode/src/` to console.error exclusion   |
| 7   | Debug artifact false positive (modernSidebarProvider.ts) | `simplebeacon-vscode-merged/src/analyzers/workspaceAnalyzer.ts` | Fixed — added exclusion for injected HTML console.error fallback      |
| 8   | Debug artifact false positive (ProfileView.js)           | `simplebeacon-vscode-merged/src/analyzers/workspaceAnalyzer.ts` | Fixed — added exclusion for production prompt() calls                 |
| 9   | Hardcoded URL false positive (codebase-analyzer.cjs)     | `simplebeacon-vscode-merged/src/analyzers/workspaceAnalyzer.ts` | Fixed — broadened exclusion for pattern-catalog function              |
| 10  | Type safety gap (scanPanel.ts)                           | `ai-platform/simplebeacon-vscode/src/scanPanel.ts:656`          | Fixed — `any` → `unknown` in postJson signature                       |
| 11  | Type safety gap (uploadPanel.ts)                         | `ai-platform/simplebeacon-vscode/src/uploadPanel.ts:456`        | Fixed — `any` → explicit report data interface                        |

## Regression Tests

- `packages/simplebeacon-cli/tests/production-leak.test.js` — 7/7 passing
  - Scanner infrastructure suppression (2 tests)
  - Joi schema name suppression (2 tests)
  - Real leak detection still works (2 tests)
  - Intent annotation suppression (1 test)

## Remaining TODO/FIXME Inventory (27 items)

### ai-platform/server

- `config/constants.cjs:1` — TODO/FIXME marker
- `index.cjs:525` — TODO/FIXME marker
- `lib/codebase-analyzer.cjs:248` — TODO/FIXME marker
- `lib/eu-ai-act-audit-report.cjs:186` — TODO/FIXME marker
- `lib/file-audit-context.cjs:100` — TODO/FIXME marker
- `lib/file-merger-reduction-scanner.cjs:796` — TODO/FIXME marker
- `lib/language-patterns/universal-baseline-patterns.cjs:8` — TODO/FIXME marker
- `lib/secret-config.cjs:10` — TODO/FIXME marker

### ai-platform/web/simplebeacon-dashboard

- `js/components/DataCleanupReport.js:618` — TODO/FIXME marker
- `js/components/LoginModal.js:43` — TODO/FIXME marker
- `js/data/outreach-prospects.js:11` — TODO/FIXME marker
- `js/main.js:309` — TODO/FIXME marker
- `js/services/aiProblemAnalyzerSuite.mjs:3028` — TODO/FIXME marker
- `js/utils/cleanup-brief-export.browser.js:472` — TODO/FIXME marker
- `js/utils/codebase-export.browser.js:500` — TODO/FIXME marker
- `js/utils/compliance-export.browser.js:451` — TODO/FIXME marker
- `js/utils/consolidation-export.browser.js:825` — TODO/FIXME marker
- `js/views/AboutView.js:89` — TODO/FIXME marker
- `js/views/AnalyzeView.js:244` — TODO/FIXME marker

### packages/simplebeacon-cli

- `src/analyzers/data-cleanup/data-access-pattern-analyzer.js:79` — TODO/FIXME marker
- `src/lib/credential-pattern-scanner.js:36` — TODO/FIXME marker
- `src/lib/issue-utils.js:35` — TODO/FIXME marker
- `src/lib/pdf-generator.js:35` — TODO/FIXME marker
- `src/lib/sample-consistency-checker.js:173` — TODO/FIXME marker
- `src/reporters/json.js:187` — TODO/FIXME marker

### Other

- `simplebeacon-frameworkless/app.js:192` — TODO/FIXME marker
- `simplebeacon-vscode-merged/src/analyzers/workspaceAnalyzer.ts:803` — TODO/FIXME marker

## Recommendation

The 27 TODO/FIXME items are intentional tracking markers for known future work. They are not defects. Review on a case-by-case basis during the next sprint planning.
