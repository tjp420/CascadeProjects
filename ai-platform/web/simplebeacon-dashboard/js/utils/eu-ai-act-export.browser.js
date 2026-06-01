/**
 * EU AI Act compliance page export bundle — browser mirror of server/lib/eu-ai-act-export.js
 */

import { sanitizeSimplebeaconReportExport } from './simplebeacon-report-export.browser.js?v=20260601gateexport17';
import { sanitizeComplianceChecklistArtifactExport } from './compliance-export.browser.js?v=20260601complianceexport6';
import { redactProjectPathForExport, normalizeSimpleBeaconBranding } from './quality-export.browser.js?v=20260531qualityexport8';

function projectLabelFromPath(projectPath) {
  const normalized = String(projectPath || 'ai-platform').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'ai-platform';
}

function parseTimestamp(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : null;
}

function resolveProjectLabel(bundle = {}) {
  return projectLabelFromPath(
    bundle.compliance?.projectRoot
    || bundle.assessment?.projectRoot
    || bundle.sprintReport?.projectRoot
    || bundle.embeddedInMainReport?.projectRoot
  );
}

export function resolveGateResult(bundle = {}) {
  const embedded = bundle.embeddedInMainReport;
  const assessment = bundle.assessment;
  const embeddedAt = parseTimestamp(embedded?.generatedAt);
  const sprintAt = parseTimestamp(
    assessment?.generatedAt
    || bundle.compliance?.evaluatedAt
    || bundle.sprintReport?.generatedAt
  );

  if (embedded?.gatePass != null && (embeddedAt == null || sprintAt == null || embeddedAt >= sprintAt)) {
    return embedded.gatePass === true ? 'PASS' : 'FAIL';
  }

  return assessment?.executiveSummary?.gateResult
    ?? (embedded?.gatePass === true ? 'PASS' : embedded?.gatePass === false ? 'FAIL' : null);
}

function buildFreshnessNote(bundle = {}) {
  const embeddedAt = parseTimestamp(bundle.embeddedInMainReport?.generatedAt);
  const sprintAt = parseTimestamp(
    bundle.compliance?.evaluatedAt
    || bundle.assessment?.generatedAt
    || bundle.sprintReport?.generatedAt
  );
  if (embeddedAt == null || sprintAt == null || embeddedAt <= sprintAt) return null;
  return `Latest gate scan (${bundle.embeddedInMainReport.generatedAt}) is newer than EU sprint artifacts (${bundle.compliance?.evaluatedAt || bundle.assessment?.generatedAt}). Summary gate result uses the latest scan.`;
}

function resolveSprintTimestamp(bundle = {}) {
  return parseTimestamp(
    bundle.compliance?.evaluatedAt
    || bundle.assessment?.generatedAt
    || bundle.sprintReport?.generatedAt
  );
}

function isLiveGatePreferred(bundle = {}) {
  const embedded = bundle.embeddedInMainReport;
  const embeddedAt = parseTimestamp(embedded?.generatedAt);
  const sprintAt = resolveSprintTimestamp(bundle);
  return embedded?.gatePass != null && embeddedAt != null && sprintAt != null && embeddedAt > sprintAt;
}

const SCAN_CHECKLIST_RULE_IDS = ['GATE-001', 'CRED-001', 'LEAK-001'];

function shouldReconcileScanRulesFromEmbedded(bundle = {}) {
  if (!bundle.embeddedInMainReport || !bundle.compliance?.rules?.length) return false;
  if (isLiveGatePreferred(bundle)) return true;
  const embedded = bundle.embeddedInMainReport;
  if (embedded.gatePass !== true) return false;
  const hasStaleFail = bundle.compliance.rules.some(
    (rule) => SCAN_CHECKLIST_RULE_IDS.includes(rule.id) && rule.status === 'fail'
  );
  if (!hasStaleFail) return false;
  const cred = embedded.credentialFindings;
  const leak = embedded.productionLeakFindings;
  if (cred === 0 && leak === 0) return true;
  return cred == null && leak == null;
}

function reconcileScanChecklistRule(rule, embedded = {}) {
  if (!SCAN_CHECKLIST_RULE_IDS.includes(rule.id)) return rule;
  const gatePass = embedded.gatePass === true;
  const cred = embedded.credentialFindings ?? null;
  const leak = embedded.productionLeakFindings ?? null;
  const credScanned = embedded.credentialScanned ?? null;
  const leakScanned = embedded.productionLeakScanned ?? null;

  if (rule.id === 'GATE-001') {
    return {
      ...rule,
      status: gatePass ? 'pass' : 'fail',
      evidence: gatePass
        ? 'Gate pass — no blocking issues at configured severities (live report.json scan)'
        : rule.evidence
    };
  }
  if (rule.id === 'CRED-001' && cred === 0 && (credScanned ?? 0) > 0) {
    return {
      ...rule,
      status: 'pass',
      evidence: `Scanned ${credScanned} gate-scoped path(s) — no credential patterns (live report.json)`
    };
  }
  if (rule.id === 'LEAK-001' && leak === 0 && (leakScanned ?? 0) > 0) {
    return {
      ...rule,
      status: 'pass',
      evidence: `Scanned ${leakScanned} gate-scoped production file(s) — no sample-path leaks (live report.json)`
    };
  }
  return rule;
}

function dedupeFindingSummary(text) {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  const colonIdx = raw.indexOf(': ');
  if (colonIdx <= 0) return raw;
  const prefix = raw.slice(0, colonIdx).trim();
  const remainder = raw.slice(colonIdx + 2).trim();
  if (remainder.startsWith(`${prefix}:`)) {
    return remainder;
  }
  return raw;
}

