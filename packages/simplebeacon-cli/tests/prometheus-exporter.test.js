const { test } = require('node:test');
const assert = require('node:assert').strict;
const { generatePrometheusMetrics } = require('../src/reporters/prometheus-exporter');

test('generatePrometheusMetrics produces expected metric lines', () => {
  const data = [
    { id: 'r1', gate_pass: true, severityCounts: { critical: 1, high: 2, medium: 3, low: 4 } },
    { id: 'r2', gate_pass: false, severityCounts: { critical: 0, high: 1, medium: 0, low: 0 } },
  ];

  const out = generatePrometheusMetrics(data);
  // Basic assertions
  assert.ok(out.includes('simplebeacon_scans_total 2'));
  assert.ok(out.includes('simplebeacon_gate_failures_total 1'));
  // current run (last element) should drive severity counts
  assert.ok(out.includes('simplebeacon_exposed_vulnerabilities_current{severity="high"} 1'));
  assert.ok(out.includes('# HELP simplebeacon_scans_total'));
});
