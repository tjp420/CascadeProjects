/**
 * Sanitize simplebeacon-public-summary operator ZIP exports.
 */

const {
  redactProjectPathForExport,
  projectLabelFromPath,
} = require('./assessment-export-sanitize');

function flattenPublicSummaryBlock(block) {
  if (!block || typeof block !== 'object') return { summary: {}, severityCounts: {} };

  let summary = block.summary ?? block;
  let severityCounts = block.severityCounts || {};

  if (
    summary &&
    typeof summary === 'object' &&
    summary.summary &&
    typeof summary.summary === 'object'
  ) {
    const inner = summary.summary;
    if (
      inner.filesScanned != null ||
      inner.gatePass != null ||
      inner.status != null ||
      inner.totalIssuesFound != null
    ) {
      severityCounts = summary.severityCounts || severityCounts;
      summary = inner;
    }
  }

  if (summary && typeof summary === 'object' && !Array.isArray(summary)) {
    const looksLikeMetrics =
      summary.filesScanned != null ||
      summary.status != null ||
      summary.gatePass != null ||
      summary.totalIssuesFound != null;
    if (!looksLikeMetrics && summary.summary && typeof summary.summary === 'object') {
      severityCounts = summary.severityCounts || severityCounts;
      summary = summary.summary;
    }
  }

  return {
    summary: looksLikePublicMetrics(summary) ? summary : summary?.summary || summary || {},
    severityCounts,
  };
}

function looksLikePublicMetrics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    value.filesScanned != null ||
    value.status != null ||
    value.gatePass != null ||
    value.totalIssuesFound != null
  );
}

function resolvePublicSummaryGateContext(payload, options = {}) {
  const gateReport = options.gateReport || {};
  const hygiene = payload?.hygieneSummary || {};
  const scanScope = payload?.scanScope || {};
  const summary = payload?.summary || {};
  const repositoryFilesTotal =
    options.repositoryFilesTotal ??
    gateReport.repositoryFilesTotal ??
    gateReport.repositoryInventory?.totalFiles ??
    scanScope.gateRepositoryFilesTotal ??
    hygiene.gateRepositoryFilesTotal ??
    summary.filesScanned ??
    null;
  const credentialScanned =
    gateReport.credentialScanned ??
    gateReport.productionLeakScanned ??
    hygiene.credentialScanned ??
    null;
  const contentScanned =
    gateReport.scanScope?.fullDirectoryStats?.contentScanned ??
    gateReport.scanScope?.fullDirectoryStats?.filesContentScanned ??
    gateReport.credentialScanned ??
    gateReport.productionLeakScanned ??
    hygiene.contentFilesScanned ??
    hygiene.credentialScanned ??
    null;
  const gateProfile =
    gateReport.scanScope?.profile ??
    scanScope.gateRuleBundleProfile ??
    hygiene.gateRuleBundleProfile ??
    null;
  const ruleScopedFilesAnalyzed =
    gateReport.ruleScopedFilesAnalyzed ??
    gateReport.scanScope?.ruleScopedFilesAnalyzed ??
    hygiene.ruleScopedFilesAnalyzed ??
    null;
  const fictionSampleFilesScanned =
    gateReport.fictionSampleFilesScanned ??
    gateReport.scanScope?.fictionSampleFilesScanned ??
    hygiene.fictionSampleFilesScanned ??
    null;
  const fictionJsonFilesScanned =
    gateReport.fictionJsonFilesScanned ??
    gateReport.scanScope?.fictionJsonFilesScanned ??
    hygiene.fictionJsonFilesScanned ??
    null;
  const fullDirectoryScan = Boolean(
    gateReport.fullDirectoryScan ||
    gateReport.scanScope?.fullDirectoryScan ||
    scanScope.fullDirectoryScan ||
    hygiene.fullDirectoryScan
  );
  const gatePass = gateReport.gate?.pass ?? summary.gatePass ?? hygiene.gatePass ?? null;
  const blockingCount =
    gateReport.gate?.blockingCount ?? gateReport.issueCount ?? hygiene.blockingCount ?? null;
  const jestBaselineChecked =
    gateReport.jestBaselineChecked === false ||
    gateReport.scanScope?.jestExecutedDuringScan === false ||
    hygiene.jestBaselineChecked === false
      ? false
      : null;
  return {
    gateReport,
    repositoryFilesTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    ruleScopedFilesAnalyzed,
    fictionSampleFilesScanned,
    fictionJsonFilesScanned,
    fullDirectoryScan,
    gatePass,
    blockingCount,
    jestBaselineChecked,
  };
}

