# Track 113 — Quantum-Resistant Identity Ratchet (Master Issue)

**Context:** This track implements a **post-quantum hybrid identity ratchet** for long-lived worker/agent sessions. It builds on the deterministic JCS canonicalization and distributed tracing introduced in PR #402 to ensure deterministic hybrid signatures and cross-node verification.

**Goal:** Integrate a hybrid PQ key-exchange and signature scheme (e.g., Kyber + Ed25519 hybrid) into the session bootstrap and ratchet rotation flows to provide post-quantum forward secrecy while maintaining backward compatibility.

## Scope
- Define API for `IdentityRatchet` service (in `server/lib/crypto/ratchet`)
- Implement hybrid KEM (Kyber) + classical signature hybrid for session bootstrap
- Add ratchet rotation scheduler and rotation latency SLOs
- Provide compatibility shim (hybrid signing) for older clients
- Add unit, integration, and interop tests; include fuzzing for handshake resilience

## Milestones
1. **Design**: Parameter selection, threat modeling, API contract.
2. **Integration**: Implement KEM + hybrid sign/verify primitives, session bootstrap changes.
3. **Migration**: Rolling compatibility shim and client migration plan.
4. **Validation**: Tests, interop, fuzzing, and security review.
5. **Telemetry**: Ratchet rotation counters, handshake latency histograms, sparse forensic events on failures.

## Telemetry Targets
- Ratchet rotation event counter (low-cardinality, by tenant)
- Handshake latency histogram (p50/p95/p99)
- Forensic sparse events on signature/handshake failures with trace correlation

## Acceptance Criteria
- Hybrid key exchange implemented and unit-tested
- Rolling compatibility ensures older clients can still connect with hybrid signatures enabled
- Trace correlation persists through ratchet rotations
- Documentation: `docs/track-113/` with parameter choices and migration notes

Related PR: https://github.com/tjp420/CascadeProjects/pull/402
