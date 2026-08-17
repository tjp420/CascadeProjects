/**
 * Host adapters — wire SimpleBeacon MCP + instructions for Cursor, Windsurf, Continue, Claude, universal.
 */

const fs = require('fs');
const path = require('path');
const {
    buildCursorMcpJson,
    buildClaudeDesktopMcpJson,
    detectMcpMode,
    resolveMcpCommand
} = require('../mcp/install-cursor-config');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const INSTRUCTION_PAID = path.join(PACKAGE_ROOT, 'examples', 'agent', 'simplebeacon-ai-workflow-paid.md');
const INSTRUCTION_FREE = path.join(PACKAGE_ROOT, 'examples', 'agent', 'simplebeacon-ai-workflow-free.md');
const INSTRUCTION_SUPERCHARGE = path.join(PACKAGE_ROOT, 'examples', 'agent', 'simplebeacon-ai-workflow-supercharge.md');
const SECTION_MARKER = '## SimpleBeacon';

const ALL_HOST_IDS = ['cursor', 'windsurf', 'continue', 'claude', 'cline', 'copilot', 'aider', 'roo', 'opencode', 'zed', 'universal'];

const HOST_REGISTRY = Object.freeze({
    cursor: {
        id: 'cursor',
        label: 'Cursor',
        mcpConfigPath: '.cursor/mcp.json',
        mcpRootKey: 'mcpServers',
        mcpServerKey: 'simplebeacon',
        instructionPath: '.cursor/rules/simplebeacon-ai-workflow.mdc',
        instructionKind: 'mdc',
        supportsMcp: true
    },
    windsurf: {
        id: 'windsurf',
        label: 'Windsurf',
        mcpConfigPath: '.windsurf/mcp.json',
        mcpRootKey: 'mcpServers',
        mcpServerKey: 'simplebeacon',
        instructionPath: '.windsurf/rules/simplebeacon.md',
        instructionKind: 'markdown',
        supportsMcp: true
    },
    continue: {
        id: 'continue',
        label: 'Continue',
        mcpConfigPath: '.continue/config.json',
        mcpRootKey: 'experimental.modelContextProtocolServers',
        mcpServerKey: 'simplebeacon',
        instructionPath: '.continue/rules/simplebeacon.md',
        instructionKind: 'markdown',
        supportsMcp: true,
        continueMcpFormat: true
    },
    claude: {
        id: 'claude',
        label: 'Claude Code / Desktop',
        mcpConfigPath: null,
        instructionPath: 'CLAUDE.md',
        instructionKind: 'append-section',
        supportsMcp: false
    },
    cline: {
        id: 'cline',
        label: 'Cline',
        mcpConfigPath: '.cursor/mcp.json',
        mcpRootKey: 'mcpServers',
        mcpServerKey: 'simplebeacon',
        instructionPath: '.cursor/rules/simplebeacon-ai-workflow.mdc',
        instructionKind: 'mdc',
        supportsMcp: true,
        sharesCursorMcp: true,
        sharesCursorRule: true
    },
    copilot: {
        id: 'copilot',
        label: 'GitHub Copilot',
        mcpConfigPath: null,
        instructionPath: '.github/copilot-instructions.md',
        instructionKind: 'markdown',
        supportsMcp: false
    },
    aider: {
        id: 'aider',
        label: 'Aider',
        mcpConfigPath: null,
        instructionPath: 'CONVENTIONS.md',
        instructionKind: 'append-section',
        supportsMcp: false
    },
    roo: {
        id: 'roo',
        label: 'Roo Code',
        mcpConfigPath: '.cursor/mcp.json',
        mcpRootKey: 'mcpServers',
        mcpServerKey: 'simplebeacon',
        instructionPath: '.roo/rules/simplebeacon.md',
        instructionKind: 'markdown',
        supportsMcp: true,
        sharesCursorMcp: true
    },
    opencode: {
        id: 'opencode',
        label: 'OpenCode',
        mcpConfigPath: '.opencode/config.json',
        mcpRootKey: 'mcpServers',
        mcpServerKey: 'simplebeacon',
        instructionPath: '.opencode/simplebeacon.md',
        instructionKind: 'markdown',
        supportsMcp: true
    },
    zed: {
        id: 'zed',
        label: 'Zed',
        mcpConfigPath: null,
        instructionPath: '.zed/simplebeacon.md',
        instructionKind: 'markdown',
        supportsMcp: false
    },
    universal: {
        id: 'universal',
        label: 'Universal (AGENTS.md)',
        mcpConfigPath: '.simplebeacon/mcp-reference.json',
        mcpRootKey: 'mcpServers',
        mcpServerKey: 'simplebeacon',
        instructionPath: 'AGENTS.md',
        instructionKind: 'append-section',
        supportsMcp: true
    }
});

