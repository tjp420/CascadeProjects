# Track 60: Post-Quantum Fully Homomorphic Secure Multi-Party Consensus & Identity Bridges — Test Plan

## Objective

Establish a decentralized cross-network authorization and consensus plane, enabling nodes from separate platform ecosystems to collectively evaluate secret-shared identity state weights directly over encrypted matrices without raw text exposure or centralized trust brokers. Track 60 acts as a grand capstone uniting Track 46 fully homomorphic computation contracts, Track 51 post-quantum identity hubs, and Track 59 cross-chain governance bridges. It provides non-repudiable inter-chain state finality and identity alignment while strictly masking network topologies and context metadata.

## Scope

### Core primitives

- **PqcHomomorphicIdentityBridgeHub** — multi-platform identity manager that aggregates encrypted node registry updates from independent networks, running dot-product evaluation matrix math directly over ciphertexts.
- **MpcHomomorphicConsensusVerifier** — decentralized validation engine that processes zero-knowledge cross-chain identity assertions, verifying that an entity belongs to a valid external threshold group without exposing the underlying node parameters.
- **Consensus Bridge Telemetry** — emits `HOMOMORPHIC_IDENTITY_BRIDGE_INITIALIZED` and `MPC_CROSS_CHAIN_CONSENSUS_FINALIZED` into the Track 29 ZK-rollup accumulator.

### Canonical homomorphic identity bridge initialization payload wire layout

```
HOMOIDINIT:<bridgeId>:<sourceTenantId>:<targetChainId>:<matrixDepth>:<pqcSignatureScheme>:<routerAttestationHash>:<committeeSignature>
```

### Canonical cross-chain identity assertion payload wire layout

```
HOMOIDASSERT:<assertionId>:<bridgeId>:<entityIdHash>:<thresholdGroupHash>:<committeeVerifierAttestationHash>:<zkProofHash>:<partialSignature>
```

### Policy schema additions

- `pqcHomomorphicIdentityBridge`:
  - `minCrossChainQuorum`: 3
  - `maxHomomorphicMatrixDepth`: 32
  - `maxIdentityProofWindowSeconds`: 86400
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireRouterAttestation`: true
  - `requireCommitteeVerifierAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderProofs`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All homomorphic consensus and identity bridge criteria—including minimum cross-chain quorums, maximum homomorphic matrix depths, identity proof expiration windows, and allowed post-quantum curves—are managed dynamically via the dedicated `pqcHomomorphicIdentityBridge` stanza in the active `CryptoPolicyEngine` schema.
- Both the local cross-network router and the processing committee verifiers must pass `EnclaveAttestationClient.verify()` before an identity assertion can be signed (Track 41 integration).
- The `PqcHomomorphicIdentityBridgeHub` aggregates encrypted node registry updates from independent networks, running dot-product evaluation matrix math directly over ciphertexts.
- The `MpcHomomorphicConsensusVerifier` processes zero-knowledge cross-chain identity assertions, verifying entity membership in valid external threshold groups without exposing underlying node parameters.
- Peers broadcasting malformed or out-of-order consensus proofs are automatically banned when `banMalformedOrOutOfOrderProofs` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcHomomorphicIdentityBridgeHub` initializes a bridge and emits `HOMOMORPHIC_IDENTITY_BRIDGE_INITIALIZED`.
- [ ] `MpcHomomorphicConsensusVerifier` processes a valid cross-chain identity assertion.
- [ ] `MpcHomomorphicConsensusVerifier` finalizes consensus after quorum and emits `MPC_CROSS_CHAIN_CONSENSUS_FINALIZED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqcHomomorphicIdentityBridge` configuration.

### Security / edge cases

- [ ] Reject cross-chain quorum below `minCrossChainQuorum`.
- [ ] Reject homomorphic matrix depth exceeding `maxHomomorphicMatrixDepth`.
- [ ] Reject identity proof window exceeding `maxIdentityProofWindowSeconds`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested router.
- [ ] Reject un-attested committee verifier.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject consensus finalization before quorum is reached.
- [ ] Reject expired identity proofs.
- [ ] Automatically ban peers broadcasting malformed or out-of-order proofs.
- [ ] Reject a payload that does not follow the canonical layout.
- [ ] Reject duplicate identity assertions from the same entity.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqcHomomorphicIdentityBridge` for `operation === 'pqcHomomorphicIdentityBridge'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pqc-homomorphic-identity-bridge` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pqc-homomorphic-identity-bridge`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-platform homomorphic identity bridge with attested router and committee verifiers, verify quorum consensus finalization.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-homomorphic-identity-bridge-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/mpc-homomorphic-consensus-verifier.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pqc-homomorphic-identity-bridge.test.cjs` *(new)*

## Approval

Pending Validator review.
