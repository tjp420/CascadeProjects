# Verification Funnel V4 — Out-of-Sample Results

**Status:** MEASUREMENT COMPLETE locally — **not committed unless authorized**.  
**V3 control:** `d4a11503b` — **PASS (10/10, 8/8, 0 unsupported)** — untouched.  
**Verifier:** **UNCHANGED**

| Field | Value |
|-------|--------|
| Benchmark | `verification-funnel-v4` |
| Branch | `benchmark/v4-out-of-sample` |
| Date | 2026-09-10 |
| OOS known positives | **5** |
| OOS Verified | **4** |
| OOS Missed | **1** |
| OOS verified recall | **80%** |
| OOS verified precision | **80%** |
| Hard negatives | **8** (2 borderline) |
| Hard negatives rejected | **7** |
| Wrongly Verified | **1** (`hn4-dead-branch-eval`) |
| Unsupported Verified | **1** |
| V3 regression | **PASS** |
| Hard gate (V4 pass) | **FAIL** |

## Per-class (OOS)

| Class | Verified |
|-------|----------|
| ssjs-injection | 0/1 |
| nosql-injection | 1/1 |
| sql-injection | 1/1 |
| dom-xss | 1/1 |
| command-injection | 1/1 |

## Failure analysis (honest)

### Positive miss — corpus/coverage vs evidence vocabulary

1. **`v4-ssjs-vm-run`** (`evidence-threshold`)  
   `vm.runInNewContext` is a real SSJS sink, but the unchanged RCE evidential vocabulary does not treat it as a code-execution sink (`impactClass=rce without code-execution sink evidence`).  
   **Category:** evidence-threshold / classifier coverage — **do not retune against V3 control in this pass.**

### Hard-negative false positive — reachability gap

2. **`hn4-dead-branch-eval`** (`false-positive-promotion`, borderline)  
   `eval(req.body.payload)` behind `if (false)` was promoted to Verified. Source corroboration sees the tokens; the funnel does not require proving the branch is reachable.  
   **Category:** classifier logic / reachability — **highest-value V4 finding.**

### Label-only correction (not verifier)

- First nosql miss was **label wording** (`attackPath` omitted `this.active` sink). Corrected in `labels.v4.json` only → nosql now Verified. Same discipline as V2.

## What this means for release

V3 remains a strong **in-sample** control. V4 shows the 10/10 **does not fully generalize**:

- New sink vocabulary (`vm.runInNewContext`) → miss  
- Unreachable `eval` → unsupported Verified  

**Release decision: NOT YET.** Iterate on evidence/reachability only after an explicit product decision — keep `d4a11503b` immutable.

## Credible claim (scoped)

> On a five-case out-of-sample positive set and eight adversarial hard negatives, SimpleBeacon verified 4/5 positives, rejected 7/8 hard negatives, recorded one unsupported Verified (dead-branch eval), and preserved a passing V3 control — with an unchanged verifier.

## Run

```bash
cd packages/simplebeacon-cli
npm run benchmark:funnel:v4 -- --allow-fail
```
