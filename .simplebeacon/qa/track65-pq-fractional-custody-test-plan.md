# Track 65: Post-Quantum Zero-Knowledge Cross-Chain Fractional Asset Custody Engine Hubs — Test Plan

## Objective

Establish a privacy-preserving fractional vault layer that scales cross-chain. Track 65 ensures non-repudiable fractional custody controls while defending against co-custodian collusion and metadata tracking. Builds directly on the Track 50 settlement engines and the Track 63 blind option pools, allowing corporate assets to be sliced into blinded fractions and held under joint custody across independent networks, requiring a strict multi-signature quorum of hardware-attested guardians to transfer any fraction without leaking the global wallet balances or corporate identities.

## Scope

### Core primitives

- **PqcFractionalCustodyHub** — interlocking fractional asset supervisor that instantiates multi-tenant vaults using homomorphically split Pedersen commitments over distinct ownership shards and asset denominations.
- **ZkFractionalReleaseVerifier** — threshold signature validator that processes zero-knowledge partition proofs, ensuring that the aggregate of released fractions perfectly reconciles against the master vault balance without revealing hidden line items.
- **Custody Lifecycle Telemetry** — emits `FRACTIONAL_VAULT_INITIALIZED`, `FRACTIONAL_RELEASE_SIGNED`, and `CUSTODY_VAULT_LIQUIDATED` into the Track 29 ZK-rollup accumulator.

### Canonical fractional vault initialization payload wire layout

```
FRACVAULT:<vaultId>:<sourceTenantId>:<targetChainId>:<blindedBalanceCommitment>:<assetDenomination>:<assetCustodyCap>:<fractionalBits>:<pqcSignatureScheme>:<claimantAttestationHash>:<custodianSignatures>
```

### Canonical fractional release signature payload wire layout

```
FRACRELEASE:<releaseId>:<vaultId>:<blindedFractionCommitment>:<zkPartitionProofHash>:<custodianRelayAttestationHash>:<partialSignature>
```

### Canonical vault liquidation payload wire layout

```
VAULTLIQ:<liquidationId>:<vaultId>:<releasedFractionSum>:<pqcSignatureScheme>:<custodianSignatures>
```

### Policy schema additions

- `pqFractionalCustody`:
  - `minCustodianQuorum`: 3
  - `maxFractionalBits`: 64
  - `maxAssetCustodyCap`: 1000000000
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireClaimantAttestation`: true
  - `requireCustodianRelayAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderCustodyClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All fractional custody criteria—including minimum custodian quorums, maximum fractional denominator bit-widths, allowed asset custody caps, and signature curve parameters—are managed dynamically via the dedicated `pqFractionalCustody` stanza in the active `CryptoPolicyEngine` schema.
- Both the requesting claimant and the processing custodian relays must pass `EnclaveAttestationClient.verify()` before a vault state transition can be signed (Track 41 integration).
- The `PqcFractionalCustodyHub` instantiates multi-tenant vaults using homomorphically split Pedersen commitments over distinct ownership shards and asset denominations, preventing co-custodian collusion and metadata tracking.
- The `ZkFractionalReleaseVerifier` processes zero-knowledge partition proofs, ensuring that the aggregate of released fractions perfectly reconciles against the master vault balance without revealing hidden line items.
- Peers broadcasting malformed or out-of-order custody claims are automatically banned when `banMalformedOrOutOfOrderCustodyClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcFractionalCustodyHub` initializes a vault and emits `FRACTIONAL_VAULT_INITIALIZED`.
- [ ] `ZkFractionalReleaseVerifier` records a valid fractional release signature and emits `FRACTIONAL_RELEASE_SIGNED`.
- [ ] `PqcFractionalCustodyHub` liquidates a vault after all fractions reconcile and emits `CUSTODY_VAULT_LIQUIDATED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqFractionalCustody` configuration.

### Security / edge cases

- [ ] Reject custodian quorum below `minCustodianQuorum`.
- [ ] Reject fractional bits exceeding `maxFractionalBits`.
- [ ] Reject asset custody cap exceeding `maxAssetCustodyCap`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested claimant.
- [ ] Reject un-attested custodian relay.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject liquidation before all fractions reconcile.
- [ ] Reject duplicate vault initializations.
- [ ] Reject duplicate fractional release signatures from the same peer.
- [ ] Reject release signatures on non-existent vaults.
- [ ] Reject release signatures on liquidated vaults.
- [ ] Automatically ban peers broadcasting malformed or out-of-order custody claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqFractionalCustody` for `operation === 'pqFractionalCustody'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-fractional-custody` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-fractional-custody`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-custodian quorum with attested claimant and custodian relay, verify fractional release signature authentication and vault liquidation after reconciliation.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-fractional-custody-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-fractional-release-verifier.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-fractional-custody.test.cjs` *(new)*

## Approval

Pending Validator review.
