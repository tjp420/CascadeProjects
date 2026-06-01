/**
 * Sanitize data-cleanup-report exports (data-quality and file-reduction profiles).
 */

const { isBenchmarkScanTargetRoot, isExternalBenchmarkCachePath } = require('./benchmark-cache-paths');
const { normalizeDuplicateGroupForBrief } = require('./cleanup-brief-export-sanitize');
const { aggregateCleanupFindings } = require('./result-aggregator');
const { normalizeFileReductionReport } = require('./normalize-file-reduction-report');
const { redactProjectPathForExport, projectLabelFromPath } = require('./assessment-export-sanitize');
const { shouldSkipDataAccessScan } = require('../analyzers/data-cleanup/data-access-pattern-analyzer');
const { isPlannedEnvKey } = require('../analyzers/data-cleanup/utils/env-profile-utils');
const { shouldSkipRuntimeLogFile } = require('../analyzers/file-reduction/build-artifact-scanner');

function resolveProductPlatformRoot(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('/github-cache/');
    if (idx <= 0) return null;
    return normalized.slice(0, idx);
}

function isBenchmarkReport(report) {
    const root = report?.projectRoot || report?.projectPath || '';
    const norm = String(root).replace(/\\/g, '/');
    return isBenchmarkScanTargetRoot(norm) || isExternalBenchmarkCachePath(norm);
}

function isRuntimeLogFinding(finding) {
    if (!finding || typeof finding !== 'object') return false;
    return shouldSkipRuntimeLogFile(finding.path || finding.filePath);
}

function stripRuntimeLogFindings(report) {
    if (!report?.findings) return report;

    const nextFindings = {};
    for (const [key, list] of Object.entries(report.findings)) {
        nextFindings[key] = Array.isArray(list) ? list.filter((finding) => !isRuntimeLogFinding(finding)) : list;
    }

    const nextAllFindings = Array.isArray(report.allFindings)
        ? report.allFindings.filter((finding) => !isRuntimeLogFinding(finding))
        : report.allFindings;

    if (nextAllFindings === report.allFindings && nextFindings.buildArtifacts === report.findings.buildArtifacts) {
        return report;
    }

    let next = {
        ...report,
        findings: nextFindings,
        allFindings: nextAllFindings
    };
    next = reaggregateAfterRepair(next);
    if (next.summary) {
        next.summary = {
            ...next.summary,
            totalFindings: nextAllFindings?.length ?? next.summary.totalFindings,
            buildArtifactFindings: nextFindings.buildArtifacts?.length ?? next.summary.buildArtifactFindings
        };
    }
    if (next.scanners?.['build-artifacts']) {
        const buildSummary = next.scanners['build-artifacts'];
        const reviewBytes = (nextFindings.buildArtifacts || [])
            .filter((finding) => finding.action === 'review-before-delete')
            .reduce((sum, finding) => sum + (finding.sizeBytes || 0), 0);
        next.scanners = {
            ...next.scanners,
            'build-artifacts': {
                ...buildSummary,
                artifactFiles: (nextFindings.buildArtifacts || []).filter(
                    (finding) => finding.action === 'review-before-delete'
                ).length,
                reviewBeforeDeleteBytes: reviewBytes,
                reclaimableBytes: (nextFindings.buildArtifacts || [])
                    .reduce((sum, finding) => sum + (finding.sizeBytes || 0), 0)
            }
        };
    }
    return next;
}

function replaceMisleadingDataQualityNotes(notes = [], benchmarkScan) {
    const filtered = notes.filter((note) => {
        if (!benchmarkScan) return true;
        return !/exclude(s)?\s+github-cache/i.test(String(note))
            && !/production paths first/i.test(String(note));
    });
    if (benchmarkScan) {
        filtered.unshift(
            'OSS benchmark clone — workspace scanners (package.json, npm deps, .env) expect Simplebeacon product layout; zero counts are normal for C++/Python OSS trees.'
        );
    }
    return [...new Set(filtered)].slice(0, 10);
}

function sanitizeExecutiveSummaryForExport(executiveSummary, context) {
    if (!executiveSummary || typeof executiveSummary !== 'object') return executiveSummary;
    const next = {
        ...executiveSummary,
        notes: replaceMisleadingDataQualityNotes(executiveSummary.notes, context.benchmarkScan)
    };
    if (context.benchmarkScan && context.profile === 'data-quality') {
        const ws = next.workspace || {};
        if (!ws.packageJsonFiles && !next.priorityActions?.length) {
            next.priorityActions = [{
                priority: 'low',
                title: 'No workspace package manifests',
                detail: 'This OSS clone has no root package.json — dependency and env scanners did not run. Compare against ai-platform for product workspace health.'
            }];
        } else if ((ws.missingEnvKeys || 0) > 0 || (next.data?.syncIoPatterns || 0) > 0) {
            next.priorityActions = sanitizeBenchmarkExecutivePriorityActions(next);
        }
        next.workspace = {
            ...ws,
            benchmarkWorkspaceNote: ws.packageJsonFiles
                ? undefined
                : 'Zero package.json in workspace scope — expected for google-earthenterprise and similar OSS clones.'
        };
    }
    return next;
}

function sanitizeScannerStatisticsForExport(stats, context) {
    if (!stats || typeof stats !== 'object') return stats;
    if (!context.benchmarkScan) return stats;
    const scopeNote = context.profile === 'file-reduction'
        ? 'File-reduction scanners ran on the OSS clone tree — compare hygiene only, not Simplebeacon platform cleanup.'
        : 'Data-quality workspace scanners target npm/package.json layout — not applicable to this OSS clone root.';
    return {
        ...stats,
        scope: 'benchmark-clone',
        scopeNote
    };
}

function sanitizeBenchmarkExecutivePriorityActions(executiveSummary = {}) {
    const ws = executiveSummary.workspace || {};
    const missing = ws.missingEnvKeys ?? 0;
    const syncIo = executiveSummary.data?.syncIoPatterns ?? 0;
    const actions = (executiveSummary.priorityActions || [])
        .map((action) => {
            const title = String(action.title || '');
            if (/missing environment keys|optional CLI environment keys/i.test(title)) {
                if (!missing) return null;
                return {
                    priority: 'low',
                    title: 'Optional CLI environment keys',
                    detail: `${missing} optional runtime key(s) — SIMPLEBEACON_* / OPENAI_*; document in .env.example for OSS clone hygiene only.`
                };
            }
            if (/sync I\/O|CLI scanner sync I\/O/i.test(title)) {
                if (!syncIo) return null;
                return {
                    priority: 'low',
                    title: 'CLI scanner sync I/O (informational)',
                    detail: `${syncIo} sync read pattern(s) in CLI/MCP infrastructure — intentional for offline batch scans, not platform runtime hot paths.`
                };
            }
            return action;
        })
        .filter(Boolean);
    return actions;
}

