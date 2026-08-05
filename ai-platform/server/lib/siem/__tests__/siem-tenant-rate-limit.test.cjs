'use strict';

/**
 * Unit tests for Per-Tenant SIEM Rate Limiting
 *
 * Verifies that the SIEM broker correctly:
 * - Accepts tenantId in event context for per-tenant rate limiting
 * - Maintains independent per-tenant token buckets
 * - Bypasses per-tenant rate limit for CRITICAL/FATAL events
 * - Reports per-tenant metrics in getMetrics()
 * - Remains backward compatible with events without tenantId
 */

const SiemSecurityBroker = require('../siem-broker.cjs');

describe('Per-Tenant SIEM Rate Limiting', () => {
  let broker;

  beforeEach(() => {
    broker = new SiemSecurityBroker({
      rateLimitMaxTokens: 100,
      rateLimitRefillRateMs: 60000, // slow refill for testing
      tenantRateLimitMaxTokens: 5,
      transportStrategy: 'STDOUT_ONLY',
    });
  });

  afterEach(() => {
    broker.close();
  });

  test('SIEM-TENANT-01: logEvent accepts tenantId in context', () => {
    const result = broker.logEvent({
      siemSeverity: 'LOW',
      siemCategory: 'TEST_EVENT',
      context: { tenantId: 'tenant-a', action: 'test' },
    });
    expect(result).toBe(true);
  });

  test('SIEM-TENANT-02: per-tenant token bucket limits events', () => {
    // Send 5 events for tenant-a (limit is 5)
    for (let i = 0; i < 5; i++) {
      expect(broker.logEvent({
        siemSeverity: 'LOW',
        siemCategory: 'TEST_EVENT',
        context: { tenantId: 'tenant-a' },
      })).toBe(true);
    }
    // 6th event should be dropped
    expect(broker.logEvent({
      siemSeverity: 'LOW',
      siemCategory: 'TEST_EVENT',
      context: { tenantId: 'tenant-a' },
    })).toBe(false);
  });

  test('SIEM-TENANT-03: CRITICAL events bypass per-tenant rate limit', () => {
    // Exhaust tenant-a bucket
    for (let i = 0; i < 5; i++) {
      broker.logEvent({
        siemSeverity: 'LOW',
        siemCategory: 'TEST_EVENT',
        context: { tenantId: 'tenant-a' },
      });
    }
    // CRITICAL should still pass
    expect(broker.logEvent({
      siemSeverity: 'CRITICAL',
      siemCategory: 'CRITICAL_EVENT',
      context: { tenantId: 'tenant-a' },
    })).toBe(true);
  });

  test('SIEM-TENANT-03b: FATAL events bypass per-tenant rate limit', () => {
    for (let i = 0; i < 5; i++) {
      broker.logEvent({
        siemSeverity: 'LOW',
        siemCategory: 'TEST_EVENT',
        context: { tenantId: 'tenant-a' },
      });
    }
    expect(broker.logEvent({
      siemSeverity: 'FATAL',
      siemCategory: 'FATAL_EVENT',
      context: { tenantId: 'tenant-a' },
    })).toBe(true);
  });

  test('SIEM-TENANT-04: getMetrics includes per-tenant event counts', () => {
    broker.logEvent({
      siemSeverity: 'LOW',
      siemCategory: 'TEST_EVENT',
      context: { tenantId: 'tenant-a' },
    });
    broker.logEvent({
      siemSeverity: 'CRITICAL',
      siemCategory: 'CRITICAL_EVENT',
      context: { tenantId: 'tenant-b' },
    });
    const metrics = broker.getMetrics();
    expect(metrics.tenantMetrics).toBeDefined();
    expect(metrics.tenantMetrics['tenant-a']).toBeDefined();
    expect(metrics.tenantMetrics['tenant-a'].processed).toBe(1);
    expect(metrics.tenantMetrics['tenant-b']).toBeDefined();
    expect(metrics.tenantMetrics['tenant-b'].bypassed).toBe(1);
  });

  test('SIEM-TENANT-05: tenant exhaustion does not affect other tenants', () => {
    // Exhaust tenant-a
    for (let i = 0; i < 5; i++) {
      broker.logEvent({
        siemSeverity: 'LOW',
        siemCategory: 'TEST_EVENT',
        context: { tenantId: 'tenant-a' },
      });
    }
    // tenant-a is exhausted
    expect(broker.logEvent({
      siemSeverity: 'LOW',
      siemCategory: 'TEST_EVENT',
      context: { tenantId: 'tenant-a' },
    })).toBe(false);
    // tenant-b should still work
    expect(broker.logEvent({
      siemSeverity: 'LOW',
      siemCategory: 'TEST_EVENT',
      context: { tenantId: 'tenant-b' },
    })).toBe(true);
  });

  test('SIEM-TENANT-06: events without tenantId use global bucket', () => {
    // Events without tenantId should use global bucket (backward compatible)
    const result = broker.logEvent({
      siemSeverity: 'LOW',
      siemCategory: 'GLOBAL_EVENT',
      context: { action: 'global' },
    });
    expect(result).toBe(true);
    const metrics = broker.getMetrics();
    // Should not have any tenant-specific metrics
    expect(Object.keys(metrics.tenantMetrics).length).toBe(0);
  });

  test('SIEM-TENANT-06b: events with empty tenantId use global bucket', () => {
    const result = broker.logEvent({
      siemSeverity: 'LOW',
      siemCategory: 'GLOBAL_EVENT',
      context: { tenantId: '', action: 'global' },
    });
    expect(result).toBe(true);
  });

  test('SIEM-TENANT-07: dropped events increment tenant dropped counter', () => {
    for (let i = 0; i < 5; i++) {
      broker.logEvent({
        siemSeverity: 'LOW',
        siemCategory: 'TEST_EVENT',
        context: { tenantId: 'tenant-a' },
      });
    }
    // This one drops
    broker.logEvent({
      siemSeverity: 'LOW',
      siemCategory: 'TEST_EVENT',
      context: { tenantId: 'tenant-a' },
    });
    const metrics = broker.getMetrics();
    expect(metrics.tenantMetrics['tenant-a'].dropped).toBe(1);
    expect(metrics.siem_events_dropped_total).toBe(1);
  });

  test('SIEM-TENANT-08: per-tenant buckets refill over time', (done) => {
    const fastBroker = new SiemSecurityBroker({
      rateLimitMaxTokens: 100,
      rateLimitRefillRateMs: 50, // fast refill for testing
      tenantRateLimitMaxTokens: 2,
      transportStrategy: 'STDOUT_ONLY',
    });
    // Exhaust bucket
    fastBroker.logEvent({ siemSeverity: 'LOW', siemCategory: 'T', context: { tenantId: 't1' } });
    fastBroker.logEvent({ siemSeverity: 'LOW', siemCategory: 'T', context: { tenantId: 't1' } });
    expect(fastBroker.logEvent({ siemSeverity: 'LOW', siemCategory: 'T', context: { tenantId: 't1' } })).toBe(false);
    // Wait for refill
    setTimeout(() => {
      expect(fastBroker.logEvent({ siemSeverity: 'LOW', siemCategory: 'T', context: { tenantId: 't1' } })).toBe(true);
      fastBroker.close();
      done();
    }, 120);
  });
});
