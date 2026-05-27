# Roadmap source of truth

This repo accumulated multiple roadmap systems (markdown narratives, dashboard JSON, GGUF exports, development-roadmap analyzer output). Phase 1 establishes a single measured baseline and archives redundant completion announcements.

## Canonical sources (update these)

| Path | Role |
|------|------|
| `data/roadmap/gguf-roadmap-data.json` | Primary sprint baseline (`dataSource: repository-audit`) |
| `data/roadmap/ai-roadmap-report.json` | AI roadmap page sample / companion baseline |
| `server/lib/code-roadmap-generator.js` | Regenerates sprint phases from filesystem signals |

Regenerate baselines after meaningful repo changes:

```bash
node -e "require('./server/lib/code-roadmap-generator').generateRoadmapReport(process.cwd()).then(r => console.log(r.executiveSummary))"
```

Simplebeacon validates active files via `packages/simplebeacon-cli/src/lib/roadmap-json-specs.js` (rule: `roadmap`).

## Derived / secondary (do not edit for sprint status)

| Path | Role |
|------|------|
| `data-central/roadmap/roadmap-data.json` | 47-feature dashboard snapshot from `development-roadmap/` analyzer |
| `AI_PLATFORM_ROADMAP.md` | Executive narrative; banner points here |
| `development-roadmap/analysis-results/*` | Timestamped analysis exports |

These may use a different phase numbering (Phases 1–5 features vs Sprints 1–5). Treat `data/roadmap/*.json` as authoritative for sprint completion and CI/deploy status.

## Measured Phase 2 / sprint status (2026-05)

From `code-roadmap-generator` filesystem scan:

- **Sprints 1–4:** complete (auth, stub APIs, repository-audit samples, CI/Simplebeacon gate)
- **Sprint 5:** deferred (production deploy profile — Docker lifecycle in CI, `REQUIRE_AUTH` sign-off)

`data-central/roadmap/roadmap-data.json` marks Phase 2 "Data Processing" completed in the 47-feature model — consistent with sprint work done; production deploy remains backlog.

## Archived legacy fiction

Legacy exports with rejected template metrics (47 features at 74.17%, stale 62% templates, etc.) belong under `data/roadmap/archive/` and are **not** scanned when `archived: true` in specs:

- `archive/ai-roadmap-data.json` (if restored)
- `archive/cascade-project-roadmap.json` (if restored)

Root-level `*ROADMAP*COMPLETE*.md` completion announcements moved to `archive/roadmap/` — historical only.

## How to update

1. Change code / tests / CI signals in the repo.
2. Regenerate or hand-update `data/roadmap/*.json` to match measured reality (no fictional KPIs).
3. Optionally refresh `development-roadmap/run-analysis.js --update-central` for dashboard feature counts.
4. Adjust `AI_PLATFORM_ROADMAP.md` narrative only when executive messaging changes — not for sprint truth.
5. Run `npm test -- tests/unit/data-maintenance-analyzers.test.js` and Simplebeacon `roadmap` rule.

## Phase 2 / 3 remaining (for roadmap owners)

- **Phase 2 backlog:** production deploy profile (Sprint 5), database migration, OAuth/RBAC beyond JWT scaffold
- **Phase 3:** live GGUF inference (`LLAMA_CPP_BIN` / Ollama), semantic roadmap enhancement, deduplicating 775+ stale markdown references across `docs/`
