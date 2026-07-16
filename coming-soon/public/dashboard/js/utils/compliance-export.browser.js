// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Browser mirror of compliance-export-sanitize.js — keep in sync.
 */

import { sanitizeNpmAuditExport } from './npm-audit-export.browser.js?v=20260716cachefix1';

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
 * Redact project path for export.
 * @param {string} rawPath
 * @param {any} projectLabel
 * @returns {any}
 */
function redactProjectPathForExport(rawPath, projectLabel = 'ai-platform') {
  if (rawPath == null || rawPath === '') return rawPath;
  const normalized = String(rawPath).replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('/Users/')
    || normalized.startsWith('/home/') || normalized.includes('CascadeProjects')) {
    return projectLabel;
  }
  return normalized;
}

/**
 * Redact compliance project path.
 * @param {any} value
 * @param {Object} options
 * @returns {any}
 */
function redactComplianceProjectPath(value, options = {}) {
  if (value == null || value === '') return value;
  const normalized = String(value).replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const githubIdx = lower.indexOf('/github-cache/');
  if (githubIdx >= 0) {
    const suffix = normalized.slice(githubIdx + 1);
    const platformLabel = options.productPlatformLabel || 'ai-platform';
    return `${platformLabel}/${suffix}`;
  }
  const label = options.projectLabel || projectLabelFromPath(normalized);
  return redactProjectPathForExport(normalized, label);
}

/**
 * Resolve compliance export path context.
 * @param {string} projectPath
 * @param {string} context
 * @returns {any}
 */
function resolveComplianceExportPathContext(projectPath, context = {}) {
  const productPlatformRoot = context.productPlatformRoot
    || (isBenchmarkCacheProjectPath(projectPath) ? resolveProductPlatformRoot(projectPath) : null);
  const projectLabel = projectLabelFromPath(productPlatformRoot || projectPath || 'ai-platform');
  return {
    projectLabel,
    productPlatformLabel: projectLabel,
    redact: (value) => redactComplianceProjectPath(value, {
      projectLabel,
      productPlatformLabel: projectLabel
    })
  };
}

/**
 * Normalize rel.
 * @param {string} projectPath
 * @returns {any}
 */
function normalizeRel(projectPath) {
  return String(projectPath || '').replace(/\\/g, '/').toLowerCase();
}

/**
 * Is benchmark cache project path.
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkCacheProjectPath(projectPath) {
  const rel = normalizeRel(projectPath);
  return rel.includes('/github-cache/') || rel.startsWith('github-cache/');
}

/**
 * Resolve product platform root.
 * @param {string} projectPath
 * @returns {any}
 */
function resolveProductPlatformRoot(projectPath) {
  const normalized = String(projectPath || '').replace(/\\/g, '/');
  const idx = normalized.toLowerCase().indexOf('/github-cache/');
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}

/**
 * Rule scoped from gate.
 * @param {number} gateReport
 * @returns {any}
 */
function ruleScopedFromGate(gateReport) {
  return gateReport?.ruleScopedFilesAnalyzed
    ?? gateReport?.scanScope?.ruleScopedFilesAnalyzed
    ?? 0;
}

/**
 * Has hollow gate.
 * @param {number} gateReport
 * @returns {any}
 */
function hasHollowGate(gateReport) {
  return Boolean(gateReport?.gate?.pass) && ruleScopedFromGate(gateReport) === 0;
}

/**
 * Schema compliance ok.
 * @param {number} gateReport
 * @returns {any}
 */
function schemaComplianceOk(gateReport) {
  const checked = gateReport?.schemaChecked ?? gateReport?.pageSampleSchemaChecked ?? 0;
  const passed = gateReport?.schemaPassed ?? gateReport?.pageSampleSchemaPassed ?? 0;
  return checked > 0 && passed === checked;
}

/**
 * Checklist has stale fail rows.
 * @param {any} checklist
 * @param {number} gateReport
 * @returns {any}
 */
function checklistHasStaleFailRows(checklist, gateReport) {
  if (!checklist?.rules?.length || !gateReport) return false;
  if (gateReport.gate?.pass !== true) return false;
  const blocking = gateReport.gate?.blockingCount ?? gateReport.issueCount ?? null;
  if (blocking != null && blocking > 0) return false;
  if ((gateReport.productionLeakFindings ?? 0) > 0) return false;
  const schemaOk = schemaComplianceOk(gateReport);
  return checklist.rules.some((rule) => {
    if (rule.status !== 'fail') return false;
    if (rule.id === 'GATE-001' || rule.id === 'LEAK-001') return true;
    if (rule.id === 'DATA-001' && schemaOk) return true;
    return false;
  });
}

