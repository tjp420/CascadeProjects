# Dashboard (Simplebeacon viewer)

The legacy GGUF / implementation-plan dashboard (`dashboard-new.html`) remains available for deep platform pages not yet in the Simplebeacon SPA.

**Default entry:** `/` serves the **Simplebeacon dashboard** (`web/simplebeacon-dashboard/`) — scan, results, analyze, platform, quality, tools, and help.

**Legacy platform UI:** `/dashboard-new.html` — full measured page library (roadmap, AI tools, debt calculators, etc.). Linked only from **All Features** or **Legacy Platform UI** in the sidebar.

## Architecture

```
web/simplebeacon-dashboard/
├── index.html
├── css/          # Design system (no Bootstrap)
└── js/
    ├── main.js   # Entry point
    ├── views/    # Dashboard, Results, Settings
    └── services/ # Report/baseline/config fetch
```

API routes (gguf-dashboard-server): `/api/simplebeacon/report`, `/baseline`, `/config`, `/history`, `POST /scan`.

## Do not add

- New sample-only pages or placeholder KPI widgets on the legacy dashboard
- Hardcoded completion percentages not backed by repository audit or `.simplebeacon/baseline.json`
- "Demo mode" buttons that no-op instead of running measured workflows

## Allowed changes

- Bug fixes on either dashboard surface
- Wiring real APIs and measured data sources
- Displaying Simplebeacon scan output (`.simplebeacon/report.json`)
- Dev-tool actions that run actual scripts (`npm run simplebeacon`, coverage sync, etc.)
- Improvements to the Simplebeacon dashboard UX and performance

## Source of truth

| Metric | Source |
|--------|--------|
| Jest pass rate | `.simplebeacon/baseline.json` → `jestTestsLabel` |
| Page sample count | `.simplebeacon/baseline.json` → `pageSamplesLabel` |
| Mock JSON quality | `npm run simplebeacon` |
| Scan issues / gate | `.simplebeacon/report.json` |
| Trend history | `.simplebeacon/history.json` (appended on scan) |

## Product direction

Ship **Simplebeacon** (`simplebeacon`, GitHub Action) as the external product. The Simplebeacon dashboard is the primary internal viewer; the legacy monolith is retained for historical platform pages until those workflows migrate or retire.
