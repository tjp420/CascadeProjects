/**
 * MCP tool handlers — local-only, no network.
 */

const path = require("path");
const { createNetworkGuard } = require("../lib/trust-guard");
const { createScanHandlers } = require("./handlers/scan-handlers");
const { createReportHandlers } = require("./handlers/report-handlers");
const { createUtilityHandlers } = require("./handlers/utility-handlers");
const { createDeploymentHandlers } = require("./handlers/deployment-handlers");
const constants = require("../lib/constants");

function resolveProjectRoot(override) {
  return path.resolve(
    override || process.env.SIMPLEBEACON_PROJECT_ROOT || process.cwd(),
  );
}

function formatToolResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload),
      },
    ],
  };
}

function formatMarkdownResult(title, markdown) {
  return {
    content: [{ type: "text", text: `## ${title}\n\n${markdown}` }],
  };
}

function _validateArgs(args, schema) {
  if (!args || typeof args !== "object")
    throw new Error("arguments must be an object");
  const required = schema.required || [];
  for (const key of required) {
    if (args[key] === undefined || args[key] === null || args[key] === "") {
      throw new Error(`Missing required argument: ${key}`);
    }
  }
  return args;
}

function createMcpToolHandlers(options = {}) {
  const offline =
    options.offline !== false ||
    process.env.SIMPLEBEACON_OFFLINE === "1" ||
    process.env.SIMPLEBEACON_OFFLINE === "true";
  const networkGuard = offline
    ? createNetworkGuard({ label: "simplebeacon-mcp" })
    : null;

  // Shared in-memory cache: projectRoot -> { report, timestamp }
  const scanCache = new Map();
  function cacheReport(root, report) {
    scanCache.set(root, { report, timestamp: Date.now() });
  }
  function getCachedReport(root) {
    const entry = scanCache.get(root);
    if (!entry) return null;
    // 10-minute TTL
    if (Date.now() - entry.timestamp > 10 * constants.ONE_MINUTE_MS) {
      scanCache.delete(root);
      return null;
    }
    return entry.report;
  }

  function withGuard(fn) {
    return (...args) => {
      if (networkGuard) networkGuard.assertOfflineClean();
      const result = fn(...args);
      if (result && typeof result.then === "function") {
        return result.then((r) => {
          if (networkGuard) networkGuard.assertOfflineClean();
          return r;
        });
      }
      if (networkGuard) networkGuard.assertOfflineClean();
      return result;
    };
  }

  const scanHandlers = createScanHandlers({
    withGuard,
    resolveProjectRoot,
    formatToolResult,
    cacheReport,
  });
  const reportHandlers = createReportHandlers({
    withGuard,
    resolveProjectRoot,
    formatToolResult,
    formatMarkdownResult,
    getCachedReport,
  });
  const utilityHandlers = createUtilityHandlers({
    withGuard,
    resolveProjectRoot,
    formatToolResult,
    formatMarkdownResult,
  });
  const deploymentHandlers = createDeploymentHandlers({
    withGuard,
    resolveProjectRoot,
    formatToolResult,
  });

  return {
    ...scanHandlers,
    ...reportHandlers,
    ...utilityHandlers,
    ...deploymentHandlers,
    dispose() {
      if (networkGuard) networkGuard.dispose();
    },
  };
}

const SLIM_TOOL_NAMES = [
  "scan_file",
  "scan_snippet",
  "gate_status",
  "explain_finding",
  "simplebeacon_workspace_context",
];

function resolveMcpToolProfile(options = {}) {
  if (options.fullTools === true || options.toolProfile === "full") {
    return "full";
  }
  if (options.toolProfile === "slim") {
    return "slim";
  }
  const env = String(process.env.SIMPLEBEACON_MCP_PROFILE || "").toLowerCase();
  if (env === "full" || env === "all") return "full";
  const argv = Array.isArray(options.argv) ? options.argv : process.argv;
  if (argv.includes("--full-tools")) return "full";
  return "slim";
}

function listToolDefinitions(options = {}) {
  const profile = resolveMcpToolProfile(options);
  if (profile === "full") return TOOL_DEFINITIONS;
  const allowed = new Set(SLIM_TOOL_NAMES);
  return TOOL_DEFINITIONS.filter((tool) => allowed.has(tool.name));
}

