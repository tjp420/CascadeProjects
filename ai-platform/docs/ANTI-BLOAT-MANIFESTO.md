# Why I Built a Zero-Dependency Local Scanner Instead of Buying AI Guardrail Bloat

**Simplebeacon — local CI gate for AI-generated fake data, mock paths, and credential patterns**

This is a technical manifesto, not a pitch deck. Numbers below are **measured** on this repo (`ai-platform`, Windows 10, Node 20) unless noted. We do not publish speculative consolidation KPIs.

---

## 1. The problem: guardrail bloat

AI coding assistants leave realistic-looking placeholders in repos:

- Fiction KPIs (`completion_rate: 98.5`, `user_count: 47`)
- Mock JSON paths wired into production code (`status-sample.json`)
- Token-shaped strings that pass review

The industry response is often **heavy**: SaaS APIs, agent proxies, vendor dashboards, and pricing that starts at team tiers and climbs to **$5,000+ setup** for perimeter deployments.

That stack is justified when you need centralized policy, SSO, and managed DLP. It is **overkill** when your immediate need is: *fail CI if Copilot left fake data in the PR.*

---

## 2. Principle: consolidate only when scans prove duplication

**Do not consolidate on vibes.**

- Run inventory and merger scans first; treat output as **review candidates**, not a savings guarantee.
- A prior “76% reduction” or “15–30% storage savings” headline without a dated scan artifact is **fiction** — same class of problem as `98.5%` completion rates in demo JSON.
- Generic adapters and shared generators come **after** overlap is demonstrated (duplicate groups, fuzzy pairs, or repeated analyzer signatures) — not because two folders *look* similar.

Reproduce consolidation baseline:

```bash
npm run optimization:scan
# → .simplebeacon/consolidation-report.json
```

---

## 3. Measured baselines (May 2026)

Artifacts: `.simplebeacon/consolidation-report.json`, codebase analyzer (`context: complete`, `includeEslint: true`), `docs/planning/FULL_REMEDIATION_PROGRAM_2026-05-26.md`.

### File merger / reduction scan

| Metric | Measured value | Notes |
|--------|----------------|-------|
| Repository files inventoried | **36,738** | Explorer profile; excludes `node_modules`, `.git`, build dirs |
| Audit-scoped files walked | **9,883** | Merge logic scope |
| JSON files hashed (scoped paths) | **271** | `web/data`, `data/mock`, `data-central/...`, `data/roadmap` |
| Exact duplicate JSON groups | **0** | `exactDuplicateGroups: 0` |
| Merge / reduction candidates | **0** | `mergeCandidates: 0`, `reductionOpportunities: 0` |
| Fuzzy near-duplicate pairs | **0** | Threshold 0.85; pairs found: 0 |

**Takeaway:** This monorepo is **large on disk**, not **merge-ready**. Consolidation here means phased remediation and archiving experimental trees — not bulk auto-merge.

### Codebase analyzer (complete scan)

| Metric | Measured value | Notes |
|--------|----------------|-------|
| Findings (complete + ESLint) | **~790** | Latest measured ~698 (2026-05-27); not stale dashboard ~5k+ totals |
| Health score | **~82–83** | Penalized by finding density per file analyzed |
| Categories (typical) | debug-artifact, meaningless-data, tech-debt, eslint | Plus occasional duplicate/oversized |
| Stale dashboard totals | **Ignore** | UI can show inflated aggregates (e.g. 5k+); trust fresh scan JSON |

Reproduce:

```bash
node -e "require('./server/lib/codebase-analyzer').analyzeCodebase(process.cwd(),{context:'complete',includeEslint:true}).then(r=>console.log(r.summary))"
npm run remediation:metrics
```

### ESLint

| Metric | Status |
|--------|--------|
| Errors | **0** (cleared) |
| Warnings | **~80+** (cleanup in progress) |

### Roadmap / ship gate

