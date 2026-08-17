/**
 * MCP scan handlers — scan_snippet, scan_file, scan_project
 */

const { scanSnippetContent, scanFileOnDisk } = require('../../lib/snippet-scanner');
const {
    resolveAgentTier,
    applyFreeSnippetLimits,
    checkFreeSnippetRateLimit,
    UPGRADE_URL
} = require('../../lib/agent-tier-capabilities');
const { attachGateMetadata } = require('../../lib/gate-parity');
const { recordScanResult } = require('../../lib/agent-session');

function createScanHandlers({ withGuard, withTierGuard, resolveProjectRoot, formatToolResult, cacheReport }) {
    return {
        scan_snippet: withGuard((args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            if (args.content === undefined || args.content === null || args.content === '') {
                throw new Error('Missing required argument: content');
            }

            const tierCtx = resolveAgentTier();
            if (!tierCtx.paid) {
                const rate = checkFreeSnippetRateLimit(process.env.SB_DEVICE_ID || 'mcp-free');
                if (!rate.allowed) {
                    return formatToolResult({
                        ...rate.upsell,
                        reason: rate.reason
                    });
                }
            }

            const result = scanSnippetContent(String(args.content || ''), {
                filePath: args.filePath || 'snippet.txt',
                projectRoot: resolveProjectRoot(args.projectRoot)
            });

            let payload = {
                ...result,
                localOnly: true,
                methodology: 'Deterministic regex — not LLM semantic review',
                tier: tierCtx.tier,
                agentExperience: tierCtx.paid ? '11/10' : '2/10'
            };

            if (tierCtx.paid) {
                payload = attachGateMetadata(payload, { blockingCount: result.blockingCount });
                try {
                    recordScanResult(resolveProjectRoot(args.projectRoot), {
                        gatePass: result.blockingCount === 0,
                        findings: result.findings
                    });
                } catch {
                    // ignore session write errors
                }
            } else {
                payload = applyFreeSnippetLimits(payload);
                payload = attachGateMetadata(payload, { blockingCount: payload.blockingCount });
            }

            return formatToolResult(payload);
        }),

        scan_file: withTierGuard('scan_file', withGuard((args) => {
            if (!args || typeof args !== 'object') throw new Error('arguments must be an object');
            if (args.filePath === undefined || args.filePath === null || args.filePath === '') {
                throw new Error('Missing required argument: filePath');
            }
            const { filePath, projectRoot } = args;
            try {
                const result = scanFileOnDisk(resolveProjectRoot(projectRoot), filePath);
                const payload = attachGateMetadata(
                    { ...result, localOnly: true, agentExperience: '11/10' },
                    { blockingCount: result.blockingCount }
                );
                return formatToolResult(payload);
            } catch (err) {
                return formatToolResult({ error: err.message, filePath });
            }
        })),

        scan_project: withGuard(async (args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const { runScan } = require('../../scan');
            const { loadSimplebeaconConfig } = require('../../config');
            const fs = require('fs');
            const path = require('path');
            const tierCtx = resolveAgentTier();
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
                try {
                    const { refreshAgentArtifacts } = require('../../lib/agent-context-pack');
                    refreshAgentArtifacts(root, report, { paid: tierCtx.paid, task: args.task });
                } catch (artifactErr) {
                    /* non-fatal */
                }
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
                const isFree = !tierCtx.paid;
                const issueCap = isFree ? 5 : 12;
                const payload = attachGateMetadata({
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
                    qualityScore: isFree ? null : (report.qualityScore ?? 0),
                    totalFiles: report.totalFiles ?? 0,
                    issueCount: report.issueCount ?? 0,
                    detectedIssues: detectedIssues.slice(0, issueCap),
                    summary: {
                        gatePass: report.gate?.pass ?? null,
                        qualityScore: isFree ? null : (report.qualityScore ?? 0)
                    },
                    localOnly: true,
                    methodology: 'Deterministic regex + AST scan — no code uploaded',
                    tier: tierCtx.tier,
                    agentExperience: isFree ? '2/10' : '11/10',
                    ...(isFree ? {
                        upsell: 'Upgrade to Pro to unlock all 38 analyzer engines, full agent loop, and exportable reports — https://simplebeacon.ai/pricing',
                        upgradeUrl: UPGRADE_URL
                    } : {})
                }, {
                    gatePass: report.gate?.pass ?? null,
                    blockingCount: report.gate?.blockingCount ?? 0
                });
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
