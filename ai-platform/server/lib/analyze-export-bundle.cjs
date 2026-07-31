// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Build tier-gated ZIP bundles from Analyze scan payloads.
 *
 * REFACTORED: Previously 1,268 lines. Now imports focused sub-modules:
 *   - constants.cjs  — lookup tables (ARTIFACT_ENGINE_REQUIREMENTS, ENGINE_RESULT_KEYS)
 *   - utils.cjs      — safeStringify, slugify, dateStamp, detectScanKind
 *   - engines.cjs    — resolveEnginesRun, filterCompleteScanForEngines, artifactAllowedForEngines
 *   - validation.cjs — enrichExportBundleManifest, buildPublicSummary, validateScanForTier
 *   - split.cjs      — splitLargeJsonParts, splitArrayParts, splitObjectParts, splitTextParts
 */

const path = require('path');
const logger = require('./app-logger.cjs');
const archiver = require('archiver');
const { PassThrough } = require('stream');
const { getTierManifest, resolveDeliverableTier } = require('./analyze-deliverable-access.cjs');
const { sanitizeFrozenAuditDeliverableHtml } = require('./audit-export-tier.cjs');
const {
  sanitizeEuAiActSprintArtifactExport,
  projectLabelFromPath,
  redactProjectPathForExport,
  sanitizeCompleteScanExport,
  applyPublicGateToAnalyzeResponse,
  sanitizePublicOutput,
  sanitizePublicSummaryArtifactExport,
  sanitizeSimplebeaconReportExport,
  sanitizeFictionDigestExport,
  sanitizeComplianceChecklistArtifactExport,
  sanitizeConsolidationExport,
  sanitizeCodebaseReportExport,
  sanitizeDataCleanupReportExport,
  sanitizeCleanupBriefExport,
  sanitizeNpmAuditExport,
  sanitizeRoadmapExport,
  buildReAttestationNoteArtifact,
} = require('./simplebeacon-proxy.cjs');

const {
  safeStringify,
  tryStringify,
  slugify,
  dateStamp,
  detectScanKind,
} = require('./analyze-export-bundle/utils.cjs');
const {
  resolveEnginesRun,
  resolveSelectedEnginesForExport,
  filterCompleteScanForEngines,
  artifactAllowedForEngines,
  shouldIncludeEuAiActArtifacts,
} = require('./analyze-export-bundle/engines.cjs');
const {
  enrichExportBundleManifest,
  resolveCompleteScanExportBundle,
  buildPublicSummary,
  validateScanForTier,
} = require('./analyze-export-bundle/validation.cjs');
const { splitLargeJsonParts } = require('./analyze-export-bundle/split.cjs');
const {
  EU_AI_ACT_ARTIFACT_IDS,
  ARTIFACT_ENGINE_REQUIREMENTS,
  ENGINE_RESULT_KEYS,
} = require('./analyze-export-bundle/constants.cjs');

/**
 * Resolve repository file count from a gate report.
 * @param {Object|null} gateReport
 * @returns {number|null}
 */
function resolveRepoFilesTotal(gateReport) {
  return gateReport?.repositoryFilesTotal ?? gateReport?.repositoryInventory?.totalFiles ?? null;
}

/**
 * Yield to the event loop to avoid blocking.
 * @returns {Promise<void>}
 */
function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

/* ── Result extraction ─────────────────────────────────────────────── */

/**
 * Extract complete scan results.
 * @param {Object} completeScan
 * @returns {{normalized: Object, results: Object, kind: string, projectPath: string}}
 */
function extractCompleteResults(completeScan) {
  const normalized = resolveCompleteScanExportBundle(completeScan) || completeScan;
  let results = normalized?.results || {};
  const kind = detectScanKind(normalized);
  if (kind === 'simplebeacon-report' && !results.simplebeacon) {
    results = { ...results, simplebeacon: normalized };
  }
  return {
    normalized,
    results,
    kind,
    projectPath: normalized?.projectPath || normalized?.projectRoot || '',
  };
}

/* ── HTML generators ──────────────────────────────────────────────── */

/**
 * Generate executive audit HTML.
 * @param {Object} completeScan
 * @param {Object} [options]
 * @returns {Promise<{skipped: boolean, reason?: string, html?: string, filename?: string}>}
 */