| Item | Status |
|------|--------|
| Remediation sprints (docs, debug migration, fiction KPI) | **Marked complete** in program docs |
| Simplebeacon gate (`--gate`) | **PASS** on canonical paths |
| Production deploy | **Remaining gate** — `verify:predeploy` NO-GO until host secrets (JWT TTL, Stripe) are provisioned |

See: `docs/launch-decision.md`, `docs/planning/FULL_REMEDIATION_PROGRAM_2026-05-26.md`.

### CLI gate scan (unchanged — still fast)

| Workload | Time | Notes |
|----------|------|--------|
| Credential pattern scan (~7 KB text) | **~0.022 ms** / call | `scanTextContent`, 500-iteration median |
| Privacy pattern scan (same size) | **~0.14 ms** / call | `scanEnterprisePatterns` |
| Full repo gate scan (`--gate`) | **~4.0 s** | File walk + rules + production-leak pass |
| npm install surface | **0 runtime dependencies** | Community CLI |

```bash
cd packages/simplebeacon-cli && npm test
node packages/simplebeacon-cli/bin/simplebeacon.js scan --path . --gate --no-trust-banner
```

**Honest caveat:** Simplebeacon is not enterprise DLP. It is a **fast local gate** on AI fiction and mock data shipping to production.

---

## 4. What we will NOT do

- **Auto-merge** files or JSON without human review and a merge preview API confirmation
- **Delete** vendored doc trees, archives, or `node_modules` neighbors without an explicit audit entry
- **Claim** guaranteed 15–30% storage savings or “76% reduction” without a dated scan artifact
- **Ship** fiction KPIs (`98.5%`, `user_count: 47`, round-number “all tests passing” docs) as product truth
- **Expose** full recursive `scan.js` / tree-walker IP on the public homepage

---

## 5. What we WILL do

- **Phase remediation** — debug artifacts → `app-logger`, fiction neutralization, placeholder doc batches (see remediation program)
- **Archive** experimental duplicates and oversized `.simplebeacon/` artifacts (not delete-and-pray)
- **Build generic adapters** only after scans show overlapping behavior (same signatures, duplicate groups, or repeated analyzer hits)
- **Homepage diagnostic hook** — 100% client-side regex teaser for lead gen; full repo scan stays in the paid product
- **Keep CI honest** — `--gate`, `guard:fiction-kpi:ci`, `remediation:metrics -- --gate`

---

## 6. Consolidation priority (realistic)

Audit first. Consolidate second. Order by **proven overlap risk**, not folder name similarity.

| Priority | Area | Action |
|:--------:|------|--------|
| 1 | **Adapters** (`core/`, `server/lib/`, CLI bridges) | Inventory exports; merge only when two modules share scan-proven duplicate logic |
| 2 | **Generators** (mock data, roadmap exports) | Quarantine fiction outputs; one canonical generator per schema |
| 3 | **Analyzers** (codebase, merger, data-cleanup) | Align caps and categories; do not duplicate dashboard counters |
| 4 | **Vendored `docs/**/README_*.md`** (~892 files) | **Out of scope** for mass merge — archive policy only |
| 5 | **`src/web/*` vs `web/*` mirrors** | Document symlink/quarantine policy; no auto-consolidation |

---

## 7. Homepage diagnostic hook & IP boundary

**Public (marketing / lead gen)**

- `diagnostic-scanner.js` — browser-only, regex-based **teaser** (fiction KPI shapes, obvious mock paths, sample credential patterns)
- No repo upload required for the teaser; results are illustrative, not a compliance report
- CTA → audit booking / paid scan

**Private (product)**

- Recursive tree walker, path safety, gate severity logic
- Report generators (JSON/text), merge preview, complete-scan bundle
- `packages/simplebeacon-cli` rules + server-side `codebase-analyzer.js`

**Rule:** If it walks the full tree and writes gate-blocking findings, it stays **off** the public bundle. The homepage sells the *problem*; the CLI/dashboard sells the *proof*.

Routes (when `SIMPLEBEACON_LANDING=true`): `gguf-dashboard-server.js` serves `/diagnostic-scanner.js` from landing assets — not the full CLI `scan` implementation.

