/**
 * Sanitize codebase-analyzer-report exports — benchmark clones, ESLint scope, tier labels.
 */

const { isBenchmarkScanTargetRoot } = require('./benchmark-cache-paths');
const { redactProjectPathForExport, projectLabelFromPath } = require('./assessment-export-sanitize');

function resolveProductPlatformRoot(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('/github-cache/');
    if (idx <= 0) return null;
    return normalized.slice(0, idx);
}

function normalizeExportPath(projectPath) {
    return String(projectPath || '').replace(/\\/g, '/');
}

function inferCodebaseScanTargetFromHints(report, options = {}) {
    const filename = String(options.exportFilename || options.filename || '').toLowerCase();
    if (!filename.includes('github-cache')) return '';
    const slugMatch = filename.match(/github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i);
    if (!slugMatch) return '';
    const cloneName = slugMatch[1];
    const sourceRoot = String(
        options.projectPath
        || options.requestedProjectPath
        || report.projectRoot
        || report.platformRoot
        || ''
    ).replace(/\\/g, '/');
    if (isBenchmarkScanTargetRoot(sourceRoot)) return '';
    const platformRoot = resolveProductPlatformRoot(sourceRoot) || sourceRoot;
    return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}

function resolveCodebaseExportContext(report, options = {}) {
    const inferredTarget = inferCodebaseScanTargetFromHints(report, options);
    const projectRoot = normalizeExportPath(report?.projectRoot || report?.projectPath || '');
    const scanTargetRoot = normalizeExportPath(
        options.scanTargetRoot
        || options.requestedProjectPath
        || report?.scanTargetRoot
        || report?.requestedScanRoot
        || inferredTarget
        || ''
    );
    const benchmarkFromRoot = isBenchmarkScanTargetRoot(projectRoot);
    const benchmarkFromTarget = isBenchmarkScanTargetRoot(scanTargetRoot);
    const productPlatformRoot = benchmarkFromRoot || benchmarkFromTarget
        ? resolveProductPlatformRoot(benchmarkFromRoot ? projectRoot : scanTargetRoot)
        : null;
    const misscopedPlatformWalk = benchmarkFromTarget
        && !benchmarkFromRoot
        && Boolean(productPlatformRoot)
        && projectRoot.toLowerCase() === productPlatformRoot.toLowerCase();

    return {
        benchmarkScan: benchmarkFromRoot || benchmarkFromTarget,
        scanTargetRoot: scanTargetRoot || (benchmarkFromRoot ? projectRoot : ''),
        productPlatformRoot,
        misscopedPlatformWalk
    };
}

function isBenchmarkCodebaseReport(report, options = {}) {
    return resolveCodebaseExportContext(report, options).benchmarkScan;
}

function isKnownCodebaseFalsePositive(finding) {
    if (!finding || typeof finding !== 'object') return false;
    const filePath = String(finding.filePath || '').replace(/\\/g, '/');
    if (filePath === 'pdf-export.html' && finding.type === 'placeholder-token') return true;
    if (finding.type === 'placeholder-token' && /\bplaceholder\s+patterns\b/i.test(String(finding.match || ''))) {
        return /\bfiction\b/i.test(String(finding.description || finding.match || ''));
    }
    if (finding.type === 'placeholder-token' && /^README\.md$/i.test(filePath)) return true;
    if (finding.category === 'tech-debt' && /liability-metrics\.js$/i.test(filePath)) return true;
    if (finding.category === 'tech-debt' && finding.type === 'todo' && String(finding.match || '').toLowerCase().includes('implement')) {
        return true;
    }
    // Skip variable-name TODOs (e.g., todoCount, todoFiles) and string-literal TODOs in scanner UI
    if (finding.category === 'tech-debt') {
        const match = String(finding.match || '').toLowerCase();
        const desc = String(finding.description || '').toLowerCase();
        if (/\b(todoCount|todoFiles|todoMarkers|baseTodoCount|totalTodos|todoDensity|todoSeverity|rm\.todoCount|rm\.todoFiles|markerBreakdown)\b/i.test(desc)) {
            return true;
        }
        if (/\b(todoCount|todoFiles|todoMarkers|baseTodoCount|totalTodos|todoDensity|todoSeverity|todoCommentPattern|fileMarkers|hasRealTodo|todoMarkerCounts)\b/i.test(match)) {
            return true;
        }
    }
    return false;
}