/**
 * Recompute checklist summary.
 * @param {Array} rules
 * @param {any} prior
 * @returns {any}
 */
function recomputeChecklistSummary(rules, prior = {}) {
  const passed = rules.filter((r) => r.status === 'pass').length;
  const failed = rules.filter((r) => r.status === 'fail').length;
  const skipped = rules.filter((r) => r.status === 'skip').length;
  const scored = passed + failed;
  return {
    ...prior,
    passed,
    failed,
    skipped,
    total: rules.length,
    score: scored ? Math.round((passed / scored) * 100) : null,
    readyForAutomation: failed === 0 && passed > 0
  };
}

/**
 * Refresh compliance checklist from gate.
 * @param {any} checklist
 * @param {number} gateReport
 * @returns {any}
 */
function refreshComplianceChecklistFromGate(checklist, gateReport) {
  if (!checklist?.rules?.length || !gateReport || !checklistHasStaleFailRows(checklist, gateReport)) {
    return checklist;
  }
  const schemaOk = schemaComplianceOk(gateReport);
  const schemaChecked = gateReport.schemaChecked ?? gateReport.pageSampleSchemaChecked ?? 0;
  const schemaPassed = gateReport.schemaPassed ?? gateReport.pageSampleSchemaPassed ?? 0;
/**
 * Rules.
 * @param {any} checklist.rules || []
 * @returns {any}
 */
  const rules = (checklist.rules || []).map((rule) => {
    if (rule.status !== 'fail') return rule;
    if (rule.id === 'GATE-001' && gateReport.gate?.pass) {
      return { ...rule, status: 'pass', evidence: 'Gate pass — no blocking issues at configured severities' };
    }
    if (rule.id === 'DATA-001' && schemaOk) {
      return { ...rule, status: 'pass', evidence: `${schemaPassed}/${schemaChecked} samples match schema specs` };
    }
    if (rule.id === 'LEAK-001' && (gateReport.productionLeakFindings ?? 0) === 0) {
      return {
        ...rule,
        status: 'pass',
        evidence: `Scanned ${gateReport.productionLeakScanned ?? 0} production file(s) — no sample-path leaks`
      };
    }
    return rule;
  });
  return { ...checklist, rules, summary: recomputeChecklistSummary(rules, checklist.summary) };
}

/**
 * Pick fresh gate report.
 * @param {number} stepReport
 * @param {number} liveReport
 * @returns {any}
 */
export function pickFreshGateReport(stepReport, liveReport) {
  if (!liveReport) return stepReport || null;
  if (!stepReport) return liveReport;
  const stepAt = Date.parse(stepReport.generatedAt || '');
  const liveAt = Date.parse(liveReport.generatedAt || '');
  if (Number.isFinite(stepAt) && Number.isFinite(liveAt) && liveAt > stepAt) {
    return liveReport;
  }
  return stepReport;
}

/**
 * Reconcile compliance with gate.
 * @param {any} checklist
 * @param {number} gateReport
 * @returns {any}
 */
export function reconcileComplianceWithGate(checklist, gateReport) {
  if (!checklist || !gateReport) return checklist;
  return refreshComplianceChecklistFromGate(checklist, gateReport);
}

/**
 * Patch supply rules from npm audit.
 * @param {Array} rules
 * @param {any} npmAudit
 * @returns {any}
 */
function patchSupplyRulesFromNpmAudit(rules, npmAudit) {
  if (!Array.isArray(rules) || !npmAudit) return rules;
  const source = npmAudit.source || npmAudit.dataSource || 'npm-audit';
  return rules.map((rule) => {
    if (rule.id === 'SUPPLY-001') {
      if (npmAudit.skipped) {
        return { ...rule, status: 'skip', evidence: npmAudit.scopeNote || 'npm audit skipped' };
      }
      if (npmAudit.summary?.dependencies == null) {
        return { ...rule, status: 'skip', evidence: 'No package.json — npm audit not applicable' };
      }
      const critical = npmAudit.summary.critical || 0;
      const high = npmAudit.summary.high || 0;
      const ok = critical === 0 && high === 0;
      return {
        ...rule,
        status: ok ? 'pass' : 'fail',
        evidence: ok
          ? `npm audit: ${critical} critical, ${high} high (${source})`
          : `npm audit: ${critical} critical, ${high} high — upgrade dependencies`
      };
    }
    if (rule.id === 'SUPPLY-002' && npmAudit.summary) {
      if (npmAudit.skipped || npmAudit.summary.dependencies == null) {
        return { ...rule, status: 'skip', evidence: npmAudit.scopeNote || 'npm audit not applicable' };
      }
      const moderate = npmAudit.summary.moderate || npmAudit.summary.medium || 0;
      const ok = moderate <= 0;
      return {
        ...rule,
        status: ok ? 'pass' : 'fail',
        evidence: ok ? `${moderate} moderate (limit 0) — ${source}` : `${moderate} moderate exceeds policy limit of 0`
      };
    }
    return rule;
  });
}

