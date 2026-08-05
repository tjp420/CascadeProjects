'use strict';

/**
 * Track 120 Prometheus Alert Rule Compliance Tests
 *
 * Verifies that the track120_cluster_key_reconciliation_alerts rule group
 * in prometheus-mesh-alerts.yml is structurally valid, has correct PromQL
 * expressions, severity labels, and references counters that exist in
 * hsm-metrics.cjs. Also verifies that all 7 runbook .md files exist.
 *
 * Modeled on track119-prometheus-alerts.test.cjs.
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
  'Track120DivergenceSpike',
  'Track120QuarantineSpike',
  'Track120UnresolvedDivergence',
  'Track120RollbackBlockedSpike',
  'Track120PromotionVoteStall',
  'Track120QuarantineRate',
  'Track120ScanStall',
];

const ALL_TRACK120_COUNTERS = [
  'hsm_reconciliation_scans_total',
  'hsm_reconciliation_divergence_detected_total',
  'hsm_reconciliation_promoted_total',
  'hsm_reconciliation_quarantined_total',
  'hsm_reconciliation_rollback_blocked_total',
  'hsm_reconciliation_promotion_votes_total',
  'hsm_reconciliation_divergent_keys',
];

const EXPECTED_RUNBOOKS = [
  'TRACK120_DIVERGENCE_SPIKE.md',
  'TRACK120_QUARANTINE_SPIKE.md',
  'TRACK120_UNRESOLVED_DIVERGENCE.md',
  'TRACK120_ROLLBACK_BLOCKED_SPIKE.md',
  'TRACK120_PROMOTION_VOTE_STALL.md',
  'TRACK120_QUARANTINE_RATE.md',
  'TRACK120_SCAN_STALL.md',
];

describe('Track 120 Prometheus alert rule compliance', () => {
  let doc;
  let group;

  beforeEach(() => {
    doc = loadAlertDoc();
    group = findGroup(doc, 'track120_cluster_key_reconciliation_alerts');
  });

  // ── L2-01: YAML group exists with 7 rules ───────────────────────────
  test('ALERT-120-L2-01: YAML structural validity — track120 group exists with 7 rules', () => {
    expect(doc).toHaveProperty('groups');
    expect(Array.isArray(doc.groups)).toBe(true);
    expect(group).toBeDefined();
    expect(group).toHaveProperty('name', 'track120_cluster_key_reconciliation_alerts');
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
  test('ALERT-120-L2-02: all 7 rules have required fields and expected alert names', () => {
    const alertNames = group.rules.map(r => r.alert);
    expect(alertNames.sort()).toEqual([...EXPECTED_ALERT_NAMES].sort());
    for (const r of group.rules) {
      expect(typeof r.expr).toBe('string');
      expect(r.expr.length).toBeGreaterThan(0);
      expect(r.for).toMatch(/^\d+m$/);
      expect(['critical', 'warning']).toContain(r.labels.severity);
    }
  });

  // ── L2-03: Track120DivergenceSpike ──────────────────────────────────
  test('ALERT-120-L2-03: Track120DivergenceSpike — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track120DivergenceSpike');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('1m');
    expect(rule.expr).toContain('hsm_reconciliation_divergence_detected_total');
    expect(rule.expr).toMatch(/rate\(\s*hsm_reconciliation_divergence_detected_total\[5m\]\s*\)/);
    expect(rule.expr).toContain('> 2');
  });

  // ── L2-04: Track120QuarantineSpike ──────────────────────────────────
  test('ALERT-120-L2-04: Track120QuarantineSpike — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track120QuarantineSpike');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('5m');
    expect(rule.expr).toContain('hsm_reconciliation_quarantined_total[10m]');
    expect(rule.expr).toContain('hsm_reconciliation_promoted_total[10m]');
    expect(rule.expr).toContain('== 0');
  });

  // ── L2-05: Track120UnresolvedDivergence ─────────────────────────────
  test('ALERT-120-L2-05: Track120UnresolvedDivergence — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track120UnresolvedDivergence');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('10m');
    expect(rule.expr).toContain('hsm_reconciliation_divergent_keys');
    expect(rule.expr).toContain('> 50');
  });

  // ── L2-06: Track120RollbackBlockedSpike ─────────────────────────────
  test('ALERT-120-L2-06: Track120RollbackBlockedSpike — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track120RollbackBlockedSpike');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('3m');
    expect(rule.expr).toContain('hsm_reconciliation_rollback_blocked_total');
    expect(rule.expr).toMatch(/rate\(\s*hsm_reconciliation_rollback_blocked_total\[5m\]\s*\)/);
    expect(rule.expr).toContain('> 1');
  });

  // ── L2-07: Track120PromotionVoteStall ───────────────────────────────
  test('ALERT-120-L2-07: Track120PromotionVoteStall — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track120PromotionVoteStall');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('5m');
    expect(rule.expr).toContain('hsm_reconciliation_scans_total[10m]');
    expect(rule.expr).toContain('hsm_reconciliation_promotion_votes_total[10m]');
    expect(rule.expr).toContain('== 0');
  });

  // ── L2-08: Track120QuarantineRate ───────────────────────────────────
  test('ALERT-120-L2-08: Track120QuarantineRate — correct structure with + 1 denominator offset', () => {
    const rule = group.rules.find(r => r.alert === 'Track120QuarantineRate');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('5m');
    expect(rule.expr).toContain('hsm_reconciliation_quarantined_total[5m]');
    expect(rule.expr).toContain('hsm_reconciliation_divergence_detected_total[5m]');
    // Division safety: + 1 denominator offset to prevent divide-by-zero
    expect(rule.expr).toContain('+ 1');
    expect(rule.expr).toContain('> 0.5');
  });

  // ── L2-09: Track120ScanStall ────────────────────────────────────────
  test('ALERT-120-L2-09: Track120ScanStall — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track120ScanStall');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('10m');
    expect(rule.expr).toContain('hsm_reconciliation_scans_total[10m]');
    expect(rule.expr).toContain('== 0');
  });

  // ── L2-10: All rules have correct labels ─────────────────────────────
  test('ALERT-120-L2-10: all rules have correct labels (track, component, tier, service)', () => {
    for (const r of group.rules) {
      expect(r.labels.track).toBe('120');
      expect(r.labels.component).toBe('hsm-mesh-vault');
      expect(r.labels.tier).toBe('post-quantum-crypto');
      expect(r.labels.service).toBe('hsm-vault-cluster-key-reconciliation');
    }
  });

  // ── L3-01: All 7 counters are referenced across the 7 rules ──────────
  test('ALERT-120-L3-01: all 7 Track 120 counters are referenced across the 7 rules', () => {
    const allExprText = group.rules.map(r => r.expr).join('\n');
    for (const counter of ALL_TRACK120_COUNTERS) {
      expect(allExprText).toContain(counter);
    }
  });

  // ── L3-02: All runbook URLs point to internal repo and match TRACK120_ pattern ─
  test('ALERT-120-L3-02: all runbook URLs point to internal repo and match TRACK120_ pattern', () => {
    for (const r of group.rules) {
      const url = r.annotations.runbook_url;
      expect(url).toMatch(/^https:\/\/github\.com\/tjp420\/CascadeProjects\/blob\/main\/ai-platform\/docs\/runbooks\//);
      expect(url).toMatch(/TRACK120_/);
      expect(url).toMatch(/\.md$/);
    }
  });

  // ── L3-03: No secrets in Track 120 alert YAML section ────────────────
  test('ALERT-120-L3-03: no secrets in Track 120 alert YAML section', () => {
    const yamlText = fs.readFileSync(ALERTS_YML, 'utf8');
    const track120Start = yamlText.indexOf('track120_cluster_key_reconciliation_alerts');
    // Bound the slice to just the Track 120 section (stop at the next group or end of file)
    const nextGroupIdx = yamlText.indexOf('\n  - name: track', track120Start + 1);
    const track120Section = nextGroupIdx > 0
      ? yamlText.slice(track120Start, nextGroupIdx)
      : yamlText.slice(track120Start);
    const secretPatterns = [/password\s*[:=]/i, /api[_-]?key\s*[:=]/i, /private[_-]?key\s*[:=]/i, /[0-9a-f]{64}/i];
    for (const p of secretPatterns) {
      expect(track120Section).not.toMatch(p);
    }
  });

  // ── L3-04: All referenced counters exist in hsm-metrics.cjs ──────────
  test('ALERT-120-L3-04: all referenced counters exist in hsm-metrics.cjs', () => {
    const metricsContent = fs.readFileSync(METRICS_CJS, 'utf8');
    for (const counter of ALL_TRACK120_COUNTERS) {
      expect(metricsContent).toContain(counter);
    }
  });

  // ── L3-05: All 7 runbook .md files exist in docs/runbooks/ ───────────
  test('ALERT-120-L3-05: all 7 runbook .md files exist in docs/runbooks/', () => {
    for (const filename of EXPECTED_RUNBOOKS) {
      const filepath = path.join(RUNBOOKS_DIR, filename);
      expect(fs.existsSync(filepath)).toBe(true);
    }
  });

  // ── L3-06: Existing Track 117/118/119 alert groups unchanged ────────
  test('ALERT-120-L3-06: existing Track 117/118/119 alert groups unchanged', () => {
    const track117Group = findGroup(doc, 'track117_bft_shard_sync_alerts');
    const track118Group = findGroup(doc, 'track118_distributed_consensus_coordinator_alerts');
    const track119Group = findGroup(doc, 'track119_cross_cluster_migration_alerts');
    expect(track117Group).toBeDefined();
    expect(track117Group.rules.length).toBe(2);
    expect(track118Group).toBeDefined();
    expect(track118Group.rules.length).toBe(7);
    expect(track119Group).toBeDefined();
    expect(track119Group.rules.length).toBe(7);
  });

  // ── S-01: No credentials or PII in alert rules or runbook files ──────
  test('ALERT-120-S-01: no credentials or PII in alert rules or runbook files', () => {
    const yamlText = fs.readFileSync(ALERTS_YML, 'utf8');
    const track120Start = yamlText.indexOf('track120_cluster_key_reconciliation_alerts');
    // Bound the slice to just the Track 120 section
    const nextGroupIdx = yamlText.indexOf('\n  - name: track', track120Start + 1);
    const track120Section = nextGroupIdx > 0
      ? yamlText.slice(track120Start, nextGroupIdx)
      : yamlText.slice(track120Start);
    expect(track120Section).not.toMatch(/password\s*[:=]\s*["']?[^\s"']+/i);
    expect(track120Section).not.toMatch(/api[_-]?key\s*[:=]\s*["']?[^\s"']+/i);
    expect(track120Section).not.toMatch(/secret\s*[:=]\s*["']?[^\s"']+/i);
    expect(track120Section).not.toMatch(/[0-9a-f]{64}/i);
    expect(track120Section).not.toContain('userEmail');
    // Check runbooks for actual secret patterns
    for (const filename of EXPECTED_RUNBOOKS) {
      const runbookContent = fs.readFileSync(path.join(RUNBOOKS_DIR, filename), 'utf8');
      expect(runbookContent).not.toMatch(/password\s*[:=]\s*["']?[^\s"']+/i);
      expect(runbookContent).not.toMatch(/api[_-]?key\s*[:=]\s*["']?[^\s"']+/i);
      expect(runbookContent).not.toMatch(/secret\s*[:=]\s*["']?[^\s"']+/i);
      expect(runbookContent).not.toMatch(/[0-9a-f]{64}/i);
    }
  });

  // ── S-02: Runbook URLs use HTTPS and point to internal repo only ─────
  test('ALERT-120-S-02: runbook URLs use HTTPS and point to internal repo only', () => {
    for (const r of group.rules) {
      const url = r.annotations.runbook_url;
      expect(url).toMatch(/^https:\/\//);
      expect(url).toContain('github.com/tjp420/CascadeProjects');
      expect(url).not.toMatch(/^http:\/\//);
      expect(url).not.toContain('localhost');
      expect(url).not.toContain('127.0.0.1');
    }
  });

  // ── S-03: No real node identifiers, tenant IDs, or key material in runbooks ─
  test('ALERT-120-S-03: no real node identifiers, tenant IDs, or key material in runbook examples', () => {
    for (const filename of EXPECTED_RUNBOOKS) {
      const runbookContent = fs.readFileSync(path.join(RUNBOOKS_DIR, filename), 'utf8');
      // No hex strings longer than 16 chars (could be real key material)
      expect(runbookContent).not.toMatch(/[0-9a-f]{32,}/i);
      // No UUID-like patterns
      expect(runbookContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      // No real tenant IDs (look for tenant- followed by hex)
      expect(runbookContent).not.toMatch(/tenant-[0-9a-f]{16,}/i);
    }
  });
});
