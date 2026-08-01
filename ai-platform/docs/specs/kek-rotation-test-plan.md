# Master KEK Rotation Test Plan

## 1. Core Verification Matrices

The test suite for the rotation sub-system must explicitly execute:

- **Happy Path Transitions**: Verification of successful `128 -> 256`, `256 -> 192`, and `256 -> 256` bit-length key rotations.
- **Data Integrity Round-Trips**: Asserting that a deserialized post-rotation envelope exactly equals the initial pre-rotation plaintext map structure.
- **Invalid Origin Rejection**: Asserting that supplying an incorrect `oldMasterKek` causes a safe, immediate abort with a structured `ENVELOPE_INTEGRITY` error profile.
- **Malformed New KEK Abort**: Asserting that a misaligned or unsupported bit-length for the `newMasterKek` halts operation before mutating any source envelopes.

## 2. Edge Cases

- **Same KEK rotation**: `oldMasterKek` and `newMasterKek` are identical; output must be a valid, re-wrapped envelope with the same effective key.
- **Minimum and maximum payload sizes**: Rotation of a 1-byte JSON payload and a payload near the 10 MiB ceiling.
- **Tampered source envelope**: Modifying the T10K ciphertext before rotation must fail before any re-encryption.
- **Wrong T10K magic / version / size**: Header-level corruption must fail with the corresponding serializer error code.

## 3. Commands

```bash
cd ai-platform
npx jest --config jest.config.cjs kek-rotation
```

## 4. Verification levels

| ID | Item | Level | Owner |
|----|------|-------|-------|
| L1-1 | `rotateKeyring` exists and returns a Buffer | L1 | Builder |
| L1-2 | All happy-path bit-length transitions pass | L1 | Builder |
| L1-3 | Wrong `oldMasterKek` throws `HsmAdapterError` with `ENVELOPE_INTEGRITY` | L1 | Builder |
| L1-4 | Invalid `newMasterKek` length throws before any source mutation | L1 | Builder |
| L2-1 | Manual `Buffer` zeroing is not observable in retained memory | L2 | Validator |
| L3-1 | No scope creep beyond re-wrap; no new modules introduced | L3 | Validator |
