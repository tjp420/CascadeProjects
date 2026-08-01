# T10K Authenticated Keyring Envelope Specification

> Version 1.0 — Track 10

## 1. Normative references

- **NIST SP 800-38F** — *Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping*
- **RFC 3394** — *Advanced Encryption Standard (AES) Key Wrap Algorithm*
- **RFC 5649** — *Advanced Encryption Standard (AES) Key Wrap with Padding Algorithm*
- **RFC 8259** — *The JavaScript Object Notation (JSON) Data Interchange Format*
- **FIPS 197** — *Advanced Encryption Standard (AES)*

This document describes the `T10K` binary container used by `keyring-serializer.cjs` and consumed by the `BaseHsmAdapter` `exportKeyring` / `importKeyring` methods.

## 2. Byte-level envelope map

A T10K envelope is a single contiguous `Buffer`/`Uint8Array` with a fixed 12-byte cleartext header followed by an AES-KWP ciphertext body.

```
+----------+-----------+---------+-------------+------------------+
| Magic    | Version   | Flags   | Body length | AES-KWP body     |
| 4 bytes  | 2 bytes   | 2 bytes | 4 bytes     | N bytes          |
+----------+-----------+---------+-------------+------------------+
0          4           6         8            12                12+N
```

| Field | Offset | Size | Value / Semantics |
|-------|--------|------|-------------------|
| `Magic` | 0 | 4 | `0x54 0x31 0x30 0x4B` (`"T10K"` in US-ASCII) |
| `Version` | 4 | 2 | Big-endian unsigned 16-bit integer. Current value `0x0001` |
| `Flags` | 6 | 2 | Big-endian unsigned 16-bit integer. Reserved bitmask; must be `0x0000` in v1 |
| `Body length` | 8 | 4 | Big-endian unsigned 32-bit integer. Length of the AES-KWP ciphertext (`N`) |
| `AES-KWP body` | 12 | N | RFC 5649 `wrapPad` output over the UTF-8 JSON payload |

### Constraints

- Minimum envelope size: 13 bytes (12-byte header + at least 1-byte KWP payload).
- Maximum envelope size: 10 MiB (`10 * 1024 * 1024` bytes).
- `Body length` must exactly equal the number of bytes from offset 12 to the end of the envelope.
- The `Flags` field is reserved; non-zero values are rejected by v1 consumers.

## 3. Serialization algorithm

```text
Input:
  keyringData — a JSON-serializable object
  kek         — a Buffer of 16, 24, or 32 bytes

Output:
  envelope    — a Buffer containing the T10K container

Steps:
  1. Assert keyringData is a non-null object and kek is a valid-length Buffer.
  2. plaintext = Buffer.from(JSON.stringify(keyringData), 'utf8')
  3. encryptedBody = aesKwpWrapPad(kek, plaintext)
  4. header = Buffer.alloc(12)
       header[0..3]   = 0x54 0x31 0x30 0x4B
       header[4..5]   = 0x0001 (big-endian)
       header[6..7]   = 0x0000
       header[8..11]  = encryptedBody.length (big-endian)
  5. envelope = header || encryptedBody
  6. if envelope.length > 10 MiB, fail.
  7. return envelope
```

### Canonical keyring payload shape

The payload is not required to match a fixed schema, but consumers such as `BaseHsmAdapter` expect the following shape:

```json
{
  "algorithm": "X25519+ML-KEM-768",
  "keyringId": "rt-123",
  "createdAt": "2026-08-01T00:00:00.000Z",
  "keyCount": 2,
  "keys": [
    { "id": "key-active",   "alg": "X25519", "data": "<base64>" },
    { "id": "key-previous", "alg": "X25519", "data": "<base64>" }
  ]
}
```

All binary key material must be encoded as base64 strings before serialization; raw `Buffer` objects are not JSON-safe.

## 4. Deserialization and integrity verification

```text
Input:
  envelope — a Buffer
  kek      — a Buffer of 16, 24, or 32 bytes

Output:
  keyringData — the reconstituted JSON object

Steps:
  1. Assert envelope is a Buffer and kek is a valid-length Buffer.
  2. Assert envelope.length >= 12.
  3. Assert envelope[0..3] == 0x54 0x31 0x30 0x4B.
  4. version = envelope.readUInt16BE(4)
     Assert version == 1.
  5. flags = envelope.readUInt16BE(6)
     Assert flags == 0.
  6. bodyLength = envelope.readUInt32BE(8)
     Assert envelope.length == 12 + bodyLength.
  7. encryptedBody = envelope.subarray(12)
  8. plaintext = aesKwpUnwrapPad(kek, encryptedBody)
     This step provides both decryption and integrity protection via the
     AES-KWP implicit ICV / padding checks.
  9. return JSON.parse(plaintext.toString('utf8'))
```

Any failure at step 7 or 8 must be treated as an integrity failure; the caller must not expose whether the failure was due to a bad KEK, a corrupted ciphertext, or an invalid padding structure.

