# Track 95: Post-Quantum Zero-Knowledge Cross-Chain Multi-Party Decentralized Deep-Sea Mineral Rights and Seabed Extraction Lease Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized deep-sea mineral rights allocation and seabed extraction lease gating layer that scales cross-chain. Track 95 enforces non-repudiable International Seabed Authority (ISA) endpoint attestation boundaries across shared networks while completely preventing extraction telemetry profiling and sovereign lease identity harvesting loops. Combines lattice-based attribute-based encryption (ABE) with homomorphically split Pedersen commitments over seabed mineral survey hashes, extraction volume digests, and sovereign authority identity hashes.

## Cryptographic Primitive

**Attribute-Based Encryption (ABE)** — embeds access policies directly into the ciphertext. Unlike proxy re-encryption (PRE, T94) which transforms who can decrypt data, ABE encrypts data once with a policy specifying which authority combinations can access it. The decryptor's key carries attributes (jurisdiction, authority level, environmental clearance), and decryption succeeds only if attributes satisfy the policy. This enables multi-jurisdictional seabed governance without a proxy re-encrypting for each authority.

## Domain Isolation

Deep-sea mineral rights and seabed extraction governance is distinct from T94 ocean fisheries (water column catch allocation). T95 covers seabed resource extraction, mineral survey verification, and sovereign lease boundaries.

## Test checklist

### Positive paths
- [ ] PqcDeepSeaMineralRightsGatingHub initializes a pool and emits SEABED_GATING_POOL_INITIALIZED
- [ ] ZkExtractionClaimValidator verifies an extraction claim and emits ZK_EXTRACTION_CLAIM_VERIFIED
- [ ] PqcDeepSeaMineralRightsGatingHub completes accreditation after quorum and emits LEASE_ACCREDITATION_COMPLETED
- [ ] CryptoPolicyEngine validates a compliant pqSeabedGating configuration

### Security / edge cases
- [ ] Reject lease window exceeding maxLeaseWindowSeconds
- [ ] Reject extraction chain depth exceeding maxExtractionChainDepth
- [ ] Reject un-attested ISA authority initializer
- [ ] Reject un-attested seabed oversight committee
- [ ] Reject unpermitted PQC signature scheme
- [ ] Reject duplicate pool initialization
- [ ] Reject accreditation completion before extraction claim verification
- [ ] Reject accreditation completion with insufficient quorum (below minSovereignQuorum=6)
- [ ] Ban peers broadcasting malformed claims (missing zkExtractionRangeProofHash)
- [ ] Ban peers broadcasting missing ABE key policy digest
- [ ] Ban peers broadcasting duplicate claims
- [ ] Policy violations: sovereignQuorum, leaseWindowSeconds, extractionChainDepth, pqcSignatureScheme, isaAuthorityInitializerAttestation, seabedOversightCommitteeAttestation, attestationAuthority, banMalformedOrOutOfOrderExtractionClaims, canonicalPayloadLayout

## Level mapping
- **L1 Deterministic**: `node -c`, `npx jest pq-deep-sea-mineral-rights-gating`, `npx simplebeacon scan --full --gate`
- **L2 Behavioral**: Simulate six-signer sovereign quorum with attested ISA authority initializer and seabed oversight committee
- **L3 Reflection**: Spec alignment, minimal file count, domain isolation, primitive isolation (ABE new to gating matrix)

## Files expected to change
- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-deep-sea-mineral-rights-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-extraction-claim-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-deep-sea-mineral-rights-gating.test.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs`
