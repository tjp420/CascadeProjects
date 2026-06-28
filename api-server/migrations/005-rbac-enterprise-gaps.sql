-- SimpleBeacon Enterprise RBAC — Schema Gap Fill
-- Migration: 005
-- PostgreSQL 15+
-- Adds missing columns from SIMPLEBEACON_2_0_ENTERPRISE_RBAC.md design.

-- ── Users: missing auth fields ───────────────────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_login_ip INET,
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);

-- Note: users.auth_provider already exists ('local', 'saml', 'oidc', ...)
--       users.external_id already maps to sso_subject
--       users.mfa_secret can hold the encrypted TOTP secret

-- ── Workspaces: missing gate policy & scheduling ──────────────────────────────
ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS gate_policy JSONB NOT NULL DEFAULT '{"failOn":["high"],"warnOn":["medium","low"]}',
    ADD COLUMN IF NOT EXISTS ignore_patterns TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS scan_schedule_cron VARCHAR(64),
    ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Add partial index for scheduled scans
CREATE INDEX IF NOT EXISTS idx_workspaces_schedule ON workspaces(scan_schedule_cron) WHERE scan_schedule_cron IS NOT NULL;

-- ── Workspace Members: missing invitation fields ─────────────────────────────
ALTER TABLE workspace_members
    ADD COLUMN IF NOT EXISTS invite_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS invite_token_hash VARCHAR(255),  -- bcrypt of invite token
    ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_workspace_members_invite_token ON workspace_members(invite_token_hash) WHERE invite_token_hash IS NOT NULL;

-- ── API Keys: missing rate limit ─────────────────────────────────────────────
ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_api_keys_role ON api_keys(role_id);

-- ── Organizations (top-level billing entity) ─────────────────────────────────
-- Adds the missing orgs table from the design doc, placing workspaces under it.
CREATE TABLE IF NOT EXISTS organizations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                    VARCHAR(64) NOT NULL UNIQUE,
    name                    VARCHAR(128) NOT NULL,
    plan                    VARCHAR(32) NOT NULL DEFAULT 'starter'
                            CHECK (plan IN ('starter', 'growth', 'enterprise')),
    billing_email           VARCHAR(255) NOT NULL,
    stripe_customer_id      VARCHAR(255),
    stripe_subscription_id  VARCHAR(255),
    scan_quota_monthly      INTEGER NOT NULL DEFAULT 2500,
    max_workspaces          INTEGER NOT NULL DEFAULT 5,
    max_members             INTEGER NOT NULL DEFAULT 20,
    features                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Link workspaces to organizations
ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(org_id);

-- ── Updated-at trigger for new tables ──────────────────────────────────────
CREATE TRIGGER tr_organizations_updated
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Seed first organization for migration compatibility ──────────────────────
-- (Safe no-op if orgs already exist; creates a default org only on empty table)
INSERT INTO organizations (slug, name, billing_email, plan)
SELECT 'simplebeacon-default', 'SimpleBeacon Default', 'billing@simplebeacon.ai', 'starter'
WHERE NOT EXISTS (SELECT 1 FROM organizations LIMIT 1);

-- Backfill existing workspaces into the default org
UPDATE workspaces
SET org_id = (SELECT id FROM organizations WHERE slug = 'simplebeacon-default')
WHERE org_id IS NULL;

-- ── Constraint: every workspace must belong to an org ────────────────────────
ALTER TABLE workspaces ALTER COLUMN org_id SET NOT NULL;

-- ── Note: Compliance Officer role ──────────────────────────────────────────────
-- The design doc specifies a 'compliance_officer' role. The existing 004 migration
-- uses 'auditor' for read-only compliance access. If a distinct 'compliance_officer'
-- role is needed, create it via application seed logic; 'auditor' covers the
-- permission set described in the design doc (view all scans, export audit reports).

-- ── Note: RLS on audit_log ──────────────────────────────────────────────────
-- audit_log is already partitioned by RANGE (created_at).
-- RLS on partitioned tables requires PostgreSQL 15+ and policy creation
-- per partition. Application middleware is the recommended enforcement layer
-- for audit_log reads; the table is append-only by design.

-- ── End of migration 005 ───────────────────────────────────────────────────
