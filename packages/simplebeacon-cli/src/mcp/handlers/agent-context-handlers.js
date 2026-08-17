/**
 * MCP agent context handlers — get_agent_brief, get_context_pack
 */

const fs = require('fs');
const path = require('path');
const { formatAgentBrief, pickIssues } = require('../../lib/agent-brief');
const { buildContextPack, formatContextPackMarkdown, readReport, writeAiContext } = require('../../lib/agent-context-pack');
const { resolveAgentTier } = require('../../lib/agent-tier-capabilities');

function createAgentContextHandlers({ withGuard, resolveProjectRoot, formatToolResult, formatMarkdownResult, getCachedReport }) {
    return {
        get_agent_brief: withGuard(({ projectRoot, task, writeDisk }) => {
            const root = resolveProjectRoot(projectRoot);
            const tierCtx = resolveAgentTier();
            let report = getCachedReport(root) || readReport(root);
            const markdown = formatAgentBrief(report || {}, {
                paid: tierCtx.paid,
                projectRoot: root
            });
            if (writeDisk === true) {
                const briefPath = path.join(root, '.simplebeacon', 'agent-brief.md');
                fs.mkdirSync(path.dirname(briefPath), { recursive: true });
                fs.writeFileSync(briefPath, markdown, 'utf8');
            }
            return formatToolResult({
                markdown,
                gatePass: report?.gate?.pass ?? null,
                blockingCount: report?.gate?.blockingCount ?? pickIssues(report).filter((i) => /high|critical/i.test(i.severity || '')).length,
                tier: tierCtx.tier,
                agentExperience: tierCtx.paid ? '11/10' : '2/10',
                path: writeDisk ? path.join(root, '.simplebeacon', 'agent-brief.md') : null
            });
        }),

        get_context_pack: withGuard(({ projectRoot, task, format, writeDisk }) => {
            const root = resolveProjectRoot(projectRoot);
            const tierCtx = resolveAgentTier();
            const report = getCachedReport(root) || readReport(root);
            const pack = buildContextPack(root, {
                task,
                report,
                paid: tierCtx.paid
            });
            if (writeDisk === true) {
                writeAiContext(root, { task, report, paid: tierCtx.paid });
            }
            if (format === 'markdown') {
                return formatMarkdownResult('SimpleBeacon context pack', formatContextPackMarkdown(pack));
            }
            return formatToolResult(pack);
        })
    };
}

module.exports = { createAgentContextHandlers };