function buildPublicSummaryHygieneSummary(summary, payload, options = {}) {
  const gateContext = resolvePublicSummaryGateContext(payload, options);
  const {
    repositoryFilesTotal: gateTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    gateReport,
    ruleScopedFilesAnalyzed,
    fictionSampleFilesScanned,
    fictionJsonFilesScanned,
    fullDirectoryScan,
    gatePass,
    blockingCount,
    jestBaselineChecked,
  } = gateContext;
  return {
    filesScanned: summary?.filesScanned ?? gateTotal,
    gatePass: gatePass ?? summary?.gatePass ?? null,
    qualityScore: gateReport?.qualityScore ?? summary?.qualityScore ?? null,
    totalIssuesFound: gateReport?.issueCount ?? summary?.totalIssuesFound ?? null,
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(ruleScopedFilesAnalyzed != null ? { ruleScopedFilesAnalyzed } : {}),
    ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
    ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
    ...(credentialScanned != null ? { credentialScanned } : {}),
    ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
    ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
      ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
      : {}),
    ...(fullDirectoryScan ? { fullDirectoryScan: true } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    ...(blockingCount != null ? { blockingCount } : {}),
    ...(jestBaselineChecked === false ? { jestBaselineChecked: false } : {}),
    attestationNote:
      'Public-tier gate summary — paths and remediation withheld; not vendor handoff certification.',
  };
}

function enrichPublicSummaryScanScope(scanScope, payload, options = {}) {
  const gateContext = resolvePublicSummaryGateContext(payload, options);
  const {
    repositoryFilesTotal: gateTotal,
    gateProfile,
    fullDirectoryScan,
    gateReport,
  } = gateContext;
  return {
    ...(scanScope || {}),
    resultsViewScope: 'public-tier-gate-summary',
    reportHealth:
      gateReport?.scanScope?.reportHealth ||
      scanScope?.reportHealth ||
      (fullDirectoryScan ? 'platform-scoped-full-tree' : 'platform-scoped'),
    securityHandoffEligible: false,
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    ...(fullDirectoryScan ? { fullDirectoryScan: true } : {}),
    publicExportNote:
      scanScope?.publicExportNote ||
      payload?.scanScope?.publicExportNote ||
      'Public-tier export — file paths and remediation details are withheld.',
  };
}

function buildPublicSummaryExportNotes(summary, context = {}) {
  const notes = [
    'Public-tier export — file paths and remediation details are withheld.',
    'securityHandoffEligible is false — vendor handoff requires paid deliverable tier exports.',
    'Absolute scan paths are redacted to project label in operator exports.',
  ];
  const ruleScoped = context.ruleScopedFilesAnalyzed;
  const filesScanned = summary?.filesScanned;
  const gateTotal =
    context.repositoryFilesTotal ?? context.gateRepositoryFilesTotal ?? filesScanned;
  const gateProfile = context.gateRuleBundleProfile;
  const blockingCount = context.blockingCount;
  if (ruleScoped != null && filesScanned != null && ruleScoped !== filesScanned) {
    notes.push(
      `filesScanned (${Number(filesScanned).toLocaleString()}) is repository inventory — gate rules evaluated ${Number(ruleScoped).toLocaleString()} scoped paths in the full scan bundle.`
    );
  }
  const fictionSamples = context.fictionSampleFilesScanned;
  const fictionJson = context.fictionJsonFilesScanned;
  const fullTree = Boolean(context.fullDirectoryScan);
  const credentialScanned = context.credentialScanned;
  const jestExecuted =
    context.jestBaselineChecked !== false && context.jestExecutedDuringScan !== false;

  if (
    fullTree &&
    filesScanned != null &&
    fictionSamples != null &&
    fictionSamples > 0 &&
    fictionSamples < filesScanned
  ) {
    notes.push(
      `Public filesScanned (${Number(filesScanned).toLocaleString()}) is repository inventory — fiction KPI rules matched ${Number(fictionSamples).toLocaleString()} *-sample.json file(s) in the gate scan.`
    );
  }
  if (fictionJson != null && fictionSamples != null && fictionJson > fictionSamples) {
    notes.push(
      `Fiction rules evaluated ${Number(fictionJson).toLocaleString()} repository JSON path(s) — KPI sample count (${Number(fictionSamples).toLocaleString()}) reflects *-sample.json files only.`
    );
  }
  if (credentialScanned != null && filesScanned != null && credentialScanned < filesScanned) {
    notes.push(
      `Credential/production-leak rules scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — public filesScanned (${Number(filesScanned).toLocaleString()}) is full repository inventory.`
    );
    if (gateTotal != null && gateTotal > credentialScanned) {
      notes.push(
        `${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in gate inventory — content rules did not walk those files.`
      );
    }
  }
  if (gateProfile && !/^(gate|full-tree)$/i.test(String(gateProfile))) {
    notes.push(
      `scanScope.profile (${gateProfile}) reflects Complete scan rule bundle — public summary withholds paths and remediation only.`
    );
    notes.push(
      `Gate rule bundle profile: ${gateProfile} — pair public summary with json/simplebeacon-gate.json for handoff evidence.`
    );
  }
  if (fullTree && ruleScoped != null && filesScanned != null && ruleScoped === filesScanned) {
    notes.push(
      `Full-tree scan — repository inventory and rule-scoped file count both ${Number(filesScanned).toLocaleString()} paths.`
    );
  }
  if (summary?.gatePass === false && (blockingCount ?? 0) > 0) {
    notes.push(
      `Gate FAIL — ${Number(blockingCount).toLocaleString()} blocking finding(s) on configured severities — public summary withholds paths; see json/simplebeacon-gate.json for production-path evidence.`
    );
  }
  if (!jestExecuted) {
    notes.push(
      'Public gate summary — Jest was not run during this scan; use gate/complete scan for test attestation.'
    );
  }
  if (summary?.gatePass === true && (summary?.totalIssuesFound ?? 0) === 0) {
    notes.push(
      'Gate pass on configured severities — hygiene attestation only, not SimpleBeacon vendor handoff or Complete scan clearance.'
    );
  }
  return [...new Set(notes)].slice(0, 14);
}

