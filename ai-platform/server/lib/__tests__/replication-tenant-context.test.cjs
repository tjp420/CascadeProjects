'use strict';

const {
  TENANT_FIELD,
  DEFAULT_TENANT,
  BACKWARD_COMPAT_MODE,
  isValidTenantId,
  extractTenantContext,
  validateTenantContext,
  rejectCrossTenant,
  tagSIEMEvent,
  tagOutboundMessage,
  tenantsMatch,
} = require('../replication-tenant-context.cjs');
const hsmMetrics = require('../hsm-adapter/hsm-metrics.cjs');

describe('Track 124: Replication Tenant Context', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('CTX-01a: valid tenant IDs pass validation', () => {
    expect(isValidTenantId('tenant-1')).toBe(true);
    expect(isValidTenantId('tenant_1')).toBe(true);
    expect(isValidTenantId('TENANT123')).toBe(true);
    expect(isValidTenantId('a')).toBe(true);
  });

  test('CTX-01b: invalid tenant IDs are rejected', () => {
    expect(isValidTenantId('')).toBe(false);
    expect(isValidTenantId(null)).toBe(false);
    expect(isValidTenantId(undefined)).toBe(false);
    expect(isValidTenantId(123)).toBe(false);
    expect(isValidTenantId('tenant with spaces')).toBe(false);
    expect(isValidTenantId('tenant/with/slashes')).toBe(false);
    expect(isValidTenantId('../traversal')).toBe(false);
    expect(isValidTenantId('a'.repeat(129))).toBe(false);
  });

  test('CTX-02a: message with valid tenantId extracts correctly', () => {
    const msg = { type: 'HEARTBEAT', tenantId: 'tenant-1', from: 'node1' };
    const ctx = extractTenantContext(msg);
    expect(ctx.valid).toBe(true);
    expect(ctx.tenantId).toBe('tenant-1');
    expect(ctx.reason).toBeNull();
  });

  test('CTX-02b: message without tenantId defaults to default tenant in compat mode', () => {
    const msg = { type: 'HEARTBEAT', from: 'node1' };
    const ctx = extractTenantContext(msg);
    if (BACKWARD_COMPAT_MODE) {
      expect(ctx.valid).toBe(true);
      expect(ctx.tenantId).toBe(DEFAULT_TENANT);
    } else {
      expect(ctx.valid).toBe(false);
      expect(ctx.reason).toBe('missing_tenant_id');
    }
  });

  test('CTX-02c: message with invalid tenantId format is rejected', () => {
    const msg = { type: 'HEARTBEAT', tenantId: '../traversal', from: 'node1' };
    const ctx = extractTenantContext(msg);
    expect(ctx.valid).toBe(false);
    expect(ctx.reason).toBe('invalid_tenant_id_format');
  });

  test('CTX-02d: null message is rejected', () => {
    const ctx = extractTenantContext(null);
    expect(ctx.valid).toBe(false);
    expect(ctx.reason).toBe('invalid_message_object');
  });

  test('CTX-02e: strict mode rejects missing tenantId', () => {
    const msg = { type: 'HEARTBEAT', from: 'node1' };
    const ctx = extractTenantContext(msg, { strict: true });
    expect(ctx.valid).toBe(false);
    expect(ctx.reason).toBe('missing_tenant_id');
  });

  test('CTX-03a: valid message with matching source tenant passes', () => {
    const msg = { type: 'KEY_COMMIT', tenantId: 'tenant-1', from: 'node1' };
    const result = validateTenantContext(msg, 'tenant-1');
    expect(result.valid).toBe(true);
    expect(result.tenantId).toBe('tenant-1');
    expect(hsmMetrics.getMetrics().hsm_replication_tenant_context_validated_total).toBe(1);
  });

  test('CTX-03b: cross-tenant mismatch is rejected', () => {
    const msg = { type: 'KEY_COMMIT', tenantId: 'tenant-A', from: 'node1' };
    const result = validateTenantContext(msg, 'tenant-B');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('cross_tenant_mismatch');
    expect(hsmMetrics.getMetrics().hsm_replication_cross_tenant_rejected_total).toBe(1);
  });

  test('CTX-03c: invalid tenant format increments violation counter', () => {
    const msg = { type: 'HEARTBEAT', tenantId: 'bad/tenant', from: 'node1' };
    const result = validateTenantContext(msg);
    expect(result.valid).toBe(false);
    expect(hsmMetrics.getMetrics().hsm_replication_tenant_isolation_violation_total).toBe(1);
  });

  test('CTX-03d: invalid source tenant increments violation counter', () => {
    const msg = { type: 'HEARTBEAT', tenantId: 'tenant-1', from: 'node1' };
    const result = validateTenantContext(msg, 'bad/source');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_source_tenant_id');
    expect(hsmMetrics.getMetrics().hsm_replication_tenant_isolation_violation_total).toBe(1);
  });

  test('CTX-04: rejectCrossTenant throws with correct code and metadata', () => {
    expect(() => rejectCrossTenant('tenant-A', 'tenant-B')).toThrow('CROSS_TENANT_REPLICATION_REJECTED');
    try {
      rejectCrossTenant('tenant-A', 'tenant-B');
    } catch (err) {
      expect(err.code).toBe('CROSS_TENANT_REPLICATION_REJECTED');
      expect(err.sourceTenant).toBe('tenant-A');
      expect(err.targetTenant).toBe('tenant-B');
    }
    expect(hsmMetrics.getMetrics().hsm_replication_cross_tenant_rejected_total).toBe(2);
  });

  test('CTX-05a: tagSIEMEvent adds tenantId to event', () => {
    const event = { severity: 'high', category: 'test' };
    tagSIEMEvent(event, 'tenant-1');
    expect(event.tenantId).toBe('tenant-1');
  });

  test('CTX-05b: tagSIEMEvent defaults to default tenant for invalid tenantId', () => {
    const event = { severity: 'high', category: 'test' };
    tagSIEMEvent(event, null);
    expect(event.tenantId).toBe(DEFAULT_TENANT);
  });

  test('CTX-05c: tagSIEMEvent handles null event gracefully', () => {
    expect(tagSIEMEvent(null, 'tenant-1')).toBeNull();
  });

  test('CTX-06a: tagOutboundMessage adds tenantId to message', () => {
    const msg = { type: 'HEARTBEAT', from: 'node1' };
    tagOutboundMessage(msg, 'tenant-1');
    expect(msg.tenantId).toBe('tenant-1');
  });

  test('CTX-06b: tagOutboundMessage does not add tenantId for invalid value', () => {
    const msg = { type: 'HEARTBEAT', from: 'node1' };
    tagOutboundMessage(msg, null);
    expect(msg.tenantId).toBeUndefined();
  });

  test('CTX-07a: tenantsMatch returns true for matching tenants', () => {
    expect(tenantsMatch('tenant-1', 'tenant-1')).toBe(true);
  });

  test('CTX-07b: tenantsMatch returns false for different tenants', () => {
    expect(tenantsMatch('tenant-A', 'tenant-B')).toBe(false);
  });

  test('CTX-07c: tenantsMatch handles null/undefined safely', () => {
    expect(tenantsMatch(null, null)).toBe(true);
    expect(tenantsMatch(undefined, undefined)).toBe(true);
    expect(tenantsMatch('tenant-1', null)).toBe(false);
  });

  test('TENANT_FIELD is "tenantId"', () => {
    expect(TENANT_FIELD).toBe('tenantId');
  });

  test('DEFAULT_TENANT is "default"', () => {
    expect(DEFAULT_TENANT).toBe('default');
  });
});
