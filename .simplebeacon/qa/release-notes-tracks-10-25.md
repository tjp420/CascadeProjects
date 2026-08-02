# Master Release Notes: Cryptographic Enhancements (Tracks 10–25)

## Executive Summary

This release introduces an enterprise-grade, defense-in-depth cryptographic overhaul to the `BaseHsmAdapter` ecosystem. The architecture transitions the platform from a single-tenant, static-key design into a multi-tenant, post-quantum-ready, and privacy-preserving security engine.

All tracks share a single, hardened foundation: tenant-scoped key lifecycle methods, centralized `HsmAdapterError` codes, and a policy-gated execution path that rejects non-compliant cryptographic operations before they touch key material.

---

## Core Module Architecture & Capabilities

### 1. Operational Resilience & Lifecycle Management

* **Track 10 (Audit & Rotation):** Introduces asynchronous, structural `try/catch` audit wiring (`_audit`) capturing lifecycle mutations, paired with a cryptographically verified, 50-round master Key Encrypting Key (KEK) rotation protocol.
* **Track 15 (Volatile Memory Purging):** Implements anti-forensic security via an explicit `.zeroize()` runtime layer supporting random, zeros, and both byte-overwriting strategies to clear sensitive key memory buffers from the heap.
* **Track 14 (Dynamic Policy Engine):** Implements an operator-driven JSON-schema policy engine supporting runtime hot-reloading (`CryptoPolicyEngine.reload()`) to enforce algorithm whitelisting and minimum bit-lengths.

### 2. Advanced Cryptographic Paradigms

* **Track 11 & 12 (Asymmetric Pairs & Attestation):** Establishes RSA-OAEP (2048/4096) and ECIES-backed ECDH (P-256/P-384) wrapping pairs, paired with an X.509-style hardware attestation verification routine (`verifyAttestation`).
* **Track 18 (Perfect Forward Secrecy):** Implements a Signal-protocol-inspired dual-ratchet engine (symmetric state ratcheting + secp256k1 ECDH root rotation) managing out-of-order execution queues via a skipped-key cache.
* **Track 20 (Post-Quantum Hybrid KEM):** Delivers long-term data security by multiplexing classical ECDH exchanges with simulated ML-KEM/Kyber-768 primitives into a unified root key via HKDF-SHA256 combining.

### 3. Privacy & Boundary Enforcement

* **Track 13 & 23 (Multi-Tenant Isolation & Escrow Broker):** Implements isolation barriers namespaced by `tenantId : kekId` throwing explicit `UNAUTHORIZED_KEY_ACCESS` errors, coupled with a dual-consent `EscrowBroker` facilitating authorized inter-tenant sharing without scope leakage.
* **Track 16 (Key Provenance Ledger):** Generates an immutable, canonical tamper-evident genesis pedigree record (`ProvenanceProof`) tracking software build hashes, registered tenants, and original hardware tokens.
* **Track 19 & 24 (Homomorphic Masking, Blind Signatures & PIR):** Establishes privacy-preserving state processing via additive BigInt blinding, Chaum RSA blind signing, and a multi-dimensional Private Information Retrieval (PIR) matrix query parser matching rows without database-side plaintext exposure.
* **Track 21 & 22 (ZKP Identity & Secure Time Oracles):** Deploys Schnorr zero-knowledge identification proofs alongside a Byzantine-fault-tolerant, median consensus time oracle engine (`TimeAnchorEngine`) to stop clock-rollback and key-replay attacks.

### 4. FIPS 140-3 & EU AI Act Guardrails

* **Track 25 (Compliance Gating):** Implements an automated Power-On Self-Test (`FipsSelfTestRunner`) executing mandatory Known Answer Tests (KAT) for AES-256 Key Wrap and HKDF-SHA256 matching NIST SP 800-38F and RFC 5869 vectors. Any failure permanently locks the cryptographic boundary.
* **EU AI Act Cyber-security Attestation:** Deploys a real-time `RobustnessTelemetryAgent` recording system anomalies in an append-only, cryptographic log chained via SHA-256 hashes to guarantee tamper evidence under Article 15.

---

## Error Code Reference

The following `HsmAdapterError` codes are emitted across the Tracks 10–25 HSM modules. Engineering teams should map these to observability dashboards, runbooks, and the on-call handbook.

