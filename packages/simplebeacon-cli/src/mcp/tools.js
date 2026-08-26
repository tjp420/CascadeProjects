/**
 * MCP tool handlers — local-only, no network.
 */

const path = require("path");
const { createNetworkGuard } = require("../lib/trust-guard");
const { createScanHandlers } = require("./handlers/scan-handlers");
const { createReportHandlers } = require("./handlers/report-handlers");
const { createUtilityHandlers } = require("./handlers/utility-handlers");
const { createDeploymentHandlers } = require("./handlers/deployment-handlers");
const { createPdaHandlers } = require("./handlers/pda-handlers");
const { createAgentHandlers } = require("./handlers/agent-handlers");
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
        text: JSON.stringify(payload, null, 2),
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
  const pdaHandlers = createPdaHandlers({
    withGuard,
    resolveProjectRoot,
    formatToolResult,
    formatMarkdownResult,
  });
  const agentHandlers = createAgentHandlers({
    withGuard,
    resolveProjectRoot,
    formatToolResult,
    formatMarkdownResult,
    getCachedReport,
  });

  return {
    ...scanHandlers,
    ...reportHandlers,
    ...utilityHandlers,
    ...deploymentHandlers,
    ...pdaHandlers,
    ...agentHandlers,
    dispose() {
      if (networkGuard) networkGuard.dispose();
    },
  };
}

