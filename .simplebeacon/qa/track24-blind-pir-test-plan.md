# Track 24: Blind Signature Issuance & Homomorphic Private Information Retrieval (PIR)

**Branch target:** `feature/track24-groundwork`  
**Depends on:** `feature/track23-groundwork` (cross-tenant escrow, provenance, and time anchoring)  
**Design status:** Draft  
**Goal:** Extend Track 19 homomorphic masking with a decentralized, zero-knowledge verification layer that lets tenant workers fetch masked rows without revealing query index and lets the HSM sign blinded payloads without seeing the raw hash.

## Core Architectural Objectives

### 1. `BlindSignatureIssuer` (HSM-side + client-side)
A tenant-driven RSA blind signature flow where the HSM signs a blinded message and the client unblinds a fully valid signature.

- **Blind** — Client selects random `r` in `Z_n^*` and computes `m_blind = H(m) * r^e mod n`, where `(n, e)` is the HSM public key and `H` is a full-domain hash (e.g., `sha256` mapped to `Z_n` with rejection sampling or I2OSP padding).
- **Sign** — HSM computes `s_blind = (m_blind)^d mod n` and returns `s_blind`.
- **Unblind** — Client computes `s = s_blind * r^{-1} mod n`.
- **Verify** — Any third party can verify `s^e mod n == H(m)` against the HSM public key.

The HSM never sees `H(m)` or `m`, preserving message anonymity and issuance unlinkability.

### 2. `PirQueryProcessor` (client-side + server-side)
A homomorphic private information retrieval handler that lets a client query a shared encrypted data matrix without revealing which row/column is being requested.

- Client builds an encrypted one-hot selection vector `q = Enc(e_j)` where `e_j` is 1 at the desired index and 0 elsewhere.
- Server computes `result = Σ_i q_i * D_i` over the encrypted data matrix `D` using dot-product accumulation.
- Because the query vector and data rows are homomorphically masked, the server cannot decrypt either the query index or the returned row.
- The result is returned in encrypted form and can be decrypted only by the client.

### 3. Unlinkable Token Audit Trails
Wire blind token and PIR events into the Track 10 / Track 18 `AuditLogger` pipeline.

- `TOKEN_BLIND_SIGNED` — emitted when `BlindSignatureIssuer.sign` completes. Logs `tenantId`, `policyId`, `issuerKeyId`, consensus timestamp, and a public audit hash. **Must not** log `m_blind`, `r`, or `s_blind`.
- `PIR_QUERY_EXECUTED` — emitted when `PirQueryProcessor` returns a masked result. Logs `tenantId`, `matrixId`, `resultSize`, and policy bounds. **Must not** log the query vector, selected index, or plaintext result.

## CryptoPolicyEngine Schema Additions

A new `privacy` policy block should be added to `crypto-policy-engine.cjs` and `crypto-policy-schema.json`:

```js
privacy: {
  blindSignature: {
    publicExponent: 65537,
    minModulusBits: 2048,
    allowedHashFunctions: ['sha256'],
    requireFullDomainHash: true,
  },
  pir: {
    maxRows: 10000,
    maxDimensions: 2,
    maxQuerySizeBytes: 1048576,
    allowedHomomorphicSchemes: ['paillier', 'bfv'],
  },
}
```

`_validatePrivacy()` should enforce:
- `publicExponent` is in an allowed list (e.g., `[3, 65537]`).
- `minModulusBits` is at least the default RSA minimum.
- `pir.maxRows` and `pir.maxQuerySizeBytes` do not exceed tenant bounds.
- The selected homomorphic scheme is in `allowedHomomorphicSchemes`.

## Test Plan Skeleton

### Phase 1 — Groundwork (this branch)
1. Create `blind-signature-issuer.cjs` skeleton with:
   - `blind(hash, publicKey)`
   - `sign(blindMessage, privateKey)`
   - `unblind(blindSignature, r, n)`
   - `verify(message, signature, publicKey)`
2. Create `pir-query-processor.cjs` skeleton with:
   - `createQuery(index, publicKey, matrixRows)`
   - `execute(query, encryptedMatrix)`
   - `decryptResult(encryptedResult, privateKey)`
3. Extend `crypto-policy-engine.cjs` with `privacy` defaults and `_validatePrivacy`.
4. Update `crypto-policy-schema.json` with the `privacy` block.
5. Add unit tests `blind-pir-groundwork.test.cjs` for:
   - Blind/unblind round trip
   - Signature verification against HSM public key
   - Invalid `r` or tampered `m_blind` detection
   - PIR one-hot dot-product selection on a toy matrix
   - Policy rejection of oversized PIR queries

### Phase 2 — Integration
- Integrate `BlindSignatureIssuer` with `base-adapter.cjs` so that `signBlinded` and `verifyUnblinded` are first-class HSM operations.
- Integrate `PirQueryProcessor` with the homomorphic masking engine from Track 19.
- Wire `TOKEN_BLIND_SIGNED` and `PIR_QUERY_EXECUTED` events through `AuditLogger`.
- Add functional end-to-end tests for multi-tenant shared datasets, verifying no tenant can infer another tenant's query index.

### Phase 3 — Regression & Gate
- Run `npx jest blind` and `npx jest pir` suites.
- Run `npx jest hsm-adapter` and `npm run sb:hook:pre-commit`.
- Confirm no new high/critical findings before merging to `feature/track10-aes-kw`.

## Acceptance Criteria

- [ ] `BlindSignatureIssuer` signs and verifies without leaking `H(m)` to the signer.
- [ ] `PirQueryProcessor` returns a single encrypted row without decrypting the query or the dataset.
- [ ] `TOKEN_BLIND_SIGNED` and `PIR_QUERY_EXECUTED` events are emitted and contain no query-specific PII.
- [ ] `CryptoPolicyEngine` rejects out-of-bounds PIR matrices and non-standard blind-signature parameters.
- [ ] All Track 10–Track 23 regression tests continue to pass.

## Risk & Mitigations

- **Risk:** RSA blinding with small `r` or `e` can leak message or break anonymity.  
  **Mitigation:** Enforce `r` in `Z_n^*`, `e = 65537`, and full-domain hashing via `_validatePrivacy`.
- **Risk:** Homomorphic PIR on large matrices becomes computationally expensive.  
  **Mitigation:** `pir.maxRows` and `pir.maxQuerySizeBytes` policy bounds; batch-circuit optimization in Phase 2.
- **Risk:** Audit entries accidentally include blinded material that could be reverse-linked.  
  **Mitigation:** Audit payloads are restricted to non-sensitive identifiers and policy hashes; raw `m_blind` / `r` / query vector are excluded by `AuditLogger` scrub rules.
