'use strict';
// SimpleBeacon Prometheus Telemetry Observability Exporter (CommonJS)
const fs = require('node:fs');
const path = require('node:path');

function generatePrometheusMetrics(scanHistoryArray) {
  scanHistoryArray = Array.isArray(scanHistoryArray) ? scanHistoryArray : [];
  const metrics = [];

  metrics.push('# HELP simplebeacon_scans_total Total number of repository scans executed.');
  metrics.push('# TYPE simplebeacon_scans_total counter');
  metrics.push(`simplebeacon_scans_total ${scanHistoryArray.length}`);

  metrics.push('');
  metrics.push('# HELP simplebeacon_gate_failures_total Total number of compliance gate failures enforced.');
  metrics.push('# TYPE simplebeacon_gate_failures_total counter');

  const gateFailures = scanHistoryArray.filter(run => {
    if (!run) return false;
    if (typeof run.gate_pass !== 'undefined') return run.gate_pass === false || run.gate_pass === 'FAIL' || run.gate_pass === 'fail';
    if (run.gate && typeof run.gate.pass !== 'undefined') return run.gate.pass === false;
    return false;
  }).length;

  metrics.push(`simplebeacon_gate_failures_total ${gateFailures}`);

  metrics.push('');
  metrics.push('# HELP simplebeacon_exposed_vulnerabilities_current Current active unsuppressed vulnerability count mapped by severity.');
  metrics.push('# TYPE simplebeacon_exposed_vulnerabilities_current gauge');

  if (scanHistoryArray.length > 0) {
    const currentRun = scanHistoryArray[scanHistoryArray.length - 1] || {};
    const counts = currentRun.severityCounts || currentRun.severity_counts || (currentRun.summary && currentRun.summary.severityCounts) || { critical: 0, high: 0, medium: 0, low: 0 };
    const severities = ['critical', 'high', 'medium', 'low'];
    severities.forEach(sev => {
      const count = counts[sev] || 0;
      metrics.push(`simplebeacon_exposed_vulnerabilities_current{severity="${sev}"} ${count}`);
    });
  } else {
    metrics.push('simplebeacon_exposed_vulnerabilities_current{severity="critical"} 0');
    metrics.push('simplebeacon_exposed_vulnerabilities_current{severity="high"} 0');
    metrics.push('simplebeacon_exposed_vulnerabilities_current{severity="medium"} 0');
    metrics.push('simplebeacon_exposed_vulnerabilities_current{severity="low"} 0');
  }

  return metrics.join('\n') + '\n';
}

module.exports = { generatePrometheusMetrics };
