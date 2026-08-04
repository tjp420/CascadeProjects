# Track 113 — Quantum-Resistant Identity Ratchet

## Overview

This document specifies the **hybrid post-quantum identity ratchet** design for long-lived worker/agent sessions. The goal is to layer a **module-lattice KEM (Kyber-768)** hybrid key-exchange over an existing Ed25519 signature layer to provide post-quantum forward secrecy while preserving backward compatibility via hybrid signatures.

Key decisions (initial):

- PQ KEM: **Kyber-768** (NIST PQC Round 3 finalist family, balanced security/perf).
- Classical signature: **Ed25519** for compatibility and existing verification codepaths.
- Hybrid approach: KEM encapsulation for ephemeral shared secret + Ed25519 for authentication; session keys derived via HKDF over concatenated shared secrets to produce symmetric ratchet state.
- Canonicalization: All signed/verified JSON inputs MUST be canonicalized with RFC 8785 JCS encoding (see `ai-platform/server/lib/canonical/jcs.cjs`) to guarantee deterministic signatures across nodes.

## Mathematical summary (high-level)

Let:

- KEM.Generate() -> (pk_kem, sk_kem)
- KEM.Encaps(pk_kem) -> (ct, ss_kem)
- KEM.Decaps(sk_kem, ct) -> ss_kem
- Sign(sk_sig, msg) -> sig
- Verify(pk_sig, msg, sig) -> bool
- HKDF(salt, ikm, info, L) -> key material

Hybrid handshake (initiator I, responder R):

1. Both sides have long-lived signing keypair (Ed25519): (sk_sig_I, pk_sig_I) and (sk_sig_R, pk_sig_R).
2. R publishes KEM public key `pk_kem_R` (rotated per policy) as part of responder metadata.
3. I performs `KEM.Encaps(pk_kem_R)` producing `(ct, ss_kem)`.
4. I constructs canonical JSON envelope E containing: { ct, pk_sig_I, pk_sig_R, nonce, version }
5. I signs canonical(E) with `sk_sig_I` producing `sig_I` and sends `{ E, sig_I }` to R.
6. R verifies `sig_I` using `pk_sig_I`. R then computes `ss_kem = KEM.Decaps(sk_kem_R, ct)`.
7. Both sides derive session key material via `HKDF(salt, ss_kem || shared_info, "Track113 ratchet", 64)`.
8. Subsequent ratchet rotations use ephemeral KEM keypairs and the same canonical signing flow to authenticate rotations.

Security notes:

- Concatenate KEM-derived secrets deterministically before HKDF.
- Use canonical JSON for the envelope to prevent signature malleability across language runtimes.
- Hybrid signatures ensure that even if classical signatures are broken, KEM secrecy remains, and vice-versa.

## API Contract (proposed)

Module path: `server/lib/crypto/ratchet`

Exports (CJS):

- `bootstrapSession({ tenant, peerPkSig, peerPkKem, localSkSig, opts }) -> { sessionId, publicMetadata }`
  - Create new ratchet session; returns `publicMetadata` to publish (includes `pk_kem` and `pk_sig`).

- `processBootstrap({ sessionId, envelope, signature }) -> { ok, sessionKey, meta }`
  - Process incoming bootstrap envelope and complete handshake.

- `rotate(sessionId) -> { ok, rotationMeta }`
  - Initiate a ratchet rotation; returns canonical rotation envelope signed by local sk.

- `verifyRotation({ sessionId, envelope, signature }) -> { ok }`
  - Verify and apply rotation state.

- `exportPublicMetadata(sessionId) -> { pk_sig, pk_kem, version, rotatedAt }`

Implementation notes:

- All serialized envelopes MUST be canonicalized via the JCS implementation before signing or verifying.
- Session state stored under `server/data/ratchet/<tenant>/<sessionId>` with atomic writes.

## Rotation Policy

- Default rotation interval: 24 hours for long-lived sessions; configurable per-tenant.
- Immediate rotation on suspicious activity or manual trigger.

## Migration & Compatibility

- Hybrid signatures: when verifying incoming envelopes, servers should accept either pure-classical envelopes (legacy) or hybrid envelopes (containing KEM ct). Servers must prefer hybrid if available and emit forensic events when legacy-only envelopes are used from upgraded clients.

## Telemetry

- Counters: `track113.ratchet_rotations_total{tenant}` (low-cardinality)
- Histograms: `track113.handshake_latency_seconds` (p50/p95/p99)
- Forensic events: `track113.handshake_failure` appended to `.simplebeacon/forensic-events.log` with `traceId` when available.

## Tests & Fixtures

- Provide a multi-turn negotiation simulator fixture that runs bootstrap -> rotate -> rotate and asserts deterministic derived keys across two nodes.

## Implementation roadmap

1. Design doc review and security sign-off.
2. Prototype KEM wrapper (native binding or pure-js fallback) and HKDF-derived ratchet.
3. Ratchet service hull + storage.
4. Tests, interop, and migration plan.

---

*Document generated and scaffolded by automation; refine parameters and math with security reviewers.*
