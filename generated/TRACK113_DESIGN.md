## Track 113 — Design

**Scope:** Parameter selection, threat model, API contract for `IdentityRatchet`.

**Tasks:**
- Evaluate PQ KEM choices (Kyber, NTRU) and hybrid parameters
- Define API surface for `IdentityRatchet` (bootstrap, rotate, export public metadata)
- Define canonicalization inputs (reuse RFC 8785 JCS outputs) for deterministic signatures
- Prepare design doc and sequence diagrams

**Acceptance:** Design doc merged to `docs/track-113/design.md`

Related: Master issue #404
