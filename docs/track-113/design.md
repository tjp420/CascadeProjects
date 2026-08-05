# Track 113 — Quantum-Resistant Identity Ratchet

## Design Document

**Status:** Implemented
**Milestone:** Track 113 — Post-quantum hybrid identity ratchet rollout (Kyber hybrid + Ed25519)
**Issues:** #404 (master plan), #405 (design), #406 (integration), #407 (migration), #408 (validation), #409 (telemetry)

## Overview

Track 113 implements a post-quantum hybrid identity ratchet for long-lived worker/agent sessions. It combines classical X25519/Ed25519 cryptography with ML-KEM-768 (Kyber-768) post-quantum key encapsulation to provide forward secrecy even against an adversary with a quantum computer.

## Parameter Choices

### Hybrid Key Composition

The hybrid public key is a versioned, length-prefixed serialization of three components:

| Component ID | Algorithm | Purpose | Key Size (DER) |
|-------------|-----------|---------|----------------|
| `0x01` | Ed25519 | Signature (handshake authentication) | 44 bytes (SPKI DER) |
| `0x02` | X25519 | Key exchange (classical ECDH) | 44 bytes (SPKI DER) |
| `0x03` | ML-KEM-768 | Key encapsulation (post-quantum KEM) | 1184 bytes (raw) |

**Version:** `0x01` (current)

**Rationale:** ML-KEM-768 (NIST FIPS 203, Level 3 security) was chosen over ML-KEM-512 (Level 1) for a conservative security margin. The 1184-byte public key is larger than classical equivalents but acceptable for session bootstrap (not per-message overhead).

### Key Derivation

| Function | Algorithm | Output |
|----------|-----------|--------|
| `initializeFromShared` | HKDF-SHA256 | 32-byte root + 32-byte chain key |
| `kdfRoot` (rotation) | HKDF-SHA256 | 32-byte root + 32-byte chain key |
| `kdfChain` (message step) | HKDF-SHA256 | 32-byte message key + 32-byte next chain key |
| Hybrid shared secret | HKDF-SHA384 | 32-byte shared secret from PQ + classical |

**Rationale:** SHA-256 is used for the ratchet chain (sufficient security, faster) while SHA-384 is used for the initial hybrid shared secret derivation (higher security margin for the PQ-classical combination step).

### Rotation Thresholds

| Parameter | Default | Configurable |
|-----------|---------|-------------|
| `maxMessages` | 10,000 | Yes |
| `maxDurationMs` | 86,400,000 (24h) | Yes |
| `warningRatio` | 0.8 (80%) | Yes |
| `checkIntervalMs` | 1,000 | Yes |

**Rationale:** 10,000 messages provides a reasonable tradeoff between forward secrecy (frequent rotation limits exposure) and performance (rotation requires new key derivation). The 80% warning ratio gives operators time to prepare for rotation before it's forced.

## Threat Model

### Protected Against

- **Harvest-now-decrypt-later:** An adversary recording ciphertexts today cannot decrypt them in the future with a quantum computer, because the ML-KEM-768 component provides post-quantum confidentiality.
- **Key compromise:** The ratchet chain provides forward secrecy — compromising the current chain key does not reveal past message keys.
- **Signature forgery:** Ed25519 provides classical authentication; the hybrid signature scheme ensures authenticity even if the classical component is compromised.

### Not Protected Against

- **Active quantum adversary during handshake:** The ML-KEM-768 component is not signed by the PQ key — only the classical Ed25519 signature authenticates the handshake. A future upgrade could add PQ signature (e.g., ML-DSA-65).
- **Side-channel attacks:** The implementation uses software ML-KEM; constant-time guarantees depend on the vendored implementation.
- **Key storage compromise:** If the secret key (including ML-KEM secret) is exfiltrated, all past sessions can be decrypted.

## API Contract

### `IdentityRatchet`

