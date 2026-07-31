/**

 * Security scanner page JSON export — browser mirror of server/lib/security-export.js

 */

const SECURITY_RULES_EVALUATED = ['credentials', 'production-leak'];

/**
 * Redact project path for export.
 * @param {string} rawPath
 * @param {any} projectLabel
 * @returns {any}
 */
function redactProjectPathForExport(rawPath, projectLabel = 'ai-platform') {
  if (rawPath == null || rawPath === '') return rawPath;

  const normalized = String(rawPath).replace(/\\/g, '/');

  if (
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.startsWith('/Users/') ||
    normalized.startsWith('/home/') ||
    normalized.includes('CascadeProjects')
  ) {
    return projectLabel;
  }

  return normalized;
}

/**
 * Project label from path.
 * @param {string} projectPath
 * @returns {any}
 */
function projectLabelFromPath(projectPath) {
  const normalized = String(projectPath || 'ai-platform').replace(/\\/g, '/');

  const parts = normalized.split('/').filter(Boolean);

  return parts[parts.length - 1] || 'ai-platform';
}

/**
 * Relativize scan paths.
 * @param {Array} scanPaths
 * @param {any} projectRoot
 * @returns {any}
 */
function relativizeScanPaths(scanPaths, projectRoot) {
  const root = String(projectRoot || '')
    .replace(/\\/g, '/')
    .replace(/\/$/, '');

  const rootLower = root.toLowerCase();

  return (scanPaths || []).map((entry) => {
    let rel = String(entry).replace(/\\/g, '/');

    if (root && rel.toLowerCase().startsWith(rootLower)) {
      rel = rel.slice(root.length).replace(/^\//, '');
    }

    return redactProjectPathForExport(rel, projectLabelFromPath(root)) || entry;
  });
}

/**
 * Dedupe export notes.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeExportNotes(notes = []) {
  const seen = new Set();

  const out = [];

  for (const note of notes.filter(Boolean)) {
    const text = String(note);

    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

    const scopeKey = /security scanner export — credential and production-leak/i.test(normalized)
      ? 'security-scope-note'
      : /production-leak match\(es\) suppressed by intent/i.test(normalized)
        ? 'suppressed-intent-note'
        : /clean export \(0 findings\)/i.test(normalized)
          ? 'clean-export-note'
          : /finding\(s\) exported — review recommendations/i.test(normalized)
            ? 'findings-exported-note'
            : /compliance headline securityscore/i.test(normalized)
              ? 'compliance-score-note'
              : /optimizationcompliance \(/i.test(normalized)
                ? 'optimization-compliance-note'
                : /scan gate\.pass .* differs from compliance headline/i.test(normalized)
                  ? 'gate-reconciliation-note'
                  : /compliance headline snapshot .* predates scan/i.test(normalized)
                    ? 'compliance-freshness-note'
                    : normalized;

    if (seen.has(scopeKey)) continue;

    seen.add(scopeKey);

    out.push(text.trim());
  }

  return out.slice(0, 8);
}

/**
 * Parse timestamp.
 * @param {boolean} isoTimestamp
 * @returns {any}
 */
function parseTimestamp(isoTimestamp) {
  if (isoTimestamp == null || isoTimestamp === '') return null;

  const ms = Date.parse(String(isoTimestamp));

  return Number.isFinite(ms) ? ms : null;
}

/**
 * Normalize compliance input.
 * @param {any} compliance
 * @returns {any}
 */
function normalizeComplianceInput(compliance) {
  if (!compliance) return null;

  return {
    securityScore: compliance.securityScore ?? null,

    gatePass: compliance.gatePass ?? null,

    optimizationCompliance: compliance.optimizationCompliance ?? null,

    generatedAt: compliance.generatedAt ?? compliance.headlineGeneratedAt ?? null,
  };
}

/**
 * Resolve compliance headline generated at.
 * @param {any} compliance
 * @returns {any}
 */
function resolveComplianceHeadlineGeneratedAt(compliance) {
  if (!compliance) return null;

  return compliance.generatedAt ?? compliance.headlineGeneratedAt ?? null;
}

/**
 * Sanitize scan scope for security export.
 * @param {any} scanScope
 * @returns {any}
 */
function sanitizeScanScopeForSecurityExport(scanScope) {
  if (!scanScope) return null;

  const rulesEnabled = Array.isArray(scanScope.rulesEnabled) ? scanScope.rulesEnabled : [];

  const securityRulesEvaluated = rulesEnabled.filter((rule) => SECURITY_RULES_EVALUATED.includes(rule));

  return {
    profile: scanScope.profile ?? null,

    productionPaths: scanScope.productionPaths ?? null,

    rulesEnabled,

    securityRulesEvaluated: securityRulesEvaluated.length ? securityRulesEvaluated : [...SECURITY_RULES_EVALUATED],

    securityScopeNote:
      'Findings in this export use credentials + production-leak only; rulesEnabled reflects the full gate scan profile.',
  };
}

/**
 * Sanitize compliance for security export.
 * @param {any} compliance
 * @param {number} report
 * @returns {any}
 */
function sanitizeComplianceForSecurityExport(compliance, report) {
  if (!compliance) return null;

  const scanGatePass = report?.gate?.pass ?? null;

  const headlineGatePass = compliance.gatePass ?? null;

  const gateReconciled = scanGatePass != null && headlineGatePass != null && scanGatePass === headlineGatePass;

  return {
    securityScore: compliance.securityScore ?? null,

    gatePass: headlineGatePass,

    optimizationCompliance: compliance.optimizationCompliance ?? null,

    provenance:
      resolveComplianceHeadlineGeneratedAt(compliance) || compliance.securityScore != null
        ? 'live-optimization-api'
        : 'unknown',

    headlineGeneratedAt: resolveComplianceHeadlineGeneratedAt(compliance),

    optimizationComplianceNote: 'Repository-health optimization band — not credential/production-leak finding counts.',

    securityScoreNote:
      'Headline securityScore reflects live gate/trust snapshot — distinct from finding severity counts in this export.',

    ...(gateReconciled
      ? {}
      : {
          gateReconciliationNote:
            scanGatePass != null && headlineGatePass != null
              ? `Scan gate.pass (${scanGatePass}) differs from compliance headline gatePass (${headlineGatePass}) — prefer scan.gate for rule evidence.`
              : null,
        }),
  };
}

/**
 * Sanitize finding for export.
 * @param {any} finding
 * @param {any} projectLabel
 * @returns {any}
 */
function sanitizeFindingForExport(finding, projectLabel) {
  if (!finding) return finding;

  return {
    ...finding,

    file: finding.file ? redactProjectPathForExport(finding.file, projectLabel) : finding.file,
  };
}

/**
 * Build security export notes.
 * @param {number} report
 * @param {Array} findings
 * @param {any} compliance
 * @returns {any}
 */
function buildSecurityExportNotes(report, findings = [], compliance = null) {
  const notes = [
    'Security scanner export — credential and production-leak rules only; not npm audit or penetration testing.',
  ];

  const suppressed = report?.productionLeakSuppressedIntent ?? 0;

  if (suppressed > 0) {
    notes.push(`${suppressed} production-leak match(es) suppressed by intent annotation — not counted as findings.`);
  }

  if (findings.length === 0 && report?.gate?.pass) {
    notes.push(
      'Clean export (0 findings) attests no credential or production-leak patterns in last scan scope — not SimpleBeacon vendor handoff clearance.'
    );
  } else if (findings.length > 0) {
    notes.push(`${findings.length} finding(s) exported — review recommendations before merge.`);
  }

  if (compliance?.securityScore != null) {
    notes.push(
      `Compliance headline securityScore (${compliance.securityScore}) is a live gate/trust snapshot — see compliance.securityScoreNote.`
    );
  }

  if (compliance?.optimizationCompliance) {
    notes.push(
      `optimizationCompliance (${compliance.optimizationCompliance}) labels repository-health posture — see compliance.optimizationComplianceNote.`
    );
  }

  const freshnessNote = buildComplianceFreshnessNote(compliance, report);

  if (freshnessNote) {
    notes.push(freshnessNote);
  }

  const scanGatePass = report?.gate?.pass;

  const headlineGatePass = compliance?.gatePass;

  if (scanGatePass != null && headlineGatePass != null && scanGatePass !== headlineGatePass) {
    notes.push(
      `Scan gate.pass (${scanGatePass}) differs from compliance headline gatePass (${headlineGatePass}) — prefer scan.gate for rule evidence.`
    );
  }

  return dedupeExportNotes(notes);
}

/**
 * Build compliance freshness note.
 * @param {any} compliance
 * @param {number} report
 * @returns {any}
 */
function buildComplianceFreshnessNote(compliance, report) {
  const headlineAt = parseTimestamp(resolveComplianceHeadlineGeneratedAt(compliance));

  const scanAt = parseTimestamp(report?.generatedAt);

  if (headlineAt == null || scanAt == null || headlineAt >= scanAt) return null;

  const headlineLabel = resolveComplianceHeadlineGeneratedAt(compliance);

  return `Compliance headline snapshot (${headlineLabel}) predates scan (${report.generatedAt}) — scan.gate and findings reflect fresher evidence.`;
}

/**
 * Build security hygiene summary.
 * @param {any} summary
 * @returns {any}
 */
function buildSecurityHygieneSummary(summary) {
  if (!summary) return null;

  return {
    scanClean: summary.scanClean ?? null,

    totalFindings: summary.totalFindings ?? null,

    credentialFindings: summary.credentialFindings ?? null,

    productionLeakFindings: summary.productionLeakFindings ?? null,

    gatePass: summary.gatePass ?? null,

    gateBlockingCount: summary.gateBlockingCount ?? null,

    productionLeakSuppressedIntent: summary.productionLeakSuppressedIntent ?? null,

    attestationNote: summary.attestationNote ?? null,
  };
}

/**
 * Build scan report from security export.
 * @param {any} bundle
 * @returns {any}
 */
function buildScanReportFromSecurityExport(bundle = {}) {
  const summary = bundle.summary || {};

  const scan = bundle.scan || {};

  return {
    generatedAt: scan.generatedAt ?? summary.generatedAt ?? null,

    projectRoot: scan.projectRoot ?? null,

    scanPaths: scan.scanPaths ?? null,

    credentialScanned: scan.credentialScanned ?? summary.credentialScanned ?? null,

    credentialFindings: summary.credentialFindings ?? null,

    productionLeakScanned: scan.productionLeakScanned ?? summary.productionLeakScanned ?? null,

    productionLeakFindings: summary.productionLeakFindings ?? null,

    productionLeakSuppressedIntent:
      scan.productionLeakSuppressedIntent ?? summary.productionLeakSuppressedIntent ?? null,

    gate: scan.gate ?? null,

    scanScope: scan.scanScope ?? null,
  };
}

/**
 * Build security export summary.
 * @param {number} report
 * @param {Array} findings
 * @param {any} compliance
 * @returns {any}
 */
export function buildSecurityExportSummary(report, findings = [], compliance = null) {
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const finding of findings) {
    const band = String(finding.severity || 'medium').toLowerCase();

    const increment = finding.count ?? 1;

    if (band === 'critical') severityCounts.critical += increment;
    else if (band === 'high') severityCounts.high += increment;
    else if (band === 'medium') severityCounts.medium += increment;
    else severityCounts.low += increment;
  }

  const credentialFindings =
    report?.credentialFindings ??
    findings.filter((f) => /credential/i.test(f.type)).reduce((sum, f) => sum + (f.count ?? 1), 0);

  const productionLeakFindings =
    report?.productionLeakFindings ??
    findings.filter((f) => /production leak/i.test(f.type)).reduce((sum, f) => sum + (f.count ?? 1), 0);

  return {
    credentialScanned: report?.credentialScanned ?? null,

    credentialFindings,

    productionLeakScanned: report?.productionLeakScanned ?? null,

    productionLeakFindings,

    productionLeakSuppressedIntent: report?.productionLeakSuppressedIntent ?? null,

    totalFindings: findings.reduce((sum, f) => sum + (f.count ?? 1), 0),

    severityCounts,

    gatePass: report?.gate?.pass ?? compliance?.gatePass ?? null,

    gateBlockingCount: report?.gate?.blockingCount ?? null,

    generatedAt: report?.generatedAt ?? null,

    securityScore: compliance?.securityScore ?? null,

    scanClean: findings.length === 0,

    attestationNote:
      'Credential/production-leak hygiene — not Complete scan clearance or vendor handoff certification.',
  };
}

