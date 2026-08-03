# Track 74: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Intellectual Property Patent Verification and Licensing Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized intellectual property patent verification and licensing gating layer that scales cross-chain. Track 74 enforces non-repudiable patent claim validation boundaries across shared networks while completely preventing inventor profiling and patent harvesting loops. Combines lattice-based blind signatures with homomorphically split Pedersen commitments over patent claims, licensing metrics, and inventor identity hashes. This architecture enables sovereign patent offices and licensing authorities to verify hidden patent claims (priority dates, claim scope thresholds, inventor attribution) via non-interactive zero-knowledge range proofs without exposing raw patent filings, inventor PII, or cross-organization licensing tracking indices.

## Scope

### Core primitives

- **PqcPatentVerificationGatingHub** — interlocking patent verification coordinator that instantiates multi-party licensing verification pools using homomorphically split Pedersen commitments over patent claims, licensing metrics, and inventor identity hashes.
- **ZkPatentClaimValidator** — succinct patent verifier that processes non-interactive zero-knowledge range and priority proofs, ensuring that an entity's hidden patent claim status strictly satisfies policy-defined thresholds without disclosing individual patent attributes.
- **Patent Gating Lifecycle Telemetry** — emits `PATENT_GATING_POOL_INITIALIZED`, `ZK_PATENT_CLAIM_VERIFIED`, and `PATENT_LICENSE_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical patent gating pool initialization payload wire layout

```
PATENTGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedPatentClaimCommitment>:<blindedLicensingMetricCommitment>:<blindedInventorHashCommitment>:<patentExpirationSeconds>:<claimScopeDepth>:<pqcSignatureScheme>:<patentOfficeInitializerAttestationHash>:<committeeSignature>
```

### Canonical patent claim verification payload wire layout

```
PATENTCLAIM:<claimId>:<poolId>:<blindedLicensingMetricCommitment>:<blindedClaimValueCommitment>:<zkPatentRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical patent license accreditation completion payload wire layout

