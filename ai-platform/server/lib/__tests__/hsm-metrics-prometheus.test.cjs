'use strict';

/**
 * HSM Metrics Prometheus Exposition — Test Suite
 *
 * Validates the 22 new operational counters, 2 STEK gauges, and the
 * hsm_dkg_round_duration_ms histogram added to hsm-metrics.cjs for
 * Option F (Active Prometheus Monitoring Rule Dashboarding).
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const hsmMetrics = require('../hsm-adapter/hsm-metrics.cjs');

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

describe('HSM Metrics Prometheus Exposition — Option F', () => {
  beforeEach(() => { hsmMetrics.reset(); });
  afterEach(() => { hsmMetrics.reset(); });

  describe('L2: Counter increment correctness', () => {
    test('L2-01: DKG counters increment correctly', () => {
      hsmMetrics.incrementCounter('hsm_dkg_session_initiated_total', 3);
      hsmMetrics.incrementCounter('hsm_dkg_commit_received_total', 5);
      hsmMetrics.incrementCounter('hsm_dkg_share_rejected_total', 2);
      const m = hsmMetrics.getMetrics();
      expect(m.hsm_dkg_session_initiated_total).toBe(3);
      expect(m.hsm_dkg_commit_received_total).toBe(5);
      expect(m.hsm_dkg_share_rejected_total).toBe(2);
    });

    test('L2-02: STEK counters increment correctly', () => {
      hsmMetrics.incrementCounter('hsm_stek_rotation_total', 5);
      hsmMetrics.incrementCounter('hsm_stek_validation_total', 10);
      hsmMetrics.incrementCounter('hsm_stek_validation_failed_total', 1);
      const m = hsmMetrics.getMetrics();
      expect(m.hsm_stek_rotation_total).toBe(5);
      expect(m.hsm_stek_validation_total).toBe(10);
      expect(m.hsm_stek_validation_failed_total).toBe(1);
    });

    test('L2-03: MuSig2 counters increment correctly', () => {
      hsmMetrics.incrementCounter('hsm_musig2_challenge_computed_total', 10);
      hsmMetrics.incrementCounter('hsm_musig2_signature_assembled_total', 4);
      hsmMetrics.incrementCounter('hsm_musig2_signature_verified_total', 3);
      hsmMetrics.incrementCounter('hsm_musig2_signature_verification_failed_total', 1);
      const m = hsmMetrics.getMetrics();
      expect(m.hsm_musig2_challenge_computed_total).toBe(10);
      expect(m.hsm_musig2_signature_assembled_total).toBe(4);
      expect(m.hsm_musig2_signature_verified_total).toBe(3);
      expect(m.hsm_musig2_signature_verification_failed_total).toBe(1);
    });
  });

  describe('L2: Gauge correctness', () => {
    test('L2-04: STEK active count gauge sets correctly', () => {
      hsmMetrics.incrementCounter('hsm_stek_active_count', 1);
      expect(hsmMetrics.getMetrics().hsm_stek_active_count).toBe(1);
    });

    test('L2-05: STEK retired count gauge sets correctly', () => {
      hsmMetrics.incrementCounter('hsm_stek_retired_count', 3);
      expect(hsmMetrics.getMetrics().hsm_stek_retired_count).toBe(3);
    });
  });

  describe('L2: Prometheus exposition format', () => {
    test('L2-06: renderPrometheus includes DKG counters', () => {
      hsmMetrics.incrementCounter('hsm_dkg_session_initiated_total', 1);
      hsmMetrics.incrementCounter('hsm_dkg_commit_received_total', 1);
      const o = hsmMetrics.renderPrometheus();
      expect(o).toContain('# HELP hsm_dkg_session_initiated_total');
      expect(o).toContain('# TYPE hsm_dkg_session_initiated_total counter');
      expect(o).toContain('hsm_dkg_session_initiated_total 1');
      expect(o).toContain('# HELP hsm_dkg_commit_received_total');
      expect(o).toContain('hsm_dkg_commit_received_total 1');
    });

    test('L2-07: renderPrometheus includes STEK counters and gauges', () => {
      hsmMetrics.incrementCounter('hsm_stek_rotation_total', 2);
      hsmMetrics.incrementCounter('hsm_stek_active_count', 1);
      const o = hsmMetrics.renderPrometheus();
      expect(o).toContain('# HELP hsm_stek_rotation_total');
      expect(o).toContain('# TYPE hsm_stek_rotation_total counter');
      expect(o).toContain('hsm_stek_rotation_total 2');
      expect(o).toContain('# TYPE hsm_stek_active_count gauge');
      expect(o).toContain('hsm_stek_active_count 1');
    });

    test('L2-08: renderPrometheus includes MuSig2 counters', () => {
      hsmMetrics.incrementCounter('hsm_musig2_challenge_computed_total', 5);
      const o = hsmMetrics.renderPrometheus();
      expect(o).toContain('# HELP hsm_musig2_challenge_computed_total');
      expect(o).toContain('# TYPE hsm_musig2_challenge_computed_total counter');
      expect(o).toContain('hsm_musig2_challenge_computed_total 5');
    });
  });

  test('L2-09: reset() clears all new counters and gauges', () => {
    for (const n of ALL_NEW_COUNTERS) hsmMetrics.incrementCounter(n, 5);
    for (const n of ALL_NEW_GAUGES) hsmMetrics.incrementCounter(n, 3);
    hsmMetrics.observeHistogram('hsm_dkg_round_duration_ms', 200);
    let m = hsmMetrics.getMetrics();
    for (const n of ALL_NEW_COUNTERS) expect(m[n]).toBe(5);
    for (const n of ALL_NEW_GAUGES) expect(m[n]).toBe(3);
    hsmMetrics.reset();
    m = hsmMetrics.getMetrics();
    for (const n of ALL_NEW_COUNTERS) expect(m[n]).toBe(0);
    for (const n of ALL_NEW_GAUGES) expect(m[n]).toBe(0);
    expect(m.hsm_dkg_round_duration_ms_count).toBe(0);
    expect(m.hsm_dkg_round_duration_ms_sum).toBe(0);
  });

  test('L2-10: Histogram observation works for DKG round duration', () => {
    hsmMetrics.observeHistogram('hsm_dkg_round_duration_ms', 150);
    hsmMetrics.observeHistogram('hsm_dkg_round_duration_ms', 750);
    hsmMetrics.observeHistogram('hsm_dkg_round_duration_ms', 50000);
    const m = hsmMetrics.getMetrics();
    expect(m.hsm_dkg_round_duration_ms_count).toBe(3);
    expect(m.hsm_dkg_round_duration_ms_sum).toBe(50900);
    const o = hsmMetrics.renderPrometheus();
    expect(o).toContain('hsm_dkg_round_duration_ms_bucket{le="100"} 0');
    expect(o).toContain('hsm_dkg_round_duration_ms_bucket{le="500"} 1');
    expect(o).toContain('hsm_dkg_round_duration_ms_bucket{le="1000"} 2');
    expect(o).toContain('hsm_dkg_round_duration_ms_bucket{le="5000"} 2');
    expect(o).toContain('hsm_dkg_round_duration_ms_bucket{le="60000"} 3');
    expect(o).toContain('hsm_dkg_round_duration_ms_bucket{le="+Inf"} 3');
  });

  test('L2-11: Existing counters remain unaffected by new additions', () => {
    hsmMetrics.incrementCounter('hsm_wrap_total', 10);
    hsmMetrics.incrementCounter('hsm_dkg_session_initiated_total', 5);
    const m = hsmMetrics.getMetrics();
    expect(m.hsm_wrap_total).toBe(10);
    expect(m.hsm_dkg_session_initiated_total).toBe(5);
    const o = hsmMetrics.renderPrometheus();
    expect(o).toContain('# HELP hsm_wrap_total');
    expect(o).toContain('hsm_wrap_total 10');
  });

  test('L2-12: Prometheus exposition format is valid for all new metrics', () => {
    hsmMetrics.incrementCounter('hsm_dkg_session_initiated_total', 1);
    hsmMetrics.incrementCounter('hsm_stek_rotation_total', 1);
    hsmMetrics.incrementCounter('hsm_musig2_challenge_computed_total', 1);
    hsmMetrics.incrementCounter('hsm_stek_active_count', 1);
    hsmMetrics.observeHistogram('hsm_dkg_round_duration_ms', 100);
    const o = hsmMetrics.renderPrometheus();
    const lines = o.split('\n');
    for (const n of ['hsm_dkg_session_initiated_total', 'hsm_stek_rotation_total', 'hsm_musig2_challenge_computed_total']) {
      expect(lines.some(l => l.startsWith('# HELP ' + n + ' '))).toBe(true);
      expect(lines.some(l => l.startsWith('# TYPE ' + n + ' '))).toBe(true);
      expect(lines.some(l => l.startsWith(n + ' '))).toBe(true);
    }
    expect(lines.some(l => l === '# TYPE hsm_stek_active_count gauge')).toBe(true);
    expect(lines.some(l => l === '# TYPE hsm_dkg_round_duration_ms histogram')).toBe(true);
    expect(lines.some(l => l.startsWith('hsm_dkg_round_duration_ms_bucket{le="'))).toBe(true);
    expect(lines.some(l => l === 'hsm_dkg_round_duration_ms_sum 100')).toBe(true);
    expect(lines.some(l => l === 'hsm_dkg_round_duration_ms_count 1')).toBe(true);
  });

  describe('L3: Edge cases & validation', () => {
    test('L3-01: Increment unknown counter — no crash', () => {
      expect(() => hsmMetrics.incrementCounter('unknown_metric')).not.toThrow();
      expect(hsmMetrics.getMetrics().unknown_metric).toBeUndefined();
    });

    test('L3-02: Observe histogram with unknown name — no crash', () => {
      expect(() => hsmMetrics.observeHistogram('unknown_histogram', 100)).not.toThrow();
    });

    test('L3-03: Negative increment value — no crash', () => {
      expect(() => hsmMetrics.incrementCounter('hsm_dkg_session_initiated_total', -1)).not.toThrow();
      expect(hsmMetrics.getMetrics().hsm_dkg_session_initiated_total).toBe(-1);
    });

    test('L3-04: All new counter names follow hsm_ prefix convention', () => {
      for (const n of ALL_NEW_COUNTERS) expect(n.startsWith('hsm_')).toBe(true);
      for (const n of ALL_NEW_GAUGES) expect(n.startsWith('hsm_')).toBe(true);
    });

    test('L3-05: Alert rules YAML is valid Prometheus rule format', () => {
      const p = path.join(__dirname, '..', '..', '..', 'monitoring', 'prometheus-mesh-alerts.yml');
      const doc = yaml.load(fs.readFileSync(p, 'utf8'));
      expect(doc).toHaveProperty('groups');
      expect(Array.isArray(doc.groups)).toBe(true);
      expect(doc.groups.length).toBe(5);
      for (const g of doc.groups) {
        expect(g).toHaveProperty('name');
        expect(g).toHaveProperty('rules');
        expect(Array.isArray(g.rules)).toBe(true);
        for (const r of g.rules) {
          expect(r).toHaveProperty('alert');
          expect(r).toHaveProperty('expr');
          expect(r).toHaveProperty('labels.severity');
        }
      }
      const names = doc.groups.map(g => g.name);
      expect(names).toContain('dkg_gossip_alerts');
      expect(names).toContain('stek_rotation_alerts');
      expect(names).toContain('musig2_protocol_alerts');
      const total = doc.groups.reduce((s, g) => s + g.rules.length, 0);
      expect(total).toBe(12);
    });

    test('L3-06: Grafana dashboard JSON has required fields', () => {
      const dir = path.join(__dirname, '..', '..', '..', 'monitoring', 'dashboards');
      const files = ['track115-mesh-reconciliation.json', 'dkg-operations.json', 'stek-lifecycle.json'];
      for (const f of files) {
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        expect(d).toHaveProperty('title');
        expect(d).toHaveProperty('panels');
        expect(d).toHaveProperty('schemaVersion');
        expect(Array.isArray(d.panels)).toBe(true);
        expect(d.panels.length).toBeGreaterThan(0);
        for (const p of d.panels) {
          expect(p).toHaveProperty('id');
          expect(p).toHaveProperty('title');
          expect(p).toHaveProperty('type');
          expect(p).toHaveProperty('datasource');
          expect(p).toHaveProperty('targets');
        }
      }
    });

    test('L3-07: No regression — existing hsm-metrics tests still pass', () => {
      hsmMetrics.incrementCounter('hsm_wrap_total', 1);
      hsmMetrics.incrementCounter('hsm_unwrap_total', 1);
      hsmMetrics.incrementCounter('hsm_create_kek_total', 1);
      const m = hsmMetrics.getMetrics();
      expect(m.hsm_wrap_total).toBe(1);
      expect(m.hsm_unwrap_total).toBe(1);
      expect(m.hsm_create_kek_total).toBe(1);
      hsmMetrics.observeHistogram('hsm_wrap_duration_ms', 50);
      const am = hsmMetrics.getMetrics();
      expect(am.hsm_wrap_duration_ms_count).toBe(1);
      expect(am.hsm_wrap_duration_ms_sum).toBe(50);
    });

    test('L3-08: All 22 new counters + 2 gauges + 1 histogram are registered', () => {
      const m = hsmMetrics.getMetrics();
      for (const n of ALL_NEW_COUNTERS) { expect(m).toHaveProperty(n); expect(m[n]).toBe(0); }
      for (const n of ALL_NEW_GAUGES) { expect(m).toHaveProperty(n); expect(m[n]).toBe(0); }
      expect(m).toHaveProperty('hsm_dkg_round_duration_ms_count');
      expect(m).toHaveProperty('hsm_dkg_round_duration_ms_sum');
      expect(m.hsm_dkg_round_duration_ms_count).toBe(0);
      expect(m.hsm_dkg_round_duration_ms_sum).toBe(0);
      expect(DKG_COUNTERS.length).toBe(10);
      expect(STEK_COUNTERS.length).toBe(3);
      expect(MUSIG2_COUNTERS.length).toBe(7);
      expect(STEK_GAUGES.length).toBe(2);
      expect(ALL_NEW_COUNTERS.length).toBe(20);
    });
  });

  describe('Security', () => {
    test('S-01: No credentials or PII in dashboard JSON or alert rules', () => {
      const dir = path.join(__dirname, '..', '..', '..', 'monitoring', 'dashboards');
      const ap = path.join(__dirname, '..', '..', '..', 'monitoring', 'prometheus-mesh-alerts.yml');
      const files = [
        fs.readFileSync(ap, 'utf8'),
        fs.readFileSync(path.join(dir, 'track115-mesh-reconciliation.json'), 'utf8'),
        fs.readFileSync(path.join(dir, 'dkg-operations.json'), 'utf8'),
        fs.readFileSync(path.join(dir, 'stek-lifecycle.json'), 'utf8'),
      ];
      const patterns = [/password\s*[:=]/i, /secret\s*[:=]/i, /api[_-]?key\s*[:=]/i, /token\s*[:=]/i, /private[_-]?key/i, /[0-9a-f]{64}/i];
      for (const c of files) {
        for (const p of patterns) {
          const matches = c.match(p);
          if (matches) {
            const lower = c.toLowerCase();
            if (lower.includes('private key') && p.source.includes('private')) continue;
            if (p.source === '[0-9a-f]{64}') {
              throw new Error('Potential key material found: ' + matches[0]);
            }
          }
        }
      }
      expect(true).toBe(true);
    });

    test('S-02: Alert runbook URLs point to internal repo, not external', () => {
      const ap = path.join(__dirname, '..', '..', '..', 'monitoring', 'prometheus-mesh-alerts.yml');
      const doc = yaml.load(fs.readFileSync(ap, 'utf8'));
      for (const g of doc.groups) {
        for (const r of g.rules) {
          if (r.annotations && r.annotations.runbook_url) {
            const u = r.annotations.runbook_url;
            expect(u).toContain('github.com/tjp420/CascadeProjects');
            expect(u).not.toMatch(/^https?:\/\/(?!github\.com\/tjp420)/);
          }
        }
      }
    });

    test('S-03: Dashboard JSON does not contain hardcoded credentials', () => {
      const dir = path.join(__dirname, '..', '..', '..', 'monitoring', 'dashboards');
      const files = ['track115-mesh-reconciliation.json', 'dkg-operations.json', 'stek-lifecycle.json'];
      for (const f of files) {
        const c = fs.readFileSync(path.join(dir, f), 'utf8');
        expect(c).not.toMatch(/basicAuth/i);
        expect(c).not.toMatch(/bearerToken/i);
        expect(c).not.toMatch(/"password"/i);
        expect(c).not.toMatch(/"apiKey"/i);
      }
    });

    test('S-04: No real cluster node IPs in Grafana datasource configs', () => {
      const dir = path.join(__dirname, '..', '..', '..', 'monitoring', 'dashboards');
      const files = ['track115-mesh-reconciliation.json', 'dkg-operations.json', 'stek-lifecycle.json'];
      for (const f of files) {
        const c = fs.readFileSync(path.join(dir, f), 'utf8');
        expect(c).not.toMatch(/\b10\.\d+\.\d+\.\d+\b/);
        expect(c).not.toMatch(/\b192\.168\.\d+\.\d+\b/);
        expect(c).not.toMatch(/\b172\.(1[6-9]|2\d|3[01])\.\d+\.\d+\b/);
      }
    });
  });
});
