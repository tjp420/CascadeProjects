/**
 * Build tier-gated ZIP bundles from Analyze scan payloads.
 */

const path = require('path');
const logger = require('./app-logger.cjs');
const archiver = require('archiver');
const { PassThrough } = require('stream');
const constants = require('../config/constants.cjs');
const {
  getTierManifest,
  resolveDeliverableTier,
  DELIVERABLE_TIERS
} = require('./analyze-deliverable-access.cjs');

const { normalizeCompleteScanInput } = require('./complete-scan-audit-report.cjs');
const { assessAuditExportTier, sanitizeFrozenAuditDeliverableHtml } = require('./audit-export-tier.cjs');


const { sanitizeEuAiActSprintArtifactExport } = require('./eu-ai-act-export.cjs');
const { projectLabelFromPath, redactProjectPathForExport, sanitizeCompleteScanExport, applyPublicGateToAnalyzeResponse, sanitizePublicOutput, sanitizePublicSummaryArtifactExport, sanitizeSimplebeaconReportExport, sanitizeFictionDigestExport, sanitizeComplianceChecklistArtifactExport, sanitizeConsolidationExport, sanitizeCodebaseReportExport, sanitizeDataCleanupReportExport, sanitizeCleanupBriefExport, sanitizeNpmAuditExport, sanitizeRoadmapExport, buildReAttestationNoteArtifact } = require('./simplebeacon-proxy.cjs');












/**
 * Safe stringify.
 * @param {any} obj
 * @param {any} space
 * @returns {any}
 */
function safeStringify(obj, space = 2) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  }, space);
}

/**
 * Try stringify.
 * @param {any} obj
 * @returns {any}
 */
function tryStringify(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return safeStringify(obj, 2);
  }
}

/**
 * Enrich export bundle manifest.
 * @param {any} manifest
 * @param {Object} options
 * @param {string} projectPath }
 * @returns {any}
 */
function enrichExportBundleManifest(manifest, { tierId, projectPath } = {}) {
  const label = projectLabelFromPath(projectPath);
  const redactedPath = redactProjectPathForExport(projectPath, label) || manifest.projectPath;
  const exportNotes = [
    'Operator vault ZIP — bundled JSON artifacts are path-redacted; not SimpleBeacon vendor security handoff clearance.',
    'securityHandoffEligible is false on all bundled scan JSON — vendor handoff requires paid deliverable tier exports.'
  ];
  if (tierId === 'operator') {
    exportNotes.push(
      'Includes complete engine JSON plus HTML print sources — technical hygiene only, not legal conformity certification.'
    );
  }
  return {
    ...manifest,
    projectPath: redactedPath,
    exportNormalized: true,
    exportSanitized: true,
    securityHandoffEligible: false,
    handoffEligible: false,
    exportNotes: exportNotes.slice(0, 5)
  };
}

/**
 * Slugify.
 * @param {string} text
 * @returns {any}
 */
