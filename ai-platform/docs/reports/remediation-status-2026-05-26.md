# Data Remediation Status — 2026-05-26

Brief status map against the comprehensive remediation plan. Evidence paths are in-repo artifacts from this verification pass.

## Phase completion

| Plan item | Status | Evidence |
|-----------|--------|----------|
| Phase 1 core extraction / cleanup | **DONE** | `docs/reports/PHASE_1_CORE_EXTRACTION_PLAN.md`; `core/` adapters pass `node --check`; no syntax failures in `core/**/*.js` |
| Fuzzy near-dup quarantine merges (artifact pairs) | **PARTIAL** | `.simplebeacon/merge-audit.jsonl` records **3/5** claimed merges: `quality-check`, `verify-predeploy`, `report-fresh`. No audit entries for `trust-publish` or `gate-test` |
| Fiction KPI neutralization (dashboard) | **DONE** | `docs/reports/rejected-fiction-patterns-remediation-2026-05-25.md`; `sourceFictionPatternHits: 0` in `.simplebeacon/report.json` |
| Security scanner MVP | **DONE** | `docs/security-scanner-mvp-status.md`; `tests/unit/security-scanner-view.test.js` |
| Security audit remediation (2026-05-25) | **PARTIAL** | `docs/reports/security-audit-remediation-2026-05-25.md` — in-repo fixes applied; sessions/CSP/MFA deferred |
| Gate / simplebeacon canonical scope | **DONE** | `.simplebeacon/report.json` → `gate.pass: true`, `blockingCount: 0`, `severityCounts.high: 0` |
| 2.1 High-severity fiction in docs | **DONE** (skipped) | Gate passes; no high/critical fiction in canonical scan paths — no doc neutralization needed this pass |
| Fiction KPI docs (98.5% claims) | **DONE** | Neutralized 18 archived completion docs; kept anti-fiction references in `SIMPLEBEACON_DEVSECOPS_WORKFLOW.md` and `MARKETING.md` |
| Debug logging in server hot paths | **DONE** | Gated `APIGateway` logs behind `API_GATEWAY_DEBUG`; gated `api-server-optimizations` behind `API_OPT_DEBUG`; removed `AnalysisRoutes` init log |
| 2.4 Broken files (`scripts/security-fixes/*` + root `scripts/`) | **DONE** | Deleted 4 syntax-broken auto-generated scripts in `scripts/security-fixes/`; removed 3 unused broken root scripts (`targeted-template-fix.js`, `validate-html-js.js`, `test-rebuilt-roadmap.js`); kept working `fix-eval-usage.js` |
| README consolidation (~747 files) | **PENDING** (deferred) | See count investigation below |
| 2–3 week test coverage push | **PENDING** (deferred) | Out of scope this pass |
| Full ~420 finding remediation | **PENDING** (deferred) | Out of scope this pass |

## Fuzzy near-duplicate pairs

| Scope | Config cap | Pairs found | Quarantined | Remaining |
|-------|------------|-------------|-------------|-----------|
| Sample data (`web/data`, `data/mock`, `data-central/ai-tools/mock-data`, `data/roadmap`) | 16 (`fuzzyMatch.maxPairs`) | **1** | 0 (manual review) | 1: `data/roadmap/ai-roadmap-report.json` ↔ `gguf-roadmap-data.json` (93.9% similarity) |
| `.simplebeacon` artifact dupes (claimed 5) | — | — | **3** (audit-backed) | **2** unverified (`trust-publish`, `gate-test`); plus loose dupes e.g. `launch-remaining-verify-launch-readiness.txt` vs `launch-verify-launch-readiness.current.txt` |

**Note:** The “16 pairs” figure is the scanner **maxPairs** ceiling, not a count of open merges. Current consolidation scan reports 1 fuzzy pair in sample paths.

## README_* count in `docs/`

| Metric | Count |
|--------|------:|
| `README_<n>.md` (case-insensitive) under `docs/`, excluding `node_modules` | **892** |
| Same count including any `docs/**/node_modules` | **892** (none present) |
| Plan figure “747” | **Stale / undercount** — likely from an earlier inventory or different glob; not node_modules inflation |

These are vendored/copied upstream package readmes and changelogs archived under `docs/`, not hand-authored project docs.

## Verification (this pass)

```text
npm run simplebeacon:report  → gate.pass: true, blockingCount: 0
npm test -- --passWithNoTests → Ran all test suites (exit 0)
```

Generated: 2026-05-26
