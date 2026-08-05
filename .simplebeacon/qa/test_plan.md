# Test Plan: Track 113 — Hybrid KEM + Ed25519 Identity Ratchet Bootstrap

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Hybrid ML-KEM-768 + X25519/Ed25519 identity ratchet bootstrap with fail-closed PQC policy. |
| Author (Builder) | Devin |
| Date | 2026-08-05 |
| Branch | feat/track113-pqc-ratchet-migration |
| Packages touched | ai-platform/server/lib/hsm-adapter, ai-platform/server/lib/crypto/ratchet |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/pqc-identity-ratchet.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/identity-ratchet.test.cjs`
- `ai-platform/server/lib/crypto/ratchet/identity-ratchet.cjs` (new)
- `ai-platform/server/lib/crypto/ratchet/hybrid-bootstrap.cjs` (new)

### Out of scope

- UI/IDE surfaces
- New npm dependencies (uses existing `mlkem` and Node `crypto`)

---

## Level 1 — Deterministic

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed/new CJS | `node -c` on each changed file | [ ] |
| L1-02 | Identity ratchet tests | `npx jest identity-ratchet` | [ ] |
| L1-03 | No secrets in diff | manual review | [ ] |

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Keypair generation | Call `HybridIdentityRatchet.generate()` | Returns versioned hybrid public key with both X25519/Ed25519 and ML-KEM-768 components | [ ] |
| L2-02 | Encapsulate/decapsulate | `encapsulate(hybridPublicKey)` then `decapsulate(...)` using `secretKey` | Shared secrets match | [ ] |
| L2-03 | Sign/verify handshake | Sign handshake transcript with Ed25519 and verify with public key | Verification passes; wrong key fails | [ ] |
| L2-04 | ML-KEM failure fail-closed | Force `mlkem.keygen()` to throw | Bootstrap throws `PQC_BOOTSTRAP_FAILED` and emits SIEM CRITICAL | [ ] |
| L2-05 | Serialization roundtrip | `serializeHybridPublicKey` / `deserializeHybridPublicKey` | Output equals input; version and offsets preserved | [ ] |

## Level 3 — Edge cases & reflection

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Unknown version byte | Deserialize with version `0xFF` | Throws `UNSUPPORTED_HYBRID_KEY_VERSION` | [ ] |
| L3-02 | Truncated key buffer | Deserialize truncated buffer | Throws `INVALID_HYBRID_KEY_LAYOUT` | [ ] |
| L3-03 | Mixed security domains | Ed25519 signature from different identity | Reject with `SIGNATURE_INVALID` | [ ] |

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw private keys logged or serialized in plaintext | [ ] |
| S-02 | PQC failure fails closed (no classical-only fallback) | [ ] |
| S-03 | Shared secrets derived with HKDF-SHA384 over both KEM outputs | [ ] |

## Approval

- [ ] User approved this plan
- Approved by: __________  Date: __________