function isBenchmarkFalsePositiveFinding(finding) {
    if (!finding || typeof finding !== 'object') return false;
    if (finding.type === 'missing-env-key') {
        const key = finding.metadata?.key;
        return Boolean(key && isPlannedEnvKey(key));
    }
    if (finding.type === 'data-access-pattern') {
        return shouldSkipDataAccessScan(finding.path);
    }
    return false;
}

function filterBenchmarkDataQualityFindings(findings = []) {
    return findings.filter((finding) => !isBenchmarkFalsePositiveFinding(finding));
}

function patchScannerMissingKeys(scanners = {}, missingCount) {
    if (!scanners['environment-variables']) return scanners;
    return {
        ...scanners,
        'environment-variables': {
            ...scanners['environment-variables'],
            missingKeys: missingCount
        }
    };
}

function patchScannerStatisticsEnv(stats, missingCount) {
    if (!stats?.scanners?.['environment-variables']) return stats;
    const envStats = stats.scanners['environment-variables'];
    return {
        ...stats,
        scanners: {
            ...stats.scanners,
            'environment-variables': {
                ...envStats,
                stats: {
                    ...envStats.stats,
                    missingKeys: missingCount
                },
                findings: {
                    ...envStats.findings,
                    total: missingCount,
                    missingKeys: missingCount
                }
            }
        },
        findingsBreakdown: {
            ...stats.findingsBreakdown,
            environmentVariables: {
                ...(stats.findingsBreakdown?.environmentVariables || {}),
                total: missingCount,
                missingKeys: missingCount
            }
        }
    };
}

function rebuildBenchmarkDataQualityCounts(report, filteredFindings) {
    const aggregated = aggregateCleanupFindings(filteredFindings);
    const envFindings = filteredFindings.filter((f) => f.type === 'missing-env-key');
    const accessFindings = filteredFindings.filter((f) => f.type === 'data-access-pattern');
    const totalFindings = filteredFindings.length;
    const inventoryFiles = report.inventory?.totalFiles || 0;

    const summary = {
        ...(report.summary || {}),
        totalFindings,
        environmentFindings: envFindings.length,
        dataAccessFindings: accessFindings.length,
        estimatedReductionPct: inventoryFiles > 0
            ? Math.round((totalFindings / inventoryFiles) * 1000) / 10
            : (report.summary?.estimatedReductionPct ?? 0)
    };

    const executiveSummary = report.executiveSummary
        ? {
            ...report.executiveSummary,
            workspace: {
                ...(report.executiveSummary.workspace || {}),
                missingEnvKeys: envFindings.length
            },
            data: {
                ...(report.executiveSummary.data || {}),
                syncIoPatterns: accessFindings.length
            },
            priorityActions: sanitizeBenchmarkExecutivePriorityActions({
                ...report.executiveSummary,
                workspace: {
                    ...(report.executiveSummary.workspace || {}),
                    missingEnvKeys: envFindings.length
                },
                data: {
                    ...(report.executiveSummary.data || {}),
                    syncIoPatterns: accessFindings.length
                }
            }),
            notes: replaceMisleadingDataQualityNotes(report.executiveSummary.notes, true),
            exportProfile: 'data-quality',
            remediationHint: totalFindings > 0
                ? 'Benchmark clone hygiene only — optional CLI env keys and scanner sync I/O are not platform handoff blockers.'
                : 'No actionable data-quality findings on this OSS benchmark clone — run data-quality on ai-platform root for product workspace health.',
            benchmarkDataQualityNote: totalFindings === 0
                ? 'Clean OSS CLI clone — SIMPLEBEACON_* / OPENAI_* keys are optional; MCP offline scan does not require .env.'
                : undefined
        }
        : report.executiveSummary;

    return {
        summary,
        aggregation: {
            bySeverity: {
                critical: aggregated.bySeverity.critical.length,
                high: aggregated.bySeverity.high.length,
                medium: aggregated.bySeverity.medium.length,
                low: aggregated.bySeverity.low.length
            },
            byCategory: aggregated.byCategory,
            topFiles: aggregated.topFiles.filter((entry) => entry.filePath !== 'unknown')
        },
        executiveSummary,
        scanners: patchScannerMissingKeys(report.scanners, envFindings.length)
    };
}

function sanitizeBenchmarkDataQualityExport(report) {
    if (report.scanProfile !== 'data-quality') {
        return {
            exportNormalized: true,
            dataQualityStatus: resolveDataQualityStatus(report)
        };
    }

    const findingBuckets = report.findings || {};
    const flatFindings = Object.values(findingBuckets).flat().filter(Boolean);
    const filtered = filterBenchmarkDataQualityFindings(flatFindings);
    const rebuilt = rebuildBenchmarkDataQualityCounts(report, filtered);

    const filteredByBucket = {
        ...findingBuckets,
        environmentVariables: (findingBuckets.environmentVariables || [])
            .filter((f) => !isBenchmarkFalsePositiveFinding(f)),
        dataAccessPatterns: (findingBuckets.dataAccessPatterns || [])
            .filter((f) => !isBenchmarkFalsePositiveFinding(f))
    };

    const next = {
        ...report,
        ...rebuilt,
        findings: filteredByBucket,
        allFindings: filterBenchmarkDataQualityFindings(report.allFindings || flatFindings),
        scanners: patchScannerMissingKeys(rebuilt.scanners, rebuilt.summary.environmentFindings),
        scannerStatistics: patchScannerStatisticsEnv(
            report.scannerStatistics,
            rebuilt.summary.environmentFindings
        ),
        exportNormalized: true,
        dataQualityStatus: rebuilt.summary.totalFindings > 0 ? 'healthy-with-findings' : 'clean',
        securityHandoffEligible: false
    };

    if (next.scanners?.['data-access-patterns']) {
        next.scanners['data-access-patterns'] = {
            ...next.scanners['data-access-patterns'],
            patternFindings: rebuilt.summary.dataAccessFindings
        };
    }

    if (next.scannerStatistics?.scanners?.['data-access-patterns']) {
        const accessStats = next.scannerStatistics.scanners['data-access-patterns'];
        next.scannerStatistics = {
            ...next.scannerStatistics,
            scanners: {
                ...next.scannerStatistics.scanners,
                'data-access-patterns': {
                    ...accessStats,
                    stats: {
                        ...accessStats.stats,
                        patternFindings: rebuilt.summary.dataAccessFindings
                    },
                    findings: {
                        ...accessStats.findings,
                        total: rebuilt.summary.dataAccessFindings,
                        patternIssues: rebuilt.summary.dataAccessFindings
                    }
                }
            },
            findingsBreakdown: {
                ...next.scannerStatistics.findingsBreakdown,
                dataAccessPatterns: {
                    ...(next.scannerStatistics.findingsBreakdown?.dataAccessPatterns || {}),
                    total: rebuilt.summary.dataAccessFindings,
                    patternIssues: rebuilt.summary.dataAccessFindings
                }
            }
        };
    }

    return next;
}

