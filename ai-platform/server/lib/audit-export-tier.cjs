/**
 * Classify complete-scan export payloads for audit PDF tiering.
 * Prevents partial single-step scans from rendering as full handoff docs with READINESS 50/100.
 */

const SUPPLEMENTARY_STEP_LABELS = {
  'data-quality': 'Data quality',
  'file-reduction': 'File reduction',
  consolidation: 'Data consolidation',
  'cleanup-assistant': 'Cleanup assistant',
  roadmap: 'Roadmap analysis',
  'mock-scan': 'Fiction and KPI digest',
  'simplebeacon-report': 'Simplebeacon scan',
  complete: 'Partial complete scan',
};

/**
 * Normalize export scan.
 * @param {any} completeScan
 * @returns {any}
 */
function normalizeExportScan(completeScan) {
  if (!completeScan || typeof completeScan !== 'object') return null;
  if (completeScan.results && Object.values(completeScan.results).some(Boolean)) {
    return completeScan;
  }
  if (completeScan.type === 'data-cleanup-report') {
    const profile = completeScan.scanProfile || 'data-quality';
    const resultKey = profile === 'file-reduction' ? 'fileReduction' : 'dataQuality';
    return {
      type: 'simplebeacon-complete-scan',
      version: completeScan.version || '1.3.0',
      generatedAt: completeScan.generatedAt || new Date().toISOString(),
      projectPath: completeScan.projectRoot || completeScan.projectPath || '',
      summary: {
        scanKind: profile,
        dataQualityFindings: completeScan.summary?.totalFindings ?? null,
        fileReductionFindings: completeScan.summary?.totalFindings ?? null,
      },
      results: {
        [resultKey]: completeScan,
      },
    };
  }
  return completeScan;
}

/**
 * Code files analyzed from scan.
 * @param {any} normalized
 * @returns {any}
 */
function codeFilesAnalyzedFromScan(normalized) {
  const results = normalized?.results || {};
  const fromCodebase = results.codebase?.summary?.codeFilesAnalyzed;
  if (Number.isFinite(fromCodebase) && fromCodebase > 0) return fromCodebase;
  return null;
}

/**
 * Gate pass from scan.
 * @param {any} normalized
 * @returns {any}
 */
function gatePassFromScan(normalized) {
  const results = normalized?.results || {};
  const fromGate = results.simplebeacon?.gate?.pass;
  if (fromGate === true || fromGate === false) return fromGate;
  const fromSummary = normalized?.summary?.simplebeaconGatePass;
  if (fromSummary === true || fromSummary === false) return fromSummary;
  return null;
}

/**
 * Has simplebeacon results.
 * @param {Array} results
 * @returns {any}
 */
function hasSimplebeaconResults(results) {
  const sb = results.simplebeacon;
  if (!sb || typeof sb !== 'object') return false;
  return (
    sb.gate?.pass != null ||
    sb.issueCount != null ||
    sb.qualityScore != null ||
    (Array.isArray(sb.rawIssues) && sb.rawIssues.length > 0) ||
    (Array.isArray(sb.detectedIssues) && sb.detectedIssues.length > 0) ||
    sb.ruleScopedFilesAnalyzed > 0 ||
    sb.repositoryFilesTotal > 0
  );
}

/**
 * Detect supplementary step.
 * @param {any} normalized
 * @returns {any}
 */
function detectSupplementaryStep(normalized) {
  const results = normalized?.results || {};
  const scanKind = normalized?.summary?.scanKind;
  if (scanKind && SUPPLEMENTARY_STEP_LABELS[scanKind]) {
    return { key: scanKind, label: SUPPLEMENTARY_STEP_LABELS[scanKind] };
  }
  if (results.dataQuality)
    return { key: 'data-quality', label: SUPPLEMENTARY_STEP_LABELS['data-quality'] };
  if (results.fileReduction)
    return { key: 'file-reduction', label: SUPPLEMENTARY_STEP_LABELS['file-reduction'] };
  if (results.consolidation)
    return { key: 'consolidation', label: SUPPLEMENTARY_STEP_LABELS.consolidation };
  if (results.cleanupAssistant)
    return { key: 'cleanup-assistant', label: SUPPLEMENTARY_STEP_LABELS['cleanup-assistant'] };
  if (results.roadmap) return { key: 'roadmap', label: SUPPLEMENTARY_STEP_LABELS.roadmap };
  if (results.mockScan) return { key: 'mock-scan', label: SUPPLEMENTARY_STEP_LABELS['mock-scan'] };
  if (
    hasSimplebeaconResults(results) &&
    gatePassFromScan(normalized) == null &&
    !codeFilesAnalyzedFromScan(normalized)
  ) {
    return { key: 'simplebeacon-report', label: SUPPLEMENTARY_STEP_LABELS['simplebeacon-report'] };
  }
  return { key: 'complete', label: SUPPLEMENTARY_STEP_LABELS.complete };
}

