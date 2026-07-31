# Test Plan — Zero-Downtime Master Key Rotation Daemon

**Date:** 2026-01-30
**Branch:** feat/agentic-orchestration
**Feature:** Key rotation store with grace-window fallback and re-keying migration

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 1 | `key-rotation-store.cjs` loads without error | L1 | `key-rotation-store.cjs` |
| 2 | `getActiveKeyBuffer()` returns a 32-byte Buffer | L1 | `key-rotation-store.cjs` |
| 3 | `getDecryptionKeys()` returns array of `{ keyHex }` objects | L1 | `key-rotation-store.cjs` |
| 4 | `rotateKey(newKey)` transitions active→previous, sets rotatedAt | L2 | `key-rotation-store.cjs` |
| 5 | After rotation, `getDecryptionKeys()` includes the previous key | L2 | `key-rotation-store.cjs` |
| 6 | Grace window: previous key remains in decryption set within window | L2 | `key-rotation-store.cjs` |
| 7 | Grace window expiry: previous key removed from decryption set | L2 | `key-rotation-store.cjs` |
| 8 | `decrypt()` falls back to previous key after rotation (continuous decryption) | L2 | `crypto-utils.cjs` integration |
| 9 | `refreshActiveKey()` updates ENCRYPTION_KEY from rotation store | L2 | `crypto-utils.cjs` integration |
| 10 | Re-keying migration: re-encrypts data from old key to new key | L2 | `key-rotation-store.cjs` |

### Edge Cases

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 11 | `rotateKey()` rejects empty/null key with TypeError | L1 | `key-rotation-store.cjs` |
| 12 | `rotateKey()` rejects short keys (<32 chars) | L1 | `key-rotation-store.cjs` |
| 13 | Multiple rotations: only active + previous kept (not N-1) | L2 | `key-rotation-store.cjs` |
| 14 | `getRotationStatus()` returns correct metadata | L2 | `key-rotation-store.cjs` |
| 15 | Re-keying migration skips already-migrated data | L2 | `key-rotation-store.cjs` |

### Security

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 16 | Rotated key material not logged or exposed in plaintext | L2 | `key-rotation-store.cjs` |
| 17 | `verifyChain()` still passes after key rotation | L2 | `audit-logger.cjs` integration |
| 18 | Encrypted quarantine files remain readable after rotation | L2 | `audit-logger.cjs` integration |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/server/lib/key-rotation-store.cjs` | NEW — rotation store + daemon |
| `ai-platform/server/lib/__tests__/key-rotation-store.test.cjs` | NEW — test suite |
| `.github/workflows/security-regression-tests.yml` | UPDATE — path filters + test regex |

## Commands

```powershell
node -c ai-platform/server/lib/key-rotation-store.cjs
cd ai-platform && npx jest --config jest.config.cjs --testPathPatterns="key-rotation"
npx simplebeacon scan --full --gate --format json
```