function patchFileReductionPlanUnusedCounts(plan, unusedCount) {
    if (!plan || plan.omitted) return plan;
    const next = {
        ...plan,
        unusedFiles: plan.unusedFiles
            ? { ...plan.unusedFiles, candidates: unusedCount }
            : plan.unusedFiles
    };
    if (Array.isArray(plan.summaryTable)) {
        next.summaryTable = plan.summaryTable.map((row) => (
            /unused source files/i.test(String(row.category || ''))
                ? { ...row, files: unusedCount }
                : row
        ));
    }
    if (unusedCount === 0 && (plan.totals?.safeToDeleteBytes ?? 0) === 0 && (plan.totals?.duplicateAssetBytes ?? 0) === 0) {
        next.hygieneSummary = {
            ...(plan.hygieneSummary || {}),
            safeToDeleteBytes: 0,
            duplicateAssetBytes: plan.totals?.duplicateAssetBytes ?? 0,
            unusedFileCandidates: 0,
            note: 'Clean OSS CLI clone — MCP example configs and export-sanitize modules are protected; no reclaimable bytes.'
        };
    }
    return next;
}

function sanitizeBenchmarkFileReductionExport(report) {
    const normalized = normalizeFileReductionReport(report);
    const unusedCount = normalized.summary?.unusedFileCandidates ?? normalized.findings?.unusedFiles?.length ?? 0;
    const fr = normalized.executiveSummary?.fileReduction || {};

    let executiveSummary = normalized.executiveSummary;
    if (executiveSummary) {
        const actions = (executiveSummary.priorityActions || [])
            .filter((action) => {
                if (/unused-file candidates/i.test(String(action.title || '')) && unusedCount === 0) {
                    return false;
                }
                return true;
            });
        executiveSummary = {
            ...executiveSummary,
            fileReduction: {
                ...fr,
                unusedFileCandidates: unusedCount
            },
            priorityActions: actions,
            notes: [
                'File-reduction on OSS clone — not Simplebeacon platform inventory reduction.',
                ...(executiveSummary.notes || []).filter((n) => !/production paths first/i.test(String(n))
                    && !/File-reduction on OSS clone/i.test(String(n)))
            ].filter((note, index, all) => all.indexOf(note) === index).slice(0, 8),
            exportProfile: 'file-reduction',
            remediationHint: unusedCount > 0 || (fr.duplicateAssetBytes || 0) > 0
                ? 'Benchmark clone hygiene only — verify paths before any deletion; not valid for platform cleanup handoff.'
                : 'No reclaimable file-reduction findings on this OSS CLI clone — run file-reduction on ai-platform root for product artifact tiers.',
            benchmarkFileReductionNote: unusedCount === 0
                ? 'Protected MCP examples (examples/mcp/*.mcp.json) and CLI export modules are not unused-file deletion targets.'
                : undefined
        };
    }

    return {
        ...normalized,
        executiveSummary,
        fileReductionPlan: patchFileReductionPlanUnusedCounts(
            normalized.fileReductionPlan,
            unusedCount
        ),
        exportNormalized: true,
        fileReductionStatus: resolveFileReductionStatus({
            ...normalized,
            summary: normalized.summary,
            fileReductionPlan: patchFileReductionPlanUnusedCounts(normalized.fileReductionPlan, unusedCount)
        }),
        securityHandoffEligible: false
    };
}

function sanitizeBenchmarkExportByProfile(report) {
    if (report.scanProfile === 'file-reduction') {
        return sanitizeBenchmarkFileReductionExport(report);
    }
    if (report.scanProfile === 'data-quality') {
        return sanitizeBenchmarkDataQualityExport(report);
    }
    return {
        exportNormalized: true,
        fileReductionStatus: report.scanProfile === 'file-reduction'
            ? resolveFileReductionStatus(report)
            : undefined,
        dataQualityStatus: resolveDataQualityStatus(report),
        securityHandoffEligible: false
    };
}

function benchmarkLimitationNote(profile) {
    if (profile === 'file-reduction') {
        return 'Scanning OSS benchmark clone under github-cache/ — file-reduction hygiene only; duplicate doc assets across versioned geedocs folders and unused-file hits require manual review.';
    }
    return 'Scanning OSS benchmark clone under github-cache/ — Simplebeacon workspace scanners (package.json, .env) target product layout, not this C++/Python OSS tree.';
}

function benchmarkExportNote(profile) {
    if (profile === 'file-reduction') {
        return 'Benchmark clone file-reduction export — not valid for Simplebeacon platform cleanup handoff. Run file-reduction on ai-platform root for product artifact tiers.';
    }
    return 'Benchmark clone data-quality export — not valid for Simplebeacon platform handoff. Run data-quality on ai-platform root for workspace health.';
}

const BENCHMARK_FILE_REDUCTION_RECOMMENDATIONS = [
    'OSS clone only — compare hygiene metrics against other benchmarks, not Simplebeacon platform cleanup.',
    '.DS_Store under docs/ is safe to remove on macOS checkouts; prebuilt .so under portableglobe/servers/ may be required — verify before delete.',
    'Duplicate PNG assets across docs/geedocs version folders are often intentional — consolidate only when deduplicating doc trees.',
    'Unused-file candidates use static import graphs — HTML entrypoints, Python CGI, and integration tests are frequently loaded dynamically.'
];

function resolveDataQualityStatus(report) {
    const total = report.summary?.totalFindings ?? 0;
    const critical = report.aggregation?.bySeverity?.critical ?? 0;
    const high = report.aggregation?.bySeverity?.high ?? 0;
    if (critical > 0 || high > 0) return 'needs-attention';
    if (total > 0) return 'healthy-with-findings';
    return 'clean';
}

function resolveFileReductionRemediationHint(fr = {}) {
    const safeBytes = fr.safeToDeleteBytes ?? 0;
    const reviewBytes = fr.reviewBeforeDeleteBytes ?? 0;
    if (safeBytes > 0) {
        return `Phase 1 safe-delete: ~${Number(safeBytes).toLocaleString()} B in regenerable artifact directories — see fileReductionPlan.safeToDelete before deleting.`;
    }
    if (fr.unusedFileCandidates || fr.duplicateAssetBytes) {
        return 'No measured phase-1 safe-delete bytes — use priorityActions for investigate list and optional duplicate consolidation.';
    }
    if (reviewBytes > 0) {
        return `${Number(reviewBytes).toLocaleString()} B in review-first build artifacts — confirm before deletion.`;
    }
    return 'No file-reduction actions required in this export.';
}

