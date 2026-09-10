# SimpleBeacon V1 RC Preparation

**Milestone:** V1 RC Preparation — **not** deploy.  
**Distinction:** Benchmark green ≠ deployable. Deployable requires a frozen, clean, scoped, reproducible release candidate.

Generated from live checks; **engineering RC commit recorded below**.

---

## Release gates (three separate decisions)

```text
1. Benchmark V1        → measurement proven     (FROZEN — PASS)
2. Engineering RC      → clean scoped commit    (THIS COMMIT — VALIDATED)
3. Production deploy   → explicit Yes / No      (NOT STARTED — STOP HERE)
```

---

## Engineering RC commit (scoped)

```text
commit:   792aa1e5a77ed5f4b529e7dd7d7e2ad0b52c10d0
subject:  Add verification funnel benchmark V1 as a frozen engineering RC.
parent:   990d46681885abf0b960df6ef3a259365496c01a
branch:   main (ahead of origin/main by 1 — not pushed)
invariant: RC commit contains the benchmark infrastructure and nothing else.
```

**Files in commit (23):** `.gitignore` (+`.simplebeacon/benchmark/` only),
`packages/simplebeacon-cli/package.json` (`benchmark:funnel`), harness lib/script/tests,
`fixtures/benchmark/**` (baseline, labels, goldens, noise, juice-shop extracts for V2 prep).

**Not in commit:** dashboard, worker, marketing, outreach, Verified gate, unrelated dirty tree.

---

## Post-commit revalidation (from this SHA)

| Check | Result | Timestamp (UTC) |
|-------|--------|-----------------|
| `npm test` | **1235/1235 pass** (exit 0) | 2026-09-10T19:36 |
| `npm run benchmark:funnel` | **PASS** (exit 0) | 2026-09-10T19:36:39Z |
| `npm run build` | **PASS** (exit 0) | 2026-09-10T19:36 |

### Build record

```text
commit SHA:     792aa1e5a77ed5f4b529e7dd7d7e2ad0b52c10d0
package:        simplebeacon@3.0.556
build command:  npm run build  →  node -c bin/simplebeacon.js && node -c src/index.js
build status:   success
harness artifact: packages/simplebeacon-cli/src/lib/verification-funnel-benchmark.js
artifact sha256:  e9e1303fe815615b7ba7a70a181b599e693f55d8f1c16b96bf1a36e37fe20154
build timestamp: 2026-09-10T19:36:57Z
```

### Benchmark snapshot (same run)

| Control | Verified |
|---------|----------|
| NodeGoat | 1 |
| XSS fixture | 1 |
| Open WebUI / Gitea / Immich | 0 |
| Kubernetes (noise) | 0 |
| Unsupported Verified | 0 |
| Recall / Noise / Explainability | PASS / PASS / PASS |

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

## 2. Exact release commit — ENGINEERING RC READY (local)

```text
working tree: still dirty with unrelated work (intentional — left untouched)
HEAD:         792aa1e5a… (RC) — ahead of origin/main
```

| Check | Status |
|-------|--------|
| Scoped RC commit exists | ✓ |
| RC contains only benchmark infrastructure | ✓ |
| Unrelated dirty work left in place | ✓ |
| `origin` synchronized (pushed) | ✗ not pushed — separate decision |
| Entire working tree clean | ✗ not required for RC isolation |

---

## 3. Verification regression — PASS

Track 2 contracts exercised by the suite include goldens → 0 Verified, adversarial /
severity-cannot-promote, synthetic XSS → Verified, NodeGoat → Verified, source
corroboration, independent reproducibility, outreach OFF.

> Benchmark V1 proves the measurement. Regression proves the engine didn't break.

---

## 4. Production artifact — BUILD RECORDED

Syntax build from CLI package on the RC commit succeeded. Artifact hash recorded above.

---

## 5. Scope classification — HONORED

| Component | Decision |
|-----------|----------|
| Benchmark harness / fixtures / baseline | **Shipped in RC commit** |
| Verification engine | Unchanged (no gate tuning) |
| Dashboard / Worker / Marketing | **Out of scope** |
| Outreach | **OFF** |

---

## 6–7. Production smoke + post-deploy — NOT STARTED

**STOP.** Deployment remains a separate authorization.

---

## RC checklist (live)

```text
SIMPLEBEACON RC
────────────────────────────────

Git
✓ scoped RC commit identified (792aa1e5a)
✓ RC contains benchmark only
✓ unrelated dirty tree preserved (not reset)
□ push to origin (optional; separate decision)

Regression
✓ full CLI test suite (1235/1235) on RC
✓ Track 2 contracts
✓ V1 benchmark PASS on RC

Benchmark
✓ NodeGoat → Verified
✓ XSS → Verified
✓ negatives → 0 Verified
✓ unsupported Verified → 0

Build
✓ npm run build succeeds on RC
✓ artifact hash recorded

Scope
✓ no unrelated worker/dashboard in RC
✓ no Verified gate changes
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
| V1 frozen | **Yes** |
| Engineering RC | **Yes — 792aa1e5a**, revalidated + build recorded |
| Deployable authorization | **Awaiting explicit Yes / No** |
| Deployed | **No** |

**Next decision only:** Ship this exact commit? **Yes / No.**
