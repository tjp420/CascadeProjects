# SimpleBeacon V1 RC Preparation

**Milestone:** V1 RC Preparation — **not** deploy.  
**Distinction:** Benchmark green ≠ deployable. Deployable requires a frozen, clean, scoped, reproducible release candidate.

Generated from live checks on **2026-09-10**.

---

## Release gates (three separate decisions)

```text
1. Benchmark V1        → measurement proven     (FROZEN — PASS)
2. Engineering RC      → clean + regression     (THIS MILESTONE)
3. Production deploy   → explicit Yes / No      (NOT STARTED)
```

---

## 1. Freeze the benchmark — DONE

Immutable (do not tune engine to improve V1):

| Artifact | Path |
|----------|------|
| Baseline (human) | `fixtures/benchmark/BASELINE-v1.md` |
| Baseline (machine) | `fixtures/benchmark/baseline.v1.json` |
| Labels | `fixtures/benchmark/labels.v1.json` |
| Harness | `src/lib/verification-funnel-benchmark.js` + `scripts/verification-funnel-benchmark.cjs` |
| Contract tests | `tests/verification-funnel-benchmark.test.js` |

Claim:

> **100% verified recall on the current labeled positive controls, with zero unsupported promotions.**

---

## 2. Exact release commit — BLOCKED

```text
HEAD:         990d46681885abf0b960df6ef3a259365496c01a
origin/main:  990d46681885abf0b960df6ef3a259365496c01a
HEAD tip:     990d46681 Export githubCloneJobId for Evidence AnalyzeView rebuild.
Branch:       main...origin/main
```

| Check | Status |
|-------|--------|
| `HEAD == origin/main` | ✓ (tip SHAs match) |
| Working tree clean | **✗ FAIL** — ~441 dirty paths |
| RC commit contains only intended scope | **✗ FAIL** — harness not committed; tree polluted with unrelated work |

**Required before RC:**

```text
origin/main
    ↓
dedicated RC commit (benchmark + verification tooling only)
    ↓
clean tree (HEAD == that commit == origin tracking)
    ↓
full validation
    ↓
(separate) deploy authorization
```

Do **not** deploy from this dirty working tree.

---

## 3. Verification regression — PASS (CLI package)

Ran in `packages/simplebeacon-cli`:

| Command | Result |
|---------|--------|
| `npm test` | **1235/1235 pass** (exit 0) |
| `npm run benchmark:funnel` | **PASS** (exit 0) |

Track 2 contracts exercised by the suite include:

- goldens → 0 Verified  
- adversarial / severity-cannot-promote  
- synthetic XSS → Verified  
- NodeGoat → Verified  
- source corroboration  
- independent reproducibility  
- outreach remains OFF (engine comment + product path)

**Benchmark V1** (measurement):

| Control | Result |
|---------|--------|
| NodeGoat | 1/1 Verified |
| XSS fixture | 1/1 Verified |
| Open WebUI / Gitea / Immich | 0 Verified |
| Kubernetes (noise, separate) | 0 Verified |
| Unsupported Verified | 0 |
| Recall / Noise / Explainability | PASS / PASS / PASS |

> Benchmark V1 proves the measurement. Regression proves the engine didn't break.

---

## 4. Production artifact — NOT STARTED

Blocked until clean RC commit exists.

When ready, from that commit only:

```bash
cd packages/simplebeacon-cli
npm run build
```

Record:

```text
commit SHA:
build identifier:
artifact hash / filename:
build timestamp:
```

Answer must be: *Exactly which source produced what is running in production?*

---

## 5. Scope classification — REQUIRED

| Component | Decision for this RC |
|-----------|----------------------|
| Verification engine | Already on `main` tip; no V1 gate changes |
| Benchmark harness | **In scope** — commit as engineering tooling |
| Benchmark fixtures / baseline | **In scope** — commit |
| Dashboard | **Out of scope** unless explicit follow-up RC |
| Worker | **Out of scope** |
| Outreach | **OFF** |
| Marketing | **Out of scope** |

RC-scoped uncommitted files observed:

```text
 M packages/simplebeacon-cli/package.json
?? packages/simplebeacon-cli/fixtures/benchmark/
?? packages/simplebeacon-cli/scripts/verification-funnel-benchmark.cjs
?? packages/simplebeacon-cli/src/lib/verification-funnel-benchmark.js
?? packages/simplebeacon-cli/tests/verification-funnel-benchmark.test.js
 M .gitignore   # .simplebeacon/benchmark/ ignore — include with harness
```

Everything else in the dirty tree is **unrelated** and must not ride along.

---

## 6–7. Production smoke + post-deploy benchmark — NOT STARTED

Only after: clean RC commit → build → explicit deploy Yes.

- Dashboard: Evidence state (Signals / Dismissed / Review / Verified) on production artifact  
- Worker/API: endpoint + version marker if in scope  
- CLI-only ship: do **not** pretend production ran the benchmark; verify product consumes evidence correctly  

---

## RC checklist (live)

```text
SIMPLEBEACON RC
────────────────────────────────

Git
✗ clean tree
✗ release commit identified (harness still uncommitted)
✓ tip SHA matches origin/main (but tree is dirty)

Regression
✓ full CLI test suite (1235/1235)
✓ Track 2 contracts
✓ adversarial / goldens path in suite
✓ V1 benchmark PASS

Benchmark
✓ NodeGoat known vuln → Verified
✓ XSS known vuln → Verified
✓ negative controls → 0 Verified
✓ unsupported Verified → 0
✓ recall = 100% on current labeled positives

Build
□ production build from clean RC commit
□ artifact tied to release commit

Scope
✗ no unrelated worker/dashboard dirt in tree
✓ no Verified gate changes for V1
✓ outreach OFF

Deployment
□ deploy approved          ← separate authorization
□ production smoke test
□ deployed artifact verified
□ post-deploy validation
```

---

## Verdict

| State | Status |
|-------|--------|
| Verification engine + benchmark | **Release-candidate candidate** |
| Deployable | **No** — dirty tree / unscoped / no frozen RC commit |
| Deployed | **No** — not authorized |

### Next actions for RC (engineering only)

1. Isolate a branch or staged commit with **only** the RC-scoped files above.  
2. Re-run `npm test` + `npm run benchmark:funnel` on that clean commit.  
3. `npm run build` and record SHA + artifact identity.  
4. Ask explicitly: **Ship this exact commit? Yes / No.**  

Do **not** expand V2 ground truth, change the Verified gate, or deploy until that Yes is given.