function splitDocumentationPaths(docs = []) {
  const all = Array.isArray(docs) ? docs : [];
  const simplebeaconArtifactPaths = all.filter((doc) => String(doc).startsWith('.simplebeacon/'));
  const operatorDocumentationFound = all.filter((doc) => {
    const rel = String(doc).replace(/\\/g, '/');
    return rel.startsWith('docs/');
  });
  const scanMatchedNonDocsPaths = all.filter((doc) => {
    const rel = String(doc).replace(/\\/g, '/');
    return !rel.startsWith('.simplebeacon/') && !rel.startsWith('docs/');
  });
  return {
    documentationFound: all,
    operatorDocumentationFound,
    simplebeaconArtifactPaths,
    operatorDocumentationCount: operatorDocumentationFound.length,
    simplebeaconArtifactCount: simplebeaconArtifactPaths.length,
    documentationArtifacts: operatorDocumentationFound.length,
    ...(scanMatchedNonDocsPaths.length
      ? {
        scanMatchedNonDocsPaths,
        scanMatchedNonDocsCount: scanMatchedNonDocsPaths.length
      }
      : {})
  };
}

function buildChecklistHeadline(passed, failed, total) {
  if (failed === 0 && passed > 0) {
    return `${passed}/${total} EU AI Act readiness rules pass`;
  }
  if (failed > 0) {
    return `${failed} EU AI Act rule(s) fail — address before August 2026 deadline`;
  }
  return null;
}

function reconcileComplianceForLiveGate(compliance, bundle = {}) {
  if (!compliance?.rules?.length) return compliance;
  const freshMetrics = resolveFreshEuAiActMetrics(bundle);
  let rules = compliance.rules.map((rule) => {
    if (rule.id === 'EUAI-002' && freshMetrics.aiSystemIndicators != null) {
      return {
        ...rule,
        evidence: `${freshMetrics.aiSystemIndicators} AI integration(s) with Article 50 disclosure markers present`
      };
    }
    if (rule.id === 'EUAI-003'
      && freshMetrics.operatorDocumentationCount != null
      && freshMetrics.aiSystemIndicators != null) {
      const operatorDocs = freshMetrics.operatorDocumentationCount;
      return {
        ...rule,
        evidence: `${operatorDocs} operator doc(s) under docs/ — required: ai-system-documentation.md and eu-ai-act-compliance.md`
      };
    }
    return rule;
  });

  if (!shouldReconcileScanRulesFromEmbedded(bundle)) {
    return {
      ...compliance,
      title: normalizeSimpleBeaconBranding(compliance.title),
      rules
    };
  }

  const embedded = bundle.embeddedInMainReport;
  rules = rules.map((rule) => reconcileScanChecklistRule(rule, embedded));
  const passed = rules.filter((rule) => rule.status === 'pass').length;
  const failed = rules.filter((rule) => rule.status === 'fail').length;
  const skipped = rules.filter((rule) => rule.status === 'skip').length;
  const scored = passed + failed;
  const score = scored ? Math.round((passed / scored) * 100) : compliance.summary?.score ?? null;
  return {
    ...compliance,
    title: normalizeSimpleBeaconBranding(compliance.title),
    rules,
    summary: {
      ...compliance.summary,
      passed,
      failed,
      skipped,
      total: rules.length,
      score,
      headline: buildChecklistHeadline(passed, failed, rules.length)
        ?? compliance.summary?.headline,
      readyForAutomation: failed === 0 && passed > 0,
      handoffEligible: false
    },
    gateReconciledFrom: 'live-gate-scan',
    gateReconciledAt: embedded.generatedAt ?? null
  };
}

function dedupeAssessmentFindings(assessment) {
  if (!assessment?.findings?.fictionKpis?.summary) return assessment;
  return {
    ...assessment,
    findings: {
      ...assessment.findings,
      fictionKpis: {
        ...assessment.findings.fictionKpis,
        summary: dedupeFindingSummary(assessment.findings.fictionKpis.summary)
      }
    }
  };
}

function resolveSprintGateResult(bundle = {}, assessment = {}) {
  if (assessment?.executiveSummary?.sprintGateResult) {
    return assessment.executiveSummary.sprintGateResult;
  }
  if (bundle.sprintReport?.gate?.pass === false) return 'FAIL';
  if (bundle.sprintReport?.gate?.pass === true) return 'PASS';
  if (assessment?.executiveSummary?.gateResultSource !== 'live-gate-scan') {
    return assessment?.executiveSummary?.gateResult ?? null;
  }
  return null;
}

function buildLiveGateExecutiveHeadline(gatePass) {
  return gatePass
    ? 'Gate pass — no blocking issues at configured severities (live report.json scan).'
    : null;
}

function reconcileExecutiveSummaryForLiveGate(executiveSummary, bundle = {}) {
  if (!executiveSummary || !isLiveGatePreferred(bundle)) return executiveSummary;
  const gateResult = resolveGateResult(bundle);
  const gatePass = gateResult === 'PASS';
  const sprintGateResult = resolveSprintGateResult(bundle, { executiveSummary });
  const sprintBlocking = executiveSummary.blockingCount ?? 0;
  const next = {
    ...executiveSummary,
    gateResult,
    sprintGateResult,
    gateResultSource: 'live-gate-scan'
  };

  if (gatePass) {
    next.blockingCount = 0;
    next.warningCount = 0;
    next.criticalIssues = 0;
    next.highIssues = 0;
    next.mediumIssues = 0;
    next.lowIssues = 0;
    next.headline = buildLiveGateExecutiveHeadline(true);
    next.complianceReady = gatePass ? true : executiveSummary.complianceReady;
    if (sprintBlocking > 0) {
      next.executiveSummaryNote = `Sprint executiveSummary cached ${sprintBlocking} blocking issue(s) — live gate scan shows PASS.`;
    }
  }

  return next;
}

