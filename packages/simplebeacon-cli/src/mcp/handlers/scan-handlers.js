/**
 * MCP scan handlers — scan_snippet, scan_file, scan_project
 */

const { scanSnippetContent, scanFileOnDisk } = require('../../lib/snippet-scanner');

function createScanHandlers({ withGuard, resolveProjectRoot, formatToolResult, cacheReport }) {
    return {
        scan_snippet: withGuard((args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            if (args.content === undefined || args.content === null || args.content === '') {
                throw new Error('Missing required argument: content');
            }
            const result = scanSnippetContent(String(args.content || ''), {
                filePath: args.filePath || 'snippet.txt',
                projectRoot: resolveProjectRoot(args.projectRoot)
            });
            return formatToolResult({
                ...result,
                localOnly: true,
                methodology: 'Deterministic regex — not LLM semantic review'
            });
        }),

        scan_file: withGuard((args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            if (args.filePath === undefined || args.filePath === null || args.filePath === '') {
                throw new Error('Missing required argument: filePath');
            }
            const { filePath, projectRoot } = args;
            try {
                const result = scanFileOnDisk(resolveProjectRoot(projectRoot), filePath);
                return formatToolResult({ ...result, localOnly: true });
            } catch (err) {
                return formatToolResult({ error: err.message, filePath });
            }
        }),

        scan_project: withGuard(async (args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const { runScan } = require('../../scan');
            const { loadSimplebeaconConfig } = require('../../config');
            const fs = require('fs');
            const path = require('path');
            try {
                const configPath = args.configPath ? path.resolve(root, args.configPath) : null;
                const config = configPath && fs.existsSync(configPath)
                    ? loadSimplebeaconConfig(root, configPath)
                    : loadSimplebeaconConfig(root);
                if (args.complete === true) {
                    config.fullDirectoryScan = true;
                }
                if (args.profile) {
                    config.profile = args.profile;
                }
                if (args.gate === true) {
                    config.gate = config.gate || {};
                    config.gate.enabled = true;
                }
                const report = await runScan(root, {
                    config,
                    configPath,
                    offline: true
                });
                cacheReport(root, report);
                const detectedIssues = (report.detectedIssues || []).map(i => ({
                    severity: i.severity || 'low',
                    type: i.type || 'unknown',
                    count: i.count || 1,
                    filePath: Array.isArray(i.filePaths) && i.filePaths.length
                        ? i.filePaths.slice(0, 5).join(', ')
                        : (Array.isArray(i.affectedFiles) && i.affectedFiles.length
                            ? i.affectedFiles.slice(0, 5).join(', ')
                            : (i.filePath || '')),
                    rule: i.pattern || i.rule || 'UNKNOWN',
                    impact: i.description || i.impact || 'Review required.',
                    fix: i.recommendedAction || i.recommendation || i.fix || 'Manual review required.'
                }));
                const gateBlocking = (report.gate?.blockingIssues || []).map(i => ({
                    severity: i.severity || 'medium',
                    type: i.type || 'Blocking Finding',
                    count: i.count || 1,
                    filePath: Array.isArray(i.filePaths) && i.filePaths.length
                        ? i.filePaths.slice(0, 5).join(', ')
                        : (Array.isArray(i.affectedFiles) && i.affectedFiles.length
                            ? i.affectedFiles.slice(0, 5).join(', ')
                            : (i.filePath || '')),
                    rule: i.pattern || i.rule || 'UNKNOWN',
                    impact: i.description || i.impact || 'Review required.',
                    fix: i.recommendedAction || i.recommendation || i.fix || 'Manual review required.'
                }));
                const normalizedTier = String(report.tier || 'developer').toLowerCase();
                const isFree = normalizedTier === 'developer' || normalizedTier === 'free';
                const payload = {
                    type: 'simplebeacon-report',
                    version: '1.3.0',
                    generatedAt: report.generatedAt || new Date().toISOString(),
                    projectRoot: report.projectRoot || root,
                    gate: {
                        pass: report.gate?.pass ?? null,
                        blockingCount: report.gate?.blockingCount ?? 0,
                        warningCount: report.gate?.warningCount ?? 0,
                        blockingFindings: gateBlocking
                    },
                    qualityScore: report.qualityScore ?? 0,
                    totalFiles: report.totalFiles ?? 0,
                    issueCount: report.issueCount ?? 0,
                    detectedIssues: detectedIssues.slice(0, 12),
                    summary: {
                        gatePass: report.gate?.pass ?? null,
                        qualityScore: report.qualityScore ?? 0
                    },
                    localOnly: true,
                    methodology: 'Deterministic regex + AST scan — no code uploaded',
                    tier: normalizedTier,
                    ...(isFree ? { upsell: 'Upgrade to Pro ($9/mo) to unlock all 48 analyzers, exportable reports, and team tools — https://simplebeacon.ai/pricing' } : {})
                };
                if (args.format === 'json') {
                    return formatToolResult(payload);
                }
                return formatToolResult(payload);
            } catch (err) {
                return formatToolResult({ error: err.message, projectRoot: root });
            }
        })
    };
}

module.exports = { createScanHandlers };
