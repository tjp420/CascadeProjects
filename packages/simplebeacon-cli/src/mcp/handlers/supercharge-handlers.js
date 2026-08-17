/**
 * MCP supercharge handlers — supercharge_agent, install_agent_plugin
 */

const { buildAgentSupercharge, formatSuperchargeMarkdown, writeAgentSupercharge } = require('../../lib/agent-supercharge');
const { installAgentHosts, getClaudeDesktopSetupHint, parseHostsOption } = require('../../lib/agent-host-adapters');
const { resolveAgentTier } = require('../../lib/agent-tier-capabilities');

function createSuperchargeHandlers({ withGuard, resolveProjectRoot, formatToolResult, formatMarkdownResult }) {
    return {
        supercharge_agent: withGuard(({ projectRoot, task, format, writeDisk, includeGit }) => {
            const root = resolveProjectRoot(projectRoot);
            const tierCtx = resolveAgentTier();
            const bundle = buildAgentSupercharge(root, {
                task,
                tierCtx,
                paid: tierCtx.paid,
                includeGit: includeGit !== false,
                workspaceRoot: process.env.SIMPLEBEACON_PROJECT_ROOT || undefined
            });

            if (writeDisk === true) {
                writeAgentSupercharge(root, { task, tierCtx, paid: tierCtx.paid });
            }

            if (format === 'markdown') {
                return formatMarkdownResult('SimpleBeacon Agent Supercharge', formatSuperchargeMarkdown(bundle));
            }

            return formatToolResult(bundle);
        }),

        install_agent_plugin: withGuard(({ projectRoot, hosts, force, supercharge, paidTier, withMcp, withInstructions, dryRun }) => {
            const root = resolveProjectRoot(projectRoot);
            const hostIds = parseHostsOption(hosts || 'all');
            const results = installAgentHosts(root, {
                hosts: hostIds.join(','),
                force: force === true,
                dryRun: dryRun === true,
                supercharge: supercharge !== false,
                paidTier: paidTier === true,
                withMcp: withMcp !== false,
                withInstructions: withInstructions !== false
            });

            const claudeHint = getClaudeDesktopSetupHint(root, { projectRoot: root });

            return formatToolResult({
                ok: true,
                projectRoot: root,
                hosts: hostIds,
                supercharge: supercharge !== false,
                results,
                claudeDesktop: claudeHint,
                reloadHint: 'Reload your IDE window so the SimpleBeacon MCP server connects.',
                verifyCommand: 'Call supercharge_agent to confirm hostStatus.detected is non-empty.'
            });
        })
    };
}

module.exports = { createSuperchargeHandlers };