/**
 * Missing for handoff.
 * @param {boolean} hasGate
 * @param {boolean} hasCodebase
 * @returns {any}
 */
function missingForHandoff(hasGate, hasCodebase) {
  const missing = [];
  if (!hasGate) missing.push('Simplebeacon gate attestation');
  if (!hasCodebase) missing.push('Codebase deep scan (production paths)');
  return missing;
}

/**
 * @returns {{
 *   tier: 'handoff'|'gate-only'|'codebase-only'|'supplementary'|'insufficient',
 *   label: string,
 *   missingForHandoff: string[],
 *   readinessDisplay: string|null,
 *   showSignOffBlock: boolean,
 *   showReadinessScore: boolean,
 *   handoffHint: string,
 *   exportBlocked: boolean,
 *   blockReason: string|null
 * }}
 */

function buildTierResult(tier, label, overrides = {}) {
  return {
    tier,
    label,
    missingForHandoff: overrides.missingForHandoff ?? [],
    readinessDisplay: overrides.readinessDisplay ?? null,
    showSignOffBlock: overrides.showSignOffBlock ?? false,
    showReadinessScore: overrides.showReadinessScore ?? false,
    handoffHint: overrides.handoffHint ?? '',
    exportBlocked: overrides.exportBlocked ?? false,
    blockReason: overrides.blockReason ?? null,
    ...overrides.extra,
  };
}
function assessAuditExportTier(completeScan) {
  const normalized = normalizeExportScan(completeScan);
  if (!normalized) {
    return buildTierResult('insufficient', 'Insufficient scan data', {
      missingForHandoff: missingForHandoff(false, false),
      handoffHint: 'Run a scan before exporting an audit PDF.',
      exportBlocked: true,
      blockReason: 'No scan data available for audit PDF export.',
    });
  }

  const results = normalized.results || {};
  const hasAnyResult = Object.values(results).some(Boolean);
  if (!hasAnyResult) {
    return buildTierResult('insufficient', 'Insufficient scan data', {
      missingForHandoff: missingForHandoff(false, false),
      handoffHint: 'Run a scan before exporting an audit PDF.',
      exportBlocked: true,
      blockReason:
        'Export payload has no scan steps — run Complete scan or an individual analysis first.',
    });
  }

  const gatePass = gatePassFromScan(normalized);
  const hasGate = gatePass != null;
  const codeFiles = codeFilesAnalyzedFromScan(normalized);
  const hasCodebase = codeFiles != null && codeFiles > 0;
  const missing = missingForHandoff(hasGate, hasCodebase);
  const handoffHint =
    'For vendor handoff, run Analyze → Complete (all steps) or combine gate attestation + codebase audit PDFs.';

  if (hasGate && hasCodebase) {
    return buildTierResult('handoff', 'Pre-launch security audit', {
      showSignOffBlock: true,
      showReadinessScore: true,
    });
  }

  if (hasGate && !hasCodebase) {
    return buildTierResult('gate-only', 'Gate attestation', {
      missingForHandoff: missing,
      readinessDisplay: 'Gate attestation only — run Complete scan for full readiness score',
      handoffHint,
    });
  }

  if (hasCodebase && !hasGate) {
    return buildTierResult('codebase-only', 'Codebase hygiene', {
      missingForHandoff: missing,
      readinessDisplay: 'Codebase analysis only — attach gate PASS evidence for sign-off',
      handoffHint,
    });
  }

  const step = detectSupplementaryStep(normalized);
  return buildTierResult('supplementary', step.label, {
    missingForHandoff: missing,
    readinessDisplay: `Supplementary — ${step.label}`,
    handoffHint,
    extra: { stepKey: step.key },
  });
}

/**
 * Normalize client path label.
 * @param {string} path
 * @returns {any}
 */
