/**
 * Normalization helpers for scan findings and input extraction.
 */

const { parseLocation, resolveFindingFilePath } = require('./paths.cjs');
const { collectIssues } = require('../simplebeacon-proxy.cjs');

function normalizeScanFinding(issue = {}, source = 'Simplebeacon gate') {
  const filePath = issue.filePath || issue.file || issue.path || null;
  const line = issue.line || issue.lineNumber || null;
  const location = line && filePath ? `${filePath}:${line}` : filePath || '—';

  return {
    severity: issue.severity || 'medium',
    location,
    rule: issue.type || issue.rule || issue.category || 'finding',
    snippet: issue.snippet || issue.match || issue.description || '',
    remediation: issue.recommendedAction || issue.recommendation || issue.remediation || '',
    source,
  };
}

function flattenDataQualityFindings(dataQuality = {}) {
  if (Array.isArray(dataQuality.allFindings)) {
    return dataQuality.allFindings;
  }
  const grouped = dataQuality.findings || {};
  if (Array.isArray(grouped)) {
    return grouped;
  }
  return Object.values(grouped).flat().filter(Boolean);
}

function normalizeDataQualityFinding(finding = {}) {
  const filePath = finding.path || finding.filePath || null;
  const line = finding.metadata?.line || finding.line || null;
  return {
    severity: finding.severity || 'medium',
    location: line && filePath ? `${filePath}:${line}` : filePath || '—',
    rule: finding.type || finding.category || 'data-quality',
    snippet: finding.reason || finding.description || finding.match || '',
    remediation: finding.action || finding.recommendedAction || '',
    source: 'Data quality scan',
    metadata: finding.metadata || null,
  };
}

function extractFixInputsFromScan(scanPayload = {}) {
  if (scanPayload.type === 'simplebeacon-report') {
    return {
      issues: collectIssues(scanPayload),
      codebaseFindings: [],
      dataQualityFindings: [],
      gatePass: scanPayload.gate?.pass ?? scanPayload.simplebeaconGatePass ?? null,
    };
  }

  if (Array.isArray(scanPayload.issues) && scanPayload.issues.length) {
    return {
      issues: scanPayload.issues,
      codebaseFindings:
        scanPayload.codebaseAnalysis?.findings || scanPayload.codebase?.findings || [],
      dataQualityFindings: flattenDataQualityFindings(scanPayload.dataQuality || {}),
      gatePass: scanPayload.gate?.pass ?? scanPayload.simplebeaconGatePass ?? null,
    };
  }

  const results = scanPayload.results || {};
  const simplebeacon = results.simplebeacon || null;
  const codebase = results.codebase || null;
  const dataQuality = results.dataQuality || null;

  return {
    issues: simplebeacon ? collectIssues(simplebeacon) : [],
    codebaseFindings: Array.isArray(codebase?.findings) ? codebase.findings : [],
    dataQualityFindings: flattenDataQualityFindings(dataQuality || {}),
    gatePass: simplebeacon?.gate?.pass ?? scanPayload.summary?.simplebeaconGatePass ?? null,
  };
}

module.exports = {
  normalizeScanFinding,
  flattenDataQualityFindings,
  normalizeDataQualityFinding,
  extractFixInputsFromScan,
};
