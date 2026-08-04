## Track 30: Quantum-Resistant Identity Ratchets & MFA Binding Guard

This PR adds post-quantum identity ratcheting and multi-factor cryptographic binding to the HSM adapter stack.

### Core primitives

- **PqcIdentityRatchet** (`pqc-identity-ratchet.cjs`)
  - Rotates a device chain key using an ML-KEM-style shared secret.
  - Emits `IDENTITY_RATCHET_STEPPED` telemetry.

- **MfaBindingGuard** (`mfa-binding-guard.cjs`)
  - Validates multi-signature MFA tokens for device key migration.
  - Checks device binding, signature count, token expiry, and signature integrity.
  - Emits `MFA_TOKEN_AUTHENTICATED` telemetry.

### Policy integration

- `crypto-policy-schema.json` already defines the `identity` stanza.
- `crypto-policy-engine.cjs` enforces `_validateIdentity` for the `identity` operation.
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
