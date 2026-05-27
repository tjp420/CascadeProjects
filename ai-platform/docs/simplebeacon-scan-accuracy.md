# Simplebeacon Scan Accuracy and Coverage

This document describes how Simplebeacon scan accuracy is maintained in the ai-platform repo: Jest baseline sync, sample KPI consistency, scan scope, source-code fiction patterns, and operational limits.

## Scope

Simplebeacon validates mock/sample JSON under configured `scanPaths`, production-path leaks (`server/`, `src/`), credential patterns, schema drift, roadmap fiction, anchor-sample KPI consistency against `.simplebeacon/baseline.json`, and **source-code fiction KPI patterns** under `sourceCodeScanPaths`.

**In scope**

- `web/data/*-sample.json` and other JSON under `scanPaths`
- Production leak detection on `server/` and `src/`
- Source fiction KPI patterns on `.js`, `.ts`, `.jsx`, `.tsx`, `.py` under `sourceCodeScanPaths`
- Jest pass-count verification when `--with-jest` is used
- Anchor-sample consistency (Jest counts, release, model, dataSource)

**Out of scope (by design)**

- Semantic review of arbitrary prose in docs (use `scan:kpi:source:docs` separately)
- LLM-based fiction detection
- Full-repository file-by-file analysis (inventory is reported; gate rules use scoped paths)

For broader source KPI sweeps (TODO/TBD placeholders):

```bash
npm run scan:kpi:source:code    # server, web, src, packages, tools (.js/.ts/.py)
npm run scan:kpi:source:docs    # includes docs/
npm run guard:fiction-kpi:ci      # staged/CI guard
```

See also [fiction-pattern-registry.md](./fiction-pattern-registry.md) for the rejected-value catalog.

## Jest baseline sync

Measured Jest counts live in `.simplebeacon/baseline.json` (`jestTestsPassing`, `jestTestsLabel`, `jestSuites`).

### Sync procedure (after a green test run)

1. Run the same command the gate uses:

   ```bash
   npm test -- --no-coverage --passWithNoTests
   ```

2. Confirm all tests pass and note the summary line (`Tests: N passed, N total`).

3. Sync baseline from measured output:

   ```bash
   npm run simplebeacon:baseline-sync
   ```

   This runs Jest, parses the summary, and writes `.simplebeacon/baseline.json`. It **fails** if any test fails.

4. Update anchor sample JSONs when Jest counts change (consistency rule compares samples to baseline):
   - `web/data/engineering-baseline-sample.json`
   - `web/data/implementation-plan-sample.json`
   - `web/data/master-roadmap-sample.json`
   - `web/data/dashboard-home-sample.json`

5. Regenerate the scan report:

   ```bash
   npm run simplebeacon:report
   ```

   Confirm `severityCounts.medium` has no `Jest Count Mismatch` issues and `gate.pass` is `true`.

### Jest during scans

| Command | Jest executed? |
|---------|----------------|
| `npm run simplebeacon:report` | No (fast report; `jest-baseline.runTests: false`) |
| `npm run simplebeacon:full` | Yes (`--with-jest` enables live test run) |
| `npm run simplebeacon:hook:pre-push` | Yes |

Config: `.simplebeacon/config.json` → `rules.jest-baseline`. The rule is enabled; `runTests` stays `false` for default scans. `--with-jest` sets `runTests: true` at scan time.

Cached last Jest summary (when run): `.simplebeacon/jest-result.json`.

## Scan paths and coverage

**Mock/sample JSON (`scanPaths`):**

- `web/data` — primary page samples (~40 JSON files)
- `data/mock` — supplemental mock JSON
- `data-central/ai-tools/mock-data` — central mock data (ignored at scan time via `config.ignore` → `data-central/**`; kept for parity with merger tooling)

**Not in `scanPaths` (by design):**

- `web/api` — mock backend code plus a local Python `.venv` (~4k+ non-mock files); not app mock JSON
- `packages/simplebeacon-cli/examples` — CLI starter/hook examples, not ai-platform mock data

**Scan count vs mock data count:** `mockSampleFiles` / `totalFiles` in `.simplebeacon/report.json` count only files under `scanPaths`. Expect ~43–45 files when paths are mock-focused. `ruleScopedFilesAnalyzed` is the max of mock-path files, credential scan scope, production leak scope, and `sourceCodeScanPaths` fiction scan — so it stays higher (~8k+) even when mock paths are tight; use `mockSampleFiles` for mock coverage, not `ruleScopedFilesAnalyzed`.

**Source fiction KPI (`sourceCodeScanPaths`):**

- `server`, `src/api`, `src/server`, `packages/simplebeacon-cli/src`
- Extensions: `.js`, `.ts`, `.jsx`, `.tsx`, `.py`
- Dashboard mock UI (`web/components`, legacy inline scripts) excluded — use `scan:kpi:source:code` for broader audits

**Production leak / credentials:** `server/`, `src/` (via `productionPaths`).

**Coverage metrics:** Use `mockSampleFiles` (mock JSON under `scanPaths`, ~42–45) for mock scan accuracy. `ruleScopedFilesAnalyzed` is `max(mock paths, credentials, production leak, source fiction)` and stays ~8k+ because `sourceCodeScanPaths` covers `server/`, `src/`, `web/`, and CLI source — not mock-path file count alone.

**Exclusions:** `node_modules`, `coverage`, `.simplebeacon/archive`, `tests`, `docs`, `*.test.js`, and patterns listed in `config.ignore`.

**Note:** `resolveMockDataScanPaths` (file-merger / mock-data-scanner) uses `data-central/config/central-data-config.json` → `mockDataScan.paths`, not the expanded Simplebeacon `sourceCodeScanPaths`.

## Source vs JSON fiction

| Issue type | Severity | Gate |
|------------|----------|------|
| `Fictional KPI` | high | Fails when active rejected values appear in JSON |
| `Source Fiction KPI Pattern` | medium | Warn only — hardcoded rejected values in source |

## Limitations

- Source rule uses line/regex matching — not AST-aware; documentation lines about rejected values are excluded heuristically.
- Default `simplebeacon:report` does not run Jest; mismatches between samples and baseline are medium-severity warnings, not gate failures.
- Gate fails only on **high** severity (`config.gate.failOn`).
- Repository inventory counts all tracked files; only scoped paths drive rule analysis.

## Maintenance checklist

Weekly or after test-count changes:

1. `npm test -- --no-coverage --passWithNoTests` — green
2. `npm run simplebeacon:baseline-sync` — if counts changed
3. Sync anchor sample Jest KPIs if baseline changed
4. `npm run simplebeacon:report` — 0 JSON fiction hits, gate PASS
5. Optional: `npm run simplebeacon:full` before release (includes live Jest)
6. Optional: `npm run scan:kpi:source:code` for broader source audits

## Quick validation

```bash
npm run simplebeacon:report && node -e "const r=require('./.simplebeacon/report.json'); const j=(r.rawIssues||[]).filter(i=>i.type==='Jest Count Mismatch'); const f=(r.rawIssues||[]).filter(i=>i.type==='Fictional KPI'); console.log('jest mismatches:', j.length, 'json fiction:', f.length, 'gate:', r.gate?.pass); process.exit((j.length||f.length||!r.gate?.pass)?1:0)"
```

Exit code 0 means no Jest count mismatches, no JSON fiction hits, and gate PASS.
