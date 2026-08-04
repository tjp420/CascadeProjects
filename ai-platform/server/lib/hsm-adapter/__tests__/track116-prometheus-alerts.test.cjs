'use strict';

/**
 * Track 116 Prometheus Alert Rule Compliance Tests
 *
 * Verifies that the track116_cluster_isolation_hardening_alerts rule group
 * in prometheus-mesh-alerts.yml is structurally valid, has correct PromQL
 * expressions, severity labels, and references counters that exist in
 * hsm-metrics.cjs.
 */

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

describe('Track 116 Prometheus alert rule compliance', () => {
  let doc;
  let group;

  beforeEach(() => {
    doc = loadAlertDoc();
    group = findGroup(doc, 'track116_cluster_isolation_hardening_alerts');
  });

  test('ALERT-116-01: YAML structural validity — track116 group exists with 2 rules', () => {
    expect(doc).toHaveProperty('groups');
    expect(Array.isArray(doc.groups)).toBe(true);
    expect(group).toBeDefined();
    expect(group).toHaveProperty('name', 'track116_cluster_isolation_hardening_alerts');
    expect(group).toHaveProperty('interval', '15s');
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

  test('ALERT-116-02: Track116ClusterIsolationViolationSpike — correct name, PromQL, severity, for window', () => {
    const rule = group.rules.find(r => r.alert === 'Track116ClusterIsolationViolationSpike');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('critical');
    expect(rule.for).toBe('1m');
    // PromQL must reference the isolation violation counter
    expect(rule.expr).toContain('hsm_isolation_violation_total');
    expect(rule.expr).toContain('> 10');
    expect(rule.expr).toMatch(/rate\(\s*hsm_isolation_violation_total\[5m\]\s*\)/);
    // Labels
    expect(rule.labels.track).toBe('116');
    expect(rule.labels.component).toBe('hsm-mesh-vault');
    expect(rule.labels.tier).toBe('post-quantum-crypto');
    expect(rule.labels.service).toBe('hsm-vault-cluster-isolation');
  });

  test('ALERT-116-03: Track116HighKeyRejectionRate — correct name, PromQL, severity, for window', () => {
    const rule = group.rules.find(r => r.alert === 'Track116HighKeyRejectionRate');
    expect(rule).toBeDefined();
    expect(rule.labels.severity).toBe('warning');
    expect(rule.for).toBe('3m');
    // PromQL must reference the key reject counter
    expect(rule.expr).toContain('hsm_key_reject_total');
    expect(rule.expr).toContain('> 2');
    expect(rule.expr).toMatch(/rate\(\s*hsm_key_reject_total\[5m\]\s*\)/);
    // Labels
    expect(rule.labels.track).toBe('116');
    expect(rule.labels.component).toBe('hsm-mesh-vault');
    expect(rule.labels.tier).toBe('post-quantum-crypto');
    expect(rule.labels.service).toBe('hsm-vault-cluster-isolation');
  });

  test('ALERT-116-04: runbook URLs, no secrets, and isolation counters exist in hsm-metrics.cjs', () => {
    // All runbook URLs point to internal repo
    for (const r of group.rules) {
      expect(r.annotations.runbook_url).toContain('github.com/tjp420/CascadeProjects');
      expect(r.annotations.runbook_url).toMatch(/TRACK116_/);
    }

    // No secrets or key material in alert YAML text
    const yamlText = fs.readFileSync(ALERTS_YML, 'utf8');
    const track116Section = yamlText.slice(yamlText.indexOf('track116_cluster_isolation_hardening_alerts'));
    const secretPatterns = [/password\s*[:=]/i, /api[_-]?key\s*[:=]/i, /private[_-]?key\s*[:=]/i, /[0-9a-f]{64}/i];
    for (const p of secretPatterns) {
      expect(track116Section).not.toMatch(p);
    }

    // Isolation counters referenced in alerts must exist in hsm-metrics.cjs
    const metricsContent = fs.readFileSync(METRICS_CJS, 'utf8');
    const requiredCounters = [
      'hsm_isolation_violation_total',
      'hsm_key_reject_total',
    ];
    for (const c of requiredCounters) {
      expect(metricsContent).toContain(c);
    }
  });
});
