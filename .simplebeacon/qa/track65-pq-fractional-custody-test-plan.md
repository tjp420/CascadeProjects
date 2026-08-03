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

## Extension scope (Track 65 Phase 2)

### New capabilities added

- **Cross-chain liquidity bridge support** — vaults can carry bridge parameters (source/target chain IDs, bridge type, capacity, fee BPS) with validation.
- **Escrow locking** — lock vault assets in escrow with three lock types: time-lock, hash-lock, quorum-lock. Escrowed vaults still accept fractional releases.
- **Batch vault initialization** — initialize multiple vaults in a single batch call with per-vault results.
- **Custodian committee signature aggregation** — BLS-style aggregate signature from partial custodian signatures.
- **Vault cancellation** — cancel open vaults (rejects if liquidated/settled).
- **Cross-chain settlement coordination** — settle liquidated vaults on the target chain with settlement proof hashes.
- **Hardware-accelerated SNARK proof generation** — generate Groth16 SNARK proofs with configurable HW acceleration (GPU CUDA, FPGA, ASIC, simulated).
- **Batch release verification** — verify multiple fractional release signatures in a single batch call with per-release results.
- **Partial signature aggregation** — aggregate partial signatures from custodian committee members with banned-peer rejection.
- **Slashing window validation** — validate release timestamps within configurable slashing window.
- **Slashing event recording** — record slash events with reason codes (malformed, duplicate, vault not open, banned peer, out of order).
- **Summary statistics** — both hub and verifier expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Vault initialization with liquidity bridge parameters.
- [x] Escrow locking with time-lock, hash-lock, and quorum-lock types.
- [x] Escrow release restores vault to open status.
- [x] Release recording on escrowed vaults.
- [x] Batch initialization creates multiple vaults.
- [x] Cross-chain settlement works for liquidated vaults.
- [x] Committee signatures can be aggregated.
- [x] Vaults can be cancelled.
- [x] HW-SNARK proof generation produces Groth16 proofs.
- [x] Batch release verification processes multiple releases.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window releases.
- [x] Full init → escrow → release → liquidate → settle flow works end-to-end.

#### Security / edge cases

- [x] Reject liquidity bridge with missing chain IDs.
- [x] Reject invalid liquidity bridge object.
- [x] Reject escrow on non-open vault.
- [x] Reject escrow with invalid lock type.
- [x] Reject escrow with missing vaultId.
- [x] Reject release of unknown escrow.
- [x] Reject batch init with empty array.
- [x] Reject batch init exceeding max size.
- [x] Reject settlement of non-liquidated vault.
- [x] Reject settlement with mismatched chain.
- [x] Reject settlement with missing vaultId.
- [x] Reject committee aggregation with insufficient signatures.
- [x] Reject committee aggregation with no signatures.
- [x] Reject committee aggregation for unknown vault.
- [x] Reject cancelling liquidated vault.
- [x] Reject double cancellation.
- [x] Reject cancelling unknown vault.
- [x] Reject HW-SNARK proof generation with missing vaultId.
- [x] Reject HW-SNARK proof generation with missing fractionValue.
- [x] Reject HW-SNARK proof generation for unknown vault.
- [x] Reject empty batch release verification.
- [x] Reject batch release verification exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with insufficient signatures.
- [x] Reject partial signature aggregation with missing vaultId.
- [x] Detect release outside slashing window.
- [x] Reject slashing window validation for unknown vault.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Record slashes for malformed releases.
- [x] RELEASE_STATUS, SLASH_REASON, HW_ACCEL_TYPES, VAULT_STATUS, ESCROW_LOCK_TYPES constants exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-fractional-custody-hub.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/zk-fractional-release-verifier.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(16 new counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-fractional-custody-extensions.test.cjs` *(new, 53 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
