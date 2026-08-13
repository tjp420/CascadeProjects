-- Simplebeacon Cloud Teams — subscription columns and scan history

ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_token TEXT;

CREATE INDEX IF NOT EXISTS idx_users_api_token ON users (api_token) WHERE api_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS scan_history (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    scan_results JSONB NOT NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_history_user_scanned
    ON scan_history (user_id, scanned_at DESC);

-- Monthly scan counter for free-tier paywall enforcement
CREATE TABLE IF NOT EXISTS scan_counts (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_bucket DATE NOT NULL,
    scan_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, month_bucket)
);
