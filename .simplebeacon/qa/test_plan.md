# Test Plan — Track 42 Enclave Secret-Sealing and Attestation Policy

**Branch:** `feature/track42-enclave-secret-sealing`
**Date:** 2026-08-02
**Status:** Active

## Objective

Implement cryptographic enforcement for sealing secrets inside hardware enclaves, including sealing cipher strength, key rotation, attestation freshness with replay protection, and key provisioning scope limits.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/enclave-secret-sealing-policy.cjs | New — EnclaveSecretSealingPolicy class |
| server/lib/hsm-adapter/crypto-policy-engine.cjs | Added secretSealing policy block + _validateSecretSealing method |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 11 Track 42 counters |
| server/lib/hsm-adapter/__tests__/enclave-secret-sealing-policy.test.cjs | New — 39 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## Policy Enforcement Areas

1. **Sealing Policy**: allowed ciphers, min key bits, max data size, key rotation interval, max key age
2. **Unseal Policy**: block unseal outside enclave boundary
3. **Attestation Policy**: challenge-response with nonce, replay protection, freshness (max age), min TTL
4. **Key Provisioning Policy**: allowed key types, max key age, require attestation, max provisioned keys

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 39 new Track 42 tests pass
- [x] L1.3 79 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 validateSeal accepts valid config
- [x] L2.02 validateSeal rejects bad cipher, small key, oversized data, expired key
- [x] L2.03 validateUnseal blocks outside enclave
- [x] L2.04 generateChallenge produces unique nonces
- [x] L2.05 validateAttestation accepts valid response
- [x] L2.06 validateAttestation rejects missing nonce, replay, expired, short TTL
- [x] L2.07 validateKeyProvisioning accepts valid config
- [x] L2.08 validateKeyProvisioning rejects no attestation, bad key type, max keys
- [x] L2.09 Sealed key tracking (record/remove/count)
- [x] L2.10 Policy overrides work (relaxed cipher, outside unseal, no attestation)
- [x] L2.11 CryptoPolicyEngine validates secretSealing operation

### Level 3 - Security
- [x] L3.01 No secrets exposed
- [x] L3.02 No scope creep
- [x] L3.03 No regression
