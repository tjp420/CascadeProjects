'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ALERTS_YML = path.join(__dirname, '..', '..', '..', '..', 'monitoring', 'prometheus-mesh-alerts.yml');
const METRICS_CJS = path.join(__dirname, '..', 'hsm-metrics.cjs');

function loadAlertDoc() {
  return yaml.load(fs.readFileSync(ALERTS_YML, 'utf8'));
}

function findGroup(doc, name) {
  return doc.groups.find(g => g.name === name);
}

describe('Track 115 Prometheus alert rule compliance', () => {
  let doc;
  let group;

  beforeEach(() => {
    doc = loadAlertDoc();
    group = findGroup(doc, 'track115_lattice_vfhss_gating_alerts');
  });

  test('ALERT-115-01: YAML structural validity — track115 group exists with 2 rules', () => {
    expect(doc).toHaveProperty('groups');
    expect(Array.isArray(doc.groups)).toBe(true);
    expect(group).toBeDefined();
    expect(group).toHaveProperty('name', 'track115_lattice_vfhss_gating_alerts');
    expect(group).toHaveProperty('interval', '30s');
    expect(Array.isArray(group.rules)).toBe(true);
    expect(group.rules.length).toBe(2);
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

  test('ALERT-115-02: Track115LatticeVfhssReconciliationStall — correct name, PromQL, severity, for window', () => {
    const rule = group.rules.find(r => r.alert === 'Track115LatticeVfhssReconciliationStall');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('5m');
    // PromQL must reference both initialization and accreditation counters
    expect(rule.expr).toContain('hsm_vfhssgate_pool_initialized_total');
    expect(rule.expr).toContain('hsm_vfhss_accreditation_completed_total');
    expect(rule.expr).toContain('> 0');
    expect(rule.expr).toContain('== 0');
    expect(rule.expr).toMatch(/rate\(\s*hsm_vfhssgate_pool_initialized_total\[5m\]\s*\)/);
    expect(rule.expr).toMatch(/rate\(\s*hsm_vfhss_accreditation_completed_total\[5m\]\s*\)/);
    // Labels
    expect(rule.labels.track).toBe('115');
    expect(rule.labels.component).toBe('hsm-mesh-vault');
    expect(rule.labels.tier).toBe('post-quantum-crypto');
    expect(rule.labels.service).toBe('hsm-vault-lattice-vfhss-gating');
  });

  test('ALERT-115-03: Track115HighValidationFailureRate — correct name, PromQL, severity, for window', () => {
    const rule = group.rules.find(r => r.alert === 'Track115HighValidationFailureRate');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('2m');
    // PromQL must reference claim verification and pool initialization counters
    expect(rule.expr).toContain('hsm_zk_vfhss_claim_verified_total');
    expect(rule.expr).toContain('hsm_vfhssgate_pool_initialized_total');
    expect(rule.expr).toContain('< 0.85');
    expect(rule.expr).toMatch(/rate\(\s*hsm_zk_vfhss_claim_verified_total\[5m\]\s*\)/);
    expect(rule.expr).toMatch(/rate\(\s*hsm_vfhssgate_pool_initialized_total\[5m\]\s*\)/);
    // Labels
    expect(rule.labels.track).toBe('115');
    expect(rule.labels.component).toBe('hsm-mesh-vault');
    expect(rule.labels.tier).toBe('post-quantum-crypto');
    expect(rule.labels.service).toBe('hsm-vault-lattice-vfhss-gating');
  });

  test('ALERT-115-04: runbook URLs, no secrets, and VFHSS counters exist in hsm-metrics.cjs', () => {
    // All runbook URLs point to internal repo
    for (const r of group.rules) {
      expect(r.annotations.runbook_url).toContain('github.com/tjp420/CascadeProjects');
      expect(r.annotations.runbook_url).toMatch(/TRACK115_/);
    }

    // No secrets or key material in alert YAML text
    const yamlText = fs.readFileSync(ALERTS_YML, 'utf8');
    const track115Section = yamlText.slice(yamlText.indexOf('track115_lattice_vfhss_gating_alerts'));
    const secretPatterns = [/password\s*[:=]/i, /api[_-]?key\s*[:=]/i, /private[_-]?key\s*[:=]/i, /[0-9a-f]{64}/i];
    for (const p of secretPatterns) {
      expect(track115Section).not.toMatch(p);
    }

    // VFHSS counters referenced in alerts must exist in hsm-metrics.cjs
    const metricsContent = fs.readFileSync(METRICS_CJS, 'utf8');
    const requiredCounters = [
      'hsm_vfhssgate_pool_initialized_total',
      'hsm_vfhss_accreditation_completed_total',
      'hsm_zk_vfhss_claim_verified_total',
    ];
    for (const c of requiredCounters) {
      expect(metricsContent).toContain(c);
    }
  });
});
