'use strict';

/**
 * Unit tests for Tenant-Scoped Cluster Peer Validation
 *
 * Verifies that the cluster keyring sync correctly:
 * - Validates tenantId on incoming cluster messages
 * - Rejects messages with unknown tenant scope
 * - Allows messages without tenantId (backward compatible)
 * - Records ISOLATION_VIOLATION events for rejected messages
 * - Increments hsm_isolation_violation_total counter
 */

const {
  _validateTenantScope,
  _setTenantAllowListForTest,
  _resetEvents,
  EVENT_TYPES,
  _hsmMetrics,
} = require('../cluster-keyring-sync.cjs');

describe('Tenant-Scoped Cluster Peer Validation', () => {
  beforeEach(() => {
    _resetEvents();
    _setTenantAllowListForTest(['tenant-a', 'tenant-b']);
    // Reset isolation violation counter
    if (_hsmMetrics && _hsmMetrics.getMetrics) {
      const m = _hsmMetrics.getMetrics();
      if (m.hsm_isolation_violation_total) {
        m.hsm_isolation_violation_total = 0;
      }
    }
  });

  afterEach(() => {
    _setTenantAllowListForTest(null); // restore default
  });

  test('CLUSTER-TENANT-01: messages with known tenantId pass validation', () => {
    const msg = { type: 'HEARTBEAT', tenantId: 'tenant-a', from: 'node-1' };
    expect(_validateTenantScope(msg, '10.0.0.1:7000')).toBe(true);
  });

  test('CLUSTER-TENANT-02: messages with unknown tenantId are rejected', () => {
    const msg = { type: 'HEARTBEAT', tenantId: 'evil-tenant', from: 'node-1' };
    expect(_validateTenantScope(msg, '10.0.0.1:7000')).toBe(false);
  });

  test('CLUSTER-TENANT-03: messages without tenantId pass (backward compatible)', () => {
    const msg = { type: 'HEARTBEAT', from: 'node-1' };
    expect(_validateTenantScope(msg, '10.0.0.1:7000')).toBe(true);
  });

  test('CLUSTER-TENANT-04: messages with empty tenantId pass (global scope)', () => {
    const msg = { type: 'HEARTBEAT', tenantId: '', from: 'node-1' };
    expect(_validateTenantScope(msg, '10.0.0.1:7000')).toBe(true);
  });

  test('CLUSTER-TENANT-05: null message passes (no tenant context)', () => {
    expect(_validateTenantScope(null, '10.0.0.1:7000')).toBe(true);
  });

  test('CLUSTER-TENANT-06: no allowlist configured allows all tenants', () => {
    _setTenantAllowListForTest(null);
    const msg = { type: 'HEARTBEAT', tenantId: 'any-tenant', from: 'node-1' };
    expect(_validateTenantScope(msg, '10.0.0.1:7000')).toBe(true);
  });

  test('CLUSTER-TENANT-07: rejected messages record ISOLATION_VIOLATION event', () => {
    const msg = { type: 'KEY_COMMIT', tenantId: 'evil-tenant', from: 'node-1' };
    _validateTenantScope(msg, '10.0.0.1:7000');
    const events = require('../cluster-keyring-sync.cjs').queryEvents({ type: EVENT_TYPES.ISOLATION_VIOLATION });
    expect(events.events.length).toBeGreaterThanOrEqual(1);
    const violation = events.events.find(e => e.details.reason === 'unknown_tenant_scope');
    expect(violation).toBeDefined();
    expect(violation.details.tenantId).toBe('evil-tenant');
    expect(violation.details.msgType).toBe('KEY_COMMIT');
  });

  test('CLUSTER-TENANT-08: rejected messages increment hsm_isolation_violation_total', () => {
    const msg = { type: 'HEARTBEAT', tenantId: 'evil-tenant', from: 'node-1' };
    const before = (_hsmMetrics.getMetrics().hsm_isolation_violation_total) || 0;
    _validateTenantScope(msg, '10.0.0.1:7000');
    const after = _hsmMetrics.getMetrics().hsm_isolation_violation_total;
    expect(after).toBe(before + 1);
  });

  test('CLUSTER-TENANT-09: DKG messages with unknown tenant are rejected', () => {
    const msg = { type: 'DKG_COMMIT', tenantId: 'evil-tenant', from: 'node-1' };
    expect(_validateTenantScope(msg, '10.0.0.1:7000')).toBe(false);
  });

  test('CLUSTER-TENANT-10: DKG messages with known tenant pass', () => {
    const msg = { type: 'DKG_COMMIT', tenantId: 'tenant-b', from: 'node-1' };
    expect(_validateTenantScope(msg, '10.0.0.1:7000')).toBe(true);
  });

  test('CLUSTER-TENANT-11: SIEM event includes critical severity for unknown tenant', () => {
    const msg = { type: 'HEARTBEAT', tenantId: 'evil-tenant', from: 'node-1' };
    _validateTenantScope(msg, '10.0.0.1:7000');
    const events = require('../cluster-keyring-sync.cjs').queryEvents({ type: EVENT_TYPES.ISOLATION_VIOLATION });
    const violation = events.events.find(e => e.details.reason === 'unknown_tenant_scope');
    expect(violation.details.siemSeverity).toBe('critical');
    expect(violation.details.siemCategory).toBe('network_isolation');
    expect(violation.details.siemSource).toBe('cluster-keyring-sync');
  });

  test('CLUSTER-TENANT-12: tenantId is trimmed before validation', () => {
    const msg = { type: 'HEARTBEAT', tenantId: '  tenant-a  ', from: 'node-1' };
    expect(_validateTenantScope(msg, '10.0.0.1:7000')).toBe(true);
  });

  test('CLUSTER-TENANT-13: multiple tenants can be validated independently', () => {
    expect(_validateTenantScope({ tenantId: 'tenant-a' }, 'peer-1')).toBe(true);
    expect(_validateTenantScope({ tenantId: 'tenant-b' }, 'peer-2')).toBe(true);
    expect(_validateTenantScope({ tenantId: 'tenant-c' }, 'peer-3')).toBe(false);
  });
});
