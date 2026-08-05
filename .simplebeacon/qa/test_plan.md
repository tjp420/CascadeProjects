# Test Plan: Hardware Attestation Chain Validation

> Extend hardware-attestation-verify.cjs from parsing standalone raw binary reports
> to validating a complete cryptographically pinned certificate chain (AMD ASK/ARK
> and Intel Enclave CA chains).

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Certificate chain validation, root-of-trust pinning, ECDSA signature verification |
| Author (Builder) | Devin |
| Date | 2026-08-04 |
| Branch | feat/attestation-chain-validation |
| Packages touched | ai-platform/server/lib/hsm-adapter |

## Problem

The current `HardwareAttestationVerifier` parses binary attestation reports (SEV-SNP, SGX)
and validates nonce, timestamp, and measurement fields. However:

1. **Signature verification is mock-only** — uses HMAC-SHA256 with a hardcoded secret, not real ECDSA
2. **No X.509 certificate chain validation** — no parsing of AMD VCEK/ASK/ARK or Intel PCK/CA certificates
3. **No root-of-trust pinning** — no mechanism to pin vendor CA certificates
4. **No certificate revocation checking** — no CRL/OCSP handling
5. **No certificate fetching** — no code to retrieve VCEK from AMD KDS or PCK from Intel PCS

## Objectives

### 1. Certificate Chain Validator (`server/lib/hsm-adapter/cert-chain-validator.cjs`)

New module for X.509 certificate chain validation using Node.js native `crypto.X509Certificate`:

- **CERT-01**: `CertChainValidator` class with `validateChain()`, `addRootCA()`, `addIntermediateCA()` methods
- **CERT-02**: Parse PEM/DER certificates using `crypto.X509Certificate` (Node 22+ native)
- **CERT-03**: Build certificate chain from leaf to root
- **CERT-04**: Validate chain signatures (each cert signed by next in chain)
- **CERT-05**: Validate certificate validity periods (notBefore/notAfter)
- **CERT-06**: Validate key usage and extended key usage extensions
- **CERT-07**: Root-of-trust pinning by SHA-256 fingerprint
- **CERT-08**: Certificate revocation checking via CRL (basic)
- **CERT-09**: `validateSevSnpChain()` — validate AMD ARK → ASK → VCEK chain
- **CERT-10**: `validateSgxChain()` — validate Intel Root CA → PCK CA → PCK chain
- **CERT-11**: Return detailed validation result with chain structure and failure reasons
- **CERT-12**: Backward compatible — works without chain validation when no CAs configured

### 2. ECDSA Signature Verification (`server/lib/hsm-adapter/hardware-attestation-verify.cjs`)

Replace mock HMAC-SHA256 with real ECDSA signature verification:

- **ECDSA-01**: `verifySevSnpSignature()` — ECDSA P-384/SHA-384 signature verification
- **ECDSA-02**: `verifySgxSignature()` — ECDSA P-256/SHA-256 signature verification
- **ECDSA-03**: Extract public key from VCEK/PCK certificate
- **ECDSA-04**: Verify attestation report signature against certificate public key
- **ECDSA-05**: Fall back to mock verification when no certificate provided (backward compat)
- **ECDSA-06**: SIEM alert on signature verification failure with certificate details

### 3. Root-of-Trust Store (`server/lib/hsm-adapter/root-trust-store.cjs`)

New module for managing pinned vendor root certificates:

- **ROOT-01**: `RootTrustStore` class with `addAMD()`, `addIntel()`, `getCA()`, `isPinned()` methods
- **ROOT-02**: Load AMD ARK root certificate (pinned by SHA-256 fingerprint)
- **ROOT-03**: Load AMD ASK intermediate certificate
- **ROOT-04**: Load Intel Root CA certificate (pinned by SHA-256 fingerprint)
- **ROOT-05**: Load Intel PCK CA intermediate certificate
- **ROOT-06**: Environment variable configuration (`AMD_ARK_CERT_PATH`, `AMD_ASK_CERT_PATH`, `INTEL_ROOT_CA_PATH`, `INTEL_PCK_CA_PATH`)
- **ROOT-07**: In-memory cache with file path loading
- **ROOT-08**: Fingerprint verification on load (fail-closed if fingerprint mismatch)

### 4. Integration into HardwareAttestationVerifier

Wire chain validation into the existing verification flow:

- **INTEG-01**: Add `certChainValidator` option to `HardwareAttestationVerifier` constructor
- **INTEG-02**: Add `rootTrustStore` option to constructor
- **INTEG-03**: After measurement validation, validate certificate chain if provided
- **INTEG-04**: After chain validation, verify report signature against certificate public key
- **INTEG-05**: New error code: `ATTESTATION_CHAIN_INVALID`
- **INTEG-06**: New error code: `ATTESTATION_ROOT_UNTRUSTED`
- **INTEG-07**: SIEM alerts for chain validation failures
- **INTEG-08**: Backward compatible — existing tests pass without chain validation

### 5. Tests

- **TEST-01**: CertChainValidator unit tests (parsing, chain building, signature validation, expiry, key usage, pinning)
- **TEST-02**: RootTrustStore unit tests (loading, fingerprint verification, env var config)
- **TEST-03**: ECDSA signature verification tests (SEV-SNP P-384, SGX P-256)
- **TEST-04**: Integration tests (full chain validation flow in HardwareAttestationVerifier)
- **TEST-05**: Backward compatibility tests (existing tests pass without chain config)
- **TEST-06**: SIEM alert tests for chain validation failures

## Files to Touch

| File | Change | New? |
|------|--------|------|
| `server/lib/hsm-adapter/cert-chain-validator.cjs` | New X.509 chain validator | Yes |
| `server/lib/hsm-adapter/root-trust-store.cjs` | New root-of-trust store | Yes |
| `server/lib/hsm-adapter/hardware-attestation-verify.cjs` | Add ECDSA verification + chain integration | No |
| `server/lib/hsm-adapter/__tests__/cert-chain-validator.test.cjs` | Unit tests | Yes |
| `server/lib/hsm-adapter/__tests__/root-trust-store.test.cjs` | Unit tests | Yes |
| `server/lib/hsm-adapter/__tests__/attestation-chain-integration.test.cjs` | Integration tests | Yes |

## Level 1 Verification

```powershell
node -c server/lib/hsm-adapter/cert-chain-validator.cjs
node -c server/lib/hsm-adapter/root-trust-store.cjs
node -c server/lib/hsm-adapter/hardware-attestation-verify.cjs
cd ai-platform && npx jest server/lib/hsm-adapter/__tests__/cert-chain-validator.test.cjs --no-coverage
cd ai-platform && npx jest server/lib/hsm-adapter/__tests__/root-trust-store.test.cjs --no-coverage
cd ai-platform && npx jest server/lib/hsm-adapter/__tests__/attestation-chain-integration.test.cjs --no-coverage
cd ai-platform && npx jest server/lib/hsm-adapter/__tests__/hardware-attestation.test.cjs --no-coverage
cd ai-platform && npx jest server/lib/hsm-adapter/__tests__/hardware-attestation-hw-profiles.test.cjs --no-coverage
```

## Security Invariants

1. **Fail-closed**: No chain validation = no attestation acceptance (when configured)
2. **Pinned roots only**: Unpinned root certificates are rejected
3. **No silent fallback**: Chain validation failure = attestation failure + SIEM alert
4. **Backward compatible**: Without chain config, existing mock verification still works
5. **No raw key material on wire**: Only certificates and fingerprints exchanged
6. **Certificate expiry enforced**: Expired certificates are rejected
