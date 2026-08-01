---
title: RFC 024 — Multi-Tenant Policy Syncer
status: proposal
author: SimpleBeacon Team
created: 2026-07-31
---

# RFC 024 — Multi-Tenant Policy Syncer

Objective
---------
Define a simple, hoist-safe JSON policy model and an enforcement lifecycle for tenant-scoped compliance rules. The `policy-syncer` continuously reconciles a central policy store into per-tenant in-memory caches and exposes a small enforcement middleware used by route handlers.

Design Principles
-----------------
- No external runtime dependencies for the schema (JSON-only). 
- Enforcement must be deterministic, auditable, and tenant-scoped.
- Safe reconciliation: failed sync for tenant A must not impact tenant B.
- Lightweight evaluation: policy checks run synchronously at ingress and must be cheap.

1. Universal policy JSON schema (example)
----------------------------------------
Example policy manifest:

```json
{
  "$schema": "https://simplebeacon.io/schemas/policy.json",
  "policyId": "pol_sox_dlp_2026v1",
  "version": "1.4.2",
  "updatedAt": "2026-07-31T20:50:00.000Z",
  "tenantId": "org_acme_inc",
  "description": "SOX DLP baseline",
  "rules": [
    {
      "ruleId": "rule_deny_unencrypted_uploads",
      "axis": "bundle_verification",
      "effect": "DENY",
      "condition": {
        "field": "req.headers.x-dlp-token",
        "operator": "EXISTS",
        "value": false
      },
      "remediation": "Compliance Block: Missing mandatory enterprise DLP token verification parameter."
    }
  ]
}
```

Field notes
- `policyId`: stable identifier
- `version`: semver-like string for change tracking
- `tenantId`: owner tenant (optional for global policies)
- `rules[]`: evaluation order is significant (first match applies)

2. Policy condition language (minimal)
-------------------------------------
- Operators: `EXISTS`, `EQ`, `NEQ`, `IN`, `NOT_IN`, `REGEX`, `GT`, `LT`.
- Field references: `req.headers.*`, `req.query.*`, `req.user.*`, `req.body.*` (for small payloads).
- Effects: `DENY` or `ALLOW` (DENY takes precedence when matched).

3. Enforcement lifecycle (Ingress)
---------------------------------
1. Token Metadata Extraction & Tenancy Mapping
   - Resolve tenant from `req.user.orgId` or `x-tenant-id` header; fall back to default org.
2. Evaluation Loop & Condition Matching
   - Load `policyCache.get(tenantId)` and evaluate rules in order.
3. Action
   - If rule effect === `DENY`: halt request, return `403`, emit audit event `compliance_policy_violation` with `{ policyId, ruleId, tenantId, actor }`.
   - If no DENY rules match: proceed normally and emit a `compliance_policy_pass` audit event.

4. Implementation plan (high level)
---------------------------------
- Task 1 — RFC (this file) (owner: arch)
- Task 2 — Add tenancy metadata to `server/middleware/auth.cjs`/`authorize.cjs` (expose `req.resolvedOrgId`) (owner: backend)
- Task 3 — `server/lib/policy-syncer.cjs` (skeleton)
  - Functions: `startSyncLoop()`, `reconcilePolicies(tenantId)`, `getPolicy(tenantId)`
  - pluggable source adapter: `policySource.pull(tenantId)` (initially local JSON directory)
- Task 4 — `server/middleware/enforceCompliance.cjs`
  - Exports: `enforceCompliancePolicy(options)` (middleware factory)
  - Uses `policySyncer.getPolicy(tenantId)` and a small evaluator `evaluateRule(rule, req)`
- Task 5 — Audit plumbing: ensure `auditService.emit(name, meta)` accepts `compliance_policy_violation` events

5. API surface & example
------------------------
- `GET /api/policies/:tenantId` — read-only view (admin-only)
- `POST /api/policies/:tenantId/reconcile` — trigger immediate sync (admin-only)

Middleware usage example (Express):

```js
const { enforceCompliancePolicy } = require('../middleware/enforceCompliance.cjs');

router.post('/upload', authenticate, enforceCompliancePolicy(), handleUpload);
```

6. Validation strategy
----------------------
- Unit tests: rule evaluation matrix (operators, edge cases)
- Integration tests: upload blocked when `x-dlp-token` header absent and active policy contains DENY rule
- Fault injection: simulate policy-source downtime (syncer should not crash server; middleware returns pass if cache missing but logs warning)

7. Acceptance criteria
----------------------
- RFC merged to `docs/rfc/024-multi-tenant-policy-syncer.md`.
- `policy-syncer` skeleton added with tests for `reconcilePolicies` simulated against local JSON files.
- Enforcement middleware implemented and integrated with one sample route plus audit emission.

8. Backward-compatibility & safety
---------------------------------
- Default behavior: when no policy is found for a tenant, middleware allows the request and emits a `policy_cache_miss` audit event.
- Reconciliation errors must be local to tenant and not cause global failures.

9. Next actions (short)
-----------------------
1. I will create a PR skeleton with this RFC plus a minimal `server/lib/policy-syncer.cjs` and `server/middleware/enforceCompliance.cjs` stubs. (confirm to proceed)
2. If confirmed, I will open the PR and include unit-tests for the evaluator.

Appendix: Minimal evaluator pseudocode
------------------------------------
```
function evaluatePolicy(policy, req) {
  for (const rule of policy.rules) {
    if (evaluateCondition(rule.condition, req)) {
      return { matched: true, effect: rule.effect, ruleId: rule.ruleId };
    }
  }
  return { matched: false };
}
```

---
Document created by: SimpleBeacon planning assistant