```javascript
const { IdentityRatchet } = require('./lib/crypto/ratchet/identity-ratchet.cjs');

const ratchet = await new IdentityRatchet({ deviceId: 'agent-1' }).generate();
// ratchet.publicKey — Buffer (versioned hybrid key)
// ratchet.secretKey — { deviceId, ed25519, x25519, mlkem }

// Encapsulate shared secret against peer's public key
const { cipherText, chainKey } = await ratchet.encapsulateFor(peerPublicKey);

// Decapsulate incoming cipherText
const { chainKey } = await ratchet.decapsulateFrom(cipherText);

// Step the chain for each message
const messageKey = ratchet.step();

// Force rotation
const { chainKey, rotationEpoch } = ratchet.rotateNow();

// Sign/verify handshake transcripts
const signature = ratchet.signHandshake(transcript);
const valid = ratchet.verifyHandshake(signature, transcript, peerPublicKey);
```

### `CompatibilityShim`

```javascript
const { initiateHandshake, acceptHandshake, detectMode } = require('./lib/crypto/ratchet/compatibility-shim.cjs');

// Auto-detect peer mode
const { mode } = detectMode(peerPublicKey); // 'HYBRID' or 'CLASSICAL'

// Initiate handshake (auto-selects hybrid or classical)
const { mode, handshake, chainKey } = await initiateHandshake(localRatchet, peerPublicKey);

// Accept handshake
const { mode, chainKey } = await acceptHandshake(localRatchet, handshake, peerPublicKey);
```

## Migration Notes

### Compatibility Shim

The compatibility shim (`compatibility-shim.cjs`) enables rolling deployment:

1. **Phase 1 (current):** Hybrid-capable peers use ML-KEM-768 + X25519 + Ed25519. Classical-only peers use X25519 + Ed25519 with an ephemeral X25519 key for forward secrecy.
2. **Phase 2 (future):** Set `deprecationDeadline` to a future timestamp. After the deadline, classical-only handshakes throw `CLASSICAL_DEPRECATION_DEADLINE`.
3. **Phase 3 (future):** Remove classical fallback. All peers must support hybrid.

### Client Migration

- Hybrid public keys are backward-incompatible with classical-only clients (different format)
- The compatibility shim auto-detects peer capabilities from the public key format
- No protocol negotiation needed — the versioned key format is self-describing

## File Layout

```
server/lib/crypto/ratchet/
├── hybrid-bootstrap.cjs      — ML-KEM-768 + X25519 + Ed25519 KEM
├── identity-ratchet.cjs      — Full ratchet with KDF chain + rotation
├── compatibility-shim.cjs    — Hybrid/classical auto-detection + fallback
├── rotation-scheduler.cjs    — Message count + duration threshold rotation
├── ratchet-metrics.cjs       — Handshake latency + failure telemetry
├── session-store.cjs         — Session persistence
├── envelope-crypto.cjs       — Envelope encryption
├── kem-provider.cjs          — KEM provider abstraction
├── secret-scanner.cjs        — Secret scanning integration
├── index.cjs                 — KDF root/chain functions
└── __tests__/
    ├── identity-ratchet.test.cjs     — 9 unit tests
    ├── compatibility-shim.test.cjs   — 7 unit tests
    ├── handshake-fuzz.test.cjs       — 25 fuzz + interop tests
    ├── secret-scanner.test.cjs       — 1 unit test
    └── session-purge.test.cjs        — 1 unit test
```

## Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| identity-ratchet.test.cjs | 9 | Keypair generation, encapsulate/decapsulate, sign/verify, chain step, rotation, audit events |
| compatibility-shim.test.cjs | 7 | Mode detection, hybrid/classical handshake, deprecation deadline, metrics |
| handshake-fuzz.test.cjs | 25 | Malformed keys, truncated cipherTexts, version mismatches, corrupted signatures, randomized fuzzing, interop convergence |
| secret-scanner.test.cjs | 1 | Secret scanning integration |
| session-purge.test.cjs | 1 | Session purge |
| **Total** | **43** | |
