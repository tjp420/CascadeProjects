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
const { createFixHandlers } = require("./handlers/fix-handlers");
const { createArmHandlers } = require("./handlers/arm-handlers");
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
  const fixHandlers = createFixHandlers({
    withGuard,
    resolveProjectRoot,
    formatToolResult,
  });
  const armHandlers = createArmHandlers({
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
    ...fixHandlers,
    ...armHandlers,
    dispose() {
      if (networkGuard) networkGuard.dispose();
    },
  };
}

const TOOL_DEFINITIONS = [
  {
    name: "scan_snippet",
    description:
      "Scan a code snippet or pasted content for AI-fiction KPIs, mock-path leaks, credential patterns, and LLM placeholder slop. Runs locally — no upload. Set compressed=true for ~75% smaller payload (short keys c/s/l/m/a + action codes — use explain_finding to expand).",
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
        compressed: {
          type: "boolean",
          description:
            "Return compressed findings (~30 tokens each vs ~120). Format: {c:pattern, s:severity(C/H/M/L), l:line, m:match, a:actionCode}. Use explain_finding to expand action codes. Default: false.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "scan_file",
    description:
      "Scan one file on disk within the project root using the same rules as scan_snippet. Runs locally — no upload. Set compressed=true for ~75% smaller payload.",
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
        compressed: {
          type: "boolean",
          description:
            "Return compressed findings (~30 tokens each vs ~120). Use explain_finding to expand action codes. Default: false.",
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
          enum: ["minimal", "standard", "cascade", "executive", "euai", "universal"],
          description:
            "Override scan profile. minimal = fast credential check, standard = default rules, cascade = deep multi-pass, executive = board-ready summary, euai = EU AI Act focus, universal = all rules",
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
          enum: ["json", "markdown"],
          description: "Response format: json (default) for chaining to other tools, markdown for human-readable output",
        },
      },
    },
  },
  {
    name: "gate_status",
    description:
      "Read latest .simplebeacon/report.json gate pass/fail and top blocking issues from a prior full scan. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
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
      "Read the latest scan report and return prioritized remediation steps for critical and high-severity issues. Deterministic — no LLM inference. Runs locally — no upload.",
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
      "Return a focused, human-readable action plan from the latest scan report — prioritized playbooks with time estimates, step-by-step steps, and verify commands. Uses the same deterministic remediation guides as the CLI --format action-plan. Runs locally — no upload.",
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
    name: "propose_fix",
    description:
      "Return a structured remediation template for a finding — search/replace pattern, manual steps, verify command, and optional diff preview. Does NOT apply the fix; the agent or human must apply it manually. Deterministic — no LLM inference. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        finding: {
          type: "object",
          description:
            "Finding object — either compressed {c,s,l,m,a} from scan_snippet compressed=true, or full finding with recommendedAction/pattern/severity/line",
        },
        filePath: {
          type: "string",
          description:
            "File path relative to project root (enables diff preview when canAutoFix=true)",
        },
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
      },
      required: ["finding"],
    },
  },
  {
    name: "verify_fix",
    description:
      "Re-scan a file after a fix is applied. Reports whether findings were resolved, remaining count, and optional comparison with previous finding count. Deterministic — no LLM inference. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "File path relative to project root to re-scan",
        },
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
        previousFindingCount: {
          type: "number",
          description:
            "Previous finding count for before/after comparison (optional)",
        },
        compressed: {
          type: "boolean",
          description:
            "Return compressed findings (~30 tokens each vs ~120). Default: false.",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "explain_finding",
    description:
      "Explain a pattern ID from scan results — deterministic rule metadata, not LLM inference. Runs locally — no upload.",
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
      "Initialize a new project with .simplebeacon/config.json and baseline.json. Optionally install MCP config, Cursor rules, and CI workflow. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
        profile: {
          type: "string",
          enum: ["minimal", "standard", "cascade", "executive", "euai", "universal"],
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
      "Evaluate corporate safety checklist from a scan report. Returns pass/fail per rule, compliance score, and headline. Runs locally — no upload.",
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
          enum: ["blog", "twitter", "linkedin", "newsletter", "case-study", "press-kit", "one-pager"],
          description:
            "Marketing channel format (default: blog). blog = long-form post, twitter = short thread, linkedin = professional post, newsletter = email blast, case-study = detailed success story, press-kit = media-ready summary, one-pager = executive summary",
        },
        tone: {
          type: "string",
          enum: ["professional", "casual", "technical"],
          description: "Writing tone (default: professional). professional = formal business, casual = conversational, technical = engineer-focused",
        },
      },
    },
  },
  {
    name: "export_report",
    description:
      "Export the latest scan report to a JSON file on disk. Useful for CI artifacts or sharing. Runs locally — no upload.",
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
      "Return the full Simplebeacon deterministic rule catalog — categories, severity bands, banned patterns, and anonymized type codes. Use this to learn what is forbidden before writing code. Runs locally — no upload.",
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
      "One-call mission briefing for coding agents. Returns gate state, top blocking issues, suggested fixes, previous handoff, and the next mission. Auto-registers the agent and optionally writes a brief to .simplebeacon/agent-supercharge.md. Call this at session start. Runs locally — no upload.",
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
      "Pre-completion verification — checks gate pass, blocking count, and open tasks. Returns ready=true when safe to claim done. Optionally writes a handoff brief for the next session. Call this before claiming work is complete. Runs locally — no upload.",
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
      "Run a gate scan on staged git files only — much faster than scan_project for pre-commit checks. Copies staged files to a temp dir, scans them, and returns blocking issues. Use before commits and PRs. Runs locally — no upload.",
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
      "Return the current agent's status — gate state, open tasks, recent memories, and the recommended next action. Use this to orient yourself mid-session without re-running a full scan. Runs locally — no upload.",
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
      "Return deterministic before/after fix suggestions for blocking issues from the latest scan report. Includes pattern explanation, fix hint, and verification command. No LLM inference — all from the rule catalog. Runs locally — no upload.",
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
      "Install SimpleBeacon MCP config and agent rules for a specific coding agent host (cursor, windsurf, continue, copilot, cline, aider, universal, all). Writes .cursor/mcp.json and agent rule files. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root (default: cwd)",
        },
        hosts: {
          type: "string",
          enum: ["cursor", "windsurf", "continue", "copilot", "cline", "aider", "universal", "all"],
          description:
            "Agent host to install config for: cursor, windsurf, continue, copilot, cline, aider, universal (AGENTS.md), all (default: universal). Pass a single value, not comma-separated.",
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
      "Register a new agent in the project's agent registry. Returns agent ID. Usually auto-registration is sufficient — use this only for explicit naming. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        name: { type: "string", description: "Agent name (e.g. 'devin', 'cursor')" },
        type: { type: "string", description: "Agent type (e.g. 'coding', 'review')" },
      },
    },
  },
  {
    name: "agent_remember",
    description:
      "Store a key-value memory for the current agent. Persists across sessions in .simplebeacon/agent-memory/. Use this to save architectural decisions, false positive allowlists, and context that would otherwise be re-discovered. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        key: { type: "string", description: "Memory key (e.g. 'auth-pattern', 'false-positive-001')" },
        value: { type: "string", description: "Memory value (string or JSON string)" },
        category: { type: "string", enum: ["context", "decision", "handoff", "false-positive"], description: "Memory category (default: context). context = general knowledge, decision = architectural choice, handoff = session transfer note, false-positive = confirmed safe pattern to ignore" },
        ttlSeconds: { type: "number", description: "Optional TTL in seconds — memory auto-expires after this" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "agent_recall",
    description:
      "Recall memories for the current agent by key, category, or search query. Returns matching memories. Use this to recover context from previous sessions without re-reading files. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        key: { type: "string", description: "Specific key to recall (optional)" },
        category: { type: "string", enum: ["context", "decision", "handoff", "false-positive"], description: "Filter by category (optional)" },
        search: { type: "string", description: "Full-text search across memory values" },
        allAgents: { type: "boolean", description: "Search across all agents, not just current (default: false)" },
      },
    },
  },
  {
    name: "agent_forget",
    description:
      "Delete a memory by key and optional category. Use this to clean up stale context. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        key: { type: "string", description: "Memory key to delete" },
        category: { type: "string", enum: ["context", "decision", "handoff", "false-positive"], description: "Optional category filter" },
      },
      required: ["key"],
    },
  },
  // ─── PDA: Tasks ───
  {
    name: "task_create",
    description:
      "Create a task for the current agent. Tasks can have priorities, parent tasks, and approval requirements. Use this to track multi-step work and avoid losing track of pending items. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Task priority (default: medium). critical = blocks all other work, high = should be done this session, medium = normal, low = nice-to-have" },
        parentId: { type: "string", description: "Optional parent task ID" },
        approvalRequired: { type: "boolean", description: "Require approval before completion" },
      },
      required: ["title"],
    },
  },
  {
    name: "task_list",
    description:
      "List tasks for the current agent (or all agents). Filter by status: pending, in-progress, completed, blocked, cancelled. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        status: { type: "string", enum: ["pending", "in-progress", "completed", "blocked", "cancelled"], description: "Filter by status (optional). pending = not started, in-progress = actively working, completed = done, blocked = waiting on dependency, cancelled = abandoned" },
      },
    },
  },
  {
    name: "task_update",
    description:
      "Update a task — change title, description, status, priority, or block reason. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        taskId: { type: "string", description: "Task ID to update" },
        title: { type: "string", description: "New task title (optional)" },
        description: { type: "string", description: "New task description (optional)" },
        status: { type: "string", enum: ["pending", "in-progress", "completed", "blocked", "cancelled"], description: "New status: pending, in-progress, completed, blocked, cancelled" },
        priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "New priority level (optional)" },
        blockReason: { type: "string", description: "Reason for blocking (if status=blocked)" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "task_complete",
    description:
      "Mark a task as completed. Fails if parent task is not yet completed. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        taskId: { type: "string", description: "Task ID to complete" },
      },
      required: ["taskId"],
    },
  },
  // ─── PDA: Policies ───
  {
    name: "policy_check",
    description:
      "Check if an action is allowed by the project's agent policies. Returns allowed, violations, and warnings. Use this before destructive or risky actions. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        action: { type: "string", description: "Action to check (e.g. 'commit', 'deploy', 'delete-file')" },
        context: { type: "object", description: "Additional context for the action" },
      },
      required: ["action"],
    },
  },
  {
    name: "policy_list",
    description:
      "List all agent policies for the project. Returns policy definitions and their source file. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
      },
    },
  },
  // ─── PDA: Gate Finalize ───
  {
    name: "gate_finalize",
    description:
      "Check if the agent can finalize changes — runs gate scan, checks policies, and verifies no blocking issues. Returns canFinalize, blocking count, and violations. More thorough than handoff_check. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
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
      "Write a handoff brief for the next session or another agent. Includes summary, completed tasks, pending tasks, notes, and files changed. Stored in agent memory under 'handoff' category. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        summary: { type: "string", description: "Summary of what was accomplished this session" },
        completedTasks: { type: "array", items: { type: "string" }, description: "List of completed task titles" },
        pendingTasks: { type: "array", items: { type: "string" }, description: "List of tasks still pending for the next session" },
        notes: { type: "string", description: "Notes for the next session or reviewer — gotchas, warnings, context" },
        filesChanged: { type: "array", items: { type: "string" }, description: "List of file paths modified this session" },
      },
    },
  },
  {
    name: "handoff_read",
    description:
      "Read the latest handoff brief from any agent. Use this at session start to recover context from the previous session without re-exploring. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        agentId: { type: "string", description: "Read handoff from a specific agent (default: latest from any agent)" },
      },
    },
  },
  // ─── PDA: Cross-Project Learning ───
  {
    name: "cross_project_learn",
    description:
      "Analyze scan reports across multiple projects to extract patterns, recurring issues, and recommendations. Use this to learn from past mistakes and avoid repeating them. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root directory (default: cwd or SIMPLEBEACON_PROJECT_ROOT)" },
        searchRoots: {
          type: "array",
          items: { type: "string" },
          description: "Directories to search for projects (default: ~/CascadeProjects, ~/, E:/Ai)",
        },
        maxDepth: { type: "number", description: "Max directory depth (default: 5)" },
        format: { type: "string", enum: ["json", "markdown"], description: "Output format: json (default) for chaining, markdown for human-readable report" },
      },
    },
  },
  {
    name: "arm_execute",
    description:
      "Unified arm entry point — orchestrates scan → propose → apply → verify → remember → handoff in one call. action: scan|fix|verify|handoff|full. Default: scan. Use action=full for the complete loop. Compressed output by default (~75% smaller). Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["scan", "fix", "verify", "handoff", "full"],
          description: "Which arm action to execute. scan=scan only, fix=scan+propose, verify=rescan, handoff=write handoff, full=entire loop",
        },
        content: { type: "string", description: "Source content to scan (for scan/fix actions)" },
        filePath: { type: "string", description: "File path to scan/verify (relative to project root)" },
        projectRoot: { type: "string", description: "Project root (default: cwd)" },
        compressed: { type: "boolean", description: "Return compressed findings (default: true)" },
        reportPath: { type: "string", description: "Override report path relative to project root" },
      },
    },
  },
  {
    name: "solve_problem",
    description:
      "Natural-language problem solver — describe the problem ('CI failing on secrets', 'tests timeout', 'mock data in production') and get a classified diagnosis, action list, and deterministic guidance. If filePath is provided, scans it immediately. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        problem: { type: "string", description: "Natural language problem description" },
        filePath: { type: "string", description: "Optional file to scan immediately" },
        projectRoot: { type: "string", description: "Project root (default: cwd)" },
      },
      required: ["problem"],
    },
  },
  {
    name: "diagnose_error",
    description:
      "Paste a stack trace or error message and get root-cause analysis + fix. Identifies common error patterns (null reference, missing module, chunk load failure, auth error, 502 backend, etc.) and maps to the likely file and remediation template. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        error: { type: "string", description: "Error message or stack trace text" },
        stackTrace: { type: "string", description: "Alias for error" },
        filePath: { type: "string", description: "Optional file path to scan for the root cause" },
        projectRoot: { type: "string", description: "Project root (default: cwd)" },
      },
      required: ["error"],
    },
  },
  {
    name: "master_engineering_brief",
    description:
      "Ten-cylinder recovery playbook for stuck agents — assess, classify, prioritize, fix, verify, gate, remember, handoff, token budget, yes-you-can. Reads gate state, token savings, and previous handoff. Use when the agent is stuck or needs a structured recovery plan. Set writeDisk=true to write .simplebeacon/master-engineering-brief.md. Runs locally — no upload.",
    inputSchema: {
      type: "object",
      properties: {
        situation: { type: "string", description: "Brief description of the current situation (e.g. 'stuck on CI gate', 'dashboard crash')" },
        projectRoot: { type: "string", description: "Project root (default: cwd)" },
        reportPath: { type: "string", description: "Override report path relative to project root" },
        writeDisk: { type: "boolean", description: "Write brief to .simplebeacon/master-engineering-brief.md (default: false)" },
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