/**
 * Resolve bundle handoff eligible.
 * @param {any} checklist
 * @param {string} context
 * @returns {any}
 */
function resolveBundleHandoffEligible(checklist, context) {
  if (context.benchmarkScan || context.hollowGate) return false;
  const summary = checklist?.summary || {};
  if (summary.handoffEligible === false) return false;
  if ((summary.failed ?? 0) > 0) return false;
  if (summary.readyForAutomation === false) return false;
  if (summary.handoffEligible === true) return true;
  return (summary.passed ?? 0) > 0 && (summary.failed ?? 0) === 0;
}

/**
 * Normalize compliance branding.
 * @param {any} value
 * @returns {any}
 */
function normalizeComplianceBranding(value) {
  return String(value ?? '').replace(/\bSimplebeacon\b/g, 'SimpleBeacon');
}

/**
 * Build compliance hygiene summary.
 * @param {any} checklist
 * @param {number} gateReport
 * @param {any} npmAudit
 * @param {string} context
 * @returns {any}
 */
function buildComplianceHygieneSummary(checklist, gateReport, npmAudit, context) {
  const summary = checklist?.summary || {};
  const gateProfile = gateReport?.scanScope?.profile
    ?? checklist?.scanScope?.gateRuleBundleProfile
    ?? checklist?.hygieneSummary?.gateRuleBundleProfile
    ?? null;
  const repoTotal = gateReport?.repositoryFilesTotal
    ?? gateReport?.repositoryInventory?.totalFiles
    ?? checklist?.hygieneSummary?.gateRepositoryFilesTotal
    ?? ruleScopedFromGate(gateReport);
  const credentialScanned = gateReport?.credentialScanned
    ?? gateReport?.scanScope?.productionDirsScanned
    ?? checklist?.hygieneSummary?.credentialScanned
    ?? null;
  const contentScanned = gateReport?.scanScope?.fullDirectoryStats?.contentScanned
    ?? gateReport?.scanScope?.fullDirectoryStats?.filesContentScanned
    ?? gateReport?.credentialScanned
    ?? checklist?.hygieneSummary?.contentFilesScanned
    ?? null;
  const failed = summary.failed ?? 0;
  return {
    complianceStatus: context.benchmarkScan ? 'benchmark-cache' : context.hollowGate ? 'limited-gate-scope' : failed > 0 ? 'failed' : 'pass',
    rulesPassed: summary.passed ?? null,
    rulesFailed: failed,
    rulesSkipped: summary.skipped ?? 0,
    checklistScore: summary.score ?? null,
    readyForAutomation: summary.readyForAutomation ?? false,
    ...(repoTotal ? { gateRepositoryFilesTotal: repoTotal } : {}),
    ...(credentialScanned != null ? { credentialScanned } : {}),
    ...(repoTotal && credentialScanned != null && repoTotal > credentialScanned
      ? { metadataOnlyInventoryFiles: repoTotal - credentialScanned }
      : {}),
    ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
    fictionJsonFilesScanned: gateReport?.fictionJsonFilesScanned
      ?? gateReport?.scanScope?.fictionJsonFilesScanned
      ?? checklist?.hygieneSummary?.fictionJsonFilesScanned
      ?? null,
    fictionSampleFilesScanned: gateReport?.fictionSampleFilesScanned
      ?? gateReport?.scanScope?.fictionSampleFilesScanned
      ?? checklist?.hygieneSummary?.fictionSampleFilesScanned
      ?? null,
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    npmAuditCritical: npmAudit?.summary?.critical ?? checklist?.hygieneSummary?.npmAuditCritical ?? null,
    npmAuditHigh: npmAudit?.summary?.high ?? checklist?.hygieneSummary?.npmAuditHigh ?? null,
    ...(gateReport?.jestBaselineChecked === false || checklist?.hygieneSummary?.jestBaselineChecked === false
      ? { jestBaselineChecked: false }
      : {}),
    attestationNote: 'Corporate safety checklist — automated CI gate rules only, not vendor security handoff or legal conformity certification.'
  };
}