function redactDataCleanupExportPaths(report, projectPath) {
    const label = projectLabelFromPath(projectPath);
    const redacted = redactProjectPathForExport(projectPath, label);
    let next = {
        ...report,
        projectRoot: redacted,
        ...(report.projectPath ? { projectPath: redacted } : {})
    };
    if (next.scannerStatistics?.project?.projectRoot) {
        next = {
            ...next,
            scannerStatistics: {
                ...next.scannerStatistics,
                project: {
                    ...next.scannerStatistics.project,
                    projectRoot: redacted
                }
            }
        };
    }
    if (next.productPlatformRoot) {
        next.productPlatformRoot = redactProjectPathForExport(
            next.productPlatformRoot,
            projectLabelFromPath(next.productPlatformRoot)
        );
    }
    return next;
}

function resolveFileReductionStatus(report) {
    const safeBytes = report.fileReductionPlan?.totals?.safeToDeleteBytes
        ?? report.scanners?.['build-artifacts']?.safeToDeleteBytes
        ?? 0;
    const unused = report.summary?.unusedFileCandidates ?? 0;
    const dupGroups = report.summary?.duplicateAssetGroups ?? 0;
    if (safeBytes > 0) return 'safe-delete-available';
    if (unused > 0 || dupGroups > 0) return 'investigate-and-optional-consolidation';
    return 'no-immediate-reclaim';
}

function enrichProductInventoryForExport(inventory, options = {}, profile = '') {
    if (!inventory) return inventory;
    const auditFiles = options.repositoryFilesTotal ?? options.auditRepositoryFiles ?? null;
    const invFiles = inventory.totalFiles ?? null;
    const base = {
        ...inventory,
        inventoryScope: 'platform-product'
    };
    if (auditFiles != null && invFiles != null && auditFiles > invFiles) {
        base.auditRepositoryFiles = auditFiles;
        base.inventoryNote = profile === 'file-reduction'
            ? `Workspace file-reduction inventory (${Number(invFiles).toLocaleString()} files) excludes un-walked vendor trees; gate audit profile counted ${Number(auditFiles).toLocaleString()} files.`
            : `Workspace inventory (${Number(invFiles).toLocaleString()} files) is smaller than gate audit profile (${Number(auditFiles).toLocaleString()} files) — workspace scans exclude un-walked vendor shells.`;
    } else if (invFiles != null && invFiles > 2000) {
        base.inventoryNote = 'Workspace inventory excludes node_modules; counts reflect scanned source and config paths.';
    }
    return base;
}

function isMirrorCliConsumerPath(consumerPath) {
    const normalized = String(consumerPath || '').replace(/\\/g, '/');
    return normalized.startsWith('.github-sync/') || normalized.startsWith('github-cache/');
}

function sanitizeDataLineageForExport(dataLineage = []) {
    if (!Array.isArray(dataLineage) || !dataLineage.length) {
        return { dataLineage, mirrorConsumersExcluded: 0 };
    }
    let mirrorConsumersExcluded = 0;
    const rows = dataLineage.map((row) => {
        const consumers = Array.isArray(row.consumers) ? row.consumers : [];
        const primaryConsumers = consumers.filter((consumer) => !isMirrorCliConsumerPath(consumer));
        const rowExcluded = consumers.length - primaryConsumers.length;
        mirrorConsumersExcluded += rowExcluded;
        return {
            ...row,
            consumers: primaryConsumers,
            consumerCount: primaryConsumers.length,
            ...(rowExcluded > 0 ? { mirrorConsumersExcluded: rowExcluded } : {})
        };
    });
    return { dataLineage: rows, mirrorConsumersExcluded };
}

function resolveDataCleanupGateContext(report, options = {}) {
    const gateReport = options.gateReport || {};
    const repositoryFilesTotal = options.repositoryFilesTotal
        ?? gateReport.repositoryFilesTotal
        ?? gateReport.repositoryInventory?.totalFiles
        ?? report.inventory?.auditRepositoryFiles
        ?? report.hygieneSummary?.gateRepositoryFilesTotal
        ?? report.scanScope?.gateRepositoryFilesTotal
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

function buildDataQualityHygieneSummary(report, options = {}) {
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile, gateReport,
        fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    const workspaceFiles = report.inventory?.totalFiles ?? null;
    return {
        dataQualityStatus: report.dataQualityStatus ?? resolveDataQualityStatus(report),
        totalFindings: report.summary?.totalFindings ?? 0,
        workspaceFilesScanned: workspaceFiles,
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateTotal != null && workspaceFiles != null && gateTotal > workspaceFiles
            ? { workspaceInventoryNotInGate: gateTotal - workspaceFiles }
            : {}),
        ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
            ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
            : {}),
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        packageJsonFiles: report.scanners?.['dependency-health']?.packageJsonFiles
            ?? report.scanners?.['config-management']?.packageJsonFiles
            ?? null,
        envKeysDefined: report.scanners?.['environment-variables']?.envKeys ?? null,
        envKeysReferenced: report.scanners?.['environment-variables']?.referencedKeys ?? null,
        dataLineageSampleFiles: report.scanners?.['data-lineage']?.dataFilesTracked
            ?? report.metadata?.dataLineage?.length
            ?? null,
        dataAccessSourceScanned: report.scanners?.['data-access-patterns']?.sourceFilesScanned ?? null,
        mirrorConsumersExcluded: report.metadata?.mirrorConsumersExcluded ?? 0,
        ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
        ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        ...(gateReport.jestBaselineChecked === false || report.hygieneSummary?.jestBaselineChecked === false
            ? { jestBaselineChecked: false }
            : {}),
        attestationNote: 'Data-quality hygiene scan — not gate pass or vendor handoff certification.'
    };
}

function enrichProductDataQualityScanScope(scanScope, report, options = {}) {
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
    return {
        ...(scanScope || {}),
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        enabledScannerCount: Array.isArray(report.enabledScanners) ? report.enabledScanners.length : null,
        resultsViewScope: scanScope?.resultsViewScope || 'platform-only',
        reportHealth: scanScope?.reportHealth || 'platform-scoped',
        securityHandoffEligible: false
    };
}

function buildFileReductionHygieneSummary(report, options = {}) {
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile, gateReport,
        fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    const workspaceFiles = report.inventory?.totalFiles ?? null;
    const unusedScanned = report.scanners?.['unused-files']?.sourceFilesScanned
        ?? report.fileReductionPlan?.unusedFiles?.sourceFilesScanned
        ?? null;
    const entryPoints = report.metadata?.entryPoints?.length
        ?? report.scanners?.['unused-files']?.entryPoints
        ?? null;
    return {
        fileReductionStatus: report.fileReductionStatus ?? resolveFileReductionStatus(report),
        workspaceFilesScanned: workspaceFiles,
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateTotal != null && workspaceFiles != null && gateTotal > workspaceFiles
            ? { workspaceInventoryNotInGate: gateTotal - workspaceFiles }
            : {}),
        ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
            ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
            : {}),
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        safeToDeleteBytes: report.fileReductionPlan?.totals?.safeToDeleteBytes
            ?? report.scanners?.['build-artifacts']?.safeToDeleteBytes
            ?? 0,
        duplicateAssetBytes: report.fileReductionPlan?.totals?.duplicateAssetBytes
            ?? report.scanners?.['asset-consolidation']?.reclaimableBytes
            ?? 0,
        unusedFileCandidates: report.summary?.unusedFileCandidates ?? 0,
        unusedFilesSourceScanned: unusedScanned,
        assetFilesScanned: report.scanners?.['asset-consolidation']?.assetFilesScanned ?? null,
        unusedFileEntryPoints: entryPoints,
        enabledScannerCount: Array.isArray(report.enabledScanners) ? report.enabledScanners.length : null,
        ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
        ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        ...(gateReport.jestBaselineChecked === false || report.hygieneSummary?.jestBaselineChecked === false
            ? { jestBaselineChecked: false }
            : {}),
        attestationNote: 'File-reduction hygiene scan — reclaim guidance only, not vendor handoff clearance.'
    };
}

