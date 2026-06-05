/**
 * Sanitize compliance checklist bundle exports (standalone download + complete-scan).
 */

const { isExternalBenchmarkCachePath } = require('./benchmark-cache-paths');
const { sanitizeNpmAuditExport } = require('./npm-audit-export-sanitize');
const { redactProjectPathForExport, projectLabelFromPath } = require('./assessment-export-sanitize');

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

function isBenchmarkCacheProjectPath(projectPath) {
    return isExternalBenchmarkCachePath(String(projectPath || '').replace(/\\/g, '/'));
}

function resolveProductPlatformRoot(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('/github-cache/');
    if (idx <= 0) return null;
    return normalized.slice(0, idx);
}

function ruleScopedFilesFromSimplebeacon(gateReport) {
    return gateReport?.ruleScopedFilesAnalyzed
        ?? gateReport?.scanScope?.ruleScopedFilesAnalyzed
        ?? 0;
}

function hasHollowGateAttestation(gateReport) {
    if (!gateReport) return false;
    return Boolean(gateReport.gate?.pass) && ruleScopedFilesFromSimplebeacon(gateReport) === 0;
}

function checklistHasStalePassRows(checklist, gateReport) {
    if (!checklist?.rules?.length || !gateReport) return false;
    const ruleScoped = ruleScopedFilesFromSimplebeacon(gateReport);
    if (ruleScoped > 0) return false;
    return checklist.rules.some((rule) => {
        if (rule.status !== 'pass') return false;
        if (rule.id === 'GATE-001' || rule.id === 'CRED-001' || rule.id === 'LEAK-001') return true;
        if (rule.id === 'SUPPLY-001' || rule.id === 'SUPPLY-002') {
            return /Scanned 0 path|0 critical, 0 high \(scan\)/i.test(String(rule.evidence || ''));
        }
        return false;
    });
}

function checklistHasStaleFailRows(checklist, gateReport) {
    if (!checklist?.rules?.length || !gateReport) return false;
    if (gateReport.gate?.pass !== true) return false;
    const blocking = gateReport.gate?.blockingCount ?? gateReport.issueCount ?? null;
    if (blocking != null && blocking > 0) return false;
    if ((gateReport.productionLeakFindings ?? 0) > 0) return false;
    const schemaChecked = gateReport.schemaChecked ?? gateReport.pageSampleSchemaChecked ?? 0;
    const schemaPassed = gateReport.schemaPassed ?? gateReport.pageSampleSchemaPassed ?? 0;
    const schemaOk = schemaChecked > 0 && schemaPassed === schemaChecked;
    return checklist.rules.some((rule) => {
        if (rule.status !== 'fail') return false;
        if (rule.id === 'GATE-001' || rule.id === 'LEAK-001') return true;
        if (rule.id === 'DATA-001' && schemaOk) return true;
        return false;
    });
}

function refreshComplianceChecklist(checklist, gateReport, projectPath, npmAudit, options = {}) {
    const force = Boolean(options.force);
    if (!force
        && !checklistHasStalePassRows(checklist, gateReport)
        && !checklistHasStaleFailRows(checklist, gateReport)) {
        return checklist;
    }
    const { evaluateComplianceChecklist } = require('../compliance-checklist');
    return evaluateComplianceChecklist(gateReport, {
        projectRoot: projectPath || gateReport.projectRoot || '',
        npmAudit: npmAudit || null
    });
}

function patchSupplyRulesFromNpmAudit(rules, npmAudit) {
    if (!Array.isArray(rules) || !npmAudit) return rules;
    const source = npmAudit.source || npmAudit.dataSource || 'npm-audit';
    return rules.map((rule) => {
        if (rule.id === 'SUPPLY-001') {
            if (npmAudit.skipped) {
                return {
                    ...rule,
                    status: 'skip',
                    evidence: npmAudit.scopeNote || 'npm audit skipped for this scan path'
                };
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
                return {
                    ...rule,
                    status: 'skip',
                    evidence: npmAudit.scopeNote || 'npm audit not applicable'
                };
            }
            const moderate = npmAudit.summary.moderate || npmAudit.summary.medium || 0;
            const limit = 0;
            const ok = moderate <= limit;
            return {
                ...rule,
                status: ok ? 'pass' : 'fail',
                evidence: ok
                    ? `${moderate} moderate (limit ${limit}) — ${source}`
                    : `${moderate} moderate exceeds policy limit of ${limit}`
            };
        }
        return rule;
    });
}

