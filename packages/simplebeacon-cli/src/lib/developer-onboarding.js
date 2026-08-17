/**
 * One-command agent onboarding: MCP configs for all AI hosts, instructions, CI, hooks.
 * Supports GitHub Actions, GitLab CI, and Bitbucket Pipelines with auto-detection.
 */

const fs = require('fs');
const path = require('path');
const { installCursorHooks } = require('../mcp/install-cursor-config');
const { installSimplebeaconHook } = require('../hook-install');
const {
    installAgentHosts,
    getClaudeDesktopSetupHint,
    parseHostsOption
} = require('./agent-host-adapters');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const CURSOR_RULE_TEMPLATE = path.join(PACKAGE_ROOT, 'examples', 'cursor', 'simplebeacon-scan-workflow.mdc');
const CURSOR_RULE_FREE_TEMPLATE = path.join(PACKAGE_ROOT, 'examples', 'cursor', 'simplebeacon-scan-workflow-free.mdc');

const CI_PLATFORMS = {
    'github-actions': {
        template: path.join(PACKAGE_ROOT, 'examples', 'github-action', 'simplebeacon.yml'),
        targetPath: (root) => path.join(root, '.github', 'workflows', 'simplebeacon.yml'),
        detectFiles: ['.github/workflows'],
        label: 'GitHub Actions',
    },
    'gitlab-ci': {
        template: path.join(PACKAGE_ROOT, 'examples', 'gitlab-ci', '.gitlab-ci.yml'),
        targetPath: (root) => path.join(root, '.gitlab-ci.yml'),
        detectFiles: ['.gitlab-ci.yml'],
        label: 'GitLab CI',
    },
    'bitbucket-pipelines': {
        template: path.join(PACKAGE_ROOT, 'examples', 'bitbucket-pipelines', 'bitbucket-pipelines.yml'),
        targetPath: (root) => path.join(root, 'bitbucket-pipelines.yml'),
        detectFiles: ['bitbucket-pipelines.yml'],
        label: 'Bitbucket Pipelines',
    },
};

const CI_WORKFLOW_TEMPLATE = CI_PLATFORMS['github-actions'].template;

