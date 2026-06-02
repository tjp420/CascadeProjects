/**
 * Build tier-gated ZIP bundles from Analyze scan payloads.
 */

const path = require('path');
const archiver = require('archiver');
const { PassThrough } = require('stream');
const {
  getTierManifest,
  resolveDeliverableTier,
  DELIVERABLE_TIERS
} = require('./analyze-deliverable-access.cjs');
const { applyPublicGateToAnalyzeResponse, sanitizePublicOutput } = require('../../packages/simplebeacon-cli/src/lib/report-sanitizer');
const { normalizeCompleteScanInput } = require('./complete-scan-audit-report.cjs');
const { assessAuditExportTier, sanitizeFrozenAuditDeliverableHtml } = require('./audit-export-tier.cjs');
const { sanitizeCompleteScanExport } = require('../../packages/simplebeacon-cli/src/lib/complete-scan-export-sanitize');
const { sanitizeComplianceChecklistArtifactExport } = require('../../packages/simplebeacon-cli/src/lib/compliance-export-sanitize');
const { sanitizeEuAiActSprintArtifactExport } = require('./eu-ai-act-export.cjs');
const { sanitizeFictionDigestExport } = require('../../packages/simplebeacon-cli/src/lib/fiction-digest-export-sanitize');
const { sanitizeDataCleanupReportExport } = require('../../packages/simplebeacon-cli/src/lib/data-cleanup-export-sanitize');
const { sanitizeNpmAuditExport } = require('../../packages/simplebeacon-cli/src/lib/npm-audit-export-sanitize');
const { sanitizePublicSummaryArtifactExport } = require('../../packages/simplebeacon-cli/src/lib/public-summary-export-sanitize');
const { buildReAttestationNoteArtifact } = require('../../packages/simplebeacon-cli/src/lib/re-attestation-note-export-sanitize');
const { sanitizeRoadmapExport } = require('../../packages/simplebeacon-cli/src/lib/roadmap-export-sanitize');
const { sanitizeSimplebeaconReportExport } = require('../../packages/simplebeacon-cli/src/lib/simplebeacon-report-export-sanitize');
const { sanitizeCleanupBriefExport } = require('../../packages/simplebeacon-cli/src/lib/cleanup-brief-export-sanitize');
const { sanitizeCodebaseReportExport } = require('../../packages/simplebeacon-cli/src/lib/codebase-export-sanitize');
const { sanitizeConsolidationExport } = require('../../packages/simplebeacon-cli/src/lib/consolidation-export-sanitize');
const { redactProjectPathForExport, projectLabelFromPath } = require('../../packages/simplebeacon-cli/src/lib/assessment-export-sanitize');

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