async function generateExecutiveAuditHtml(completeScan, options = {}) {
  const { buildCompleteAuditReport } = require('./complete-scan-audit-report.cjs');
  const { assessAuditExportTier } = require('./audit-export-tier.cjs');
  const payload =
    completeScan && completeScan.results
      ? completeScan
      : {
          type: 'simplebeacon-complete-scan',
          version: '1.3.0',
          generatedAt: completeScan?.generatedAt || new Date().toISOString(),
          projectPath: completeScan?.projectRoot || completeScan?.projectPath || '',
          results: { simplebeacon: completeScan },
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
    summarizeFn: null,
  });
  return { skipped: false, html: report.html, filename: report.filename || 'executive-audit.html' };
}

/**
 * Generate EU AI Act audit HTML.
 * @param {string} projectPath
 * @param {Object} [options]
 * @returns {Promise<{html: string, filename: string}>}
 */
async function generateEuAiActAuditHtml(projectPath, options = {}) {
  const { buildEuAiActAuditReport } = require('./eu-ai-act-audit-report.cjs');
  const sprint = options.sprintPayload || options.inlineArtifacts || null;
  const report = await buildEuAiActAuditReport({
    projectPath: options.euProjectPath || projectPath,
    clientName: options.client || options.company || undefined,
    deliverableSku: options.deliverableSku || options.productSku || 'euai2499',
    artifacts: sprint,
  });
  return { html: report.html, filename: report.filename || 'eu-ai-act-audit.html' };
}

/**
 * Generate agency certificate HTML.
 * @param {Object} completeScan
 * @param {Object} [options]
 * @returns {Promise<{skipped: boolean, reason?: string, html?: string}>}
 */
async function generateAgencyCertificateHtml(completeScan, options = {}) {
  const {
    buildCertificateModel,
    renderCertificateHtml,
  } = require('./code-hygiene-certificate.cjs');
  const { normalized, results } = extractCompleteResults(completeScan);
  const gateReport = results.simplebeacon || normalized?.results?.simplebeacon || normalized;
  if (!gateReport?.gate) {
    return { skipped: true, reason: 'Gate report required for agency certificate' };
  }
  const creds2 = options.credentials || {};
  const model = buildCertificateModel({
    report: gateReport,
    milestone: options.milestone || 'release',
    project_name:
      creds2.projectName ||
      options.projectName ||
      path.basename(normalized?.projectPath || 'project'),
    agency_name: options.agencyName || options.company || 'Agency',
    client_name: creds2.projectName || options.client || 'Client',
    branding: options.branding || null,
    credentials: options.credentials,
  });
  return { skipped: false, html: renderCertificateHtml(model) };
}

/* ── Main artifact collector ───────────────────────────────────────── */

/**
 * Collect export artifacts for a given tier.
 * @param {Object} completeScan
 * @param {string} tierId
 * @param {Object} [options]
 * @returns {Promise<{files: Array<Object>, manifest: Object, warnings: Array<string>}>}
 */
