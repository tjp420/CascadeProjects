-- Option A: Enterprise Multi-Tenant Workspace RBAC Schemas (Phase 1)
-- SQLite-compatible DDL migration script.
-- Note: ALTER TABLE ADD COLUMN statements are not IF NOT EXISTS in SQLite;
-- run once on clean db or rely on lib/db.cjs idempotent migration guards.

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    owner_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'auditor',
    status TEXT NOT NULL DEFAULT 'active',
    invited_by TEXT,
    invited_at TEXT NOT NULL DEFAULT (datetime('now')),
    accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, user_email),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, slug),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'auditor',
    status TEXT NOT NULL DEFAULT 'active',
    invited_by TEXT,
    invited_at TEXT NOT NULL DEFAULT (datetime('now')),
    accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(workspace_id, user_email),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS tenant_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    workspace_id TEXT,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);

-- Scoped-table tenant link columns.
ALTER TABLE organizations ADD COLUMN tenant_id TEXT;
ALTER TABLE organization_members ADD COLUMN tenant_id TEXT;
ALTER TABLE cli_reports ADD COLUMN tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_email);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_email ON tenant_memberships(user_email);
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_creator ON workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace ON workspace_memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_email ON workspace_memberships(user_email);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_logs_tenant_created ON tenant_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_logs_actor_created ON tenant_audit_logs(actor_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_organizations_tenant ON organizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_members_tenant ON organization_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cli_reports_tenant_created ON cli_reports(tenant_id, created_at DESC);

COMMIT;
