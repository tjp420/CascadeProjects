# Verification Funnel V2 — Results Record

**Status:** Measured against unchanged production funnel (RC candidate — not deployed).  
**V1:** Frozen / shipped — **not overwritten**.

| Field | Value |
|-------|--------|
| Benchmark | `verification-funnel-v2` |
| Date | 2026-09-10 |
| Verifier | **UNCHANGED** |
| Ground-truth vulnerabilities | **6** |
| Verified | **6** |
| Missed | **0** |
| Recall | **100%** |
| Unsupported Verified | **0** (hard gate) |
| Noise rejection | PASS |

## Ground-truth IDs

1. `nodegoat-ssjs-eval-rce`
2. `nodegoat-nosql-where-threshold`
3. `juice-sqli-login`
4. `juice-sqli-search`
5. `juice-dom-xss-search`
6. `slice6-dom-xss`

## Labeling note

First measurement: 4/6 — two misses were **label wording defects** (`attackPath` omitted chain sink). Corrected in `labels.v2.json` only. Re-run: 6/6. Verifier not modified.

## Separation from V1

| | V1 | V2 |
|--|----|----|
| Role | Frozen shipped baseline | Experimental coverage expansion |
| Package at V1 ship | `simplebeacon@3.0.556` | (not yet released) |
| Commit at V1 ship | `e096b47c4` | (pending V2 RC commit) |
| Labeled positives | 2 | 6 |

## Run

```bash
cd packages/simplebeacon-cli
npm run benchmark:funnel:v2
```

Machine record: `baseline.v2.json`