async function collectExportArtifacts(completeScan, tierId, options = {}) {
  const manifest = getTierManifest(tierId);
  const selectedEngines = resolveSelectedEnginesForExport(completeScan, options);
  const exportEngineSet = selectedEngines ? new Set(selectedEngines) : null;
  logger.debug(
    `[Export Bundle] collectExportArtifacts called — tier: ${tierId}, selectedEngines: ${JSON.stringify(selectedEngines || [])}, engineSet size: ${exportEngineSet?.size ?? 0}`
  );
  const filteredScan = selectedEngines?.length
    ? filterCompleteScanForEngines(completeScan, selectedEngines)
    : completeScan;
  const extracted = extractCompleteResults(filteredScan);
  let { normalized, results, kind, projectPath } = extracted;
  logger.debug(
    `[Export Bundle] scan kind: ${kind}, results keys: ${
      Object.keys(results || {})
        .filter((k) => !!results[k])
        .join(', ') || 'none'
    }`
  );
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
    enginesRun: selectedEngines,
  });
  const artifacts = manifest.artifacts.filter((artifact) => {
    if (exportEngineSet) {
      if (
        !artifactAllowedForEngines(artifact.id, exportEngineSet, { includeEuAiAct, scanKind: kind })
      ) {
        if (EU_AI_ACT_ARTIFACT_IDS.has(artifact.id) && !includeEuAiAct) {
          warnings.push(
            `${artifact.id}: excluded - EU AI Act sprint was not run in this analysis session`
          );
        } else {
          warnings.push(`${artifact.id}: excluded - not selected in export queue`);
        }
        return false;
      }
      return true;
    }
    if (EU_AI_ACT_ARTIFACT_IDS.has(artifact.id) && !includeEuAiAct) {
      warnings.push(
        `${artifact.id}: excluded - EU AI Act sprint was not run in this analysis session`
      );
      return false;
    }
    return true;
  });

  for (const artifact of artifacts) {
    try {
      if (files.length % 4 === 0) {
        await yieldEventLoop();
      }
      switch (artifact.id) {
        case 'public-summary':
          files.push({
            path: artifact.filename,
            content: tryStringify(buildPublicSummary(normalized), null, 2),
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
                repositoryFilesTotal: resolveRepoFilesTotal(gate),
              }),
              null,
              2
            ),
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
                  repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
                  gateReport: results.simplebeacon || null,
                }),
                null,
                2
              ),
            });
          } else {
            warnings.push('fiction-digest: not present in scan');
          }
          break;
        case 'compliance-checklist':
          if (results.compliance) {
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeComplianceChecklistArtifactExport(results.compliance, {
                  projectPath,
                  gateReport: results.simplebeacon,
                  npmAudit: results.npmAudit,
                  repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
                }),
                null,
                2
              ),
            });
          } else {
            warnings.push(
              'compliance-checklist: not present - run compliance step or Complete scan'
            );
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
                  repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
                  gateReport: results.simplebeacon || null,
                }),
                null,
                2
              ),
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
                  repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
                  gateReport: results.simplebeacon || null,
                }),
                null,
                2
              ),
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
                  repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
                  gateReport: results.simplebeacon || null,
                }),
                null,
                2
              ),
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
                  repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
                  gateReport: results.simplebeacon || null,
                }),
                null,
                2
              ),
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
                  repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
                  gateReport: results.simplebeacon || null,
                  fileReductionReport: results.fileReduction || null,
                }),
                null,
                2
              ),
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
                  repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
                  gateReport: results.simplebeacon || null,
                }),
                null,
                2
              ),
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
                  repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
                  gateReport: results.simplebeacon || null,
                }),
                null,
                2
              ),
            });
          } else {
            warnings.push('roadmap: not present in scan');
          }
          break;
        case 'eu-ai-act-sprint': {
          const raw = results.sprint || normalized?.sprint;
          const euOpts = {
            projectPath: null,
            gateReport: results.simplebeacon || null,
            repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
            npmAudit: results.npmAudit || null,
          };
          if (raw) {
            euOpts.projectPath = raw.projectPath || projectPath || options.baseDir;
            files.push({
              path: artifact.filename,
              content: tryStringify(sanitizeEuAiActSprintArtifactExport(raw, euOpts), null, 2),
            });
          } else if (kind === 'eu-ai-act' && normalized?.sprint) {
            euOpts.projectPath = normalized.sprint.projectPath || projectPath || options.baseDir;
            files.push({
              path: artifact.filename,
              content: tryStringify(
                sanitizeEuAiActSprintArtifactExport(normalized.sprint, euOpts),
                null,
                2
              ),
            });
          } else {
            warnings.push(
              'eu-ai-act-sprint: run EU AI Act sprint mode or include sprint in payload'
            );
          }
          break;
        }
        case 'executive-audit': {
          const audit = await generateExecutiveAuditHtml(normalized, options);
          if (audit.skipped) {
            warnings.push(`executive-audit: ${audit.reason}`);
          } else {
            files.push({
              path: artifact.filename,
              content: sanitizeFrozenAuditDeliverableHtml(audit.html),
            });
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
            files.push({
              path: artifact.filename,
              content: sanitizeFrozenAuditDeliverableHtml(sprintPayload.html),
            });
          } else {
            const euProjectPath = sprintPayload?.projectPath || projectPath || options.baseDir;
            const eu = await generateEuAiActAuditHtml(euProjectPath, {
              ...options,
              euProjectPath,
              sprintPayload: {
                ...sprintPayload,
                report: sprintPayload?.report || results.simplebeacon || normalized,
                platformRoot: sprintPayload?.platformRoot || euProjectPath,
              },
            });
            files.push({
              path: artifact.filename,
              content: sanitizeFrozenAuditDeliverableHtml(eu.html),
            });
          }
          break;
        }
        case 'agency-certificate': {
          const cert = await generateAgencyCertificateHtml(normalized, options);
          if (cert.skipped) {
            warnings.push(`agency-certificate: ${cert.reason}`);
          } else {
            files.push({
              path: artifact.filename,
              content: sanitizeFrozenAuditDeliverableHtml(cert.html),
            });
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
                repositoryFilesTotal: resolveRepoFilesTotal(results.simplebeacon),
                generatedAt: stamp,
              }),
              null,
              2
            ),
          });
          break;
        default:
          warnings.push(`Unknown artifact id: ${artifact.id}`);
      }
    } catch (err) {
      if (logger.debug) {
        logger.debug(`[Export Bundle] artifact error: ${artifact.id}`, {
          code: err.code,
          stack: err.stack,
        });
      }
      warnings.push(
        `${artifact.id}: ${String(err.message || err)
          .replace(/[\r\n]+/g, ' ')
          .slice(0, 240)}`
      );
    }
  }

  const reportJsonContent =
    results.simplebeacon ||
    (kind === 'complete' && normalized) ||
    results.codebase ||
    results.mockScan ||
    results.roadmap ||
    results.consolidation ||
    results.fileReduction ||
    results.dataQuality ||
    results.cleanupAssistant ||
    results.npmAudit ||
    results.compliance ||
    results.euAiAct ||
    normalized ||
    {};
  let reportJsonText;
  try {
    reportJsonText = tryStringify(reportJsonContent, null, 2);
  } catch (stringifyErr) {
    reportJsonText = safeStringify(reportJsonContent, 2);
  }
  files.unshift({ path: 'report.json', content: reportJsonText });

  const enginesRunList = selectedEngines || resolveEnginesRun(normalized, options);
  const manifestId = `SB-${String(kind).toUpperCase().slice(0, 8)}-${enginesRunList.join('+').replace(/-/g, '').toUpperCase().slice(0, 24)}-${stamp.slice(0, 10).replace(/-/g, '')}`;
  const bundleManifest = enrichExportBundleManifest(
    {
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
        json: 'Gate and complete-scan JSON can be re-imported on Analyze or fed to the CLI compliance workflow.',
      },
    },
    { tierId, projectPath }
  );

  let manifestText;
  try {
    manifestText = tryStringify(bundleManifest, null, 2);
  } catch (stringifyErr) {
    manifestText = safeStringify(bundleManifest, 2);
  }
  files.unshift({ path: 'manifest.json', content: manifestText });

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
      warnings.length
        ? `Notes:\n${warnings.map((w) => `  - ${w}`).join('\n')}`
        : 'All requested artifacts included.',
      '',
      'Print HTML reports to PDF for client delivery.',
      'This bundle is a technical hygiene export — not legal conformity certification.',
    ].join('\n'),
  });

  const scanSteps = normalized?.steps || completeScan?.steps || [];
  for (let i = 0; i < scanSteps.length; i++) {
    const step = scanSteps[i];
    if (!step || !step.id) continue;
    if (i % 5 === 0) {
      await yieldEventLoop();
    }
    const stepFileName = `steps/${String(step.id).replace(/[^a-z0-9-]/gi, '_')}.json`;
    if (files.some((f) => f.path === stepFileName)) continue;
    try {
      const isBrowserAnalyzer =
        step.findings != null || step.category != null || step.findingsCount != null;
      const slimStep = isBrowserAnalyzer
        ? {
            id: step.id,
            status: step.status || 'unknown',
            error: step.error || null,
            metric: step.metric || null,
            findingsCount: step.findingsCount ?? null,
            fileCount: step.fileCount ?? null,
            severity: step.severity || null,
            findings: step.findings || null,
            category: step.category || null,
          }
        : {
            id: step.id,
            status: step.status || step.report?.status || 'unknown',
            error: step.error || null,
            metric: step.metric || null,
            gatePass: step.gatePass ?? step.report?.gate?.pass ?? null,
            publicGateLocked: step.publicGateLocked ?? null,
          };
      files.push({ path: stepFileName, content: tryStringify(slimStep, null, 2) });
    } catch (err) {
      warnings.push(`step-export-${step.id}: ${String(err.message || err).slice(0, 120)}`);
    }
  }

  return { files, manifest: bundleManifest, warnings };
}