function resolveBundleHandoffEligible(checklist, context) {
    if (context.benchmarkScan || context.hollowGate) return false;
    const summary = checklist?.summary || {};
    if (summary.handoffEligible === false) return false;
    if ((summary.failed ?? 0) > 0) return false;
    if (summary.readyForAutomation === false) return false;
    if (summary.handoffEligible === true) return true;
    return (summary.passed ?? 0) > 0 && (summary.failed ?? 0) === 0;
}

function resolveComplianceStatus(checklist, context) {
    if (context.benchmarkScan) return 'benchmark-cache';
    if (context.hollowGate) return 'limited-gate-scope';
    if ((checklist?.summary?.failed ?? 0) > 0) return 'failed';
    return 'pass';
}

function normalizeComplianceBranding(value) {
    return String(value ?? '').replace(/\bSimplebeacon\b/g, 'SimpleBeacon');
}

function buildComplianceHygieneSummary(checklist, gateReport, npmAudit, context) {
    const summary = checklist?.summary || {};
    const gateProfile = gateReport?.scanScope?.profile
        ?? checklist?.scanScope?.gateRuleBundleProfile
        ?? checklist?.hygieneSummary?.gateRuleBundleProfile
        ?? null;
    const repoTotal = gateReport?.repositoryFilesTotal
        ?? gateReport?.repositoryInventory?.totalFiles
        ?? checklist?.hygieneSummary?.gateRepositoryFilesTotal
        ?? ruleScopedFilesFromSimplebeacon(gateReport);
    const credentialScanned = gateReport?.credentialScanned
        ?? gateReport?.scanScope?.productionDirsScanned
        ?? checklist?.hygieneSummary?.credentialScanned
        ?? null;
    const contentScanned = gateReport?.scanScope?.fullDirectoryStats?.contentScanned
        ?? gateReport?.scanScope?.fullDirectoryStats?.filesContentScanned
        ?? gateReport?.credentialScanned
        ?? checklist?.hygieneSummary?.contentFilesScanned
        ?? null;
    const fullDirectoryScan = gateReport?.fullDirectoryScan
        ?? gateReport?.scanScope?.fullDirectoryScan
        ?? checklist?.hygieneSummary?.fullDirectoryScan
        ?? checklist?.scanScope?.fullDirectoryScan
        ?? (gateReport?.scanScope?.fullDirectoryStats != null ? true : null)
        ?? (gateReport?.ruleScopedFilesAnalyzed > 0 && gateReport?.repositoryFilesTotal > 0
            && gateReport.ruleScopedFilesAnalyzed === gateReport.repositoryFilesTotal ? true : null);
    return {
        complianceStatus: resolveComplianceStatus(checklist, context),
        rulesPassed: summary.passed ?? null,
        rulesFailed: summary.failed ?? 0,
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
        attestationNote: 'Corporate safety checklist — automated CI gate rules only, not vendor security handoff or legal conformity certification.',
        ...(checklist?.hygieneSummary?.gatePass != null ? { gatePass: checklist.hygieneSummary.gatePass } : {}),
        ...(gateReport?.gate?.pass != null ? { gatePass: gateReport.gate.pass } : {}),
        ...(fullDirectoryScan != null ? { fullDirectoryScan } : {})
    };
}

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
    const fullDirectoryScan = gateReport?.fullDirectoryScan
        ?? gateReport?.scanScope?.fullDirectoryScan
        ?? checklist?.hygieneSummary?.fullDirectoryScan
        ?? checklist?.scanScope?.fullDirectoryScan
        ?? (gateReport?.scanScope?.fullDirectoryStats != null ? true : null)
        ?? (gateReport?.ruleScopedFilesAnalyzed > 0 && gateReport?.repositoryFilesTotal > 0
            && gateReport.ruleScopedFilesAnalyzed === gateReport.repositoryFilesTotal ? true : null);
    return {
        checklistProfile: checklist?.scanScope?.checklistProfile || 'default',
        resultsViewScope: 'platform-only',
        securityHandoffEligible: false,
        ...(repoTotal != null ? { gateRepositoryFilesTotal: repoTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        ...(fullDirectoryScan != null ? { fullDirectoryScan } : {}),
        sourceArtifacts: {
            gateReport: Boolean(gateReport || checklist?.scanScope?.sourceArtifacts?.gateReport),
            npmAudit: Boolean(options.npmAudit || checklist?.scanScope?.sourceArtifacts?.npmAudit)
        }
    };
}

function buildComplianceExportNotes(checklist, gateReport, npmAudit, context) {
    const notes = [];
    if (!context.benchmarkScan) {
        notes.push('securityHandoffEligible is false — checklist attests CI automation rules only, not vendor security handoff.');
        notes.push('Absolute scan paths are redacted to project label in operator exports.');
    }
    const summary = checklist?.summary || {};
    if (context.benchmarkScan) {
        notes.push('Benchmark clone — compliance checklist is not valid for Simplebeacon product handoff.');
    }
    if (context.hollowGate) {
        notes.push('Gate passed with zero rule-scoped files — credential and production-leak rules did not run on product paths.');
    }
    if (gateReport && gateReport.jestBaselineChecked === false) {
        notes.push('Jest was not executed during the gate scan — run npm test or simplebeacon:full before vendor handoff sign-off.');
    }
    if (npmAudit?.supplyChainStatus === 'pass') {
        notes.push('Supply chain: npm audit reported 0 critical and 0 high at project root.');
    } else if (npmAudit?.skipped) {
        notes.push(npmAudit.scopeNote || 'npm audit was skipped for this scan path.');
    }
    if (summary.readyForAutomation && !context.benchmarkScan && !context.hollowGate) {
        notes.push('readyForAutomation reflects CI deploy-gate readiness — not SimpleBeacon vendor security handoff.');
    }
    const repoTotal = gateReport?.repositoryFilesTotal
        ?? gateReport?.repositoryInventory?.totalFiles
        ?? ruleScopedFilesFromSimplebeacon(gateReport);
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
    const complianceStatus = resolveComplianceStatus(checklist, context);
    if (complianceStatus === 'failed' && gateReport?.gate?.pass === false) {
        const failedIds = (checklist?.rules || []).filter((rule) => rule.status === 'fail').map((rule) => rule.id);
        const blocking = gateReport.gate?.blockingCount ?? gateReport.issueCount ?? null;
        if (failedIds.length) {
            notes.push(
                `Checklist failures (${failedIds.join(', ')}) align with bundled gate (pass=false${blocking != null ? `, ${Number(blocking).toLocaleString()} blocking finding(s)` : ''}) — see json/simplebeacon-gate.json.`
            );
        }
    }
    if (gateReport?.gate?.pass === true) {
        notes.push('Paired gate scan PASS — checklist aligned with simplebeacon-gate.json attestation.');
    }
    if (gateReport?.gate?.pass === true) {
        notes.push('Paired gate scan PASS — checklist aligned with simplebeacon-gate.json attestation.');
    }
    if (summary.headline && !notes.length) {
        notes.push(summary.headline);
    }
    return [...new Set(notes)].slice(0, 10);
}

function sanitizeGateReportForComplianceExport(gateReport, projectPath) {
    if (!gateReport || typeof gateReport !== 'object') return gateReport;
    const { sanitizeSimplebeaconReportExport } = require('./simplebeacon-report-export-sanitize');
    const enriched = sanitizeSimplebeaconReportExport(gateReport, { projectPath: projectPath || gateReport.projectRoot });
    const benchmarkScan = isBenchmarkCacheProjectPath(projectPath || enriched.projectRoot || '');
    const hollowGate = hasHollowGateAttestation(enriched);
    if (!benchmarkScan && !hollowGate) return enriched;

    const priorLimitations = (enriched.scanScope?.limitations || []).filter(
        (line) => line && !/exclude.*github-cache/i.test(String(line))
            && !/69k\+ files/i.test(String(line))
    );

    const limitations = benchmarkScan
        ? [
            'Scanning OSS benchmark clone under github-cache/ — Simplebeacon product gate paths were not evaluated.',
            ...priorLimitations
        ]
        : [
            'Gate PASS with 0 gate-rule files — credential and production-leak rules did not run on configured product paths.',
            ...priorLimitations
        ];

    return {
        ...enriched,
        ...(hollowGate ? { gateAttestation: benchmarkScan ? 'limited-benchmark' : 'limited-scope' } : {}),
        scanScope: {
            ...(enriched.scanScope || {}),
            reportHealth: benchmarkScan ? 'benchmark-clone-scan' : enriched.scanScope?.reportHealth,
            resultsViewScope: benchmarkScan ? 'benchmark-clone' : enriched.scanScope?.resultsViewScope,
            limitations: [...new Set(limitations)].slice(0, 8)
        }
    };
}

function sanitizeComplianceForExport(compliance, context = {}) {
    if (!compliance) return compliance;
    const benchmarkScan = context.benchmarkScan
        ?? isBenchmarkCacheProjectPath(context.projectPath || compliance.projectRoot || '');
    const hollowGate = context.hollowGate
        ?? hasHollowGateAttestation(context.gateReport);
    const stale = checklistHasStalePassRows(compliance, context.gateReport)
        || checklistHasStaleFailRows(compliance, context.gateReport);
    const needsRefresh = stale || benchmarkScan || hollowGate;
    const needsSupplyPatch = Boolean(context.npmAudit);

    if (!needsRefresh && !needsSupplyPatch) {
        return compliance;
    }

    let next = needsRefresh
        ? refreshComplianceChecklist(
            compliance,
            context.gateReport,
            context.projectPath || compliance.projectRoot,
            context.npmAudit,
            { force: benchmarkScan || hollowGate }
        )
        : { ...compliance, rules: [...(compliance.rules || [])] };

    if (needsSupplyPatch) {
        next = {
            ...next,
            rules: patchSupplyRulesFromNpmAudit(next.rules, context.npmAudit)
        };
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
            readyForAutomation: !benchmarkScan
                && !hollowGate
                && failed === 0
                && passed > 0
                && !next.rules.some((r) =>
                    ['GATE-001', 'CRED-001', 'LEAK-001', 'SUPPLY-001', 'SUPPLY-002'].includes(r.id)
                    && r.status === 'skip'
                ),
            handoffEligible: !benchmarkScan && !hollowGate && failed === 0
                && !next.rules.some((r) =>
                    ['GATE-001', 'CRED-001', 'LEAK-001'].includes(r.id) && r.status === 'skip'
                )
        };
    }

    if (benchmarkScan || hollowGate) {
        const ruleScoped = ruleScopedFilesFromSimplebeacon(context.gateReport);
        if (ruleScoped === 0 && Array.isArray(next.rules)) {
            next = {
                ...next,
                rules: next.rules.map((rule) => {
                    if (rule.status !== 'pass') return rule;
                    if (['GATE-001', 'CRED-001', 'LEAK-001'].includes(rule.id)) {
                        return {
                            ...rule,
                            status: 'skip',
                            evidence: 'Benchmark clone — gate rule scope is 0 files; not evaluated on product paths.'
                        };
                    }
                    return rule;
                })
            };
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
                score: scored ? Math.round((passed / scored) * 100) : null
            };
        }
        const summary = { ...(next.summary || {}) };
        summary.readyForAutomation = false;
        summary.handoffEligible = false;
        if (benchmarkScan) {
            summary.headline = 'Benchmark clone — not valid for Simplebeacon platform handoff. Run Complete scan on ai-platform.';
            summary.benchmarkScan = true;
            summary.scanTargetProfile = 'benchmark-cache';
            summary.productPlatformRoot = context.productPlatformRoot
                || resolveProductPlatformRoot(context.projectPath || compliance.projectRoot || '');
        } else if (hollowGate) {
            summary.headline = 'Limited gate scope — configure production paths before enabling automated deploy gates.';
            summary.hollowGate = true;
            summary.scanTargetProfile = 'limited-gate-scope';
        }
        next = { ...next, summary };
    }

    return next;
}

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
 * Flat checklist JSON for operator ZIP / complete-scan results.compliance.
 */