## 5. Error conditions and codes

`keyring-serializer.cjs` throws a `KeyringValidationError` with the following message patterns. `BaseHsmAdapter` wraps these as generic `Error` instances with a `HSM Export/Import pipeline failure` prefix; callers may unwrap the inner `message` for diagnostics.

| Condition | Throws | Notes |
|-----------|--------|-------|
| `keyringData` is not an object | `KeyringValidationError` | `Invalid dataset payload provided for serialization.` |
| `kek` is missing or not a `Buffer` | `KeyringValidationError` | `KEK must be a Buffer.` |
| `kek.length` is not 16, 24, or 32 | `KeyringValidationError` | `Invalid KEK length. Must be 128, 192, or 256 bits.` |
| Serialized output exceeds 10 MiB | `KeyringValidationError` | `Serialized payload exceeds strict structural safety limits ...` |
| `envelope` is not a `Buffer` | `KeyringValidationError` | `Target dataset for parsing must evaluate as a valid structural Buffer object.` |
| `envelope.length < 12` | `KeyringValidationError` | `Malformed input stream: Header chunk length is under threshold limits.` |
| Magic mismatch | `KeyringValidationError` | `Malformed dataset envelope: Unrecognized signature magic marker flags.` |
| Version mismatch | `KeyringValidationError` | `Unsupported envelope version registry parsed: ...` |
| Body size mismatch | `KeyringValidationError` | `Envelope body size alignment mismatch error condition detected.` |
| KWP unwrap / padding / JSON failure | `KeyringValidationError` | `Cryptographic envelope unpacking failed structural integrity verification passes: ...` |

### Future mapping

`BaseHsmAdapter` consumers that need machine-readable codes should map serializer failures to `HsmAdapterError` codes:

```text
EXPORT_FAILED, IMPORT_FAILED, INVALID_KEYRING, INVALID_KEK,
ENVELOPE_INTEGRITY, VERSION_MISMATCH, UNSUPPORTED_VERSION
```

This mapping is currently tracked as **Enhancement E-02** in `.simplebeacon/qa/software_health_report.md`.

## 6. KEK requirements

A Master KEK must be a uniformly random byte string with one of the following lengths:

| Key length | AES key size | Allowed? |
|------------|--------------|----------|
| 16 bytes | AES-128 | Yes |
| 24 bytes | AES-192 | Yes |
| 32 bytes | AES-256 | Yes |

KEKs are never serialized or stored inside the T10K envelope. The T10K format is key-agnostic: the same `wrapPad`/`unwrapPad` primitive is used for 128-, 192-, and 256-bit KEKs.

## 7. Migration notes

The T10K format replaces the legacy Track 10 wrapped-blob layout:

```text
[version:1][kekIdLen:1][kekId:N][wrapDate:8][checksum:32][wrapped:...]
```

Legacy blobs used a combination of JSON serialization, a SHA-256 checksum, PKCS#7-style padding, and per-`kekId` AES-KW wrapping. T10K removes the checksum in favor of the AES-KWP authentication tag and does not embed `kekId` or `wrapDate` in the header.

### Operations-team re-wrap procedure

Because legacy blobs are encrypted with the original per-KEK master key, an automated offline migration is not possible. To migrate an existing legacy blob:

1. Acquire the original `kekId` and its associated KEK from the HSM provider.
2. Call the legacy `unwrapKeyring(blob, allowedKekIds)` to obtain the plaintext keyring object.
3. Generate or select a new Master KEK for the T10K envelope.
4. Call `exportKeyring(keyring, newMasterKek)` to produce the T10K envelope.
5. Securely destroy the legacy blob and the plaintext intermediate.

All re-wrap operations must be performed inside a live, authenticated HSM session; the KEK itself must never be exported to application memory except inside a trusted adapter.

## 8. Appendix — test vectors and benchmark baselines

### Reference vectors

The implementation is validated against:

- 6 RFC 3394 AES-KW vectors in `server/lib/__tests__/vectors/aes-kw-vectors.cjs`
- 2 RFC 5649 AES-KWP vectors in the same file
- 16 `keyring-serializer` round-trip and integrity tests
- 26 `hsm-adapter` lifecycle and export/import tests

### Performance baselines

Observed on the reference Node 22 runtime, 10,000 iterations per case:

| Operation | Payload / KEK | µs/op | ops/sec |
|-----------|---------------|-------|---------|
| AES-KW wrap | 256-bit key, 256-bit KEK | 83.3 | 12,010 |
| AES-KW unwrap | 256-bit key, 256-bit KEK | 85.2 | 11,732 |
| AES-KWP wrap | 20-octet payload, 192-bit KEK | 65.5 | 15,272 |
| AES-KWP wrap | 7-octet payload, 192-bit KEK | 3.9 | 255,150 |
| T10K keyring wrap | Typical 2-key keyring, 256-bit KEK | ~107 | ~9,300 |

These numbers are intended as a baseline for future SLA definitions; no explicit threshold is currently in force.
