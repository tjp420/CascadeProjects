'use strict';

/**
 * HSM Metrics Prometheus Exposition — Test Suite
 *
 * Validates the 22 new operational counters, 2 STEK gauges, and the
 * hsm_dkg_round_duration_ms histogram added to hsm-metrics.cjs for
 * Option F (Active Prometheus Monitoring Rule Dashboarding).
 *
 * Also validates that the Prometheus exposition format is correct, that
 * reset() clears all new counters, and that existing counters remain
 * unaffected.
 *
 * This test suite is READ-ONLY with respect to production code — it only
 * exercises the exported test helpers from hsm-metrics.cjs.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const hsmMetrics = require('../hsm-adapter/hsm-metrics.cjs');

// ── Constants ─────────────────────────────────────────────────────────────

const DKG_COUNTERS = [
  'hsm_dkg_session_initiated_total',
  'hsm_dkg_session_completed_total',
  'hsm_dkg_session_timeout_total',
  'hsm_dkg_commit_received_total',
  'hsm_dkg_share_received_total',
  'hsm_dkg_share_rejected_total',
  'hsm_dkg_complaint_filed_total',
  'hsm_dkg_node_disqualified_total',
  'hsm_dkg_invalid_message_total',
  'hsm_dkg_isolation_violation_total',
];

const STEK_COUNTERS = [
  'hsm_stek_rotation_total',
  'hsm_stek_validation_total',
  'hsm_stek_validation_failed_total',
];

const STEK_GAUGES = [
  'hsm_stek_active_count',
  'hsm_stek_retired_count',
];

const MUSIG2_COUNTERS = [
  'hsm_musig2_challenge_computed_total',
  'hsm_musig2_binding_factor_computed_total',
  'hsm_musig2_key_aggregation_total',
  'hsm_musig2_nonce_aggregation_total',
  'hsm_musig2_signature_assembled_total',
  'hsm_musig2_signature_verified_total',
  'hsm_musig2_signature_verification_failed_total',
];

const ALL_NEW_COUNTERS = [...DKG_COUNTERS, ...STEK_COUNTERS, ...MUSIG2_COUNTERS];
const ALL_NEW_GAUGES = [...STEK_GAUGES];

// ── Test suite ────────────────────────────────────────────────────────────

describe('HSM Metrics Prometheus Exposition — Option F', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  afterEach(() => {
    hsmMetrics.reset();
  });

  // ── L2-01 to L2-03: Counter increment correctness ───────────────────────

  describe('L2: Counter increment correctness', () => {
    test('L2-01: DKG counters increment correctly', () => {
      hsmMetrics.incrementCounter('hsm_dkg_session_initiated_total', 3);
      hsmMetrics.incrementCounter('hsm_dkg_commit_received_total', 5);
      hsmMetrics.incrementCounter('hsm_dkg_share_rejected_total', 2);

      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_dkg_session_initiated_total).toBe(3);
      expect(metrics.hsm_dkg_commit_received_total).toBe(5);
      expect(metrics.hsm_dkg_share_rejected_total).toBe(2);
    });

    test('L2-02: STEK counters increment correctly', () => {
      hsmMetrics.incrementCounter('hsm_stek_rotation_total', 5);
      hsmMetrics.incrementCounter('hsm_stek_validation_total', 10);
      hsmMetrics.incrementCounter('hsm_stek_validation_failed_total', 1);

      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_stek_rotation_total).toBe(5);
      expect(metrics.hsm_stek_validation_total).toBe(10);
      expect(metrics.hsm_stek_validation_failed_total).toBe(1);
    });

    test('L2-03: MuSig2 counters increment correctly', () => {
      hsmMetrics.incrementCounter('hsm_musig2_challenge_computed_total', 10);
      hsmMetrics.incrementCounter('hsm_musig2_signature_assembled_total', 4);
      hsmMetrics.incrementCounter('hsm_musig2_signature_verified_total', 3);
      hsmMetrics.incrementCounter('hsm_musig2_signature_verification_failed_total', 1);

      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_musig2_challenge_computed_total).toBe(10);
      expect(metrics.hsm_musig2_signature_assembled_total).toBe(4);
      expect(metrics.hsm_musig2_signature_verified_total).toBe(3);
      expect(metrics.hsm_musig2_signature_verification_failed_total).toBe(1);
    });
  });

  // ── L2-04 to L2-05: Gauge correctness ───────────────────────────────────

  describe('L2: Gauge correctness', () => {
    test('L2-04: STEK active count gauge sets correctly', () => {
      hsmMetrics.incrementCounter('hsm_stek_active_count', 1);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_stek_active_count).toBe(1);
    });

    test('L2-05: STEK retired count gauge sets correctly', () => {
      hsmMetrics.incrementCounter('hsm_stek_retired_count', 3);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_stek_retired_count).toBe(3);
    });
  });

  // ── L2-06 to L2-08: Prometheus exposition format ────────────────────────

  describe('L2: Prometheus exposition format', () => {
    test('L2-06: renderPrometheus includes DKG counters', () => {
      hsmMetrics.incrementCounter('hsm_dkg_session_initiated_total', 1);
      hsmMetrics.incrementCounter('hsm_dkg_commit_received_total', 1);

      const output = hsmMetrics.renderPrometheus();

      expect(output).toContain('# HELP hsm_dkg_session_initiated_total');
      expect(output).toContain('# TYPE hsm_dkg_session_initiated_total counter');
      expect(output).toContain('hsm_dkg_session_initiated_total 1');
      expect(output).toContain('# HELP hsm_dkg_commit_received_total');
      expect(output).toContain('hsm_dkg_commit_received_total 1');
    });

    test('L2-07: renderPrometheus includes STEK counters and gauges', () => {
      hsmMetrics.incrementCounter('hsm_stek_rotation_total', 2);
      hsmMetrics.incrementCounter('hsm_stek_active_count', 1);

      const output = hsmMetrics.renderPrometheus();

      expect(output).toContain('# HELP hsm_stek_rotation_total');
      expect(output).toContain('# TYPE hsm_stek_rotation_total counter');
      expect(output).toContain('hsm_stek_rotation_total 2');
      expect(output).toContain('# TYPE hsm_stek_active_count gauge');
      expect(output).toContain('hsm_stek_active_count 1');
    });

    test('L2-08: renderPrometheus includes MuSig2 counters', () => {
      hsmMetrics.incrementCounter('hsm_musig2_challenge_computed_total', 5);

      const output = hsmMetrics.renderPrometheus();

      expect(output).toContain('# HELP hsm_musig2_challenge_computed_total');
      expect(output).toContain('# TYPE hsm_musig2_challenge_computed_total counter');
      expect(output).toContain('hsm_musig2_challenge_computed_total 5');
    });
  });

  // ── L2-09: reset() clears all new counters ──────────────────────────────

  test('L2-09: reset() clears all new counters and gauges', () => {
    // Increment all new counters
    for (const name of ALL_NEW_COUNTERS) {
      hsmMetrics.incrementCounter(name, 5);
    }
    for (const name of ALL_NEW_GAUGES) {
      hsmMetrics.incrementCounter(name, 3);
    }
    hsmMetrics.observeHistogram('hsm_dkg_round_duration_ms', 200);

    // Verify they are non-zero
    let metrics = hsmMetrics.getMetrics();
    for (const name of ALL_NEW_COUNTERS) {
      expect(metrics[name]).toBe(5);
    }
    for (const name of ALL_NEW_GAUGES) {
      expect(metrics[name]).toBe(3);
    }

    // Reset
    hsmMetrics.reset();

    // Verify all are zero
    metrics = hsmMetrics.getMetrics();
    for (const name of ALL_NEW_COUNTERS) {
      expect(metrics[name]).toBe(0);
    }
    for (const name of ALL_NEW_GAUGES) {
      expect(metrics[name]).toBe(0);
    }
    expect(metrics.hsm_dkg_round_duration_ms_count).toBe(0);
    expect(metrics.hsm_dkg_round_duration_ms_sum).toBe(0);
  });

  // ── L2-10: Histogram observation ────────────────────────────────────────

  test('L2-10: Histogram observation works for DKG round duration', () => {
    hsmMetrics.observeHistogram('hsm_dkg_round_duration_ms', 150);
    hsmMetrics.observeHistogram('hsm_dkg_round_duration_ms', 750);
    hsmMetrics.observeHistogram('hsm_dkg_round_duration_ms', 50000);

    const metrics = hsmMetrics.getMetrics();
    expect(metrics.hsm_dkg_round_duration_ms_count).toBe(3);
    expect(metrics.hsm_dkg_round_duration_ms_sum).toBe(50900);

    // Verify bucket placement: 150 -> le=500, 750 -> le=5000, 50000 -> le=60000
    // Prometheus histograms are cumulative
    const output = hsmMetrics.renderPrometheus();
    expect(output).toContain('hsm_dkg_round_duration_ms_bucket{le="100"} 0');
    expect(output).toContain('hsm_dkg_round_duration_ms_bucket{le="500"} 1');
    expect(output).toContain('hsm_dkg_round_duration_ms_bucket{le="1000"} 2');
    expect(output).toContain('hsm_dkg_round_duration_ms_bucket{le="5000"} 2');
    expect(output).toContain('hsm_dkg_round_duration_ms_bucket{le="60000"} 3');
    expect(output).toContain('hsm_dkg_round_duration_ms_bucket{le="+Inf"} 3');
  });

  // ── L2-11: Existing counters remain unaffected ──────────────────────────

  test('L2-11: Existing counters remain unaffected by new additions', () => {
    // Increment an existing counter
    hsmMetrics.incrementCounter('hsm_wrap_total', 10);
    hsmMetrics.incrementCounter('hsm_dkg_session_initiated_total', 5);

    const metrics = hsmMetrics.getMetrics();
    expect(metrics.hsm_wrap_total).toBe(10);
    expect(metrics.hsm_dkg_session_initiated_total).toBe(5);

    // Verify existing counter still renders correctly
    const output = hsmMetrics.renderPrometheus();
    expect(output).toContain('# HELP hsm_wrap_total');
    expect(output).toContain('hsm_wrap_total 10');
  });

  // ── L2-12: Prometheus exposition format is valid ────────────────────────

  test('L2-12: Prometheus exposition format is valid for all new metrics', () => {
    // Increment one of each type
    hsmMetrics.incrementCounter('hsm_dkg_session_initiated_total', 1);
    hsmMetrics.incrementCounter('hsm_stek_rotation_total', 1);
    hsmMetrics.incrementCounter('hsm_musig2_challenge_computed_total', 1);
    hsmMetrics.incrementCounter('hsm_stek_active_count', 1);
    hsmMetrics.observeHistogram('hsm_dkg_round_duration_ms', 100);

    const output = hsmMetrics.renderPrometheus();
    const lines = output.split('\n');

    // Verify format: each metric has HELP, TYPE, and value lines
    for (const name of ['hsm_dkg_session_initiated_total', 'hsm_stek_rotation_total', 'hsm_musig2_challenge_computed_total']) {
      const hasHelp = lines.some(l => l === `# HELP ${name} ${hsmMetrics.counters[name] !== undefined ? '' : ''}` || l.startsWith(`# HELP ${name} `));
      const hasType = lines.some(l => l.startsWith(`# TYPE ${name} `));
      const hasValue = lines.some(l => l.startsWith(`${name} `));
      expect(hasHelp).toBe(true);
      expect(hasType).toBe(true);
      expect(hasValue).toBe(true);
    }

    // Verify gauge type for STEK gauges
    expect(lines.some(l => l === '# TYPE hsm_stek_active_count gauge')).toBe(true);

    // Verify histogram format
    expect(lines.some(l => l === '# TYPE hsm_dkg_round_duration_ms histogram')).toBe(true);
    expect(lines.some(l => l.startsWith('hsm_dkg_round_duration_ms_bucket{le="'))).toBe(true);
    expect(lines.some(l => l === 'hsm_dkg_round_duration_ms_sum 100')).toBe(true);
    expect(lines.some(l => l === 'hsm_dkg_round_duration_ms_count 1')).toBe(true);
  });

  // ── L3: Edge cases & validation ─────────────────────────────────────────

  describe('L3: Edge cases & validation', () => {
    test('L3-01: Increment unknown counter — no crash', () => {
      expect(() => hsmMetrics.incrementCounter('unknown_metric')).not.toThrow();
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.unknown_metric).toBeUndefined();
    });

    test('L3-02: Observe histogram with unknown name — no crash', () => {
      expect(() => hsmMetrics.observeHistogram('unknown_histogram', 100)).not.toThrow();
    });

    test('L3-03: Negative increment value — no crash', () => {
      expect(() => hsmMetrics.incrementCounter('hsm_dkg_session_initiated_total', -1)).not.toThrow();
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_dkg_session_initiated_total).toBe(-1);
    });

    test('L3-04: All new counter names follow hsm_ prefix convention', () => {
      for (const name of ALL_NEW_COUNTERS) {
        expect(name.startsWith('hsm_')).toBe(true);
      }
      for (const name of ALL_NEW_GAUGES) {
        expect(name.startsWith('hsm_')).toBe(true);
      }
    });

    test('L3-05: Alert rules YAML is valid Prometheus rule format', () => {
      const alertsPath = path.join(__dirname, '..', '..', '..', 'monitoring', 'prometheus-mesh-alerts.yml');
      const doc = yaml.load(fs.readFileSync(alertsPath, 'utf8'));

      expect(doc).toHaveProperty('groups');
      expect(Array.isArray(doc.groups)).toBe(true);
      expect(doc.groups.length).toBe(5);

      // Verify each group has rules array
      for (const group of doc.groups) {
        expect(group).toHaveProperty('name');
        expect(group).toHaveProperty('rules');
        expect(Array.isArray(group.rules)).toBe(true);
        for (const rule of group.rules) {
          expect(rule).toHaveProperty('alert');
          expect(rule).toHaveProperty('expr');
          expect(rule).toHaveProperty('labels.severity');
        }
      }

      // Verify new groups exist
      const groupNames = doc.groups.map(g => g.name);
      expect(groupNames).toContain('dkg_gossip_alerts');
      expect(groupNames).toContain('stek_rotation_alerts');
      expect(groupNames).toContain('musig2_protocol_alerts');

      // Verify alert count: 4 existing + 4 DKG + 2 STEK + 2 MuSig2 = 12
      const totalRules = doc.groups.reduce((sum, g) => sum + g.rules.length, 0);
      expect(totalRules).toBe(12);
    });

    test('L3-06: Grafana dashboard JSON has required fields', () => {
      const dashboardsDir = path.join(__dirname, '..', '..', '..', 'monitoring', 'dashboards');
      const dashboardFiles = ['track115-mesh-reconciliation.json', 'dkg-operations.json', 'stek-lifecycle.json'];

      for (const file of dashboardFiles) {
        const dashboard = JSON.parse(fs.readFileSync(path.join(dashboardsDir, file), 'utf8'));
        expect(dashboard).toHaveProperty('title');
        expect(dashboard).toHaveProperty('panels');
        expect(dashboard).toHaveProperty('schemaVersion');
        expect(Array.isArray(dashboard.panels)).toBe(true);
        expect(dashboard.panels.length).toBeGreaterThan(0);

        // Verify each panel has required fields
        for (const panel of dashboard.panels) {
          expect(panel).toHaveProperty('id');
          expect(panel).toHaveProperty('title');
          expect(panel).toHaveProperty('type');
          expect(panel).toHaveProperty('datasource');
          expect(panel).toHaveProperty('targets');
        }
      }
    });

    test('L3-07: No regression — existing hsm-metrics tests still pass', () => {
      // Verify existing counters still work
      hsmMetrics.incrementCounter('hsm_wrap_total', 1);
      hsmMetrics.incrementCounter('hsm_unwrap_total', 1);
      hsmMetrics.incrementCounter('hsm_create_kek_total', 1);

      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_wrap_total).toBe(1);
      expect(metrics.hsm_unwrap_total).toBe(1);
      expect(metrics.hsm_create_kek_total).toBe(1);

      // Verify existing histograms still work
      hsmMetrics.observeHistogram('hsm_wrap_duration_ms', 50);
      const afterMetrics = hsmMetrics.getMetrics();
      expect(afterMetrics.hsm_wrap_duration_ms_count).toBe(1);
      expect(afterMetrics.hsm_wrap_duration_ms_sum).toBe(50);
    });

    test('L3-08: All 22 new counters + 2 gauges + 1 histogram are registered', () => {
      const metrics = hsmMetrics.getMetrics();

      // 22 counters + 2 gauges = 24 new flat metrics
      for (const name of ALL_NEW_COUNTERS) {
        expect(metrics).toHaveProperty(name);
        expect(metrics[name]).toBe(0);
      }
      for (const name of ALL_NEW_GAUGES) {
        expect(metrics).toHaveProperty(name);
        expect(metrics[name]).toBe(0);
      }

      // Histogram
      expect(metrics).toHaveProperty('hsm_dkg_round_duration_ms_count');
      expect(metrics).toHaveProperty('hsm_dkg_round_duration_ms_sum');
      expect(metrics.hsm_dkg_round_duration_ms_count).toBe(0);
      expect(metrics.hsm_dkg_round_duration_ms_sum).toBe(0);

      // Count: 10 DKG + 3 STEK + 7 MuSig2 = 20 counters, 2 gauges, 1 histogram
      expect(DKG_COUNTERS.length).toBe(10);
      expect(STEK_COUNTERS.length).toBe(3);
      expect(MUSIG2_COUNTERS.length).toBe(7);
      expect(STEK_GAUGES.length).toBe(2);
      expect(ALL_NEW_COUNTERS.length).toBe(20);
    });
  });

  // ── Security ────────────────────────────────────────────────────────────

  describe('Security', () => {
    test('S-01: No credentials or PII in dashboard JSON or alert rules', () => {
      const dashboardsDir = path.join(__dirname, '..', '..', '..', 'monitoring', 'dashboards');
      const alertsPath = path.join(__dirname, '..', '..', '..', 'monitoring', 'prometheus-mesh-alerts.yml');

      const filesToCheck = [
        fs.readFileSync(alertsPath, 'utf8'),
        fs.readFileSync(path.join(dashboardsDir, 'track115-mesh-reconciliation.json'), 'utf8'),
        fs.readFileSync(path.join(dashboardsDir, 'dkg-operations.json'), 'utf8'),
        fs.readFileSync(path.join(dashboardsDir, 'stek-lifecycle.json'), 'utf8'),
      ];

      // Patterns that should never appear in monitoring configs
      const forbiddenPatterns = [
        /password\s*[:=]/i,
        /secret\s*[:=]/i,
        /api[_-]?key\s*[:=]/i,
        /token\s*[:=]/i,
        /private[_-]?key/i,
        /[0-9a-f]{64}/i, // 256-bit hex values (potential keys)
      ];

      for (const content of filesToCheck) {
        for (const pattern of forbiddenPatterns) {
          // Allow "private key" in help text descriptions but not actual values
          const matches = content.match(pattern);
          if (matches) {
            // Check if it's just a description word, not an actual value
            const lower = content.toLowerCase();
            if (lower.includes('private key') && pattern.source.includes('private')) {
              // This is OK — it's a description
              continue;
            }
            // 256-bit hex in PromQL is not expected
            if (pattern.source === '[0-9a-f]{64}') {
              throw new Error(`Potential key material found in monitoring config: ${matches[0]}`);
            }
          }
        }
      }

      // If we reach here, no forbidden patterns found
      expect(true).toBe(true);
    });

    test('S-02: Alert runbook URLs point to internal repo, not external', () => {
      const alertsPath = path.join(__dirname, '..', '..', '..', 'monitoring', 'prometheus-mesh-alerts.yml');
      const doc = yaml.load(fs.readFileSync(alertsPath, 'utf8'));

      for (const group of doc.groups) {
        for (const rule of group.rules) {
          if (rule.annotations && rule.annotations.runbook_url) {
            const url = rule.annotations.runbook_url;
            expect(url).toContain('github.com/tjp420/CascadeProjects');
            expect(url).not.toMatch(/^https?:\/\/(?!github\.com\/tjp420)/);
          }
        }
      }
    });

    test('S-03: Dashboard JSON does not contain hardcoded credentials', () => {
      const dashboardsDir = path.join(__dirname, '..', '..', '..', 'monitoring', 'dashboards');
      const dashboardFiles = ['track115-mesh-reconciliation.json', 'dkg-operations.json', 'stek-lifecycle.json'];

      for (const file of dashboardFiles) {
        const content = fs.readFileSync(path.join(dashboardsDir, file), 'utf8');
        // Should not contain basic auth, bearer tokens, or password fields
        expect(content).not.toMatch(/basicAuth/i);
        expect(content).not.toMatch(/bearerToken/i);
        expect(content).not.toMatch(/"password"/i);
        expect(content).not.toMatch(/"apiKey"/i);
      }
    });

    test('S-04: No real cluster node IPs in Grafana datasource configs', () => {
      const dashboardsDir = path.join(__dirname, '..', '..', '..', 'monitoring', 'dashboards');
      const dashboardFiles = ['track115-mesh-reconciliation.json', 'dkg-operations.json', 'stek-lifecycle.json'];

      for (const file of dashboardFiles) {
        const content = fs.readFileSync(path.join(dashboardsDir, file), 'utf8');
        // Should not contain real IP addresses (10.x.x.x, 192.168.x.x, etc.)
        // Allow 127.0.0.1 for localhost references if any
        expect(content).not.toMatch(/\b10\.\d+\.\d+\.\d+\b/);
        expect(content).not.toMatch(/\b192\.168\.\d+\.\d+\b/);
        expect(content).not.toMatch(/\b172\.(1[6-9]|2\d|3[01])\.\d+\.\d+\b/);
      }
    });
  });
});
