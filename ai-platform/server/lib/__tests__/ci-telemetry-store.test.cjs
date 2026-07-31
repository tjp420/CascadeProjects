const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('ci-telemetry-store', () => {
  let tmpDir;
  let storePath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-ci-telemetry-'));
    storePath = path.join(tmpDir, 'ci-telemetry.json');
    process.env.SIMPLEBEACON_CI_TELEMETRY_STORE = storePath;
  });

  afterEach(() => {
    delete process.env.SIMPLEBEACON_CI_TELEMETRY_STORE;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete require.cache[require.resolve('../ci-telemetry-store.cjs')];
  });

  it('records and summarizes events for an account', () => {
    const { recordCiTelemetryEvent, summarizeCiTelemetry } = require('../ci-telemetry-store.cjs');
    recordCiTelemetryEvent('team@example.com', {
      repository: 'acme/app',
      gate_pass: false,
      gates_tripped: 1,
      critical_blocked: 2,
      diff_files: 14,
    });
    recordCiTelemetryEvent('team@example.com', {
      repository: 'acme/app',
      gate_pass: true,
      diff_files: 3,
    });
    recordCiTelemetryEvent('other@example.com', {
      repository: 'other/repo',
      gate_pass: false,
    });

    const summary = summarizeCiTelemetry('team@example.com', { days: 7 });
    assert.strictEqual(summary.total_scans, 2);
    assert.strictEqual(summary.repositories, 1);
    assert.strictEqual(summary.gates_tripped, 1);
    assert.strictEqual(summary.criticals_blocked, 2);
    assert.strictEqual(summary.diffs_analyzed, 17);
    assert.strictEqual(summary.periodDays, 7);
  });

  it('returns empty summary when no events exist', () => {
    const { summarizeCiTelemetry } = require('../ci-telemetry-store.cjs');
    const summary = summarizeCiTelemetry('nobody@example.com', { days: 7 });
    assert.strictEqual(summary.total_scans, 0);
    assert.strictEqual(summary.repositories, 0);
    assert.strictEqual(summary.gates_tripped, 0);
  });
});
