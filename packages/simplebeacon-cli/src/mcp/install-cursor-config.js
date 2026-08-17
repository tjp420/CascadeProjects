/**
 * Write Cursor MCP config so users can enable Simplebeacon without monorepo paths.
 * Merges the simplebeacon server into an existing .cursor/mcp.json instead of skipping.
 */

const fs = require('fs');
const path = require('path');

function detectMcpMode(projectRoot, options = {}) {
    if (options.mode) return options.mode;
    const root = path.resolve(projectRoot || process.cwd());
    if (fs.existsSync(path.join(root, 'packages', 'simplebeacon-cli', 'bin', 'simplebeacon-mcp.js'))) {
        return 'monorepo';
    }
    if (
        fs.existsSync(path.join(root, 'node_modules', '.bin', 'simplebeacon-mcp')) ||
        fs.existsSync(path.join(root, 'node_modules', '.bin', 'simplebeacon-mcp.cmd')) ||
        fs.existsSync(path.join(root, 'node_modules', 'simplebeacon', 'bin', 'simplebeacon-mcp.js'))
    ) {
        return 'npx-local';
    }
    return 'npx-github';
}

function resolveMcpCommand(options = {}) {
    const mode = options.mode || 'npx-local';

    if (mode === 'monorepo') {
        return {
            command: 'node',
            args: ['packages/simplebeacon-cli/bin/simplebeacon-mcp.js', '--offline']
        };
    }

    if (mode === 'npx-github') {
        return {
            command: 'npx',
            args: ['--yes', '-p', 'simplebeacon', 'simplebeacon-mcp', '--offline']
        };
    }

    return {
        command: 'npx',
        args: ['simplebeacon-mcp', '--offline']
    };
}

function buildCursorMcpJson(options = {}) {
    const { command, args } = resolveMcpCommand(options);
    const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : '${workspaceFolder}';
    const env = {
        SIMPLEBEACON_PROJECT_ROOT: projectRoot,
        SIMPLEBEACON_OFFLINE: '1'
    };
    if (options.licenseToken) {
        env.SIMPLEBEACON_LICENSE_TOKEN = options.licenseToken;
    }
    return {
        mcpServers: {
            simplebeacon: {
                command,
                args,
                env
            }
        }
    };
}

function buildClaudeDesktopMcpJson(options = {}) {
    return buildCursorMcpJson(options);
}

function installCursorMcpConfig(projectRoot, options = {}) {
    const root = path.resolve(projectRoot);
    const cursorDir = path.join(root, '.cursor');
    const configPath = path.join(cursorDir, 'mcp.json');
    const force = Boolean(options.force);
    const dryRun = Boolean(options.dryRun);
    const mode = detectMcpMode(root, options);
    const incoming = buildCursorMcpJson({ ...options, mode, projectRoot: root });
    const server = incoming.mcpServers.simplebeacon;

    let existing = { mcpServers: {} };
    let hadFile = false;
    if (fs.existsSync(configPath) && !force) {
        hadFile = true;
        try {
            const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (parsed && typeof parsed === 'object') {
                existing = parsed;
                if (!existing.mcpServers || typeof existing.mcpServers !== 'object') {
                    existing.mcpServers = {};
                }
            }
        } catch {
            existing = { mcpServers: {} };
        }
        const prev = existing.mcpServers.simplebeacon;
        if (prev && JSON.stringify(prev) === JSON.stringify(server)) {
            return {
                skipped: true,
                unchanged: true,
                configPath,
                mode,
                message: 'simplebeacon MCP already configured'
            };
        }
    }

    existing.mcpServers = existing.mcpServers || {};
    existing.mcpServers.simplebeacon = server;
    const payload = `${JSON.stringify(existing, null, 2)}\n`;

    if (dryRun) {
        return { dryRun: true, configPath, wouldWrite: payload, mode };
    }

    fs.mkdirSync(cursorDir, { recursive: true });
    fs.writeFileSync(configPath, payload, 'utf8');

    return {
        created: !hadFile,
        merged: hadFile,
        configPath,
        mode
    };
}

const HOOKS_TEMPLATE = path.join(__dirname, '..', '..', 'examples', 'cursor', 'hooks.json');
const HOOK_SCRIPT_TEMPLATE = path.join(__dirname, '..', '..', 'examples', 'cursor', 'hooks', 'simplebeacon-pre-edit-scan.cjs');

function installCursorHooks(projectRoot, options = {}) {
    const root = path.resolve(projectRoot);
    const hooksJsonPath = path.join(root, '.cursor', 'hooks.json');
    const hookScriptPath = path.join(root, '.cursor', 'hooks', 'simplebeacon-pre-edit-scan.cjs');
    const force = Boolean(options.force);
    const dryRun = Boolean(options.dryRun);

    if (!options.withHooks) {
        return { skipped: true, reason: 'withHooks not set' };
    }

    if (!fs.existsSync(HOOKS_TEMPLATE) || !fs.existsSync(HOOK_SCRIPT_TEMPLATE)) {
        return { skipped: true, error: 'Hook templates missing in package' };
    }

    if (fs.existsSync(hooksJsonPath) && !force) {
        return { skipped: true, path: hooksJsonPath, message: 'hooks.json already exists' };
    }

    const hooksJson = fs.readFileSync(HOOKS_TEMPLATE, 'utf8');
    const hookScript = fs.readFileSync(HOOK_SCRIPT_TEMPLATE, 'utf8');

    if (dryRun) {
        return { dryRun: true, hooksJsonPath, hookScriptPath };
    }

    fs.mkdirSync(path.dirname(hookScriptPath), { recursive: true });
    fs.writeFileSync(hookScriptPath, hookScript, 'utf8');
    fs.writeFileSync(hooksJsonPath, hooksJson, 'utf8');
    return { created: true, hooksJsonPath, hookScriptPath };
}

module.exports = {
    buildCursorMcpJson,
    buildClaudeDesktopMcpJson,
    installCursorMcpConfig,
    installCursorHooks,
    resolveMcpCommand,
    detectMcpMode
};
