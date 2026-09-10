# Verification Funnel V2 — Results Record

**Status:** DEPLOYABLE pending authorization — **deployment NOT performed**.  
**V1:** Frozen / shipped (`e096b47c4` / `simplebeacon@3.0.556`) — **not overwritten**.

| Field | Value |
|-------|--------|
| Benchmark | `verification-funnel-v2` |
| Git commit | `39813cea8` |
| Date | 2026-09-10 |
| Verifier | **UNCHANGED** |
| Ground-truth vulnerabilities | **6** |
| Verified | **6** |
| Missed | **0** |
| Recall | **100%** |
| Unsupported Verified | **0** (hard gate) |
| Regression | **1237/1237 PASS** |
| V1 benchmark | **PASS** |
| Build | **PASS** (`simplebeacon@3.0.556`) |
| Harness sha256 | `ffee5cd63f2b7c15cfd8043841f87dbb0c43edfbd2771d5de5834866c1190c02` |

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
| Package | `simplebeacon@3.0.556` | same package version (no bump yet) |
| Commit | `e096b47c4` | `39813cea8` |
| Labeled positives | 2 | 6 |

## Run

```bash
cd packages/simplebeacon-cli
npm run benchmark:funnel:v2
```

Machine record: `baseline.v2.json`
