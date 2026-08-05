'use strict';

/**
 * Track 121 Prometheus Alert Rule Compliance Tests
 *
 * Verifies that the track121_multiparty_rekeying_alerts rule group
 * in prometheus-mesh-alerts.yml is structurally valid, has correct PromQL
 * expressions, severity labels, and references counters that exist in
 * hsm-metrics.cjs. Also verifies that all 7 runbook .md files exist.
 *
 * Modeled on track120-prometheus-alerts.test.cjs.
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
  'Track121AbortSpike',
  'Track121CommitStall',
  'Track121ActiveSaturation',
  'Track121RollbackBlockedSpike',
  'Track121ResharingStall',
  'Track121AbortRate',
  'Track121ProposalStall',
];

const ALL_TRACK121_COUNTERS = [
  'hsm_rekey_proposed_total',
  'hsm_rekey_resharing_submitted_total',
  'hsm_rekey_verified_total',
  'hsm_rekey_committed_total',
  'hsm_rekey_aborted_total',
  'hsm_rekey_rollback_blocked_total',
  'hsm_rekey_active',
];

const EXPECTED_RUNBOOKS = [
  'TRACK121_ABORT_SPIKE.md',
  'TRACK121_COMMIT_STALL.md',
  'TRACK121_ACTIVE_SATURATION.md',
  'TRACK121_ROLLBACK_BLOCKED_SPIKE.md',
  'TRACK121_RESHARING_STALL.md',
  'TRACK121_ABORT_RATE.md',
  'TRACK121_PROPOSAL_STALL.md',
];

describe('Track 121 Prometheus alert rule compliance', () => {
  let doc;
  let group;

  beforeEach(() => {
    doc = loadAlertDoc();
    group = findGroup(doc, 'track121_multiparty_rekeying_alerts');
  });

  // ── L2-01: YAML group exists with 7 rules ───────────────────────────
  test('ALERT-121-L2-01: YAML structural validity — track121 group exists with 7 rules', () => {
    expect(doc).toHaveProperty('groups');
    expect(Array.isArray(doc.groups)).toBe(true);
    expect(group).toBeDefined();
    expect(group).toHaveProperty('name', 'track121_multiparty_rekeying_alerts');
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
  test('ALERT-121-L2-02: all 7 rules have required fields and expected alert names', () => {
    const alertNames = group.rules.map(r => r.alert);
    expect(alertNames.sort()).toEqual([...EXPECTED_ALERT_NAMES].sort());
    for (const r of group.rules) {
      expect(typeof r.expr).toBe('string');
      expect(r.expr.length).toBeGreaterThan(0);
      expect(r.for).toMatch(/^\d+m$/);
      expect(['critical', 'warning']).toContain(r.labels.severity);
    }
  });

  // ── L2-03: Track121AbortSpike ───────────────────────────────────────
  test('ALERT-121-L2-03: Track121AbortSpike — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track121AbortSpike');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('1m');
    expect(rule.expr).toContain('hsm_rekey_aborted_total');
    expect(rule.expr).toMatch(/rate\(\s*hsm_rekey_aborted_total\[5m\]\s*\)/);
    expect(rule.expr).toContain('> 2');
  });

  // ── L2-04: Track121CommitStall ──────────────────────────────────────
  test('ALERT-121-L2-04: Track121CommitStall — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track121CommitStall');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('5m');
    expect(rule.expr).toContain('hsm_rekey_verified_total[10m]');
    expect(rule.expr).toContain('hsm_rekey_committed_total[10m]');
    expect(rule.expr).toContain('== 0');
  });

  // ── L2-05: Track121ActiveSaturation ─────────────────────────────────
  test('ALERT-121-L2-05: Track121ActiveSaturation — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track121ActiveSaturation');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('5m');
    expect(rule.expr).toContain('hsm_rekey_active');
    expect(rule.expr).toContain('> 28');
  });

  // ── L2-06: Track121RollbackBlockedSpike ─────────────────────────────
  test('ALERT-121-L2-06: Track121RollbackBlockedSpike — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track121RollbackBlockedSpike');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('3m');
    expect(rule.expr).toContain('hsm_rekey_rollback_blocked_total');
    expect(rule.expr).toMatch(/rate\(\s*hsm_rekey_rollback_blocked_total\[5m\]\s*\)/);
    expect(rule.expr).toContain('> 1');
  });

  // ── L2-07: Track121ResharingStall ───────────────────────────────────
  test('ALERT-121-L2-07: Track121ResharingStall — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track121ResharingStall');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('5m');
    expect(rule.expr).toContain('hsm_rekey_proposed_total[10m]');
    expect(rule.expr).toContain('hsm_rekey_resharing_submitted_total[10m]');
    expect(rule.expr).toContain('== 0');
  });

  // ── L2-08: Track121AbortRate ────────────────────────────────────────
  test('ALERT-121-L2-08: Track121AbortRate — correct structure with + 1 denominator offset', () => {
    const rule = group.rules.find(r => r.alert === 'Track121AbortRate');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('5m');
    expect(rule.expr).toContain('hsm_rekey_aborted_total[5m]');
    expect(rule.expr).toContain('hsm_rekey_proposed_total[5m]');
    // Division safety: + 1 denominator offset to prevent divide-by-zero
    expect(rule.expr).toContain('+ 1');
    expect(rule.expr).toContain('> 0.5');
  });

  // ── L2-09: Track121ProposalStall ────────────────────────────────────
  test('ALERT-121-L2-09: Track121ProposalStall — correct structure', () => {
    const rule = group.rules.find(r => r.alert === 'Track121ProposalStall');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('10m');
    expect(rule.expr).toContain('hsm_rekey_proposed_total[10m]');
    expect(rule.expr).toContain('== 0');
  });

  // ── L2-10: All rules have correct labels ─────────────────────────────
  test('ALERT-121-L2-10: all rules have correct labels (track, component, tier, service)', () => {
    for (const r of group.rules) {
      expect(r.labels.track).toBe('121');
      expect(r.labels.component).toBe('hsm-mesh-vault');
      expect(r.labels.tier).toBe('post-quantum-crypto');
      expect(r.labels.service).toBe('hsm-vault-multiparty-rekeying');
    }
  });

  // ── L3-01: All 7 counters are referenced across the 7 rules ──────────
  test('ALERT-121-L3-01: all 7 Track 121 counters are referenced across the 7 rules', () => {
    const allExprText = group.rules.map(r => r.expr).join('\n');
    for (const counter of ALL_TRACK121_COUNTERS) {
      expect(allExprText).toContain(counter);
    }
  });

  // ── L3-02: All runbook URLs point to internal repo and match TRACK121_ pattern ─
  test('ALERT-121-L3-02: all runbook URLs point to internal repo and match TRACK121_ pattern', () => {
    for (const r of group.rules) {
      const url = r.annotations.runbook_url;
      expect(url).toMatch(/^https:\/\/github\.com\/tjp420\/CascadeProjects\/blob\/main\/ai-platform\/docs\/runbooks\//);
      expect(url).toMatch(/TRACK121_/);
      expect(url).toMatch(/\.md$/);
    }
  });

  // ── L3-03: No secrets in Track 121 alert YAML section ────────────────
  test('ALERT-121-L3-03: no secrets in Track 121 alert YAML section', () => {
    const yamlText = fs.readFileSync(ALERTS_YML, 'utf8');
    const track121Start = yamlText.indexOf('track121_multiparty_rekeying_alerts');
    // Bound the slice to just the Track 121 section (stop at the next group or end of file)
    const nextGroupIdx = yamlText.indexOf('\n  - name: track', track121Start + 1);
    const track121Section = nextGroupIdx > 0
      ? yamlText.slice(track121Start, nextGroupIdx)
      : yamlText.slice(track121Start);
    const secretPatterns = [/password\s*[:=]/i, /api[_-]?key\s*[:=]/i, /private[_-]?key\s*[:=]/i, /[0-9a-f]{64}/i];
    for (const p of secretPatterns) {
      expect(track121Section).not.toMatch(p);
    }
  });

  // ── L3-04: All referenced counters exist in hsm-metrics.cjs ──────────
  test('ALERT-121-L3-04: all referenced counters exist in hsm-metrics.cjs', () => {
    const metricsContent = fs.readFileSync(METRICS_CJS, 'utf8');
    for (const counter of ALL_TRACK121_COUNTERS) {
      expect(metricsContent).toContain(counter);
    }
  });

  // ── L3-05: All 7 runbook .md files exist in docs/runbooks/ ───────────
  test('ALERT-121-L3-05: all 7 runbook .md files exist in docs/runbooks/', () => {
    for (const filename of EXPECTED_RUNBOOKS) {
      const filepath = path.join(RUNBOOKS_DIR, filename);
      expect(fs.existsSync(filepath)).toBe(true);
    }
  });

  // ── L3-06: Existing Track 117/118/119/120 alert groups unchanged ────
  test('ALERT-121-L3-06: existing Track 117/118/119/120 alert groups unchanged', () => {
    const track117Group = findGroup(doc, 'track117_bft_shard_sync_alerts');
    const track118Group = findGroup(doc, 'track118_distributed_consensus_coordinator_alerts');
    const track119Group = findGroup(doc, 'track119_cross_cluster_migration_alerts');
    const track120Group = findGroup(doc, 'track120_cluster_key_reconciliation_alerts');
    expect(track117Group).toBeDefined();
    expect(track117Group.rules.length).toBe(2);
    expect(track118Group).toBeDefined();
    expect(track118Group.rules.length).toBe(7);
    expect(track119Group).toBeDefined();
    expect(track119Group.rules.length).toBe(7);
    expect(track120Group).toBeDefined();
    expect(track120Group.rules.length).toBe(7);
  });

  // ── S-01: No credentials or PII in alert rules or runbook files ──────
  test('ALERT-121-S-01: no credentials or PII in alert rules or runbook files', () => {
    const yamlText = fs.readFileSync(ALERTS_YML, 'utf8');
    const track121Start = yamlText.indexOf('track121_multiparty_rekeying_alerts');
    // Bound the slice to just the Track 121 section
    const nextGroupIdx = yamlText.indexOf('\n  - name: track', track121Start + 1);
    const track121Section = nextGroupIdx > 0
      ? yamlText.slice(track121Start, nextGroupIdx)
      : yamlText.slice(track121Start);
    expect(track121Section).not.toMatch(/password\s*[:=]\s*["']?[^\s"']+/i);
    expect(track121Section).not.toMatch(/api[_-]?key\s*[:=]\s*["']?[^\s"']+/i);
    expect(track121Section).not.toMatch(/secret\s*[:=]\s*["']?[^\s"']+/i);
    expect(track121Section).not.toMatch(/[0-9a-f]{64}/i);
    expect(track121Section).not.toContain('userEmail');
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
  test('ALERT-121-S-02: runbook URLs use HTTPS and point to internal repo only', () => {
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
  test('ALERT-121-S-03: no real node identifiers, tenant IDs, or key material in runbook examples', () => {
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
