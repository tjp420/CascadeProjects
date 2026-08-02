# Track 30: Quantum-Resistant Identity Ratchets — Test Plan

## Objective

Build a post-quantum identity ratcheting system that rotates device session keys using ML-KEM/Kyber hybrid KEM and enforces multi-factor cryptographic binding before any key migration.

## Scope

### Core primitives

- `PqcIdentityRatchet` — advances a multi-device identity root via ML-KEM/Kyber-style shared-secret ratcheting.
- `MfaBindingGuard` — validates a multi-signature MFA token before allowing device key migration.
- `IdentityTelemetry` — emits `IDENTITY_RATCHET_STEPPED` and `MFA_TOKEN_AUTHENTICATED` events into the Track 29 accumulator pipeline.

### Policy schema additions

- `identity`:
  - `maxSkipped`, `sessionExpiryMs`
  - `pqcKemLevel`, `allowedPqcKemLevels`
  - `requireMfaBinding`, `mfaTokenExpiryMs`, `minMfaSignatures`
  - `requirePqcHybridRatchet`, `allowedRatchetSchemes`

## Test checklist

### Positive paths

- [ ] `PqcIdentityRatchet` derives a new chain key from a KEM secret and a previous chain key.
- [ ] Ratchet advances `skipped` counter and emits `IDENTITY_RATCHET_STEPPED`.
- [ ] `MfaBindingGuard` accepts a valid multi-signature MFA token.
- [ ] `CryptoPolicyEngine` validates a compliant `identity` configuration.
- [ ] Telemetry blocks are accepted by the Track 29 `ZkRollupAccumulator`.

### Security / edge cases

- [ ] Reject KEM levels not in `allowedPqcKemLevels`.
- [ ] Reject ratchet without `requireMfaBinding` when policy demands it.
- [ ] Reject expired MFA token.
- [ ] Reject fewer than `minMfaSignatures` signatures.
- [ ] Reject unauthorized `allowedRatchetSchemes`.
- [ ] Fail closed when `skipped` exceeds `maxSkipped`.

### Integration

- [ ] `base-adapter.cjs` emits identity telemetry hooks.
- [ ] `CryptoPolicyEngine` validates `identity` operations.

## Level mapping

- **L1 Deterministic**: `node -c` on new `.cjs` files, `npx jest identity-ratchet`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Multi-device ratchet step with 2-of-3 MFA binding.
- **L3 Reflection**: Spec alignment with Track 30, no ghost modules, minimal file count.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-identity-ratchet.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/mfa-binding-guard.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`

## Approval

Pending Validator review.