function enrichProductFileReductionScanScope(scanScope, report, options = {}) {
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
    return {
        ...(scanScope || {}),
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        enabledScannerCount: Array.isArray(report.enabledScanners) ? report.enabledScanners.length : null,
        resultsViewScope: scanScope?.resultsViewScope || 'platform-only',
        reportHealth: scanScope?.reportHealth || 'platform-scoped',
        securityHandoffEligible: false,
        fileReductionNote: scanScope?.fileReductionNote
            || report.scanScope?.fileReductionNote
            || 'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.'
    };
}

function buildProductFileReductionExportNotes(report, options = {}) {
    const notes = [
        'securityHandoffEligible is false — file-reduction is reclaim guidance only, not vendor security handoff.',
        'Absolute scan paths are redacted to project label in operator exports.'
    ];
    if (report.inventory?.inventoryNote) {
        notes.push(String(report.inventory.inventoryNote));
    }
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile, gateReport,
        fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
        notes.push(
            `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`
        );
    }
    if (fictionJsonFilesScanned != null && fictionSampleFilesScanned != null) {
        notes.push(
            `Gate fiction KPI rules evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) with ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched — file-reduction profile scans reclaim tiers only.`
        );
    }
    if (gateProfile) {
        notes.push(`Gate rule bundle profile: ${gateProfile} — pair file-reduction report with json/simplebeacon-gate.json for handoff evidence.`);
    }
    const assetScanned = report.scanners?.['asset-consolidation']?.assetFilesScanned;
    if (assetScanned != null && assetScanned > 0) {
        notes.push(
            `${Number(assetScanned).toLocaleString()} static asset file(s) hashed for duplicate consolidation — workspace inventory excludes node_modules vendor trees.`
        );
    }
    const safeBytes = report.fileReductionPlan?.totals?.safeToDeleteBytes ?? 0;
    const shells = report.fileReductionPlan?.safeToDelete?.topDirectories || [];
    const zeroByteShells = shells.filter((d) => (d.bytes ?? 0) === 0 && /^(node_modules|coverage)$/.test(String(d.path)));
    if (zeroByteShells.length && safeBytes === 0) {
        notes.push(
            `${zeroByteShells.length} regenerable directory shell(s) listed with 0 B walked — workspace scan excludes vendor tree contents.`
        );
    }
    const unused = report.summary?.unusedFileCandidates ?? 0;
    if (unused > 0) {
        notes.push(
            `${unused} unused-file candidates are static-analysis hits — HTML pages, fixtures, and re-export shims are often intentional.`
        );
    }
    const dupBytes = report.fileReductionPlan?.totals?.duplicateAssetBytes
        ?? report.scanners?.['asset-consolidation']?.reclaimableBytes
        ?? 0;
    if (dupBytes > 0) {
        notes.push(`Phase 2 duplicate consolidation ~${dupBytes} B — use keeper paths in fileReductionPlan.duplicateAssets.topGroups.`);
    }
    const reviewBytes = report.fileReductionPlan?.totals?.reviewBeforeDeleteBytes ?? 0;
    if (reviewBytes > 0) {
        notes.push(
            `${reviewBytes} B in review-first build artifacts (logs, maps, generated files) — not auto-deleted.`
        );
    }
    if (report.summary?.estimatedReductionPct != null) {
        notes.push(
            `estimatedReductionPct (${report.summary.estimatedReductionPct}%) is finding density vs scanned inventory, not bytes reclaimable.`
        );
    }
    if (report.compact) {
        notes.push('Compact export — top findings only; fileReductionPlan and summary retain full totals.');
        notes.push('scannerStatistics data-quality shells are zero — enabledScanners lists file-reduction modules only.');
    }
    const unusedScanned = report.scanners?.['unused-files']?.sourceFilesScanned
        ?? report.fileReductionPlan?.unusedFiles?.sourceFilesScanned
        ?? null;
    const workspaceFiles = report.inventory?.totalFiles ?? null;
    if (unusedScanned != null && workspaceFiles != null && unusedScanned < workspaceFiles) {
        notes.push(
            `Unused-file graph scanned ${Number(unusedScanned).toLocaleString()} source file(s) from ${Number(report.metadata?.entryPoints?.length ?? report.scanners?.['unused-files']?.entryPoints ?? 0).toLocaleString()} entry point(s) — workspace inventory counted ${Number(workspaceFiles).toLocaleString()} paths.`
        );
    }
    notes.push('File-reduction scan does not run Jest — use gate/complete scan for test attestation.');
    if (safeBytes > 0) {
        notes.push('Safe-delete tiers are regenerable artifacts only — not SimpleBeacon vendor security handoff clearance.');
    }
    if ((report.summary?.totalFindings ?? 0) === 0
        && (report.fileReductionStatus === 'no-immediate-reclaim' || !report.fileReductionStatus)) {
        notes.push('No immediate reclaimable bytes or unused-file actions in this export.');
    }
    return [...new Set(notes)].slice(0, 13);
}