function writeIfAbsentOrForce(filePath, content, options = {}) {
    const force = Boolean(options.force);
    const dryRun = Boolean(options.dryRun);

    if (fs.existsSync(filePath) && !force) {
        return { skipped: true, path: filePath };
    }

    if (dryRun) {
        return { dryRun: true, path: filePath, wouldWrite: content };
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return { created: true, path: filePath };
}

function detectCiPlatform(projectRoot) {
    const root = path.resolve(projectRoot);
    for (const [key, config] of Object.entries(CI_PLATFORMS)) {
        for (const detectFile of config.detectFiles) {
            if (fs.existsSync(path.join(root, detectFile))) {
                return key;
            }
        }
    }
    return 'github-actions';
}

/** @deprecated use installAgentStack — kept for tests */
function installCursorRule(projectRoot, options = {}) {
    const target = path.join(path.resolve(projectRoot), '.cursor', 'rules', 'simplebeacon-scan-workflow.mdc');
    const template = options.paidTier ? CURSOR_RULE_TEMPLATE : CURSOR_RULE_FREE_TEMPLATE;
    const content = fs.readFileSync(template, 'utf8');
    return writeIfAbsentOrForce(target, content, options);
}

function installCiWorkflow(projectRoot, options = {}) {
    const root = path.resolve(projectRoot);
    const platform = options.platform || detectCiPlatform(root);
    const config = CI_PLATFORMS[platform];

    if (!config) {
        return { skipped: true, path: null, error: `Unknown CI platform: ${platform}. Available: ${Object.keys(CI_PLATFORMS).join(', ')}` };
    }

    const target = config.targetPath(root);
    const content = fs.readFileSync(config.template, 'utf8');
    const result = writeIfAbsentOrForce(target, content, options);
    return { ...result, platform, platformLabel: config.label };
}

async function runSmokeScan(projectRoot, options = {}) {
    const root = path.resolve(projectRoot);
    if (options.dryRun) {
        return { dryRun: true, skipped: true };
    }
    try {
        const { runScan } = require('../scan');
        const { loadSimplebeaconConfig } = require('../config');
        const config = loadSimplebeaconConfig(root);
        config.gate = config.gate || {};
        config.gate.enabled = true;
        const report = await runScan(root, { config, offline: true, gate: true });
        const reportPath = path.join(root, '.simplebeacon', 'report.json');
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
        return { ok: true, reportPath, gatePass: report.gate?.pass === true, report };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

function refreshArtifacts(projectRoot, report, options = {}) {
    if (options.dryRun) {
        return { dryRun: true, skipped: true };
    }
    const { refreshAgentArtifacts } = require('./agent-context-pack');
    const { resolveAgentTier } = require('./agent-tier-capabilities');
    const tierCtx = resolveAgentTier(options);
    return refreshAgentArtifacts(projectRoot, report || null, {
        paid: tierCtx.paid,
        task: options.task || 'hygiene'
    });
}

/**
 * Universal agent bootstrap — MCP + instructions for all hosts, hooks, CI, artifacts.
 */
function installAgentStack(projectRoot, options = {}) {
    const root = path.resolve(projectRoot);
    const agentMode = Boolean(options.agent || options.starter);
    const hosts = options.hosts || (agentMode ? 'all' : undefined);

    const results = {
        hosts: [],
        cursorHooks: null,
        gitHook: null,
        ciWorkflow: null,
        artifacts: null,
        claudeDesktopHint: null
    };

    const hostOptions = {
        ...options,
        hosts: hosts || 'cursor',
        supercharge: options.supercharge !== false && agentMode,
        withMcp: options.withMcp !== false,
        withInstructions: options.withInstructions !== false
            || options.withCursorRule
            || agentMode
    };

    if (options.withMcp !== false && (agentMode || options.withMcp || hosts)) {
        results.hosts = installAgentHosts(root, hostOptions);
        if (parseHostsOption(hosts || 'all').includes('claude')) {
            results.claudeDesktopHint = getClaudeDesktopSetupHint(root, options);
        }
    } else if (options.withCursorRule) {
        results.hosts = installAgentHosts(root, { ...hostOptions, hosts: 'cursor' });
    }

    const withHooks = options.withHooks === true
        || (agentMode && options.withHooks !== false);

    if (withHooks) {
        results.cursorHooks = installCursorHooks(root, { ...options, withHooks: true });
    }

    if (options.withGitHook !== false && (agentMode || options.withGitHook)) {
        try {
            results.gitHook = installSimplebeaconHook(root, {
                type: 'pre-commit',
                failOn: 'high',
                preferHusky: true,
                dryRun: options.dryRun
            });
        } catch (err) {
            results.gitHook = { skipped: true, error: err.message };
        }
    }

    if (options.withCi) {
        results.ciWorkflow = installCiWorkflow(root, options);
    }

    if (options.refreshArtifacts !== false && agentMode && !options.dryRun) {
        results.artifacts = refreshArtifacts(root, null, options);
    }

    return results;
}

/** @deprecated alias — calls installAgentStack */
function installDeveloperStack(projectRoot, options = {}) {
    const agentMode = Boolean(options.starter);
    const sync = {
        ...options,
        agent: agentMode,
        starter: agentMode,
        hosts: options.hosts || (agentMode ? 'all' : 'cursor'),
        withInstructions: options.withCursorRule || agentMode,
        withGitHook: options.withHooks || agentMode,
        withHooks: options.withHooks || agentMode
    };
    return installAgentStack(projectRoot, sync);
}

module.exports = {
    installCursorRule,
    installCiWorkflow,
    installDeveloperStack,
    installAgentStack,
    detectCiPlatform,
    refreshArtifacts,
    runSmokeScan,
    CI_PLATFORMS,
    CURSOR_RULE_TEMPLATE,
    CURSOR_RULE_FREE_TEMPLATE,
    CI_WORKFLOW_TEMPLATE
};