---

## 8. Zero-dependency architecture (community CLI)

Design constraints:

1. **No runtime npm dependencies** — auditable, `npx`-able
2. **Read-only scans** — never mutates source (verified in tests)
3. **Offline by default** — `--offline` fails on network I/O
4. **Explicit gate** — `--gate` exits 1 on configured severities

```
CLI (simplebeacon.js)
  → config + path safety (PathSanitizer, typed errors)
  → scan (walk files, apply rules)
  → reporters (text / JSON)
  → optional GitHub Action (examples/)
```

| Module | What it catches |
|--------|-----------------|
| `fiction-kpi-patterns.js` | Hardcoded metrics vs baseline |
| `production-leak.js` | Mock/sample paths in prod code |
| `credential-pattern-scanner.js` | AWS keys, JWTs, OpenAI keys, etc. |
| `mock-data-schema-validator.js` | Sample JSON vs page specs |

---

## 9. Evidence & cost (illustrative)

| Claim | Evidence |
|-------|----------|
| Catches AI fake data patterns | `packages/simplebeacon-cli/tests/fiction.test.js`, `tests/rules.test.js` |
| CI gate works | GitHub Action examples + gate tests |
| Zero runtime deps | `packages/simplebeacon-cli/package.json` |
| Local-only trust | `docs/TRUST.md`, `--offline` |
| Measured consolidation | `.simplebeacon/consolidation-report.json` (0 merge candidates) |

| Approach | Marginal cost per scan | Data leaves laptop? |
|----------|------------------------|---------------------|
| Simplebeacon community | $0 | No (default) |
| Cloud Teams tier | $49/mo | If you opt in |
| Enterprise perimeter | $5,000+ setup | Engagement-dependent |

The community CLI is the **Robin Hood layer**: same detection ideas, no invoice required.

---

## 10. Call to action

```bash
npx simplebeacon init
npx simplebeacon scan --gate
```

GitHub Actions: `packages/simplebeacon-cli/examples/github-action/simplebeacon.yml`

Operational runbooks: `docs/repository-optimization-runbook.md`, `docs/planning/FULL_REMEDIATION_PROGRAM_2026-05-26.md`

---

## What we learned in v2 (intellectual honesty)

- **Large repo ≠ mergeable repo** — 36k+ files inventoried, zero merge candidates in scoped JSON scan
- **Analyzer findings are real work** — hundreds of debug/placeholder/eslint hits, not a single “98.5% done” number
- **Dashboards lie when stale** — always re-run scans; do not trust cached mega-totals
- **Production is the last gate** — code hygiene sprints can finish while `verify:predeploy` is still NO-GO
- Regex rules false-positive; profiles and allowlists exist for a reason
- Business tier on simplebeacon.ai is optional; the CLI stands alone

---

## Consolidation Audit (2026-05-27)

Measured audit of categories cited in a prior “76% code reduction” consolidation analysis. Method: file inventory, line counts (`Get-Content | Measure-Object -Line`), method-name Jaccard similarity, normalized line diff, import graph (`unimported.json` entry: `server/index.js`), and `.simplebeacon/consolidation-report.json`.

### Audit table

