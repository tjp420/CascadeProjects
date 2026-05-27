# Action Plan — Security Scanner Beta Ship

**Date:** 2026-05-26  
**Strategy:** Ship one working feature (Security Scanner MVP) before expanding scope.

---

**Track selected:** Full remediation (2–3 weeks) — see [`docs/planning/FULL_REMEDIATION_PROGRAM_2026-05-26.md`](planning/FULL_REMEDIATION_PROGRAM_2026-05-26.md)

## Production readiness (audit reconciliation — 2026-05-26)

**Verdict: Do NOT ship to production.** This matches the comprehensive scan and prior checklist.

| Audit claim | Current reality | Blocks production? |
|-------------|-----------------|-------------------|
| Health score 84/100 | Repo-wide heuristic; not the Simplebeacon gate | **Soft blocker** — improve over time |
| 420 findings | Mostly docs/legacy outside active scan paths | **Partial** — credibility, not runtime |
| 20 high fiction KPIs | **18/18 claim docs fixed**; 2 are anti-fiction references (intentional) | **Resolved** for listed high items |
| Debug logging (9 files) | **Hot paths gated** (`API_GATEWAY_DEBUG`, `API_OPT_DEBUG`); bootstrap `warn`/`info` + `console.error` remain by design | **Mitigated**, not zero-log |
| Test coverage 14.9% | True globally; **861/861** targeted tests pass | **Hard blocker** for enterprise prod |
| Production config | JWT/Stripe placeholders; `verify:predeploy` NO-GO | **Hard blocker** |

### Two-track shipping model

| Track | Verdict | What “ship” means |
|-------|---------|-------------------|
| **Beta MVP** (Security Scanner) | **READY** (pending operator E2E) | Internal/staged use on `:54355` with v1-internal profile |
| **Production** | **NOT READY** | Public deploy with real secrets, 70%+ critical-path coverage, health 90+ |

### Production path (2–3 weeks if prioritized)

1. **Week 1:** Real `.env.production` secrets + `verify:predeploy` GO; finish E2E; neutralize remaining “all tests passing” doc claims (5 files)
2. **Week 2:** Critical-path coverage push (auth, scan API, upload, security view) toward 70% on `server/` + security routes
3. **Week 3:** Health score uplift — placeholder doc cleanup, duplicate `src/web` audit, artifact archival

**Do not block beta** on full 420-finding remediation or 70% global coverage unless production is the target date.

---

| Scope | Status | Notes |
|-------|--------|-------|
| Simplebeacon gate | **PASS** | 42 mock files, quality 100, 0 credential/fiction hits |
| Unit/integration tests | **PASS** | 848/848 (56 suites) |
| Beta Security Scanner | **READY** | Code + tests done; manual E2E pending |
| Production deploy | **NOT READY** | JWT + Stripe secrets in `.env.production` |

---

## Phase A — Ship beta (today, operator)

1. Start dev server:
   ```powershell
   cd ai-platform
   npm run dashboard:v1-internal
   ```
2. Health check: `http://localhost:54355/api/health`
3. Sign in: `http://localhost:54355/#/signin` → `dev@simplebeacon.ai` / `demo123`
4. Security flow: `#/security` → **Run security scan** → confirm findings or honest empty state → **Export JSON**
5. Mark E2E complete in `docs/ship-readiness-checklist.md` when done

**Restart required** after env, route, or path-safety changes.

---

## Phase B — Close non-blocking gaps (this pass)

| Task | Owner | Status |
|------|-------|--------|
| Delete 3 broken root scripts (not in `package.json`) | Agent | **DONE** — `targeted-template-fix.js`, `validate-html-js.js`, `test-rebuilt-roadmap.js` |
| Re-run gate + tests | Agent | **DONE** — see verification below |
| Confirm merge audit (5 claimed merges) | Operator | **PARTIAL** — 3/5 in `.simplebeacon/merge-audit.jsonl`; `trust-publish` + `gate-test` unverified |
| Analyzer INSUFFICIENT_DATA on `#/analyze` | Deferred | Expected without live AI input; 10/48 analyzers implemented |

---

## Phase C — Production (when ready)

1. Set real secrets in `.env.production`: `JWT_SECRET`, `JWT_REFRESH_SECRET`, Stripe keys
2. Run `npm run verify:predeploy` until **GO**
3. Branch protection / org sign-off per `docs/launch-readiness-scorecard.md`

---

## Explicitly deferred (post-beta feedback)

- 892 vendored `README_*.md` under `docs/` — exclude from scans; do not mass-consolidate
- Full 48-analyzer suite implementation
- 40% test coverage push, Prometheus/ELK monitoring
- ~420-finding comprehensive remediation program
- 8-week doc consolidation

---

## Verification commands

```bash
npm run simplebeacon:report          # gate pass
npm run simplebeacon:path-check -- --with-api
npm run compliance:check
npm test -- --no-coverage            # 848/848
npm run verify:predeploy             # expected NO-GO locally
```

---

## Key references

- Ship checklist: `docs/ship-readiness-checklist.md`
- Getting started: `docs/security-scanner-getting-started.md`
- Remediation status: `docs/reports/remediation-status-2026-05-26.md`
- Security MVP: `docs/security-scanner-mvp-status.md`
