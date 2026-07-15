'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { buildCiTelemetryPayload } = require('../src/lib/ci-telemetry');

describe('ci-telemetry', () => {
  test('buildCiTelemetryPayload extracts gate and severity metadata only', () => {
    const report = {
      gate: { pass: false, blockingCount: 2 },
      severityCounts: { critical: 1, high: 1, medium: 3 },
      totalFiles: 12,
      qualityScore: 88,
      scanScope: { diffOnly: true, diffFileCount: 4 }
    };
    const payload = buildCiTelemetryPayload(report, { paid: true, tier: 'team' }, {
      repository: 'acme/widget',
      workflow: 'SimpleBeacon Gate'
    });
    assert.equal(payload.gate_pass, false);
    assert.equal(payload.gates_tripped, 1);
    assert.equal(payload.critical_blocked, 1);
    assert.equal(payload.high_blocked, 1);
    assert.equal(payload.diff_only, true);
    assert.equal(payload.diff_files, 4);
    assert.equal(payload.repository, 'acme/widget');
    assert.equal(payload.tier, 'team');
    assert.equal(payload.event, 'pipeline_scan');
  });

  test('buildCiTelemetryPayload marks pass when gate clean', () => {
    const payload = buildCiTelemetryPayload(
      { gate: { pass: true, blockingCount: 0 }, severityCounts: {} },
      { tier: 'developer' }
    );
    assert.equal(payload.gate_pass, true);
    assert.equal(payload.gates_tripped, 0);
  });
});
