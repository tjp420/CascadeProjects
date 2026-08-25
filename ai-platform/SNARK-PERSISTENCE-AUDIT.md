# SNARK Persistence Audit

Status: DRAFT

Owner: @your-team-here
Date: 2026-08-03

## Purpose

This document is a template for capturing findings during a targeted audit of SNARK persistence, transcript allocation, and polynomial coefficient storage in `hsm-adapter/dkg-snark-engine.cjs` and related modules. The goal is to record reproducible vulnerabilities, numeric-bound violations, and recommended remediations before making code changes.

## Scope

- Primary: `ai-platform/server/lib/hsm-adapter/dkg-snark-engine.cjs`
- Secondary: persistence stores, serializers, `keyring-serializer.cjs`, and any modules that persist SNARK-related numeric data
- Tests: unit tests and integration tests that exercise serialization/persistence paths

## Risk Summary

Provide a short executive summary of identified risks and their potential impact (e.g., out-of-range numeric values causing arithmetic panics, canonicalization mismatches, cross-language decoding errors, or inconsistent BigInt encodings).

## Findings (Template)

For each finding, create a numbered entry with the following fields:

1. Title: Short descriptive title
2. Severity: CRITICAL / HIGH / MEDIUM / LOW
3. Affected component(s): file paths and function names
4. Summary: one-paragraph description
5. Reproduction steps: exact code, test snippet, or sequence to reproduce
6. Evidence: logs, stack traces, sample payloads, or canonicalized JSON
7. Numeric details: offending values, bit-length observed, expected bound
8. Cross-language parity: whether the value decodes consistently in Go/Rust/JS
9. Suggested remediation: code-level fix, tests, and required validations
10. PR/patch: link to remediation PR (leave blank until fix is made)

---

## Numeric Validation Checklist

- [ ] All persisted numeric fields are normalized to canonical BigInt strings with explicit prefixes (e.g., `0x` / `-0x`) before serialization.
- [ ] Ingestion-side numeric bounds checks exist with configurable max bits (env override), rejecting values exceeding the expected curve bit-size.
- [ ] Storage-side guards prevent writing values that exceed the configured guard.
- [ ] Deserialization enforces the same numeric parsing rules and rejects ambiguous encodings.
- [ ] Unit tests exist for 0, 1, edge (curve size), +1 bit, and very large fuzzed values.

## Cross-Language Bit-Parity Tracking

Track parity with other runtime implementations to ensure serialized numeric encodings and canonicalization match across languages.

- Go runtime parity: test vector file path and decoding routine to verify that JS-produced `0x` hex strings are parsed identically by Go's big.Int parsing.
- Rust runtime parity: same as above using `num_bigint` or equivalent.
- Canonicalization vector: include sample canonicalized JCS outputs and expected SHA256 evidence IDs.

Suggested fields per parity check:

- Vector name
- Origin (JS/Rust/Go)
- Payload sample (linked file)
- Expected parsed bit-length in each runtime
- Pass/Fail

## Remediation Guidelines

- Prefer constructor/injection-based guard configuration (same pattern used for `PartialShareProofManager`) so tests can override guard values.
- Fail-fast on numeric parse/overflow with clear audit logs and tamper alerts.
- Add end-to-end tests that write, read, and validate persisted SNARK artifacts using the canonicalizer.

## Tests to Add

- Unit: `dkg-snark-engine` serialization/deserialization round-trip with BigInt edge cases.
- Integration: persist and reload transcripts via the same persistence adapter used in production.
- Fuzz: feed randomized large numeric values to serializer and assert rejection or safe truncation as defined by policy.

## Timeline & Actions

- Audit pass started: 2026-08-03
- Expected remediation PR(s): list with links

## Notes / References

- RFC 8785 JCS canonicalization notes
- Existing `proofs.cjs` numeric guard implementation (reference)
- Cross-language parsing examples (to be filled during audit)
