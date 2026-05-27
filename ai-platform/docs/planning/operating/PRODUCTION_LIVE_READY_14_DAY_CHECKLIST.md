# 14-Day Production-Live Checklist

This checklist is execution-only and uses commands already present in the repo.  
Run from `C:/Users/Trevor/CascadeProjects/ai-platform`.

## Decision criteria (must all be true for "production-live ready")

1. `npm run verify:predeploy` returns `Decision: GO` in two separate runs at least 24 hours apart.
2. `npm run test:integration` and `npm run smoke:test` are green with no unresolved Sev-1 defects.
3. Trust publication env validates and latest trust payload can be generated without missing required inputs.
4. Blocking governance items have explicit owner, due date, and evidence link (branch protection, secrets, backup/restore drill).
5. At least one production dry run is documented with rollback steps.

## Day-by-day execution

### Day 1-2: baseline and environment verification

```bash
npm ci
npm run verify:production-deploy
npm run verify:stripe
npm run trust:validate-env
```

Pass criteria:
- No missing required production vars.
- No placeholder secrets in production profile.
- Stripe checks only required when monetization is enabled.

### Day 3-4: quality and compliance baseline

```bash
npm run simplebeacon:report
npm run simplebeacon:assess -- --output .simplebeacon/assessment.json
npm run compliance:check
npm run guard:fiction-kpi:strict
```

Pass criteria:
- Assessment artifacts generated.
- No compliance blocker at high severity.
- No fictional KPI regressions in guarded paths.

### Day 5-6: integration and smoke stability

```bash
npm run test:integration
npm run test:auth
npm run smoke:test
```

Pass criteria:
- Integration and auth suites pass.
- Route smoke suite passes for default base URL.
- Any flaky test has issue owner and fix date.

### Day 7: first go/no-go checkpoint

```bash
npm run verify:predeploy
```

Pass criteria:
- Returns `Decision: GO`, or
- If `NO-GO`, open blocker log and assign each blocker owner/date in tracker before continuing.

### Day 8-10: deploy rehearsal and trust evidence

```bash
npm run simplebeacon:docker:config
npm run simplebeacon:docker:full
npm run trust:publish
npm run trust:history
```

Pass criteria:
- Docker full profile starts with healthy services.
- Trust payload publish path works with expected output.
- Trust history report updates without schema issues.

### Day 11-12: production dry run

```bash
npm run verify:predeploy
npm run simplebeacon:deploy
npm run smoke:test:production
```

Pass criteria:
- Predeploy still returns `Decision: GO`.
- Deploy command completes with no unresolved post-deploy error.
- Production smoke test passes.

### Day 13-14: final readiness decision

```bash
npm run verify:predeploy
npm run trust:trend
```

Pass criteria:
- Third `verify:predeploy` run is `Decision: GO`.
- Trend output is available for weekly operating review.
- Final readiness meeting records go/no-go result and rollback owner.

## Blocker log template (use in weekly review)

| Blocker | Severity | Owner | Due date | Mitigation | Status |
|---|---|---|---|---|---|
| Example: branch protection checks not enforced | High | `<Repo Admin>` | YYYY-MM-DD | Enable required checks and re-run protection validation | Open |

## Weekly operating review runbook (how to run)

1. Update `docs/planning/operating/business-execution-tracker.json` with latest actuals/statuses.
2. Re-run command set:
   - `npm run verify:predeploy`
   - `npm run test:integration`
   - `npm run smoke:test`
   - `npm run trust:history`
3. Compare actual vs target for current month KPIs.
4. Mark each critical path item `on_track`, `at_risk`, or `off_track`.
5. Decide: continue, intervene, or no-go for current milestone gate.
