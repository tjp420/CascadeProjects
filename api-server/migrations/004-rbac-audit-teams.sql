-- SimpleBeacon Enterprise — RBAC, Audit Trails, and Team Workspaces
-- Migration: 004
-- PostgreSQL 15+

-- ── Users ──────────────────────────────────────────────────────────────────
-- Core identity table. Authentication is handled via SSO (SAML/OIDC) or local JWT.
CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    display_name        VARCHAR(128),
    auth_provider       VARCHAR(32) NOT NULL DEFAULT 'local'
                        CHECK (auth_provider IN ('local', 'saml', 'oidc', 'github', 'gitlab')),
    external_id         VARCHAR(255),              -- ID from SAML/OIDC provider
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_superuser        BOOLEAN NOT NULL DEFAULT false,  -- bypasses all RBAC checks
    last_login_at       TIMESTAMPTZ,
    mfa_enabled         BOOLEAN NOT NULL DEFAULT false,
    mfa_secret          VARCHAR(255),              -- encrypted TOTP secret
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_external ON users(auth_provider, external_id);

-- ── Roles ──────────────────────────────────────────────────────────────────
-- Pre-defined roles with hierarchical weight for conflict resolution.
CREATE TABLE IF NOT EXISTS roles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(32) NOT NULL UNIQUE
                        CHECK (name IN ('superuser', 'admin', 'manager', 'developer', 'auditor', 'viewer')),
    weight              INTEGER NOT NULL,          -- higher = more authority (superuser=100, viewer=10)
    description         TEXT NOT NULL,
    is_builtin          BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (name, weight, description, is_builtin) VALUES
    ('superuser', 100, 'Full system access. Bypasses all permission checks.', true),
    ('admin',      80, 'Workspace administration: invite members, configure billing, manage API keys.', true),
    ('manager',    60, 'Team oversight: view all scans, assign remediation tasks, export reports.', true),
    ('developer',  40, 'Standard developer: run scans, view own reports, trigger auto-fixes.', true),
    ('auditor',    30, 'Read-only compliance access: view all scans and audit logs, cannot modify.', true),
    ('viewer',     10, 'Limited read access: view dashboards only, no scan or fix privileges.', true)
ON CONFLICT (name) DO NOTHING;

-- ── Permissions ──────────────────────────────────────────────────────────────
-- Granular capability definitions.
CREATE TABLE IF NOT EXISTS permissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(64) NOT NULL UNIQUE,
    resource_type       VARCHAR(32) NOT NULL
                        CHECK (resource_type IN ('workspace', 'project', 'scan', 'report', 'certificate', 'billing', 'member', 'api_key', 'audit_log')),
    action              VARCHAR(32) NOT NULL
                        CHECK (action IN ('create', 'read', 'update', 'delete', 'execute', 'admin', 'invite', 'export')),
    description         TEXT NOT NULL
);

