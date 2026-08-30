/**
 * Write Cursor MCP config so users can enable Simplebeacon without monorepo paths.
 */

const fs = require("fs");
const path = require("path");

function resolveMcpCommand(options = {}) {
  const mode = options.mode || "npx-local";

  if (mode === "monorepo") {
    return {
      command: "node",
      args: ["packages/simplebeacon-cli/bin/simplebeacon-mcp.js", "--offline"],
    };
  }

  if (mode === "npx-github") {
    // Zero-install: package name is simplebeacon; bin is simplebeacon-mcp
    return {
      command: "npx",
      args: ["--yes", "-p", "simplebeacon", "simplebeacon-mcp", "--offline"],
    };
  }

  // Default: devDependency installed — npx resolves bin from node_modules/.bin
  return {
    command: "npx",
    args: ["simplebeacon-mcp", "--offline"],
  };
}

function buildCursorMcpJson(options = {}) {
  const { command, args } = resolveMcpCommand(options);
  return {
    mcpServers: {
      simplebeacon: {
        command,
        args,
        env: {
          SIMPLEBEACON_PROJECT_ROOT: "${workspaceFolder}",
          SIMPLEBEACON_OFFLINE: "1",
        },
      },
    },
  };
}

function buildClaudeDesktopMcpJson(options = {}) {
  const { command, args } = resolveMcpCommand(options);
  return {
    mcpServers: {
      simplebeacon: {
        command,
        args,
        env: {
          SIMPLEBEACON_PROJECT_ROOT: "${workspaceFolder}",
          SIMPLEBEACON_OFFLINE: "1",
        },
      },
    },
  };
}

function installCursorMcpConfig(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const cursorDir = path.join(root, ".cursor");
  const configPath = path.join(cursorDir, "mcp.json");
  const force = Boolean(options.force);
  const dryRun = Boolean(options.dryRun);

  if (fs.existsSync(configPath) && !force) {
    return {
      skipped: true,
      configPath,
      message: "Existing .cursor/mcp.json — use --force to overwrite",
    };
  }

  const payload = `${JSON.stringify(buildCursorMcpJson(options), null, 2)}\n`;

  if (dryRun) {
    return { dryRun: true, configPath, wouldWrite: payload };
  }

  fs.mkdirSync(cursorDir, { recursive: true });
  fs.writeFileSync(configPath, payload, "utf8");

  return {
    created: true,
    configPath,
    mode: options.mode || "npx-local",
  };
}

// Backward-compatible wrappers for VS Code naming used in older tests / callers
function buildVscodeMcpJson(options = {}) {
  return buildCursorMcpJson(options);
}

function installVscodeMcpConfig(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const vscodeDir = path.join(root, ".vscode");
  const configPath = path.join(vscodeDir, "mcp.json");
  const force = Boolean(options.force);
  const dryRun = Boolean(options.dryRun);

  if (fs.existsSync(configPath) && !force) {
    return {
      skipped: true,
      configPath,
      message: "Existing .vscode/mcp.json — use --force to overwrite",
    };
  }

  const payload = `${JSON.stringify(buildCursorMcpJson(options), null, 2)}\n`;

  if (dryRun) {
    return { dryRun: true, configPath, wouldWrite: payload };
  }

  fs.mkdirSync(vscodeDir, { recursive: true });
  fs.writeFileSync(configPath, payload, "utf8");

  return {
    created: true,
    configPath,
    mode: options.mode || "npx-local",
  };
}

/**
 * Install Claude Desktop MCP config.
 * Writes to the Claude Desktop config directory:
 *   - macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
 *   - Windows: %APPDATA%\Claude\claude_desktop_config.json
 *   - Linux:   ~/.config/Claude/claude_desktop_config.json
 *
 * If the file already exists, merges the simplebeacon server entry instead of overwriting.
 * @param {string} projectRoot - Project root (used for SIMPLEBEACON_PROJECT_ROOT env)
 * @param {Object} options - { force, dryRun, mode }
 * @returns {Object} Result with created/skipped/merged status and configPath.
 */
function installClaudeDesktopMcpConfig(projectRoot, options = {}) {
  const os = require("os");
  const force = Boolean(options.force);
  const dryRun = Boolean(options.dryRun);

  // Resolve Claude Desktop config directory per OS
  const platform = process.platform;
  let configDir;
  if (platform === "darwin") {
    configDir = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Claude",
    );
  } else if (platform === "win32") {
    configDir = path.join(process.env.APPDATA || os.homedir(), "Claude");
  } else {
    // Linux / WSL
    configDir = path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
      "Claude",
    );
  }

  const configPath = path.join(configDir, "claude_desktop_config.json");
  const newEntry = buildClaudeDesktopMcpJson(options);

  // If file exists and not forced, merge the simplebeacon server entry
  if (fs.existsSync(configPath) && !force) {
    try {
      const existing = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (existing.mcpServers && existing.mcpServers.simplebeacon) {
        return {
          skipped: true,
          configPath,
          message: "simplebeacon already configured in Claude Desktop config",
        };
      }
      // Merge — preserve existing servers, add simplebeacon
      const merged = {
        ...existing,
        mcpServers: {
          ...(existing.mcpServers || {}),
          simplebeacon: newEntry.mcpServers.simplebeacon,
        },
      };

      if (dryRun) {
        return {
          dryRun: true,
          configPath,
          wouldWrite: JSON.stringify(merged, null, 2),
          action: "merge",
        };
      }

      fs.writeFileSync(
        configPath,
        `${JSON.stringify(merged, null, 2)}\n`,
        "utf8",
      );
      return {
        created: true,
        configPath,
        action: "merged",
        mode: options.mode || "npx-local",
      };
    } catch (mergeErr) {
      // Can't parse existing — fall through to overwrite if forced, else error
      if (!force) {
        return {
          skipped: true,
          configPath,
          message: `Existing config unreadable — use --force to overwrite (${mergeErr.message})`,
        };
      }
    }
  }

  if (dryRun) {
    return {
      dryRun: true,
      configPath,
      wouldWrite: JSON.stringify(newEntry, null, 2),
      action: "create",
    };
  }

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    configPath,
    `${JSON.stringify(newEntry, null, 2)}\n`,
    "utf8",
  );

  return {
    created: true,
    configPath,
    action: "created",
    mode: options.mode || "npx-local",
  };
}

module.exports = {
  buildCursorMcpJson,
  buildClaudeDesktopMcpJson,
  buildVscodeMcpJson,
  installCursorMcpConfig,
  installVscodeMcpConfig,
  installClaudeDesktopMcpConfig,
  resolveMcpCommand,
};