function parseHostsOption(hosts) {
    const raw = String(hosts || 'all').trim().toLowerCase();
    if (raw === 'all' || raw === 'auto') {
        return [...ALL_HOST_IDS];
    }
    return raw.split(/[,;\s]+/)
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => {
            if (h === 'claude-desktop') return 'claude';
            return h;
        })
        .filter((h) => HOST_REGISTRY[h]);
}

function buildMcpServerEntry(projectRoot, options = {}) {
    const root = path.resolve(projectRoot);
    const mode = detectMcpMode(root, options);
    const incoming = buildCursorMcpJson({ ...options, mode, projectRoot: root });
    return incoming.mcpServers.simplebeacon;
}

function readJsonFile(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function writeJsonFile(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function setNested(obj, keyPath, value) {
    const parts = keyPath.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
        cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
}

function getNested(obj, keyPath) {
    const parts = keyPath.split('.');
    let cur = obj;
    for (const p of parts) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = cur[p];
    }
    return cur;
}

function formatContinueMcpEntry(server) {
    return {
        name: 'simplebeacon',
        command: server.command,
        args: server.args || [],
        env: server.env || {}
    };
}

function mergeContinueMcpConfig(existing, server) {
    const out = existing && typeof existing === 'object' ? { ...existing } : {};
    if (!out.experimental || typeof out.experimental !== 'object') {
        out.experimental = {};
    }
    const list = Array.isArray(out.experimental.modelContextProtocolServers)
        ? [...out.experimental.modelContextProtocolServers]
        : [];
    const entry = formatContinueMcpEntry(server);
    const idx = list.findIndex((s) => s && s.name === 'simplebeacon');
    if (idx >= 0) {
        if (JSON.stringify(list[idx]) === JSON.stringify(entry)) {
            return { config: out, unchanged: true };
        }
        list[idx] = entry;
    } else {
        list.push(entry);
    }
    out.experimental.modelContextProtocolServers = list;
    if (!out.mcpServers || typeof out.mcpServers !== 'object') {
        out.mcpServers = {};
    }
    out.mcpServers.simplebeacon = server;
    return { config: out, unchanged: false };
}

function mergeStandardMcpConfig(existing, rootKey, serverKey, server) {
    const out = existing && typeof existing === 'object' ? { ...existing } : {};
    if (!out[rootKey] || typeof out[rootKey] !== 'object') {
        out[rootKey] = {};
    }
    const prev = out[rootKey][serverKey];
    if (prev && JSON.stringify(prev) === JSON.stringify(server)) {
        return { config: out, unchanged: true };
    }
    out[rootKey][serverKey] = server;
    return { config: out, unchanged: false };
}

function loadInstructionBody(paidTier, options = {}) {
    if (options.supercharge) {
        return fs.readFileSync(INSTRUCTION_SUPERCHARGE, 'utf8').trim();
    }
    const template = paidTier ? INSTRUCTION_PAID : INSTRUCTION_FREE;
    return fs.readFileSync(template, 'utf8').trim();
}

function wrapCursorMdc(body, paidTier, supercharge) {
    const tier = supercharge
        ? 'supercharge — any coding agent plugin'
        : (paidTier ? 'paid 11/10' : 'free 2/10 preview');
    return [
        '---',
        `description: SimpleBeacon AI agent workflow — ${tier} (local-only)`,
        'alwaysApply: true',
        '---',
        '',
        body,
        ''
    ].join('\n');
}

function buildInstructionContent(host, body, paidTier, supercharge) {
    if (host.instructionKind === 'mdc') {
        return wrapCursorMdc(body, paidTier, supercharge);
    }
    if (host.instructionKind === 'markdown') {
        return `${body}\n`;
    }
    if (host.instructionKind === 'append-section') {
        return `\n${SECTION_MARKER}\n\n${body}\n`;
    }
    return body;
}

function fileHasSection(content, marker) {
    return content.includes(marker);
}

function installHostInstructions(hostId, projectRoot, options = {}) {
    const host = HOST_REGISTRY[hostId];
    if (!host || !host.instructionPath) {
        return { skipped: true, host: hostId, reason: 'no instruction path' };
    }

    const root = path.resolve(projectRoot);
    const target = path.join(root, host.instructionPath);
    const force = Boolean(options.force);
    const dryRun = Boolean(options.dryRun);
    const body = loadInstructionBody(Boolean(options.paidTier), options);
    const content = buildInstructionContent(host, body, Boolean(options.paidTier), Boolean(options.supercharge));

    if (host.instructionKind === 'append-section') {
        let existing = '';
        if (fs.existsSync(target)) {
            existing = fs.readFileSync(target, 'utf8');
            if (fileHasSection(existing, SECTION_MARKER) && !force) {
                return { skipped: true, unchanged: true, host: hostId, path: target };
            }
            if (fileHasSection(existing, SECTION_MARKER) && force) {
                const idx = existing.indexOf(SECTION_MARKER);
                existing = existing.slice(0, idx).trimEnd();
            }
        } else if (!force && hostId === 'universal' && fs.existsSync(path.join(root, 'AGENTS.md'))) {
            // handled above via target path
        }
        const merged = existing ? `${existing.trimEnd()}${content}` : `# ${host.label} agent notes\n${content}`;
        if (dryRun) {
            return { dryRun: true, host: hostId, path: target, wouldWrite: merged };
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, merged.endsWith('\n') ? merged : `${merged}\n`, 'utf8');
        return { created: !fs.existsSync(target), merged: Boolean(existing), host: hostId, path: target };
    }

    if (host.sharesCursorRule && hostId !== 'cursor') {
        const cursorRule = path.join(root, '.cursor', 'rules', 'simplebeacon-ai-workflow.mdc');
        if (fs.existsSync(cursorRule) && !force) {
            return { skipped: true, unchanged: true, host: hostId, path: cursorRule, note: 'uses cursor rule' };
        }
    }

    if (fs.existsSync(target) && !force) {
        return { skipped: true, unchanged: true, host: hostId, path: target };
    }
    if (dryRun) {
        return { dryRun: true, host: hostId, path: target, wouldWrite: content };
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    return { created: true, host: hostId, path: target };
}

function installHostMcp(hostId, projectRoot, options = {}) {
    const host = HOST_REGISTRY[hostId];
    if (!host || !host.supportsMcp || !host.mcpConfigPath) {
        return { skipped: true, host: hostId, reason: 'mcp not supported' };
    }

    const root = path.resolve(projectRoot);
    const configPath = path.join(root, host.mcpConfigPath);
    const force = Boolean(options.force);
    const dryRun = Boolean(options.dryRun);
    const server = buildMcpServerEntry(root, options);
    const hadFile = fs.existsSync(configPath);

    let existing = {};
    if (hadFile && !force) {
        existing = readJsonFile(configPath, {});
    }

    let mergeResult;
    if (host.continueMcpFormat) {
        mergeResult = mergeContinueMcpConfig(existing, server);
    } else {
        mergeResult = mergeStandardMcpConfig(existing, host.mcpRootKey, host.mcpServerKey, server);
    }

    if (mergeResult.unchanged && hadFile && !force) {
        return {
            skipped: true,
            unchanged: true,
            host: hostId,
            configPath,
            mode: detectMcpMode(root, options)
        };
    }

    const payload = `${JSON.stringify(mergeResult.config, null, 2)}\n`;
    if (dryRun) {
        return { dryRun: true, host: hostId, configPath, wouldWrite: payload, mode: detectMcpMode(root, options) };
    }

    writeJsonFile(configPath, mergeResult.config);
    return {
        created: !hadFile,
        merged: hadFile,
        host: hostId,
        configPath,
        mode: detectMcpMode(root, options)
    };
}

function installAgentHosts(projectRoot, options = {}) {
    const hostIds = parseHostsOption(options.hosts);
    const withMcp = options.withMcp !== false;
    const withInstructions = options.withInstructions !== false;
    const results = [];

    for (const hostId of hostIds) {
        const entry = { host: hostId, label: HOST_REGISTRY[hostId]?.label || hostId, mcp: null, instructions: null };
        if (withMcp) {
            entry.mcp = installHostMcp(hostId, projectRoot, options);
        }
        if (withInstructions) {
            entry.instructions = installHostInstructions(hostId, projectRoot, options);
        }
        results.push(entry);
    }

    return results;
}

function getClaudeDesktopSetupHint(projectRoot, options = {}) {
    const json = buildClaudeDesktopMcpJson({ ...options, projectRoot: path.resolve(projectRoot) });
    return {
        message: 'Add simplebeacon to Claude Desktop config (user-level, not written automatically):',
        configSnippet: json,
        docsPath: 'https://modelcontextprotocol.io/quickstart/user'
    };
}

module.exports = {
    ALL_HOST_IDS,
    HOST_REGISTRY,
    INSTRUCTION_PAID,
    INSTRUCTION_FREE,
    INSTRUCTION_SUPERCHARGE,
    SECTION_MARKER,
    parseHostsOption,
    buildMcpServerEntry,
    loadInstructionBody,
    installHostMcp,
    installHostInstructions,
    installAgentHosts,
    getClaudeDesktopSetupHint,
    mergeStandardMcpConfig,
    mergeContinueMcpConfig
};