function reconcileAssessmentForLiveGate(assessment, bundle = {}) {
  if (!assessment) return assessment;
  let next = dedupeAssessmentFindings(assessment);
  next = {
    ...next,
    title: normalizeSimpleBeaconBranding(next.title),
    generatedBy: normalizeSimpleBeaconBranding(next.generatedBy)
  };

  const freshMetrics = resolveFreshEuAiActMetrics(bundle);
  if (freshMetrics.metricsSource === 'live-gate-scan' && next.euAiActSummary) {
    next = {
      ...next,
      euAiActSummary: {
        ...next.euAiActSummary,
        ...(next.euAiActSummary.documentationFound?.length
          ? splitDocumentationPaths(next.euAiActSummary.documentationFound)
          : {})
      }
    };
  }

  if (!isLiveGatePreferred(bundle)) return next;

  return {
    ...next,
    executiveSummary: reconcileExecutiveSummaryForLiveGate(next.executiveSummary, bundle)
  };
}

function applyExportReconciliation(bundle = {}) {
  return {
    ...bundle,
    compliance: bundle.compliance
      ? reconcileComplianceForLiveGate(
        { ...bundle.compliance, title: normalizeSimpleBeaconBranding(bundle.compliance.title) },
        bundle
      )
      : null,
    assessment: reconcileAssessmentForLiveGate(bundle.assessment, bundle),
    sprintReport: bundle.sprintReport
      ? {
        ...bundle.sprintReport,
        title: normalizeSimpleBeaconBranding(bundle.sprintReport.title),
        generatedBy: normalizeSimpleBeaconBranding(bundle.sprintReport.generatedBy)
      }
      : null
  };
}

function resolveFreshEuAiActMetrics(bundle = {}) {
  const assessment = bundle.assessment;
  const embedded = bundle.embeddedInMainReport;
  const embeddedAt = parseTimestamp(embedded?.generatedAt);
  const sprintAt = resolveSprintTimestamp(bundle);
  const sprintEu = assessment?.euAiActSummary || {};
  const embeddedEu = embedded?.summary || {};
  const embeddedNewer = embeddedAt != null && sprintAt != null && embeddedAt > sprintAt;
  const preferEmbedded = embeddedNewer && (
    embeddedEu.aiSystemIndicators != null || embeddedEu.documentationArtifacts != null
  );
  const source = preferEmbedded ? embeddedEu : sprintEu;
  const docs = source.documentationFound || sprintEu.documentationFound || embeddedEu.documentationFound || [];
  const operatorCount = source.operatorDocumentationCount
    ?? docs.filter((doc) => !String(doc).startsWith('.simplebeacon/')).length;
  const metricsStaleNote = preferEmbedded && (
    (sprintEu.aiSystemIndicators != null && embeddedEu.aiSystemIndicators != null
      && sprintEu.aiSystemIndicators !== embeddedEu.aiSystemIndicators)
    || (sprintEu.operatorDocumentationCount != null && embeddedEu.operatorDocumentationCount != null
      && sprintEu.operatorDocumentationCount !== embeddedEu.operatorDocumentationCount)
  )
    ? `EU indicator counts use live gate scan (${embedded.generatedAt}) — sprint cached ${sprintEu.aiSystemIndicators ?? '?'} AI integrations and ${sprintEu.operatorDocumentationCount ?? sprintEu.documentationArtifacts ?? '?'} operator docs at ${bundle.compliance?.evaluatedAt || assessment?.generatedAt}.`
    : null;

  return {
    aiSystemIndicators: source.aiSystemIndicators ?? null,
    highRiskIndicators: source.highRiskIndicators ?? null,
    transparencyGaps: source.transparencyGaps ?? null,
    documentationArtifacts: operatorCount,
    operatorDocumentationCount: operatorCount,
    euAiActScanned: preferEmbedded
      ? (embedded.euAiActScanned ?? null)
      : (assessment?.findings?.euAiAct?.scanned ?? bundle.sprintReport?.euAiActScanned ?? null),
    metricsSource: preferEmbedded ? 'live-gate-scan' : 'eu-ai-act-sprint',
    metricsStaleNote,
    simplebeaconDocumentationArtifacts: docs.filter((doc) => String(doc).startsWith('.simplebeacon/')).length || null,
    operatorDocumentationCount: operatorCount
  };
}

function buildFilesScannedNote(assessment) {
  const filesScanned = assessment?.executiveSummary?.filesScanned;
  if (filesScanned == null || filesScanned > 20) return null;
  return `Assessment filesScanned (${filesScanned}) reflects configured mock/sample JSON paths — not whole-repository coverage.`;
}

function dedupeExportNotes(notes = []) {
  const seen = new Set();
  const out = [];
  for (const note of notes.filter(Boolean)) {
    const text = String(note);
    const key = /latest gate scan.*newer than eu sprint/i.test(text)
      ? 'freshness-note'
      : /eu indicator counts use live gate scan/i.test(text)
        ? 'metrics-stale-note'
        : /filesScanned \(3\)/i.test(text)
          ? 'files-scanned-note'
          : /sprint artifacts still record gate fail/i.test(text)
            ? 'gate-mismatch-note'
            : /GATE-001 checklist rule reconciled|GATE-001, CRED-001, and LEAK-001 reconciled/i.test(text)
              ? 'gate-checklist-reconciled'
              : /documentation path\(s\) under \.simplebeacon\//i.test(text)
                ? 'simplebeacon-docs-note'
                : /sprint executiveSummary cached/i.test(text)
                  ? 'exec-summary-stale'
                  : text.replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text.trim());
  }
  return out.slice(0, 8);
}