function buildProductDataQualityExportNotes(report, options = {}) {
    const notes = [
        'securityHandoffEligible is false — data-quality hygiene is supplementary, not vendor security handoff.',
        'Absolute scan paths are redacted to project label in operator exports.'
    ];
    if (report.inventory?.inventoryNote) {
        notes.push(String(report.inventory.inventoryNote));
    }
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile, gateReport,
        fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
        notes.push(
            `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`
        );
    }
    const sourceScanned = report.scanners?.['data-access-patterns']?.sourceFilesScanned;
    const workspaceFiles = report.inventory?.totalFiles;
    if (sourceScanned != null && workspaceFiles != null && sourceScanned < workspaceFiles) {
        notes.push(
            `Data-access pattern scan walked ${Number(sourceScanned).toLocaleString()} source file(s) — workspace inventory is ${Number(workspaceFiles).toLocaleString()} paths excluding vendor trees.`
        );
    }
    const lineageSamples = report.scanners?.['data-lineage']?.dataFilesTracked
        ?? report.metadata?.dataLineage?.length;
    if (lineageSamples != null && fictionJsonFilesScanned != null && fictionSampleFilesScanned != null) {
        notes.push(
            `Data-lineage tracked ${Number(lineageSamples).toLocaleString()} web/data *-sample.json file(s) — gate fiction KPI rules evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON paths with ${Number(fictionSampleFilesScanned).toLocaleString()} KPI samples matched.`
        );
    }
    const packageJsonFiles = report.scanners?.['dependency-health']?.packageJsonFiles
        ?? report.scanners?.['config-management']?.packageJsonFiles;
    if (packageJsonFiles != null && packageJsonFiles > 0) {
        notes.push(
            `${Number(packageJsonFiles).toLocaleString()} workspace package.json manifest(s) scanned — dependency and env rules exclude node_modules vendor trees.`
        );
    }
    const missing = report.scanners?.['environment-variables']?.missingKeys
        ?? report.findings?.environmentVariables?.filter((f) => f.type === 'missing-env-key').length
        ?? 0;
    const syncIo = report.scanners?.['data-access-patterns']?.patternFindings
        ?? report.findings?.dataAccessPatterns?.length
        ?? 0;
    if (missing > 0) {
        notes.push(
            `${missing} env key(s) referenced in code but not defined in workspace .env files — add to .env.example (commented) or local .env.`
        );
    }
    if (syncIo > 0) {
        notes.push(`${syncIo} sync filesystem read pattern(s) flagged — prefer startup load or cache (see dataAccessPatterns findings).`);
    }
    if (report.summary?.estimatedReductionPct != null) {
        notes.push(
            `estimatedReductionPct (${report.summary.estimatedReductionPct}%) is finding density vs scanned inventory, not disk bytes reclaimable.`
        );
    }
    if (report.compact) {
        notes.push('Compact export — top findings only; scannerStatistics and summary retain full counts.');
    }
    const mirrorExcluded = report.metadata?.mirrorConsumersExcluded ?? 0;
    if (mirrorExcluded > 0) {
        notes.push(
            `${mirrorExcluded} dataLineage mirror consumer path(s) (.github-sync/) omitted from export — not primary application source.`
        );
    } else {
        const mirrorConsumers = (report.metadata?.dataLineage || [])
            .flatMap((row) => (row.consumers || []).filter((c) => isMirrorCliConsumerPath(c)));
        if (mirrorConsumers.length) {
            notes.push('dataLineage consumers may reference .github-sync/ CLI mirror paths — not primary ai-platform application source.');
        }
    }
    if (gateProfile) {
        notes.push(`Gate rule bundle profile: ${gateProfile} — pair data-quality report with json/simplebeacon-gate.json for handoff evidence.`);
    }
    if (gateReport.jestBaselineChecked === false || report.hygieneSummary?.jestBaselineChecked === false) {
        notes.push('Data-quality scan does not run Jest — use gate/complete scan for test attestation.');
    }
    if ((report.summary?.totalFindings ?? 0) === 0) {
        notes.push('No open data-quality findings on scanned workspace paths in this export.');
    }
    const envKeys = report.scanners?.['environment-variables']?.envKeys ?? 0;
    const referencedKeys = report.scanners?.['environment-variables']?.referencedKeys ?? 0;
    if (referencedKeys > envKeys && envKeys > 0) {
        notes.push(
            `referencedKeys (${referencedKeys}) exceeds envKeys (${envKeys}) — static analysis counts code references including CI/Docker/runtime-injected keys.`
        );
    }
    return [...new Set(notes)].slice(0, 14);
}

function fixEstimatedReductionPct(summary, inventory) {
    if (!summary || typeof summary !== 'object') return summary;
    const totalFiles = inventory?.totalFiles;
    if (!totalFiles || totalFiles <= 0) return summary;
    const pct = summary.estimatedReductionPct;
    if (pct == null || pct <= 100) return summary;
    const findings = summary.totalFindings ?? 0;
    return {
        ...summary,
        estimatedReductionPct: Math.round((findings / totalFiles) * 1000) / 10
    };
}

function repairCompactAllFindings(report) {
    const topGroups = report.fileReductionPlan?.duplicateAssets?.topGroups || [];
    if (!topGroups.length || !Array.isArray(report.allFindings)) return report.allFindings;

    let groupIndex = 0;
    const repaired = report.allFindings.map((finding) => {
        if (finding.type !== 'asset-duplicate') return finding;
        const group = topGroups[groupIndex] || topGroups.find((g) => g.reclaimableBytes === finding.reclaimableBytes);
        if (group) groupIndex += 1;
        const normalized = normalizeDuplicateGroupForBrief({ ...finding, ...group });
        return normalized
            ? { ...finding, path: normalized.keeper, keeper: normalized.keeper, duplicates: normalized.duplicates }
            : finding;
    });
    return repaired;
}

function repairCompactAssetFindings(report) {
    const topGroups = report.fileReductionPlan?.duplicateAssets?.topGroups || [];
    if (!topGroups.length) return report.findings;

    const repaired = (report.findings?.assetConsolidation || []).map((finding, index) => {
        const group = topGroups[index] || topGroups.find((g) => g.reclaimableBytes === finding.reclaimableBytes);
        const normalized = normalizeDuplicateGroupForBrief({ ...finding, ...group });
        return normalized || finding;
    });

    if (repaired.some((f) => f.keeper || f.path)) {
        return { ...report.findings, assetConsolidation: repaired };
    }
    return report.findings;
}

function reaggregateAfterRepair(report) {
    const findings = report.findings || {};
    const buckets = Object.values(findings);
    const allFindings = buckets.flat().filter(Boolean);
    if (!allFindings.length) return report;
    const aggregated = aggregateCleanupFindings(allFindings);
    return {
        ...report,
        aggregation: {
            bySeverity: {
                critical: aggregated.bySeverity.critical.length,
                high: aggregated.bySeverity.high.length,
                medium: aggregated.bySeverity.medium.length,
                low: aggregated.bySeverity.low.length
            },
            byCategory: aggregated.byCategory,
            topFiles: aggregated.topFiles.filter((entry) => entry.filePath !== 'unknown')
        }
    };
}

