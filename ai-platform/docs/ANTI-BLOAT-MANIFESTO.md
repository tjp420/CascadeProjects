# Anti-Bloat Manifesto

Keep the `ai-platform` tree lean and measurable.

## Rules

1. **No fictional KPIs** in HTML dashboards — use `—` until `/api/*` returns data (`DashboardMetricsService`, `measured-metrics.js`).
2. **No debug `print()`** in production Python — use `logging` (`logger.info` / `logger.exception`).
3. **One canonical doc** per topic — avoid numbered duplicate `CONTRIBUTING_1_2_3_…` sprawl.
4. **Scripts are tools, not product** — prefer `packages/simplebeacon-cli` for repeatable audits over one-off root scripts.
5. **Delete or quarantine** generated backups (`.simplebeacon-backup.*`) before release branches.

## Verification

```bash
npm run lint --workspace=packages/simplebeacon-cli
npx simplebeacon codebase-audit --profile audit
```

Target: health score ≥ 88, high-severity findings = 0 after mock-name false-positive tuning.