function relativizeScanPathsForExport(scanPaths, projectRoot, projectLabel) {
  const root = String(projectRoot || '').replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
  return (scanPaths || []).map((entry) => {
    let rel = String(entry).replace(/\\/g, '/');
    if (root && rel.toLowerCase().startsWith(root)) {
      rel = rel.slice(root.length).replace(/^\//, '');
    }
    if (!rel || rel === projectLabel) return rel || entry;
    return rel;
  });
}

function sanitizeComplianceExport(compliance, projectLabel) {
  if (!compliance) return null;
  return {
    ...compliance,
    projectRoot: redactProjectPathForExport(compliance.projectRoot, projectLabel),
    provenance: compliance.gateReconciledFrom === 'live-gate-scan'
      ? 'live-gate-scan-reconciled'
      : 'eu-ai-act-sprint-artifact'
  };
}

function sanitizeAssessmentExport(assessment, projectLabel) {
  if (!assessment) return null;
  const { complianceChecklist: _complianceChecklist, sourceReport, euAiActSummary, executiveSummary, ...rest } = assessment;
  const docSplit = splitDocumentationPaths(euAiActSummary?.documentationFound || []);
  const { executiveSummaryNote: _executiveSummaryNote, ...executiveRest } = executiveSummary || {};
  return {
    ...rest,
    ...(executiveSummary
      ? { executiveSummary: executiveRest }
      : {}),
    projectRoot: redactProjectPathForExport(assessment.projectRoot, projectLabel),
    provenance: assessment.executiveSummary?.gateResultSource === 'live-gate-scan'
      ? 'live-gate-scan-reconciled'
      : 'eu-ai-act-sprint-artifact',
    ...(euAiActSummary
      ? {
        euAiActSummary: {
          ...euAiActSummary,
          ...docSplit
        }
      }
      : {}),
    ...(sourceReport
      ? {
        sourceReport: {
          generatedAt: sourceReport.generatedAt ?? null,
          scanPaths: relativizeScanPathsForExport(
            sourceReport.scanPaths,
            assessment.projectRoot,
            projectLabel
          ),
          duplicateGroups: sourceReport.duplicateGroups ?? null
        }
      }
      : {})
  };
}

function sanitizeEmbeddedMainReportExport(embedded, projectLabel) {
  if (!embedded) return null;
  const docSplit = splitDocumentationPaths(embedded.summary?.documentationFound || []);
  return {
    generatedAt: embedded.generatedAt ?? null,
    projectRoot: redactProjectPathForExport(embedded.projectRoot, projectLabel),
    euAiActScanned: embedded.euAiActScanned ?? null,
    euAiActFindings: embedded.euAiActFindings ?? null,
    gatePass: embedded.gatePass ?? null,
    credentialFindings: embedded.credentialFindings ?? null,
    credentialScanned: embedded.credentialScanned ?? null,
    productionLeakFindings: embedded.productionLeakFindings ?? null,
    productionLeakScanned: embedded.productionLeakScanned ?? null,
    provenance: 'live-gate-scan',
    summary: {
      ...(embedded.summary || {}),
      ...docSplit
    }
  };
}

function sanitizeSprintReportExport(sprintReport, projectLabel) {
  if (!sprintReport) return null;
  return sanitizeSimplebeaconReportExport(sprintReport, {
    projectPath: sprintReport.projectRoot || projectLabel
  });
}

export function buildEuAiActSummary(bundle = {}) {
  const compliance = bundle.compliance;
  const assessment = bundle.assessment;
  const embedded = bundle.embeddedInMainReport;
  const summary = compliance?.summary || assessment?.executiveSummary || {};
  const freshMetrics = resolveFreshEuAiActMetrics(bundle);
  const projectLabel = resolveProjectLabel(bundle);
  const gateResult = resolveGateResult(bundle);
  const sprintGateResult = resolveSprintGateResult(bundle, assessment);
  const mainReportGatePass = embedded?.gatePass ?? null;
  const filesScannedNote = buildFilesScannedNote(assessment);
  const liveGatePreferred = isLiveGatePreferred(bundle);

  return {
    checklistPassed: summary.passed ?? null,
    checklistTotal: summary.total ?? null,
    readinessScore: summary.score ?? summary.complianceScore ?? null,
    checklistHeadline: summary.headline ?? compliance?.title ?? null,
    checklistReconciledFrom: compliance?.gateReconciledFrom ?? null,
    gateResult,
    sprintGateResult,
    mainReportGatePass,
    gateMismatch: mainReportGatePass != null && sprintGateResult != null
      && ((mainReportGatePass === false && sprintGateResult === 'PASS')
        || (mainReportGatePass === true && sprintGateResult === 'FAIL')),
    gateMismatchNote: liveGatePreferred && mainReportGatePass != null && sprintGateResult === 'FAIL'
      ? 'Sprint artifacts still record gate FAIL — summary gateResult and GATE-001 use live report.json.'
      : null,
    aiSystemIndicators: freshMetrics.aiSystemIndicators,
    highRiskIndicators: freshMetrics.highRiskIndicators,
    transparencyGaps: freshMetrics.transparencyGaps,
    documentationArtifacts: freshMetrics.documentationArtifacts,
    euAiActScanned: freshMetrics.euAiActScanned,
    metricsSource: freshMetrics.metricsSource,
    simplebeaconDocumentationArtifacts: freshMetrics.simplebeaconDocumentationArtifacts,
    operatorDocumentationCount: freshMetrics.operatorDocumentationCount,
    hasData: bundle.hasData === true,
    evaluatedAt: compliance?.evaluatedAt ?? assessment?.generatedAt ?? embedded?.generatedAt ?? null,
    mainReportGeneratedAt: embedded?.generatedAt ?? null,
    projectRoot: redactProjectPathForExport(
      compliance?.projectRoot
      ?? assessment?.projectRoot
      ?? bundle.sprintReport?.projectRoot
      ?? embedded?.projectRoot,
      projectLabel
    ),
    freshnessNote: buildFreshnessNote(bundle),
    metricsStaleNote: freshMetrics.metricsStaleNote,
    ...(filesScannedNote ? { filesScannedNote } : {}),
    ...(assessment?.executiveSummary?.executiveSummaryNote
      ? { executiveSummaryNote: assessment.executiveSummary.executiveSummaryNote }
      : {})
  };
}

function buildExportProvenance(bundle = {}) {
  return {
    compliance: bundle.compliance ? 'eu-ai-act-sprint-artifact' : 'missing',
    assessment: bundle.assessment ? 'eu-ai-act-sprint-artifact' : 'missing',
    sprintReport: bundle.sprintReport ? 'eu-ai-act-sprint-artifact' : 'missing',
    embeddedInMainReport: bundle.embeddedInMainReport ? 'live-gate-scan' : 'missing'
  };
}

function syncAssessmentEuMetrics(assessment, summary) {
  if (!assessment?.euAiActSummary || summary.metricsSource !== 'live-gate-scan') return assessment;
  return {
    ...assessment,
    euAiActSummary: {
      ...assessment.euAiActSummary,
      aiSystemIndicators: summary.aiSystemIndicators ?? assessment.euAiActSummary.aiSystemIndicators,
      highRiskIndicators: summary.highRiskIndicators ?? assessment.euAiActSummary.highRiskIndicators,
      transparencyGaps: summary.transparencyGaps ?? assessment.euAiActSummary.transparencyGaps,
      documentationArtifacts: summary.documentationArtifacts ?? assessment.euAiActSummary.documentationArtifacts
    }
  };
}

function sanitizeClassificationExport(classification, _projectLabel) {
  if (!classification) return null;
  const reviewer = classification.legalReviewer || {};
  return {
    systemName: classification.systemName || null,
    riskTier: classification.riskTier || 'unclassified',
    role: classification.role || null,
    annexIIIAreas: classification.annexIIIAreas || [],
    rationale: classification.rationale || null,
    legalReviewer: {
      name: reviewer.name || null,
      firm: reviewer.firm || null,
      signedAt: reviewer.signedAt || null,
      attestation: reviewer.attestation || null
    },
    disclaimerAccepted: classification.disclaimerAccepted === true,
    updatedAt: classification.updatedAt || null,
    disclaimer: 'Legal classification record — independent counsel review required; not conformity certification.'
  };
}

function sanitizeLegalAttestationExport(attestation) {
  if (!attestation || attestation.status !== 'legal_review_complete') return null;
  return {
    status: attestation.status,
    approver_name: attestation.approver_name || null,
    approver_firm: attestation.approver_firm || null,
    signed_at: attestation.signed_at || null,
    attestation: attestation.attestation || null,
    risk_tier: attestation.risk_tier || null,
    role: attestation.role || null,
    system_name: attestation.system_name || null,
    linked_sprint_evaluated_at: attestation.linked_sprint_evaluated_at || null,
    disclaimer: attestation.disclaimer || null
  };
}

export function buildEuAiActExportBundle(bundle = {}) {
  const reconciled = applyExportReconciliation(bundle);
  const projectLabel = resolveProjectLabel(reconciled);
  const summary = buildEuAiActSummary(reconciled);
  const assessmentForExport = syncAssessmentEuMetrics(reconciled.assessment, summary);
  const exportEligibility = bundle.exportEligibility || {
    eligible: false,
    errors: [{ message: 'Refresh EU compliance page before export' }]
  };
  const exportNotes = dedupeExportNotes([
    summary.freshnessNote,
    summary.metricsStaleNote,
    summary.filesScannedNote,
    summary.executiveSummaryNote,
    summary.gateMismatchNote,
    summary.checklistReconciledFrom === 'live-gate-scan'
      ? 'GATE-001, CRED-001, and LEAK-001 reconciled from live report.json when sprint artifacts are stale — re-run EU sprint to refresh stored compliance.json.'
      : null,
    summary.metricsSource === 'live-gate-scan' && summary.simplebeaconDocumentationArtifacts
      ? `${summary.simplebeaconDocumentationArtifacts} documentation path(s) under .simplebeacon/ are scan artifacts — prefer docs/ for operator handoff packs.`
      : null,
    !exportEligibility.eligible && exportEligibility.errors?.[0]?.message
      ? `Export blocked: ${exportEligibility.errors[0].message}`
      : null
  ]);

  const classificationExport = sanitizeClassificationExport(reconciled.classification, projectLabel);
  const legalAttestationExport = sanitizeLegalAttestationExport(reconciled.legalAttestation);

  return {
    type: 'simplebeacon-eu-ai-act-export',
    version: '1.2.0',
    exportVersion: '1.2.0',
    generatedBy: 'SimpleBeacon',
    title: 'SimpleBeacon EU AI Act Export',
    generatedAt: new Date().toISOString(),
    disclaimer: bundle.disclaimer
      || 'Static technical readiness signals — not legal conformity certification under Regulation (EU) 2024/1689.',
    disclaimers: [
      'EU AI Act export bundles sprint artifacts plus embedded gate-scan metrics — not legal conformity certification.',
      'When main report.json is newer than sprint artifacts, gateResult and EU indicator counts follow the latest gate scan.',
      'assessment.complianceChecklist is omitted from exports — use top-level compliance rules.',
      'Absolute host paths are redacted to project label; prefer docs/ paths for operator handoff packs.',
      'assessment.executiveSummary.filesScanned counts mock/sample JSON under configured scan paths only.',
      'Client-facing export requires fresh sprint, legal classification (EUAI-000), and legal_review_complete attestation.'
    ],
    summary: {
      ...summary,
      operatorDocumentationCount: summary.operatorDocumentationCount ?? summary.documentationArtifacts,
      exportEligible: exportEligibility.eligible,
      legalHandoffEligible: exportEligibility.legalHandoffEligible
    },
    exportEligibility,
    legalClassification: classificationExport,
    legalAttestation: legalAttestationExport,
    provenance: buildExportProvenance(bundle),
    artifacts: bundle.artifacts || null,
    generateCommands: bundle.generateCommands || [],
    compliance: sanitizeComplianceExport(reconciled.compliance, projectLabel),
    assessment: sanitizeAssessmentExport(assessmentForExport, projectLabel),
    sprintReport: sanitizeSprintReportExport(reconciled.sprintReport, projectLabel),
    embeddedInMainReport: sanitizeEmbeddedMainReportExport(reconciled.embeddedInMainReport, projectLabel),
    bundleGeneratedAt: bundle.generatedAt || null,
    exportSanitized: true,
    handoffEligible: false,
    hygieneSummary: {
      checklistPassed: summary.checklistPassed,
      checklistTotal: summary.checklistTotal,
      readinessScore: summary.readinessScore,
      gateResult: summary.gateResult,
      aiSystemIndicators: summary.aiSystemIndicators,
      highRiskIndicators: summary.highRiskIndicators,
      documentationArtifacts: summary.operatorDocumentationCount ?? summary.documentationArtifacts,
      operatorDocumentationCount: summary.operatorDocumentationCount ?? summary.documentationArtifacts,
      metricsSource: summary.metricsSource,
      exportEligible: exportEligibility.eligible,
      attestationNote: exportEligibility.eligible
        ? 'EU AI Act export includes classification and legal_review_complete attestation — still not legal conformity certification.'
        : 'EU AI Act technical readiness export — not legal conformity certification or vendor handoff clearance.'
    },
    exportNotes
  };
}

function defaultSprintRelativeArtifacts() {
  return {
    report: '.simplebeacon/eu-ai-act-report.json',
    compliance: '.simplebeacon/eu-ai-act-compliance.json',
    assessment: '.simplebeacon/eu-ai-act-assessment.json'
  };
}

function resolveSprintGateContext(sprint = {}, options = {}) {
  const gateReport = options.gateReport || {};
  const repositoryFilesTotal = options.repositoryFilesTotal
    ?? options.gateRepositoryFilesTotal
    ?? gateReport.repositoryFilesTotal
    ?? gateReport.repositoryInventory?.totalFiles
    ?? sprint.hygieneSummary?.gateRepositoryFilesTotal
    ?? sprint.report?.hygieneSummary?.gateRepositoryFilesTotal
    ?? null;
  const credentialScanned = gateReport.credentialScanned
    ?? gateReport.productionLeakScanned
    ?? gateReport.scanScope?.productionDirsScanned
    ?? sprint.hygieneSummary?.gateContentFilesScanned
    ?? sprint.report?.hygieneSummary?.contentFilesScanned
    ?? null;
  const gateProfile = gateReport.scanScope?.profile
    ?? sprint.report?.scanScope?.profile
    ?? sprint.report?.scanScope?.gateRuleBundleProfile
    ?? sprint.complianceChecklist?.scanScope?.gateRuleBundleProfile
    ?? sprint.complianceChecklist?.hygieneSummary?.gateRuleBundleProfile
    ?? sprint.hygieneSummary?.gateRuleBundleProfile
    ?? null;
  return {
    gateReport,
    repositoryFilesTotal,
    credentialScanned,
    gateProfile,
    fictionJsonFilesScanned: gateReport.fictionJsonFilesScanned
      ?? gateReport.scanScope?.fictionJsonFilesScanned
      ?? sprint.hygieneSummary?.gateFictionJsonFilesScanned
      ?? null,
    fictionSampleFilesScanned: gateReport.fictionSampleFilesScanned
      ?? gateReport.mockSampleFiles
      ?? gateReport.scanScope?.fictionSampleFilesScanned
      ?? sprint.hygieneSummary?.fictionSampleFilesScanned
      ?? null
  };
}

function buildSprintArtifactExportNotes(sprint = {}, options = {}) {
  const notes = [
    'EU AI Act sprint artifact — technical readiness only, not legal conformity certification.',
    'securityHandoffEligible is false — SimpleBeacon vendor handoff requires separate Complete scan attestation.',
    'Absolute scan paths are redacted to project label in operator exports.'
  ];
  if (sprint.complianceChecklist?.summary?.legalHandoffEligible === true) {
    notes.push(
      'legalHandoffEligible reflects EU technical rule rows — EUAI-000 classification sign-off still required before client legal handoff.'
    );
  }
  const gateContext = resolveSprintGateContext(sprint, options);
  const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile, gateReport,
    fictionJsonFilesScanned: gateFiction, fictionSampleFilesScanned: fictionSamples } = gateContext;
  const sprintRepo = sprint.report?.repositoryFilesTotal
    ?? sprint.report?.repositoryInventory?.totalFiles
    ?? null;
  if (gateTotal != null && sprintRepo != null && gateTotal > sprintRepo) {
    notes.push(
      `EU sprint inventory ${Number(sprintRepo).toLocaleString()} files (audit profile) — Complete scan gate full-tree inventory is ${Number(gateTotal).toLocaleString()} paths.`
    );
  }
  if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
    notes.push(
      `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`
    );
  }
  const ruleScoped = sprint.report?.ruleScopedFilesAnalyzed
    ?? sprint.report?.scanScope?.ruleScopedFilesAnalyzed
    ?? null;
  const sprintProfile = sprint.report?.scanScope?.profile ?? gateProfile;
  if (sprintProfile === 'eu-ai-act' && ruleScoped != null) {
    notes.push(
      `EU AI Act sprint gate checked ${Number(ruleScoped).toLocaleString()} rule-scoped paths — narrower scope than full-platform gate when run standalone.`
    );
  }
  const sprintFiction = sprint.report?.fictionJsonFilesScanned ?? sprint.report?.scanScope?.fictionJsonFilesScanned;
  if (sprintFiction != null && gateFiction != null && fictionSamples != null && sprintFiction !== gateFiction) {
    notes.push(
      `Sprint fiction KPI rules evaluated ${Number(sprintFiction).toLocaleString()} repository JSON path(s) — Complete scan gate evaluated ${Number(gateFiction).toLocaleString()} with ${Number(fictionSamples).toLocaleString()} *-sample.json KPI file(s) matched.`
    );
  }
  const nonDocs = sprint.report?.euAiActSummary?.scanMatchedNonDocsCount;
  if (nonDocs != null && nonDocs > 0) {
    notes.push(
      `${Number(nonDocs).toLocaleString()} EU AI Act scan pattern match(es) outside docs/ (e.g. package.json) — not operator handoff documentation.`
    );
  }
  const suppressed = sprint.report?.productionLeakSuppressedIntent;
  if (suppressed != null && suppressed > 0 && (sprint.report?.productionLeakFindings ?? 0) === 0) {
    notes.push(
      `${Number(suppressed).toLocaleString()} production-leak pattern hit(s) suppressed as intentional — blocking productionLeakFindings is 0.`
    );
  }
  if (sprint.assessment?.pilotProposal?.pricePlaceholder) {
    notes.push('assessment.pilotProposal pricing is a template range — not a binding quote in operator vault exports.');
  }
  if (gateProfile) {
    notes.push(`Gate rule bundle profile: ${gateProfile} — pair sprint export with json/simplebeacon-gate.json for full-tree handoff evidence.`);
  }
  if (sprint.gate?.pass === false || sprint.complianceChecklist?.complianceStatus === 'failed') {
    const failedIds = (sprint.complianceChecklist?.rules || [])
      .filter((rule) => rule.status === 'fail')
      .map((rule) => rule.id);
    const blocking = sprint.gate?.blockingCount ?? gateReport.gate?.blockingCount ?? null;
    if (failedIds.length) {
      notes.push(
        `Checklist failures (${failedIds.join(', ')}) align with sprint gate (pass=false${blocking != null ? `, ${Number(blocking).toLocaleString()} blocking finding(s)` : ''}) — see json/simplebeacon-gate.json.`
      );
    }
  }
  const reportNotes = sprint.report?.exportNotes;
  if (Array.isArray(reportNotes)) {
    const jestNote = reportNotes.find((n) => /Jest was not run/i.test(String(n)));
    if (jestNote) notes.push(jestNote);
  }
  return [...new Set(notes)].slice(0, 14);
}

