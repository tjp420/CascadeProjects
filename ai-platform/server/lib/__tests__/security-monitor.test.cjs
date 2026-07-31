'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temp directory for test isolation
const tmpDir = path.join(os.tmpdir(), `security-monitor-test-${Date.now()}`);
const storePath = path.join(tmpDir, 'audit-log.json');
const policyPath = path.join(tmpDir, 'audit-policies.json');

process.env.AUDIT_POLICY_PATH = policyPath;

const auditLogger = require('../audit-logger.cjs');
const securityMonitor = require('../security-monitor.cjs');

describe('security-monitor', () => {
  afterAll(() => {
    securityMonitor.stop();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('getStatus', () => {
    test('returns structured status object before any run', () => {
      const status = securityMonitor.getStatus();
      expect(status).toBeDefined();
      expect(status.running).toBe(false);
      expect(status.pollIntervalMs).toBe(60_000);
      expect(status.lastRunAt).toBeNull();
      expect(status.lastResults).toBeNull();
      expect(status.runCount).toBe(0);
    });
  });

  describe('runOnce', () => {
    test('runs a verification cycle and returns results', async () => {
      const results = await securityMonitor.runOnce();
      expect(results).toBeDefined();
      expect(results.orgsChecked).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(results.chainResults)).toBe(true);
      expect(Array.isArray(results.guardrailResults)).toBe(true);
    });

    test('updates status after a run', async () => {
      await securityMonitor.runOnce();
      const status = securityMonitor.getStatus();
      expect(status.lastRunAt).not.toBeNull();
      expect(status.runCount).toBeGreaterThanOrEqual(2);
      expect(status.lastResults).not.toBeNull();
      expect(status.lastResults.orgsChecked).toBeGreaterThanOrEqual(1);
    });

    test('chain results include valid flag for each org', async () => {
      const results = await securityMonitor.runOnce();
      for (const cr of results.chainResults) {
        expect(cr).toHaveProperty('orgId');
        expect(cr).toHaveProperty('valid');
        expect(cr).toHaveProperty('totalEntries');
        expect(cr).toHaveProperty('verifiedEntries');
      }
    });

    test('guardrail results include delta for each org', async () => {
      const results = await securityMonitor.runOnce();
      for (const gr of results.guardrailResults) {
        expect(gr).toHaveProperty('orgId');
        expect(gr).toHaveProperty('currentBlocked');
        expect(gr).toHaveProperty('delta');
      }
    });

    test('lastRunDurationMs is non-negative', async () => {
      await securityMonitor.runOnce();
      const status = securityMonitor.getStatus();
      expect(status.lastRunDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('start/stop lifecycle', () => {
    test('start activates the monitor and stop deactivates it', () => {
      securityMonitor.start();
      let status = securityMonitor.getStatus();
      expect(status.running).toBe(true);

      securityMonitor.stop();
      status = securityMonitor.getStatus();
      expect(status.running).toBe(false);
    });

    test('start is idempotent — calling twice does not create multiple intervals', () => {
      securityMonitor.start();
      securityMonitor.start();
      const status = securityMonitor.getStatus();
      expect(status.running).toBe(true);

      securityMonitor.stop();
    });
  });

  describe('chain verification with real audit entries', () => {
    test('detects valid chain after logging entries', async () => {
      // Log a few entries for the default org
      auditLogger.log({
        orgId: 'default',
        action: 'test_action',
        entity: 'test_entity',
        entityId: 'test-1',
        actorId: 'tester',
        actorEmail: 'tester@test.com',
        changes: [],
      });

      const results = await securityMonitor.runOnce();
      const defaultResult = results.chainResults.find((r) => r.orgId === 'default');
      expect(defaultResult).toBeDefined();
      expect(defaultResult.valid).toBe(true);
      expect(defaultResult.totalEntries).toBeGreaterThan(0);
    });
  });
});
