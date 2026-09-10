# Verification Funnel V5 — Candidate Release Validation

**Branch:** `benchmark/v5-reachability`  
**Status:** HARD GATE **PASS** locally — **not committed / not pushed / not deployed** unless authorized.  
**Frozen controls:** V3 `d4a11503b` · V4 diagnostic `91dae7200` — **untouched as history**.

## Verifier changes (narrow)

1. **Slice 6 reachability** — sinks only inside `if(false)` / `while(false|0)` / `if(0)` do not corroborate Verified.  
2. **RCE sink vocabulary** — `vm.runInNewContext` / `vm.runInThisContext` / `vm.Script`; narrowed `child_process.*` so import lines are not sinks.

## Hard gate

| Check | Result |
|-------|--------|
| OOS verified | **5/5** |
| OOS hard negatives rejected | **5/5** |
| Unsupported Verified | **0** |
| Verified precision | **100%** |
| V3 regression | **PASS** (10/10, 8/8) |
| V4 regression | **PASS** (5/5, 8/8) — prior diagnostic failures now closed |
| Hard gate | **PASS** |

## Principle enforced

> Evidence that exists syntactically is not necessarily evidence that is reachable.

## Credible claim (scoped)

> After Slice 6 reachability and vm SSJS vocabulary fixes, SimpleBeacon passed a fresh five-case V5 OOS set with five reachability-focused hard negatives, zero unsupported Verified, and no regression on frozen V3/V4 controls.

## Run

```bash
cd packages/simplebeacon-cli
npm run benchmark:funnel:v5
```

**Release decision:** still requires explicit authorization (push → deploy → publish).
