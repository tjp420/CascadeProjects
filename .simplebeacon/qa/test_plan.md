# Test Plan: Centralized Audit Log Zeroization

> Memory scrubbing layer for sensitive cryptographic and identity data

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Synchronous buffer zeroization for poRep-verifier and token-service sensitive data |
| Author (Builder) | Devin |
| Date | 2026-08-05 |
| Branch | feat/zeroization-layer |
| Packages touched | ai-platform/server/lib/hsm-adapter/track112, ai-platform/server/lib/auth, ai-platform/server/lib |

## Scope

### Files in scope

1. `ai-platform/server/lib/zeroize.cjs` (new — shared zeroization utility)
2. `ai-platform/server/lib/hsm-adapter/track112/poRep-verifier.cjs` (modified — zeroize leaf buffers after verification)
3. `ai-platform/server/lib/auth/token-service.cjs` (modified — zeroize token buffers after verification)
4. `ai-platform/server/lib/token-service.cjs` (modified — zeroize refresh token buffers after hashing)
5. `ai-platform/server/lib/__tests__/zeroize.test.cjs` (new — unit tests for zeroization utility)
6. `ai-platform/server/lib/hsm-adapter/__tests__/track112/poRep-verifier.test.cjs` (modified — zeroization verification tests)

### APIs / routes

No route changes. Internal utility module only.

### UI / IDE surfaces

- [ ] Sidebar webview (N/A)
- [ ] Main dashboard iframe (N/A)
- [ ] Welcome / main window panel (N/A)
- [ ] Simple Browser / external browser (N/A)

---

## Level 1 — Deterministic

| ID | Check | Command | Pass |
|----|-------|---------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c <file>` | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-03 | Zeroize unit tests | `npx jest server/lib/__tests__/zeroize.test.cjs` | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-06 | No new dependencies | Verify package.json unchanged | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | zeroizeBuffer fills with zeros | Create buffer with secret data, call zeroizeBuffer | Buffer contents all 0x00 | [ ] |
| L2-02 | zeroizeBuffer is idempotent | Call zeroizeBuffer twice on same buffer | No throw, buffer still all 0x00 | [ ] |
| L2-03 | zeroizeBuffer handles null/undefined | Call with null, undefined, empty buffer | No throw, returns silently | [ ] |
| L2-04 | poRep-verifier zeroizes leaf buffers after verification | Run verify() with valid proof, inspect leafBuf after | Leaf buffer contents zeroized | [ ] |
| L2-05 | poRep-verifier zeroizes on error path | Run verify() with invalid proof, inspect buffers | Buffers zeroized even on failure | [ ] |
| L2-06 | token-service zeroizes token string after verify | Call verifyToken(), inspect token buffer | Token buffer zeroized after verification | [ ] |
| L2-07 | token-service zeroizes on exception | Call verifyToken() with invalid token | Buffer zeroized even on throw | [ ] |
| L2-08 | token-service.cjs zeroizes refresh token after hashing | Call hashToken(), inspect input buffer | Input buffer zeroized | [ ] |

---

## Level 3 — Self-review / drift

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | try/finally guards all zeroization | Every sensitive buffer operation wrapped in try/finally | Zeroization runs even on exception | [ ] |
| L3-02 | No performance regression | Zeroization adds < 0.01ms per buffer | Benchmark within SLA | [ ] |
| L3-03 | No production module instrumentation | Zeroize utility is standalone, no monkey-patching | Clean import pattern | [ ] |
| L3-04 | Existing test suites unaffected | Run track112 + auth test suites | All existing tests pass | [ ] |

---

## Security checklist

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in zeroization code | [ ] |
| S-02 | Zeroization is synchronous (no async gap before scrub) | [ ] |
| S-03 | Zeroization runs in finally block (exception-safe) | [ ] |
| S-04 | Zeroize utility does not log buffer contents | [ ] |

---

## Zeroization Architecture

### Utility: `zeroize.cjs`

```
zeroizeBuffer(buf)   — fills buffer with 0x00, handles null/undefined/empty
zeroizeString(str)   — converts string to Buffer, fills with 0x00, returns null
withZeroizedBuffer(encoded, fn)  — allocates buffer, runs fn, zeroizes in finally
```

### Target Sites

1. **poRep-verifier.cjs `verify()`** — leaf buffers (`leafBuf`, `leafHash`, `cur` in `computeRootFromPath`) zeroized after verification loop
2. **auth/token-service.cjs `verifyToken()`** — token string converted to buffer, zeroized after `jwt.verify()` in finally block
3. **token-service.cjs `hashToken()`** — token buffer zeroized after SHA-256 hash computation

### Isolation Controls

- Zeroization is synchronous — no async gap between use and scrub
- All zeroization wrapped in try/finally to ensure execution on error paths
- Utility handles edge cases (null, undefined, empty, non-Buffer) without throwing
- No logging of buffer contents in zeroization code

---

## Approval

- [ ] User approved this plan
- Approved by: ___________  Date: ___________
