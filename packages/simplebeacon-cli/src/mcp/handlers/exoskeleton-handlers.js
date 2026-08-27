"use strict";

/**
 * MCP Exoskeleton Handlers — the always-on framework that wraps AI agents.
 *
 * An arm is a tool the agent picks up. An exoskeleton is a framework
 * that wraps the agent and is always-on, always sensing, always protecting.
 *
 * Tools:
 *   exoskeleton_boot        — Session start: injects gate + savings + handoff + health + tasks in one compressed payload
 *   exoskeleton_guard_edit  — Wraps every edit with pre-scan + post-scan + auto-fix proposal
 *   exoskeleton_guard_commit — Wraps every commit with gate check + memory + handoff update
 *   exoskeleton_sense        — Ambient monitoring: file changes, gate drift, new findings since last check
 *   exoskeleton_health       — Agent health: stuck loops, repeated failures, context budget remaining
 *   exoskeleton_status       — Full exoskeleton state: what's protected, monitored, compressed
 *
 * All operations are local-first (no upload).
 */

const fs = require("fs");
const path = require("path");
const { readFile, writeFile, mkdir, stat } = fs.promises;
const { execSync } = require("child_process");
const pda = require("../../agent-pda");
const tokenSavings = require("../../agent-pda/token-savings-tracker");
const { scanSnippetContent, scanFileOnDisk } = require("../../lib/snippet-scanner");
const { runDeterministicRemediation } = require("../../lib/ast-remediator");
const { getRemediationTemplate } = require("../../lib/remediation-templates");
const { ACTION_CODES } = require("../../lib/finding-compressor");

// ─── Exoskeleton state (per-process, persisted to disk) ───────────────
const STATE_FILE = "exoskeleton-state.json";

function getStatePath(projectRoot) {
  return path.join(
    projectRoot || process.cwd(),
    ".simplebeacon",
    "agent-pda",
    STATE_FILE,
  );
}

function loadState(projectRoot) {
  const statePath = getStatePath(projectRoot);
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      bootedAt: null,
      lastSenseAt: null,
      lastHealthAt: null,
      lastGatePass: null,
      lastGateBlockingCount: null,
      lastFileHashes: {},
      editCount: 0,
      commitCount: 0,
      scanCount: 0,
      fixCount: 0,
      stuckLoopCount: 0,
      repeatedFailures: [],
      contextBudget: { spent: 0, saved: 0 },
      protections: {
        editGuard: true,
        commitGuard: true,
        secretDetection: true,
        fictionDetection: true,
        mockPathDetection: true,
        tokenCompression: true,
        memoryPersistence: true,
        handoffTracking: true,
      },
      version: 1,
    };
  }
}

function saveState(projectRoot, state) {
  const statePath = getStatePath(projectRoot);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const { atomicWriteFileSync } = require("../../lib/atomic-writer");
  atomicWriteFileSync(statePath, JSON.stringify(state, null, 2));
}