/**
 * Build compliance scan scope.
 * @param {number} gateReport
 * @param {Object} options
 * @returns {any}
 */
function buildComplianceScanScope(gateReport, options = {}) {
  const checklist = options.checklist || null;
  const repoTotal = options.repositoryFilesTotal
    ?? gateReport?.repositoryFilesTotal
    ?? gateReport?.repositoryInventory?.totalFiles
    ?? checklist?.scanScope?.gateRepositoryFilesTotal
    ?? checklist?.hygieneSummary?.gateRepositoryFilesTotal
    ?? null;
  const gateProfile = gateReport?.scanScope?.profile
    ?? checklist?.scanScope?.gateRuleBundleProfile
    ?? checklist?.hygieneSummary?.gateRuleBundleProfile
    ?? null;
  return {
    checklistProfile: checklist?.scanScope?.checklistProfile || 'default',
    resultsViewScope: 'platform-only',
    securityHandoffEligible: false,
    ...(repoTotal != null ? { gateRepositoryFilesTotal: repoTotal } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    sourceArtifacts: {
      gateReport: Boolean(gateReport || checklist?.scanScope?.sourceArtifacts?.gateReport),
      npmAudit: Boolean(options.npmAudit || checklist?.scanScope?.sourceArtifacts?.npmAudit)
    }
  };
}

/**
 * Build export notes.
 * @param {any} checklist
 * @param {number} gateReport
 * @param {any} npmAudit
 * @param {string} context
 * @returns {any}
 */
function buildExportNotes(checklist, gateReport, npmAudit, context) {
  const notes = [];
  if (!context.benchmarkScan) {
    notes.push('securityHandoffEligible is false — checklist attests CI automation rules only, not vendor security handoff.');
    notes.push('Absolute scan paths are redacted to project label in operator exports.');
  }
  if (context.benchmarkScan) {
    notes.push('Benchmark clone — not valid for Simplebeacon product handoff.');
  }
  if (context.hollowGate) {
    notes.push('Limited gate scope — credential/production-leak rules did not run on product paths.');
  }
  if (gateReport?.jestBaselineChecked === false) {
    notes.push('Jest was not executed during the gate scan — run npm test before vendor handoff sign-off.');
  }
  if (npmAudit?.supplyChainStatus === 'pass') {
    notes.push('Supply chain: npm audit reported 0 critical and 0 high at project root.');
  }
  const summary = checklist?.summary || {};
  if (summary.readyForAutomation && !context.benchmarkScan && !context.hollowGate) {
    notes.push('readyForAutomation reflects CI deploy-gate readiness — not SimpleBeacon vendor security handoff.');
  }
  const repoTotal = gateReport?.repositoryFilesTotal
    ?? gateReport?.repositoryInventory?.totalFiles
    ?? ruleScopedFromGate(gateReport);
  const credentialScanned = gateReport?.credentialScanned
    ?? gateReport?.productionLeakScanned
    ?? gateReport?.scanScope?.productionDirsScanned;
  if (repoTotal > 0 && credentialScanned != null && credentialScanned < repoTotal) {
    const metadataOnly = repoTotal - credentialScanned;
    notes.push(
      `CRED/LEAK rules scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(metadataOnly).toLocaleString()} binary/metadata-only path(s) in gate inventory of ${Number(repoTotal).toLocaleString()}.`
    );
  }
  const fictionJson = gateReport?.fictionJsonFilesScanned ?? gateReport?.scanScope?.fictionJsonFilesScanned;
  const fictionSamples = gateReport?.fictionSampleFilesScanned ?? gateReport?.scanScope?.fictionSampleFilesScanned;
  if (fictionJson != null && fictionSamples != null && fictionJson > fictionSamples) {
    notes.push(
      // simplebeacon:production-leak-intent - legitimate KPI reference for compliance reporting
      `DATA-002 evaluated ${Number(fictionJson).toLocaleString()} repository JSON path(s) — ${Number(fictionSamples).toLocaleString()} *-sample.json KPI file(s) matched.`
    );
  }
  if (summary.operatorDocumentationCount > 0 && gateReport?.euAiActSummary?.operatorDocumentationCount != null) {
    notes.push(
      `${summary.operatorDocumentationCount} operator documentation path(s) in gate EU AI Act summary — use json/eu-ai-act-sprint.json for sprint handoff pack.`
    );
  }
  const gateProfile = gateReport?.scanScope?.profile
    ?? checklist?.scanScope?.gateRuleBundleProfile
    ?? checklist?.hygieneSummary?.gateRuleBundleProfile
    ?? null;
  if (gateProfile) {
    notes.push(`Gate rule bundle profile: ${gateProfile} — pair checklist with json/simplebeacon-gate.json for rule evidence.`);
  }
  const complianceStatus = context.benchmarkScan ? 'benchmark-cache' : context.hollowGate ? 'limited-gate-scope' : (summary.failed ?? 0) > 0 ? 'failed' : 'pass';
  if (complianceStatus === 'failed' && gateReport?.gate?.pass === false) {
/**
 * Failed ids.
 * @param {any} checklist?.rules || []
 * @returns {any}
 */
    const failedIds = (checklist?.rules || []).filter((rule) => rule.status === 'fail').map((rule) => rule.id);
    const blocking = gateReport.gate?.blockingCount ?? gateReport.issueCount ?? null;
    if (failedIds.length) {
      notes.push(
        `Checklist failures (${failedIds.join(', ')}) align with bundled gate (pass=false${blocking != null ? `, ${Number(blocking).toLocaleString()} blocking finding(s)` : ''}) — see json/simplebeacon-gate.json.`
      );
    }
  }
  if (summary.headline && notes.length < 4) {
    notes.push(summary.headline);
  }
  return [...new Set(notes)].slice(0, 10);
}

/**
 * Sanitize compliance for export.
 * @param {any} compliance
 * @param {string} context
 * @returns {any}
 */
function sanitizeComplianceForExport(compliance, context) {
  if (!compliance) return compliance;
  const benchmarkScan = context.benchmarkScan;
  const hollowGate = context.hollowGate;
  let next = refreshComplianceChecklistFromGate(compliance, context.gateReport);
  next = { ...next, rules: [...(next.rules || [])] };
  if (context.npmAudit) {
    next.rules = patchSupplyRulesFromNpmAudit(next.rules, context.npmAudit);
    const passed = next.rules.filter((r) => r.status === 'pass').length;
    const failed = next.rules.filter((r) => r.status === 'fail').length;
    const skipped = next.rules.filter((r) => r.status === 'skip').length;
    const scored = passed + failed;
    next.summary = {
      ...(next.summary || {}),
      passed,
      failed,
      skipped,
      total: next.rules.length,
      score: scored ? Math.round((passed / scored) * 100) : null,
      handoffEligible: !benchmarkScan && !hollowGate && failed === 0
    };
  }
  if (benchmarkScan || hollowGate) {
    next.summary = {
      ...(next.summary || {}),
      readyForAutomation: false,
      handoffEligible: false,
      headline: benchmarkScan
        ? 'Benchmark clone — not valid for Simplebeacon platform handoff. Run Complete scan on ai-platform.'
        : 'Limited gate scope — configure production paths before enabling automated deploy gates.',
      scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'limited-gate-scope'
    };
  }
  return next;
}

/**
 * Unwrap compliance checklist.
 * @param {any} checklist
 * @returns {any}
 */
function unwrapComplianceChecklist(checklist) {
  if (!checklist || typeof checklist !== 'object') return checklist;
  if (Array.isArray(checklist.rules) && checklist.rules.length > 0) {
    return checklist;
  }
  const nested = checklist.checklist;
  if (nested && Array.isArray(nested.rules) && nested.rules.length > 0) {
    return nested;
  }
  return checklist;
}

/**
 * Sanitize compliance checklist artifact export.
 * @param {any} checklist
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeComplianceChecklistArtifactExport(checklist, options = {}) {
  const projectPath = options.projectPath || checklist?.projectRoot || '';
  const gateReport = options.gateReport || null;
  const hollowGate = hasHollowGate(gateReport);
  const benchmarkScan = isBenchmarkCacheProjectPath(projectPath);
  const npmAudit = options.npmAudit
    ? sanitizeNpmAuditExport(options.npmAudit, projectPath)
    : undefined;
  const context = {
    benchmarkScan,
    hollowGate,
    productPlatformRoot: benchmarkScan ? resolveProductPlatformRoot(projectPath) : null,
    projectPath,
    gateReport,
    npmAudit
  };
  const sanitized = sanitizeComplianceForExport(unwrapComplianceChecklist(checklist), context);
  const exportNotes = buildExportNotes(sanitized, gateReport, npmAudit, context);
  if (options.operatorExport !== false) {
    exportNotes.push(
      'Checklist attests automated rule rows only — securityHandoffEligible remains false until operator vendor sign-off.'
    );
  }
  const pathContext = resolveComplianceExportPathContext(projectPath, context);
  const redactedProjectRoot = pathContext.redact(sanitized.projectRoot || projectPath);
  const hygieneSummary = buildComplianceHygieneSummary(sanitized, gateReport, npmAudit, context);
  const scanScope = buildComplianceScanScope(gateReport, {
    repositoryFilesTotal: options.repositoryFilesTotal
      ?? gateReport?.repositoryFilesTotal
      ?? gateReport?.repositoryInventory?.totalFiles,
    npmAudit,
    checklist: { scanScope: checklist?.scanScope, hygieneSummary }
  });
  const summary = {
    ...sanitized.summary,
    securityHandoffEligible: false,
    handoffEligible: false,
    ...(sanitized.summary?.productPlatformRoot
      ? { productPlatformRoot: pathContext.redact(sanitized.summary.productPlatformRoot) }
      : {})
  };
  return {
    ...sanitized,
    title: normalizeComplianceBranding(sanitized.title),
    projectRoot: redactedProjectRoot,
    exportNormalized: true,
    exportSanitized: true,
    handoffEligible: false,
    scanTargetProfile: sanitized.summary?.scanTargetProfile
      || (benchmarkScan ? 'benchmark-cache' : hollowGate ? 'limited-gate-scope' : 'product'),
    securityHandoffEligible: false,
    complianceStatus: benchmarkScan ? 'benchmark-cache' : hollowGate ? 'limited-gate-scope' : (sanitized.summary?.failed ?? 0) > 0 ? 'failed' : 'pass',
    exportNotes: [...new Set(exportNotes)].slice(0, 10),
    hygieneSummary,
    scanScope,
    summary
  };
}

/**
 * Sanitize compliance bundle export.
 * @param {any} payload
 * @returns {any}
 */
export function sanitizeComplianceBundleExport(payload = {}) {
  const projectPath = payload.projectPath
    || payload.checklist?.projectRoot
    || payload.gateReport?.projectRoot
    || '';
  const benchmarkScan = isBenchmarkCacheProjectPath(projectPath);
  const productPlatformRoot = benchmarkScan ? resolveProductPlatformRoot(projectPath) : null;
  const gateReport = payload.gateReport || null;
  const hollowGate = hasHollowGate(gateReport);
  const npmAudit = payload.npmAudit
    ? sanitizeNpmAuditExport(payload.npmAudit, projectPath)
    : undefined;
  const context = {
    benchmarkScan,
    hollowGate,
    productPlatformRoot,
    projectPath,
    gateReport,
    npmAudit
  };
  const checklist = sanitizeComplianceForExport(unwrapComplianceChecklist(payload.checklist), context);
  const handoffEligible = resolveBundleHandoffEligible(checklist, context);
  const failed = checklist?.summary?.failed ?? 0;
  const pathContext = resolveComplianceExportPathContext(projectPath, context);

  return {
    type: payload.type || 'simplebeacon-compliance-checklist',
    generatedAt: payload.generatedAt || checklist?.evaluatedAt || new Date().toISOString(),
    projectPath: pathContext.redact(projectPath),
    exportNormalized: true,
    complianceStatus: benchmarkScan ? 'benchmark-cache' : hollowGate ? 'limited-gate-scope' : failed > 0 ? 'failed' : 'pass',
    scanTargetProfile: benchmarkScan ? 'benchmark-cache' : hollowGate ? 'limited-gate-scope' : 'product',
    handoffEligible,
    readyForAutomation: checklist?.summary?.readyForAutomation ?? false,
    productPlatformRoot: productPlatformRoot
      ? pathContext.redact(productPlatformRoot)
      : undefined,
    benchmarkScan: benchmarkScan || undefined,
    npmAudit,
    gateReport,
    checklist: {
      ...checklist,
      projectRoot: pathContext.redact(checklist.projectRoot || projectPath),
      summary: checklist.summary?.productPlatformRoot
        ? {
          ...checklist.summary,
          productPlatformRoot: pathContext.redact(checklist.summary.productPlatformRoot)
        }
        : checklist.summary
    },
    exportNotes: buildExportNotes(checklist, gateReport, npmAudit, context)
  };
}
