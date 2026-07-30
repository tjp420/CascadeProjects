-- Option A tenant RBAC backfill (Phase 1)
-- Idempotent backfill for existing data.

BEGIN TRANSACTION;

UPDATE organizations
SET tenant_id = id
WHERE tenant_id IS NULL OR tenant_id = '';

UPDATE organization_members
SET tenant_id = org_id
WHERE tenant_id IS NULL OR tenant_id = '';

INSERT INTO tenants (id, name, slug, owner_email, status)
SELECT o.id, o.name, o.slug, o.owner_email, 'active'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = o.id);

INSERT INTO tenant_memberships (tenant_id, user_email, role, status, invited_by, accepted_at)
SELECT om.org_id, om.user_email, om.role, om.status, om.invited_by, om.accepted_at
FROM organization_members om
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.tenant_id = om.org_id AND tm.user_email = om.user_email
);

INSERT INTO tenants (id, name, slug, owner_email, status)
VALUES ('tenant_personal', 'Personal Workspace', 'personal', 'system@simplebeacon.local', 'active')
ON CONFLICT(id) DO NOTHING;

UPDATE cli_reports
SET tenant_id = COALESCE(
    (
        SELECT tm.tenant_id
        FROM tenant_memberships tm
        WHERE tm.user_email = cli_reports.customer_email AND tm.status = 'active'
        ORDER BY tm.id ASC
        LIMIT 1
    ),
    'tenant_personal'
)
WHERE tenant_id IS NULL OR tenant_id = '';

COMMIT;
