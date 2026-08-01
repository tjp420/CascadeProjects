# test_plan.md — Track 20: Post-Quantum Cryptographic Wrapping Pairs & Hybrid Transitions (ML-KEM)

> Skeleton for the Validator to review before Builder writes feature code.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 20: Post-Quantum Cryptographic Wrapping Pairs & Hybrid Transitions (ML-KEM) |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | `feature/track20-groundwork` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/pqc-hybrid-adapter.cjs` (new — hybrid KEM wrapper)
- `ai-platform/server/lib/hsm-adapter/pqc-encapsulation-engine.cjs` (new — quantum-resistant shared secret simulator)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` (PQC policy validation)
- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json` (PQC schema)
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` (optional `hybridEncapsulate` / `hybridDecapsulate` high-level hooks)
- `ai-platform/server/lib/hsm-adapter/__tests__/pqc-hybrid.test.cjs` (new)
- `ai-platform/docs/specs/track20-pqc-hybrid-test-plan.md` (this file)

### APIs / interfaces

- `PqcEncapsulationEngine(kemLevel)`
- `PqcEncapsulationEngine.generateKeypair()`
- `PqcEncapsulationEngine.encapsulate(publicKey)`
- `PqcEncapsulationEngine.decapsulate(ciphertext, secretKey)`
- `PqcHybridAdapter(tenantId, options)`
- `PqcHybridAdapter.encapsulate()`
- `PqcHybridAdapter.decapsulate(encapsulation)`
- `CryptoPolicyEngine.validate(tenantId, 'pqc', { kemLevel, hybridMode })`
- `HsmAdapterError` codes: `PQC_NOT_SUPPORTED`, `HYBRID_TRANSITION_FAILED`, `PQC_KEY_INTEGRITY`

---

## Design decisions

- **Hybrid KEM model:**
  - Classic component: ephemeral ECDH P-256 key exchange over `secp256k1` or `prime256v1`.
  - Post-quantum component: a simulation of ML-KEM using high-entropy random matrices. Because Node.js does not natively implement Kyber, the reference implementation uses a `ml-kem-sim` mode:
    - Generate a public/private keypair as deterministic noise seeds.
    - Encapsulation produces a `ciphertext` (seed + random matrix bytes) and a `sharedSecret` derived from the seed.
    - Decapsulation regenerates the shared secret from the secret key and ciphertext.
  - The combined root key is `HKDF-SHA256(concat(classicSecret, quantumSecret), salt, info, 64)`.
- **Quantum parameter levels:**
  - `kemLevel: 512` — 512-bit equivalent (smaller, faster).
  - `kemLevel: 768` — default 768-bit equivalent (recommended).
  - `kemLevel: 1024` — 1024-bit equivalent (maximum security).
  - Each level controls the number of random bytes in the simulated matrix/seed.
- **HKDF secret combining:**
  - Salt: a per-tenant rolling salt or all-zeros for ephemeral sessions.
  - Info: `SimpleBeacon:Track20:HybridKEM:<tenantId>:<kemLevel>`.
  - Output: 64 bytes split into two 32-byte root keys if needed, or used directly as a 32-byte key.
- **Canonical payload composition:**
  ```json
  {
    "version": "1.0.0",
    "tenantId": "...",
    "kemLevel": 768,
    "classic": {
      "publicKey": "base64...",
      "ciphertext": null
    },
    "pqc": {
      "publicKeyHash": "sha256...",
      "ciphertext": "base64..."
    },
    "combinedKeyHash": "sha256..."
  }
  ```
- **Policy enforcement:**
  - `CryptoPolicyEngine` gains `pqc: { minKemLevel: 512, maxKemLevel: 1024, hybridMode: true, allowedCurves: ['P-256', 'P-384', 'P-521'] }`.
  - `validate(tenantId, 'pqc', config)` checks `kemLevel` and `hybridMode`.
- **Audit events:** `PQC_KEY_ENCAPSULATED` and `HYBRID_TRANSITION_VERIFIED` are emitted through `BaseHsmAdapter._audit`.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | PQC hybrid tests pass | `cd ai-platform && npx jest --config jest.config.cjs pqc-hybrid` | [ ] |
| L1-03 | Crypto policy tests still pass | `cd ai-platform && npx jest --config jest.config.cjs crypto-policy-engine` | [ ] |
| L1-04 | Full `ai-platform` test suite passes | `cd ai-platform && npm test` | [ ] |
| L1-05 | SimpleBeacon full gate | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-06 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Hybrid encapsulation produces combined root key | `adapter.hybridEncapsulate()` | Returns payload and root key | [ ] |
| L2-02 | Decapsulation recovers the same root key | `decapsulate(payload)` | Returns the same combined root key | [ ] |
| L2-03 | Different tenants produce different root keys | `encapsulate` for `t1` vs `t2` | Root keys differ | [ ] |
| L2-04 | Invalid ciphertext fails integrity | Mutate `pqc.ciphertext` and decapsulate | Throws `PQC_KEY_INTEGRITY` | [ ] |
| L2-05 | Policy rejects unsupported KEM levels | `validate('t1', 'pqc', { kemLevel: 256 })` | Throws `POLICY_VIOLATION_BLOCKED` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Kem level 512, 768, and 1024 all produce distinct key sizes | Larger levels generate larger ciphertexts | [ ] |
| L3-02 | Missing classic component throws `HYBRID_TRANSITION_FAILED` | Throws on decapsulate | [ ] |
| L3-03 | Existing Tracks 10–19 tests still pass | No regressions | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Classic secret and quantum secret are never logged separately | [ ] |
| S-02 | Combined root key is derived with context-bound HKDF | [ ] |
| S-03 | PQC component seeds are zeroized after encapsulation/decapsulation | [ ] |
| S-04 | `pqc.publicKeyHash` can be used for integrity without exposing the public key | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
