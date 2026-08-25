"use strict";

/**
 * MCP PDA handlers — agent memory, tasks, policies, gate, handoff.
 * All operations are local-first (no upload).
 */

const pda = require("../../agent-pda");
const path = require("path");
const fs = require("fs");
const os = require("os");

function createPdaHandlers({
  withGuard,
  resolveProjectRoot,
  formatToolResult,
  formatMarkdownResult,
}) {
  // Resolve agent ID: explicit arg > auto-detect > auto-register
  function resolveAgentId(args, projectRoot) {
    if (args.agentId) return args.agentId;
    const agent = pda.autoRegister(projectRoot);
    return agent.id;
  }

  return {
    // ─── Agent ───
    agent_register: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const agent = pda.registerAgent(
        root,
        args.name || "unknown",
        args.type || "custom",
      );
      return formatToolResult({ success: true, agent });
    }),

    // ─── Memory ───
    agent_remember: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const agentId = resolveAgentId(args, root);
      const memory = pda.remember(
        root,
        agentId,
        args.key,
        args.value,
        args.category || "context",
        { ttlSeconds: args.ttlSeconds },
      );
      return formatToolResult({ success: true, memory });
    }),

    agent_recall: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const agentId = resolveAgentId(args, root);
      const opts = {
        allAgents: args.allAgents === true,
        search: args.search || undefined,
      };
      const memories = pda.recall(root, agentId, args.key, args.category, opts);
      return formatToolResult({
        success: true,
        memories,
        count: memories.length,
      });
    }),

    agent_forget: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const agentId = resolveAgentId(args, root);
      const deleted = pda.forget(root, agentId, args.key, args.category);
      return formatToolResult({ success: true, deleted });
    }),

    // ─── Tasks ───
    task_create: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const agentId = resolveAgentId(args, root);
      const task = pda.createTask(root, agentId, args.title, {
        description: args.description,
        priority: args.priority,
        parentId: args.parentId,
        approvalRequired: args.approvalRequired,
      });
      return formatToolResult({ success: true, task });
    }),

    task_list: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const agentId = args.agentId || null;
      const tasks = pda.listTasks(root, agentId, args.status);
      return formatToolResult({ success: true, tasks, count: tasks.length });
    }),

    task_update: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const task = pda.updateTask(root, args.taskId, {
        title: args.title,
        description: args.description,
        status: args.status,
        priority: args.priority,
        blockReason: args.blockReason,
      });
      if (!task)
        return formatToolResult({ success: false, error: "Task not found" });
      return formatToolResult({ success: true, task });
    }),

    task_complete: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const result = pda.completeTask(root, args.taskId);
      if (!result)
        return formatToolResult({ success: false, error: "Task not found" });
      if (result.error === "parent_incomplete") {
        return formatToolResult({
          success: false,
          error: result.error,
          message: result.message,
          parentTask: result.parentTask,
        });
      }
      return formatToolResult({ success: true, task: result });
    }),

    // ─── Policies ───
    policy_check: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const result = pda.checkAction(root, args.action, args.context || {});
      return formatToolResult({ success: true, ...result });
    }),

    policy_list: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const { policies, source } = pda.listPolicies(root);
      return formatToolResult({
        success: true,
        policies,
        source,
        count: policies.length,
      });
    }),

    // ─── Gate ───
    gate_finalize: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const agentId = resolveAgentId(args, root);
      const result = pda.canFinalize(root, agentId, {
        runScan: args.runScan !== false,
        useExistingReport: args.useExistingReport === true,
        action: args.action || "finalize-changes",
      });
      // Return a compact summary — the full gateResult.report can be
      // 10k+ lines and floods the agent's context window.
      return formatToolResult({
        success: true,
        canFinalize: result.canFinalize,
        blockingCount: result.blockingCount,
        violations: result.violations,
        warnings: result.warnings,
        approvalsNeeded: result.approvalsNeeded,
        gateSummary: result.gateResult
          ? {
              pass: result.gateResult.pass,
              blockingCount: result.gateResult.blockingCount,
              qualityScore: result.gateResult.qualityScore,
              error: result.gateResult.error || undefined,
            }
          : null,
        agentId: result.agentId,
      });
    }),

    // ─── Handoff ───
    handoff_write: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const agentId = resolveAgentId(args, root);
      const brief = {
        summary: args.summary || "",
        completedTasks: args.completedTasks || [],
        pendingTasks: args.pendingTasks || [],
        notes: args.notes || "",
        filesChanged: args.filesChanged || [],
        writtenAt: Date.now(),
        fromAgent: agentId,
      };
      const memory = pda.remember(
        root,
        agentId,
        "handoff-brief",
        JSON.stringify(brief),
        "handoff",
      );
      return formatToolResult({ success: true, brief, memoryId: memory.id });
    }),

    handoff_read: withGuard((args) => {
      const root = resolveProjectRoot(args.projectRoot);
      // Read latest handoff from any agent, or a specific agent
      const _agentId = args.agentId || null;
      const agents = pda.listAgents(root);
      let latestHandoff = null;

      for (const agent of agents) {
        const mem = pda.recallLatest(
          root,
          agent.id,
          "handoff-brief",
          "handoff",
        );
        if (
          mem &&
          (!latestHandoff || mem.updatedAt > latestHandoff.updatedAt)
        ) {
          latestHandoff = mem;
        }
      }

      if (!latestHandoff) {
        return formatToolResult({
          success: true,
          handoff: null,
          message: "No handoff brief found",
        });
      }

      try {
        const brief = JSON.parse(latestHandoff.value);
        return formatToolResult({
          success: true,
          handoff: brief,
          memoryId: latestHandoff.id,
        });
      } catch {
        return formatToolResult({
          success: true,
          handoff: { raw: latestHandoff.value },
          memoryId: latestHandoff.id,
        });
      }
    }),

    // ─── Cross-Project Learning ───
    cross_project_learn: withGuard((args) => {
      const defaultRoots = [
        path.join(os.homedir(), "CascadeProjects"),
        os.homedir(),
        "E:\\Ai",
      ].filter((p) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      });

      const searchRoots =
        args.searchRoots && args.searchRoots.length > 0
          ? args.searchRoots
          : defaultRoots;
      const maxDepth = args.maxDepth || 5;

      const projects = pda.collectProjectData(searchRoots, {
        maxDepth,
        includeWorktrees: false,
      });
      const analysis = pda.extractPatterns(projects);

      if (args.format === "markdown") {
        const report = pda.generateLearningReport(analysis);
        return formatMarkdownResult("Cross-Project Learning Report", report);
      }

      // Compact JSON — don't flood the agent's context with full project list
      return formatToolResult({
        success: true,
        projectsAnalyzed: analysis.metrics.totalProjects,
        gatePassCount: analysis.metrics.gatePassCount,
        gateFailCount: analysis.metrics.gateFailCount,
        totalFindings: analysis.metrics.totalFindings,
        totalBlocking: analysis.metrics.totalBlocking,
        patterns: analysis.patterns.map((p) => ({
          id: p.id,
          title: p.title,
          occurrences: p.occurrences || null,
          severityImpact: p.severityImpact || null,
          universalRule: p.universalRule,
        })),
        recommendations: analysis.recommendations,
        topFindingTypes: Object.entries(analysis.metrics.topFindingTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .reduce((obj, [k, v]) => {
            obj[k] = v;
            return obj;
          }, {}),
      });
    }),
  };
}

module.exports = { createPdaHandlers };
