# SimpleBeacon 2.0 Enterprise RBAC Strategy

**Version:** 1.0.0
**Date:** 2026-06-27
**Status:** Design Document

---

## 1. Overview

Phase 3 Enterprise adds team-based access control, audit trails, and organizational boundaries to SimpleBeacon. The RBAC model must support:

- **Multi-tenant workspaces** (Company A cannot see Company B's scans)
- **Role-based permissions** (Admin, Manager, Developer, Viewer)
- **API key scoping** (keys bound to workspace + role)
- **Audit logging** (who did what, when, and from where)

---

## 2. Core Concepts

```
Organization (top-level billing entity)
├── Workspace (per-repo or per-team boundary)
│   ├── Members (users with roles)
│   ├── API Keys (scoped to workspace + role)
│   ├── Scans (owned by workspace)
│   ├── Fix History (workspace-scoped)
│   └── Settings (gate policy, ignore patterns)
└── Billing Plan (affects scan quotas, features)
```

---

## 3. Role Definitions

### 3.1 Role Hierarchy

| Role | Description | Inherits From |
|------|-------------|---------------|
| **Owner** | Full control, billing, can delete workspace | — |
| **Admin** | Manage members, API keys, gate policies | Owner (minus billing/deletion) |
| **Manager** | View all scans, create reports, manage schedules | Admin (minus member management) |
| **Developer** | Run scans, view own findings, apply fixes | Manager (minus reporting/scheduling) |
| **Viewer** | Read-only access to dashboards and reports | — |
| **Compliance Officer** | Special role: view all scans, export audit reports, cannot modify | Manager (read-only) |

### 3.2 Permission Matrix

| Permission | Owner | Admin | Manager | Developer | Viewer | Compliance |
|-----------|-------|-------|---------|-----------|--------|------------|
| View dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Run scan | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| View findings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Apply auto-fix | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Configure gate policy | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage ignore patterns | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create API keys | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Revoke API keys | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Generate reports | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Schedule recurring scans | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View billing | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Export audit trail | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| View raw logs | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |

---

## 4. Database Schema

### 4.1 Organizations Table

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,           -- e.g., "acme-corp"
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'starter',  -- starter/growth/enterprise
    billing_email TEXT NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    scan_quota_monthly INTEGER NOT NULL DEFAULT 2500,
    max_workspaces INTEGER NOT NULL DEFAULT 5,
    max_members INTEGER NOT NULL DEFAULT 20,
    features JSONB NOT NULL DEFAULT '{}',  -- { "sso": true, "audit": true }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Workspaces Table

```sql
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    repo_url TEXT,                       -- e.g., "https://github.com/acme/app"
    gate_policy JSONB NOT NULL DEFAULT '{"failOn":["high"],"warnOn":["medium","low"]}',
    ignore_patterns TEXT[] DEFAULT ARRAY[]::TEXT[],
    scan_schedule_cron TEXT,             -- e.g., "0 9 * * MON" for weekly
    last_scan_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, slug)
);
```

### 4.3 Members Table

```sql
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner','admin','manager','developer','viewer','compliance')),
    invited_by UUID REFERENCES members(id),
    invite_email TEXT,                   -- for pending invites
    invite_token_hash TEXT,              -- bcrypt of invite token
    invite_expires_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id),
    UNIQUE(workspace_id, user_id)
);
```

### 4.4 Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    email_verified_at TIMESTAMPTZ,
    password_hash TEXT,                  -- bcrypt, nullable for SSO-only
    full_name TEXT,
    avatar_url TEXT,
    sso_provider TEXT,                   -- 'google', 'saml', 'oidc'
    sso_subject TEXT,                    -- provider-specific user ID
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret_encrypted TEXT,
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.5 API Keys Table

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                  -- e.g., "CI/CD GitHub Action"
    key_prefix TEXT NOT NULL,           -- e.g., "sb_live_abc" (first 12 chars)
    key_hash TEXT NOT NULL,              -- bcrypt of full key
    role TEXT NOT NULL,                  -- role this key assumes
    scopes TEXT[] DEFAULT ARRAY[]::TEXT[], -- ["scan:read","scan:write","fix:apply"]
    rate_limit_per_minute INTEGER DEFAULT 60,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    last_used_ip INET,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES members(id)
);
```

### 4.6 Audit Log Table

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user','api_key','system')),
    actor_id UUID NOT NULL,              -- user_id or api_key_id
    actor_email TEXT,                    -- denormalized for quick display
    action TEXT NOT NULL,                -- e.g., "scan:run", "fix:apply", "member:invite"
    resource_type TEXT NOT NULL,         -- e.g., "scan", "finding", "member"
    resource_id UUID,
    payload JSONB,                       -- action-specific data
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_org_workspace ON audit_log(org_id, workspace_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor_type, actor_id, created_at DESC);
```

---

## 5. API Key Design

### 5.1 Key Format

```
sb_live_<random-24-char-base58>   → Production
sb_test_<random-24-char-base58>  → Sandbox (no billing, no real fixes)
```

Example: `sb_live_3jK9mNpQr5vWxYzAbCdEfGh`

### 5.2 Key Scoping