function slugify(text) {
  return String(text || 'scan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'scan';
}

/**
 * Resolve complete scan export bundle.
 * @param {any} normalized
 * @param {string} projectPath
 * @returns {any}
 */
function resolveCompleteScanExportBundle(normalized, projectPath) {
  if (!normalized || normalized.type !== 'simplebeacon-complete-scan') return normalized;
  return sanitizeCompleteScanExport(normalized, { projectPath });
}

/**
 * Date stamp.
 * @param {any} d
 * @returns {any}
 */
function dateStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * Detect scan kind.
 * @param {any} payload
 * @returns {any}
 */
function detectScanKind(payload) {
  if (!payload || typeof payload !== 'object') return 'unknown';
  if (payload.type === 'simplebeacon-complete-scan') return 'complete';
  if (payload.kind) return payload.kind;
  if (payload.type === 'simplebeacon-eu-ai-act-sprint') return 'eu-ai-act';
  if (payload.gate || payload.rawIssues) return 'simplebeacon-report';
  return 'unknown';
}

const EU_AI_ACT_ARTIFACT_IDS = new Set(['eu-ai-act-sprint', 'eu-ai-act-audit']);

/** Engine ids from Analyze → Complete queue map to ZIP artifact ids. */
const ARTIFACT_ENGINE_REQUIREMENTS = {
  'public-summary': ['simplebeacon'],
  'simplebeacon-gate': ['simplebeacon'],
  'fiction-digest': ['mock-scan'],
  'compliance-checklist': ['compliance'],
  'consolidation': ['consolidation'],
  'codebase-summary': ['codebase'],
  'file-reduction': ['file-reduction'],
  'data-quality': ['data-quality'],
  'cleanup-brief': ['cleanup-assistant'],
  'npm-audit': ['npm-audit'],
  'roadmap': ['roadmap'],
  'executive-audit': ['simplebeacon'],
  'agency-certificate': ['simplebeacon'],
  're-attestation-readme': ['simplebeacon']
};

const ENGINE_RESULT_KEYS = {
  simplebeacon: 'simplebeacon',
  'mock-scan': 'mockScan',
  consolidation: 'consolidation',
  roadmap: 'roadmap',
  codebase: 'codebase',
  'file-reduction': 'fileReduction',
  'data-quality': 'dataQuality',
  'cleanup-assistant': 'cleanupAssistant',
  compliance: 'compliance',
  'npm-audit': 'npmAudit',
  'eu-ai-act': 'sprint'
};

/**
 * Resolve engines run.
 * @param {any} payload
 * @param {Object} options
 * @returns {any}
 */
function resolveEnginesRun(payload, options = {}) {
  if (Array.isArray(options.enginesRun) && options.enginesRun.length) {
    return options.enginesRun;
  }
  if (Array.isArray(payload?.enginesRun) && payload.enginesRun.length) {
    return payload.enginesRun;
  }
  if (Array.isArray(payload?.analysisConfig?.enginesRun) && payload.analysisConfig.enginesRun.length) {
    return payload.analysisConfig.enginesRun;
  }
  if (Array.isArray(payload?.steps) && payload.steps.length) {
    return payload.steps.map((step) => step?.id).filter(Boolean);
  }
  return [];
}

/**
 * Resolve selected engines for export.
 * @param {any} payload
 * @param {Object} options
 * @returns {any}
 */
function resolveSelectedEnginesForExport(payload, options = {}) {
  if (Array.isArray(options.selectedEngines) && options.selectedEngines.length) {
    return [...new Set(options.selectedEngines.filter(Boolean))];
  }
  const fromPayload = payload?.enginesRun || payload?.analysisConfig?.selectedEngines || payload?.selectedEngines;
  if (Array.isArray(fromPayload) && fromPayload.length) {
    return [...new Set(fromPayload.filter(Boolean))];
  }
  return null;
}

/**
 * Filter complete scan for engines.
 * @param {any} completeScan
 * @param {Array} engineIds
 * @returns {any}
 */
function filterCompleteScanForEngines(completeScan, engineIds = []) {
  if (!completeScan || typeof completeScan !== 'object') return completeScan;
  if (!Array.isArray(engineIds) || !engineIds.length) return completeScan;

  const selected = new Set(engineIds);
  const normalized = normalizeCompleteScanInput(completeScan) || completeScan;
  // Keep all existing results — if a result was computed in the scan it should be
  // available for export regardless of the selectedEngines filter (which is meant
  // for step-level filtering, not result pruning).
  const results = { ...(normalized.results || {}) };

  const enginesRun = (normalized.enginesRun || normalized.analysisConfig?.enginesRun || [])
    .filter((id) => selected.has(id));
  const filteredEnginesRun = enginesRun.length
    ? enginesRun
    : engineIds.filter((id) => selected.has(id));

  const steps = Array.isArray(normalized.steps)
    ? normalized.steps.filter((step) => selected.has(step?.id))
    : normalized.steps;

  return {
    ...normalized,
    enginesRun: filteredEnginesRun,
    analysisConfig: {
      ...(normalized.analysisConfig || {}),
      selectedEngines: engineIds,
      enginesRun: filteredEnginesRun
    },
    steps,
    results
  };
}

/**
 * Artifact allowed for engines.
 * @param {string} artifactId
 * @param {any} engineSet
 * @param {Object} options
 * @param {any} scanKind
 * @returns {any}
 */
function artifactAllowedForEngines(artifactId, engineSet, { includeEuAiAct = false, scanKind = 'unknown' } = {}) {
  if (artifactId === 'complete-scan-bundle') {
    return scanKind === 'complete';
  }
  if (EU_AI_ACT_ARTIFACT_IDS.has(artifactId)) {
    return includeEuAiAct && engineSet.has('eu-ai-act');
  }
  const required = ARTIFACT_ENGINE_REQUIREMENTS[artifactId];
  if (!required) return true;
  return required.some((engineId) => engineSet.has(engineId));
}

/**
 * EU sprint PDF/JSON must only ship when the sprint ran in this analysis session —
 * never from stale .simplebeacon/eu-ai-act-*.json on disk.
 */
function shouldIncludeEuAiActArtifacts(payload, options = {}) {
  if (options.includeEuAiAct === false) return false;
  if (options.includeEuAiAct === true) return true;

  const kind = detectScanKind(payload);
  if (kind === 'eu-ai-act') return true;

  const enginesRun = resolveEnginesRun(payload, options);
  if (enginesRun.includes('eu-ai-act')) return true;

  if (payload?.results?.sprint || payload?.sprint) return true;

  return false;
}

/**
 * Extract complete results.
 * @param {any} completeScan
 * @returns {any}
 */
function extractCompleteResults(completeScan) {
  const normalized = normalizeCompleteScanInput(completeScan) || completeScan;
  let results = normalized?.results || {};
  const kind = detectScanKind(normalized);
  // If the payload is a raw simplebeacon-report (not a complete-scan wrapper),
  // expose it under results.simplebeacon so artifact generators can find it.
  if (kind === 'simplebeacon-report' && !results.simplebeacon) {
    results = { ...results, simplebeacon: normalized };
  }
  return { normalized, results, kind, projectPath: normalized?.projectPath || normalized?.projectRoot || '' };
}

/**
 * Build public summary.
 * @param {any} completeScan
 * @returns {any}
 */
function buildPublicSummary(completeScan) {
  const { normalized, results, projectPath } = extractCompleteResults(completeScan);
  const simplebeacon = results.simplebeacon || normalized;
  const gated = applyPublicGateToAnalyzeResponse(simplebeacon || normalized);
  const publicBlock = gated?.publicSummary || sanitizePublicOutput(simplebeacon || normalized);

  return sanitizePublicSummaryArtifactExport({
    type: 'simplebeacon-public-summary',
    generatedAt: new Date().toISOString(),
    projectPath: projectPath || normalized?.projectPath || null,
    summary: publicBlock.summary || publicBlock,
    severityCounts: publicBlock.severityCounts || gated?.severityCounts || {},
    publicGateLocked: true,
    note: 'Detailed file paths and remediation steps require a paid deliverable tier.'
  }, {
    projectPath,
    gateReport: simplebeacon
  });
}

/**
 * Validate scan for tier.
 * @param {string} tierId
 * @param {any} scanKind
 * @returns {any}
 */
function validateScanForTier(tierId, scanKind) {
  const tier = DELIVERABLE_TIERS[tierId];
  if (!tier) return { ok: false, error: 'Unknown deliverable tier' };
  if (tier.requiresCompleteScan && scanKind !== 'complete') {
    return {
      ok: false,
      error: 'This deliverable tier requires Analyze → Complete (all ten engines). Run a complete scan and retry.'
    };
  }
  if (tier.minScanKind && !tier.minScanKind.includes(scanKind)) {
    return {
      ok: false,
      error: `Scan type "${scanKind}" does not match tier requirements. Expected one of: ${tier.minScanKind.join(', ')}.`
    };
  }
  return { ok: true };
}

/**
 * Generate executive audit html.
 * @param {any} completeScan
 * @param {Object} options
 * @returns {any}
 */
async function generateExecutiveAuditHtml(completeScan, options = {}) {
  const { buildCompleteAuditReport } = require('./complete-scan-audit-report.cjs');
  // Wrap raw simplebeacon-report (no .results) into complete-scan shape
  // so assessAuditExportTier and buildCompleteAuditReport can find the data.
  const payload = completeScan && completeScan.results ? completeScan : {
    type: 'simplebeacon-complete-scan',
    version: '1.3.0',
    generatedAt: completeScan?.generatedAt || new Date().toISOString(),
    projectPath: completeScan?.projectRoot || completeScan?.projectPath || '',
    results: { simplebeacon: completeScan }
  };
  const tierPreview = assessAuditExportTier(payload);
  if (tierPreview.exportBlocked) {
    return { skipped: true, reason: tierPreview.blockReason };
  }
  const creds = options.credentials || {};
  const report = await buildCompleteAuditReport(payload, {
    client: creds.projectName || options.client || 'Client',
    company: creds.projectName || options.company || options.client || 'Client',
    assessor: creds.signatoryName || options.assessor || 'SimpleBeacon Operator',
    credentials: options.credentials,
    aiProvider: options.aiProvider || 'demo',
    summarizeFn: null
  });
  return { skipped: false, html: report.html, filename: report.filename || 'executive-audit.html' };
}

/**
 * Generate eu ai act audit html.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
async function generateEuAiActAuditHtml(projectPath, options = {}) {
  const { buildEuAiActAuditReport } = require('./eu-ai-act-audit-report.cjs');
  const sprint = options.sprintPayload || options.inlineArtifacts || null;
  const report = await buildEuAiActAuditReport({
    projectPath: options.euProjectPath || projectPath,
    clientName: options.client || options.company || undefined,
    deliverableSku: options.deliverableSku || options.productSku || 'euai2499',
    artifacts: sprint
  });
  return { html: report.html, filename: report.filename || 'eu-ai-act-audit.html' };
}

/**
 * Generate agency certificate html.
 * @param {any} completeScan
 * @param {Object} options
 * @returns {any}
 */
async function generateAgencyCertificateHtml(completeScan, options = {}) {
  const { buildCertificateModel, renderCertificateHtml } = require('./code-hygiene-certificate.cjs');
const { applyPublicGateToAnalyzeResponse, buildReAttestationNoteArtifact, projectLabelFromPath, redactProjectPathForExport, sanitizeCleanupBriefExport, sanitizeCodebaseReportExport, sanitizeCompleteScanExport, sanitizeComplianceChecklistArtifactExport, sanitizeConsolidationExport, sanitizeDataCleanupReportExport, sanitizeFictionDigestExport, sanitizeNpmAuditExport, sanitizePublicOutput, sanitizePublicSummaryArtifactExport, sanitizeRoadmapExport, sanitizeSimplebeaconReportExport } = require('./simplebeacon-proxy.cjs');

  const { normalized, results } = extractCompleteResults(completeScan);
  const gateReport = results.simplebeacon || normalized?.results?.simplebeacon || normalized;
  if (!gateReport?.gate) {
    return { skipped: true, reason: 'Gate report required for agency certificate' };
  }
  const creds2 = options.credentials || {};
  const model = buildCertificateModel({
    report: gateReport,
    milestone: options.milestone || 'release',
    project_name: creds2.projectName || options.projectName || path.basename(normalized?.projectPath || 'project'),
    agency_name: options.agencyName || options.company || 'Agency',
    client_name: creds2.projectName || options.client || 'Client',
    branding: options.branding || null,
    credentials: options.credentials
  });
  return { skipped: false, html: renderCertificateHtml(model) };
}

/**
 * Collect export artifacts.
 * @param {any} completeScan
 * @param {string} tierId
 * @param {Object} options
 * @returns {any}
 */
async function collectExportArtifacts(completeScan, tierId, options = {}) {
  const manifest = getTierManifest(tierId);
  const selectedEngines = resolveSelectedEnginesForExport(completeScan, options);
  const exportEngineSet = selectedEngines ? new Set(selectedEngines) : null;
  logger.debug(`[Export Bundle] collectExportArtifacts called — tier: ${tierId}, selectedEngines: ${JSON.stringify(selectedEngines || [])}, engineSet size: ${exportEngineSet?.size ?? 0}`);
  const filteredScan = selectedEngines?.length
    ? filterCompleteScanForEngines(completeScan, selectedEngines)
    : completeScan;
  const extracted = extractCompleteResults(filteredScan);
  let { normalized, results, kind, projectPath } = extracted;
  logger.debug(`[Export Bundle] scan kind: ${kind}, results keys: ${Object.keys(results || {}).filter(k => !!results[k]).join(', ') || 'none'}`);
  if (kind === 'complete' && normalized?.type === 'simplebeacon-complete-scan') {
    normalized = resolveCompleteScanExportBundle(normalized, projectPath);
    results = normalized.results || results;
  }
  const scanValidation = validateScanForTier(tierId, kind);
  if (!scanValidation.ok) {
    const err = new Error(scanValidation.error);
    err.code = 'tier_scan_mismatch';
    throw err;
  }

  const files = [];
  const warnings = [];
  const stamp = new Date().toISOString();
  const includeEuAiAct = shouldIncludeEuAiActArtifacts(filteredScan, {
    ...options,
    enginesRun: selectedEngines
  });
  const artifacts = manifest.artifacts.filter((artifact) => {
    if (exportEngineSet) {
      if (!artifactAllowedForEngines(artifact.id, exportEngineSet, { includeEuAiAct, scanKind: kind })) {
        if (EU_AI_ACT_ARTIFACT_IDS.has(artifact.id) && !includeEuAiAct) {
          warnings.push(`${artifact.id}: excluded - EU AI Act sprint was not run in this analysis session`);
        } else {
          warnings.push(`${artifact.id}: excluded - not selected in export queue`);
        }
        return false;
      }
      return true;
    }
    if (EU_AI_ACT_ARTIFACT_IDS.has(artifact.id) && !includeEuAiAct) {
      warnings.push(`${artifact.id}: excluded - EU AI Act sprint was not run in this analysis session`);
      return false;
    }
    return true;
  });

  for (const artifact of artifacts) {
    try {
      // Yield to event loop every few artifacts to prevent blocking
      if (files.length % 3 === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      switch (artifact.id) {
        case 'public-summary':
          files.push({
            path: artifact.filename,
            content: tryStringify(buildPublicSummary(normalized), null, 2)
          });
          break;
        case 'simplebeacon-gate': {
          const gate = results.simplebeacon || (kind === 'simplebeacon-report' ? normalized : null);
          if (!gate) {
            warnings.push('simplebeacon-gate: no gate report in scan payload');
            break;
          }
          files.push({
            path: artifact.filename,
            content: tryStringify(
              sanitizeSimplebeaconReportExport(gate, {
                projectPath,
                repositoryFilesTotal: gate.repositoryFilesTotal
                  ?? gate.repositoryInventory?.totalFiles
              }),
              null,
              2
            )
          });
          break;
        }
        case 'fiction-digest':
          if (results.mockScan) {
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeFictionDigestExport(results.mockScan, {
                  projectPath,
                  repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal
                    ?? results.simplebeacon?.repositoryInventory?.totalFiles,
                  gateReport: results.simplebeacon || null
                }),
                null,
                2
              )
            });
          } else {
            warnings.push('fiction-digest: not present in scan');
          }
          break;
        case 'compliance-checklist':
          if (results.compliance) {
            const checklist = sanitizeComplianceChecklistArtifactExport(results.compliance, {
              projectPath,
              gateReport: results.simplebeacon,
              npmAudit: results.npmAudit,
              repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal
                ?? results.simplebeacon?.repositoryInventory?.totalFiles
            });
            files.push({ path: artifact.filename, content: tryStringify(checklist, null, 2) });
          } else {
            warnings.push('compliance-checklist: not present - run compliance step or Complete scan');
          }
          break;
        case 'complete-scan-bundle':
          files.push({ path: artifact.filename, content: tryStringify(normalized, null, 2) });
          break;
        case 'consolidation':
          if (results.consolidation) {
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeConsolidationExport(results.consolidation, {
                  projectPath,
                  repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal
                    ?? results.simplebeacon?.repositoryInventory?.totalFiles,
                  gateReport: results.simplebeacon || null
                }),
                null,
                2
              )
            });
          } else {
            warnings.push('consolidation: not present in scan');
          }
          break;
        case 'codebase-summary':
          if (results.codebase) {
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeCodebaseReportExport(results.codebase, {
                  projectPath,
                  requestedProjectPath: projectPath,
                  scanTargetRoot: results.simplebeacon?.scanTargetRoot,
                  repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal
                    ?? results.simplebeacon?.repositoryInventory?.totalFiles,
                  gateReport: results.simplebeacon || null
                }),
                null,
                2
              )
            });
          } else {
            warnings.push('codebase-summary: not present in scan');
          }
          break;
        case 'file-reduction':
          if (results.fileReduction) {
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeDataCleanupReportExport(results.fileReduction, {
                  projectPath,
                  repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal
                    ?? results.simplebeacon?.repositoryInventory?.totalFiles,
                  gateReport: results.simplebeacon || null
                }),
                null,
                2
              )
            });
          } else {
            warnings.push('file-reduction: not present in scan');
          }
          break;
        case 'data-quality':
          if (results.dataQuality) {
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeDataCleanupReportExport(results.dataQuality, {
                  projectPath,
                  repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal
                    ?? results.simplebeacon?.repositoryInventory?.totalFiles,
                  gateReport: results.simplebeacon || null
                }),
                null,
                2
              )
            });
          } else {
            warnings.push('data-quality: not present in scan');
          }
          break;
        case 'cleanup-brief':
          if (results.cleanupAssistant) {
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeCleanupBriefExport(results.cleanupAssistant, {
                  projectPath,
                  repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal
                    ?? results.simplebeacon?.repositoryInventory?.totalFiles,
                  gateReport: results.simplebeacon || null,
                  fileReductionReport: results.fileReduction || null
                }),
                null,
                2
              )
            });
          } else {
            warnings.push('cleanup-brief: not present in scan');
          }
          break;
        case 'npm-audit':
          if (results.npmAudit) {
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeNpmAuditExport(results.npmAudit, projectPath, {
                  repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal
                    ?? results.simplebeacon?.repositoryInventory?.totalFiles,
                  gateReport: results.simplebeacon || null
                }),
                null,
                2
              )
            });
          } else {
            warnings.push('npm-audit: not present in scan');
          }
          break;
        case 'roadmap':
          if (results.roadmap) {
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeRoadmapExport(results.roadmap, {
                  requestedProjectPath: projectPath,
                  repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal
                    ?? results.simplebeacon?.repositoryInventory?.totalFiles,
                  gateReport: results.simplebeacon || null
                }),
                null,
                2
              )
            });
          } else {
            warnings.push('roadmap: not present in scan');
          }
          break;
        case 'eu-ai-act-sprint': {
          const raw = results.sprint || normalized?.sprint;
          const euSanitizeOptions = {
            projectPath: null,
            gateReport: results.simplebeacon || null,
            repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal
              ?? results.simplebeacon?.repositoryInventory?.totalFiles,
            npmAudit: results.npmAudit || null
          };
          if (raw) {
            euSanitizeOptions.projectPath = raw.projectPath || projectPath || options.baseDir;
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeEuAiActSprintArtifactExport(raw, euSanitizeOptions),
                null,
                2
              )
            });
          } else if (kind === 'eu-ai-act' && normalized?.sprint) {
            euSanitizeOptions.projectPath = normalized.sprint.projectPath || projectPath || options.baseDir;
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeEuAiActSprintArtifactExport(normalized.sprint, euSanitizeOptions),
                null,
                2
              )
            });
          } else {
            warnings.push('eu-ai-act-sprint: run EU AI Act sprint mode or include sprint in payload');
          }
          break;
        }
        case 'executive-audit': {
          const audit = await generateExecutiveAuditHtml(normalized, options);
          if (audit.skipped) {
            warnings.push(`executive-audit: ${audit.reason}`);
          } else {
            files.push({ path: artifact.filename, content: sanitizeFrozenAuditDeliverableHtml(audit.html) });
          }
          break;
        }
        case 'eu-ai-act-audit': {
          if (!includeEuAiAct) {
            warnings.push('eu-ai-act-audit: skipped - EU AI Act sprint not part of this scan');
            break;
          }
          const sprintPayload = results.sprint || normalized?.sprint || null;
          if (sprintPayload?.html) {
            files.push({ path: artifact.filename, content: sanitizeFrozenAuditDeliverableHtml(sprintPayload.html) });
          } else {
            const euProjectPath = sprintPayload?.projectPath || projectPath || options.baseDir;
            const gateReport = results.simplebeacon || normalized;
            const eu = await generateEuAiActAuditHtml(euProjectPath, {
              ...options,
              euProjectPath,
              sprintPayload: {
                ...sprintPayload,
                report: sprintPayload?.report || gateReport,
                platformRoot: sprintPayload?.platformRoot || euProjectPath
              }
            });
            files.push({ path: artifact.filename, content: sanitizeFrozenAuditDeliverableHtml(eu.html) });
          }
          break;
        }
        case 'agency-certificate': {
          const cert = await generateAgencyCertificateHtml(normalized, options);
          if (cert.skipped) {
            warnings.push(`agency-certificate: ${cert.reason}`);
          } else {
            files.push({ path: artifact.filename, content: sanitizeFrozenAuditDeliverableHtml(cert.html) });
          }
          break;
        }
        case 're-attestation-readme':
          files.push({
            path: artifact.filename,
            content: tryStringify(
              buildReAttestationNoteArtifact({
                tierId,
                projectPath,
                gateReport: results.simplebeacon,
                repositoryFilesTotal: results.simplebeacon?.repositoryFilesTotal,
                generatedAt: stamp
              }),
              null,
              2
            )
          });
          break;
        default:
          warnings.push(`Unknown artifact id: ${artifact.id}`);
      }
    } catch (err) {
      warnings.push(`${artifact.id}: ${String(err.message || err).replace(/[\r\n]+/g, ' ').slice(0, 240)}`);
    }
  }

  // Add a report.json that reflects the primary scan/analysis type
  // Prioritize simplebeacon report because roadmap.html requires
  // qualityScore / schemaCompliance / consistencyScore at the top level.