const TOOL_DEFINITIONS = [
  {
    name: "scan_snippet",
    description:
      "Scan a code snippet or pasted content for AI-fiction KPIs, mock-path leaks, credential patterns, and LLM placeholder slop. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Source text to scan" },
        filePath: {
          type: "string",
          description: "Virtual filename for context (e.g. src/api/handler.ts)",
        },
        projectRoot: {
          type: "string",
          description:
            "Project root for baseline.json (default: cwd or SIMPLEBEACON_PROJECT_ROOT)",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "scan_file",
    description:
      "Scan one file on disk within the project root using the same rules as scan_snippet. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Relative or absolute path within project",
        },
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "scan_project",
    description:
      "Run a full project scan (gate or complete) on the local filesystem. Supports custom config, profile override, and complete scan mode. Returns gate pass, quality score, top issues, and file count. No code is uploaded.",
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
    description:
      "Read latest .simplebeacon/report.json gate pass/fail and top blocking issues from a prior full scan.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        reportPath: {
          type: "string",
          description: "Override report path relative to project root",
        },
        limit: {
          type: "number",
          description: "Max blocking issues to return (default 12)",
        },
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
    description:
      "Explain a pattern ID from scan results — deterministic rule metadata, not LLM inference.",
    inputSchema: {
      type: "object",
      properties: {
        patternId: {
          type: "string",
          description: "Pattern or rule id from scan_snippet/scan_file",
        },
        type: {
          type: "string",
          description: "Optional finding type for fallback lookup",
        },
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
  // ─── Agent Workflow Tools ───
  {
    name: "supercharge_agent",
    description:
      "One-call mission briefing for coding agents. Returns gate state, top blocking issues, suggested fixes, previous handoff, and the next mission. Auto-registers the agent and optionally writes a brief to .simplebeacon/agent-supercharge.md. Call this at session start.",
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
        writeDisk: {
          type: "boolean",
          description:
            "Write the supercharge brief to .simplebeacon/agent-supercharge.md (default: false)",
        },
      },
    },
  },
  {
    name: "handoff_check",
    description:
      "Pre-completion verification — checks gate pass, blocking count, and open tasks. Returns ready=true when safe to claim done. Optionally writes a handoff brief for the next session. Call this before claiming work is complete.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
        summary: {
          type: "string",
          description: "Summary of what was accomplished this session",
        },
        completedTasks: {
          type: "array",
          items: { type: "string" },
          description: "List of completed task titles",
        },
        filesChanged: {
          type: "array",
          items: { type: "string" },
          description: "List of files modified this session",
        },
        notes: {
          type: "string",
          description: "Notes for the next session or reviewer",
        },
        writeHandoff: {
          type: "boolean",
          description: "Write a handoff brief even if not ready (default: auto-writes when ready)",
        },
      },
    },
  },
  {
    name: "scan_staged",
    description:
      "Run a gate scan on staged git files only — much faster than scan_project for pre-commit checks. Copies staged files to a temp dir, scans them, and returns blocking issues. Use before commits and PRs.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
      },
    },
  },
  {
    name: "agent_status",
    description:
      "Return the current agent's status — gate state, open tasks, recent memories, and the recommended next action. Use this to orient yourself mid-session without re-running a full scan.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
      },
    },
  },
  {
    name: "code_suggestions",
    description:
      "Return deterministic before/after fix suggestions for blocking issues from the latest scan report. Includes pattern explanation, fix hint, and verification command. No LLM inference — all from the rule catalog.",
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
        maxSuggestions: {
          type: "number",
          description: "Max suggestions to return (default 10)",
        },
      },
    },
  },
  {
    name: "install_agent_plugin",
    description:
      "Install SimpleBeacon MCP config and agent rules for a specific coding agent host (cursor, windsurf, continue, copilot, cline, aider, universal, all). Writes .cursor/mcp.json and agent rule files.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
        hosts: {
          type: "string",
          description:
            "Comma-separated list of agent hosts: cursor, windsurf, continue, copilot, cline, aider, universal, all (default: universal)",
        },
        force: {
          type: "boolean",
          description: "Overwrite existing config files",
        },
      },
    },
  },
  // ─── PDA: Agent Memory ───
  {
    name: "agent_register",
    description:
      "Register a new agent in the project's agent registry. Returns agent ID. Usually auto-registration is sufficient — use this only for explicit naming.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        name: { type: "string", description: "Agent name (e.g. 'devin', 'cursor')" },
        type: { type: "string", description: "Agent type (e.g. 'coding', 'review')" },
      },
    },
  },
  {
    name: "agent_remember",
    description:
      "Store a key-value memory for the current agent. Persists across sessions in .simplebeacon/agent-memory/. Use this to save architectural decisions, false positive allowlists, and context that would otherwise be re-discovered.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        key: { type: "string", description: "Memory key (e.g. 'auth-pattern', 'false-positive-001')" },
        value: { type: "string", description: "Memory value (string or JSON string)" },
        category: { type: "string", description: "Category: context, decision, handoff, false-positive (default: context)" },
        ttlSeconds: { type: "number", description: "Optional TTL in seconds — memory auto-expires after this" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "agent_recall",
    description:
      "Recall memories for the current agent by key, category, or search query. Returns matching memories. Use this to recover context from previous sessions without re-reading files.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        key: { type: "string", description: "Specific key to recall (optional)" },
        category: { type: "string", description: "Filter by category (optional)" },
        search: { type: "string", description: "Full-text search across memory values" },
        allAgents: { type: "boolean", description: "Search across all agents, not just current (default: false)" },
      },
    },
  },
  {
    name: "agent_forget",
    description:
      "Delete a memory by key and optional category. Use this to clean up stale context.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        key: { type: "string", description: "Memory key to delete" },
        category: { type: "string", description: "Optional category filter" },
      },
      required: ["key"],
    },
  },
  // ─── PDA: Tasks ───
  {
    name: "task_create",
    description:
      "Create a task for the current agent. Tasks can have priorities, parent tasks, and approval requirements. Use this to track multi-step work and avoid losing track of pending items.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        priority: { type: "string", description: "Priority: low, medium, high, critical" },
        parentId: { type: "string", description: "Optional parent task ID" },
        approvalRequired: { type: "boolean", description: "Require approval before completion" },
      },
      required: ["title"],
    },
  },
  {
    name: "task_list",
    description:
      "List tasks for the current agent (or all agents). Filter by status: pending, in-progress, completed, blocked, cancelled.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        status: { type: "string", description: "Filter by status (optional)" },
      },
    },
  },
  {
    name: "task_update",
    description:
      "Update a task — change title, description, status, priority, or block reason.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        taskId: { type: "string", description: "Task ID to update" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", description: "New status: pending, in-progress, completed, blocked, cancelled" },
        priority: { type: "string" },
        blockReason: { type: "string", description: "Reason for blocking (if status=blocked)" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "task_complete",
    description:
      "Mark a task as completed. Fails if parent task is not yet completed.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        taskId: { type: "string", description: "Task ID to complete" },
      },
      required: ["taskId"],
    },
  },
  // ─── PDA: Policies ───
  {
    name: "policy_check",
    description:
      "Check if an action is allowed by the project's agent policies. Returns allowed, violations, and warnings. Use this before destructive or risky actions.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        action: { type: "string", description: "Action to check (e.g. 'commit', 'deploy', 'delete-file')" },
        context: { type: "object", description: "Additional context for the action" },
      },
      required: ["action"],
    },
  },
  {
    name: "policy_list",
    description:
      "List all agent policies for the project. Returns policy definitions and their source file.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
      },
    },
  },
  // ─── PDA: Gate Finalize ───
  {
    name: "gate_finalize",
    description:
      "Check if the agent can finalize changes — runs gate scan, checks policies, and verifies no blocking issues. Returns canFinalize, blocking count, and violations. More thorough than handoff_check.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        runScan: { type: "boolean", description: "Run a fresh scan (default: true)" },
        useExistingReport: { type: "boolean", description: "Use existing .simplebeacon/report.json instead of re-scanning" },
        action: { type: "string", description: "Action label for the finalize check (default: 'finalize-changes')" },
      },
    },
  },
  // ─── PDA: Handoff ───
  {
    name: "handoff_write",
    description:
      "Write a handoff brief for the next session or another agent. Includes summary, completed tasks, pending tasks, notes, and files changed. Stored in agent memory under 'handoff' category.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        summary: { type: "string", description: "Summary of what was accomplished" },
        completedTasks: { type: "array", items: { type: "string" } },
        pendingTasks: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
        filesChanged: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "handoff_read",
    description:
      "Read the latest handoff brief from any agent. Use this at session start to recover context from the previous session without re-exploring.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        agentId: { type: "string", description: "Read handoff from a specific agent (default: latest from any agent)" },
      },
    },
  },
  // ─── PDA: Cross-Project Learning ───
  {
    name: "cross_project_learn",
    description:
      "Analyze scan reports across multiple projects to extract patterns, recurring issues, and recommendations. Use this to learn from past mistakes and avoid repeating them.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string" },
        searchRoots: {
          type: "array",
          items: { type: "string" },
          description: "Directories to search for projects (default: ~/CascadeProjects, ~/, E:/Ai)",
        },
        maxDepth: { type: "number", description: "Max directory depth (default: 5)" },
        format: { type: "string", description: "Output format: json (default) | markdown" },
      },
    },
  },
];

module.exports = {
  createMcpToolHandlers,
  TOOL_DEFINITIONS,
  formatToolResult,
  formatMarkdownResult,
};
