# SimpleBeacon Verification Funnel Benchmark V1 — FROZEN BASELINE

**Status:** Frozen. Do not tune numbers against this baseline.  
**Do not:** change the Verified gate, touch the production dashboard, or deploy to make this look better.  
**Next milestone:** V2 ground-truth expansion (more NodeGoat paths + Juice Shop labels) — not gate loosening.

## Claim (precise)

> **100% verified recall on the current labeled positive controls, with zero unsupported promotions.**

Not “100% vulnerability detection accuracy.” The labeled corpus is intentionally small.

## Positive controls

| Target | Result |
|--------|--------|
| NodeGoat (`ssjs-eval-rce`) | **1/1 Verified** |
| XSS fixture (`slice6-dom-xss`) | **1/1 Verified** |

## Negative controls

| Target | Result |
|--------|--------|
| Open WebUI | **0 Verified** |
| Gitea | **0 Verified** |
| Immich | **0 Verified** |

## Noise control (separate question)

| Target | Result |
|--------|--------|
| Kubernetes (mature-noise proxy / optional external sample) | **0 Verified** |

Kubernetes answers: *can contextual matches avoid becoming Verified?*  
It is **not** part of vulnerability recall.

## Acceptance

| Metric | Value |
|--------|-------|
| Verified recall (labeled positives) | **100%** (2/2) |
| Unsupported Verified | **0** |
| Recall | **PASS** |
| Noise rejection | **PASS** |
| Explainability | **PASS** |

## What this validates

1. The benchmark measures the **production** path (`compileGateStatus` → triage → semantic verification → Verified engine → `maintainerHeadline`), not a parallel implementation.
2. Labeled known vulns can reach **Verified** with reproducible evidence.
3. Severity / narrative alone does **not** manufacture Verified findings.
4. Fail-closed negative controls hold.

## Reproduce

```bash
cd packages/simplebeacon-cli
npm run benchmark:funnel
```

Labels: `labels.v1.json`  
Machine snapshot: `baseline.v1.json`