/**
 * Report json content.
 * @param {any} (
 * @returns {any}
 */
  const reportJsonContent = (() => {
    if (results.simplebeacon) return results.simplebeacon;
    if (kind === 'complete' && normalized) return normalized;
    if (results.codebase) return results.codebase;
    if (results.mockScan) return results.mockScan;
    if (results.roadmap) return results.roadmap;
    if (results.consolidation) return results.consolidation;
    if (results.fileReduction) return results.fileReduction;
    if (results.dataQuality) return results.dataQuality;
    if (results.cleanupAssistant) return results.cleanupAssistant;
    if (results.npmAudit) return results.npmAudit;
    if (results.compliance) return results.compliance;
    if (results.euAiAct) return results.euAiAct;
    return normalized || {};
  })();
  let reportJsonText;
  try {
    reportJsonText = tryStringify(reportJsonContent, null, 2);
  } catch (stringifyErr) {
    console.warn('[Export Bundle] Circular reference in reportJson, using safe stringify:', stringifyErr.message);
    reportJsonText = safeStringify(reportJsonContent, 2);
  }
  files.unshift({
    path: 'report.json',
    content: reportJsonText
  });

  const enginesRunList = selectedEngines || resolveEnginesRun(normalized, options);
  const manifestId = `SB-${String(kind).toUpperCase().slice(0,8)}-${enginesRunList.join('+').replace(/-/g,'').toUpperCase().slice(0,24)}-${stamp.slice(0,10).replace(/-/g,'')}`;
  const bundleManifest = enrichExportBundleManifest({
    type: 'simplebeacon-export-bundle-manifest',
    version: '1.0.0',
    generatedAt: stamp,
    manifestNumber: manifestId,
    tierId,
    tierLabel: manifest.label,
    productSku: manifest.productSku,
    projectPath: projectPath || null,
    scanKind: kind,
    selectedEngines: enginesRunList,
    enginesRun: enginesRunList,
    euAiActIncluded: includeEuAiAct,
    artifactCount: files.length,
    artifacts: files.map((f) => f.path),
    warnings,
    instructions: {
      pdf: 'Open reports/*.html in a browser → Print → Save as PDF.',
      json: 'Gate and complete-scan JSON can be re-imported on Analyze or fed to the CLI compliance workflow.'
    }
  }, { tierId, projectPath });

  let manifestText;
  try {
    manifestText = tryStringify(bundleManifest, null, 2);
  } catch (stringifyErr) {
    console.warn('[Export Bundle] Circular reference in manifest, using safe stringify:', stringifyErr.message);
    manifestText = safeStringify(bundleManifest, 2);
  }
  files.unshift({
    path: 'manifest.json',
    content: manifestText
  });

  files.push({
    path: 'README.txt',
    content: [
      'SimpleBeacon scan export bundle',
      `Tier: ${manifest.label}`,
      `Generated: ${stamp}`,
      '',
      'Contents:',
      ...artifacts.map((a) => `  - ${a.filename} — ${a.label}`),
      '',
      warnings.length ? `Notes:\n${warnings.map((w) => `  - ${w}`).join('\n')}` : 'All requested artifacts included.',
      '',
      'Print HTML reports to PDF for client delivery.',
      'This bundle is a technical hygiene export — not legal conformity certification.'
    ].join('\n')
  });

  // Include lightweight step metadata only — full scan data lives in results/
  // artifacts above, so duplicating it here would bloat the ZIP unnecessarily.
  const scanSteps = normalized?.steps || completeScan?.steps || [];
  for (let i = 0; i < scanSteps.length; i++) {
    const step = scanSteps[i];
    if (!step || !step.id) continue;
    if (i % 5 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    const stepFileName = `steps/${String(step.id).replace(/[^a-z0-9-]/gi, '_')}.json`;
    if (files.some((f) => f.path === stepFileName)) continue;
    try {
      const isBrowserAnalyzer = step.findings != null || step.category != null || step.findingsCount != null;
      const slimStep = isBrowserAnalyzer ? {
        id: step.id,
        status: step.status || 'unknown',
        error: step.error || null,
        metric: step.metric || null,
        findingsCount: step.findingsCount ?? null,
        fileCount: step.fileCount ?? null,
        severity: step.severity || null,
        findings: step.findings || null,
        category: step.category || null
      } : {
        id: step.id,
        status: step.status || step.report?.status || 'unknown',
        error: step.error || null,
        metric: step.metric || null,
        gatePass: step.gatePass ?? step.report?.gate?.pass ?? null,
        publicGateLocked: step.publicGateLocked ?? null
      };
      files.push({
        path: stepFileName,
        content: tryStringify(slimStep, null, 2)
      });
    } catch (err) {
      warnings.push(`step-export-${step.id}: ${String(err.message || err).slice(0, 120)}`);
    }
  }

  return { files, manifest: bundleManifest, warnings };
}