function buildSprintArtifactHygieneSummary(sprint = {}, options = {}) {
  const checklist = sprint.complianceChecklist?.summary || {};
  const gateContext = resolveSprintGateContext(sprint, options);
  const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile, gateReport,
    fictionJsonFilesScanned: gateFiction, fictionSampleFilesScanned: fictionSamples } = gateContext;
  const sprintRepo = sprint.report?.repositoryFilesTotal
    ?? sprint.report?.repositoryInventory?.totalFiles
    ?? null;
  const ruleScoped = sprint.report?.ruleScopedFilesAnalyzed ?? sprint.report?.scanScope?.ruleScopedFilesAnalyzed ?? null;
  const sprintFiction = sprint.report?.fictionJsonFilesScanned ?? sprint.report?.scanScope?.fictionJsonFilesScanned ?? null;
  const jestChecked = sprint.report?.jestBaselineChecked
    ?? gateReport.jestBaselineChecked
    ?? sprint.hygieneSummary?.jestBaselineChecked
    ?? null;
  return {
    checklistPassed: checklist.passed ?? sprint.compliance?.passed ?? null,
    checklistTotal: checklist.total ?? sprint.compliance?.total ?? null,
    readinessScore: checklist.score ?? sprint.compliance?.score ?? null,
    gateResult: sprint.gate?.pass === false ? 'FAIL' : sprint.gate?.pass ? 'PASS' : null,
    euPatternHits: sprint.euPatternHits ?? sprint.report?.euAiActFindings ?? 0,
    operatorDocumentationCount: checklist.operatorDocumentationCount
      ?? sprint.report?.euAiActSummary?.operatorDocumentationCount
      ?? null,
    ruleScopedFilesAnalyzed: ruleScoped,
    euAiActScanned: sprint.report?.euAiActScanned ?? sprint.report?.scanScope?.euAiActFilesScanned ?? null,
    scanMatchedNonDocsCount: sprint.report?.euAiActSummary?.scanMatchedNonDocsCount ?? null,
    productionLeakSuppressedIntent: sprint.report?.productionLeakSuppressedIntent ?? null,
    sprintFictionJsonFilesScanned: sprintFiction,
    gateFictionJsonFilesScanned: gateFiction,
    fictionSampleFilesScanned: fictionSamples,
    legalHandoffEligible: checklist.legalHandoffEligible ?? null,
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    ...(sprintRepo != null ? { sprintRepositoryFilesTotal: sprintRepo } : {}),
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateTotal != null && sprintRepo != null && gateTotal > sprintRepo
      ? { sprintInventoryNotInGate: gateTotal - sprintRepo }
      : {}),
    ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
      ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
      : {}),
    ...(credentialScanned != null ? { gateContentFilesScanned: credentialScanned } : {}),
    ...(jestChecked === false ? { jestBaselineChecked: false } : {}),
    attestationNote: 'EU AI Act sprint hygiene — technical readiness only, not legal conformity or vendor handoff clearance.'
  };
}

