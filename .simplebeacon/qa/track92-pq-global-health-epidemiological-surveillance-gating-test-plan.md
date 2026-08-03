# Track 92: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Global Health Epidemiological Surveillance and Outbreak Response Coordination Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized global health epidemiological surveillance and outbreak response coordination gating layer that scales cross-chain. Track 92 enforces non-repudiable WHO authority endpoint attestation boundaries across shared networks while completely preventing patient case data profiling and jurisdiction identity harvesting loops. Combines lattice-based functional encryption with homomorphically split Pedersen commitments over epidemiological case telemetry hashes, pathogen genomic sequence digests, and public health authority identity hashes. This architecture enables WHO global health authorities, national CDC equivalents, and regional health organizations to compute aggregate epidemiological functions (infection rate sums, R0 transmission estimates, variant distribution histograms) over encrypted patient case data without ever decrypting individual patient records, verifying hidden epidemiological claims (case threshold bounds, transmission rate quorum metrics, outbreak accreditation status) via non-interactive zero-knowledge range proofs without exposing raw case data, genomic sequences, or jurisdiction identities.

## Scope

### Core primitives

- **PqcGlobalHealthEpidemiologicalSurveillanceGatingHub** — interlocking WHO authority endpoint coordinator that instantiates multi-party epidemiological surveillance verification pools using homomorphically split Pedersen commitments over epidemiological case telemetry hashes, pathogen genomic sequence digests, and public health authority identity hashes.
- **ZkEpidemiologicalClaimValidator** — succinct epidemiological claim verifier that processes non-interactive zero-knowledge range and surveillance proofs with functional encryption key verification, ensuring that an entity's hidden epidemiological claim status strictly satisfies policy-defined thresholds without disclosing individual patient or jurisdiction attributes.
- **Epidemiology Gating Lifecycle Telemetry** — emits `EPIDEMIOLOGY_GATING_POOL_INITIALIZED`, `ZK_EPIDEMIOLOGICAL_CLAIM_VERIFIED`, and `OUTBREAK_ACCREDITATION_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical epidemiology gating pool initialization payload wire layout

```
EPIGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedCaseTelemetryCommitment>:<blindedGenomicSequenceCommitment>:<blindedHealthAuthorityIdentityCommitment>:<surveillanceWindowSeconds>:<genomicChainDepth>:<pqcSignatureScheme>:<whoAuthorityInitializerAttestationHash>:<committeeSignature>
```

### Canonical epidemiological claim verification payload wire layout

```
EPICLAIM:<claimId>:<poolId>:<blindedGenomicSequenceCommitment>:<blindedClaimValueCommitment>:<zkEpidemiologicalRangeProofHash>:<epidemiologyOversightCommitteeAttestationHash>:<functionalEncryptionKeyDigest>
```

### Canonical outbreak accreditation completion payload wire layout

```
EPICOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqEpidemiologyGating`:
  - `minEpidemiologyQuorum`: 5
  - `maxSurveillanceWindowSeconds`: 604800
  - `maxGenomicChainDepth`: 16
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireWhoAuthorityInitializerAttestation`: true
  - `requireEpidemiologyOversightCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderEpidemiologicalClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized global health epidemiological surveillance criteria—including minimum epidemiology quorums, maximum surveillance window lifetime bounds, allowed genomic chain depth parameters, and post-quantum signature schemes—are managed dynamically via the dedicated `pqEpidemiologyGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the WHO-authority-initializing endpoint and the processing epidemiology oversight committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcGlobalHealthEpidemiologicalSurveillanceGatingHub` instantiates multi-party WHO authority verification pools using homomorphically split Pedersen commitments over epidemiological case telemetry hashes, pathogen genomic sequence digests, and public health authority identity hashes, preventing patient case data profiling and jurisdiction identity harvesting loops.
- The `ZkEpidemiologicalClaimValidator` processes non-interactive zero-knowledge range and surveillance proofs with functional encryption key verification, ensuring that an entity's hidden epidemiological claim status strictly satisfies policy-defined thresholds without disclosing individual patient or jurisdiction attributes.
- Peers broadcasting malformed or out-of-order epidemiological claims are automatically banned when `banMalformedOrOutOfOrderEpidemiologicalClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.
- The quorum minimum of 5 reflects the multi-stakeholder nature of global health surveillance (WHO, national CDC, regional health authority, genomic surveillance lab, public health ethics committee).
- Functional encryption introduces a fundamentally new cryptographic paradigm to the gating matrix. Unlike all prior primitives that decrypt data or sign messages, FE derives function-specific keys that compute only the *result* of a function over encrypted data, never revealing the underlying plaintext. This enables WHO to compute global aggregate statistics (case counts, R0 estimates, variant distributions) from encrypted national datasets without any nation exposing raw patient data.
- Domain isolation from Track 47 (`pqHealthDataGating`): T47 covers health data record *access control* (who can read a patient's EHR). Track 92 covers epidemiological *population-level surveillance* (aggregate functions over encrypted case data). No overlap in primitives, telemetry events, or canonical payload prefixes.
- Domain isolation from Track 86 (`pqInsuranceGating`): T86 covers health insurance *financial claim auditing* (billing sequences, actuarial risk codes, payout commitments). Track 92 covers *disease surveillance and outbreak response* (case telemetry, genomic sequences, transmission rates). No overlap in primitives, telemetry events, or canonical payload prefixes.

## Test checklist

### Positive paths

- [ ] `PqcGlobalHealthEpidemiologicalSurveillanceGatingHub` initializes an epidemiology gating pool and emits `EPIDEMIOLOGY_GATING_POOL_INITIALIZED`.
- [ ] `ZkEpidemiologicalClaimValidator` verifies an epidemiological claim and emits `ZK_EPIDEMIOLOGICAL_CLAIM_VERIFIED`.
- [ ] `PqcGlobalHealthEpidemiologicalSurveillanceGatingHub` completes outbreak accreditation after quorum and emits `OUTBREAK_ACCREDITATION_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqEpidemiologyGating` configuration.

### Security / edge cases

- [ ] Reject epidemiology quorum below `minEpidemiologyQuorum` (5).
- [ ] Reject surveillance window seconds exceeding `maxSurveillanceWindowSeconds`.
- [ ] Reject genomic chain depth exceeding `maxGenomicChainDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested WHO authority initializer.
- [ ] Reject un-attested epidemiology oversight committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject epidemiological claims exceeding the surveillance window.
- [ ] Reject malformed epidemiological claims (missing zkEpidemiologicalRangeProofHash, missing functionalEncryptionKeyDigest).
- [ ] Reject duplicate pool initializations.
- [ ] Reject outbreak accreditation completion before epidemiological claim verification.
- [ ] Reject outbreak accreditation completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order epidemiological claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqEpidemiologyGating` for `operation === 'pqEpidemiologyGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-global-health-epidemiological-surveillance-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-global-health-epidemiological-surveillance-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a five-signer epidemiology quorum with attested WHO authority initializer and epidemiology oversight committee relay, verify epidemiological claim authentication and outbreak accreditation completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules, domain isolation (no existing track covers epidemiology/surveillance operations — distinct from T47 health data access control and T86 insurance claim auditing), primitive isolation (functional encryption new to gating matrix).

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-global-health-epidemiological-surveillance-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-epidemiological-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-global-health-epidemiological-surveillance-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
