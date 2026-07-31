# Software Health Report — HSM Vault Provider Mock

**Date:** 2026-01-30
**Branch:** feat/agentic-orchestration
**Feature:** Software-simulated HSM provider for key derivation
**Validator:** Devin (Validator mode)

---

## Level 1 — Deterministic Checks

| Check | Result | Notes |
|-------|--------|-------|
| `node -c hsm-vault.cjs` | PASS | Syntax clean |
| `node -c hsm-vault.test.cjs` | PASS | Syntax clean |
| Security regression suite (21 suites) | PASS | 485/485 tests pass |
| SimpleBeacon gate scan | PASS | 0 critical, 0 high, 0 medium; quality score 100 |
| `npm audit` | N/A | No package.json changes |

---

## Level 2 — Behavioral Verification

| Test Plan # | Check | Result | Test Name |
|-------------|-------|--------|-----------|
| 1 | `deriveOrgKeyViaHsm` returns 32-byte Buffer | PASS | "should return a 32-byte Buffer" |
| 2 | Same orgId yields deterministic key | PASS | "should be deterministic for same orgId" |
| 3 | Different orgIds yield unique keys | PASS | "should produce unique keys for different orgIds" |
| 4 | `deriveKey(orgId, context)` works with context | PASS | "should return a 32-byte Buffer" (deriveKey suite) |
| 5 | Different contexts yield different keys | PASS | "should produce unique keys for different contexts" |
| 6 | `HSM_PROVIDER=mock` routes through HSM | PASS | "should route deriveOrgKey() through HSM when HSM_PROVIDER is set" |
| 7 | HSM key differs from local fallback | PASS | "should produce a different key than local fallback when HSM is active" |
| 8 | TypeError for invalid orgId | PASS | "should throw TypeError for empty/null/non-string orgId" |
| 9 | Default context for null/undefined | PASS | "should use default context when context is null/undefined" |
| 10 | HSM module fails to load → local fallback | PASS | "should fall back to local key when HSM module fails to load" |
| 11 | HSM throws → local fallback | PASS | "should fall back to local key when HSM throws during derivation" |
| 12 | Root key not exposed via exports | PASS | "should not expose the root key via module exports" |
| 13 | HSM-derived key works for encrypt/decrypt | PASS | "should support encrypt/decrypt round-trip with HSM-derived key" |

**Test plan items: 13/13 PASS**

---

## Level 3 — Spec Drift & Edge Cases

| Item | Status | Notes |
|------|--------|-------|
| Spec: `deriveKey(orgId, context)` method | MATCH | Implemented with default context 'default' |
| Spec: `deriveOrgKeyViaHsm(orgId)` hook | MATCH | Matches existing hook in crypto-utils.cjs line 135 |
| Spec: HSM root key never leaves provider | MATCH | `_HSM_ROOT_KEY` is module-scoped, not exported |
| Spec: Fail-open on HSM unavailable | MATCH | crypto-utils.cjs try/catch falls back to local HMAC |
| Spec: Fail-open on HSM throws | MATCH | Tested via broken HSM module injection |
| Spec: `HSM_MOCK_ROOT_KEY` env var for deterministic testing | MATCH | Optional hex string seeds the root key |
| No ghost files | CONFIRMED | `hsm-vault.cjs` created at expected path |
| No new dependencies | CONFIRMED | Uses only Node.js `crypto` module |
| No spec drift | CONFIRMED | All test plan items map to tests |

---

## Defects

None found. All tests pass, gate passes, no syntax errors.

---

## Unimplemented

None. All test plan items implemented and verified.

---

## Enhancements (Debt/Perf)

1. **HSM root key rotation** — The mock generates a random root key at module load time. In production, HSM key rotation would need to be handled. The `HSM_MOCK_ROOT_KEY` env var enables deterministic testing.

2. **Directory-key HSM hook** — Currently only `deriveOrgKey()` has an HSM hook. `deriveDirectoryKey()` could also route through HSM for consistency. This is a natural follow-up.

3. **Asymmetric key support** — The mock only supports symmetric HMAC-SHA256. RSA/ECDSA operations could be added for signature verification use cases.

---

## Future Roadmap

1. **HSM hook for `deriveDirectoryKey()`** — Add `HSM_PROVIDER` check to the directory key derivation function for consistent HSM routing across all key types.

2. **Cloud HSM integration** — Replace the mock with AWS KMS, Google Cloud KMS, or Azure Key Vault provider implementations behind the same interface.

3. **Key rotation** — Add support for rotating the HSM root key with backward-compatible decryption of keys derived from previous root keys.

4. **HSM health metrics** — Expose HSM derivation count, latency, and fallback rate via the Prometheus metrics endpoint.

---

## Validator Sign-off

- [x] All Level 1 checks pass (syntax, 485 tests, gate)
- [x] All Level 2 behavioral tests pass (13/13 test plan items)
- [x] No spec drift (all spec items match implementation)
- [x] No ghost files or hallucinated API paths
- [x] Fail-open behavior verified (module missing + module throws)
- [x] HSM root key isolation verified (not exported)
- [x] CI workflow updated (path filters + test regex)

**Verdict:** READY FOR COMMIT