function sanitizeComplianceChecklistArtifactExport(checklist, options = {}) {
    const projectPath = options.projectPath || checklist?.projectRoot || '';
    const gateReport = options.gateReport
        ? sanitizeGateReportForComplianceExport(options.gateReport, projectPath)
        : null;
    const benchmarkScan = isBenchmarkCacheProjectPath(projectPath);
    const hollowGate = hasHollowGateAttestation(gateReport);
    const npmAuditSanitized = options.npmAudit
        ? sanitizeNpmAuditExport(options.npmAudit, projectPath)
        : undefined;
    const context = {
        benchmarkScan,
        hollowGate,
        productPlatformRoot: benchmarkScan ? resolveProductPlatformRoot(projectPath) : null,
        projectPath,
        gateReport,
        npmAudit: npmAuditSanitized
    };
    const sanitized = sanitizeComplianceForExport(
        unwrapComplianceChecklist(checklist),
        context
    );
    const exportNotes = buildComplianceExportNotes(sanitized, gateReport, npmAuditSanitized, context);
    if (options.operatorExport !== false) {
        exportNotes.push(
            'Checklist attests automated rule rows only — securityHandoffEligible remains false until operator vendor sign-off.'
        );
    }
    const pathContext = resolveComplianceExportPathContext(projectPath, context);
    const redactedProjectRoot = pathContext.redact(sanitized.projectRoot || projectPath);
    const hygieneSummary = buildComplianceHygieneSummary(
        sanitized,
        gateReport,
        npmAuditSanitized,
        context
    );
    const scanScope = buildComplianceScanScope(gateReport, {
        repositoryFilesTotal: options.repositoryFilesTotal
            ?? gateReport?.repositoryFilesTotal
            ?? gateReport?.repositoryInventory?.totalFiles,
        npmAudit: npmAuditSanitized,
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
        complianceStatus: resolveComplianceStatus(sanitized, context),
        exportNotes: [...new Set(exportNotes)].slice(0, 10),
        hygieneSummary,
        scanScope,
        summary
    };
}

function sanitizeComplianceBundleExport(payload = {}) {
    const projectPath = payload.projectPath
        || payload.checklist?.projectRoot
        || payload.gateReport?.projectRoot
        || '';
    const benchmarkScan = isBenchmarkCacheProjectPath(projectPath);
    const productPlatformRoot = benchmarkScan ? resolveProductPlatformRoot(projectPath) : null;
    const gateReport = sanitizeGateReportForComplianceExport(payload.gateReport, projectPath);
    const hollowGate = hasHollowGateAttestation(gateReport);
    const npmAuditSanitized = payload.npmAudit
        ? sanitizeNpmAuditExport(payload.npmAudit, projectPath)
        : undefined;
    const context = {
        benchmarkScan,
        hollowGate,
        productPlatformRoot,
        projectPath,
        gateReport,
        npmAudit: npmAuditSanitized
    };

    const checklist = sanitizeComplianceForExport(
        unwrapComplianceChecklist(payload.checklist),
        context
    );
    const handoffEligible = resolveBundleHandoffEligible(checklist, context);
    const complianceStatus = resolveComplianceStatus(checklist, context);
    const pathContext = resolveComplianceExportPathContext(projectPath, context);

    return {
        type: payload.type || 'simplebeacon-compliance-checklist',
        generatedAt: payload.generatedAt || checklist?.evaluatedAt || new Date().toISOString(),
        projectPath: pathContext.redact(projectPath),
        exportNormalized: true,
        complianceStatus,
        scanTargetProfile: benchmarkScan ? 'benchmark-cache' : hollowGate ? 'limited-gate-scope' : 'product',
        handoffEligible,
        readyForAutomation: checklist?.summary?.readyForAutomation ?? false,
        productPlatformRoot: productPlatformRoot
            ? pathContext.redact(productPlatformRoot)
            : undefined,
        benchmarkScan: benchmarkScan || undefined,
        npmAudit: npmAuditSanitized,
        gateReport: gateReport || null,
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
        exportNotes: buildComplianceExportNotes(checklist, gateReport, npmAuditSanitized, context)
    };
}

module.exports = {
    isBenchmarkCacheProjectPath,
    resolveProductPlatformRoot,
    hasHollowGateAttestation,
    checklistHasStalePassRows,
    checklistHasStaleFailRows,
    unwrapComplianceChecklist,
    patchSupplyRulesFromNpmAudit,
    sanitizeGateReportForComplianceExport,
    sanitizeComplianceForExport,
    sanitizeComplianceChecklistArtifactExport,
    sanitizeComplianceBundleExport
};
