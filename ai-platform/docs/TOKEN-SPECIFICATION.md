# Token Architecture Specification (TAS-1.0)

## 1. Overview

This document defines the token hierarchy, lifecycle, and security model for the SimpleBeacon authentication and authorization system. It replaces the legacy 5-layer vertical chain with a flat capability-based mesh that eliminates single points of failure and enables independent revocation at every layer.

---

## 2. Terminology

| Term | Definition |
|------|------------|
| **Account Root** | Immutable registry record. Never transmitted. Used only to sign Access Tokens. |
| **Access Token** | JWT asserting identity choice (account-linked vs. anonymous) and feature entitlements. |
| **Session Token** | Short-lived bearer token (minutes–hours) scoped to a specific Access Token. |
| **Recovery Factor** | Independent credential for account recovery (TOTP, email OTP, or printed recovery key). |
| **Device Key** | Per-device cryptographic credential. Revocable individually. |

---

## 3. Token Hierarchy (Flat Capability Mesh)

```
┌─────────────────────────────────────────────┐
│         Identity Layer (Account Root)        │
│  - Account ID, type, features, billing       │
│  - Immutable; private key held in KMS/HSM      │
└─────────────────────────────────────────────┘
                      ▲
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌────────────┐
│  Access Token │ │  Session │ │  Recovery  │
│  (User scope) │ │  Token   │ │   Factor   │
│  - Identity   │ │  - TTL   │ │  - Offline │
│    binding    │ │  - Scope │ │    escrow  │
└──────────────┘ └──────────┘ └────────────┘
        ▲             ▲
        └─────────────┘
               ▼
      ┌─────────────────┐
│   Device Key Mesh     │
│  - WebAuthn / Ed25519 │
│  - Per-device binding │
│  - Revocable        │
└─────────────────────┘
```

---

## 4. Layer Specifications

### 4.1 Account Root

| Attribute | Value |
|-----------|-------|
| Type | Ed25519 key pair |
| Private key | Stored in HSM / cloud KMS. Never leaves secure enclave. |
| Public key | Published in account registry. |
| Rotation | Manual admin action only. Requires 2-of-N recovery factors. |
| Compromise impact | Critical. Rotation invalidates all Access Tokens. |

### 4.2 Access Token (AT)

**JWT Claims:**

```json
{
  "jti": "at_7f3a9b...",
  "sub": "acct_550e8400-e29b-41d4-a716-446655440000",
  "iat": 1718380800,
  "exp": 1721059200,
  "identity_type": "account|email|anonymous",
  "features": ["scan", "audit", "export", "billing"],
  "account_type": "personal|team|enterprise",
  "max_devices": 5,
  "iss": "simplebeacon.io"
}
```

| Attribute | Description |
|-----------|-------------|
| `jti` | Unique token ID for revocation lists |
| `sub` | Account UUID (immutable) |
| `identity_type` | How the user chose to identify |
| `features` | Capability array (account-type derived) |
| `max_devices` | Ceiling for Device Key registrations |
| TTL | 30–90 days (configurable by account type) |

### 4.3 Session Token (ST)

**Opaque or JWT. Recommended: opaque for server-side revocation agility.**

| Attribute | Description |
|-----------|-------------|
| `session_id` | UUID |
| `access_token_jti` | Parent Access Token |
| `device_key_id` | Which device originated the session |
| `scope` | `read`, `write`, `admin` |
| `ip_binding` | Optional IP/CIDR whitelist |
| TTL | 15 min sliding window (default) |
| Refresh | Yes, via `/auth/refresh` with rotating refresh token |

### 4.4 Recovery Factor (RF)

| Type | Mechanism | Use case |
|------|-----------|----------|
| Email OTP | 6-digit code, 10-min TTL | Standard recovery |
| TOTP | RFC 6238 | Authenticator app backup |
| Printed Key | 24-word BIP-39 phrase | Offline cold storage |
| Hardware Key | YubiKey / SoloKeys | High-security accounts |

**Rules:**
- Minimum 2 factors must be registered before account activation.
- Any single factor can initiate recovery; 2-of-N required to complete.
- Factors are independent — rotating one does not invalidate others.

### 4.5 Device Key (DK)

| Attribute | Description |
|-----------|-------------|
| `device_key_id` | UUID |
| `public_key` | Ed25519 or WebAuthn public key |
| `created_at` | Timestamp |
| `last_seen` | Timestamp |
| `trust_level` | `untrusted|trusted|hardware` |

**Enrollment flow:**
1. Authenticate with Access Token + Recovery Factor (one-time).
2. Generate key pair on device (private key never leaves device).
3. Register public key with account registry.
4. Device Key is now a standalone authentication factor for that device.

---

## 5. Authentication Flows

### 5.1 Normal Login (Device Key → Session)

