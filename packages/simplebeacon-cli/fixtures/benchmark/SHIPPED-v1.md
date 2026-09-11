# Verification Funnel V1 — SHIPPED

**Milestone status:** SHIPPED (2026-09-10)  
**Do not** tune the Verified gate, dashboard, worker, or outreach against this release.

## Locked claim

> **100% verified recall on the current labeled positive controls, with zero unsupported promotions.**

Not “100% vulnerability detection accuracy.” The labeled corpus is intentionally small.

## Release identity

| Item | Value |
|------|--------|
| Package | `simplebeacon@3.0.556` |
| Release commit | `e096b47c4` |
| Benchmark commit | `792aa1e5a` |
| npm shasum | `9a6cba79d6b900d00c8e9bc03681a79caf9b1a76` |
| Post-ship V1 benchmark | **PASS** |
| CLI regression | **1235/1235** (established on RC) |

## Provenance

```text
source → RC (792aa1e5a → e096b47c4) → GitHub origin/main → npm 3.0.556 → post-ship benchmark PASS
```

Registry `gitHead` matches RC tip `e096b47c4`.

## In scope / out of scope

| In this ship | Not in this ship |
|--------------|------------------|
| Verification funnel benchmark V1 | Dashboard production deploy |
| Labels, baseline, harness | Worker production deploy |
| CLI package `3.0.556` | Verified gate changes |
| | Outreach (remains OFF) |
| | Unrelated dirty working tree |

## Next engineering milestone

**V2 ground-truth expansion** — more NodeGoat paths + Juice Shop labels, same production funnel, still zero unsupported Verified.

V2 is judged against this frozen V1 baseline — not by loosening the gate.