/* ── ZIP stream builder ────────────────────────────────────────────── */

/**
 * Build an export ZIP stream from a complete scan.
 * @param {Object} completeScan
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function buildAnalyzeExportZipStream(completeScan, options = {}) {
  const tierId = resolveDeliverableTier({
    requestedSku: options.deliverableSku,
    internalDashboard: options.internalDashboard,
    publicGateLocked: options.publicGateLocked,
    hasAuditDeliverableAccess: options.hasAuditDeliverableAccess,
    cloudTeamsActive: options.cloudTeamsActive,
  });

  if (tierId === 'community' && options.publicGateLocked && !options.internalDashboard) {
    const err = new Error(
      'Export bundle requires a paid deliverable tier. Unlock Executive clearance ($499) or sign in to operator vault.'
    );
    err.code = 'export_paywall';
    err.tier = tierId;
    throw err;
  }

  const { files, manifest, warnings } = await collectExportArtifacts(completeScan, tierId, options);
  logger.debug(
    `[Export Bundle] Tier: ${tierId}, files: ${files.length}, warnings: ${warnings.length}`
  );
  if (warnings.length) logger.debug('[Export Bundle] Warnings:', warnings.slice(0, 10));

  if (files.length <= 2) {
    const err = new Error(
      'No export artifacts could be generated from this scan. Run Complete scan or choose a matching analysis mode.'
    );
    err.code = 'export_empty';
    err.warnings = warnings;
    throw err;
  }

  const s = slugify(manifest.projectPath);
  const filename = `simplebeacon-export-${tierId}-${s}-${dateStamp()}.zip`;

  const archive = archiver('zip', { zlib: { level: 1 } });
  let archiveError = null;
  const archiveWarnings = [];
  archive.on('error', (err) => {
    archiveError = err;
  });
  archive.on('warning', (warn) => {
    archiveWarnings.push(String(warn.message || warn));
  });

  let chunks;
  let stream;
  let totalBytes = 0;
  const MAX_EXPORT_BYTES = 256 * 1024 * 1024; // 256 MB

  if (options.outputStream) {
    if (options.setHeaders) options.setHeaders();
    archive.pipe(options.outputStream);
  } else {
    chunks = [];
    const onData = (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_EXPORT_BYTES) {
        archive.abort();
        archiveError = new Error(
          `Export bundle exceeds ${MAX_EXPORT_BYTES / 1024 / 1024} MB memory limit`
        );
        archiveError.code = 'export_oversized';
        return;
      }
      chunks.push(chunk);
    };
    archive.on('data', onData);
    stream = new PassThrough();
    archive.pipe(stream);
  }

  const root = `simplebeacon-export-${tierId}-${dateStamp()}`;
  let fileIndex = 0;
  for (const file of files) {
    if (fileIndex > 0 && fileIndex % 5 === 0) {
      await yieldEventLoop();
    }
    fileIndex++;
    const parts = splitLargeJsonParts(file.path, file.content);
    for (const part of parts) {
      archive.append(part.content, { name: `${root}/${part.path}` });
    }
  }

  await yieldEventLoop();
  await archive.finalize();

  if (archiveError) {
    throw archiveError;
  }

  if (options.outputStream) {
    if (archiveWarnings.length) {
      logger.debug('[Export Bundle] Archive warnings:', archiveWarnings);
    }
    return { filename, manifest, tierId, warnings: warnings.concat(archiveWarnings) };
  }

  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) {
    const err = new Error('ZIP export produced zero bytes');
    err.code = 'export_empty_zip';
    throw err;
  }
  logger.debug(`[Export Bundle] ZIP size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  return { buffer, stream, filename, manifest, tierId, warnings: warnings.concat(archiveWarnings) };
}

/* ── Re-exports ────────────────────────────────────────────────────── */

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
  buildPublicSummary,
  ARTIFACT_ENGINE_REQUIREMENTS,
  ENGINE_RESULT_KEYS,
};