const ONE_MB = constants.BYTES_PER_KB * constants.BYTES_PER_KB;

/**
 * Split large json parts.
 * @param {string} filePath
 * @param {any} content
 * @returns {any}
 */
function splitLargeJsonParts(filePath, content) {
  const isJson = filePath.endsWith('.json');
  if (!isJson || Buffer.byteLength(content, 'utf8') <= ONE_MB) {
    return [{ path: filePath, content }];
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch {
    // Cannot parse — fall back to raw text chunking
    return splitTextParts(filePath, content);
  }

  if (Array.isArray(data) && data.length > 0) {
    return splitArrayParts(filePath, data);
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return splitObjectParts(filePath, data);
  }

  return splitTextParts(filePath, content);
}

/**
 * Split array parts.
 * @param {string} filePath
 * @param {any} arr
 * @returns {any}
 */
function splitArrayParts(filePath, arr) {
  const base = filePath.replace(/\.json$/, '');
  const parts = [];
  let currentChunk = [];
  let currentSize = 2; // '[]'

  // Pre-compute sizes to avoid O(n²) stringify
  const itemSizes = arr.map((item) => Buffer.byteLength(JSON.stringify(item, null, 2), 'utf8'));

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const itemSize = itemSizes[i];

    // If a single item is already > threshold and is an object/array, pre-split it
    if (itemSize > ONE_MB - constants.MAX_EXPORT_CHUNK && item != null && typeof item === 'object') {
      if (currentChunk.length > 0) {
        parts.push({ content: JSON.stringify(currentChunk, null, 2) });
        currentChunk = [];
        currentSize = 2;
      }
      const innerParts = splitLargeJsonParts(`${base}.json`, JSON.stringify(item, null, 2));
      for (const innerPart of innerParts) {
        let parsed;
        try {
          parsed = JSON.parse(innerPart.content);
        } catch (parseErr) {
          logger.warn(`[Export Bundle] splitArrayParts JSON.parse failed for ${filePath}: ${parseErr.message}. Content preview: ${String(innerPart.content).slice(0, 200)}`);
          parsed = {};
        }
        parts.push({ content: JSON.stringify([parsed], null, 2) });
      }
      continue;
    }

    const comma = currentChunk.length > 0 ? 1 : 0;
    if (currentSize + itemSize + comma > ONE_MB - constants.MAX_EXPORT_CHUNK && currentChunk.length > 0) {
      parts.push({ content: JSON.stringify(currentChunk, null, 2) });
      currentChunk = [item];
      currentSize = 2 + itemSize;
    } else {
      currentChunk.push(item);
      currentSize += itemSize + comma;
    }
  }

  if (currentChunk.length > 0) {
    parts.push({ content: JSON.stringify(currentChunk, null, 2) });
  }

  if (parts.length <= 1) {
    return [{ path: `${base}.json`, content: parts[0]?.content || '[]' }];
  }
  return parts.map((p, i) => ({
    path: i === 0 ? `${base}.json` : `${base}-part-${i + 1}.json`,
    content: p.content
  }));
}

