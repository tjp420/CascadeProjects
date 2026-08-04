'use strict';

/**
 * Track 118 Prometheus Alert Rule Compliance Tests
 *
 * Verifies that the track118_distributed_consensus_coordinator_alerts rule group
 * in prometheus-mesh-alerts.yml is structurally valid, has correct PromQL
 * expressions, severity labels, and references counters that exist in
 * hsm-metrics.cjs. Also verifies that all 7 runbook .md files exist.
 *
 * Modeled on track117-prometheus-alerts.test.cjs.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ALERTS_YML = path.join(__dirname, '..', '..', '..', '..', 'monitoring', 'prometheus-mesh-alerts.yml');
const METRICS_CJS = path.join(__dirname, '..', 'hsm-metrics.cjs');
const RUNBOOKS_DIR = path.join(__dirname, '..', '..', '..', '..', 'docs', 'runbooks');

function loadAlertDoc() {
  return yaml.load(fs.readFileSync(ALERTS_YML, 'utf8'));
}

function findGroup(doc, name) {
  return doc.groups.find(g => g.name === name);
}

const EXPECTED_ALERT_NAMES = [
  'Track118ViewChangeAbortSpike',
  'Track118ViewChangeCompletionStall',
  'Track118FaultDetectionSpike',
  'Track118ProposalRejectionRateHigh',
  'Track118QuorumDenialSpike',
  'Track118GroupChurnImbalance',
  'Track118QuorumVerificationStall',
];

const ALL_TRACK118_COUNTERS = [
  'hsm_consensus_coord_groups_created_total',
  'hsm_consensus_coord_groups_destroyed_total',
  'hsm_consensus_coord_proposals_routed_total',
  'hsm_consensus_coord_proposals_rejected_total',
  'hsm_consensus_coord_faults_detected_total',
  'hsm_consensus_coord_view_change_started_total',
  'hsm_consensus_coord_view_change_completed_total',
  'hsm_consensus_coord_view_change_aborted_total',
  'hsm_consensus_coord_quorum_verified_total',
  'hsm_consensus_coord_quorum_denied_total',
];

const EXPECTED_RUNBOOKS = [
  'TRACK118_VIEW_CHANGE_ABORT_SPIKE.md',
  'TRACK118_VIEW_CHANGE_COMPLETION_STALL.md',
  'TRACK118_FAULT_DETECTION_SPIKE.md',
  'TRACK118_PROPOSAL_REJECTION_RATE_HIGH.md',
  'TRACK118_QUORUM_DENIAL_SPIKE.md',
  'TRACK118_GROUP_CHURN_IMBALANCE.md',
  'TRACK118_QUORUM_VERIFICATION_STALL.md',
];

describe('Track 118 Prometheus alert rule compliance', () => {
  let doc;
  let group;

  beforeEach(() => {
    doc = loadAlertDoc();
    group = findGroup(doc, 'track118_distributed_consensus_coordinator_alerts');
  });

  // ── L2-01: YAML group exists with 7 rules ───────────────────────────
  test('ALERT-118-L2-01: YAML structural validity — track118 group exists with 7 rules', () => {
    expect(doc).toHaveProperty('groups');
    expect(Array.isArray(doc.groups)).toBe(true);
    expect(group).toBeDefined();
    expect(group).toHaveProperty('name', 'track118_distributed_consensus_coordinator_alerts');
    expect(group).toHaveProperty('interval', '15s');
    expect(Array.isArray(group.rules)).toBe(true);
    expect(group.rules.length).toBe(7);
    for (const r of group.rules) {
      expect(r).toHaveProperty('alert');
      expect(r).toHaveProperty('expr');
      expect(r).toHaveProperty('for');
      expect(r).toHaveProperty('labels.severity');
      expect(r).toHaveProperty('annotations.summary');
      expect(r).toHaveProperty('annotations.description');
      expect(r).toHaveProperty('annotations.runbook_url');
    }
  });

  // ── L2-02: All 7 rules have required fields ─────────────────────────
  test('ALERT-118-L2-02: all 7 rules have required fields and expected alert names', () => {
    const alertNames = group.rules.map(r => r.alert);
    expect(alertNames.sort()).toEqual([...EXPECTED_ALERT_NAMES].sort());
    for (const r of group.rules) {
      expect(typeof r.expr).toBe('string');
      expect(r.expr.length).toBeGreaterThan(0);
      expect(r.for).toMatch(/^\d+m$/);
      expect(['critical', 'warning']).toContain(r.labels.severity);
    }
  });

  // ── L2-03: Track118ViewChangeAbortSpike ─────────────────────────────
  test('ALERT-118-L2-03: Track118ViewChangeAbortSpike — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track118ViewChangeAbortSpike');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('2m');
    expect(rule.expr).toContain('hsm_consensus_coord_view_change_aborted_total');
    expect(rule.expr).toMatch(/rate\(\s*hsm_consensus_coord_view_change_aborted_total\[5m\]\s*\)/);
    expect(rule.expr).toContain('> 1');
  });

  // ── L2-04: Track118ViewChangeCompletionStall ────────────────────────
  test('ALERT-118-L2-04: Track118ViewChangeCompletionStall — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track118ViewChangeCompletionStall');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('5m');
    expect(rule.expr).toContain('hsm_consensus_coord_view_change_started_total[10m]');
    expect(rule.expr).toContain('hsm_consensus_coord_view_change_completed_total[10m]');
    expect(rule.expr).toContain('== 0');
  });

  // ── L2-05: Track118FaultDetectionSpike ──────────────────────────────
  test('ALERT-118-L2-05: Track118FaultDetectionSpike — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track118FaultDetectionSpike');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('1m');
    expect(rule.expr).toContain('hsm_consensus_coord_faults_detected_total');
    expect(rule.expr).toMatch(/rate\(\s*hsm_consensus_coord_faults_detected_total\[5m\]\s*\)/);
    expect(rule.expr).toContain('> 5');
  });

  // ── L2-06: Track118ProposalRejectionRateHigh ────────────────────────
  test('ALERT-118-L2-06: Track118ProposalRejectionRateHigh — correct structure with + 1 denominator offset', () => {
    const rule = group.rules.find(r => r.alert === 'Track118ProposalRejectionRateHigh');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('2m');
    expect(rule.expr).toContain('hsm_consensus_coord_proposals_rejected_total');
    expect(rule.expr).toContain('hsm_consensus_coord_proposals_routed_total');
    // Division-safety: the + 1 denominator offset must be present
    expect(rule.expr).toContain('+ 1');
    expect(rule.expr).toContain('> 0.3');
    // Verify the denominator includes both counters plus the offset
    expect(rule.expr).toMatch(/hsm_consensus_coord_proposals_routed_total\[5m\]/);
    expect(rule.expr).toMatch(/hsm_consensus_coord_proposals_rejected_total\[5m\]/);
  });

  // ── L2-07: Track118QuorumDenialSpike ────────────────────────────────
  test('ALERT-118-L2-07: Track118QuorumDenialSpike — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track118QuorumDenialSpike');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('2m');
    expect(rule.expr).toContain('hsm_consensus_coord_quorum_denied_total');
    expect(rule.expr).toMatch(/rate\(\s*hsm_consensus_coord_quorum_denied_total\[5m\]\s*\)/);
    expect(rule.expr).toContain('> 10');
  });

  // ── L2-08: Track118GroupChurnImbalance ──────────────────────────────
  test('ALERT-118-L2-08: Track118GroupChurnImbalance — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track118GroupChurnImbalance');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('10m');
    expect(rule.expr).toContain('hsm_consensus_coord_groups_destroyed_total[15m]');
    expect(rule.expr).toContain('hsm_consensus_coord_groups_created_total[15m]');
  });

  // ── L2-09: Track118QuorumVerificationStall ──────────────────────────
  test('ALERT-118-L2-09: Track118QuorumVerificationStall — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track118QuorumVerificationStall');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('5m');
    expect(rule.expr).toContain('hsm_consensus_coord_proposals_routed_total[10m]');
    expect(rule.expr).toContain('hsm_consensus_coord_quorum_verified_total[10m]');
    expect(rule.expr).toContain('== 0');
  });

  // ── L2-10: All rules have correct labels ────────────────────────────
  test('ALERT-118-L2-10: all rules have correct labels (track, component, tier, service)', () => {
    for (const r of group.rules) {
      expect(r.labels.track).toBe('118');
      expect(r.labels.component).toBe('hsm-mesh-vault');
      expect(r.labels.tier).toBe('post-quantum-crypto');
      expect(r.labels.service).toBe('hsm-vault-distributed-consensus-coordinator');
    }
  });

  // ── L3-01: All 10 Track 118 counters referenced across 7 rules ──────
  test('ALERT-118-L3-01: all 10 Track 118 counters are referenced across the 7 rules', () => {
    const allExprText = group.rules.map(r => r.expr).join('\n');
    for (const counter of ALL_TRACK118_COUNTERS) {
      expect(allExprText).toContain(counter);
    }
  });

  // ── L3-02: All runbook URLs point to internal repo ──────────────────
  test('ALERT-118-L3-02: all runbook URLs point to internal repo and match TRACK118_ pattern', () => {
    for (const r of group.rules) {
      expect(r.annotations.runbook_url).toContain('github.com/tjp420/CascadeProjects');
      expect(r.annotations.runbook_url).toMatch(/TRACK118_/);
      expect(r.annotations.runbook_url).toMatch(/\.md$/);
    }
  });

  // ── L3-03: No secrets in alert YAML ─────────────────────────────────
  test('ALERT-118-L3-03: no secrets in Track 118 alert YAML section', () => {
    const yamlText = fs.readFileSync(ALERTS_YML, 'utf8');
    const track118Start = yamlText.indexOf('track118_distributed_consensus_coordinator_alerts');
    const nextGroupIdx = yamlText.indexOf('\n  - name: track', track118Start + 1);
    const track118Section = nextGroupIdx > 0
      ? yamlText.slice(track118Start, nextGroupIdx)
      : yamlText.slice(track118Start);
    const secretPatterns = [/password\s*[:=]/i, /api[_-]?key\s*[:=]/i, /private[_-]?key\s*[:=]/i, /[0-9a-f]{64}/i];
    for (const p of secretPatterns) {
      expect(track118Section).not.toMatch(p);
    }
  });

  // ── L3-04: All referenced counters exist in hsm-metrics.cjs ─────────
  test('ALERT-118-L3-04: all referenced counters exist in hsm-metrics.cjs', () => {
    const metricsContent = fs.readFileSync(METRICS_CJS, 'utf8');
    for (const counter of ALL_TRACK118_COUNTERS) {
      expect(metricsContent).toContain(counter);
    }
  });

  // ── L3-05: All 7 runbook .md files exist ────────────────────────────
  test('ALERT-118-L3-05: all 7 runbook .md files exist in docs/runbooks/', () => {
    for (const filename of EXPECTED_RUNBOOKS) {
      const runbookPath = path.join(RUNBOOKS_DIR, filename);
      expect(fs.existsSync(runbookPath)).toBe(true);
    }
  });

  // ── L3-06: Existing Track 115/116/117 alert groups unchanged ────────
  test('ALERT-118-L3-06: existing Track 115/116/117 alert groups unchanged', () => {
    const track115Group = findGroup(doc, 'track115_lattice_vfhss_gating_alerts');
    const track116Group = findGroup(doc, 'track116_cluster_isolation_hardening_alerts');
    const track117Group = findGroup(doc, 'track117_bft_shard_sync_alerts');
    expect(track115Group).toBeDefined();
    expect(track115Group.rules.length).toBe(2);
    expect(track116Group).toBeDefined();
    expect(track116Group.rules.length).toBeGreaterThanOrEqual(2);
    expect(track117Group).toBeDefined();
    expect(track117Group.rules.length).toBe(2);
  });

  // ── S-01: No credentials / PII in alert rules or runbooks ───────────
  test('ALERT-118-S-01: no credentials or PII in alert rules or runbook files', () => {
    const yamlText = fs.readFileSync(ALERTS_YML, 'utf8');
    const track118Start = yamlText.indexOf('track118_distributed_consensus_coordinator_alerts');
    // Bound the slice to just the Track 118 section (stop at the next group or end of file)
    const nextGroupIdx = yamlText.indexOf('\n  - name: track', track118Start + 1);
    const track118Section = nextGroupIdx > 0
      ? yamlText.slice(track118Start, nextGroupIdx)
      : yamlText.slice(track118Start);
    expect(track118Section).not.toContain('credential');
    expect(track118Section).not.toContain('userEmail');
    expect(track118Section).not.toContain('apiKey');
    // Check runbooks
    for (const filename of EXPECTED_RUNBOOKS) {
      const runbookContent = fs.readFileSync(path.join(RUNBOOKS_DIR, filename), 'utf8');
      expect(runbookContent).not.toContain('credential');
      expect(runbookContent).not.toContain('userEmail');
      expect(runbookContent).not.toMatch(/[0-9a-f]{64}/i);
    }
  });

  // ── S-02: Runbook URLs use HTTPS and point to internal repo only ────
  test('ALERT-118-S-02: runbook URLs use HTTPS and point to internal repo only', () => {
    for (const r of group.rules) {
      expect(r.annotations.runbook_url).toMatch(/^https:\/\//);
      expect(r.annotations.runbook_url).toContain('github.com/tjp420/CascadeProjects');
      expect(r.annotations.runbook_url).not.toContain('http://');
    }
  });

  // ── S-03: No real node identifiers, tenant IDs, or key material ─────
  test('ALERT-118-S-03: no real node identifiers, tenant IDs, or key material in runbook examples', () => {
    for (const filename of EXPECTED_RUNBOOKS) {
      const runbookContent = fs.readFileSync(path.join(RUNBOOKS_DIR, filename), 'utf8');
      // Runbooks should use placeholder examples, not real identifiers
      expect(runbookContent).not.toMatch(/tenant-[a-f0-9]{8,}/i);
      expect(runbookContent).not.toMatch(/node-[a-f0-9]{16,}/i);
      expect(runbookContent).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    }
  });
});
