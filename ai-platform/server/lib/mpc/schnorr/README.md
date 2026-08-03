# MPC Schnorr JCS Vectors — Adoption Guide

This folder contains the RFC 8785 JCS canonicalization reference and cross-language test vectors used to validate deterministic serialization for fraud proofs and Schnorr aggregation.

What is included
- `jcs.cjs` — Node.js JCS canonicalizer used by the proofs and vector generator.
- `__tests__/vectors.json` — Canonical test vectors used to verify cross-language implementations.

How to reproduce vectors in other languages
1. Implement RFC 8785 canonicalization for your runtime. Pay special attention to numeric normalization:
   - Treat `-0` as `0`.
   - Bound significant digits (we use 21 digits) and normalize exponent formatting (lowercase `e`, no leading `+`).
   - Serialize BigInt values as hexadecimal strings.
2. Canonicalize the JSON payload exactly (no extra whitespace, keys sorted lexicographically).
3. Compute the SHA-256 digest of the canonicalized UTF-8 bytes and compare against `vectors.json` entries.

Reference runners
- `reference-runner-go/main.go` — placeholder Go runner that will load `vectors.json` and compute digests (TBD).
- `reference-runner-rust/main.rs` — placeholder Rust runner (TBD).

If you'd like, I can add minimal working reference implementations in Go or Rust that compute the canonicalized digests for the existing vectors.
