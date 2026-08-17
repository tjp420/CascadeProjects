/**
 * MCP agent loop handlers — propose_fix, verify_fix, scan_staged, agent_status (paid only).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { scanSnippetContent, scanFileOnDisk } = require('../../lib/snippet-scanner');
const { remediateFinding, getSupportedPatterns } = require('../../lib/ast-remediator');
const { attachGateMetadata } = require('../../lib/gate-parity');
const {
    assertCapability,
    resolveAgentTier
} = require('../../lib/agent-tier-capabilities');
const {
    readAgentSession,
    writeAgentSession,
    recordFix,
    buildNextAction
} = require('../../lib/agent-session');

function createAgentLoopHandlers({
    withGuard,
    withTierGuard,
    resolveProjectRoot,
    formatToolResult
}) {
    function tierBlocked(toolName) {
        const ctx = resolveAgentTier();
        const check = assertCapability(toolName, ctx);
        if (!check.allowed) {
            return formatToolResult(check.upsell);
        }
        return null;
    }

    return {
        propose_fix: withTierGuard('propose_fix', withGuard((args) => {
            const blocked = tierBlocked('propose_fix');
            if (blocked) return blocked;

            const root = resolveProjectRoot(args.projectRoot);
            const pattern = args.patternId || args.pattern;
            const filePath = args.filePath;
            const line = args.line ? Number(args.line) : null;

            if (!pattern && !args.findingId) {
                return formatToolResult({ error: 'Provide patternId/pattern or findingId with filePath' });
            }

            const finding = {
                pattern: pattern || args.findingId,
                filePath: filePath,
                line,
                type: args.type || 'Finding'
            };

            const result = remediateFinding(finding, { dryRun: args.dryRun !== false });
            if (result.search && result.replace) {
                return formatToolResult({
                    autoFixable: true,
                    patternId: pattern,
                    filePath,
                    search: result.search,
                    replace: result.replace,
                    diff: result.diff || null,
                    applied: result.applied === true,
                    reason: result.reason || null,
                    supportedPatterns: getSupportedPatterns(),
                    methodology: 'Deterministic AST remediator — no LLM inference'
                });
            }

            const { GUIDE_PLAYBOOKS } = require('../../reporters/remediation-guides');
            const guideKey = String(args.type || '').toLowerCase().includes('credential')
                ? 'credentials'
                : String(args.type || '').toLowerCase().includes('leak')
                    ? 'production-leak'
                    : null;
            const guide = guideKey ? GUIDE_PLAYBOOKS[guideKey] : null;

            return formatToolResult({
                autoFixable: false,
                patternId: pattern,
                filePath,
                reason: result.reason || 'No deterministic patch available',
                manualSteps: guide ? guide.steps : ['Review finding manually', 'Re-run verify_fix after edit'],
                verifyCommand: guide ? guide.verify : 'npx simplebeacon scan --gate',
                supportedPatterns: getSupportedPatterns()
            });
        })),

        verify_fix: withTierGuard('verify_fix', withGuard((args) => {
            const blocked = tierBlocked('verify_fix');
            if (blocked) return blocked;

            const root = resolveProjectRoot(args.projectRoot);
            const before = Number(args.blockingCountBefore) || 0;

            let after = 0;
            let scanResult;

            if (args.content && typeof args.content === 'string') {
                scanResult = scanSnippetContent(String(args.content), {
                    filePath: args.filePath || 'snippet.txt',
                    projectRoot: root
                });
                after = scanResult.blockingCount;
            } else if (args.filePath) {
                scanResult = scanFileOnDisk(root, args.filePath);
                after = scanResult.blockingCount;
            } else {
                return formatToolResult({ error: 'Provide content (post-patch snippet) or filePath' });
            }

            const fixed = after < before || (before > 0 && after === 0);
            if (fixed && args.findingId) {
                recordFix(root, args.findingId);
            }

            return formatToolResult(attachGateMetadata({
                blockingCountBefore: before,
                blockingCountAfter: after,
                fixed,
                findingCount: scanResult.findingCount,
                findings: (scanResult.findings || []).slice(0, 8),
                methodology: 'Re-scan after patch — deterministic'
            }, { blockingCount: after, gatePass: after === 0 }));
        })),

        scan_staged: withTierGuard('scan_staged', withGuard((args) => {
            const blocked = tierBlocked('scan_staged');
            if (blocked) return blocked;

            const root = resolveProjectRoot(args.projectRoot);
            let stagedFiles = [];
            try {
                const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
                    cwd: root,
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'ignore']
                });
                stagedFiles = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            } catch (err) {
                return formatToolResult({ error: 'git diff --cached failed — is this a git repo?', detail: err.message });
            }

            if (!stagedFiles.length) {
                return formatToolResult({
                    stagedFileCount: 0,
                    blockingCount: 0,
                    gatePass: true,
                    findings: [],
                    message: 'No staged files'
                });
            }

            const allFindings = [];
            for (const rel of stagedFiles.slice(0, 200)) {
                const abs = path.join(root, rel);
                if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
                try {
                    const r = scanFileOnDisk(root, rel);
                    for (const f of r.findings || []) {
                        allFindings.push({ ...f, filePath: rel });
                    }
                } catch {
                    // skip binary or unreadable
                }
            }

            const blockingCount = allFindings.filter(
                (f) => f.severity === 'high' || f.severity === 'critical'
            ).length;

            const { recordScanResult } = require('../../lib/agent-session');
            recordScanResult(root, {
                gatePass: blockingCount === 0,
                findings: allFindings
            });

            return formatToolResult(attachGateMetadata({
                stagedFileCount: stagedFiles.length,
                findingCount: allFindings.length,
                findings: allFindings.slice(0, 20),
                localOnly: true,
                methodology: 'Gate rules on git staged files only'
            }, { gatePass: blockingCount === 0, blockingCount }));
        })),

        agent_status: withTierGuard('agent_status', withGuard((args) => {
            const blocked = tierBlocked('agent_status');
            if (blocked) return blocked;

            const root = resolveProjectRoot(args.projectRoot);
            let session = readAgentSession(root);

            if (args.patch && typeof args.patch === 'object') {
                session = writeAgentSession(root, args.patch);
            }

            let gatePass = session.lastGatePass;
            try {
                const { readGateStatus } = require('../../lib/snippet-scanner');
                const gate = readGateStatus(root, { limit: 1 });
                if (gate.ok) gatePass = gate.gatePass;
            } catch {
                // ignore
            }

            return formatToolResult({
                agentExperience: '11/10',
                lastGatePass: gatePass,
                openFindings: session.openFindings || [],
                fixedThisSession: session.fixedThisSession || [],
                scanWatermark: session.scanWatermark,
                updatedAt: session.updatedAt,
                nextAction: buildNextAction(session, { gatePass }),
                methodology: 'Local session file — .simplebeacon/agent-session.json'
            });
        })),

        handoff_check: withGuard((args) => {
            const root = resolveProjectRoot(args.projectRoot);
            const { readGateStatus } = require('../../lib/snippet-scanner');
            const tierCtx = resolveAgentTier();
            const gate = readGateStatus(root, { limit: 12 });
            const session = readAgentSession(root);

            if (!gate.ok) {
                return formatToolResult({
                    ready: false,
                    gatePass: false,
                    blockingCount: null,
                    error: gate.error,
                    reportPath: gate.reportPath,
                    nextAction: 'Run scan_project with gate:true, then call handoff_check again.',
                    message: 'Do not claim task complete — no gate report found.',
                    agentExperience: tierCtx.paid ? '11/10' : '2/10'
                });
            }

            const ready = gate.gatePass === true && gate.blockingCount === 0;
            const nextAction = buildNextAction(session, { gatePass: gate.gatePass });

            return formatToolResult({
                ready,
                gatePass: gate.gatePass,
                blockingCount: gate.blockingCount,
                topBlocking: gate.topBlocking || [],
                nextAction,
                message: ready
                    ? 'Handoff allowed — run scan_staged before opening a PR.'
                    : 'Do not claim task complete until gate passes.',
                agentExperience: tierCtx.paid ? '11/10' : '2/10',
                methodology: 'Reads .simplebeacon/report.json gate metadata — local only'
            });
        })
    };
}

module.exports = { createAgentLoopHandlers };