function sanitizeFileReductionPlanForProduct(plan) {
    if (!plan || plan.omitted) return plan;

    let next = { ...plan, profile: 'file-reduction' };
    if (plan.duplicateAssets?.topGroups?.length) {
        next.duplicateAssets = {
            ...plan.duplicateAssets,
            topGroups: plan.duplicateAssets.topGroups
                .map((group) => normalizeDuplicateGroupForBrief(group))
                .filter(Boolean)
        };
    }

    const safeBytes = plan.totals?.safeToDeleteBytes ?? 0;
    const hasZeroByteShell = (plan.safeToDelete?.topDirectories || []).some(
        (entry) => (entry.bytes ?? 0) === 0 && /^(node_modules|coverage)$/.test(String(entry.path))
    );
    if (safeBytes === 0 && hasZeroByteShell) {
        next.hygieneSummary = {
            safeToDeleteBytes: 0,
            duplicateAssetBytes: plan.totals?.duplicateAssetBytes ?? 0,
            note: 'No measured safe-delete bytes — regenerable shells were not size-walked; optional duplicate consolidation only.'
        };
        if (Array.isArray(plan.recommendations) && plan.recommendations.some((r) => /Delete top-level artifact/i.test(r))) {
            next.recommendations = [
                'Regenerable shells (node_modules, coverage) were detected but not size-walked — confirm before delete; restore with `npm install` or re-run tests.',
                'Consolidate duplicate assets using keeper paths in duplicateAssets.topGroups (canonical favicon: web/favicon.svg).',
                'Unused-file hits include HTML entrypoints, fixtures, and re-export shims — verify before deletion.',
                'Run data-quality profile for env keys and sync I/O findings.'
            ];
        }
    }

    if (plan.reviewBeforeDelete?.logs?.length) {
        next.reviewBeforeDelete = {
            ...plan.reviewBeforeDelete,
            logs: plan.reviewBeforeDelete.logs.filter((entry) => !shouldSkipRuntimeLogFile(entry.path)),
            bytes: (plan.reviewBeforeDelete.logs || [])
                .filter((entry) => !shouldSkipRuntimeLogFile(entry.path))
                .reduce((sum, entry) => sum + (entry.bytes || 0), 0)
        };
        if (next.totals) {
            next.totals = {
                ...next.totals,
                reviewBeforeDeleteBytes: next.reviewBeforeDelete.bytes
            };
        }
    }

    return next;
}

function sanitizeFileReductionPlanForExport(plan, context) {
    if (!plan || plan.omitted) return plan;
    if (!context.benchmarkScan) return sanitizeFileReductionPlanForProduct(plan);

    const next = {
        ...plan,
        scopeNote: 'OSS benchmark clone — file-reduction tiers are informational; safeToDelete is empty because product artifact policies do not apply.',
        recommendations: BENCHMARK_FILE_REDUCTION_RECOMMENDATIONS
    };

    if (context.profile === 'file-reduction' && plan.totals) {
        next.hygieneSummary = {
            safeToDeleteBytes: plan.totals.safeToDeleteBytes ?? 0,
            reviewBeforeDeleteBytes: plan.totals.reviewBeforeDeleteBytes ?? 0,
            duplicateAssetBytes: plan.totals.duplicateAssetBytes ?? 0,
            note: 'Phase 1 safe-delete is typically zero on OSS clones — review .DS_Store and duplicate doc assets manually.'
        };
    }

    if (plan.duplicateAssets?.topGroups) {
        next.duplicateAssets = {
            ...plan.duplicateAssets,
            topGroups: plan.duplicateAssets.topGroups
                .map((group) => normalizeDuplicateGroupForBrief(group))
                .filter(Boolean)
        };
    }

    return next;
}

function sanitizeExecutiveSummaryForFileReduction(executiveSummary, context) {
    if (!executiveSummary || context.profile !== 'file-reduction') {
        return sanitizeExecutiveSummaryForExport(executiveSummary, context);
    }
    const next = sanitizeExecutiveSummaryForExport(executiveSummary, context);
    const fr = next.fileReduction || {};
    const actions = [...(next.priorityActions || [])];

    if (context.benchmarkScan) {
        if (fr.duplicateAssetBytes > 0 && !actions.some((a) => /duplicate/i.test(a.title))) {
            actions.unshift({
                priority: 'medium',
                title: 'Review duplicate doc assets',
                detail: `${fr.duplicateAssetGroups || 'Many'} duplicate group(s), ~${Math.round((fr.duplicateAssetBytes || 0) / (1024 * 1024))} MB — mostly versioned geedocs PNG copies; not auto-delete.`
            });
        }
        if (fr.unusedFileCandidates > 0 && !actions.some((a) => /unused/i.test(a.title))) {
            actions.push({
                priority: 'low',
                title: 'Investigate unused-file candidates',
                detail: `${fr.unusedFileCandidates} static unused hits — verify dynamic loaders before deleting OSS source.`
            });
        }
        next.notes = [
            'File-reduction on OSS clone — not Simplebeacon platform inventory reduction.',
            ...(next.notes || []).filter((n) => !/workspace scanners.*package\.json/i.test(String(n)))
        ].filter((note, index, all) => all.indexOf(note) === index).slice(0, 8);
    } else {
        if (fr.unusedFileCandidates > 0 && !actions.some((a) => /unused/i.test(a.title))) {
            actions.push({
                priority: 'medium',
                title: 'Investigate unused-file candidates',
                detail: `${fr.unusedFileCandidates} static hits — verify HTML entrypoints, fixtures, and dynamic loaders before deleting`
            });
        }
        if (fr.duplicateAssetBytes > 0 && !actions.some((a) => /duplicate/i.test(a.title))) {
            actions.unshift({
                priority: 'low',
                title: 'Review duplicate assets',
                detail: `${fr.duplicateAssetGroups || 1} group(s), ~${fr.duplicateAssetBytes} B — keeper paths listed in fileReductionPlan`
            });
        }
        if ((fr.safeToDeleteBytes || 0) === 0 && (fr.buildArtifactFindings || 0) > 0
            && !actions.some((a) => /shell/i.test(a.title))) {
            actions.push({
                priority: 'low',
                title: 'Regenerable directory shells',
                detail: 'node_modules or coverage detected with 0 B walked — confirm regenerable before delete'
            });
        }
        next.exportProfile = 'file-reduction';
        next.remediationHint = resolveFileReductionRemediationHint(fr);
        const fileReductionNotes = [
            'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.'
        ];
        if (fr.unusedFileCandidates > 0) {
            fileReductionNotes.push(
                `${fr.unusedFileCandidates} unused-file candidates are static-analysis hits — verify HTML entrypoints and fixtures before deleting.`
            );
        }
        if ((fr.duplicateAssetBytes || 0) > 0) {
            fileReductionNotes.push(
                `Duplicate asset consolidation ~${fr.duplicateAssetBytes} B — see fileReductionPlan.duplicateAssets.topGroups for keeper paths.`
            );
        }
        next.notes = fileReductionNotes.slice(0, 6);
    }

    if ((fr.reviewBeforeDeleteBytes || 0) === 0) {
        next.priorityActions = actions.filter((action) => !/review build artifact/i.test(String(action.title || '')));
    } else {
        next.priorityActions = actions.slice(0, 8);
    }
    return next;
}

/**
 * @param {object} report data-cleanup-report payload
 * @returns {object}
 */
