# Track 81: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Cross-Border Logistics Verification and Customs Manifest Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized cross-border logistics verification and customs manifest gating layer that scales cross-chain. Track 81 enforces non-repudiable customs authority attestation boundaries across shared networks while completely preventing cargo declaration profiling and importer/exporter PII harvesting loops. Combines threshold fully homomorphic encryption (tFHE) with homomorphically split Pedersen commitments over multi-jurisdictional customs manifest hashes, transit log metrics, and carrier tracking identifiers. This architecture enables sovereign customs authorities, cross-jurisdictional trade corridors, and carrier networks to verify hidden logistics claims (manifest integrity thresholds, transit time bounds, carrier accreditation metrics) via non-interactive zero-knowledge range proofs without exposing raw cargo declarations, importer/exporter PII, or cross-jurisdictional trade tracking indices.

## Scope

### Core primitives

- **PqcCrossBorderLogisticsGatingHub** — interlocking customs authority coordinator that instantiates multi-party logistics verification pools using homomorphically split Pedersen commitments over multi-jurisdictional customs manifest hashes, transit log metrics, and carrier tracking identifiers.
- **ZkManifestClaimValidator** — succinct manifest verifier that processes non-interactive zero-knowledge range and manifest proofs, ensuring that an entity's hidden logistics claim status strictly satisfies policy-defined thresholds without disclosing individual cargo or carrier attributes.
- **Logistics Gating Lifecycle Telemetry** — emits `LOGISTICS_GATING_POOL_INITIALIZED`, `ZK_MANIFEST_CLAIM_VERIFIED`, and `CARRIER_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical logistics gating pool initialization payload wire layout

```
LOGIGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedManifestHashCommitment>:<blindedTransitLogCommitment>:<blindedCarrierTrackingCommitment>:<transitWindowSeconds>:<manifestDepth>:<pqcSignatureScheme>:<customsAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical manifest claim verification payload wire layout

```
LOGICLAIM:<claimId>:<poolId>:<blindedTransitLogCommitment>:<blindedClaimValueCommitment>:<zkManifestRangeProofHash>:<tradeCorridorCommitteeAttestationHash>:<partialSignature>
```

### Canonical carrier accreditation completion payload wire layout

```
LOGICOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqLogisticsGating`:
  - `minCustomsQuorum`: 3
  - `maxTransitWindowSeconds`: 7776000
  - `maxManifestDepth`: 32
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireCustomsAuthorityInitializerAttestation`: true
  - `requireTradeCorridorCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderManifestClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized logistics gating criteria—including minimum customs quorums, maximum transit window lifetime bounds, allowed manifest depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqLogisticsGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the customs-authority-initializing endpoint and the processing trade corridor committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcCrossBorderLogisticsGatingHub` instantiates multi-party logistics verification pools using homomorphically split Pedersen commitments over multi-jurisdictional customs manifest hashes, transit log metrics, and carrier tracking identifiers, preventing cargo declaration profiling and importer/exporter PII harvesting loops.
- The `ZkManifestClaimValidator` processes non-interactive zero-knowledge range and manifest proofs, ensuring that an entity's hidden logistics claim status strictly satisfies policy-defined thresholds without disclosing individual cargo or carrier attributes.
- Peers broadcasting malformed or out-of-order manifest claims are automatically banned when `banMalformedOrOutOfOrderManifestClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcCrossBorderLogisticsGatingHub` initializes a logistics gating pool and emits `LOGISTICS_GATING_POOL_INITIALIZED`.
- [ ] `ZkManifestClaimValidator` verifies a manifest claim and emits `ZK_MANIFEST_CLAIM_VERIFIED`.
- [ ] `PqcCrossBorderLogisticsGatingHub` completes carrier accreditation after quorum and emits `CARRIER_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqLogisticsGating` configuration.

### Security / edge cases

- [ ] Reject customs quorum below `minCustomsQuorum`.
- [ ] Reject transit window seconds exceeding `maxTransitWindowSeconds`.
- [ ] Reject manifest depth exceeding `maxManifestDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested customs authority initializer.
- [ ] Reject un-attested trade corridor committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject manifest claims exceeding the transit window.
- [ ] Reject malformed manifest claims (missing zkManifestRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject carrier accreditation completion before manifest claim verification.
- [ ] Reject carrier accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order manifest claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqLogisticsGating` for `operation === 'pqLogisticsGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-cross-border-logistics-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-cross-border-logistics-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer customs quorum with attested customs authority initializer and trade corridor committee relay, verify manifest claim authentication and carrier accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-cross-border-logistics-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-manifest-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-cross-border-logistics-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
