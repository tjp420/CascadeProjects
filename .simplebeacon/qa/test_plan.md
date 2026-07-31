# Test Plan — HSM Vault Provider Mock Implementation

**Date:** 2026-01-30
**Branch:** feat/agentic-orchestration
**Feature:** Software-simulated HSM provider for key derivation

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 1 | `deriveOrgKeyViaHsm(orgId)` returns a 32-byte Buffer | L1 | `hsm-vault.cjs` |
| 2 | Same orgId yields deterministic key across calls | L2 | `hsm-vault.cjs` |
| 3 | Different orgIds yield unique keys (no cross-tenant collision) | L2 | `hsm-vault.cjs` |
| 4 | `deriveKey(orgId, context)` generic method works with context string | L1 | `hsm-vault.cjs` |
| 5 | Different contexts yield different keys for same orgId | L2 | `hsm-vault.cjs` |
| 6 | `HSM_PROVIDER=mock` routes `deriveOrgKey()` through HSM module | L1 | `crypto-utils.cjs` integration |
| 7 | HSM-derived key differs from local fallback key (different root seed) | L2 | `crypto-utils.cjs` integration |

### Edge Cases

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 8 | Throws TypeError for empty/null/non-string orgId | L1 | `hsm-vault.cjs` |
| 9 | Default context used when context is null/undefined | L2 | `hsm-vault.cjs` |
| 10 | HSM unavailable (require fails) → crypto-utils falls back to local key | L1 | `crypto-utils.cjs` |
| 11 | HSM throws → crypto-utils catches and falls back to local key | L2 | `crypto-utils.cjs` |

### Security

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 12 | HSM root key is not exposed via module exports | L2 | `hsm-vault.cjs` |
| 13 | HSM-derived keys can be used for encrypt/decrypt round-trip | L2 | `crypto-utils.cjs` integration |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/server/lib/hsm-vault.cjs` | NEW — HSM mock provider |
| `ai-platform/server/lib/__tests__/hsm-vault.test.cjs` | NEW — test suite |
| `.github/workflows/security-regression-tests.yml` | UPDATE — path filters + test regex |

## Commands

```powershell
node -c ai-platform/server/lib/hsm-vault.cjs
cd ai-platform && npx jest --config jest.config.cjs --testPathPatterns="hsm-vault"
npx simplebeacon scan --full --gate --format json
```