/**
 * Build security export payload.
 * @param {number} report
 * @param {Array} findings
 * @param {any} compliance
 * @returns {any}
 */
export function buildSecurityExportPayload(report, findings = [], compliance = null) {
  if (!report) return null;

  const normalizedCompliance = normalizeComplianceInput(compliance);

  const projectLabel = projectLabelFromPath(report.projectRoot);

  const summary = buildSecurityExportSummary(report, findings, normalizedCompliance);

  const exportNotes = buildSecurityExportNotes(report, findings, normalizedCompliance);

  const sanitizedFindings = findings.map((finding) => sanitizeFindingForExport(finding, projectLabel));

  const scanPaths = relativizeScanPaths(report.scanPaths, report.projectRoot);

  return {
    type: 'simplebeacon-security-scan-export',

    version: '1.1.0',

    exportVersion: '1.1.0',

    exportSanitized: true,

    generatedBy: 'SimpleBeacon',

    title: 'SimpleBeacon Security Scan Export',

    securityHandoffEligible: false,

    handoffEligible: false,

    exportedAt: new Date().toISOString(),

    summary,

    hygieneSummary: buildSecurityHygieneSummary(summary),

    scan: {
      generatedAt: report.generatedAt ?? null,

      projectRoot: redactProjectPathForExport(report.projectRoot, projectLabel),

      scanPaths,

      gate: report.gate ?? null,

      credentialScanned: report.credentialScanned ?? null,

      productionLeakScanned: report.productionLeakScanned ?? null,

      productionLeakSuppressedIntent: report.productionLeakSuppressedIntent ?? null,

      scanScope: sanitizeScanScopeForSecurityExport(report.scanScope),
    },

    compliance: sanitizeComplianceForSecurityExport(normalizedCompliance, report),

    findings: sanitizedFindings,

    exportNotes,

    disclaimers: [
      'Credential and production-leak rules only — not npm audit or penetration testing.',

      'A clean export (0 findings) attests no matching patterns in last scan scope.',

      'Absolute host paths are redacted to project label in exports.',
    ],
  };
}

/**
 * Sanitize security scan export.
 * @param {any} bundle
 * @returns {any}
 */
export function sanitizeSecurityScanExport(bundle) {
  if (!bundle || bundle.type !== 'simplebeacon-security-scan-export') return bundle;

  return buildSecurityExportPayload(
    buildScanReportFromSecurityExport(bundle),

    bundle.findings || [],

    bundle.compliance
  );
}

/**
 * Security export filename.
 * @param {any} date
 * @returns {any}
 */
export function securityExportFilename(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);

  return `security-scan-${stamp}.json`;
}

/**
 * Can export security scan.
 * @param {number} report
 * @returns {any}
 */
export function canExportSecurityScan(report) {
  return Boolean(report && (report.generatedAt || report.gate != null || report.credentialScanned != null));
}
