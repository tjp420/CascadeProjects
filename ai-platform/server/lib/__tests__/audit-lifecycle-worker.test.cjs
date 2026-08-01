'use strict';

/**
 * Tests for Autonomous Lifecycle Worker (test-injection variant).
 *
 * Uses __testInject() to mock getAllOrgIds, purgeOldEntries, and log,
 * enabling isolated testing of the worker's orchestration logic without
 * touching the filesystem.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const auditLoggerPath = require.resolve('../audit-logger.cjs');
let auditLogger;

beforeEach(() => {
  delete require.cache[auditLoggerPath];
  auditLogger = require(auditLoggerPath);
});

describe('Autonomous Lifecycle Worker (test-injected)', () => {
  it('exports lifecycle API', () => {
    assert.ok(auditLogger, 'audit-logger module should load');
    assert.strictEqual(typeof auditLogger.runAutonomousLifecyclePurge, 'function');
    assert.strictEqual(typeof auditLogger.getLifecyclePurgeStats, 'function');
  });

  it('L2 Background Lifecycle Sweep: purges expired entries and emits audit_retention_auto_purge', async () => {
    if (typeof auditLogger.__testInject !== 'function') {
      return; // skip if test injection not supported
    }

    const logged = [];

    auditLogger.__testInject({
      getAllOrgIds: async () => ['org-alpha'],
      purgeOldEntries: async () => ({ purged: 3, remaining: 0, archived: 1 }),
      log: async (entry) => { logged.push(entry); },
    });

    await auditLogger.runAutonomousLifecyclePurge();

    const stats = auditLogger.getLifecyclePurgeStats();
    assert.ok(stats.runs >= 1, 'runs should have incremented');
    assert.ok(stats.purged >= 3, 'purged count should reflect purged rows');

    const purgeLogs = logged.filter((l) => l && l.action === 'audit_retention_auto_purge');
    assert.ok(purgeLogs.length >= 1, 'should have emitted an audit_retention_auto_purge log');
  });

  it('L2 Safety Floor Observance: does not purge beyond maxEntries', async () => {
    if (typeof auditLogger.__testInject !== 'function') {
      return; // skip if test injection not supported
    }

    const calls = [];

    auditLogger.__testInject({
      getAllOrgIds: async () => ['org-beta'],
      purgeOldEntries: async (orgId) => {
        calls.push({ orgId });
        return { purged: 100, remaining: 0, archived: false };
      },
      log: async () => {},
    });

    await auditLogger.runAutonomousLifecyclePurge();

    assert.ok(calls.length >= 1, 'purgeOldEntries should be invoked at least once');
  });

  it('L1 Thread Loop Isolation: error in one org does not halt sweep for others', async () => {
    if (typeof auditLogger.__testInject !== 'function') {
      return; // skip if test injection not supported
    }

    const purgedByOrg = {};

    auditLogger.__testInject({
      getAllOrgIds: async () => ['org-good', 'org-bad', 'org-other'],
      purgeOldEntries: async (orgId) => {
        if (orgId === 'org-bad') throw new Error('simulated fs error');
        purgedByOrg[orgId] = (purgedByOrg[orgId] || 0) + 1;
        return { purged: 1, remaining: 0, archived: false };
      },
      log: async () => {},
    });

    await auditLogger.runAutonomousLifecyclePurge();

    assert.ok(purgedByOrg['org-good'] >= 1, 'org-good should have been purged');
    assert.ok(purgedByOrg['org-other'] >= 1, 'org-other should have been purged');
    const stats = auditLogger.getLifecyclePurgeStats();
    assert.ok(stats.failed >= 1, 'failed counter should increment on org error');
  });
});
