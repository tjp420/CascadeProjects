## Track 113 — Integration

**Scope:** Implement hybrid KEM+signature primitives and session bootstrap.

**Tasks:**
- Implement KEM wrapper (Kyber) with Node bindings or pure-JS fallback
- Implement hybrid signature scheme (Ed25519 + PQ signature if selected)
- Wire `IdentityRatchet` into `server/lib/crypto` namespace
- Add tests for sign/verify across nodes

**Acceptance:** Hybrid primitives live in `server/lib/crypto/ratchet` and tests pass.

Related: Master issue #404
