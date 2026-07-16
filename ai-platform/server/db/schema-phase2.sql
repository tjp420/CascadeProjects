-- Phase 2 dashboard snapshot storage
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
    key TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_updated_at
    ON dashboard_snapshots (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_key_updated
    ON dashboard_snapshots (key, updated_at DESC);

-- Phase 2 user accounts
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    trust_level TEXT NOT NULL DEFAULT 'bronze',
    status TEXT NOT NULL DEFAULT 'active',
    successful_analyses INT NOT NULL DEFAULT 0,
    security_incidents INT NOT NULL DEFAULT 0,
    community_contributions INT NOT NULL DEFAULT 0,
    verification_status TEXT NOT NULL DEFAULT 'email',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