INSERT INTO permissions (code, resource_type, action, description) VALUES
    -- Workspace
    ('workspace.read',   'workspace', 'read',   'View workspace settings and members'),
    ('workspace.update', 'workspace', 'update', 'Edit workspace settings, rename, configure integrations'),
    ('workspace.delete', 'workspace', 'delete', 'Delete workspace and all data'),
    ('workspace.admin',  'workspace', 'admin',  'Full workspace control including billing and SSO'),
    ('workspace.invite', 'workspace', 'invite', 'Invite new members to workspace'),
    -- Project
    ('project.create', 'project', 'create', 'Add a new project to the workspace'),
    ('project.read',   'project', 'read',   'View project scan history and settings'),
    ('project.update', 'project', 'update', 'Edit project scan paths, schedules, and rules'),
    ('project.delete', 'project', 'delete', 'Remove project from workspace'),
    -- Scan
    ('scan.execute', 'scan', 'execute', 'Trigger a new scan (full, gate, or quick)'),
    ('scan.read',    'scan', 'read',    'View scan results and findings'),
    ('scan.delete',  'scan', 'delete',  'Delete scan history and reports'),
    -- Report
    ('report.read',   'report', 'read',   'View generated reports and certificates'),
    ('report.export', 'report', 'export', 'Download reports as PDF, JSON, or CSV'),
    ('report.delete', 'report', 'delete', 'Permanently delete reports'),
    -- Certificate
    ('certificate.create', 'certificate', 'create', 'Generate compliance certificates'),
    ('certificate.read',   'certificate', 'read',   'View and download certificates'),
    -- Billing
    ('billing.read',   'billing', 'read',   'View invoices, usage, and subscription status'),
    ('billing.update', 'billing', 'update', 'Update payment methods and subscription tiers'),
    -- Member
    ('member.read',   'member', 'read',   'View workspace member list'),
    ('member.update', 'member', 'update', 'Change member roles or deactivate accounts'),
    ('member.delete', 'member', 'delete', 'Remove members from workspace'),
    -- API Key
    ('api_key.create', 'api_key', 'create', 'Create service account API keys'),
    ('api_key.read',   'api_key', 'read',   'List active API keys'),
    ('api_key.delete', 'api_key', 'delete', 'Revoke API keys'),
    -- Audit Log
    ('audit_log.read', 'audit_log', 'read', 'View immutable audit trail')
ON CONFLICT (code) DO NOTHING;

-- ── Role-Permission Mapping ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- Superuser gets everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'superuser'
ON CONFLICT DO NOTHING;

-- Admin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.code IN (
    'workspace.read','workspace.update','workspace.delete','workspace.admin','workspace.invite',
    'project.create','project.read','project.update','project.delete',
    'scan.execute','scan.read','scan.delete',
    'report.read','report.export','report.delete',
    'certificate.create','certificate.read',
    'billing.read','billing.update',
    'member.read','member.update','member.delete',
    'api_key.create','api_key.read','api_key.delete',
    'audit_log.read'
  )
ON CONFLICT DO NOTHING;

-- Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'manager'
  AND p.code IN (
    'workspace.read','workspace.invite',
    'project.create','project.read','project.update','project.delete',
    'scan.execute','scan.read','scan.delete',
    'report.read','report.export',
    'certificate.create','certificate.read',
    'billing.read',
    'member.read','member.update',
    'api_key.read',
    'audit_log.read'
  )
ON CONFLICT DO NOTHING;

-- Developer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'developer'
  AND p.code IN (
    'workspace.read',
    'project.create','project.read','project.update',
    'scan.execute','scan.read',
    'report.read','report.export',
    'certificate.read',
    'member.read'
  )
ON CONFLICT DO NOTHING;

-- Auditor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'auditor'
  AND p.code IN (
    'workspace.read',
    'project.read',
    'scan.read',
    'report.read','report.export',
    'certificate.read',
    'audit_log.read'
  )
ON CONFLICT DO NOTHING;

-- Viewer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer'
  AND p.code IN (
    'workspace.read',
    'project.read',
    'scan.read',
    'report.read',
    'certificate.read'
  )
ON CONFLICT DO NOTHING;

-- ── Workspaces (Teams) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(128) NOT NULL,
    slug                VARCHAR(64) NOT NULL UNIQUE,
    description         TEXT,
    owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    billing_email       VARCHAR(255) NOT NULL,
    subscription_tier   VARCHAR(32) NOT NULL DEFAULT 'free'
                        CHECK (subscription_tier IN ('free', 'startup', 'growth', 'enterprise')),
    max_projects        INTEGER NOT NULL DEFAULT 5,
    max_members         INTEGER NOT NULL DEFAULT 3,
    max_scans_per_day   INTEGER NOT NULL DEFAULT 50,
    sso_enabled         BOOLEAN NOT NULL DEFAULT false,
    sso_config          JSONB,                      -- {provider, metadata_url, cert}
    is_active           BOOLEAN NOT NULL DEFAULT true,
    deleted_at          TIMESTAMPTZ,                -- soft delete
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_active ON workspaces(is_active) WHERE is_active = true;

