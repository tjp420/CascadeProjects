# Full Remediation Program — 90+ Health, Production Ship

**Start:** 2026-05-26  
**Duration:** 3 weeks (15 working days)  
**Owner:** Engineering  
**Exit criteria:** Health score ≥ 90, critical-path coverage ≥ 70%, `verify:predeploy` GO, Simplebeacon gate PASS

---

## Baseline (Day 0)

| Metric | Baseline | Target |
|--------|----------|--------|
| Codebase health score | 84 | **≥ 90** |
| Total analyzer findings | ~420 | **≤ 80** |
| High severity | 20 (18 fixed) | **0** |
| Medium severity | ~113 | **≤ 25** |
| Low severity | ~287 | **≤ 55** |
| Jest tests | 861/861 pass | maintain all tests passing |
| Line coverage (critical paths) | ~15% global | **≥ 70%** on scoped paths |
| Debug guard (`server/`) | 3452 hits repo-wide | **0** strict on `server/` hot paths |
| Production deploy | NO-GO | **GO** |

Run baseline anytime:

```bash
npm run remediation:metrics
```

Output: `.simplebeacon/remediation-weekly.json`

---

## Week 1 — Credibility + production hygiene (Days 1–5)

**Goal:** Health 84 → 88+, high findings 0, debug artifacts controlled

| Day | Workstream | Deliverables |
|-----|------------|--------------|
| 1 | **Program kickoff** | This doc; `remediation:metrics` baseline; `app-logger` module |
| 1–2 | **Fiction KPI cleanup** | All archived `98.5%` docs (done); neutralize 5× `all tests passing` docs; scan `docs/` for remaining hardcoded-perfect |
| 2–3 | **Debug artifact program** | `detectDebugArtifacts` skips gated lines; migrate `server/index.js`, `middleware/*`, `routes/upload.js` to `app-logger` |
| 3–4 | **Analyzer accuracy** | Fix self-scan false positives in `codebase-analyzer.js`; align `production-debug-guard` with analyzer rules |
| 4–5 | **Operator verification** | E2E `#/security`; document production env checklist |
| 5 | **Week 1 gate** | `remediation:metrics` — high=0, health≥88, tests pass |

### Week 1 files (priority migration to `app-logger`)

```
server/index.js
server/middleware/security.js
server/middleware/resilience.js
server/middleware/upload-security.js
server/routes/upload.js
server/config/security.js (audit trail → logger.info)
```

---

## Week 2 — Critical-path test coverage (Days 6–10)

**Goal:** Health 88 → 92+, coverage ≥ 70% on scoped production modules

### Coverage scope (`jest.config.js` → `collectCoverageFrom`)

```
server/lib/secret-config.js
server/lib/path-safety.js
server/lib/codebase-analyzer.js
server/middleware/auth.js
server/middleware/upload-security.js
server/routes/upload.js
server/routes/simplebeacon*.js (if present)
server/services/user-service.js
gguf-dashboard-server.js (scan + security routes only — partial)
```

| Day | Workstream | Deliverables |
|-----|------------|--------------|
| 6 | **Auth + secrets** | Tests for JWT fail-fast, refresh flow edge cases |
| 7 | **Upload + path safety** | Integration tests for `POST /api/upload/files`, path traversal blocks |
| 8 | **Security scanner API** | Tests for `POST /api/simplebeacon/scan`, report export, 403 without internal flag |
| 9 | **Codebase analyzer** | Regression tests for gated debug, fiction KPI, health score |
| 10 | **Week 2 gate** | `npm run test:coverage` — scoped paths ≥ 70%; health ≥ 92 |

---

## Week 3 — Hygiene + production hardening (Days 11–15)

**Goal:** Health ≥ 90, production GO, sustainable guards

| Day | Workstream | Deliverables |
|-----|------------|--------------|
| 11 | **Doc placeholders** | Batch neutralize top 50 `TBD`/`coming soon` in user-facing docs; exclude vendored `docs/**/README_*.md` from scans |
| 12 | **Duplicate tree audit** | Document `src/web/*` vs `web/*`; quarantine or symlink policy |
| 13 | **Artifact cleanup** | Move `security-reports/fixes/*` to `.simplebeacon/archive/`; update scan excludes |
| 14 | **Production config** | Real JWT/Stripe in `.env.production`; `verify:predeploy` GO |
| 15 | **Ship review** | Final metrics; update `ship-readiness-checklist.md`; launch-readiness sign-off |

### CI guards (add by Week 3)

```bash
npm run guard:debug-artifacts:strict    # fail on server/ console.log
npm run guard:fiction-kpi:ci            # fail on fiction in scoped paths
npm run remediation:metrics -- --gate    # fail if health < 90
```

---

## Finding categories → owners

| Category | Count (baseline) | Week | Action |
|----------|------------------|------|--------|
| Fiction KPI (`98.5%`, hardcoded perfect) | 20 high + 5 medium | 1 | Neutralize or remove claims |
| Debug artifacts (`console.log`, `debugger`) | ~113 medium | 1–2 | `app-logger` + gated detection |
| TODO/FIXME/HACK | 5 | 3 | Ticket or resolve |
| Placeholders (TBD, lorem) | ~287 low | 3 | Batch neutralize user-facing docs |
| Duplicate basenames | ~5 low | 3 | Audit `src/web` mirror |
| Generated artifacts | 2 low | 3 | Archive out of tree |

---

## Explicitly out of scope

- Mass consolidation of 892 vendored `README_*.md` under `docs/`
- Full 48-analyzer AI suite implementation
- Prometheus/ELK monitoring stack
- 100% global repo coverage (only critical paths)

---

## Weekly status template

Copy to `docs/reports/remediation-weekly-YYYY-MM-DD.md`:

```markdown
## Week N status
- Health score: X → Y
- Findings: high / medium / low
- Coverage (scoped): X%
- Tests: pass/fail
- Blockers:
- Next week focus:
```

---

## Commands reference

```bash
npm run remediation:metrics              # full weekly snapshot
npm run remediation:metrics -- --gate      # exit 1 if health < 90
npm run guard:debug-artifacts:strict
npm run test:coverage
npm run verify:predeploy
npm run simplebeacon:report
```