/**
 * @param {object} payload
 * @param {{ projectPath?: string, gateReport?: object }} [options]
 * @returns {object}
 */
function sanitizePublicSummaryArtifactExport(payload, options = {}) {
  if (!payload || payload.type !== 'simplebeacon-public-summary') return payload;

  const projectPath = options.projectPath || payload.projectPath || '';
  const label = projectLabelFromPath(projectPath);
  const { summary, severityCounts } = flattenPublicSummaryBlock({
    summary: payload.summary,
    severityCounts: payload.severityCounts,
  });

  const gateReport = options.gateReport || null;
  const gateContext = resolvePublicSummaryGateContext(payload, options);
  const exportNotes = buildPublicSummaryExportNotes(summary, {
    ...gateContext,
    gateRuleBundleProfile: gateContext.gateProfile,
    gateRepositoryFilesTotal: gateContext.repositoryFilesTotal,
    jestExecutedDuringScan: gateReport?.scanScope?.jestExecutedDuringScan,
  });
  const reconciledSummary = {
    ...summary,
    ...(gateContext.gatePass != null ? { gatePass: gateContext.gatePass } : {}),
    ...(gateContext.gatePass != null ? { status: gateContext.gatePass ? 'PASS' : 'FAIL' } : {}),
    ...(gateContext.blockingCount != null || gateReport?.issueCount != null
      ? {
          totalIssuesFound:
            gateReport?.issueCount ?? gateContext.blockingCount ?? summary.totalIssuesFound,
        }
      : {}),
  };

  const enrichedPayload = {
    ...payload,
    summary: reconciledSummary,
    scanScope: enrichPublicSummaryScanScope(
      payload.scanScope,
      { ...payload, summary: reconciledSummary },
      options
    ),
    hygieneSummary: buildPublicSummaryHygieneSummary(
      reconciledSummary,
      { ...payload, summary: reconciledSummary },
      options
    ),
  };

  return {
    type: 'simplebeacon-public-summary',
    generatedAt: payload.generatedAt || new Date().toISOString(),
    projectPath: redactProjectPathForExport(projectPath, label),
    summary: reconciledSummary,
    severityCounts: payload.severityCounts || severityCounts || {},
    publicGateLocked: true,
    exportNormalized: true,
    exportSanitized: true,
    scanTargetProfile: 'product',
    securityHandoffEligible: false,
    handoffEligible: false,
    note:
      payload.note || 'Detailed file paths and remediation steps require a paid deliverable tier.',
    scanScope: enrichedPayload.scanScope,
    hygieneSummary: enrichedPayload.hygieneSummary,
    exportNotes,
  };
}

module.exports = {
  flattenPublicSummaryBlock,
  resolvePublicSummaryGateContext,
  buildPublicSummaryExportNotes,
  buildPublicSummaryHygieneSummary,
  enrichPublicSummaryScanScope,
  sanitizePublicSummaryArtifactExport,
};