function reconcileEuAiActSprintReportLimitations(report) {
  if (!report?.scanScope?.limitations?.length) return report;
  const prodScanned = report.productionLeakScanned ?? report.scanScope?.productionDirsScanned ?? 0;
  const sourceFiction = report.sourceCodeFilesScanned ?? report.scanScope?.sourceCodeFilesScanned ?? 0;
  const limitations = report.scanScope.limitations.map((note) => {
    if (/source code \(0 files in server/i.test(String(note)) && prodScanned > 0) {
      return `Fiction/KPI source-code rules scanned ${sourceFiction} file(s); production-leak rules scanned ${prodScanned} file(s) under server/, src/.`;
    }
    return note;
  });
  return {
    ...report,
    scanScope: {
      ...report.scanScope,
      limitations
    }
  };
}

/**
 * Operator ZIP artifact for raw EU AI Act sprint service payload (not page export bundle).
 */
export function sanitizeEuAiActSprintArtifactExport(sprint, options = {}) {
  if (!sprint || typeof sprint !== 'object') return sprint;
  if (sprint.ok === false) return sprint;

  const projectPath = options.projectPath || sprint.projectPath || sprint.platformRoot || '';
  const projectLabel = projectLabelFromPath(projectPath);
  const relativeArtifacts = sprint.relativeArtifacts || defaultSprintRelativeArtifacts();
  const gateReport = options.gateReport || null;
  const repositoryFilesTotal = options.repositoryFilesTotal
    ?? gateReport?.repositoryFilesTotal
    ?? gateReport?.repositoryInventory?.totalFiles
    ?? null;
  const reportOptions = {
    projectPath,
    embeddedInEuAiActSprint: true,
    ...(repositoryFilesTotal != null ? { repositoryFilesTotal, gateRepositoryFilesTotal: repositoryFilesTotal } : {})
  };

  let report = sprint.report
    ? sanitizeSimplebeaconReportExport(sprint.report, reportOptions)
    : sprint.report;
  if (report) {
    report = reconcileEuAiActSprintReportLimitations(report);
  }

  let complianceChecklist = sprint.complianceChecklist
    ? sanitizeComplianceChecklistArtifactExport(sprint.complianceChecklist, {
      projectPath,
      gateReport: gateReport || report || null,
      npmAudit: options.npmAudit || null,
      operatorExport: true
    })
    : sprint.complianceChecklist;
  if (complianceChecklist?.projectRoot) {
    complianceChecklist = {
      ...complianceChecklist,
      projectRoot: redactProjectPathForExport(complianceChecklist.projectRoot, projectLabel)
    };
  }
  if (sprint.complianceChecklist?.summary?.legalHandoffEligible != null && complianceChecklist?.summary) {
    complianceChecklist = {
      ...complianceChecklist,
      summary: {
        ...complianceChecklist.summary,
        legalHandoffEligible: sprint.complianceChecklist.summary.legalHandoffEligible
      }
    };
  }

  let assessment = sprint.assessment
    ? sanitizeAssessmentExport(sprint.assessment, projectLabel)
    : sprint.assessment;
  if (assessment && report?.euAiActSummary) {
    assessment = {
      ...assessment,
      euAiActSummary: report.euAiActSummary,
      exportNormalized: true,
      exportSanitized: true,
      securityHandoffEligible: false,
      handoffEligible: false
    };
  } else if (assessment) {
    assessment = {
      ...assessment,
      exportNormalized: true,
      exportSanitized: true,
      securityHandoffEligible: false,
      handoffEligible: false
    };
  }

  const sprintContext = { ...sprint, report, complianceChecklist, assessment };
  const sanitized = {
    ...sprint,
    projectPath: redactProjectPathForExport(sprint.projectPath, projectLabel),
    platformRoot: redactProjectPathForExport(sprint.platformRoot, projectLabel),
    report,
    complianceChecklist,
    assessment,
    artifacts: relativeArtifacts,
    relativeArtifacts,
    exportNormalized: true,
    exportSanitized: true,
    scanTargetProfile: 'product',
    securityHandoffEligible: false,
    handoffEligible: false,
    hygieneSummary: buildSprintArtifactHygieneSummary(sprintContext, {
      ...options,
      repositoryFilesTotal
    }),
    exportNotes: buildSprintArtifactExportNotes(sprintContext, {
      ...options,
      repositoryFilesTotal,
      gateReport
    })
  };

  delete sanitized.sampleReportUrl;
  delete sanitized.analyzeHashUrl;

  return sanitized;
}

/**
 * Re-sanitize a downloaded EU AI Act export JSON.
 * @param {object} bundle
 * @returns {object}
 */
export function sanitizeEuAiActExport(bundle) {
  if (!bundle) return bundle;
  if (bundle.type === 'simplebeacon-eu-ai-act-export') {
    return buildEuAiActExportBundle({
      hasData: bundle.summary?.hasData ?? true,
      disclaimer: bundle.disclaimer,
      artifacts: bundle.artifacts,
      generateCommands: bundle.generateCommands,
      generatedAt: bundle.bundleGeneratedAt,
      compliance: bundle.compliance,
      assessment: bundle.assessment,
      sprintReport: bundle.sprintReport,
      embeddedInMainReport: bundle.embeddedInMainReport
    });
  }
  return buildEuAiActExportBundle(bundle);
}

function csvEscape(cell) {
  return `"${String(cell ?? '').replace(/"/g, '""')}"`;
}

export function buildEuAiActChecklistCsv(rules) {
  if (!rules?.length) return null;
  const header = ['id', 'title', 'category', 'severity', 'status', 'evidence', 'remediation'];
  const rows = rules.map((rule) => [
    rule.id || '',
    rule.title || '',
    rule.category || '',
    rule.severity || '',
    rule.status || '',
    rule.evidence || '',
    rule.remediation || ''
  ].map(csvEscape).join(','));
  return [header.join(','), ...rows].join('\n');
}

export function buildEuAiActDocumentationCsv(docs) {
  if (!docs?.length) return null;
  const header = ['path'];
  const rows = docs.map((doc) => csvEscape(typeof doc === 'string' ? doc : String(doc)));
  return [header.join(','), ...rows].join('\n');
}

export function buildEuAiActSummaryCsv(summary) {
  if (!summary) return null;
  const header = ['metric', 'value'];
  const rows = Object.entries(summary).map(([key, value]) => [
    key,
    value == null ? '' : String(value)
  ].map(csvEscape).join(','));
  return [header.join(','), ...rows].join('\n');
}

export function buildEuAiActCsv({ rules, documentationFound, summary } = {}) {
  const parts = [];
  const checklist = buildEuAiActChecklistCsv(rules);
  const docs = buildEuAiActDocumentationCsv(documentationFound);
  const summaryCsv = !checklist ? buildEuAiActSummaryCsv(summary) : null;

  if (checklist) parts.push(checklist);
  if (summaryCsv) {
    if (parts.length) parts.push('');
    parts.push('EU AI Act Summary');
    parts.push(summaryCsv);
  }
  if (docs) {
    if (parts.length) parts.push('');
    parts.push('Documentation artifacts');
    parts.push(docs);
  }
  return parts.length ? parts.join('\n') : null;
}

export function euAiActExportFilename(ext = 'json') {
  const stamp = new Date().toISOString().slice(0, 10);
  if (ext === 'csv') return `eu-ai-act-metrics-${stamp}.csv`;
  return `eu-ai-act-export-${stamp}.json`;
}