function createExoskeletonHandlers({
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

  // ─── Helper: detect agent ───
  function detectAgent() {
    try {
      return pda.detectAgent() || { id: "unknown", name: "Unknown Agent" };
    } catch {
      return { id: "unknown", name: "Unknown Agent" };
    }
  }

  // ─── Helper: get file hash for change detection ───
  function getFileHash(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      // Simple hash — not crypto, just for change detection
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
      }
      return hash.toString(36);
    } catch {
      return null;
    }
  }

  // ─── Helper: get staged files ───
  function getStagedFiles(root) {
    try {
      const output = execSync("git diff --cached --name-only", {
        cwd: root,
        encoding: "utf8",
        timeout: 5000,
      });
      return output.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  // ─── Helper: get changed files (unstaged) ───
  function getChangedFiles(root) {
    try {
      const output = execSync("git diff --name-only", {
        cwd: root,
        encoding: "utf8",
        timeout: 5000,
      });
      return output.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  // ─── Helper: find mirror files (same relative path in different roots) ───
  // Detects files like useAuth.ts that exist in multiple dashboard copies:
  //   ai-platform/web/simplebeacon-dashboard/src/hooks/useAuth.ts
  //   coming-soon/public/app/src/hooks/useAuth.ts
  //   coming-soon/public/d2/src/hooks/useAuth.ts
  //   coming-soon/public/dashboard/src/hooks/useAuth.ts
  //   simplebeacon-vscode-merged/dashboard-web/src/hooks/useAuth.ts
  function findMirrorFiles(root, filePath) {
    try {
      const normalized = filePath.replace(/\\/g, "/");
      const basename = path.basename(normalized);
      // Use git ls-files to find all tracked files with the same basename
      const output = execSync(`git ls-files "*${basename}"`, {
        cwd: root,
        encoding: "utf8",
        timeout: 5000,
      });
      const candidates = output.trim().split("\n").filter(Boolean);
      // Filter to files that share the same relative path suffix (last 3+ path segments)
      const inputSegments = normalized.split("/").slice(-3).join("/");
      const mirrors = candidates.filter((f) => {
        if (f === normalized) return false; // Skip the file itself
        if (f === filePath.replace(/\\/g, "/")) return false;
        const fSegments = f.split("/").slice(-3).join("/");
        return fSegments === inputSegments && f.endsWith(basename);
      });
      return mirrors;
    } catch {
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // exoskeleton_boot — session start, inject everything in one payload
  // ═══════════════════════════════════════════════════════════════════
  const exoskeleton_boot = withGuard(async (args) => {
    const root = resolveProjectRoot(args?.projectRoot);
    const agent = detectAgent();
    const state = loadState(root);

    // Mark boot time
    state.bootedAt = new Date().toISOString();
    state.lastSenseAt = state.bootedAt;
    state.lastHealthAt = state.bootedAt;

    // Load gate state
    const report = await loadReport(root, args?.reportPath);
    const gate = report?.gate || {};
    const blocking = gate.blockingCount || 0;
    const warnings = gate.warningCount || 0;
    const qualityScore = report?.qualityScore ?? null;

    state.lastGatePass = gate.pass === true;
    state.lastGateBlockingCount = blocking;

    // Load token savings
    let savings = null;
    try {
      savings = tokenSavings.getSavings(root, { agentId: agent.id });
    } catch {
      // non-fatal
    }

    // Load previous handoff
    let handoff = null;
    try {
      const agents = pda.listAgents(root);
      for (const a of agents) {
        const mem = pda.recallLatest(root, a.id, "handoff-brief", "handoff");
        if (mem && (!handoff || mem.updatedAt > handoff.updatedAt)) {
          handoff = mem;
        }
      }
    } catch {
      // non-fatal
    }

    // Load open tasks
    let openTasks = [];
    try {
      const allTasks = pda.listTasks(root, { status: "pending" });
      openTasks = (allTasks || []).slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
      }));
    } catch {
      // non-fatal
    }

    // Auto-register agent
    try {
      pda.autoRegister(root);
    } catch {
      // non-fatal
    }

    // Detect environment
    const env = {
      agent: { id: agent.id, name: agent.name },
      projectRoot: root,
      hasReport: !!report,
      hasBaseline: fs.existsSync(path.join(root, ".simplebeacon", "baseline.json")),
      hasConfig: fs.existsSync(path.join(root, ".simplebeacon", "config.json")),
      gitRepo: fs.existsSync(path.join(root, ".git")),
      stagedFiles: getStagedFiles(root).length,
      changedFiles: getChangedFiles(root).length,
    };

    // Build compressed boot payload
    const boot = {
      exoskeleton: "active",
      bootedAt: state.bootedAt,
      agent: env.agent,
      environment: env,
      gate: {
        pass: gate.pass === true,
        blocking,
        warnings,
        qualityScore,
      },
      tokenSavings: savings
        ? {
            totalSaved: savings.totalSaved,
            compressionRatio: savings.compressionRatio,
            byTool: Object.keys(savings.byTool).length,
          }
        : null,
      handoff: handoff
        ? {
            updatedAt: handoff.updatedAt,
            preview: typeof handoff.value === "string"
              ? handoff.value.slice(0, 300)
              : JSON.stringify(handoff.value).slice(0, 300),
          }
        : null,
      openTasks,
      protections: state.protections,
      nextAction: blocking > 0
        ? `${blocking} blocking findings — use exoskeleton_guard_edit to fix them`
        : warnings > 0
          ? `${warnings} warnings — review with gate_status`
          : "Gate clean — proceed with feature work",
      sessionStats: {
        edits: state.editCount,
        commits: state.commitCount,
        scans: state.scanCount,
        fixes: state.fixCount,
      },
    };

    // Save state
    saveState(root, state);

    // Remember boot
    try {
      pda.remember(root, agent.id, "exoskeleton-boot", JSON.stringify({
        gate: boot.gate,
        timestamp: state.bootedAt,
      }), "context");
    } catch {
      // non-fatal
    }

    return formatToolResult(boot);
  });

  // ═══════════════════════════════════════════════════════════════════
  // exoskeleton_guard_edit — wraps every edit with pre-scan + post-scan
  // ═══════════════════════════════════════════════════════════════════
  const exoskeleton_guard_edit = withGuard(async (args) => {
    const root = resolveProjectRoot(args?.projectRoot);
    const agent = detectAgent();
    const state = loadState(root);

    const filePath = args?.filePath;
    const newContent = args?.newContent;
    const oldContent = args?.oldContent;
    const action = args?.action || "check"; // check | apply | verify

    if (!filePath) {
      return formatToolResult({
        error: "Missing required argument: filePath",
        hint: "Provide the file path being edited",
      });
    }

    const fullPath = path.resolve(root, filePath);
    const result = {
      filePath,
      action,
      agent: { id: agent.id, name: agent.name },
      preScan: null,
      postScan: null,
      fixesProposed: [],
      mirrorFiles: [],
      verdict: "safe", // safe | blocked | warning
      reason: null,
    };

    // Detect mirror files (same file exists in multiple dashboard copies)
    const mirrors = findMirrorFiles(root, filePath);
    if (mirrors.length > 0) {
      result.mirrorFiles = mirrors;
      if (result.verdict === "safe") {
        result.verdict = "warning";
        result.reason = `File has ${mirrors.length} mirror copies that may need the same edit: ${mirrors.slice(0, 3).join(", ")}${mirrors.length > 3 ? "..." : ""}`;
      }
    }

    // Pre-scan: scan old content (what's being replaced)
    if (oldContent) {
      try {
        const preScanResult = scanSnippetContent(String(oldContent), {
          filePath,
          projectRoot: root,
          compressed: true,
        });
        result.preScan = {
          findings: preScanResult.findings || [],
          count: (preScanResult.findings || []).length,
        };
      } catch (err) {
        result.preScan = { error: err.message };
      }
    }

    // Post-scan: scan new content (what's being applied)
    if (newContent) {
      try {
        const postScanResult = scanSnippetContent(String(newContent), {
          filePath,
          projectRoot: root,
          compressed: true,
        });
        result.postScan = {
          findings: postScanResult.findings || [],
          count: (postScanResult.findings || []).length,
        };

        // Track token savings
        if (postScanResult.findings && postScanResult.findings.length > 0) {
          try {
            const originalEst = tokenSavings.estimateTokens(
              JSON.stringify(postScanResult.findings),
            );
            const compressedEst = tokenSavings.estimateTokens(
              JSON.stringify(postScanResult.findings.map((f) => ({
                c: f.c, s: f.s, l: f.l, a: f.a,
              }))),
            );
            tokenSavings.recordSavings(root, {
              agentId: agent.id,
              tool: "exoskeleton_guard_edit",
              originalTokens: originalEst,
              compressedTokens: compressedEst,
            });
          } catch {
            // non-fatal
          }
        }

        // Determine verdict
        const blocking = (postScanResult.findings || []).filter(
          (f) => f.s === "C" || f.s === "H",
        );
        const warnings = (postScanResult.findings || []).filter(
          (f) => f.s === "M" || f.s === "L",
        );

        if (blocking.length > 0) {
          result.verdict = "blocked";
          result.reason = `${blocking.length} blocking findings (critical/high) in new content`;
        } else if (warnings.length > 0) {
          result.verdict = "warning";
          result.reason = `${warnings.length} warnings (medium/low) in new content`;
        }
      } catch (err) {
        result.postScan = { error: err.message };
        result.verdict = "warning";
        result.reason = `Scan error: ${err.message}`;
      }
    }

    // If action=verify, scan the file on disk after edit was applied
    if (action === "verify") {
      try {
        const verifyResult = scanFileOnDisk(fullPath, {
          projectRoot: root,
          compressed: true,
        });
        result.postScan = {
          findings: verifyResult.findings || [],
          count: (verifyResult.findings || []).length,
        };
        const blocking = (verifyResult.findings || []).filter(
          (f) => f.s === "C" || f.s === "H",
        );
        result.verdict = blocking.length === 0 ? "safe" : "blocked";
        result.reason = blocking.length === 0
          ? "File is clean after edit"
          : `${blocking.length} blocking findings remain`;
      } catch (err) {
        result.postScan = { error: err.message };
      }
    }

    // Propose fixes for all findings (blocking + warnings)
    if (result.postScan?.findings) {
      for (const finding of result.postScan.findings) {
        const actionCode = finding.a;
        if (!actionCode) continue;
        const template = getRemediationTemplate(actionCode);
        if (template) {
          result.fixesProposed.push({
            actionCode,
            severity: finding.s,
            canAutoFix: template.canAutoFix,
            manualSteps: template.manualSteps?.slice(0, 3),
            verifyCommand: template.verifyCommand,
          });
        }
      }
    }

    // Update state
    state.editCount++;
    if (result.verdict === "blocked") {
      state.repeatedFailures.push({
        type: "blocked_edit",
        filePath,
        timestamp: new Date().toISOString(),
      });
      // Keep only last 20
      if (state.repeatedFailures.length > 20) {
        state.repeatedFailures = state.repeatedFailures.slice(-20);
      }
    }
    saveState(root, state);

    // Record token savings for the scan
    state.scanCount = (state.scanCount || 0) + 1;
    saveState(root, state);

    return formatToolResult(result);
  });

  // ═══════════════════════════════════════════════════════════════════
  // exoskeleton_guard_commit — wraps every commit with gate + memory + handoff
  // ═══════════════════════════════════════════════════════════════════
  const exoskeleton_guard_commit = withGuard(async (args) => {
    const root = resolveProjectRoot(args?.projectRoot);
    const agent = detectAgent();
    const state = loadState(root);

    const stagedFiles = getStagedFiles(root);
    const result = {
      agent: { id: agent.id, name: agent.name },
      stagedFiles: stagedFiles.length,
      files: stagedFiles.slice(0, 20),
      gateCheck: null,
      memoryStored: false,
      handoffUpdated: false,
      verdict: "safe", // safe | blocked | warning
      reason: null,
      tokenSavings: null,
    };

    // Gate check: run staged-files-only gate scan (fast, catches custom heuristics)
    if (stagedFiles.length === 0) {
      result.gateCheck = { status: "no_staged_files" };
      result.verdict = "safe";
      result.reason = "No staged files to check";
    } else {
      // Try staged-files-only gate scan (copies staged files to temp dir, scans that)
      // This is the same approach as .simplebeacon/qa/pre-commit-gate.cjs but inline
      let blockingCount = 0;
      let warningCount = 0;
      const findings = [];
      let usedCliGate = false;

      try {
        const os = require("os");
        const tempRoot = path.join(os.tmpdir(), `sb-guard-commit-${process.pid}`);
        const tempConfigPath = path.join(tempRoot, ".simplebeacon", "config.json");

        // Copy staged files to temp dir preserving structure
        fs.mkdirSync(path.join(tempRoot, ".simplebeacon"), { recursive: true });
        const SCANNABLE_EXT = /\.(js|cjs|mjs|ts|tsx|jsx|json|yml|yaml|sh|py|go|rs|java|rb|php|cs)$/i;
        for (const relFile of stagedFiles) {
          if (!SCANNABLE_EXT.test(relFile)) continue;
          const src = path.resolve(root, relFile);
          const dst = path.join(tempRoot, relFile);
          if (!fs.existsSync(src)) continue;
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.copyFileSync(src, dst);
        }

        // Write minimal config for temp scan
        const realConfigPath = path.join(root, ".simplebeacon", "config.json");
        let realAllowlist = [];
        let realIgnore = [];
        try {
          const realConfig = JSON.parse(fs.readFileSync(realConfigPath, "utf8"));
          realAllowlist = realConfig.allowlist || [];
          realIgnore = realConfig.ignore || [];
        } catch { /* ignore */ }
        const tempConfig = {
          scanPaths: ["."],
          productionPaths: ["."],
          fullDirectoryScan: true,
          fullDirectoryScanMaxFiles: 10000,
          gate: { failOn: ["high"], warnOn: ["medium", "low"] },
          allowlist: realAllowlist,
          ignore: realIgnore,
        };
        fs.writeFileSync(tempConfigPath, JSON.stringify(tempConfig), "utf8");

        // Run gate scan against temp dir
        const cliBin = path.resolve(root, "packages", "simplebeacon-cli", "bin", "simplebeacon.js");
        const binArg = fs.existsSync(cliBin) ? cliBin : "simplebeacon";
        const stagedReportPath = path.join(tempRoot, "staged-report.json");
        execSync(
          `node "${binArg}" scan --path "${tempRoot}" --config "${tempConfigPath}" --gate --offline --format json --output "${stagedReportPath}"`,
          {
            cwd: root,
            encoding: "utf8",
            timeout: 15000,
            stdio: "pipe",
          },
        );

        const stagedReport = JSON.parse(fs.readFileSync(stagedReportPath, "utf8"));
        const gate = stagedReport.gate || {};
        blockingCount = gate.blockingCount || 0;
        warningCount = gate.warningCount || 0;
        for (const issue of (gate.blockingIssues || [])) {
          findings.push({
            file: issue.filePath || issue.file || "unknown",
            c: issue.id || issue.pattern || "UNKNOWN",
            s: issue.severityBand || issue.severity || "H",
            l: issue.line || 0,
            m: (issue.description || "").slice(0, 120),
          });
        }
        for (const issue of (gate.warningIssues || []).slice(0, 10)) {
          findings.push({
            file: issue.filePath || issue.file || "unknown",
            c: issue.id || issue.pattern || "UNKNOWN",
            s: issue.severityBand || issue.severity || "M",
            l: issue.line || 0,
            m: (issue.description || "").slice(0, 120),
          });
        }
        usedCliGate = true;

        // Clean up temp dir
        try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch { /* ignore */ }
      } catch {
        // Fall back to per-file scan if CLI gate scan fails or times out
      }

      if (!usedCliGate) {
        // Per-file fallback (doesn't catch custom heuristics, but better than nothing)
        for (const file of stagedFiles.slice(0, 50)) {
          const fullPath = path.resolve(root, file);
          try {
            const scanResult = scanFileOnDisk(fullPath, {
              projectRoot: root,
              compressed: true,
            });
            const fileFindings = scanResult.findings || [];
            for (const f of fileFindings) {
              if (f.s === "C" || f.s === "H") blockingCount++;
              else warningCount++;
              findings.push({ file, ...f });
            }
          } catch {
            // Skip files that can't be scanned
          }
        }
      }

      result.gateCheck = {
        status: blockingCount > 0 ? "blocked" : warningCount > 0 ? "warning" : "clean",
        blockingCount,
        warningCount,
        totalFindings: findings.length,
        topFindings: findings.slice(0, 5),
      };

      if (blockingCount > 0) {
        result.verdict = "blocked";
        result.reason = `${blockingCount} blocking findings in staged files — fix before committing`;
      } else if (warningCount > 0) {
        result.verdict = "warning";
        result.reason = `${warningCount} warnings in staged files — review recommended`;
      }
    }

    // Store commit memory
    try {
      pda.remember(root, agent.id, "commit:" + Date.now(), JSON.stringify({
        stagedFiles: stagedFiles.length,
        verdict: result.verdict,
        gateStatus: result.gateCheck?.status,
        timestamp: new Date().toISOString(),
      }), "session-note");
      result.memoryStored = true;
    } catch {
      // non-fatal
    }

    // Update handoff
    try {
      const handoffData = {
        agent: agent.id,
        timestamp: new Date().toISOString(),
        commitVerdict: result.verdict,
        stagedFiles: stagedFiles.length,
        gateStatus: result.gateCheck?.status,
        nextAction: result.verdict === "blocked"
          ? "Fix blocking findings, then re-stage and commit"
          : "Commit is safe — proceed",
      };
      pda.remember(root, agent.id, "handoff-brief", JSON.stringify(handoffData), "handoff");
      result.handoffUpdated = true;
    } catch {
      // non-fatal
    }

    // Get token savings
    try {
      const savings = tokenSavings.getSavingsBrief(root, agent.id);
      result.tokenSavings = savings;
    } catch {
      // non-fatal
    }

    // Update state
    state.commitCount++;
    if (result.verdict === "blocked") {
      state.repeatedFailures.push({
        type: "blocked_commit",
        timestamp: new Date().toISOString(),
      });
      if (state.repeatedFailures.length > 20) {
        state.repeatedFailures = state.repeatedFailures.slice(-20);
      }
    }
    saveState(root, state);

    return formatToolResult(result);
  });

  // ═══════════════════════════════════════════════════════════════════
  // exoskeleton_sense — ambient environment monitoring
  // ═══════════════════════════════════════════════════════════════════
  const exoskeleton_sense = withGuard(async (args) => {
    const root = resolveProjectRoot(args?.projectRoot);
    const agent = detectAgent();
    const state = loadState(root);
    const now = new Date().toISOString();

    const sense = {
      timestamp: now,
      agent: { id: agent.id, name: agent.name },
      changedFiles: [],
      newFindings: [],
      gateDrift: null,
      fileHashChanges: [],
      mirrorDrift: [],
      summary: "stable",
    };

    // Detect changed files
    const changedFiles = getChangedFiles(root);
    const stagedFiles = getStagedFiles(root);
    sense.changedFiles = changedFiles.slice(0, 20).map((f) => ({
      file: f,
      staged: stagedFiles.includes(f),
    }));

    // Detect file hash changes (files modified since last sense)
    const currentHashes = {};
    for (const file of changedFiles.slice(0, 50)) {
      const fullPath = path.resolve(root, file);
      const hash = getFileHash(fullPath);
      if (hash) {
        currentHashes[file] = hash;
        if (state.lastFileHashes[file] && state.lastFileHashes[file] !== hash) {
          sense.fileHashChanges.push(file);
        }
      }
    }

    // Detect gate drift
    const report = await loadReport(root, args?.reportPath);
    if (report?.gate) {
      const currentPass = report.gate.pass === true;
      const currentBlocking = report.gate.blockingCount || 0;
      if (state.lastGatePass !== null) {
        if (state.lastGatePass && !currentPass) {
          sense.gateDrift = "regressed";
          sense.summary = "gate_regressed";
        } else if (!state.lastGatePass && currentPass) {
          sense.gateDrift = "improved";
          sense.summary = "gate_improved";
        } else if (currentBlocking > (state.lastGateBlockingCount || 0)) {
          sense.gateDrift = "worsened";
          sense.summary = "new_blocking_findings";
        }
      }
      state.lastGatePass = currentPass;
      state.lastGateBlockingCount = currentBlocking;
    }

    // Scan changed files for new findings
    if (sense.fileHashChanges.length > 0) {
      for (const file of sense.fileHashChanges.slice(0, 10)) {
        const fullPath = path.resolve(root, file);
        try {
          const scanResult = scanFileOnDisk(fullPath, {
            projectRoot: root,
            compressed: true,
          });
          const findings = scanResult.findings || [];
          if (findings.length > 0) {
            sense.newFindings.push({
              file,
              count: findings.length,
              top: findings.slice(0, 3),
            });
          }
        } catch {
          // non-fatal
        }
      }
    }

    // Detect mirror drift — changed files whose mirror copies weren't updated
    if (sense.fileHashChanges.length > 0) {
      for (const changedFile of sense.fileHashChanges.slice(0, 10)) {
        const mirrors = findMirrorFiles(root, changedFile);
        if (mirrors.length === 0) continue;
        const changedHash = getFileHash(path.resolve(root, changedFile));
        const staleMirrors = [];
        for (const mirror of mirrors) {
          const mirrorHash = getFileHash(path.resolve(root, mirror));
          if (mirrorHash && mirrorHash !== changedHash) {
            staleMirrors.push(mirror);
          }
        }
        if (staleMirrors.length > 0) {
          sense.mirrorDrift.push({
            file: changedFile,
            staleMirrors,
            totalMirrors: mirrors.length,
          });
        }
      }
      if (sense.mirrorDrift.length > 0 && sense.summary === "stable") {
        sense.summary = "mirror_drift_detected";
      }
    }

    // Update summary
    if (sense.newFindings.length > 0 && sense.summary === "stable") {
      sense.summary = "new_findings_detected";
    }

    // Update state
    state.lastSenseAt = now;
    state.lastFileHashes = { ...state.lastFileHashes, ...currentHashes };
    // Clean up old hashes (keep only last 100)
    const hashKeys = Object.keys(state.lastFileHashes);
    if (hashKeys.length > 100) {
      state.lastFileHashes = {};
      for (const k of hashKeys.slice(-100)) {
        state.lastFileHashes[k] = state.lastFileHashes[k];
      }
    }
    saveState(root, state);

    return formatToolResult(sense);
  });

  // ═══════════════════════════════════════════════════════════════════
  // exoskeleton_health — agent health tracking
  // ═══════════════════════════════════════════════════════════════════
  const exoskeleton_health = withGuard(async (args) => {
    const root = resolveProjectRoot(args?.projectRoot);
    const agent = detectAgent();
    const state = loadState(root);
    const now = new Date().toISOString();

    // Detect stuck loops (repeated failures of same type)
    const recentFailures = state.repeatedFailures || [];
    const failureTypes = {};
    for (const f of recentFailures) {
      const key = f.type + ":" + (f.filePath || "");
      failureTypes[key] = (failureTypes[key] || 0) + 1;
    }

    const stuckLoops = Object.entries(failureTypes)
      .filter(([, count]) => count >= 3)
      .map(([key, count]) => ({ pattern: key, count }));

    // Detect repeated blocked edits on same file
    const blockedEditsByFile = {};
    for (const f of recentFailures) {
      if (f.type === "blocked_edit" && f.filePath) {
        blockedEditsByFile[f.filePath] = (blockedEditsByFile[f.filePath] || 0) + 1;
      }
    }
    const stuckFiles = Object.entries(blockedEditsByFile)
      .filter(([, count]) => count >= 3)
      .map(([file, count]) => ({ file, count }));

    // Context budget
    let savings = null;
    try {
      savings = tokenSavings.getSavings(root, { agentId: agent.id });
    } catch {
      // non-fatal
    }

    const contextBudget = {
      saved: savings?.totalSaved || 0,
      compressionRatio: savings?.compressionRatio || "0%",
      byTool: savings?.byTool
        ? Object.entries(savings.byTool).map(([tool, data]) => ({
            tool,
            saved: data.saved,
            count: data.count,
          })).slice(0, 5)
        : [],
    };

    // Session duration
    const sessionDuration = state.bootedAt
      ? Date.now() - new Date(state.bootedAt).getTime()
      : 0;

    // Health score (0-100)
    let healthScore = 100;
    if (stuckLoops.length > 0) healthScore -= 20 * stuckLoops.length;
    if (stuckFiles.length > 0) healthScore -= 15 * stuckFiles.length;
    if (recentFailures.length > 10) healthScore -= 10;
    if (state.lastGatePass === false) healthScore -= 15;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const health = {
      timestamp: now,
      agent: { id: agent.id, name: agent.name },
      score: healthScore,
      status: healthScore >= 80 ? "healthy" : healthScore >= 50 ? "degraded" : "critical",
      sessionDuration,
      sessionStats: {
        edits: state.editCount || 0,
        commits: state.commitCount || 0,
        scans: state.scanCount || 0,
        fixes: state.fixCount || 0,
      },
      stuckLoops,
      stuckFiles,
      recentFailures: recentFailures.slice(-5),
      contextBudget,
      gate: {
        lastPass: state.lastGatePass,
        lastBlockingCount: state.lastGateBlockingCount,
      },
      recommendations: [],
    };

    // Generate recommendations
    if (stuckLoops.length > 0) {
      health.recommendations.push({
        type: "stuck_loop",
        message: `Detected ${stuckLoops.length} stuck loop(s). Use master_engineering_brief for a recovery plan.`,
      });
    }
    if (stuckFiles.length > 0) {
      health.recommendations.push({
        type: "stuck_file",
        message: `Repeatedly blocked on ${stuckFiles.map((s) => s.file).join(", ")}. Use diagnose_error to identify root cause.`,
      });
    }
    if (state.lastGatePass === false) {
      health.recommendations.push({
        type: "gate_blocked",
        message: `Gate is blocked with ${state.lastGateBlockingCount} findings. Use arm_execute(action=fix) to start fixing.`,
      });
    }
    if (contextBudget.saved > 0) {
      health.recommendations.push({
        type: "token_budget",
        message: `SimpleBeacon has saved ~${contextBudget.saved.toLocaleString()} tokens (${contextBudget.compressionRatio} reduction). Context budget is healthy.`,
      });
    }
    if (health.recommendations.length === 0) {
      health.recommendations.push({
        type: "all_clear",
        message: "Agent is healthy. No stuck loops, gate is clean, context budget is positive.",
      });
    }

    // Update state
    state.lastHealthAt = now;
    state.stuckLoopCount = stuckLoops.length;
    saveState(root, state);

    return formatToolResult(health);
  });

  // ═══════════════════════════════════════════════════════════════════
  // exoskeleton_status — full exoskeleton state report
  // ═══════════════════════════════════════════════════════════════════
  const exoskeleton_status = withGuard(async (args) => {
    const root = resolveProjectRoot(args?.projectRoot);
    const agent = detectAgent();
    const state = loadState(root);

    const report = await loadReport(root, args?.reportPath);

    const status = {
      exoskeleton: state.bootedAt ? "active" : "dormant",
      agent: { id: agent.id, name: agent.name },
      bootedAt: state.bootedAt,
      lastSenseAt: state.lastSenseAt,
      lastHealthAt: state.lastHealthAt,
      protections: state.protections,
      sessionStats: {
        edits: state.editCount || 0,
        commits: state.commitCount || 0,
        scans: state.scanCount || 0,
        fixes: state.fixCount || 0,
      },
      gate: {
        lastPass: state.lastGatePass,
        lastBlockingCount: state.lastGateBlockingCount,
        currentPass: report?.gate?.pass === true,
        currentBlockingCount: report?.gate?.blockingCount || 0,
      },
      stuckLoopCount: state.stuckLoopCount || 0,
      recentFailures: (state.repeatedFailures || []).length,
      contextBudget: state.contextBudget,
      toolsAvailable: 46, // 36 base + 4 arm + 6 exoskeleton
      layers: {
        scanner: "active",
        arm: "active",
        exoskeleton: state.bootedAt ? "active" : "dormant",
        compression: state.protections.tokenCompression ? "active" : "disabled",
        memory: state.protections.memoryPersistence ? "active" : "disabled",
        handoff: state.protections.handoffTracking ? "active" : "disabled",
      },
    };

    return formatToolResult(status);
  });

  return {
    exoskeleton_boot,
    exoskeleton_guard_edit,
    exoskeleton_guard_commit,
    exoskeleton_sense,
    exoskeleton_health,
    exoskeleton_status,
  };
}

module.exports = { createExoskeletonHandlers };
