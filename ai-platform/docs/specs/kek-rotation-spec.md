# Track 10 Master KEK Rotation Protocol Specification

## 1. Overview

This specification details the mechanism for rotating the Master Key Encryption Key (KEK) protecting a Track 10 (`T10K`) binary keyring envelope. The rotation process allows security operators to cycle keys without re-generating underlying private or secret components.

## 2. Cryptographic Workflow

The `rotateKeyring` mechanism must perform a strict sequence of atomic, non-destructive transitions:

1. **Ingestion & Validation**: Parse the target `T10K` envelope using the current (`oldMasterKek`) value.
2. **Decryption Pass**: Unwrap the inner authenticated content payload using `unwrapPad`.
3. **Re-encryption Pass**: Immediately wrap the resulting application structural map under the new (`newMasterKek`) key domain using `wrapPad`.
4. **Header Compilation**: Assemble a fresh 12-byte canonical binary container header encapsulating the new payload length metrics.

## 3. Proposed API Signature

```cjs
async rotateKeyring(binaryEnvelope, oldMasterKek, newMasterKek)
```

- `binaryEnvelope` — `Buffer` containing a valid T10K envelope.
- `oldMasterKek` — `Buffer` (16, 24, or 32 bytes) used to decrypt the existing envelope.
- `newMasterKek` — `Buffer` (16, 24, or 32 bytes) used to encrypt the new envelope.

Returns a new `Buffer` containing the T10K envelope encrypted with `newMasterKek`.

## 4. Security Considerations

- **Memory Zeroing**: Intermediate plaintext data extracted during the step 2 unwrap sequence must not be retained or cached.
- **Fail-Fast Boundary**: If the initial integrity verification check fails against the `oldMasterKek`, execution must abort immediately before allocating resources for the new container phase.
- **KEK Isolation**: The old and new KEKs must never be present in the same in-process buffer longer than necessary, and neither may be logged.
- **Side-Channel Mitigation**: The re-wrap operation must be constant-time with respect to payload content; the only variable allowed to affect timing is payload size.

## 5. Error Conditions

Failures must map to the same `HsmAdapterError` code space introduced in Enhancement E-02:

| Condition | Code |
|-----------|------|
| `oldMasterKek` or `newMasterKek` is invalid | `INVALID_KEK_LENGTH` |
| `binaryEnvelope` is not a valid T10K envelope | `INVALID_ENVELOPE_BUFFER`, `INVALID_MAGIC`, `UNSUPPORTED_VERSION`, etc. |
| Decryption under `oldMasterKek` fails | `ENVELOPE_INTEGRITY` |
| Re-encryption under `newMasterKek` fails | `EXPORT_FAILED` |
| Result exceeds 10 MiB | `ENVELOPE_TOO_LARGE` |

## 6. References

- `ai-platform/docs/specs/t10k-envelope-spec.md`
- `ai-platform/server/lib/aes-kw.cjs`
- `ai-platform/server/lib/keyring-serializer.cjs`