Keys are scoped to:
1. **Organization** (cannot cross orgs)
2. **Workspace** (optional — org-level key can access all workspaces)
3. **Role** (key cannot exceed creator's role)

### 5.3 Key Verification Flow

```
Request arrives with Authorization: Bearer sb_live_xxx...
│
├─ Extract prefix → lookup api_keys by key_prefix
├─ bcrypt.compare(full_key, key_hash)
├─ Check revoked_at, expires_at
├─ Verify role permissions for requested action
├─ Check workspace scope (if workspace_id set)
├─ Log to audit_log
└─ Proceed or 403
```

---

## 6. Authentication Flows

### 6.1 Email + Password (Default)

```
POST /api/v2/auth/register
→ Create user → Send verification email
→ POST /api/v2/auth/verify-email
→ POST /api/v2/auth/login → JWT (access + refresh)
```

### 6.2 SSO (SAML 2.0 / OIDC)

```
GET /api/v2/auth/sso/:provider
→ Redirect to IdP
→ IdP POSTs SAMLResponse to /api/v2/auth/sso/:provider/callback
→ Find or create user by sso_subject
→ Create org membership if JIT provisioning enabled
→ Issue JWT
```

### 6.3 MFA (TOTP)

```
POST /api/v2/auth/mfa/setup
→ Generate TOTP secret → Show QR code
→ POST /api/v2/auth/mfa/verify
→ Enable mfa_enabled on user
```

---

## 7. Workspace Isolation

### 7.1 Row-Level Security (RLS)

```sql
-- Every scan belongs to a workspace
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON scans
    USING (workspace_id IN (
        SELECT workspace_id FROM members
        WHERE user_id = current_setting('app.current_user_id')::UUID
    ));
```

### 7.2 API Middleware

```typescript
function requireWorkspaceAccess(req: Request, res: Response, next: NextFunction) {
    const workspaceId = req.params.workspaceId || req.body.workspaceId;
    if (!workspaceId) return next(); // org-level request
    
    const membership = req.user.memberships.find(m => m.workspace_id === workspaceId);
    if (!membership) return res.status(403).json({ error: 'Workspace access denied' });
    
    req.membership = membership;
    next();
}
```

---

## 8. Audit Trail Requirements

### 8.1 Immutable Events

| Event | Fields | Retention |
|-------|--------|-----------|
| `scan:run` | who, workspace, repo, duration, gate result | 7 years |
| `finding:view` | who, finding_id, source (web/cli/api) | 1 year |
| `fix:apply` | who, finding_id, file, diff_hash, model_used | 7 years |
| `fix:rollback` | who, original_fix_id, reason | 7 years |
| `member:invite` | who, invitee_email, role | 7 years |
| `member:role_change` | who, target_user, old_role, new_role | 7 years |
| `api_key:create` | who, key_name, role, scopes | 7 years |
| `api_key:revoke` | who, key_id, reason | 7 years |
| `policy:update` | who, old_policy, new_policy | 7 years |
| `billing:upgrade` | who, old_plan, new_plan | 7 years |

### 8.2 Export Format

```json
{
  "exportType": "audit-trail",
  "organization": "acme-corp",
  "period": { "from": "2026-01-01", "to": "2026-06-27" },
  "events": [
    {
      "timestamp": "2026-06-27T14:32:00Z",
      "actor": { "type": "user", "email": "alice@acme.com", "role": "admin" },
      "action": "fix:apply",
      "resource": { "type": "finding", "id": "cred-123" },
      "workspace": "production-app",
      "ip": "203.0.113.45",
      "success": true,
      "payload": { "file": "src/auth.js", "model": "llama3.2:latest" }
    }
  ]
}
```

---

## 9. Implementation Phases

### Phase A: Foundation (Week 1–2)
- [ ] Database migrations for orgs, workspaces, members, users
- [ ] Password-based auth with bcrypt + JWT
- [ ] Basic RBAC middleware (check role on every route)
- [ ] API key generation and verification

### Phase B: Team Features (Week 3–4)
- [ ] Workspace CRUD (create, update, delete)
- [ ] Member invitation flow (email + token)
- [ ] Role assignment UI
- [ ] Workspace-scoped scans and reports

### Phase C: Enterprise (Week 5–6)
- [ ] SSO (SAML 2.0 + OIDC)
- [ ] MFA (TOTP)
- [ ] Audit log viewer (admin-only)
- [ ] Compliance officer role
- [ ] Audit export (CSV, JSON, PDF)

### Phase D: Hardening (Week 7–8)
- [ ] RLS policies on all tables
- [ ] Rate limiting per API key
- [ ] Key rotation reminders
- [ ] Session management (revoke all sessions)
- [ ] Penetration testing

---

## 10. Open Questions

1. **Self-hosted option:** Do enterprise customers get an on-premise version with local PostgreSQL?
2. **SCIM provisioning:** Should we support automated user provisioning from Azure AD/Okta?
3. **Break-glass access:** How does an owner regain access if locked out (no SSO, no MFA backup codes)?
4. **Data residency:** EU customers may require EU-only data storage (GDPR Article 44).
5. **Pricing:** Is RBAC included in Growth ($149/mo) or only Enterprise ($499/mo)?

---

*This document is a living design. Update as requirements evolve.*
