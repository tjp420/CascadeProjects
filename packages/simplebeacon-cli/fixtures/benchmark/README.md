# Verification funnel benchmark (v1) — FROZEN

Measurement layer over the **existing** Track 2 verification machinery.
No second pipeline. No production deploy.

**Baseline frozen:** see [`BASELINE-v1.md`](./BASELINE-v1.md) and [`baseline.v1.json`](./baseline.v1.json).  
**RC preparation:** see [`RC-PREP-v1.md`](./RC-PREP-v1.md) — benchmark green ≠ deployable.

> **100% verified recall on the current labeled positive controls, with zero unsupported promotions.**  
> (Not “100% vulnerability detection accuracy.”)

**Do not** tune the Verified gate, dashboard, or deploy against these numbers.  
**Next milestone:** V2 ground-truth expansion (more NodeGoat paths + Juice Shop) — same harness, more labels, still zero unsupported Verified.

## Production path under test

```text
rawIssues
  → compileGateStatus
    → attachVerifiedFindings
    → attachSignalTriage
    → attachSemanticVerification  (→ applyVerifiedEngine)
    → maintainerHeadline
```

Labeled positive controls then promote through the **same** `attemptVerifiedPromotion` / `applyVerifiedEngine` API used in production.

## V1 targets

| Target | Role | Pass means |
|--------|------|------------|
| NodeGoat | Positive (recall) | `ssjs-eval-rce` → Verified |
| XSS fixture (Slice 6) | Positive (Track 2 contract) | complete chain → Verified |
| Open WebUI / Gitea / Immich | Negative | 0 unsupported Verified |
| Kubernetes | Noise/context (separate) | contextual matches → 0 Verified |

## Acceptance (two-sided)

**Maximize verified recall subject to zero unsupported promotion.**

Dismissed counts are reported for transparency — they are **not** a success metric.  
Kubernetes noise is **not** folded into vulnerability recall.

## Run

```bash
cd packages/simplebeacon-cli
npm run benchmark:funnel
# or
node scripts/verification-funnel-benchmark.cjs
node scripts/verification-funnel-benchmark.cjs --json
```

Optional full Kubernetes sample:

```bash
set SB_BENCH_K8S_ROOT=C:\path\to\kubernetes
node scripts/verification-funnel-benchmark.cjs
```

Without that env var, CI uses the `mature-noise` proxy under `fixtures/benchmark/mature-noise/`.

Report: `.simplebeacon/benchmark/verification-funnel-report.json`  
Labels: `fixtures/benchmark/labels.v1.json`
