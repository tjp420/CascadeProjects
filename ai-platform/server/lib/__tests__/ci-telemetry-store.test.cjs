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
    // Forcibly drop stale compiled module cache so module re-reads env in each test
    delete require.cache[require.resolve('../ci-telemetry-store.cjs')];
    delete process.env.SIMPLEBEACON_CI_TELEMETRY_LEGACY_FIELDS;
  });

  afterEach(() => {
    delete process.env.SIMPLEBEACON_CI_TELEMETRY_STORE;
    delete process.env.SIMPLEBEACON_CI_TELEMETRY_LEGACY_FIELDS;
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
      diff_files: 14
    });
    recordCiTelemetryEvent('team@example.com', {
      workspace_fingerprint: 'abc123def4567890abcdef12',
      gate_pass: true,
      diff_files: 3
    });
    recordCiTelemetryEvent('other@example.com', {
      workspace_fingerprint: 'fedcba9876543210fedcba98',
      gate_pass: false
    });

    const summary = summarizeCiTelemetry('team@example.com', { days: 7 });
    assert.strictEqual(summary.total_scans, 2);
    assert.strictEqual(summary.repositories, 2);
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

  it('strips forbidden fields and hashes raw repository into workspace fingerprint', () => {
    const {
      sanitizeTeamTelemetryPayload,
      hashWorkspaceFingerprint
    } = require('../ci-telemetry-store.cjs');
    const rawRepo = 'acme/private-repo';
    const { payload, stripped, rejected } = sanitizeTeamTelemetryPayload({
      event: 'team_scan',
      scan_source: 'ci',
      gate_pass: true,
      repository: rawRepo,
      file_path: '/secret/src/app.js',
      quality_score: 91
    });

    assert.deepStrictEqual(rejected, ['file_path']);
    assert.ok(stripped.includes('repository'));
    assert.strictEqual(payload.workspace_fingerprint, hashWorkspaceFingerprint(rawRepo));
    assert.strictEqual(payload.repository, undefined);
    assert.strictEqual(payload.quality_score, 91);
  });

  it('resolves org key from subscription certOrgId', () => {
    const { resolveOrgKey, accountKey } = require('../ci-telemetry-store.cjs');
    const email = 'team@example.com';
    const withOrg = resolveOrgKey(email, { certOrgId: 'org-acme' });
    const withoutOrg = resolveOrgKey(email, null);
    assert.notStrictEqual(withOrg, accountKey(email));
    assert.strictEqual(typeof withOrg, 'string');
    assert.strictEqual(withOrg.length, 16);
    assert.strictEqual(typeof withoutOrg, 'string');
  });

  it('stores orgKey on recorded events', () => {
    const { recordCiTelemetryEvent, resolveOrgKey } = require('../ci-telemetry-store.cjs');
    const event = recordCiTelemetryEvent('team@example.com', {
      event: 'team_scan',
      scan_source: 'ci',
      workspace_fingerprint: 'abc123def4567890abcdef12',
      gate_pass: true
    }, {
      subscription: { certOrgId: 'org-acme' }
    });
    assert.strictEqual(event.orgKey, resolveOrgKey('team@example.com', { certOrgId: 'org-acme' }));
  });

  it('does not persist raw email on recorded events (D-03)', () => {
    const { recordCiTelemetryEvent, accountKey, resolveOrgKey } = require('../ci-telemetry-store.cjs');
    const email = 'privacy@example.com';
    const event = recordCiTelemetryEvent(email, {
      event: 'team_scan',
      scan_source: 'ci',
      workspace_fingerprint: 'abc123def4567890abcdef12',
      gate_pass: true,
      email: 'attacker@evil.com'
    }, {
      subscription: { certOrgId: 'org-privacy' }
    });
    assert.strictEqual(event.email, undefined);
    assert.ok(!Object.prototype.hasOwnProperty.call(event, 'email'));
    assert.strictEqual(event.accountKey, accountKey(email));
    assert.strictEqual(event.orgKey, resolveOrgKey(email, { certOrgId: 'org-privacy' }));

    const stored = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const last = stored.events[stored.events.length - 1];
    assert.strictEqual(last.email, undefined);
    assert.ok(!JSON.stringify(last).includes(email));
    assert.ok(!JSON.stringify(last).includes('attacker@evil.com'));
  });

  it('exports privacy constants for Phase 2 rollup', () => {
    const {
      TEAM_TELEMETRY_RETENTION_DAYS,
      K_ANONYMITY_MIN_WORKSPACES
    } = require('../ci-telemetry-store.cjs');
    assert.strictEqual(TEAM_TELEMETRY_RETENTION_DAYS, 90);
    assert.strictEqual(K_ANONYMITY_MIN_WORKSPACES, 3);
  });

  it('computes linear-interpolation percentiles on a known dataset', () => {
    const { percentileLinear, computeQualityDistribution } = require('../ci-telemetry-store.cjs');
    const sorted = [10, 20, 30, 40, 50];
    assert.strictEqual(percentileLinear(sorted, 0), 10);
    assert.strictEqual(percentileLinear(sorted, 100), 50);
    assert.strictEqual(percentileLinear(sorted, 50), 30);
    assert.strictEqual(percentileLinear(sorted, 25), 20);
    assert.strictEqual(percentileLinear(sorted, 75), 40);

    const distribution = computeQualityDistribution([
      { quality_score: 10 },
      { quality_score: 20 },
      { quality_score: 30 },
      { quality_score: 40 },
      { quality_score: 50 }
    ]);
    assert.strictEqual(distribution.sampleSize, 5);
    assert.strictEqual(distribution.p50, 30);
    assert.strictEqual(distribution.p25, 20);
    assert.strictEqual(distribution.p75, 40);
  });

  it('excludes null quality scores from distribution but counts scans in totals', () => {
    const { recordCiTelemetryEvent, summarizeTeamTelemetry, resolveOrgKey } = require('../ci-telemetry-store.cjs');
    const orgKey = resolveOrgKey('team@example.com', { certOrgId: 'org-acme' });
    recordCiTelemetryEvent('team@example.com', {
      workspace_fingerprint: 'abc123def4567890abcdef12',
      gate_pass: true,
      quality_score: 80,
      scan_source: 'ci'
    }, { orgKey, subscription: { certOrgId: 'org-acme' } });
    recordCiTelemetryEvent('team@example.com', {
      workspace_fingerprint: 'abc123def4567890abcdef13',
      gate_pass: true,
      quality_score: null,
      scan_source: 'ci'
    }, { orgKey, subscription: { certOrgId: 'org-acme' } });
    recordCiTelemetryEvent('team@example.com', {
      workspace_fingerprint: 'abc123def4567890abcdef14',
      gate_pass: true,
      quality_score: 90,
      scan_source: 'ci'
    }, { orgKey, subscription: { certOrgId: 'org-acme' } });

    const summary = summarizeTeamTelemetry(orgKey, { days: 7, minWorkspaces: 3 });
    assert.strictEqual(summary.total_scans, 3);
    assert.strictEqual(summary.quality_distribution.sampleSize, 2);
    assert.strictEqual(summary.quality_distribution.p50, 85);
  });

  it('redacts workspace breakdown when k-anonymity is not met', () => {
    const { recordCiTelemetryEvent, summarizeTeamTelemetry, resolveOrgKey } = require('../ci-telemetry-store.cjs');
    const orgKey = resolveOrgKey('team@example.com', { certOrgId: 'org-small' });
    recordCiTelemetryEvent('team@example.com', {
      workspace_fingerprint: 'abc123def4567890abcdef12',
      gate_pass: true,
      quality_score: 88,
      scan_source: 'ci'
    }, { orgKey, subscription: { certOrgId: 'org-small' } });
    recordCiTelemetryEvent('team@example.com', {
      workspace_fingerprint: 'abc123def4567890abcdef13',
      gate_pass: false,
      quality_score: 72,
      scan_source: 'ide'
    }, { orgKey, subscription: { certOrgId: 'org-small' } });

    const summary = summarizeTeamTelemetry(orgKey, { days: 7, minWorkspaces: 3 });
    assert.strictEqual(summary.distinct_workspaces, 2);
    assert.strictEqual(summary.k_anonymity_met, false);
    assert.strictEqual(summary.workspace_breakdown, undefined);
    assert.strictEqual(summary.total_scans, 2);
    assert.strictEqual(summary.scan_sources.ci, 1);
    assert.strictEqual(summary.scan_sources.ide, 1);
  });

  it('includes workspace breakdown when k-anonymity is met', () => {
    const { recordCiTelemetryEvent, summarizeTeamTelemetry, resolveOrgKey } = require('../ci-telemetry-store.cjs');
    const orgKey = resolveOrgKey('team@example.com', { certOrgId: 'org-large' });
    const fingerprints = [
      'abc123def4567890abcdef12',
      'abc123def4567890abcdef13',
      'abc123def4567890abcdef14'
    ];
    for (const fingerprint of fingerprints) {
      recordCiTelemetryEvent('team@example.com', {
        workspace_fingerprint: fingerprint,
        gate_pass: true,
        quality_score: 85,
        scan_source: 'dashboard'
      }, { orgKey, subscription: { certOrgId: 'org-large' } });
    }

    const summary = summarizeTeamTelemetry(orgKey, { days: 7, minWorkspaces: 3 });
    assert.strictEqual(summary.k_anonymity_met, true);
    assert.strictEqual(summary.workspace_breakdown.length, 3);
  });

  it('buckets team trend by day with gate pass rates', () => {
    const fs = require('fs');
    const { getTeamTrend, resolveOrgKey } = require('../ci-telemetry-store.cjs');
    const orgKey = resolveOrgKey('team@example.com', { certOrgId: 'org-trend' });
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));

    fs.writeFileSync(storePath, `${JSON.stringify({
      events: [
        {
          id: 'ci_test_1',
          orgKey,
          recordedAt: today.toISOString(),
          gate_pass: true,
          scan_source: 'ci',
          workspace_fingerprint: 'abc123def4567890abcdef12'
        },
        {
          id: 'ci_test_2',
          orgKey,
          recordedAt: today.toISOString(),
          gate_pass: false,
          scan_source: 'ci',
          workspace_fingerprint: 'abc123def4567890abcdef13'
        },
        {
          id: 'ci_test_3',
          orgKey,
          recordedAt: yesterday.toISOString(),
          gate_pass: true,
          scan_source: 'ide',
          workspace_fingerprint: 'abc123def4567890abcdef14'
        }
      ]
    }, null, 2)}\n`, 'utf8');
    delete require.cache[require.resolve('../ci-telemetry-store.cjs')];

    const trend = getTeamTrend(orgKey, { days: 2, granularity: 'day' });
    assert.strictEqual(trend.length, 2);
    const todayBucket = trend.find((row) => row.date === today.toISOString().slice(0, 10));
    const yesterdayBucket = trend.find((row) => row.date === yesterday.toISOString().slice(0, 10));
    assert.ok(todayBucket);
    assert.ok(yesterdayBucket);
    assert.strictEqual(todayBucket.scan_count, 2);
    assert.strictEqual(todayBucket.gate_pass_count, 1);
    assert.strictEqual(todayBucket.gate_pass_rate, 0.5);
    assert.strictEqual(yesterdayBucket.scan_count, 1);
    assert.strictEqual(yesterdayBucket.gate_pass_rate, 1);
  });

  it('summarizeCiTelemetry remains backward compatible for email-based summary', () => {
    const { recordCiTelemetryEvent, summarizeCiTelemetry, summarizeTeamTelemetry, resolveOrgKey } = require('../ci-telemetry-store.cjs');
    recordCiTelemetryEvent('team@example.com', {
      repository: 'acme/app',
      gate_pass: false,
      gates_tripped: 1,
      critical_blocked: 2,
      diff_files: 14
    });
    recordCiTelemetryEvent('team@example.com', {
      workspace_fingerprint: 'abc123def4567890abcdef12',
      gate_pass: true,
      diff_files: 3
    });

    const emailSummary = summarizeCiTelemetry('team@example.com', { days: 7 });
    assert.strictEqual(emailSummary.total_scans, 2);
    assert.strictEqual(emailSummary.repositories, 2);
    assert.strictEqual(emailSummary.gates_tripped, 1);
    assert.strictEqual(emailSummary.criticals_blocked, 2);
    assert.strictEqual(emailSummary.diffs_analyzed, 17);
    assert.strictEqual(emailSummary.merges_blocked_this_week, 1);
    assert.strictEqual(emailSummary.periodDays, 7);
    assert.ok(emailSummary.updatedAt);

    const orgKey = resolveOrgKey('team@example.com', { certOrgId: 'org-acme' });
    const teamSummary = summarizeTeamTelemetry(orgKey, { days: 7 });
    assert.strictEqual(typeof teamSummary.gate_pass_rate, 'number');
    assert.ok(teamSummary.quality_distribution);
    assert.ok(teamSummary.severity_totals);
    assert.ok(teamSummary.scan_sources);
    assert.strictEqual(typeof teamSummary.k_anonymity_met, 'boolean');
  });
});
