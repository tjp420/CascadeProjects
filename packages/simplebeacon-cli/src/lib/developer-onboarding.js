/**
 * One-command developer onboarding: MCP config, Cursor rule, CI pipeline workflows.
 * Supports GitHub Actions, GitLab CI, and Bitbucket Pipelines with auto-detection.
 */

const fs = require("fs");
const path = require("path");
const {
  installCursorMcpConfig,
  installVscodeMcpConfig,
  installClaudeDesktopMcpConfig,
} = require("../mcp/install-cursor-config");

const PACKAGE_ROOT = path.join(__dirname, "..", "..");
const CURSOR_RULE_TEMPLATE = path.join(
  PACKAGE_ROOT,
  "examples",
  "cursor",
  "simplebeacon-scan-workflow.mdc",
);

// CI platform templates and target paths
const CI_PLATFORMS = {
  "github-actions": {
    template: path.join(
      PACKAGE_ROOT,
      "examples",
      "github-action",
      "simplebeacon.yml",
    ),
    targetPath: (root) =>
      path.join(root, ".github", "workflows", "simplebeacon.yml"),
    detectFiles: [".github/workflows"],
    label: "GitHub Actions",
  },
  "gitlab-ci": {
    template: path.join(
      PACKAGE_ROOT,
      "examples",
      "gitlab-ci",
      ".gitlab-ci.yml",
    ),
    targetPath: (root) => path.join(root, ".gitlab-ci.yml"),
    detectFiles: [".gitlab-ci.yml"],
    label: "GitLab CI",
  },
  "bitbucket-pipelines": {
    template: path.join(
      PACKAGE_ROOT,
      "examples",
      "bitbucket-pipelines",
      "bitbucket-pipelines.yml",
    ),
    targetPath: (root) => path.join(root, "bitbucket-pipelines.yml"),
    detectFiles: ["bitbucket-pipelines.yml"],
    label: "Bitbucket Pipelines",
  },
};

// Backward-compatible alias
const CI_WORKFLOW_TEMPLATE = CI_PLATFORMS["github-actions"].template;

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
  fs.writeFileSync(filePath, content, "utf8");
  return { created: true, path: filePath };
}

/**
 * Auto-detect which CI platform is in use by checking for existing config files.
 * @param {string} projectRoot
 * @returns {string|null} Platform key or null if none detected.
 */
function detectCiPlatform(projectRoot) {
  const root = path.resolve(projectRoot);
  for (const [key, config] of Object.entries(CI_PLATFORMS)) {
    for (const detectFile of config.detectFiles) {
      if (fs.existsSync(path.join(root, detectFile))) {
        return key;
      }
    }
  }
  // Default to GitHub Actions (most common)
  return "github-actions";
}

function installCursorRule(projectRoot, options = {}) {
  const target = path.join(
    path.resolve(projectRoot),
    ".cursor",
    "rules",
    "simplebeacon-scan-workflow.mdc",
  );
  const content = fs.readFileSync(CURSOR_RULE_TEMPLATE, "utf8");
  return writeIfAbsentOrForce(target, content, options);
}

/**
 * Install a CI workflow for the specified platform.
 * @param {string} projectRoot
 * @param {Object} options - { platform, force, dryRun }
 * @returns {Object} Result with created/skipped/dryRun status and platform info.
 */
function installCiWorkflow(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const platform = options.platform || detectCiPlatform(root);
  const config = CI_PLATFORMS[platform];

  if (!config) {
    return {
      skipped: true,
      path: null,
      error: `Unknown CI platform: ${platform}. Available: ${Object.keys(CI_PLATFORMS).join(", ")}`,
    };
  }

  const target = config.targetPath(root);
  const content = fs.readFileSync(config.template, "utf8");
  const result = writeIfAbsentOrForce(target, content, options);
  return { ...result, platform, platformLabel: config.label };
}

function installVscodeCopilotInstructions(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const githubDir = path.join(root, ".github");
  const targetPath = path.join(githubDir, "copilot-instructions.md");
  const force = Boolean(options.force);
  const dryRun = Boolean(options.dryRun);
  const content = `# SimpleBeacon Scan Workflow\n\nThis repository includes a SimpleBeacon Scan Workflow that integrates with the scan_snippet tool.\n\nUse scan_snippet to scan code samples before applying them.\n`;

  if (fs.existsSync(targetPath) && !force) {
    return { skipped: true, path: targetPath };
  }

  if (dryRun) {
    return { dryRun: true, path: targetPath, wouldWrite: content };
  }

  fs.mkdirSync(githubDir, { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
  return { created: true, path: targetPath };
}

function installDeveloperStack(projectRoot, options = {}) {
  const results = {
    mcp: null,
    cursorRule: null,
    ciWorkflow: null,
    vscodeMcp: null,
    vscodeCopilotInstructions: null,
    claudeDesktop: null,
  };

  // Determine which targets to install.
  // options.target can be: "cursor", "vscode", "claude", "copilot", "all", or an array.
  // Default (no target): install Cursor MCP + Cursor rule (backward compatible).
  const target = options.target || (options.withMcp ? "cursor" : null);
  const targets = Array.isArray(target)
    ? target
    : target
      ? [target]
      : options.withMcp
        ? ["cursor"]
        : [];

  // "all" expands to every supported target
  if (targets.includes("all")) {
    targets.push("cursor", "vscode", "claude", "copilot");
  }

  const wantCursor = targets.includes("cursor") || options.withMcp;
  const wantVscode = targets.includes("vscode") || options.withVscode;
  const wantClaude = targets.includes("claude");
  const wantCopilot = targets.includes("copilot") || options.withVscode;

  // Cursor MCP config (.cursor/mcp.json)
  if (wantCursor) {
    results.mcp = installCursorMcpConfig(projectRoot, options);
  }

  // Cursor rule (.cursor/rules/simplebeacon-scan-workflow.mdc)
  if (wantCursor || options.withCursorRule) {
    results.cursorRule = installCursorRule(projectRoot, options);
  }

  // CI workflow
  if (options.withCi) {
    results.ciWorkflow = installCiWorkflow(projectRoot, options);
  }

  // VS Code MCP config (.vscode/mcp.json)
  if (wantVscode) {
    results.vscodeMcp = installVscodeMcpConfig(projectRoot, options);
  }

  // GitHub Copilot instructions (.github/copilot-instructions.md)
  if (wantCopilot) {
    results.vscodeCopilotInstructions = installVscodeCopilotInstructions(
      projectRoot,
      options,
    );
  }

  // Claude Desktop config (~/Library/Application Support/Claude/...)
  if (wantClaude) {
    results.claudeDesktop = installClaudeDesktopMcpConfig(projectRoot, options);
  }

  return results;
}

module.exports = {
  installCursorRule,
  installCiWorkflow,
  installDeveloperStack,
  detectCiPlatform,
  CI_PLATFORMS,
  CURSOR_RULE_TEMPLATE,
  CI_WORKFLOW_TEMPLATE,
  installVscodeCopilotInstructions,
};