| Category | Files (count) | Lines (measured) | Import graph | Verdict | Action taken |
|----------|---------------|------------------|--------------|---------|--------------|
| **Data adapters** | 6 in `src/adapters/` | **4,954** total (439 + 448 + 1,147 + 1,557 + 593 + 770) | All 6 listed in `reports/technical-debt/raw/unimported.json`; loaded only via `window.*` in `CentralDataIntegration.js`; script tags in `web/central-data-integration.js` are **commented out** | **Keep / archive candidate** — shared boilerplate (~6 methods: `initialize`, `validateDirectories`, `handleDirectoryChange`, `clearCache`, `getAllData`, `getStatus`) but **14–25% method-name overlap** between pairs; **14.1%** normalized line match (AITools vs Analytics). Feature-specific getters, mock generators, and save paths dominate. | **No merge.** Document only. Realistic savings from a base class: **~400–600 lines (~10%)**, not 76%. |
| **Report generators** | 4 primary JS modules | **862** `AIRoadmapReportGenerator.js`; **804** `EnhancedReportGenerator.js`; **796** `enhanced_report_generator.js` (= **796** duplicate in `web/scripts/`) | Roadmap generator is domain-specific; Enhanced variants differ by class structure (**1.0–1.2%** line match) | **Keep** generators; **consolidate duplicate copy** only | **No refactor.** One exact duplicate pair (`src/web/enhanced_report_generator.js` ≡ `web/scripts/enhanced_report_generator.js`) — candidate for a follow-up symlink/delete PR (~796 lines), not a unified generator. |
| **Dashboard servers** | 4 entry points | **1,757** `gguf-dashboard-server.js`; **987** `server/index.js`; **602** `server/dashboard-server.js`; **258** `server/dlp-dashboard.js` | `package.json` `"main": "server/index.js"`; `"dashboard"` script → `gguf-dashboard-server.js`; DLP via `npm run dlp:start` → `enterprise-dlp.js` → `DLPDashboard` | **Keep all** — different roles, not duplicates | **Document canonical entries** (below). Do **not** delete gguf/dlp without route trace. |
| **Analyzers** | **62** `*Analyzer*.js` / `*-analyzer.js` files | N/A (heterogeneous) | Spread across `packages/simplebeacon-cli/`, `server/lib/`, `src/core/`, `web/scripts/` | **Keep** — domain-specific (zscript, data-cleanup, roadmap, quality, etc.) | **No deletion pass.** Align with codebase-analyzer caps only. |
| **Dashboard components** | **32** `*Dashboard.js` | N/A | UI feature modules under `web/components/` | **Keep** — feature UI, not server duplication | None |
| **Services** | **15** `*Service.js` | N/A | Mixed server/web | **Keep** | None |
| **Controllers** | **5** `*Controller.js` | N/A | API layer | **Keep** | None |
| **File merger scan** | `.simplebeacon/consolidation-report.json` | 36,738 files inventoried | — | **0 merge candidates** | Confirms anti-bloat: no auto-merge target |
| **Codebase analyzer** | `server/lib/codebase-analyzer.js` | **~790 findings** (complete + ESLint context; manifesto baseline ~698–790) | — | Real remediation backlog, not merge signal | No analyzer purge |

### Canonical server entry points

| Entry | Port (default) | Role |
|-------|----------------|------|
| `server/index.js` | 3000 | **Package main** — auth, roadmap, upload, flexible-analyze API |
| `gguf-dashboard-server.js` | 54355 | **`npm run dashboard`** — Simplebeacon internal UI, phase2 bootstrap, shared scanner routes |
| `server/dashboard-server.js` | 56742 | **Legacy** AI Coding Intelligence dashboard; archive after cutover verification |
| `server/dlp-dashboard.js` | 3000 (env) | **DLP compliance UI** — violations/stats; mounted by `server/enterprise-dlp.js` |

Shared route modules (e.g. `server/routes/repository-scanner-api.js`) are intentionally reused by gguf and index — that is correct factoring, not bloat.

### Rejected claim: “76% code reduction”

That figure matches **technical-debt score targets** (76% → 85%) in sprint docs, **not** lines removed. Measured overlap does **not** support a repo-wide 76% line reduction:

- Adapters: ~10% recoverable boilerplate at best
- File merger: **0** candidates
- Report generators: unrelated domains + one duplicate copy
- Dashboard servers: complementary, not redundant

**Honest next single PR:** remove the exact duplicate `web/scripts/enhanced_report_generator.js` (re-export from `src/web/`) **or** archive the six unimported adapters behind a README in `docs/archive/` — pick one, not both in the same PR.

---

## License

MIT — use it, fork it, cite it in interviews.

**Author note:** Built as engineering portfolio + public utility, not as a forced upsell funnel.
