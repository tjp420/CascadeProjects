# Test Plan — Track 41 Hardware Enclave Route Integration

**Branch:** `feature/track41-hardware-enclave-isolation`
**Date:** 2026-08-02
**Status:** Active

## Objective

Mount the existing HardwareEnclaveAdapter (Track 41) into hsm-vault-routes.cjs to expose enclave operations (initialize, seal, unseal, provision-key, attestation verify/clear-cache) through REST endpoints with admin:all authorization gating.

## Change Set

| File | Change |
|------|--------|
| server/lib/hsm-adapter/base-adapter.cjs | Added registerHardwareEnclaveAdapter/getHardwareEnclaveAdapter registry + exports |
| server/lib/hsm-adapter/hsm-metrics.cjs | Added 10 enclave counters (bootstrap, seal, unseal, key provision, attestation) |
| server/routes/hsm-vault-routes.cjs | Added 7 REST endpoints for enclave operations |
| server/lib/__tests__/hsm-vault-enclave-routes.test.cjs | New — 32 tests |
| .simplebeacon/qa/test_plan.md | Updated |
| .simplebeacon/qa/software_health_report.md | Updated |

## 7 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/vault/enclave/status | Enclave state + 10 telemetry counters |
| POST | /api/vault/enclave/initialize | Initialize enclave with attestation document |
| POST | /api/vault/enclave/seal | Seal plaintext inside enclave boundary |
| POST | /api/vault/enclave/unseal | Unseal ciphertext inside enclave boundary |
| POST | /api/vault/enclave/provision-key | Provision key after attestation (201) |
| GET | /api/vault/enclave/attestation/verify | Check if measurement is verified & cached |
| POST | /api/vault/enclave/attestation/clear-cache | Clear attestation cache |

## Check Items

### Level 1 - Deterministic
- [x] L1.1 node -c all modified JS files - PASS
- [x] L1.2 32 new enclave route tests pass
- [x] L1.3 61 existing tests pass (no regression)
- [x] L1.4 No new dependencies

### Level 2 - Functional
- [x] L2.01 GET /enclave/status returns registered state + counters
- [x] L2.02 POST /enclave/initialize accepts attestation document
- [x] L2.03 POST /enclave/initialize rejects untrusted authority (403)
- [x] L2.04 POST /enclave/initialize rejects untrusted measurement (403)
- [x] L2.05 POST /enclave/seal seals plaintext after init
- [x] L2.06 POST /enclave/seal returns 409 when not initialized
- [x] L2.07 POST /enclave/unseal round-trips ciphertext to plaintext
- [x] L2.08 POST /enclave/provision-key returns 201 with keyId
- [x] L2.09 GET /enclave/attestation/verify checks cache
- [x] L2.10 POST /enclave/attestation/clear-cache clears cache
- [x] L2.11 All endpoints return 503 when no adapter registered
- [x] L2.12 All endpoints return 403 for non-admin users

### Level 3 - Security
- [x] L3.01 All 7 endpoints gated by admin:all authorization
- [x] L3.02 No secrets exposed in responses
- [x] L3.03 No scope creep
- [x] L3.04 No regression