```
PATENTCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqPatentGating`:
  - `minLicensingQuorum`: 3
  - `maxPatentExpirationSeconds`: 47304000
  - `maxClaimScopeDepth`: 32
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requirePatentOfficeInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderPatentClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized patent gating criteria—including minimum licensing quorums, maximum patent expiration lifetime bounds, allowed claim scope depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqPatentGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the patent-office-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcPatentVerificationGatingHub` instantiates multi-party licensing verification pools using homomorphically split Pedersen commitments over patent claims, licensing metrics, and inventor identity hashes, preventing inventor profiling and patent harvesting loops.
- The `ZkPatentClaimValidator` processes non-interactive zero-knowledge range and priority proofs, ensuring that an entity's hidden patent claim status strictly satisfies policy-defined thresholds without disclosing individual patent attributes.
- Peers broadcasting malformed or out-of-order patent claims are automatically banned when `banMalformedOrOutOfOrderPatentClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcPatentVerificationGatingHub` initializes a patent gating pool and emits `PATENT_GATING_POOL_INITIALIZED`.
- [ ] `ZkPatentClaimValidator` verifies a patent claim and emits `ZK_PATENT_CLAIM_VERIFIED`.
- [ ] `PqcPatentVerificationGatingHub` completes patent license accreditation after quorum and emits `PATENT_LICENSE_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqPatentGating` configuration.

### Security / edge cases

- [ ] Reject licensing quorum below `minLicensingQuorum`.
- [ ] Reject patent expiration seconds exceeding `maxPatentExpirationSeconds`.
- [ ] Reject claim scope depth exceeding `maxClaimScopeDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested patent office initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject patent claims exceeding the patent expiration window.
- [ ] Reject malformed patent claims (missing zkPatentRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject patent license accreditation completion before patent claim verification.
- [ ] Reject patent license accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order patent claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqPatentGating` for `operation === 'pqPatentGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-patent-verification-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-patent-verification-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer licensing quorum with attested patent office initializer and clearing committee relay, verify patent claim authentication and patent license accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-patent-verification-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-patent-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-patent-verification-gating.test.cjs` *(new)*

## Extension scope (Track 74 Phase 2)

### New capabilities added

- **Claim scope depth rebalancing** — rebalance claim scope depth with increase/decrease directions, epoch tracking, and optional new claim scope depth updates.
- **Batch pool initialization** — initialize multiple patent verification gating pools in a single batch call with per-pool results.
- **Committee signature aggregation** — BLS-style aggregate signature from partial committee signatures.
- **Pool cancellation** — cancel open pools (rejects if accredited/settled).
- **Cross-chain settlement coordination** — settle accredited pools on the target chain with settlement proof hashes.
- **Hardware-accelerated SNARK proof generation** — generate Groth16 SNARK proofs with configurable HW acceleration (GPU CUDA, FPGA, ASIC, simulated).
- **Batch patent claim verification** — verify multiple patent claims in a single batch call with per-claim results.
- **Partial signature aggregation** — aggregate partial signatures from clearing committee members with banned-peer rejection.
- **Slashing window validation** — validate claim timestamps within configurable slashing window.
- **Slashing event recording** — record slash events with reason codes (malformed_claim, duplicate_claim, patent_expiration_out_of_bounds, pool_not_found, banned_peer, out_of_window).
- **Summary statistics** — both hub and validator expose `getStats()` methods.

### Extension test checklist

#### Positive paths

- [x] Claim scope depth rebalance with increase direction.
- [x] Claim scope depth rebalance with decrease direction.
- [x] Claim scope depth updates on rebalance.
- [x] Batch initialization creates multiple pools.
- [x] Cross-chain settlement works for accredited pools.
- [x] Committee signatures can be aggregated.
- [x] Pools can be cancelled.
- [x] HW-SNARK proof generation produces Groth16 proofs.
- [x] Batch patent claim verification processes multiple proofs.
- [x] Partial signatures can be aggregated.
- [x] Slashing window validation works for in-window claims.
- [x] Full init → rebalance → claim → accredit → settle flow works end-to-end.

#### Security / edge cases

- [x] Reject rebalance with invalid direction.
- [x] Reject rebalance with non-positive amount.
- [x] Reject rebalance with missing poolId.
- [x] Reject rebalance on accredited pool.
- [x] Reject batch init with empty array.
- [x] Reject batch init exceeding max size.
- [x] Reject settlement of non-accredited pool.
- [x] Reject settlement with mismatched chain.
- [x] Reject settlement with missing poolId.
- [x] Reject settlement with missing targetChainId.
- [x] Reject committee aggregation with insufficient signatures.
- [x] Reject committee aggregation with no signatures.
- [x] Reject committee aggregation for unknown pool.
- [x] Reject cancelling accredited pool.
- [x] Reject double cancellation.
- [x] Reject cancelling unknown pool.
- [x] Reject HW-SNARK proof generation with missing poolId.
- [x] Reject HW-SNARK proof generation with missing values.
- [x] Reject HW-SNARK proof generation for unknown pool.
- [x] Reject empty batch patent claim verification.
- [x] Reject batch patent claim verification exceeding max size.
- [x] Reject partial signature aggregation with banned peer.
- [x] Reject partial signature aggregation with insufficient signatures.
- [x] Reject partial signature aggregation with missing poolId.
- [x] Detect claim outside slashing window.
- [x] Reject slashing window validation for unknown pool.
- [x] Reject slashing window validation with invalid timestamp.
- [x] Reject slashing window validation with missing poolId.
- [x] Record slashes for malformed claims.
- [x] Record slashes for out-of-bounds patent expiration.
- [x] Record slashes for duplicate claims.
- [x] CLAIM_STATUS, SLASH_REASON, HW_ACCEL_TYPES, POOL_STATUS, REBALANCE_DIRECTION constants exported.

## Files changed (Phase 2 extension)

- `ai-platform/server/lib/hsm-adapter/pqc-patent-verification-gating-hub.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/zk-patent-claim-validator.cjs` *(extended)*
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` *(14 new counters)*
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-patent-verification-gating-extensions.test.cjs` *(new, 54 tests)*

## Approval

Phase 1: Approved and merged (15 tests).
Phase 2: Pending Validator review.