```
Client                              Server
  │ ── POST /auth/device-challenge ──►│
  │         { device_key_id }         │
  │◄──────── { challenge_nonce } ────│
  │                                   │
  │ ── POST /auth/device-verify ────►│
  │    { device_key_id, signature }   │
  │◄──────── { access_token,          │
  │            refresh_token,          │
  │            session_token } ───────│
```

### 5.2 New Device Enrollment

```
Client                              Server
  │ ── POST /auth/recover-init ─────►│
  │         { account_id,            │
  │           recovery_factor_type }   │
  │◄──────── { recovery_challenge } ─│
  │                                   │
  │ ── POST /auth/recover-verify ───►│
  │    { recovery_challenge,        │
  │      otp / signature }           │
  │◄──────── { enrollment_ticket } ─│
  │                                   │
  │ ── POST /auth/enroll-device ───►│
  │    { enrollment_ticket,          │
  │      device_public_key }          │
  │◄──────── { device_key_id } ────│
```

### 5.3 Account Recovery (Lost All Device Keys)

1. User provides 2 Recovery Factors.
2. Server issues temporary Access Token (TTL: 1 hour, scope: `recovery`).
3. User enrolls new Device Key(s).
4. Old Device Keys are revoked in bulk.
5. Normal Access Token is reissued.

---

## 6. Revocation Strategy

| Token Type | Revocation Method | Cascade Impact |
|------------|-------------------|--------------|
| Account Root | Admin action + 2-of-N Recovery Factors | Invalidates ALL tokens. Emergency only. |
| Access Token | Add `jti` to blocklist | Invalidates child Session Tokens. Device Keys remain valid. |
| Session Token | Redis TTL expiry or explicit delete | None. Independent. |
| Recovery Factor | Mark disabled in registry | None. Other factors remain active. |
| Device Key | Mark revoked in registry | Active sessions from that device are terminated. |

**Blocklist storage:** Redis SET with TTL matching Access Token expiry. Checked on every authenticated request.

---

## 7. Key Rotation Protocol

### 7.1 Account Root Key Rotation

1. Generate new Ed25519 key pair in HSM.
2. Sign new Access Tokens with new key.
3. Maintain old public key in `previous_keys` array for 24 hours (graceful transition).
4. After grace period, destroy old private key.

### 7.2 Device Key Rotation

1. User authenticates with current Device Key.
2. New key pair generated on device.
3. New public key registered; old key revoked.
4. No impact on other Device Keys or Access Tokens.

### 7.3 Access Token Rotation

- Automatic on refresh.
- Old `jti` added to blocklist with TTL = new token TTL.
- Prevents replay of stolen tokens within the window.

---

## 8. Threat Model & Mitigations

| Threat | Mitigation |
|--------|------------|
| Stolen Device Key | Revoke single key. Attacker cannot recover account without second factor. |
| Stolen Access Token | Short TTL + blocklist. Session hijacking limited to token lifetime. |
| Stolen Session Token | 15-min TTL. Attacker cannot rotate or recover without Device Key. |
| Database breach | No plaintext secrets stored. Passwords hashed with Argon2id. Keys are public-only in DB. |
| Phishing (fake login) | WebAuthn / FIDO2 prevents credential replay on phishing domains. |
| Lost all factors | Printed Recovery Key or hardware backup required at enrollment. |

---

## 9. Implementation Checklist

- [ ] KMS/HSM integration for Account Root private key
- [ ] JWT library with Ed25519 support (`jose`, `PyJWT`, etc.)
- [ ] Redis blocklist for Access Token revocation
- [ ] WebAuthn server implementation (or Ed25519 challenge-response)
- [ ] TOTP library for Recovery Factor
- [ ] Argon2id for any password-derived secrets
- [ ] Audit logging for all token lifecycle events
- [ ] Rate limiting on `/auth/*` endpoints
- [ ] Monotonic `iat` checks to prevent clock-skew replay

---

## 10. Migration from Legacy 5-Layer Model

| Legacy Token | New Token | Migration Action |
|--------------|-----------|----------------|
| Account Token | Account Root | Extract public key. Generate new Ed25519 key pair in KMS. |
| User Token | Access Token | Issue JWTs with `identity_type` claim. |
| Time Token | Session Token + Subscription Claims | Split into `exp` (session) and `plan_expiry` (subscription). |
| Email Token | Recovery Factor | Register email as TOTP/OTP recovery factor. |
| Tokenkey Token | Device Key | Migrate USB-stored keys to WebAuthn or Ed25519 device keys. |

---

## 11. References

- RFC 7519: JSON Web Token (JWT)
- RFC 6238: TOTP: Time-Based One-Time Password Algorithm
- FIDO2 / WebAuthn Specification
- NIST SP 800-63B: Digital Identity Guidelines

---

*Document version: 1.0.0*
*Last updated: 2026-06-14*
