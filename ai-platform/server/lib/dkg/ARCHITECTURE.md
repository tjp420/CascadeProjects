**Distributed Key Generation (DKG) — Proactive Refresh Architecture**

Overview
- Purpose: Periodic proactive re-sharing (refresh) of secret shares so that historical compromise of up-to-(k-1) nodes does not reveal the long-term private key.
- Goal: Preserve a stable joint public key (unchanged Y) while rotating private shares s_i → s'_i every epoch.

Topology & Roles
- Nodes: n participating nodes, threshold k (k ≤ n). Each node i holds a private share s_i and public commitment C_i = g^{s_i} (or EC point).
- Coordinator: Logical, optional — no trusted dealer. A coordinator may help schedule epochs, but does not learn secrets.
- Auditor / Witnesses: Optional read-only observers that receive commitments and signed epoch transcripts for forensic auditing.

Cryptographic assumptions
- Finite-field or elliptic-curve group with collision-resistant hash and discrete-log hardness (Ed25519 or BN254/alt_bn128 for bilinear pairing use-cases).
- VSS scheme: Pedersen VSS (additive homomorphic commitments) or Feldman VSS (for simpler EC usage). Use Pedersen if blinding commitments needed.
- Optional Primitives: BLS threshold signatures for compact joint-public-key representation; HKDF for deriving per-epoch randomness; AEAD for transport confidentiality.

Epoch model
- Epoch t: Node shares s_i^{(t)} (private) and commitments C_i^{(t)} (public). Joint public key Y^{(t)} = aggregate(C_i^{(t)}) remains stable across refresh.
- Refresh window: nodes coordinate within a bounded time window W. All re-sharing messages must be delivered and verified within W to consider epoch successful.

High-level protocol (proactive re-sharing)
1. Setup: Nodes agree on epoch parameters (epoch id, nonce, window W, random seed R_e).
2. Each node i locally samples a random zero-sum polynomial r_i(x) of degree k-1 whose constant term is zero and computes blinded shares to add to peers: ∀j share u_{i→j} = r_i(j).
3. Node i sends encrypted u_{i→j} plus a commitment of polynomial (commit_i) to peer j over mutual-TLS.
4. Each receiver j verifies commitments; if valid, they add received u_{i→j} to their local share: s_j' ← s_j + Σ_i u_{i→j}.
5. After collecting at least n-k+1 valid contributions and verifying commitments, nodes publish the new commitments C_j' and sign an epoch transcript.
6. Optional: Run collective complaint/accusation rounds when verification fails (see Fault Handling Policies below).

Message types
- REFRESH_OFFER: { epoch, from, commitment, encrypted_payload_meta }
- REFRESH_SHARE: { epoch, from, to, encrypted_share, signature }
- REFRESH_COMMIT: { epoch, from, new_commitment, proof }
- ACCUSATION/COMPLAINT: { epoch, from, accused, evidence }
- EPOCH_FINAL: { epoch, summary_signature }

Operational constraints
- Window W sizing: should factor network latencies, expected node clocks skew, and maximum verification time. Default: configurable (e.g., 30s–5m depending on deployment).
- Stopping condition: if insufficient valid shares or repeated faulty participants, either delay and retry or trigger operator alert depending on policy.

APIs and directory layout (scaffold)
- `ai-platform/server/lib/dkg/` (this folder)
  - `index.cjs` — runtime entry; epoch scheduler and API surface.
  - `protocol.cjs` — implementation of polynomial sampling, VSS commitments, verification helpers.
  - `transport.cjs` — secure transport wrappers (mutualTLS + AEAD helper) and retry/backoff policy.
  - `auditor.cjs` — epoch transcript persistence and signed audit logs.
  - `tests/` — unit and integration tests for re-sharing and fault injection.

Telemetry and metrics
- Expose Prometheus metrics: `dkg_epoch_started_total`, `dkg_epoch_success_total`, `dkg_epoch_failed_total`, `dkg_faults_detected_total`, `dkg_node_evictions_total`, plus latency histograms for `dkg_epoch_duration_seconds`.
- Emit structured audit logs for every epoch: commit lists, accusations, and resolution outcomes.

Notes
- Keep key-material operations confined to HSM adapter if available (`ai-platform/server/lib/hsm-adapter/`) to limit host memory exposure.
- Use deterministic DRBG/HKDF seeded per-epoch for repeatable test vectors and deterministic fuzzing.