function slugify(text) {
  return String(text || 'scan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'scan';
}

function resolveCompleteScanExportBundle(normalized, projectPath) {
  if (!normalized || normalized.type !== 'simplebeacon-complete-scan') return normalized;
  return sanitizeCompleteScanExport(normalized, { projectPath });
}

function dateStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

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

function resolveSelectedEnginesForExport(payload, options = {}) {
  if (Array.isArray(options.selectedEngines) && options.selectedEngines.length) {
    return [...new Set(options.selectedEngines.filter(Boolean))];
  }
  return null;
}

function filterCompleteScanForEngines(completeScan, engineIds = []) {
  if (!completeScan || typeof completeScan !== 'object') return completeScan;
  if (!Array.isArray(engineIds) || !engineIds.length) return completeScan;

  const selected = new Set(engineIds);
  const normalized = normalizeCompleteScanInput(completeScan) || completeScan;
  const results = { ...(normalized.results || {}) };
  for (const [engineId, resultKey] of Object.entries(ENGINE_RESULT_KEYS)) {
    if (!selected.has(engineId)) {
      delete results[resultKey];
    }
  }

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

function artifactAllowedForEngines(artifactId, engineSet, { includeEuAiAct = false } = {}) {
  if (artifactId === 'complete-scan-bundle') {
    return engineSet.size > 0;
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

function extractCompleteResults(completeScan) {
  const normalized = normalizeCompleteScanInput(completeScan) || completeScan;
  const results = normalized?.results || {};
  const kind = detectScanKind(normalized);
  return { normalized, results, kind, projectPath: normalized?.projectPath || normalized?.projectRoot || '' };
}

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

async function generateExecutiveAuditHtml(completeScan, options = {}) {
  const { buildCompleteAuditReport } = require('./complete-scan-audit-report.cjs');
  const tierPreview = assessAuditExportTier(completeScan);
  if (tierPreview.exportBlocked) {
    return { skipped: true, reason: tierPreview.blockReason };
  }
  const report = await buildCompleteAuditReport(completeScan, {
    client: options.client || 'Client',
    company: options.company || options.client || 'Client',
    assessor: options.assessor || 'SimpleBeacon Operator',
    aiProvider: options.aiProvider || 'demo',
    summarizeFn: null
  });
  return { skipped: false, html: report.html, filename: report.filename || 'executive-audit.html' };
}

async function generateEuAiActAuditHtml(projectPath, options = {}) {
  const { buildEuAiActAuditReport } = require('./eu-ai-act-audit-report.cjs');
  const sprint = options.sprintPayload || options.inlineArtifacts || null;
  const report = await buildEuAiActAuditReport({
    projectPath: options.euProjectPath || projectPath,
    clientName: options.client || options.company || undefined,
    deliverableSku: options.deliverableSku || options.productSku || 'euai2499',
    inlineArtifacts: sprint
  });
  return { html: report.html, filename: report.filename || 'eu-ai-act-audit.html' };
}

async function generateAgencyCertificateHtml(completeScan, options = {}) {
  const { buildCertificateModel, renderCertificateHtml } = require('./code-hygiene-certificate.cjs');
  const { normalized, results } = extractCompleteResults(completeScan);
  const gateReport = results.simplebeacon || normalized?.results?.simplebeacon || normalized;
  if (!gateReport?.gate) {
    return { skipped: true, reason: 'Gate report required for agency certificate' };
  }
  const model = buildCertificateModel({
    report: gateReport,
    milestone: options.milestone || 'release',
    project_name: options.projectName || path.basename(normalized?.projectPath || 'project'),
    agency_name: options.agencyName || options.company || 'Agency',
    client_name: options.client || 'Client',
    branding: options.branding || null
  });
  return { skipped: false, html: renderCertificateHtml(model) };
}

async function collectExportArtifacts(completeScan, tierId, options = {}) {
  const manifest = getTierManifest(tierId);
  const selectedEngines = resolveSelectedEnginesForExport(completeScan, options);
  const exportEngineSet = selectedEngines ? new Set(selectedEngines) : null;
  const filteredScan = selectedEngines?.length
    ? filterCompleteScanForEngines(completeScan, selectedEngines)
    : completeScan;
  const extracted = extractCompleteResults(filteredScan);
  let { normalized, results, kind, projectPath } = extracted;
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
      if (!artifactAllowedForEngines(artifact.id, exportEngineSet, { includeEuAiAct })) {
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
      switch (artifact.id) {
        case 'public-summary':
          files.push({
            path: artifact.filename,
            content: JSON.stringify(buildPublicSummary(normalized), null, 2)
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
            content: JSON.stringify(
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
              content: JSON.stringify(
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
            files.push({ path: artifact.filename, content: JSON.stringify(checklist, null, 2) });
          } else {
            warnings.push('compliance-checklist: not present - run compliance step or Complete scan');
          }
          break;
        case 'complete-scan-bundle':
          files.push({ path: artifact.filename, content: JSON.stringify(normalized, null, 2) });
          break;
        case 'consolidation':
          if (results.consolidation) {
            files.push({
              path: artifact.filename,
              content: JSON.stringify(
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
              content: JSON.stringify(
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
              content: JSON.stringify(
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
              content: JSON.stringify(
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
              content: JSON.stringify(
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
              content: JSON.stringify(
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
              content: JSON.stringify(
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
              content: JSON.stringify(
                sanitizeEuAiActSprintArtifactExport(raw, euSanitizeOptions),
                null,
                2
              )
            });
          } else if (kind === 'eu-ai-act' && normalized?.sprint) {
            euSanitizeOptions.projectPath = normalized.sprint.projectPath || projectPath || options.baseDir;
            files.push({
              path: artifact.filename,
              content: JSON.stringify(
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
          const euProjectPath = sprintPayload?.projectPath || projectPath || options.baseDir;
          const eu = await generateEuAiActAuditHtml(euProjectPath, {
            ...options,
            euProjectPath,
            sprintPayload
          });
          files.push({ path: artifact.filename, content: sanitizeFrozenAuditDeliverableHtml(eu.html) });
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
            content: JSON.stringify(
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

  const bundleManifest = enrichExportBundleManifest({
    type: 'simplebeacon-export-bundle-manifest',
    version: '1.0.0',
    generatedAt: stamp,
    tierId,
    tierLabel: manifest.label,
    productSku: manifest.productSku,
    projectPath: projectPath || null,
    scanKind: kind,
    selectedEngines: selectedEngines || resolveEnginesRun(normalized, options),
    enginesRun: selectedEngines || resolveEnginesRun(normalized, options),
    euAiActIncluded: includeEuAiAct,
    artifactCount: files.length,
    artifacts: files.map((f) => f.path),
    warnings,
    instructions: {
      pdf: 'Open reports/*.html in a browser → Print → Save as PDF.',
      json: 'Gate and complete-scan JSON can be re-imported on Analyze or fed to the CLI compliance workflow.'
    }
  }, { tierId, projectPath });

  files.unshift({
    path: 'manifest.json',
    content: JSON.stringify(bundleManifest, null, 2)
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

  return { files, manifest: bundleManifest, warnings };
}

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

  if (files.length <= 2) {
    const err = new Error('No export artifacts could be generated from this scan. Run Complete scan or choose a matching analysis mode.');
    err.code = 'export_empty';
    err.warnings = warnings;
    throw err;
  }

  const slug = slugify(manifest.projectPath);
  const filename = `simplebeacon-export-${tierId}-${slug}-${dateStamp()}.zip`;

  const stream = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => stream.destroy(err));
  archive.pipe(stream);

  const root = `simplebeacon-export-${tierId}-${dateStamp()}`;
  for (const file of files) {
    archive.append(file.content, { name: `${root}/${file.path}` });
  }

  await archive.finalize();

  return { stream, filename, manifest, tierId, warnings };
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
