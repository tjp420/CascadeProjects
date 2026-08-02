## Track 30: Quantum-Resistant Identity Ratchets

This PR adds a forward-secure, post-quantum identity rotation system with multi-factor cryptographic binding.

### Core primitives

- **PqcIdentityRatchet** (`pqc-identity-ratchet.cjs`)
  - Hybrid ML-KEM forward-secure chain key derivation.
  - Enforces `kemLevel`, `scheme`, `maxSkipped`, and `sessionExpiryMs`.
  - Emits `IDENTITY_RATCHET_STEPPED` telemetry.

- **MfaBindingGuard** (`mfa-binding-guard.cjs`)
  - Multi-signature authentication validation.
  - Enforces `minMfaSignatures`, `mfaTokenExpiryMs`, and allowed signer lists.
  - Emits `MFA_TOKEN_AUTHENTICATED` telemetry.

### Policy integration

- `crypto-policy-schema.json` now defines the `identity` stanza.
- `crypto-policy-engine.cjs` enforces `_validateIdentity` for `operation === 'identity'`.
- `base-adapter.cjs` adds `emitIdentityRatchetStepped` and `emitMfaTokenAuthenticated` hooks.

### Verification

```bash
cd ai-platform
npx jest identity-ratchet
```

```text
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

```bash
npm run sb:hook:pre-commit
```

```text
Gate: PASS
Critical: 0  High: 0  Medium: 0  Low: 5
```