function recomputeSummaryFromFindings(report, findings) {
    const severityCounts = { high: 0, medium: 0, low: 0 };
    const tierCounts = { production: 0, documentation: 0, general: 0 };
    const categoryCounts = {};

    for (const finding of findings) {
        const sev = finding.severity || 'low';
        if (severityCounts[sev] != null) severityCounts[sev] += 1;
        const tier = finding.tier || 'general';
        if (tierCounts[tier] != null) tierCounts[tier] += 1;
        const cat = finding.category || 'unknown';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    const codeFilesAnalyzed = report.summary?.codeFilesAnalyzed ?? 0;
    const rawHealthScore = findings.length === 0
        ? 100
        : Math.max(0, Math.round(100 - (
            severityCounts.high * 8
            + severityCounts.medium * 3
            + severityCounts.low * 0.5
        ) / Math.max(codeFilesAnalyzed, 1) * 100));
    const healthScore = Math.min(rawHealthScore, 100);

    return {
        ...report.summary,
        findingsTotal: findings.length,
        findingsReturned: Math.min(findings.length, report.summary?.findingsReturned ?? findings.length),
        healthScore: findings.length ? Math.min(healthScore, report.summary?.healthScore ?? healthScore) : 100,
        severityCounts,
        tierCounts,
        categoryCounts,
        analyzerCounts: {
            debugArtifacts: findings.filter((f) => f.category === 'debug-artifact').length,
            placeholderOrFictionalData: findings.filter((f) => f.category === 'meaningless-data').length,
            eslintFindings: findings.filter((f) => f.category === 'eslint').length
        }
    };
}

function aggregateCategoriesFromFindings(findings) {
    const byCategory = new Map();
    for (const finding of findings) {
        const cat = finding.category || 'unknown';
        const bucket = byCategory.get(cat) || {
            category: cat,
            count: 0,
            severity: finding.severity || 'low',
            fileCount: 0,
            topFiles: []
        };
        bucket.count += 1;
        const fp = finding.filePath;
        if (fp && !bucket.topFiles.includes(fp)) bucket.topFiles.push(fp);
        byCategory.set(cat, bucket);
    }
    return [...byCategory.values()].map((entry) => ({
        ...entry,
        fileCount: entry.topFiles.length,
        topFiles: entry.topFiles.slice(0, 8)
    }));
}

function filterKnownFalsePositiveFindings(report) {
    const original = report.findings || [];
    const findings = original.filter((f) => !isKnownCodebaseFalsePositive(f));
    if (findings.length === original.length) return report;

    const removed = original.length - findings.length;
    const next = {
        ...report,
        findings,
        categories: aggregateCategoriesFromFindings(findings),
        summary: recomputeSummaryFromFindings(report, findings)
    };
    if (findings.length === 0) {
        next.exportNotes = [
            ...(next.exportNotes || []),
            removed === 1
                ? 'Removed 1 known false positive (scanner meta-reference or product README wording).'
                : `Removed ${removed} known false positives (scanner meta-references and product README wording).`
        ];
    }
    return next;
}

function dedupeCodebaseExportNotes(notes = []) {
    const seen = new Set();
    const out = [];
    for (const note of notes) {
        const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();
        let scopeKey = normalized;
        if (/benchmark clone codebase export/i.test(normalized)) {
            scopeKey = 'benchmark-codebase-scope-note';
        } else if (/mis-scoped complete-scan export/i.test(normalized)) {
            scopeKey = 'benchmark-misscope-note';
        } else if (/eslint style-tier warnings only/i.test(normalized)) {
            scopeKey = 'eslint-style-note';
        } else if (/jest was not run during the paired gate/i.test(normalized)) {
            scopeKey = 'jest-gate-note';
        } else if (/eslint/i.test(normalized)) {
            scopeKey = 'eslint-note';
        } else if (/code-like file\(s\) deep-scanned/i.test(normalized)) {
            scopeKey = 'code-files-scope-note';
        }
        if (seen.has(scopeKey)) continue;
        seen.add(scopeKey);
        out.push(String(note));
    }
    return out.slice(0, 10);
}

function dedupeLimitationNotes(lines = []) {
    const seen = new Set();
    const out = [];
    for (const line of lines) {
        const normalized = String(line).replace(/\s+/g, ' ').trim().toLowerCase();
        const scopeKey = /^oss benchmark clone under github-cache/i.test(normalized)
            ? 'benchmark-scope'
            : /eslint (not run|did not run)/i.test(normalized)
                ? 'eslint-skipped'
                : normalized;
        if (seen.has(scopeKey)) continue;
        seen.add(scopeKey);
        out.push(String(line));
    }
    return out.slice(0, 12);
}

function redactCodebasePathForExport(value, options = {}) {
    if (value == null || value === '') return '';
    const normalized = normalizeExportPath(value);
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

function redactCodebaseAiSummary(text, projectLabel = 'ai-platform') {
    if (!text) return text;
    let out = String(text);
    out = out.replace(/[A-Za-z]:[\\/][^\s`'".,)\]]+/g, (match) => {
        const normalized = match.replace(/\\/g, '/');
        if (normalized.toLowerCase().includes('github-cache')) {
            const idx = normalized.toLowerCase().indexOf('github-cache');
            return `${projectLabel}/${normalized.slice(idx)}`;
        }
        return projectLabel;
    });
    out = out.replace(/\/Users\/[^\s`'".,)\]]+/g, projectLabel);
    out = out.replace(/\/home\/[^\s`'".,)\]]+/g, projectLabel);
    out = out.replace(/CascadeProjects\/[^\s`'".,)\]]+/gi, projectLabel);
    return out;
}

function normalizeCodebaseExportPaths(report, scanTargetRoot = '', options = {}) {
    const rawRoot = scanTargetRoot || report.projectRoot || report.scanTargetRoot || report.requestedScanRoot || '';
    const projectLabel = projectLabelFromPath(
        options.productPlatformRoot || resolveProductPlatformRoot(rawRoot) || rawRoot
    );
    const pathOptions = {
        projectLabel,
        productPlatformLabel: projectLabel,
        benchmarkScan: options.benchmarkScan
    };
    const redactedRoot = redactCodebasePathForExport(rawRoot, pathOptions);
    return {
        ...report,
        projectRoot: redactCodebasePathForExport(report.projectRoot || rawRoot, pathOptions) || redactedRoot,
        ...(report.scanTargetRoot || redactedRoot
            ? { scanTargetRoot: redactCodebasePathForExport(report.scanTargetRoot || rawRoot, pathOptions) || redactedRoot }
            : {}),
        ...(report.requestedScanRoot
            ? { requestedScanRoot: redactCodebasePathForExport(report.requestedScanRoot, pathOptions) }
            : {}),
        ...(report.platformRoot
            ? { platformRoot: redactCodebasePathForExport(report.platformRoot, pathOptions) }
            : {}),
        ...(report.codeAnalysisRoot
            ? { codeAnalysisRoot: redactCodebasePathForExport(report.codeAnalysisRoot, pathOptions) }
            : {}),
        ...(report.productPlatformRoot
            ? { productPlatformRoot: redactCodebasePathForExport(report.productPlatformRoot, pathOptions) }
            : {}),
        ...(report.repositoryInventory
            ? {
                repositoryInventory: {
                    ...report.repositoryInventory,
                    projectRoot: redactCodebasePathForExport(
                        report.repositoryInventory.projectRoot || rawRoot,
                        pathOptions
                    ) || redactedRoot
                }
            }
            : {})
    };
}

function resolveBenchmarkCodebaseTitle(misscopedPlatformWalk) {
    return misscopedPlatformWalk
        ? 'Codebase Analysis — mis-scoped platform walk (benchmark target)'
        : 'OSS Clone Codebase Hygiene (github-cache benchmark)';
}

function replaceMisleadingCodebaseLimitations(limitations = [], context) {
    const canonicalBenchmark = 'OSS benchmark clone under github-cache/ — codebase hygiene comparison only, not Simplebeacon platform production certification.';
    const canonicalEslint = 'ESLint did not run — Simplebeacon ESLint targets (server/, packages/, web/) are not present in this OSS clone root.';

    const filtered = limitations.filter((line) => {
        if (!context.benchmarkScan) return true;
        const text = String(line);
        if (/ESLint ran on server, packages/i.test(text)) return false;
        if (/under the platform root when available/i.test(text)) return false;
        if (/^OSS benchmark clone under github-cache/i.test(text)) return false;
        if (/ESLint (not run|did not run)/i.test(text)) return false;
        return true;
    });

    if (context.benchmarkScan) {
        filtered.unshift(canonicalBenchmark);
        if (context.eslintSource === 'none') {
            filtered.push(canonicalEslint);
        }
    }

    if (!context.benchmarkScan && context.eslintSkipped) {
        filtered.push(`ESLint note: ${context.eslintSkipped}`);
    }

    return dedupeLimitationNotes(filtered);
}

function buildTierCountsExport(summary, benchmarkScan) {
    const tierCounts = summary?.tierCounts;
    if (!tierCounts || !benchmarkScan) return undefined;
    return {
        mergeRiskHeuristic: tierCounts.production ?? 0,
        documentation: tierCounts.documentation ?? 0,
        general: tierCounts.general ?? 0,
        note: '“production” tier is a path heuristic (e.g. paths containing /src/) within the OSS clone — not Simplebeacon ai-platform production code.'
    };
}

function resolveCodebaseHealthStatus(summary) {
    const total = summary?.findingsTotal ?? 0;
    const high = summary?.severityCounts?.high ?? 0;
    const medium = summary?.severityCounts?.medium ?? 0;
    if (high > 0) return 'needs-attention';
    if (medium > 0) return 'healthy-with-findings';
    if (total > 0) return 'clean-low-noise';
    return 'clean';
}

function resolveGateInventoryContext(report, options = {}) {
    const gateReport = options.gateReport || {};
    const repositoryFilesTotal = options.repositoryFilesTotal
        ?? options.gateRepositoryFilesTotal
        ?? gateReport.repositoryFilesTotal
        ?? gateReport.repositoryInventory?.totalFiles
        ?? report.hygieneSummary?.gateRepositoryFilesTotal
        ?? null;
    const credentialScanned = gateReport.credentialScanned
        ?? gateReport.productionLeakScanned
        ?? gateReport.scanScope?.productionDirsScanned
        ?? report.hygieneSummary?.credentialScanned
        ?? null;
    const contentScanned = gateReport.scanScope?.fullDirectoryStats?.contentScanned
        ?? gateReport.scanScope?.fullDirectoryStats?.filesContentScanned
        ?? gateReport.credentialScanned
        ?? report.hygieneSummary?.contentFilesScanned
        ?? null;
    const gateProfile = gateReport.scanScope?.profile
        ?? report.scanScope?.gateRuleBundleProfile
        ?? report.hygieneSummary?.gateRuleBundleProfile
        ?? null;
    return {
        gateReport,
        repositoryFilesTotal,
        credentialScanned,
        contentScanned,
        gateProfile,
        fictionJsonFilesScanned: gateReport.fictionJsonFilesScanned
            ?? gateReport.scanScope?.fictionJsonFilesScanned
            ?? report.hygieneSummary?.fictionJsonFilesScanned
            ?? null,
        fictionSampleFilesScanned: gateReport.fictionSampleFilesScanned
            ?? gateReport.mockSampleFiles
            ?? gateReport.scanScope?.fictionSampleFilesScanned
            ?? report.hygieneSummary?.fictionSampleFilesScanned
            ?? null
    };
}

function buildProductCodebaseExportNotes(report, context = {}) {
    const notes = [
        'securityHandoffEligible is false — codebase hygiene is supplementary, not vendor security handoff.',
        'Absolute scan paths are redacted to project label in operator exports.'
    ];
    const eslintSource = report.summary?.eslintSource || report.eslintSummary?.source || 'none';
    if (eslintSource === 'none' && report.summary?.eslintSkipped) {
        notes.push(`ESLint was not executed: ${report.summary.eslintSkipped}`);
    } else if (eslintSource === 'command') {
        notes.push(`ESLint ran on platform targets (${report.summary?.eslintErrors ?? 0} errors, ${report.summary?.eslintWarnings ?? 0} warnings).`);
    }
    const codeFiles = report.summary?.codeFilesAnalyzed;
    const auditFiles = report.repositoryInventory?.totalFiles ?? report.summary?.repositoryFilesTotal;
    if (codeFiles != null && auditFiles != null && auditFiles > codeFiles) {
        notes.push(
            `${Number(codeFiles).toLocaleString()} code-like file(s) deep-scanned — audit inventory (${Number(auditFiles).toLocaleString()} paths) includes non-code assets and metadata.`
        );
    }
    if ((report.summary?.findingsTotal ?? 0) === 0) {
        notes.push('No actionable codebase findings in this export — hygiene score reflects analyzed source paths only.');
    }
    const gateContext = resolveGateInventoryContext(report, context);
    const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile, gateReport, fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    if (gateTotal != null && auditFiles != null && gateTotal !== auditFiles) {
        const profile = report.repositoryInventory?.profile || 'audit';
        notes.push(
            `repositoryInventory.totalFiles (${Number(auditFiles).toLocaleString()}, ${profile} profile) — gate full-tree inventory is ${Number(gateTotal).toLocaleString()} paths.`
        );
    }
    if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
        notes.push(
            `CRED/LEAK rules scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} metadata-only path(s) in gate inventory of ${Number(gateTotal).toLocaleString()}.`
        );
    }
    if (fictionJsonFilesScanned != null && fictionSampleFilesScanned != null && fictionJsonFilesScanned > fictionSampleFilesScanned) {
        notes.push(
            `DATA-002 evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) — ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched in paired gate scan.`
        );
    }
    if (gateProfile) {
        notes.push(`Gate rule bundle profile: ${gateProfile} — pair codebase report with json/simplebeacon-gate.json for handoff evidence.`);
    }
    if (gateReport.jestBaselineChecked === false || report.hygieneSummary?.jestBaselineChecked === false) {
        notes.push(
            'Jest was not run during the paired gate scan — codebase unused-file heuristics are static/ESLint only.'
        );
    }
    const medium = report.summary?.severityCounts?.medium ?? 0;
    const high = report.summary?.severityCounts?.high ?? 0;
    const eslintFindings = report.summary?.categoryCounts?.eslint ?? 0;
    if (medium > 0 && eslintFindings === medium && high === 0) {
        notes.push(
            `${medium} medium-severity finding(s) are ESLint style-tier warnings only — no high-severity merge-risk issues.`
        );
    }
    const mirrorSamples = (report.structureInsights?.samples || [])
        .filter((s) => String(s.filePath || '').startsWith('.github-sync/')).length;
    if (mirrorSamples > 0) {
        notes.push(
            `Structure samples include ${mirrorSamples} path(s) under .github-sync/ — mirror tree, not primary product source.`
        );
    }
    if (report.aiSummaryProvider) {
        notes.push(`AI narrative (${report.aiSummaryProvider}) is supplementary — use findings and summary for handoff.`);
    }
    return [...new Set(notes)].slice(0, 10);
}

function buildProductCodebaseHygieneSummary(report, options = {}) {
    const summary = report.summary || {};
    const gateContext = resolveGateInventoryContext(report, options);
    const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile, gateReport } = gateContext;
    const auditFiles = report.repositoryInventory?.totalFiles ?? summary.repositoryFilesTotal ?? null;
    const codeFiles = summary.codeFilesAnalyzed ?? null;
    return {
        healthScore: summary.healthScore ?? null,
        findingsTotal: summary.findingsTotal ?? 0,
        codeFilesAnalyzed: codeFiles,
        repositoryFilesTotal: auditFiles,
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(codeFiles != null && auditFiles != null && auditFiles > codeFiles
            ? { nonCodeInventoryFiles: auditFiles - codeFiles }
            : {}),
        ...(credentialScanned != null ? { credentialScanned } : {}),
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        ...(gateTotal != null && contentScanned != null && gateTotal > contentScanned
            ? { gateMetadataOnlyFiles: gateTotal - contentScanned }
            : {}),
        ...(gateContext.fictionJsonFilesScanned != null
            ? { fictionJsonFilesScanned: gateContext.fictionJsonFilesScanned }
            : {}),
        ...(gateContext.fictionSampleFilesScanned != null
            ? { fictionSampleFilesScanned: gateContext.fictionSampleFilesScanned }
            : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        eslintSource: summary.eslintSource || report.eslintSummary?.source || 'none',
        eslintWarnings: summary.eslintWarnings ?? report.eslintSummary?.warnings ?? null,
        mediumSeverityFindings: summary.severityCounts?.medium ?? 0,
        highSeverityFindings: summary.severityCounts?.high ?? 0,
        ...(gateReport.jestBaselineChecked === false || report.hygieneSummary?.jestBaselineChecked === false
            ? { jestBaselineChecked: false }
            : {}),
        attestationNote: 'Codebase hygiene scan — not a Simplebeacon gate pass or legal conformity certification.'
    };
}

function enrichProductCodebaseScanScope(report, options = {}) {
    const gateContext = resolveGateInventoryContext(report, options);
    const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
    const base = report.scanScope || {};
    return {
        ...base,
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        resultsViewScope: base.resultsViewScope || 'platform-only',
        reportHealth: base.reportHealth || 'platform-scoped',
        securityHandoffEligible: false
    };
}

function annotateStructureInsights(structureInsights) {
    if (!structureInsights?.samples?.length) return structureInsights;
    const mirrorCount = structureInsights.samples.filter((s) => String(s.filePath || '').startsWith('.github-sync/')).length;
    const langs = structureInsights.summary?.byLanguage || {};
    const langKeys = Object.keys(langs);
    const docHeavy = langKeys.length > 0 && langKeys.every((k) => /markdown|yaml|text|md/i.test(k));
    const summaryExtras = {};
    if (mirrorCount) {
        summaryExtras.mirrorTreeSamples = mirrorCount;
        summaryExtras.mirrorTreeNote = 'Samples may include .github-sync/ CLI mirror paths — not primary ai-platform application source.';
    }
    if (docHeavy && structureInsights.summary?.tier === 'baseline') {
        const sampled = structureInsights.summary?.sampledFiles ?? structureInsights.samples.length;
        summaryExtras.structureSampleNote = `Tier-1 structure hints sampled ${sampled} file(s) — baseline profile is doc-heavy; regex estimates are not AST analysis of application code.`;
    }
    if (!Object.keys(summaryExtras).length) return structureInsights;
    return {
        ...structureInsights,
        summary: {
            ...(structureInsights.summary || {}),
            ...summaryExtras
        }
    };
}

/**
 * @param {object} report codebase-analyzer-report
 * @param {object} [options]
 * @param {string} [options.requestedProjectPath] user-selected scan target (e.g. complete-scan clone path)
 * @param {string} [options.scanTargetRoot] alias for requestedProjectPath
 * @returns {object}
 */
function sanitizeCodebaseReportExport(report, options = {}) {
    if (!report || report.type !== 'codebase-analyzer-report') return report;

    let next = { ...filterKnownFalsePositiveFindings(report) };

    const exportContext = resolveCodebaseExportContext(next, options);
    const {
        benchmarkScan,
        scanTargetRoot,
        productPlatformRoot,
        misscopedPlatformWalk
    } = exportContext;

    next = normalizeCodebaseExportPaths(next, scanTargetRoot || next.projectRoot, {
        benchmarkScan,
        productPlatformRoot
    });

    const projectLabel = projectLabelFromPath(productPlatformRoot || next.projectRoot || 'ai-platform');
    if (next.aiSummary) {
        next.aiSummary = redactCodebaseAiSummary(next.aiSummary, projectLabel);
    }

    const eslintSource = next.summary?.eslintSource || next.eslintSummary?.source || 'none';
    const eslintSkipped = next.summary?.eslintSkipped || null;

    const context = { benchmarkScan, eslintSource, eslintSkipped };

    if (benchmarkScan) {
        next = {
            ...next,
            title: resolveBenchmarkCodebaseTitle(misscopedPlatformWalk),
            scanTargetProfile: 'benchmark-cache',
            handoffEligible: false,
            benchmarkScan: true,
            scanTargetRoot: scanTargetRoot || next.projectRoot || undefined,
            productPlatformRoot: productPlatformRoot || undefined,
            inventoryScope: misscopedPlatformWalk ? 'platform-walk-from-benchmark-target' : 'oss-clone',
            ...(misscopedPlatformWalk ? {
                misscopedPlatformCodeWalk: true,
                codeAnalysisRoot: next.codeAnalysisRoot || next.projectRoot,
                platformRoot: next.platformRoot || productPlatformRoot || next.projectRoot
            } : {})
        };
        if (next.summary) {
            next.summary = {
                ...next.summary,
                codebaseHealthAttestation: misscopedPlatformWalk ? 'benchmark-target-platform-walk' : 'benchmark-hygiene',
                handoffEligible: false,
                tierCountsExport: buildTierCountsExport(next.summary, true)
            };
        }
    }

    if (next.scanScope) {
        const limitations = replaceMisleadingCodebaseLimitations(next.scanScope.limitations, context);
        next.scanScope = {
            ...next.scanScope,
            ...(benchmarkScan ? {
                resultsViewScope: 'benchmark-clone',
                reportHealth: 'benchmark-clone-scan',
                benchmarkScanTarget: true
            } : {
                resultsViewScope: 'platform-only',
                reportHealth: 'platform-scoped'
            }),
            limitations
        };
    }

    if (next.structureInsights) {
        next.structureInsights = annotateStructureInsights(next.structureInsights);
    }

    if (benchmarkScan) {
        const benchmarkNotes = [
            ...(next.exportNotes || []),
            misscopedPlatformWalk
                ? 'Mis-scoped complete-scan export: codebase walked Simplebeacon platform root while scan target was github-cache/ clone — re-run complete scan after updating Simplebeacon for clone-scoped hygiene.'
                : 'Benchmark clone codebase export — not valid for Simplebeacon platform deploy handoff. Run codebase analysis on ai-platform root for product hygiene scoring.'
        ];
        next.exportNotes = dedupeCodebaseExportNotes(benchmarkNotes);
        if (next.aiSummary && !/benchmark|OSS clone|mis-scoped/i.test(String(next.aiSummary))) {
            next.aiSummary = misscopedPlatformWalk
                ? `[Benchmark target — platform walk mis-scope] ${next.aiSummary}`
                : `[Benchmark clone — hygiene only] ${next.aiSummary}`;
        }
        next = {
            ...next,
            exportNormalized: true,
            exportSanitized: true,
            securityHandoffEligible: false,
            codebaseHealthStatus: misscopedPlatformWalk ? 'benchmark-misscoped-review' : resolveCodebaseHealthStatus(next.summary),
            hygieneSummary: {
                healthScore: next.summary?.healthScore ?? null,
                findingsTotal: next.summary?.findingsTotal ?? 0,
                codeFilesAnalyzed: next.summary?.codeFilesAnalyzed ?? null,
                repositoryFilesTotal: next.summary?.repositoryFilesTotal
                    ?? next.repositoryInventory?.totalFiles
                    ?? null,
                eslintSource,
                scanTargetRoot: scanTargetRoot
                    ? redactCodebasePathForExport(scanTargetRoot, {
                        projectLabel,
                        productPlatformLabel: projectLabel,
                        benchmarkScan: true
                    })
                    : next.projectRoot || undefined,
                misscopedPlatformCodeWalk: misscopedPlatformWalk || undefined,
                attestationNote: misscopedPlatformWalk
                    ? 'Scan target was an OSS github-cache/ clone but codebase analysis walked the Simplebeacon platform tree — not valid benchmark hygiene or product handoff evidence.'
                    : 'OSS benchmark clone — codebase hygiene comparison only; not a platform gate pass or deploy handoff certification.'
            }
        };
    } else {
        const builtNotes = buildProductCodebaseExportNotes(next, {
            repositoryFilesTotal: options.repositoryFilesTotal ?? null,
            gateRepositoryFilesTotal: options.repositoryFilesTotal ?? null,
            gateReport: options.gateReport || null
        });
        const falsePositiveNotes = (next.exportNotes || []).filter((n) => /false positive/i.test(String(n)));
        next = {
            ...next,
            exportNormalized: true,
            exportSanitized: true,
            scanTargetProfile: 'product',
            securityHandoffEligible: false,
            handoffEligible: false,
            codebaseHealthStatus: resolveCodebaseHealthStatus(next.summary),
            exportNotes: dedupeCodebaseExportNotes([...builtNotes, ...falsePositiveNotes]).slice(0, 10),
            inventoryScope: 'platform-product',
            hygieneSummary: buildProductCodebaseHygieneSummary(next, options),
            scanScope: enrichProductCodebaseScanScope(next, options)
        };
    }

    return next;
}

module.exports = {
    sanitizeCodebaseReportExport,
    isBenchmarkCodebaseReport,
    resolveCodebaseExportContext,
    inferCodebaseScanTargetFromHints,
    isKnownCodebaseFalsePositive,
    resolveProductPlatformRoot,
    dedupeLimitationNotes,
    dedupeCodebaseExportNotes
};
