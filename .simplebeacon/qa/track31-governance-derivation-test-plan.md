# Track 31: Cryptographic Governance-Derived Key Hierarchy — Test Plan

## Objective

Build a multi-party governance primitive that derives child cryptographic keys from approved policy proposals. The system must enforce quorum, time-bounded proposals, post-quantum KEM blinding, and canonical multi-signature proposal verification.

## Scope

### Core primitives

- **GovernanceProposal** — encapsulates a key-derivation proposal with nonce, sponsor, and policy hash.
- **GovernanceQuorum** — validates the proposal carries at least `minAdminQuorum` valid admin signatures within `proposalExpiryMs`.
- **GovernanceDerivation** — derives child keys from an approved proposal using an allowed curve or post-quantum KEM primitive, with a blinding factor.

### Policy schema additions

- `governance`:
  - `minAdminQuorum`
  - `proposalExpiryMs`
  - `allowedDerivationCurves`
  - `allowedKemPrimitives`
  - `requirePqcBlindingFactor`
  - `maxChildDerivationDepth`

## Design decisions

### Homomorphic child derivation primitive

Use an **asymmetric post-quantum KEM primitive** for child derivation instead of ECDSA blinding. This keeps the derivation chain quantum-resistant and avoids leaking the parent key through an ECDSA blinding matrix.

### Canonical signature payload layout

Each proposal signature is computed over a canonical string in this order:

```
{proposalId}|{nonce}|{sponsor}|{policyHash}|{timestamp}|{signer}
```

The signatures are submitted as an array of `{signer, signature}` objects. The verifier recomputes the canonical hash and rejects any signature that does not verify against the allowed admin signer list.

## Test checklist

### Positive paths

- [ ] Governance proposal is accepted with `minAdminQuorum` valid signatures.
 [ ] Child key derivation succeeds for an approved, non-expired proposal.
- [ ] KEM-based blinding factor is applied when `requirePqcBlindingFactor` is true.
- [ ] Derived key metadata includes parent path, depth, and derivation scheme.
- [ ] CryptoPolicyEngine validates a compliant `governance` configuration.

### Security / edge cases

- [ ] Reject proposal with fewer than `minAdminQuorum` signatures.
- [ ] Reject expired proposal (`timestamp + proposalExpiryMs < now`).
- [ ] Reject invalid signature on the canonical payload.
- [ ] Reject disallowed derivation curve.
- [ ] Reject disallowed KEM primitive when PQC blinding is required.
- [ ] Reject derivation depth exceeding `maxChildDerivationDepth`.
- [ ] Reject unauthorized signer.

### Integration

- [ ] `crypto-policy-engine.cjs` has `_validateGovernance` for `operation === 'governance'`.
- [ ] `base-adapter.cjs` emits `GOVERNANCE_PROPOSAL_APPROVED` and `CHILD_KEY_DERIVED` telemetry.

## Level mapping

- **L1 Deterministic**: `node -c` on new `.cjs` files, `npx jest governance-derivation`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Multi-admin proposal approval + PQC child key derivation end-to-end.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/governance-proposal.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/governance-derivation.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/governance-derivation.test.cjs` *(new)*

## Approval

Pending Validator review.
