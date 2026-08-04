# Test Plan: Track 113 PQC Handshake Endpoint Integration

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Active post-quantum handshake endpoints wired to encrypted session store |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track113-endpoint-integration-track30` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/routes/hsm-vault-routes.cjs` *(append endpoints)*
- `ai-platform/server/lib/crypto/ratchet/session-store.cjs` *(extend persistence)*
- `ai-platform/server/lib/hsm-adapter/__tests__/track113-endpoint-integration.test.cjs` *(new)*

### APIs / routes

- `POST /api/vault/handshake/init` — initialize encrypted handshake session
- `POST /api/vault/handshake/verify` — verify client proof and authenticate
- `GET /api/vault/handshake/:sessionId/telemetry` — emit audit metrics without raw digests

### UI / IDE surfaces

None.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on route file | `node -c ai-platform/server/routes/hsm-vault-routes.cjs` | [ ] |
| L1-02 | Syntax on session store | `node -c ai-platform/server/lib/crypto/ratchet/session-store.cjs` | [ ] |
| L1-03 | Syntax on test file | `node -c ai-platform/server/lib/hsm-adapter/__tests__/track113-endpoint-integration.test.cjs` | [ ] |
| L1-04 | Track 113 tests | `cd ai-platform && npx jest track113-endpoint-integration --coverage=false` | [ ] |
| L1-05 | Parallel orchestrator | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-06 | Full SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Initialize handshake | POST `/api/vault/handshake/init` | `201 { sessionId, status: INITIALIZED, expiresAt }` | [ ] |
| L2-02 | Raw session file is encrypted | Read `.data/ratchet-sessions/...` JSON | No plaintext `handshakeDigest` | [ ] |
| L2-03 | Verify valid session | POST `/api/vault/handshake/verify` | `200 { status: VERIFIED, authenticatedAt }` | [ ] |
| L2-04 | Verify missing session | POST verify with dead sessionId | `404 HANDSHAKE_SESSION_NOT_FOUND` | [ ] |
| L2-05 | Verify wrong proof | POST verify with bad clientProof | `400 HANDSHAKE_INVALID_PROOF` | [ ] |
| L2-06 | Telemetry hides raw digests | GET `/api/vault/handshake/:sessionId/telemetry` | No `handshakeDigest` in body | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Out-of-order verify before init | `404` or `400` before disk touch | [ ] |
| L3-02 | No new dependencies | Native modules only | [ ] |
| L3-03 | No regression on existing vault routes | `/api/vault/status` still passes | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Raw session keys never leave endpoints | [ ] |

---

## Approval

- [x] User approved this plan (or task included approved scope)
- Approved by: user  Date: 2026-08-03
