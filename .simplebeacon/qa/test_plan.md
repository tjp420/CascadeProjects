# Test Plan: Browser large-folder scan — false 1-file PASS + 100k+ failure UX

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Fix/clarify hosted browser scans when folder drops yield 1 file or repos exceed ~100k files |
| Author (Builder) | Builder |
| Date | 2026-08-04 |
| Branch | (TBD after approval) |
| Packages touched | ai-platform (dashboard LocalScanService / AnalyzeView), coming-soon (audit `/audit` scanner) |

## Problem (from user reports)

1. **`https://simplebeacon.ai/app/#/analyze`** — Dropped a ~393k-file / 48 GB folder (`Windows`). Result: **1 file indexed**, gate PASS, quality 100%. Report: `simplebeacon-report-1785885586927.json` (`scanSource: browser-local`, `projectRoot: Windows`).
2. **`https://simplebeacon.ai/audit`** — Same class of target fails / is unusable above ~100k files. `report(7).json` is a **successful** ~15k-file `AdvancedInstallers` sandbox scan (not the Windows failure).

### Root causes (code)

| Surface | Cause |
|---------|--------|
| Analyze (`LocalScanService`) | Hard `MAX_FILES = 50000` during directory-handle walk; incomplete drops (no `webkitRelativePath`, protected OS dirs) can yield **1** `File` and still produce a green PASS. |
| Analyze drop handlers | Known path: IDE/OS drop exposes 1 file; traversal fallbacks exist but can still fall through to scanning that single file. |
| Audit (`coming-soon`) | Soft thresholds `FILE_COUNT_HIGH=65000` / `FILE_COUNT_VERY_HIGH=100000`; worker diagnostic mentions **cap 100000**; posting huge `File` arrays via `postMessage` + in-browser scan of 100k–400k files OOMs / hangs the tab. Discovery cap in `scan-utils.js` is effectively unlimited (`999999999`). |

**Out of scope for browser:** Full recursive scan of `C:\Windows` (~400k files / 48 GB). Correct path is **CLI** (`npx simplebeacon scan`) or Local Agent with an absolute path — not hosted drag-and-drop.

## Scope

### Files in scope (Broom — prefer existing modules)

1. `ai-platform/web/simplebeacon-dashboard/js/services/localScanService.js` (+ js-es2018 twin if deployed from it)
2. `ai-platform/web/simplebeacon-dashboard/js/views/AnalyzeView.js` — incomplete-drop / refuse false PASS
3. `coming-soon/public/js-es2018/dashboard/main.js` and/or `scanner-engine.js` — hard warn + block/redirect CLI before OOM at ≥100k
4. Optional: `ai-platform/web/simplebeacon-dashboard/js/utils-lib/dom.js` — shared incomplete-drop helper

### APIs / routes

- No new REST routes. Browser-local / browser-sandbox only.

### UI / IDE surfaces

- [x] Main dashboard Analyze (`#/analyze`)
- [x] Marketing audit page (`/audit`)
- [ ] Sidebar webview (N/A unless shared helper)

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c <file>` | [ ] |
| L1-02 | ai-platform tests (if touched) | `cd ai-platform && npm test` | [ ] |
| L1-03 | Extension compile | N/A unless extension touched | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-06 | npm audit | N/A unless deps changed | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Incomplete folder drop | Drop a folder that only exposes 1 File without `webkitRelativePath` (or simulate) on Analyze | Toast warning; **no** green PASS report claiming full repo; prompt Select Folder / CLI | [ ] |
| L2-02 | Cap transparency (Analyze) | Scan via directory handle that exceeds `MAX_FILES` | Report/`scanLimitNote` states truncation; not silent 50k-as-complete | [ ] |
| L2-03 | Audit ≥100k guard | Start scan when discovered files ≥ 100000 | Clear stop/warn with CLI command; avoid posting full File array to worker | [ ] |
| L2-04 | Audit mid-size still works | Scan folder ~1k–15k files (like AdvancedInstallers) | Completes; inventory matches order of magnitude | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | System / protected dirs (`Windows`) | Do not claim full inventory; surface permission / incomplete enumeration | [ ] |
| L3-02 | Select Folder vs drag-drop | Select Folder still preferred path for full browser walk | [ ] |
| L3-03 | No scope creep | No new scan engine; CLI remains recommended for mega-trees | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Browser-local scans still do not upload source by default | [ ] |

---

## Proposed Builder work (after approval)

1. **Refuse false PASS** when directory drop yields ≤2 files without relative paths / after failed tree walk — toast + Select Folder / CLI, do not apply 1-file “Windows PASS” report.
2. **Surface `MAX_FILES`** in `localScanService` report (`scanLimitNote` / limitations).
3. **Audit page:** before deep scan / worker `postMessage`, if `files.length >= 100000`, abort with actionable CLI message (and optional Local Agent path); do not clone 100k+ File objects into the worker.
4. Keep copy honest: browser sandbox is for project-sized trees, not OS install roots.

## Immediate user workaround (no code required)

```powershell
# From a normal project folder (not C:\Windows), or a scoped subtree:
npx simplebeacon scan --full --gate --format json --output .simplebeacon/report.json
```

For hosted Analyze: use **Select Folder** (not drag of system roots). Prefer scanning application/source trees, not entire OS directories.

---

## Approval

- [x] User approved this plan (or task included approved scope)
- Approved by: user  Date: 2026-08-04
- Defaults chosen: Analyze cap toast uses CLI command string; Audit hard-stop shows CLI command (no download link).

## Coercion Verification Block
- [x] Coerce numeric inputs (`minQuorumNodes`, `maxConcurrentMigrations`, `maxShardsPerMigration`)
- [x] Normalize stringified booleans (`requireAttestation`, `requireQuorumCommit`)
- [x] Array normalization for attestation authorities
- [x] Integration matrix: Verified via `track119-rest-routes.test.cjs`
