# Verification Funnel V3 — Results Record

**Status:** CODE COMPLETE — **deployment NOT performed**.  
**V1:** Frozen / shipped — **not overwritten**.  
**V2:** Locked PASS — **not overwritten**.

| Field | Value |
|-------|--------|
| Benchmark | `verification-funnel-v3` |
| Date | 2026-09-10 |
| Verifier | **UNCHANGED** |
| Ground-truth vulnerabilities | **10** (6 inherited from V2 + 4 new) |
| Verified | **10** |
| Missed | **0** |
| Recall | **100%** (informational — not required for V3 pass) |
| Vulnerability classes | **5** (ssjs-injection, nosql-injection, sql-injection, dom-xss, command-injection) |
| Hard negatives | **8** |
| Hard negatives correctly rejected | **8** |
| Wrongly Verified hard negatives | **0** |
| Unsupported Verified | **0** (hard gate) |
| V1 / V2 benchmarks | **PASS** |
| Harness sha256 | `99e91f25c45e75890fdcebed8476482e16e7f3ebc659244ffd5c1fae97d54094` |

## New positive controls (diversity)

1. `v3-cmdi-query-exec` — command injection via `child_process.exec`
2. `v3-function-ctor-rce` — SSJS via `new Function` (eval-family variant)
3. `v3-outerhtml-dom-xss` — DOM XSS via `outerHTML` (not `innerHTML`)
4. `v3-sqli-order-by` — SQLi via `ORDER BY` interpolation (not WHERE concat)

## Hard negatives

Severity-only, fabricated chain, plausible wording, sanitizer-without-bypass, parameterized login scare, tutorial `eval` constant, hedged narrative, tautological link — all stayed unverified.

## Pass criterion (V3)

**unsupported Verified = 0 + hard negatives rejected.**  
Perfect recall is **not** required for pass; misses are recorded honestly.

## Credible claim

> SimpleBeacon achieved 100% verified recall on the ten currently labeled V3 positive controls, rejected all eight hard negatives, and recorded zero unsupported Verified promotions — with an unchanged verifier.

## Run

```bash
cd packages/simplebeacon-cli
npm run benchmark:funnel:v3
```

Machine record: `baseline.v3.json`