| Code | Domain | Meaning |
|------|--------|---------|
| `ABSTRACT_INSTANTIATION` | `base-adapter.cjs` | `BaseHsmAdapter` was instantiated directly rather than through a concrete subclass. |
| `NOT_INITIALIZED` | `base-adapter.cjs` | A key operation was called before `initialize()` completed. |
| `NOT_IMPLEMENTED` | `base-adapter.cjs` | A concrete subclass did not implement a required abstract hook (`_initialize`, `_createKEK`, `_wrap`, `_unwrap`, `_rotateKEK`, `_listKEKs`, `_zeroize`). |
| `UNAUTHORIZED_KEY_ACCESS` | `base-adapter.cjs`, `crypto-policy-engine.cjs` | A `tenantId` was missing, empty, or not authorized for the requested key. |
| `INVALID_INPUT` | `base-adapter.cjs` | A non-`Buffer` payload was passed to `wrap()` or `unwrap()`. |
| `PKCS11_MISSING` | `softHsmAdapter.cjs` | The `pkcs11js` native module is not installed or unavailable. |
| `TOKEN_NOT_FOUND` | `softHsmAdapter.cjs` | The configured SoftHSM token label was not found on the system. |
| `INIT_FAILURE` | `softHsmAdapter.cjs` | PKCS#11 initialization (load, slot open, login) failed. |
| `KEK_GEN_FAILED` | `softHsmAdapter.cjs` | Token failed to generate a new KEK. |
| `KEK_NOT_FOUND` | `softHsmAdapter.cjs` | A referenced KEK label does not exist on the token. |
| `POLICY_LOAD_FAILED` | `crypto-policy-engine.cjs` | The policy file could not be read, parsed, or reloaded. |
| `POLICY_VIOLATION_BLOCKED` | `crypto-policy-engine.cjs` | The requested algorithm, KEM level, threshold, or token configuration violates the active policy. |
| `INVALID_THRESHOLD` | `crypto-policy-engine.cjs` | A threshold scheme is numerically invalid or out of policy bounds. |
| `ZKP_VERIFICATION_FAILED` | `zk-identity-verifier.cjs` | A Schnorr-style zero-knowledge proof did not verify. |
| `TEMPORAL_DRIFT_BLOCKED` | `base-adapter.cjs`, `time-anchor-engine.cjs` | Local clock drift exceeded the `TimeAnchorEngine` threshold. |
| `FIPS_CRITICAL_FAULT` | `fips-self-test-runner.cjs` | KAT mismatch or initialization error; module execution is locked. |
| `REGULATORY_VIOLATION` | `crypto-policy-engine.cjs` | Request rejected due to FIPS-mode unapproved curve, KEM level, or parameters. |

---

## Engineering Integration & Merge Directives

* **Base Class Consolidation:** The visual 3-way merge of `base-adapter.cjs` must explicitly preserve the `tenantId` first-class method signatures to prevent breaking multi-tenant partitioning across downstream modules. The constructor must retain the audit, eviction, provenance, and policy engines side-by-side.
* **FIPS Wiring:** Adapters that set `fips.enabled: true` in the active policy must trigger `FipsSelfTestRunner.executePowerOnSelfTests()` before entering an operational state. Any subsequent KAT failure must block all HSM operations for the process lifetime.
* **Telemetry Hygiene:** `RobustnessTelemetryAgent` must only persist non-secret metadata. Key material, plaintext, or tenant PII must never enter the chained log.
* **Verification Gateways:** Following the merge, local verification must be asserted by executing the isolated test domains sequentially:

```bash
npx jest hsm-audit asymmetric-adapter multi-tenant-key-isolation crypto-policy-engine secure-zeroize key-provenance threshold session-ratchet homomorphic zkp-identity secure-time blind-pir compliance-gating
```

* **Pre-Landing Checklist:**
  1. Confirm `tenantId` remains a first parameter on `createKEK`, `wrap`, `unwrap`, `rotateKEK`, `listKEKs`, and `zeroize`.
  2. Confirm `_audit` accepts `tenantId` and emits it through `emitAuditEvent` alongside `orgId`, `nodeId`, and `provider`.
  3. Run `node -c ai-platform/server/lib/hsm-adapter/base-adapter.cjs` immediately after resolving the file.
  4. Run the targeted Jest suites above and ensure no `HsmAdapterError` or assertion regressions.