const TOOL_DEFINITIONS = [
  {
    name: "scan_snippet",
    description: "Unpublished paste only. Same result shape as scan_file. Not for saved files.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        filePath: { type: "string" },
        projectRoot: { type: "string" },
      },
      required: ["content"],
    },
  },
  {
    name: "scan_file",
    description:
      "One saved JS/TS/Python/env/YAML/JSON file. Skip Doom/binaries. Result: findings[{file,line,rule,severity,fix}], next.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string" },
        projectRoot: { type: "string" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "simplebeacon_workspace_context",
    description:
      "Workspace preflight. JSON facts only: whether requested files/symbols exist, relative imports, unresolved imports, evidence, and blockers. Does not scan rules, upload source, or advise. Use before editing when the agent would otherwise guess files or function names.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        files: {
          type: "array",
          items: { type: "string" },
          description: "Workspace-relative files the agent intends to use.",
        },
        requestedFile: {
          type: "string",
          description: "Single file to verify (alias for files[0]).",
        },
        symbols: {
          type: "array",
          items: {
            type: "object",
            properties: {
              file: { type: "string" },
              symbol: { type: "string" },
            },
          },
          description: "Functions/classes to verify in named files.",
        },
        verifySymbol: { type: "string" },
        verifySymbols: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
  {
    name: "scan_project",
    description:
      "Full project scan. Do not use mid-edit. Prefer CLI: npx simplebeacon scan --gate --offline. Hidden from the default Cursor tool list.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root to scan (default: cwd)",
        },
        configPath: {
          type: "string",
          description:
            "Path to custom .simplebeacon/config.json relative to project root",
        },
        profile: {
          type: "string",
          description:
            "Override scan profile: minimal, standard, cascade, executive, euai, universal",
        },
        fullDirectoryScan: {
          type: "boolean",
          description:
            "Walk entire repo tree instead of selective paths (slower, more thorough)",
        },
        complete: {
          type: "boolean",
          description:
            "Shorthand for fullDirectoryScan + all analyzers (same as --complete in CLI)",
        },
        gate: {
          type: "boolean",
          description:
            "Run gate-only scan (credentials + AI heuristics) instead of full scan",
        },
        format: {
          type: "string",
          description: "Response format: json (default) | markdown",
        },
      },
    },
  },
  {
    name: "gate_status",
    description: "Read .simplebeacon/report.json. Same finding rows as scan_file. No rescan.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        reportPath: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "suggest_fixes",
    description:
      "Read the latest scan report and return prioritized remediation steps for critical and high-severity issues. Deterministic — no LLM inference.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description:
            "Project root for reading .simplebeacon/report.json (default: cwd)",
        },
        reportPath: {
          type: "string",
          description: "Override report path relative to project root",
        },
        maxFixes: {
          type: "number",
          description: "Max fixes to return (default 5)",
        },
      },
    },
  },
  {
    name: "get_action_plan",
    description:
      "Return a focused, human-readable action plan from the latest scan report — prioritized playbooks with time estimates, step-by-step steps, and verify commands. Uses the same deterministic remediation guides as the CLI --format action-plan.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
        reportPath: {
          type: "string",
          description: "Override report path relative to project root",
        },
      },
    },
  },
  {
    name: "explain_finding",
    description: "Rule metadata for a pattern id. Not LLM inference.",
    inputSchema: {
      type: "object",
      properties: {
        patternId: { type: "string" },
        type: { type: "string" },
        projectRoot: { type: "string" },
      },
      required: ["patternId"],
    },
  },
  {
    name: "init_project",
    description:
      "Initialize a new project with .simplebeacon/config.json and baseline.json. Optionally install MCP config, Cursor rules, and CI workflow.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
        profile: {
          type: "string",
          description:
            "Force profile: minimal, standard, cascade, executive, euai, universal",
        },
        force: {
          type: "boolean",
          description: "Overwrite existing config/baseline",
        },
        withMcp: {
          type: "boolean",
          description: "Write .cursor/mcp.json + agent rule for Cursor MCP",
        },
        withCi: {
          type: "boolean",
          description: "Write .github/workflows/simplebeacon.yml",
        },
        starter: {
          type: "boolean",
          description: "Shorthand for withMcp + withCi",
        },
      },
    },
  },
  {
    name: "compliance_checklist",
    description:
      "Evaluate corporate safety checklist from a scan report. Returns pass/fail per rule, compliance score, and headline.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
        reportPath: {
          type: "string",
          description:
            "Override report path relative to project root (default: .simplebeacon/report.json)",
        },
        checklistProfile: {
          type: "string",
          description: "Optional checklist profile name",
        },
      },
    },
  },
  {
    name: "run_analyzer_suite",
    description:
      "Run the 48-analyzer AI Problem Analyzer Suite against the latest scan report. Returns risk summary, measured/insufficient/stub counts, and top priority issues. Runs locally — no code uploaded.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description:
            "Project root for reading .simplebeacon/report.json (default: cwd)",
        },
        selectedIssueIds: {
          type: "array",
          items: { type: "string" },
          description: "Optional subset of A-01..A-48 issue IDs to analyze",
        },
      },
    },
  },
  {
    name: "generate_marketing",
    description:
      "Generate marketing content (blog, twitter, linkedin, etc.) from a scan report. Runs locally — no data uploaded.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description:
            "Project root for reading .simplebeacon/report.json (default: cwd)",
        },
        reportPath: {
          type: "string",
          description: "Override report path relative to project root",
        },
        channel: {
          type: "string",
          description:
            "Channel: blog, twitter, linkedin, newsletter, case-study, press-kit, one-pager (default: blog)",
        },
        tone: {
          type: "string",
          description:
            "Tone: professional, casual, technical (default: professional)",
        },
      },
    },
  },
  {
    name: "export_report",
    description:
      "Export the latest scan report to a JSON file on disk. Useful for CI artifacts or sharing.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description:
            "Project root for reading .simplebeacon/report.json (default: cwd)",
        },
        reportPath: {
          type: "string",
          description: "Override source report path relative to project root",
        },
        outPath: {
          type: "string",
          description:
            "Destination path relative to project root (default: .simplebeacon/exported-report.json)",
        },
      },
    },
  },
  {
    name: "list_rulesets",
    description:
      "Return the full Simplebeacon deterministic rule catalog — categories, severity bands, banned patterns, and anonymized type codes. Use this to learn what is forbidden before writing code.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "scan_deployment_readiness",
    description:
      'Validate monorepo deployment topology — workspace membership, env var completeness, DB schema conflicts, CORS consistency, and render.yaml presence. Returns ready=true if no high/critical findings. Agents should call this before claiming "ready to deploy". Runs locally — no source uploaded.',
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description:
            "Project root to scan (default: cwd or SIMPLEBEACON_PROJECT_ROOT)",
        },
      },
    },
  },
];

module.exports = {
  createMcpToolHandlers,
  TOOL_DEFINITIONS,
  SLIM_TOOL_NAMES,
  resolveMcpToolProfile,
  listToolDefinitions,
  formatToolResult,
  formatMarkdownResult,
};