-- ── Workspace Members ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id             UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    invited_by          UUID REFERENCES users(id),
    invitation_accepted BOOLEAN NOT NULL DEFAULT true,
    invitation_token      VARCHAR(255),             -- for email invitation flow
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(role_id);

-- ── Team Boundary Keys ─────────────────────────────────────────────────────
-- Cryptographic isolation: each workspace gets a unique encryption key
-- for sensitive data (scan reports, certificates) so multi-tenant
-- hosts cannot cross-read.
CREATE TABLE IF NOT EXISTS workspace_boundary_keys (
    workspace_id        UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    data_key_encrypted  BYTEA NOT NULL,             -- AES-256-GCM key encrypted by master KMS key
    cert_key_encrypted  BYTEA NOT NULL,             -- separate key for certificate signing
    kms_key_id          VARCHAR(255),               -- reference to external KMS (AWS KMS, HashiCorp Vault)
    rotated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ,                -- key rotation deadline
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Audit Log ────────────────────────────────────────────────────────────────
-- Immutable record of every significant action across the platform.
CREATE TABLE IF NOT EXISTS audit_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    api_key_id          UUID,                       -- if action was via service account
    action              VARCHAR(64) NOT NULL,         -- e.g. 'scan.triggered', 'member.invited', 'report.exported'
    resource_type       VARCHAR(32) NOT NULL,
    resource_id         UUID,                       -- UUID of the affected object
    details             JSONB NOT NULL DEFAULT '{}', -- structured payload: {projectId, scanId, before, after}
    ip_address          INET,
    user_agent          TEXT,
    request_id          VARCHAR(64),                  -- correlation ID for distributed tracing
    severity            VARCHAR(16) NOT NULL DEFAULT 'info'
                        CHECK (severity IN ('debug', 'info', 'notice', 'warning', 'critical')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Partitioning strategy: monthly partitions for audit_log
-- (Initial partition for current month; application logic creates future ones)
CREATE TABLE IF NOT EXISTS audit_log_2026_06 PARTITION OF audit_log
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_log(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);

-- ── API Keys / Service Accounts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name                VARCHAR(128) NOT NULL,
    key_prefix          VARCHAR(8) NOT NULL,         -- first 8 chars of the key (for display)
    key_hash            VARCHAR(255) NOT NULL,         -- bcrypt/scrypt hash of full key
    scopes              VARCHAR(64)[] NOT NULL DEFAULT '{}',
    last_used_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- ── Row-Level Security (RLS) Policies ──────────────────────────────────────
-- Enforce team isolation at the database level.

ALTER TABLE remediation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_results_post_fix ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation_runs ON remediation_runs
    USING (project_id IN (
        SELECT p.id FROM projects p WHERE p.workspace_id = current_setting('app.current_workspace_id')::UUID
    ));

CREATE POLICY workspace_isolation_actions ON remediation_actions
    USING (run_id IN (
        SELECT r.id FROM remediation_runs r
        JOIN projects p ON r.project_id = p.id
        WHERE p.workspace_id = current_setting('app.current_workspace_id')::UUID
    ));

CREATE POLICY workspace_isolation_gate ON gate_results_post_fix
    USING (run_id IN (
        SELECT r.id FROM remediation_runs r
        JOIN projects p ON r.project_id = p.id
        WHERE p.workspace_id = current_setting('app.current_workspace_id')::UUID
    ));

-- Note: RLS requires that the application sets app.current_workspace_id
-- per session via: SET app.current_workspace_id = '<uuid>';

-- ── Updated-at triggers ─────────────────────────────────────────────────────
CREATE TRIGGER tr_workspaces_updated
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_workspace_members_updated
    BEFORE UPDATE ON workspace_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