/**
 * Split object parts.
 * @param {string} filePath
 * @param {any} obj
 * @returns {any}
 */
function splitObjectParts(filePath, obj) {
  const base = filePath.replace(/\.json$/, '');
  const keys = Object.keys(obj);
  const parts = [];
  let currentChunk = {};
  let currentSize = 2; // '{}'

  // Pre-compute sizes to avoid O(n²) stringify
  const keySizes = new Map();
  for (const key of keys) {
    const value = obj[key];
    const valueStr = JSON.stringify(value, null, 2);
    const valueSize = Buffer.byteLength(valueStr, 'utf8');
    const keyLabelSize = Buffer.byteLength(`"${key}": `, 'utf8');
    keySizes.set(key, { value, valueStr, valueSize, keyLabelSize });
  }

  for (const key of keys) {
    const { value, valueStr, valueSize, keyLabelSize } = keySizes.get(key);

    // If a single value is already > threshold and is an object/array, pre-split it
    if (valueSize > ONE_MB - constants.MAX_EXPORT_CHUNK && value != null && typeof value === 'object') {
      if (Object.keys(currentChunk).length > 0) {
        parts.push({ content: JSON.stringify(currentChunk, null, 2) });
        currentChunk = {};
        currentSize = 2;
      }
      const innerParts = splitLargeJsonParts(`${base}.json`, valueStr);
      for (const innerPart of innerParts) {
        let parsed;
        try {
          parsed = JSON.parse(innerPart.content);
        } catch (parseErr) {
          logger.warn(`[Export Bundle] splitObjectParts JSON.parse failed for ${filePath} key=${key}: ${parseErr.message}. Content preview: ${String(innerPart.content).slice(0, 200)}`);
          parsed = {};
        }
        parts.push({
          content: JSON.stringify({ [key]: parsed }, null, 2)
        });
      }
      continue;
    }

    const comma = Object.keys(currentChunk).length > 0 ? 2 : 0; // ', ' between properties
    const entrySize = keyLabelSize + valueSize + comma;
    if (currentSize + entrySize > ONE_MB - constants.MAX_EXPORT_CHUNK && Object.keys(currentChunk).length > 0) {
      parts.push({ content: JSON.stringify(currentChunk, null, 2) });
      currentChunk = { [key]: value };
      currentSize = 2 + keyLabelSize + valueSize;
    } else {
      currentChunk[key] = value;
      currentSize += entrySize;
    }
  }

  if (Object.keys(currentChunk).length > 0) {
    parts.push({ content: JSON.stringify(currentChunk, null, 2) });
  }

  // Iteratively re-split any oversized single-key parts until all are <= threshold
  let changed = true;
  let result = parts.slice();
  while (changed) {
    changed = false;
    const newResult = [];
    for (const part of result) {
      const partSize = Buffer.byteLength(part.content, 'utf8');
      if (partSize > ONE_MB) {
        let partData;
        try {
          partData = JSON.parse(part.content);
        } catch (parseErr) {
          logger.warn(`[Export Bundle] splitObjectParts re-split JSON.parse failed for ${filePath}: ${parseErr.message}. Content preview: ${String(part.content).slice(0, 200)}`);
          newResult.push(part);
          continue;
        }
        const partKeys = Object.keys(partData);
        if (partKeys.length === 1) {
          const key = partKeys[0];
          const val = partData[key];
          if (val != null && typeof val === 'object') {
            const innerParts = splitLargeJsonParts(`${base}.json`, JSON.stringify(val, null, 2));
            for (const innerPart of innerParts) {
              let parsed;
              try {
                parsed = JSON.parse(innerPart.content);
              } catch (parseErr) {
                logger.warn(`[Export Bundle] splitObjectParts re-split inner JSON.parse failed for ${filePath} key=${key}: ${parseErr.message}. Content preview: ${String(innerPart.content).slice(0, 200)}`);
                parsed = {};
              }
              newResult.push({
                content: JSON.stringify({ [key]: parsed }, null, 2)
              });
            }
            changed = true;
            continue;
          }
        }
      }
      newResult.push(part);
    }
    result = newResult;
  }

  if (result.length <= 1) {
    return [{ path: `${base}.json`, content: result[0]?.content || '{}' }];
  }
  return result.map((p, i) => ({
    path: i === 0 ? `${base}.json` : `${base}-part-${i + 1}.json`,
    content: p.content
  }));
}

