# Test Plan: Track 124 — Cross-Cluster Replication Tenant Isolation

> Add tenant isolation to all 7 cross-cluster replication engines.
> Add tenantId to all replication messages, validate tenant context on inbound,
> reject cross-tenant replication attempts, tag SIEM events with tenant context.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Cross-cluster replication tenant isolation |
| Author (Builder) | Devin |
| Date | 2026-08-05 |
| Branch | feat/track124-cross-cluster-tenant-isolation |
| Packages touched | ai-platform/server/lib |

## Problem

All 7 cross-cluster replication engines lack tenant isolation. Zero `tenantId`
references exist in any replication module. This creates an active security
boundary violation where Tenant A's key material could replicate to Tenant B's
nodes. SIEM events are not tagged with tenant context, making cross-tenant
audit impossible.

## Objectives

### 1. Replication Tenant Context Module (`server/lib/replication-tenant-context.cjs`)

New shared module for tenant validation across all replication engines:

- **CTX-01**: `validateTenantContext(message)` — validates tenantId field on inbound messages
- **CTX-02**: `rejectCrossTenant(sourceTenant, targetTenant)` — throws on mismatch
- **CTX-03**: `tagSIEMEvent(event, tenantId)` — adds tenant context to SIEM events
- **CTX-04**: `createTenantScopedEmitter(tenantId, emitter)` — wraps emitter with tenant filter
- **CTX-05**: `TENANT_FIELD` constant — standard field name for tenantId in messages

### 2. cluster-keyring-sync.cjs — Tenant Isolation

- **KRS-01**: Add `tenantId` to all IPC message schemas
- **KRS-02**: Validate tenant context on all inbound messages
- **KRS-03**: Reject cross-tenant KEY_COMMIT, KEY_ANNOUNCE, DKG messages
- **KRS-04**: Tag all SIEM alerts with tenant context
- **KRS-05**: Backward compatible — messages without tenantId treated as 'default' tenant

### 3. bft-shard-sync-engine.cjs — Tenant Isolation

- **BFT-01**: Add `tenantId` to shard operations
- **BFT-02**: Validate tenant context on shard replication
- **BFT-03**: Reject cross-tenant shard access
- **BFT-04**: Tag metrics with tenant context

### 4. cross-enclave-state-sync.cjs — Tenant Isolation

- **CES-01**: Add `tenantId` to enclave registration and state sync
- **CES-02**: Validate tenant context on state sync operations
- **CES-03**: Reject cross-tenant state access
- **CES-04**: Tag all state sync events with tenant context

### 5. cross-cluster-migration-engine.cjs — Tenant Isolation

- **MIG-01**: Add `tenantId` to migration operations
- **MIG-02**: Validate tenant context on migration messages
- **MIG-03**: Reject cross-tenant migration attempts
- **MIG-04**: Tag migration metrics with tenant context

### 6. cluster-consensus-engine.cjs — Tenant Isolation

- **CON-01**: Add `tenantId` to consensus RPC messages
- **CON-02**: Validate tenant context on consensus operations
- **CON-03**: Reject cross-tenant consensus participation

### 7. cluster-key-reconciliation-engine.cjs — Tenant Isolation

- **REC-01**: Add `tenantId` to key reconciliation operations
- **REC-02**: Validate tenant context on reconciliation messages
- **REC-03**: Reject cross-tenant key reconciliation

### 8. siem-broker.cjs — Tenant Context Tagging

- **SIEM-01**: Add `tenantId` to distributed token bucket sync messages
- **SIEM-02**: Tag all SIEM events with tenant context
- **SIEM-03**: Per-tenant token bucket tracking (optional, policy-controlled)

### 9. hsm-metrics.cjs — Per-Tenant Replication Metrics

- **MET-01**: Add `hsm_replication_tenant_isolation_violation_total` counter
- **MET-02**: Add `hsm_replication_tenant_context_validated_total` counter
- **MET-03**: Add `hsm_replication_cross_tenant_rejected_total` counter

### 10. Tests

- **TEST-01**: Replication tenant context unit tests
- **TEST-02**: cluster-keyring-sync tenant isolation integration tests
- **TEST-03**: BFT shard sync tenant isolation tests
- **TEST-04**: Cross-enclave state sync tenant isolation tests
- **TEST-05**: Cross-cluster migration tenant isolation tests
- **TEST-06**: Backward compatibility tests (messages without tenantId)

## Files to Touch

| File | Change | New? |
|------|--------|------|
| `server/lib/replication-tenant-context.cjs` | New shared tenant validation module | Yes |
| `server/lib/cluster-keyring-sync.cjs` | Add tenantId to schemas + validation | No |
| `server/lib/hsm-adapter/bft-shard-sync-engine.cjs` | Add tenant context | No |
| `server/lib/hsm-adapter/cross-enclave-state-sync.cjs` | Add tenant context | No |
| `server/lib/hsm-adapter/cross-cluster-migration-engine.cjs` | Add tenant context | No |
| `server/lib/hsm-adapter/cluster-consensus-engine.cjs` | Add tenant context | No |
| `server/lib/hsm-adapter/cluster-key-reconciliation-engine.cjs` | Add tenant context | No |
| `server/lib/siem/siem-broker.cjs` | Add tenant context tagging | No |
| `server/lib/hsm-adapter/hsm-metrics.cjs` | Add 3 new counters | No |
| `server/lib/__tests__/replication-tenant-context.test.cjs` | Unit tests | Yes |
| `server/lib/__tests__/cluster-tenant-isolation.test.cjs` | Integration tests | Yes |

## Security Invariants

1. **Fail-closed**: Missing tenantId on inbound message = rejected (unless backward-compat mode)
2. **No cross-tenant leakage**: Tenant A's key material cannot replicate to Tenant B's nodes
3. **Tenant-tagged audit**: All SIEM events include tenant context
4. **Backward compatible**: Messages without tenantId treated as 'default' tenant (configurable)
5. **No silent bypass**: Cross-tenant violation = SIEM alert + rejection + metric increment
