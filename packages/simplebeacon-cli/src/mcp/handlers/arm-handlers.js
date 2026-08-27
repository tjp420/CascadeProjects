"use strict";

/**
 * MCP Arm Handlers — the orchestration layer that makes SimpleBeacon
 * an arm for AI agents, not just a scanner.
 *
 * Tools:
 *   arm_execute      — One-call: scan → propose → apply → verify → remember → handoff
 *   solve_problem     — Natural-language problem solver (maps to scan + fix + guidance)
 *   diagnose_error    — Paste a stack trace, get root-cause + fix
 *   master_engineering_brief — Ten-cylinder recovery playbook for stuck agents
 *
 * All operations are local-first (no upload).
 */

const fs = require("fs");
const path = require("path");
const { readFile, writeFile, mkdir } = fs.promises;
const pda = require("../../agent-pda");
const tokenSavings = require("../../agent-pda/token-savings-tracker");
const { scanSnippetContent, scanFileOnDisk } = require("../../lib/snippet-scanner");
const { runDeterministicRemediation, getSupportedPatterns } = require("../../lib/ast-remediator");
const { resolveRemediation, getRemediationTemplate } = require("../../lib/remediation-templates");
const { ACTION_CODES } = require("../../lib/finding-compressor");

function createArmHandlers({
  withGuard,
  resolveProjectRoot,
  formatToolResult,
  formatMarkdownResult,
  getCachedReport,
}) {
  // ─── Helper: load report ───
  async function loadReport(root, reportPath) {
    let report = getCachedReport ? getCachedReport(root) : null;
    if (report) return report;
    const rp = reportPath
      ? path.resolve(root, reportPath)
      : path.join(root, ".simplebeacon", "report.json");
    try {
      report = JSON.parse(await readFile(rp, "utf8"));
      return report;
    } catch {
      return null;
    }
  }

  // ─── Helper: detect agent identity ───
  function detectAgent() {
    try {
      return pda.detectAgent() || { id: "unknown", name: "Unknown Agent" };
    } catch {
      return { id: "unknown", name: "Unknown Agent" };
    }
  }

  // ─── Helper: resolve action code from finding ───
  function resolveActionCode(finding) {
    if (finding.a) return finding.a;
    if (finding.recommendedAction) {
      for (const [code, text] of Object.entries(ACTION_CODES)) {
        if (text === finding.recommendedAction) return code;
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // arm_execute — the unified arm entry point
  // ═══════════════════════════════════════════════════════════════════
  const arm_execute = withGuard(async (args) => {
    const root = resolveProjectRoot(args?.projectRoot);
    const agent = detectAgent();
    const action = args?.action || "scan"; // scan | fix | verify | handoff | full
    const filePath = args?.filePath || null;
    const content = args?.content || null;
    const compressed = args?.compressed !== false; // default true for arm

    const result = {
      action,
      agent: { id: agent.id, name: agent.name },
      steps: [],
      findings: [],
      fixes: [],
      memory: null,
      handoff: null,
      tokenSavings: null,
    };

    // Step 1: SCAN
    if (action === "scan" || action === "fix" || action === "full") {
      let scanResult;
      if (content) {
        scanResult = scanSnippetContent(String(content), {
          filePath: filePath || "snippet",
          projectRoot: root,
          compressed,
        });
      } else if (filePath) {
        scanResult = scanFileOnDisk(path.resolve(root, filePath), {
          projectRoot: root,
          compressed,
        });
      } else {
        // Use cached report
        const report = await loadReport(root, args?.reportPath);
        scanResult = report
          ? { findings: (report.rawIssues || []).slice(0, 20), gate: report.gate }
          : { findings: [], error: "No content/file provided and no cached report" };
      }

      const findings = scanResult.findings || [];
      result.findings = findings;
      result.steps.push({
        step: "scan",
        status: findings.length === 0 ? "clean" : "issues_found",
        count: findings.length,
      });

      // Record token savings if compressed
      if (compressed && findings.length > 0) {
        try {
          const originalEst = tokenSavings.estimateTokens(
            JSON.stringify(findings),
          );
          const compressedEst = tokenSavings.estimateTokens(
            JSON.stringify(findings.map((f) => ({
              c: f.c || f.pattern,
              s: f.s || f.severity,
              l: f.l || f.line,
              a: f.a || resolveActionCode(f),
            }))),
          );
          const savings = tokenSavings.recordSavings(root, {
            agentId: agent.id,
            tool: "arm_execute:scan",
            originalTokens: originalEst,
            compressedTokens: compressedEst,
          });
          result.tokenSavings = savings.cumulative
            ? { saved: savings.event.saved, total: savings.cumulative.totalSaved }
            : null;
        } catch {
          // non-fatal
        }
      }
    }

    // Step 2: PROPOSE + APPLY FIXES
    if (action === "fix" || action === "full") {
      const findingsToFix = result.findings.filter(
        (f) => f.s === "C" || f.s === "H" || f.severity === "critical" || f.severity === "high",
      );

      for (const finding of findingsToFix) {
        const actionCode = resolveActionCode(finding);
        const template = actionCode ? getRemediationTemplate(actionCode) : null;

        // Try deterministic AST fix first
        let astFix = null;
        if (filePath) {
          try {
            const fullPath = path.resolve(root, filePath);
            const remediationResult = runDeterministicRemediation([finding], {
              projectRoot: root,
              filePath: fullPath,
              dryRun: true,
            });
            if (remediationResult.fixes && remediationResult.fixes.length > 0) {
              astFix = remediationResult.fixes[0];
            }
          } catch {
            // non-fatal
          }
        }

        result.fixes.push({
          finding: { c: finding.c, s: finding.s, l: finding.l, a: actionCode },
          template: template
            ? {
                canAutoFix: template.canAutoFix,
                manualSteps: template.manualSteps,
                verifyCommand: template.verifyCommand,
              }
            : null,
          astFix: astFix
            ? {
                pattern: astFix.pattern,
                search: astFix.search?.slice(0, 200),
                replace: astFix.replace?.slice(0, 200),
                applied: false,
              }
            : null,
        });
      }

      result.steps.push({
        step: "fix",
        status: result.fixes.length === 0 ? "no_fixes_needed" : "fixes_proposed",
        count: result.fixes.length,
      });
    }

    // Step 3: VERIFY
    if (action === "verify" || action === "full") {
      if (filePath) {
        try {
          const fullPath = path.resolve(root, filePath);
          const verifyResult = scanFileOnDisk(fullPath, {
            projectRoot: root,
            compressed,
          });
          const remainingFindings = verifyResult.findings || [];
          result.steps.push({
            step: "verify",
            status: remainingFindings.length === 0 ? "clean" : "issues_remain",
            remainingCount: remainingFindings.length,
          });
        } catch (err) {
          result.steps.push({
            step: "verify",
            status: "error",
            error: err.message,
          });
        }
      } else {
        result.steps.push({
          step: "verify",
          status: "skipped",
          reason: "No filePath provided",
        });
      }
    }

    // Step 4: REMEMBER
    if (action === "full") {
      try {
        pda.remember(root, agent.id, "arm-session", JSON.stringify({
          action,
          findingsCount: result.findings.length,
          fixesCount: result.fixes.length,
          steps: result.steps.map((s) => `${s.step}:${s.status}`).join(", "),
          timestamp: new Date().toISOString(),
        }), "session-note");

        result.memory = { stored: true, key: "arm-session" };
      } catch {
        result.memory = { stored: false };
      }
    }

    // Step 5: HANDOFF
    if (action === "handoff" || action === "full") {
      try {
        const handoffData = {
          agent: agent.id,
          timestamp: new Date().toISOString(),
          findingsCount: result.findings.length,
          fixesCount: result.fixes.length,
          steps: result.steps,
          nextAction: result.findings.length > 0
            ? "Fix remaining findings, then run arm_execute with action=verify"
            : "Gate is clean — proceed with feature work",
        };

        pda.remember(root, agent.id, "handoff-brief", JSON.stringify(handoffData), "handoff");

        // Include token savings brief
        const savingsBrief = tokenSavings.getSavingsBrief(root, agent.id);
        if (savingsBrief) {
          handoffData.tokenSavings = savingsBrief;
        }

        result.handoff = handoffData;
      } catch {
        result.handoff = { stored: false };
      }
    }

    return formatToolResult(result);
  });

  // ═══════════════════════════════════════════════════════════════════
  // solve_problem — natural language problem → scan + fix + guidance
  // ═══════════════════════════════════════════════════════════════════
  const solve_problem = withGuard(async (args) => {
    const root = resolveProjectRoot(args?.projectRoot);
    const agent = detectAgent();
    const problem = args?.problem || "";
    const filePath = args?.filePath || null;

    if (!problem) {
      return formatToolResult({
        error: "Missing required argument: problem",
        hint: 'Describe the problem in natural language, e.g. "CI failing on secrets" or "tests timeout"',
      });
    }

    // Classify the problem
    const classification = _classifyProblem(problem);
    const result = {
      problem,
      classification,
      agent: { id: agent.id, name: agent.name },
      diagnosis: null,
      actions: [],
      guidance: null,
    };

    // Route to appropriate handler based on classification
    if (classification.category === "secrets" || classification.category === "credentials") {
      result.diagnosis = "Credential or secret detected in source. This is a gate-blocking issue.";
      result.actions.push({
        tool: "scan_snippet",
        action: "Scan the file for credential patterns",
        urgency: "critical",
      });
      result.actions.push({
        tool: "propose_fix",
        action: "Get remediation template for the credential pattern",
        urgency: "critical",
      });
      result.guidance = "1. Rotate the exposed credential immediately\n2. Replace hardcoded value with process.env.VAR\n3. Add to .gitignore if .env file\n4. Run verify_fix to confirm clean";
    } else if (classification.category === "ai-slop" || classification.category === "fiction") {
      result.diagnosis = "AI-generated placeholder content or fictional metrics detected.";
      result.actions.push({
        tool: "scan_snippet",
        action: "Scan for LLM placeholder patterns and fictional KPIs",
        urgency: "high",
      });
      result.actions.push({
        tool: "propose_fix",
        action: "Get remediation template for the specific pattern",
        urgency: "high",
      });
      result.guidance = "1. Replace placeholder values with production data\n2. Remove AI conversational debris from source\n3. Verify metrics are dynamic, not hardcoded";
    } else if (classification.category === "tests") {
      result.diagnosis = "Test infrastructure issue — likely missing config or timeout.";
      result.actions.push({
        tool: "scan_file",
        action: "Scan test config files for issues",
        urgency: "medium",
      });
      result.guidance = "1. Check jest.config.js / vitest.config.ts exists\n2. Verify testTimeout is set appropriately\n3. Run npx simplebeacon doctor for diagnostics";
    } else if (classification.category === "ci") {
      result.diagnosis = "CI pipeline issue — likely gate scan failure or missing config.";
      result.actions.push({
        tool: "gate_status",
        action: "Check gate pass/fail status",
        urgency: "high",
      });
      result.actions.push({
        tool: "scan_staged",
        action: "Scan staged files for blocking issues",
        urgency: "high",
      });
      result.guidance = "1. Run npx simplebeacon gate-status to see what's blocking\n2. Fix blocking findings with propose_fix + verify_fix\n3. Re-run gate scan to confirm pass";
    } else if (classification.category === "production-leak") {
      result.diagnosis = "Production code importing mock/sample/fixture data.";
      result.actions.push({
        tool: "scan_snippet",
        action: "Scan for mock-path leaks in production code",
        urgency: "high",
      });
      result.guidance = "1. Move fixture imports behind test/dev gates\n2. Replace sample.json imports with live API calls\n3. Verify production build doesn't bundle fixtures";
    } else {
      result.diagnosis = "General engineering problem — running diagnostics.";
      result.actions.push({
        tool: "scan_project",
        action: "Run full project scan to identify issues",
        urgency: "medium",
      });
      result.actions.push({
        tool: "agent_status",
        action: "Check agent status and open tasks",
        urgency: "low",
      });
      result.guidance = "Run a full scan to identify blocking issues, then use propose_fix to remediate.";
    }

    // If filePath provided, scan it immediately
    if (filePath) {
      try {
        const fullPath = path.resolve(root, filePath);
        const scanResult = scanFileOnDisk(fullPath, { projectRoot: root, compressed: true });
        result.scanResult = {
          findings: scanResult.findings || [],
          count: (scanResult.findings || []).length,
        };
      } catch (err) {
        result.scanResult = { error: err.message };
      }
    }

    // Remember this problem-solving session
    try {
      pda.remember(root, agent.id, "problem:" + classification.category, JSON.stringify({
        problem,
        category: classification.category,
        timestamp: new Date().toISOString(),
      }), "decision");
    } catch {
      // non-fatal
    }

    return formatToolResult(result);
  });

  // ═══════════════════════════════════════════════════════════════════
  // diagnose_error — paste a stack trace, get root-cause + fix
  // ═══════════════════════════════════════════════════════════════════
  const diagnose_error = withGuard(async (args) => {
    const root = resolveProjectRoot(args?.projectRoot);
    const agent = detectAgent();
    const errorText = args?.error || args?.stackTrace || "";
    const filePath = args?.filePath || null;

    if (!errorText) {
      return formatToolResult({
        error: "Missing required argument: error (or stackTrace)",
        hint: "Paste the error message or stack trace",
      });
    }

    const diagnosis = _diagnoseError(errorText);
    const result = {
      error: errorText.slice(0, 500),
      diagnosis,
      agent: { id: agent.id, name: agent.name },
      scanResult: null,
      suggestedFix: null,
    };

    // If we identified a file, scan it
    if (diagnosis.likelyFile || filePath) {
      const targetFile = filePath || diagnosis.likelyFile;
      try {
        const fullPath = path.resolve(root, targetFile);
        const scanResult = scanFileOnDisk(fullPath, { projectRoot: root, compressed: true });
        result.scanResult = {
          file: targetFile,
          findings: scanResult.findings || [],
          count: (scanResult.findings || []).length,
        };

        // Try to propose a fix for the first finding
        if (scanResult.findings && scanResult.findings.length > 0) {
          const firstFinding = scanResult.findings[0];
          const actionCode = resolveActionCode(firstFinding);
          if (actionCode) {
            const template = getRemediationTemplate(actionCode);
            if (template) {
              result.suggestedFix = {
                actionCode,
                canAutoFix: template.canAutoFix,
                manualSteps: template.manualSteps,
                verifyCommand: template.verifyCommand,
              };
            }
          }
        }
      } catch (err) {
        result.scanResult = { error: err.message };
      }
    }

    // Remember this diagnosis
    try {
      pda.remember(root, agent.id, "diagnosis:" + diagnosis.category, JSON.stringify({
        error: errorText.slice(0, 200),
        category: diagnosis.category,
        rootCause: diagnosis.rootCause,
        timestamp: new Date().toISOString(),
      }), "decision");
    } catch {
      // non-fatal
    }

    return formatToolResult(result);
  });

  // ═══════════════════════════════════════════════════════════════════
  // master_engineering_brief — recovery playbook for stuck agents
  // ═══════════════════════════════════════════════════════════════════
  const master_engineering_brief = withGuard(async (args) => {
    const root = resolveProjectRoot(args?.projectRoot);
    const agent = detectAgent();
    const situation = args?.situation || "general";

    const report = await loadReport(root, args?.reportPath);
    const gate = report?.gate || {};
    const blocking = gate.blockingCount || 0;
    const warnings = gate.warningCount || 0;
    const qualityScore = report?.qualityScore ?? null;

    // Build the ten-cylinder plan
    const cylinders = [
      {
        cylinder: 1,
        name: "Assess",
        status: report ? "complete" : "pending",
        action: report ? "Scan report available" : "Run scan_project with gate:true",
      },
      {
        cylinder: 2,
        name: "Classify",
        status: blocking > 0 ? "blocking" : warnings > 0 ? "warnings" : "clean",
        action: blocking > 0
          ? `${blocking} blocking findings must be fixed before merge`
          : warnings > 0
            ? `${warnings} warnings — review but not blocking`
            : "Gate is clean",
      },
      {
        cylinder: 3,
        name: "Prioritize",
        status: "ready",
        action: blocking > 0
          ? "Fix critical findings first, then high, then medium"
          : "No blocking issues — focus on feature work",
      },
      {
        cylinder: 4,
        name: "Fix",
        status: blocking > 0 ? "needed" : "not_needed",
        action: blocking > 0
          ? "Use propose_fix for each blocking finding, then apply"
          : "Skip — no fixes needed",
      },
      {
        cylinder: 5,
        name: "Verify",
        status: "ready",
        action: "After applying fixes, run verify_fix on each changed file",
      },
      {
        cylinder: 6,
        name: "Gate",
        status: gate.pass === true ? "passed" : blocking > 0 ? "blocked" : "pending",
        action: gate.pass === true
          ? "Gate has passed — proceed to commit"
          : "Run scan_staged after fixes to confirm gate pass",
      },
      {
        cylinder: 7,
        name: "Remember",
        status: "ready",
        action: "Use agent_remember to store what was fixed and why",
      },
      {
        cylinder: 8,
        name: "Handoff",
        status: "ready",
        action: "Use handoff_write to brief the next session",
      },
      {
        cylinder: 9,
        name: "Token Budget",
        status: "tracking",
        action: "SimpleBeacon compression is active — token savings tracked automatically",
      },
      {
        cylinder: 10,
        name: "Yes You Can",
        status: "always",
        action: blocking > 0
          ? `You can fix ${blocking} blocking findings. Use arm_execute with action=fix to start.`
          : "Gate is clean. You can proceed with confidence.",
      },
    ];

    // Get token savings brief
    let savingsBrief = null;
    try {
      savingsBrief = tokenSavings.getSavingsBrief(root, agent.id);
    } catch {
      // non-fatal
    }

    // Get any existing handoff
    let previousHandoff = null;
    try {
      const agents = pda.listAgents(root);
      for (const a of agents) {
        const mem = pda.recallLatest(root, a.id, "handoff-brief", "handoff");
        if (mem && (!previousHandoff || mem.updatedAt > previousHandoff.updatedAt)) {
          previousHandoff = mem;
        }
      }
    } catch {
      // non-fatal
    }

    const brief = {
      agent: { id: agent.id, name: agent.name },
      situation,
      gate: {
        pass: gate.pass === true,
        blockingCount: blocking,
        warningCount: warnings,
        qualityScore,
      },
      cylinders,
      tokenSavings: savingsBrief,
      previousHandoff: previousHandoff
        ? { value: previousHandoff.value?.slice(0, 500), updatedAt: previousHandoff.updatedAt }
        : null,
      nextAction: blocking > 0
        ? `Fix ${blocking} blocking findings using arm_execute(action=fix)`
        : "Gate is clean — proceed with feature work",
      supportedAstPatterns: getSupportedPatterns().map((p) => p.patternId),
    };

    // Write to disk if requested
    if (args?.writeDisk) {
      try {
        const briefPath = path.join(root, ".simplebeacon", "master-engineering-brief.md");
        await mkdir(path.dirname(briefPath), { recursive: true });
        await writeFile(briefPath, _formatBriefAsMarkdown(brief), "utf8");
        brief.writtenTo = briefPath;
      } catch {
        // non-fatal
      }
    }

    return formatMarkdownResult(
      "Master Engineering Brief",
      _formatBriefAsMarkdown(brief),
    );
  });

  // ─── Private helpers ──────────────────────────────────────────────

  function _classifyProblem(problem) {
    const p = problem.toLowerCase();
    const categories = {
      secrets: ["secret", "credential", "api key", "token", "password", "leaked", "ghp_", "sk-"],
      "ai-slop": ["ai slop", "placeholder", "fictional", "fake metric", "llm", "generated by", "todo implement"],
      fiction: ["fiction", "stub", "not implemented", "placeholder", "fake"],
      tests: ["test", "jest", "vitest", "timeout", "failing test", "test suite"],
      ci: ["ci", "pipeline", "github actions", "workflow", "build failing", "gate"],
      "production-leak": ["mock", "sample", "fixture", "production leak", "demo data"],
      deployment: ["deploy", "deployment", "render", "cloudflare", "pages"],
      performance: ["slow", "performance", "timeout", "optimization", "latency"],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => p.includes(kw))) {
        return { category, confidence: "high" };
      }
    }

    return { category: "general", confidence: "low" };
  }

  function _diagnoseError(errorText) {
    const e = errorText.toLowerCase();

    // Specific patterns first (before generic catch-alls)

    // StreamInterdictionDashboard thresholds crash
    if (e.includes("thresholds") && (e.includes("is undefined") || e.includes("t.thresholds"))) {
      return {
        category: "missing_response_field",
        rootCause: "API response missing required field — component accesses it without null check",
        likelyFile: _extractFileFromStack(errorText),
        fix: "Add defensive defaults: const thresholds = status.thresholds ?? {}",
      };
    }

    // Chunk load failure (must come before generic null/type errors)
    if (e.includes("ns_error_corrupted_content") || e.includes("disallowed mime type") || e.includes("error loading dynamically imported module")) {
      return {
        category: "chunk_load_failure",
        rootCause: "Dynamic import chunk not found on CDN — returns HTML instead of JS",
        likelyFile: null,
        fix: "Rebuild and redeploy — chunk hash mismatch between index.html and CDN assets",
      };
    }

    // Backend unavailable
    if (e.includes("502") || e.includes("bad gateway")) {
      return {
        category: "backend_unavailable",
        rootCause: "API backend not responding or returning 502",
        likelyFile: null,
        fix: "Check backend health, or add stub response in Pages Functions",
      };
    }

    // Auth errors
    if (e.includes("401") || e.includes("403") || e.includes("unauthorized")) {
      return {
        category: "auth_error",
        rootCause: "Authentication or authorization failure",
        likelyFile: null,
        fix: "Check auth headers and token validity",
      };
    }

    // Missing module
    if (e.includes("module not found") || e.includes("cannot find module") || e.includes("err_module_not_found")) {
      return {
        category: "missing_module",
        rootCause: "Imported module does not exist or is not installed",
        likelyFile: _extractFileFromStack(errorText),
        fix: "Run npm install or check the import path is correct",
      };
    }

    // Reference error
    if (e.includes("is not defined") || e.includes("referenceerror")) {
      return {
        category: "reference_error",
        rootCause: "Variable or function referenced before declaration or not imported",
        likelyFile: _extractFileFromStack(errorText),
        fix: "Check imports and variable declarations",
      };
    }

    // Generic null reference (catch-all for "is undefined" / "is null")
    if (e.includes("cannot read propert") || e.includes("is undefined") || e.includes("is null")) {
      return {
        category: "null_reference",
        rootCause: "Accessing property on undefined or null value",
        likelyFile: _extractFileFromStack(errorText),
        fix: "Add null check or optional chaining before property access",
      };
    }

    // Type error
    if (e.includes("is not a function")) {
      return {
        category: "type_error",
        rootCause: "Calling a non-function value as a function",
        likelyFile: _extractFileFromStack(errorText),
        fix: "Verify the value is actually a function before calling",
      };
    }

    return {
      category: "unknown",
      rootCause: "Unrecognized error pattern — manual investigation needed",
      likelyFile: _extractFileFromStack(errorText),
      fix: "Search for the error message in the codebase and check recent changes",
    };
  }

  function _extractFileFromStack(stack) {
    // Try to extract file path from stack trace
    const match = stack.match(/at\s+.*?\(?(.+?\.\w+):(\d+)/);
    if (match) return match[1];
    return null;
  }

  function _formatBriefAsMarkdown(brief) {
    let md = `**Agent:** ${brief.agent.name} (${brief.agent.id})\n`;
    md += `**Situation:** ${brief.situation}\n\n`;

    md += `### Gate Status\n`;
    md += `- **Pass:** ${brief.gate.pass ? "YES" : "NO"}\n`;
    md += `- **Blocking:** ${brief.gate.blockingCount}\n`;
    md += `- **Warnings:** ${brief.gate.warningCount}\n`;
    if (brief.gate.qualityScore !== null) {
      md += `- **Quality Score:** ${brief.gate.qualityScore}\n`;
    }
    md += `\n`;

    md += `### Ten-Cylinder Plan\n\n`;
    md += `| # | Cylinder | Status | Action |\n`;
    md += `|---|----------|--------|--------|\n`;
    for (const c of brief.cylinders) {
      md += `| ${c.cylinder} | ${c.name} | ${c.status} | ${c.action} |\n`;
    }
    md += `\n`;

    if (brief.tokenSavings) {
      md += `### Token Budget\n`;
      md += `${brief.tokenSavings}\n\n`;
    }

    if (brief.previousHandoff) {
      md += `### Previous Handoff\n`;
      md += `Updated: ${brief.previousHandoff.updatedAt}\n`;
      md += `\`\`\`\n${brief.previousHandoff.value}\n\`\`\`\n\n`;
    }

    md += `### Next Action\n`;
    md += `**${brief.nextAction}**\n`;

    return md;
  }

  return {
    arm_execute,
    solve_problem,
    diagnose_error,
    master_engineering_brief,
  };
}

module.exports = { createArmHandlers };