function normalizeClientPathLabel(path) {
  let normalized = String(path || '')
    .replace(/\\/g, '/')
    .trim();
  if (!normalized) return '';
  if (/ai-platform/i.test(normalized)) return 'ai-platform';
  if (/cascadeprojects/i.test(normalized) && !/ai-platform/i.test(normalized))
    return 'CascadeProjects';
  if (/github-cache/i.test(normalized)) {
    const parts = normalized.split('/').filter(Boolean);
    const cacheIdx = parts.findIndex((part) => part.toLowerCase() === 'github-cache');
    if (cacheIdx >= 0 && parts[cacheIdx + 1]) return parts[cacheIdx + 1];
  }
  const cEllipsisUsers = normalized.match(/^[a-zA-Z]:…\/Users\/[^/]+(\/.+)?$/i);
  if (cEllipsisUsers) {
    return cEllipsisUsers[1] ? `…${cEllipsisUsers[1]}` : '…';
  }
  const winHome = normalized.match(/^[a-zA-Z]:\/Users\/[^/]+(\/.+)?$/i);
  if (winHome) {
    const tail = winHome[1] || '';
    if (/ai-platform/i.test(tail)) return 'ai-platform';
    return tail ? `…${tail}` : '…';
  }
  const unixHome = normalized.match(/^\/Users\/[^/]+(\/.+)?$/);
  if (unixHome) {
    const tail = unixHome[1] || '';
    if (/ai-platform/i.test(tail)) return 'ai-platform';
    return tail ? `…${tail}` : '…';
  }
  if (/^(?:…|\.{3})\//.test(normalized)) {
    if (/ai-platform/i.test(normalized)) return 'ai-platform';
    return normalized;
  }
  const parts = normalized.split('/').filter(Boolean);
  if (/^[A-Za-z]:$/i.test(parts[0]) && parts.length > 1) {
    if (parts[1]?.toLowerCase() === 'users' && parts.length > 3) {
      const tail = parts.slice(3).join('/');
      if (/ai-platform/i.test(tail)) return 'ai-platform';
      return `…/${tail}`;
    }
    const tail = parts.length > 2 ? parts.slice(-2).join('/') : parts[parts.length - 1];
    if (/ai-platform/i.test(tail)) return 'ai-platform';
    return parts.length > 2 ? `…/${tail}` : tail;
  }
  return parts[parts.length - 1] || normalized;
}

/**
 * Normalize simple beacon branding.
 * @param {any} value
 * @returns {any}
 */
function normalizeSimpleBeaconBranding(value) {
  return String(value ?? '').replace(/\bSimplebeacon\b/g, 'SimpleBeacon');
}

/**
 * Sanitize frozen audit deliverable html.
 * @param {any} html
 * @returns {any}
 */
function sanitizeFrozenAuditDeliverableHtml(html) {
  if (!html || typeof html !== 'string') return html;
  let next = normalizeSimpleBeaconBranding(html);
  next = next.replace(/…\/CascadeProjects\/ai-platform/gi, 'ai-platform');
  next = next.replace(/<code>CascadeProjects\/ai-platform<\/code>/gi, '<code>ai-platform</code>');
  return next;
}

/**
 * Is email like.
 * @param {any} value
 * @returns {any}
 */
function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(String(value || '').trim());
}

/**
 * Resolve audit client name.
 * @param {Object} options
 * @param {string} projectPath
 * @returns {any}
 */
function resolveAuditClientName(options = {}, projectPath = '') {
  const raw = String(options.client || options.company || '').trim();
  const isEmail = isEmailLike(raw);

  // If a project name was explicitly supplied, use it in preference to raw client/company
  const projectName = String(options.projectName || '').trim();
  if (projectName && projectName.toLowerCase() !== 'client project') {
    return projectName;
  }

  // If raw is an email, prefer the path label; fall back to email only when nothing better exists
  if (raw && raw.toLowerCase() !== 'client project' && !isEmail) {
    return normalizeClientPathLabel(raw) || raw;
  }

  const pathLabel = normalizeClientPathLabel(projectPath);
  if (pathLabel) return pathLabel;

  // Email is the only data we have — keep it
  if (raw) return raw;
  return 'Repository audit';
}

/**
 * Audit export button label.
 * @param {any} tierInfo
 * @returns {any}
 */
function auditExportButtonLabel(tierInfo) {
  if (!tierInfo || tierInfo.exportBlocked) return 'Download audit PDF';
  switch (tierInfo.tier) {
    case 'handoff':
      return 'Download security audit PDF';
    case 'gate-only':
      return 'Download supplementary PDF (gate attestation)';
    case 'codebase-only':
      return 'Download supplementary PDF (codebase)';
    default:
      return `Download supplementary PDF (${tierInfo.label})`;
  }
}

module.exports = {
  SUPPLEMENTARY_STEP_LABELS,
  normalizeExportScan,
  assessAuditExportTier,
  resolveAuditClientName,
  auditExportButtonLabel,
  normalizeClientPathLabel,
  sanitizeFrozenAuditDeliverableHtml,
};