function sanitizeDataCleanupReportExport(report, options = {}) {
    if (!report || report.type !== 'data-cleanup-report') return report;

    const projectPath = options.projectPath || report.projectRoot || report.projectPath || '';
    const benchmarkScan = isBenchmarkReport(report);
    const profile = report.scanProfile || 'data-quality';
    const productPlatformRoot = benchmarkScan ? resolveProductPlatformRoot(projectPath) : null;

    const context = { benchmarkScan, profile, productPlatformRoot, projectPath };

    let next = {
        ...report,
        ...(benchmarkScan ? {
            scanTargetProfile: 'benchmark-cache',
            handoffEligible: false,
            benchmarkScan: true,
            productPlatformRoot: productPlatformRoot || undefined
        } : {})
    };

    if (benchmarkScan) {
        next.scanScope = {
            ...(next.scanScope || {}),
            resultsViewScope: 'benchmark-clone',
            reportHealth: 'benchmark-clone-scan',
            rescanRecommended: false,
            inventoryMetricsStale: false,
            benchmarkScanTarget: true,
            limitations: [benchmarkLimitationNote(profile)]
        };
        if (next.inventory) {
            next.inventory = {
                ...next.inventory,
                inventoryScope: 'oss-clone',
                note: /stale full-tree/i.test(String(next.inventory.note || ''))
                    ? 'OSS clone inventory — large file counts are expected for google-earthenterprise-scale trees.'
                    : (next.inventory.note || 'OSS clone inventory — large file counts are expected.')
            };
        }
    }

    if (next.summary) {
        next.summary = fixEstimatedReductionPct(next.summary, next.inventory);
    }

    if (next.compact && next.findings) {
        next.findings = repairCompactAssetFindings(next);
        if (next.allFindings) {
            next.allFindings = repairCompactAllFindings(next);
        }
        next = reaggregateAfterRepair(next);
    }

    if (profile === 'file-reduction' && !benchmarkScan) {
        next = stripRuntimeLogFindings(next);
    }

    if (next.executiveSummary) {
        next.executiveSummary = profile === 'file-reduction'
            ? sanitizeExecutiveSummaryForFileReduction(next.executiveSummary, context)
            : sanitizeExecutiveSummaryForExport(next.executiveSummary, context);
    }

    if (next.fileReductionPlan && profile === 'file-reduction') {
        next.fileReductionPlan = benchmarkScan
            ? sanitizeFileReductionPlanForExport(next.fileReductionPlan, context)
            : sanitizeFileReductionPlanForProduct(next.fileReductionPlan);
        if (next.findings?.assetConsolidation?.length && next.fileReductionPlan.duplicateAssets?.topGroups?.length) {
            next.findings = {
                ...next.findings,
                assetConsolidation: next.fileReductionPlan.duplicateAssets.topGroups.map((group) => ({
                    type: 'asset-duplicate',
                    severity: 'low',
                    action: 'consolidate-duplicates',
                    reclaimableBytes: group.reclaimableBytes,
                    ...group
                }))
            };
        }
    }

    if (next.scannerStatistics) {
        next.scannerStatistics = sanitizeScannerStatisticsForExport(next.scannerStatistics, context);
    }

    if (profile === 'data-quality' && next.fileReductionPlan && !next.fileReductionPlan.omitted) {
        next.fileReductionPlan = {
            profile: 'data-quality',
            omitted: true,
            scopeNote: 'File-reduction tiers omitted from data-quality export — run file-reduction profile for artifact and duplicate analysis.'
        };
    }

    if (benchmarkScan) {
        next = {
            ...next,
            ...sanitizeBenchmarkExportByProfile(next)
        };
        next.exportNotes = [
            ...(next.exportNotes || []),
            benchmarkExportNote(profile)
        ].filter((note, index, all) => all.indexOf(note) === index);
    } else {
        if (profile === 'data-quality' && next.metadata?.dataLineage?.length) {
            const { dataLineage, mirrorConsumersExcluded } = sanitizeDataLineageForExport(next.metadata.dataLineage);
            next = {
                ...next,
                metadata: {
                    ...next.metadata,
                    dataLineage,
                    ...(mirrorConsumersExcluded > 0 ? { mirrorConsumersExcluded } : {})
                }
            };
        }
        const enrichedInventory = enrichProductInventoryForExport(next.inventory, options, profile);
        const statusFields = profile === 'file-reduction'
            ? { fileReductionStatus: resolveFileReductionStatus(next) }
            : profile === 'data-quality'
                ? { dataQualityStatus: resolveDataQualityStatus(next) }
                : {};
        const notesInput = {
            ...next,
            inventory: enrichedInventory,
            ...statusFields
        };
        const exportNotes = profile === 'file-reduction'
            ? buildProductFileReductionExportNotes(notesInput, options)
            : buildProductDataQualityExportNotes(notesInput, options);
        next = {
            ...next,
            exportNormalized: true,
            exportSanitized: true,
            scanTargetProfile: 'product',
            securityHandoffEligible: false,
            handoffEligible: false,
            ...statusFields,
            exportNotes: exportNotes.length ? exportNotes : undefined,
            inventory: enrichedInventory,
            scanScope: profile === 'data-quality'
                ? enrichProductDataQualityScanScope({
                    ...(next.scanScope || {}),
                    resultsViewScope: next.scanScope?.resultsViewScope || 'platform-only',
                    reportHealth: next.scanScope?.reportHealth || 'platform-scoped',
                    securityHandoffEligible: false,
                    dataQualityNote: 'Data-quality export — workspace scanner hygiene only, not vendor handoff clearance.'
                }, next, options)
                : profile === 'file-reduction'
                    ? enrichProductFileReductionScanScope({
                        ...(next.scanScope || {}),
                        resultsViewScope: next.scanScope?.resultsViewScope || 'platform-only',
                        reportHealth: next.scanScope?.reportHealth || 'platform-scoped',
                        securityHandoffEligible: false,
                        fileReductionNote: 'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.'
                    }, next, options)
                    : {
                        ...(next.scanScope || {}),
                        resultsViewScope: next.scanScope?.resultsViewScope || 'platform-only',
                        reportHealth: next.scanScope?.reportHealth || 'platform-scoped',
                        securityHandoffEligible: false
                    },
            ...(profile === 'data-quality'
                ? { hygieneSummary: buildDataQualityHygieneSummary({ ...next, inventory: enrichedInventory }, options) }
                : profile === 'file-reduction'
                    ? { hygieneSummary: buildFileReductionHygieneSummary({ ...next, inventory: enrichedInventory, ...statusFields }, options) }
                    : {})
        };
        if (profile === 'file-reduction') {
            delete next.dataQualityStatus;
        } else if (profile === 'data-quality') {
            delete next.fileReductionStatus;
        }
        if (profile === 'data-quality' && next.executiveSummary) {
            next.executiveSummary = {
                ...next.executiveSummary,
                exportProfile: 'data-quality',
                remediationHint: (next.summary?.totalFindings ?? 0) > 0
                    ? 'Address priorityActions and environmentVariables findings before platform handoff.'
                    : 'No open data-quality findings in this export.'
            };
        }
    }

    return redactDataCleanupExportPaths(next, projectPath);
}

module.exports = {
    sanitizeDataCleanupReportExport,
    replaceMisleadingDataQualityNotes
};
