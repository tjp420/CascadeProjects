// simplebeacon-ignore: Test file — fixture paths and mock config are false positives
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  buildClaudeDesktopMcpJson,
  installClaudeDesktopMcpConfig,
  resolveMcpCommand,
} = require("../src/mcp/install-cursor-config");

/**
 * Helper: create a temp directory to act as a fake home directory.
 * We override process.env.APPDATA / HOME to redirect the installer.
 */
function createFakeHome() {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "sb-claude-"));
  return fakeHome;
}

/**
 * Get the expected config path for the current platform given a fake home.
 */
function getExpectedConfigPath(fakeHome) {
  if (process.platform === "darwin") {
    return path.join(fakeHome, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "win32") {
    return path.join(fakeHome, "Claude", "claude_desktop_config.json");
  }
  return path.join(fakeHome, ".config", "Claude", "claude_desktop_config.json");
}

/**
 * Set up environment to redirect Claude Desktop config to a fake home.
 */
function redirectHome(fakeHome) {
  const originals = {
    APPDATA: process.env.APPDATA,
    HOME: process.env.HOME,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
  };
  if (process.platform === "win32") {
    process.env.APPDATA = fakeHome;
  } else {
    process.env.HOME = fakeHome;
    process.env.XDG_CONFIG_HOME = path.join(fakeHome, ".config");
  }
  return originals;
}

function restoreHome(originals) {
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

// ─── buildClaudeDesktopMcpJson ────────────────────────────────────────────

describe("buildClaudeDesktopMcpJson", () => {
  test("produces valid MCP server config with simplebeacon entry", () => {
    const json = buildClaudeDesktopMcpJson();
    assert.ok(json.mcpServers);
    assert.ok(json.mcpServers.simplebeacon);
    assert.ok(json.mcpServers.simplebeacon.command);
    assert.ok(Array.isArray(json.mcpServers.simplebeacon.args));
    assert.ok(json.mcpServers.simplebeacon.env);
    assert.equal(json.mcpServers.simplebeacon.env.SIMPLEBEACON_OFFLINE, "1");
  });

  test("respects npx-github mode", () => {
    const json = buildClaudeDesktopMcpJson({ mode: "npx-github" });
    assert.equal(json.mcpServers.simplebeacon.command, "npx");
    assert.ok(json.mcpServers.simplebeacon.args.includes("--yes"));
    assert.ok(json.mcpServers.simplebeacon.args.includes("simplebeacon-mcp"));
  });

  test("respects monorepo mode", () => {
    const json = buildClaudeDesktopMcpJson({ mode: "monorepo" });
    assert.equal(json.mcpServers.simplebeacon.command, "node");
    assert.ok(
      json.mcpServers.simplebeacon.args.some((a) =>
        String(a).includes("simplebeacon-mcp.js"),
      ),
    );
  });

  test("includes SIMPLEBEACON_PROJECT_ROOT env var", () => {
    const json = buildClaudeDesktopMcpJson();
    assert.ok(
      json.mcpServers.simplebeacon.env.SIMPLEBEACON_PROJECT_ROOT !==
        undefined,
    );
  });
});

// ─── installClaudeDesktopMcpConfig ────────────────────────────────────────

describe("installClaudeDesktopMcpConfig", () => {
  let fakeHome;
  let envOriginals;

  beforeEach(() => {
    fakeHome = createFakeHome();
    envOriginals = redirectHome(fakeHome);
  });

  afterEach(() => {
    restoreHome(envOriginals);
    try {
      fs.rmSync(fakeHome, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });

  test("creates new config file when none exists", () => {
    const result = installClaudeDesktopMcpConfig("/fake/project", {
      mode: "npx-local",
    });
    assert.equal(result.created, true);
    assert.equal(result.action, "created");
    const configPath = getExpectedConfigPath(fakeHome);
    assert.equal(result.configPath, configPath);
    assert.ok(fs.existsSync(configPath));

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.ok(config.mcpServers.simplebeacon);
    assert.equal(config.mcpServers.simplebeacon.command, "npx");
  });

  test("skips when simplebeacon already configured in existing config", () => {
    const configPath = getExpectedConfigPath(fakeHome);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          mcpServers: {
            simplebeacon: {
              command: "existing",
              args: [],
              env: {},
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const result = installClaudeDesktopMcpConfig("/fake/project");
    assert.equal(result.skipped, true);
    assert.ok(result.message.includes("already configured"));

    // Verify the existing config was NOT modified
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.equal(config.mcpServers.simplebeacon.command, "existing");
  });

  test("merges with existing config preserving third-party MCP servers", () => {
    const configPath = getExpectedConfigPath(fakeHome);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    const existingConfig = {
      mcpServers: {
        "third-party-tool": {
          command: "node",
          args: ["/path/to/third-party.js"],
          env: { API_KEY: "existing" },
        },
        "another-server": {
          command: "python",
          args: ["-m", "my_server"],
          env: {},
        },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), "utf8");

    const result = installClaudeDesktopMcpConfig("/fake/project", {
      mode: "npx-local",
    });
    assert.equal(result.created, true);
    assert.equal(result.action, "merged");

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    // Third-party servers must be preserved
    assert.ok(config.mcpServers["third-party-tool"]);
    assert.equal(config.mcpServers["third-party-tool"].command, "node");
    assert.equal(
      config.mcpServers["third-party-tool"].env.API_KEY,
      "existing",
    );

    assert.ok(config.mcpServers["another-server"]);
    assert.equal(config.mcpServers["another-server"].command, "python");

    // simplebeacon must be added
    assert.ok(config.mcpServers.simplebeacon);
    assert.equal(config.mcpServers.simplebeacon.command, "npx");
  });

  test("overwrites unreadable config when force=true", () => {
    const configPath = getExpectedConfigPath(fakeHome);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, "{ invalid json {{{", "utf8");

    const result = installClaudeDesktopMcpConfig("/fake/project", {
      force: true,
      mode: "npx-local",
    });
    assert.equal(result.created, true);

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.ok(config.mcpServers.simplebeacon);
  });

  test("skips unreadable config without force", () => {
    const configPath = getExpectedConfigPath(fakeHome);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, "{ invalid json {{{", "utf8");

    const result = installClaudeDesktopMcpConfig("/fake/project");
    assert.equal(result.skipped, true);
    assert.ok(result.message.includes("unreadable"));
  });

  test("dry-run does not write any files", () => {
    const result = installClaudeDesktopMcpConfig("/fake/project", {
      dryRun: true,
      mode: "npx-local",
    });
    assert.equal(result.dryRun, true);
    assert.ok(result.wouldWrite);

    const configPath = getExpectedConfigPath(fakeHome);
    assert.ok(!fs.existsSync(configPath), "No file should be written in dry-run");
  });

  test("dry-run merge shows wouldWrite content", () => {
    const configPath = getExpectedConfigPath(fakeHome);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          "existing-tool": { command: "node", args: [], env: {} },
        },
      }),
      "utf8",
    );

    const result = installClaudeDesktopMcpConfig("/fake/project", {
      dryRun: true,
      mode: "npx-local",
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.action, "merge");
    assert.ok(result.wouldWrite);

    // Verify the existing file was NOT modified
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.ok(config.mcpServers["existing-tool"]);
    assert.ok(!config.mcpServers.simplebeacon, "simplebeacon should not be added in dry-run");
  });

  test("creates config directory if it does not exist", () => {
    const configPath = getExpectedConfigPath(fakeHome);
    // Ensure the directory does not exist
    assert.ok(!fs.existsSync(path.dirname(configPath)));

    const result = installClaudeDesktopMcpConfig("/fake/project", {
      mode: "npx-local",
    });
    assert.equal(result.created, true);
    assert.ok(fs.existsSync(path.dirname(configPath)));
    assert.ok(fs.existsSync(configPath));
  });
});

// ─── resolveMcpCommand ────────────────────────────────────────────────────

describe("resolveMcpCommand", () => {
  test("defaults to npx-local mode", () => {
    const { command, args } = resolveMcpCommand();
    assert.equal(command, "npx");
    assert.ok(args.includes("simplebeacon-mcp"));
    assert.ok(args.includes("--offline"));
  });

  test("npx-github mode includes --yes flag", () => {
    const { command, args } = resolveMcpCommand({ mode: "npx-github" });
    assert.equal(command, "npx");
    assert.ok(args.includes("--yes"));
    assert.ok(args.includes("-p"));
    assert.ok(args.includes("simplebeacon"));
  });

  test("monorepo mode uses node with local bin path", () => {
    const { command, args } = resolveMcpCommand({ mode: "monorepo" });
    assert.equal(command, "node");
    assert.ok(args.some((a) => String(a).includes("simplebeacon-mcp.js")));
    assert.ok(args.includes("--offline"));
  });
});
