# Track 75: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Renewable Energy Grid Certificate Verification and Trading Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized renewable energy grid certificate verification and trading gating layer that scales cross-chain. Track 75 enforces non-repudiable energy production claim validation boundaries across shared networks while completely preventing producer profiling and metering data harvesting loops. Combines threshold fully homomorphic encryption (tFHE) with homomorphically split Pedersen commitments over renewable energy certificates (RECs), grid consumption metrics, and producer identity hashes. This architecture enables sovereign grid operators and energy regulators to verify hidden energy production claims (capacity thresholds, renewable source attribution, grid stability contributions) via non-interactive zero-knowledge range proofs without exposing raw metering data, producer PII, or cross-grid trading indices.

## Scope

### Core primitives

- **PqcEnergyCertificateGatingHub** — interlocking energy certificate coordinator that instantiates multi-party grid operator verification pools using homomorphically split Pedersen commitments over RECs, grid consumption metrics, and producer identity hashes.
- **ZkEnergyClaimValidator** — succinct energy verifier that processes non-interactive zero-knowledge range and production proofs, ensuring that an entity's hidden energy production claim status strictly satisfies policy-defined thresholds without disclosing individual energy production attributes.
- **Energy Gating Lifecycle Telemetry** — emits `ENERGY_GATING_POOL_INITIALIZED`, `ZK_ENERGY_CLAIM_VERIFIED`, and `CERTIFICATE_TRADING_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical energy gating pool initialization payload wire layout

```
ENERGYGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedCertificateCommitment>:<blindedGridMetricCommitment>:<blindedProducerHashCommitment>:<certificateExpirationSeconds>:<productionMetricDepth>:<pqcSignatureScheme>:<gridOperatorInitializerAttestationHash>:<committeeSignature>
```

### Canonical energy claim verification payload wire layout

```
ENERGYCLAIM:<claimId>:<poolId>:<blindedGridMetricCommitment>:<blindedClaimValueCommitment>:<zkEnergyRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical certificate trading accreditation completion payload wire layout

```
ENERGYCOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqEnergyGating`:
  - `minGridOperatorQuorum`: 3
  - `maxCertificateExpirationSeconds`: 63072000
  - `maxProductionMetricDepth`: 48
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireGridOperatorInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderEnergyClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized energy gating criteria—including minimum grid operator quorums, maximum certificate expiration lifetime bounds, allowed production metric depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqEnergyGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the grid-operator-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcEnergyCertificateGatingHub` instantiates multi-party grid operator verification pools using homomorphically split Pedersen commitments over RECs, grid consumption metrics, and producer identity hashes, preventing producer profiling and metering data harvesting loops.
- The `ZkEnergyClaimValidator` processes non-interactive zero-knowledge range and production proofs, ensuring that an entity's hidden energy production claim status strictly satisfies policy-defined thresholds without disclosing individual energy production attributes.
- Peers broadcasting malformed or out-of-order energy claims are automatically banned when `banMalformedOrOutOfOrderEnergyClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcEnergyCertificateGatingHub` initializes an energy gating pool and emits `ENERGY_GATING_POOL_INITIALIZED`.
- [ ] `ZkEnergyClaimValidator` verifies an energy claim and emits `ZK_ENERGY_CLAIM_VERIFIED`.
- [ ] `PqcEnergyCertificateGatingHub` completes certificate trading accreditation after quorum and emits `CERTIFICATE_TRADING_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqEnergyGating` configuration.

### Security / edge cases

- [ ] Reject grid operator quorum below `minGridOperatorQuorum`.
- [ ] Reject certificate expiration seconds exceeding `maxCertificateExpirationSeconds`.
- [ ] Reject production metric depth exceeding `maxProductionMetricDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested grid operator initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject energy claims exceeding the certificate expiration window.
- [ ] Reject malformed energy claims (missing zkEnergyRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject certificate trading accreditation completion before energy claim verification.
- [ ] Reject certificate trading accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order energy claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqEnergyGating` for `operation === 'pqEnergyGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-energy-certificate-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-energy-certificate-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer grid operator quorum with attested grid operator initializer and clearing committee relay, verify energy claim authentication and certificate trading accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-energy-certificate-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-energy-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-energy-certificate-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