/**
 * Split text parts.
 * @param {string} filePath
 * @param {string} text
 * @returns {any}
 */
function splitTextParts(filePath, text) {
  const base = filePath.replace(/\.json$/, '');
  const total = Buffer.byteLength(text, 'utf8');
  const chunkCount = Math.ceil(total / ONE_MB) || 1;
  const charCount = text.length;
  const perChunk = Math.max(1, Math.ceil(charCount / chunkCount));
  const parts = [];
  for (let i = 0; i < charCount; i += perChunk) {
    const slice = text.slice(i, i + perChunk);
    const suffix = i === 0 ? '' : `-part-${Math.ceil((i + 1) / perChunk)}`;
    parts.push({
      path: `${base}${suffix}.json`,
      content: slice
    });
  }
  return parts;
}

/**
 * Build analyze export zip stream.
 * @param {any} completeScan
 * @param {Object} options
 * @returns {any}
 */
async function buildAnalyzeExportZipStream(completeScan, options = {}) {
  const tierId = resolveDeliverableTier({
    requestedSku: options.deliverableSku,
    internalDashboard: options.internalDashboard,
    publicGateLocked: options.publicGateLocked,
    hasAuditDeliverableAccess: options.hasAuditDeliverableAccess,
    cloudTeamsActive: options.cloudTeamsActive
  });

  if (tierId === 'community' && options.publicGateLocked && !options.internalDashboard) {
    const err = new Error('Export bundle requires a paid deliverable tier. Unlock Executive clearance ($499) or sign in to operator vault.');
    err.code = 'export_paywall';
    err.tier = tierId;
    throw err;
  }

  const { files, manifest, warnings } = await collectExportArtifacts(completeScan, tierId, options);
  logger.debug(`[Export Bundle] Tier: ${tierId}, files: ${files.length}, warnings: ${warnings.length}`);
  if (warnings.length) logger.debug('[Export Bundle] Warnings:', warnings.slice(0, 10));

  if (files.length <= 2) {
    const err = new Error('No export artifacts could be generated from this scan. Run Complete scan or choose a matching analysis mode.');
    err.code = 'export_empty';
    err.warnings = warnings;
    throw err;
  }

  const slug = slugify(manifest.projectPath);
  const filename = `simplebeacon-export-${tierId}-${slug}-${dateStamp()}.zip`;

  // Build archive — stream to outputStream if provided (prevents memory bloat / event-loop deadlock)
  const archive = archiver('zip', { zlib: { level: 1 } });
  let archiveError = null;
  archive.on('error', (err) => { archiveError = err; });

  let chunks;
  let stream;
  if (options.outputStream) {
    if (options.setHeaders) options.setHeaders();
    archive.pipe(options.outputStream);
  } else {
    chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    // Provide a readable stream for legacy callers that expect { stream }
    stream = new PassThrough();
    archive.pipe(stream);
  }

  const root = `simplebeacon-export-${tierId}-${dateStamp()}`;
  let fileIndex = 0;
  for (const file of files) {
    // Yield to event loop every 5 files to prevent blocking
    if (fileIndex > 0 && fileIndex % 5 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    fileIndex++;
    const parts = splitLargeJsonParts(file.path, file.content);
    for (const part of parts) {
      archive.append(part.content, { name: `${root}/${part.path}` });
    }
  }

  await new Promise((resolve) => setImmediate(resolve));
  await archive.finalize();
  if (archiveError) {
    throw archiveError;
  }

  if (options.outputStream) {
    return { filename, manifest, tierId, warnings };
  }

  const buffer = Buffer.concat(chunks);
  logger.debug(`[Export Bundle] ZIP size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  return { buffer, stream, filename, manifest, tierId, warnings };
}

module.exports = {
  buildAnalyzeExportZipStream,
  collectExportArtifacts,
  resolveDeliverableTier,
  extractCompleteResults,
  validateScanForTier,
  resolveEnginesRun,
  resolveSelectedEnginesForExport,
  filterCompleteScanForEngines,
  artifactAllowedForEngines,
  shouldIncludeEuAiActArtifacts,
  slugify,
  dateStamp,
  enrichExportBundleManifest,
  ARTIFACT_ENGINE_REQUIREMENTS,
  ENGINE_RESULT_KEYS
};
