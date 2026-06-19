-- Token Authentication System Schema (TAS-1.0)
-- Flat capability mesh for device keys, access tokens, sessions, and recovery factors.

-- Accounts: immutable root of identity
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_type TEXT NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal', 'team', 'enterprise')),
    features TEXT[] NOT NULL DEFAULT '{}',
    max_devices INT NOT NULL DEFAULT 5,
    public_key TEXT NOT NULL,               -- Ed25519 public key (hex)
    previous_keys TEXT[] DEFAULT '{}',        -- Rotated public keys (grace period)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'recovering')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts (status);

-- Access Tokens: JWT assertions of identity and capability
CREATE TABLE IF NOT EXISTS access_tokens (
    jti TEXT PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    identity_type TEXT NOT NULL DEFAULT 'account' CHECK (identity_type IN ('account', 'email', 'anonymous')),
    features TEXT[] NOT NULL DEFAULT '{}',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_account ON access_tokens (account_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_expires ON access_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_access_tokens_revoked ON access_tokens (revoked_at) WHERE revoked_at IS NOT NULL;

-- Session Tokens: short-lived bearer tokens
CREATE TABLE IF NOT EXISTS session_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token_jti TEXT NOT NULL REFERENCES access_tokens(jti) ON DELETE CASCADE,
    device_key_id UUID REFERENCES device_keys(id) ON DELETE SET NULL,
    scope TEXT NOT NULL DEFAULT 'read' CHECK (scope IN ('read', 'write', 'admin')),
    ip_address INET,
    user_agent TEXT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    refreshed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_session_tokens_access_jti ON session_tokens (access_token_jti);
CREATE INDEX IF NOT EXISTS idx_session_tokens_expires ON session_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_session_tokens_revoked ON session_tokens (revoked_at) WHERE revoked_at IS NOT NULL;

-- Refresh Tokens: opaque rotating tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    session_token_id UUID REFERENCES session_tokens(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,               -- Argon2id hash of the opaque token
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ                     -- Prevents replay
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_account ON refresh_tokens (account_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- Device Keys: per-device cryptographic credentials
CREATE TABLE IF NOT EXISTS device_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,               -- Ed25519 or WebAuthn public key (base64/hex)
    key_type TEXT NOT NULL DEFAULT 'ed25519' CHECK (key_type IN ('ed25519', 'webauthn')),
    trust_level TEXT NOT NULL DEFAULT 'untrusted' CHECK (trust_level IN ('untrusted', 'trusted', 'hardware')),
    device_name TEXT,
    device_fingerprint TEXT,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_device_keys_account ON device_keys (account_id);
CREATE INDEX IF NOT EXISTS idx_device_keys_revoked ON device_keys (revoked_at) WHERE revoked_at IS NOT NULL;

-- Recovery Factors: independent credentials for account recovery
CREATE TABLE IF NOT EXISTS recovery_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    factor_type TEXT NOT NULL CHECK (factor_type IN ('email_otp', 'totp', 'printed_key', 'hardware_key')),
    factor_data TEXT,                      -- Encrypted TOTP secret, or hash of printed key
    verified_at TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_recovery_factors_account ON recovery_factors (account_id);
CREATE INDEX IF NOT EXISTS idx_recovery_factors_enabled ON recovery_factors (enabled) WHERE enabled = true;

-- Recovery Attempts: audit log for recovery flows
CREATE TABLE IF NOT EXISTS recovery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    factor_type TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recovery_attempts_account ON recovery_attempts (account_id);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_challenge ON recovery_attempts (challenge_id);

-- Token Blocklist: Redis-backed in runtime; this is the persistent fallback
CREATE TABLE IF NOT EXISTS token_blocklist (
    jti TEXT PRIMARY KEY,
    token_type TEXT NOT NULL CHECK (token_type IN ('access', 'session')),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_token_blocklist_expires ON token_blocklist (expires_at);

-- Audit Log: all token lifecycle events
CREATE TABLE IF NOT EXISTS token_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'account_created', 'account_rotated', 'account_suspended',
        'access_token_issued', 'access_token_revoked',
        'session_created', 'session_revoked', 'session_refreshed',
        'device_enrolled', 'device_revoked', 'device_rotated',
        'recovery_initiated', 'recovery_verified', 'recovery_completed',
        'recovery_failed', 'blocklist_added'
    )),
    actor TEXT,                             -- device_key_id, session_id, or 'admin'
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_audit_account ON token_audit_log (account_id);
CREATE INDEX IF NOT EXISTS idx_token_audit_event ON token_audit_log (event_type);
CREATE INDEX IF NOT EXISTS idx_token_audit_created ON token_audit_log (created_at DESC);
