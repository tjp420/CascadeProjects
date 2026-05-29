# Repository Optimization Runbook

Operational guide for archiving oversized artifacts, running consolidation scans, and executing safe merge previews in `ai-platform`.

## Archive strategy

Generated artifacts that bloat `.simplebeacon/` or slow scans are **archived, not deleted**.

| Category | Source path | Archive destination |
|----------|-------------|---------------------|
| Jest results | `.simplebeacon/jest-results*.json` | `.simplebeacon/archive/jest-results/` |
| Quality checks | `.simplebeacon/launch-quality-check*.txt` | `.simplebeacon/archive/quality-checks/` |
| Coverage HTML | `coverage/`, `htmlcov/`, `z_*_analysis_py.html` | `.simplebeacon/archive/coverage-reports/` |
| Large source (manual) | Files flagged by monitor | `.simplebeacon/archive/large-source-files/` |

Run the archive helper:

```bash
node tools/archive-simplebeacon-artifacts.js
```

Quality-check logs are copied to archive, then trimmed in place to the last **1000 lines** (override with `--trim-quality=N`).

Archive actions are recorded in `.simplebeacon/archive/archive-manifest.json`.

## File size thresholds

Thresholds live in `.simplebeacon/config.json` under `fileSizeThresholds` (bytes):

- **JSON**: 512 KB
- **JS/TS/CSS/HTML/TXT/MD**: 256 KB
- **Default**: 256 KB

Monitor violations:

```bash
node tools/monitor-file-sizes.js
node tools/monitor-file-sizes.js --json
npm run scan:oversized
```

Large dashboard/mock files (`web/api/mock-backend.js`, `web/scripts/dashboard-scripts.js`) use companion static-data modules — **do not split again** unless they exceed thresholds without modularization.

## Fuzzy matching configuration

Consolidation scans use deterministic fuzzy matching (`server/lib/fuzzy-content-matcher.js`):

| Setting | Default | Location |
|---------|---------|----------|
| Threshold | **85%** (0.85) | `config.json` → `fuzzyMatch.threshold` |
| Methods | token Jaccard, line-hash Jaccard | `fuzzyMatch.methods` |
| Max pairs | 16 | `fuzzyMatch.maxPairs` |

Near-duplicates appear in scan output as `mergeType: fuzzy-near-duplicate`. They are **review candidates only** — not auto-merged.

When `LLAMA_CPP_BIN` is set, optional semantic **hints** are attached (`semanticHints`) but embeddings are **not** run during filesystem scans.

## Merge workflow (preview + confirm)

Auto-merge is **disabled**. All merges require explicit confirmation.

### 1. Run consolidation scan

```bash
npm run optimization:scan
# or POST /api/optimization/analyze
```

Report saved to `.simplebeacon/consolidation-report.json`.

**Trust check:** `repositoryFilesTotal` should be ~2,200 on `ai-platform` (audit inventory). Exports showing **~69k files** or merge candidates under `github-cache/` are stale — re-run after restarting the dashboard server. See [benchmark-scan-allowlist.md](./benchmark-scan-allowlist.md) § Dashboard export trust.

### 2. Preview merge plan

```bash
# POST /api/optimization/merge-preview
# body: { "candidateId": "exact-dup-1" }
```

Preview includes:

- `riskAssessment` (level, factors, quarantine-only)
- `confirmationPhrase`: `QUARANTINE_DUPLICATES`
- `executionMode`: `quarantine-not-delete`
- TTL: 1 hour (see `mergeWorkflow.previewTtlHours`)

Previews persist under `.simplebeacon/merge-previews/`.

### 3. Execute (quarantine, not delete)

```bash
# POST /api/optimization/merge-execute
# body: {
#   "previewId": "...",
#   "confirmed": true,
#   "confirmationPhrase": "QUARANTINE_DUPLICATES"
# }
```

Removed files move to `.simplebeacon/merge-quarantine/{previewId}/`. Backups go to `.simplebeacon/merge-backups/{previewId}/`. Audit entries append to `.simplebeacon/merge-audit.jsonl`.

Grace period: **24 hours** before any manual purge (no auto-delete).

### 4. Rollback

```bash
# POST /api/optimization/merge-rollback
# body: { "previewId": "..." }
```

Restores from backups recorded in the audit log.

## API reference

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/optimization/health` | Repository health payload |
| GET | `/api/optimization/compliance` | DevSecOps compliance scores |
| GET | `/api/optimization/candidates` | Cached merge candidates |
| POST | `/api/optimization/analyze` | Full consolidation scan |
| POST | `/api/optimization/merge-preview` | Safe merge preview |
| POST | `/api/optimization/merge-execute` | Quarantine duplicates (confirmed) |
| POST | `/api/optimization/merge-rollback` | Restore from backup |

## Verification checklist

```bash
npm run simplebeacon:report
npm run optimization:scan
node tools/monitor-file-sizes.js
npm test -- tests/unit/fuzzy-content-matcher.test.js tests/unit/merge-preview.test.js tests/unit/file-merger-reduction-scanner.test.js
```

## Related modules

- `server/lib/file-merger-reduction-scanner.js` — scan orchestration
- `server/lib/fuzzy-content-matcher.js` — fuzzy + pattern analysis
- `server/lib/merge-preview.js` — preview + risk assessment
- `server/lib/safe-merge-guard.js` — quarantine execution + audit
- `src/api/optimization-api.js` — HTTP routes
- `tools/archive-simplebeacon-artifacts.js` — archive helper
- `tools/monitor-file-sizes.js` — threshold monitor
