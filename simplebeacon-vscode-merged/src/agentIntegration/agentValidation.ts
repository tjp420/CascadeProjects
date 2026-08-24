/**
 * Agent validation module — the AI agent's quality gate and guardrail layer.
 *
 * This implements the 7-step agent workflow from Milestone 3:
 * 1. Preflight scan — understand repo conventions before writing
 * 2. Diff-based validation — scan only changed files after each patch
 * 3. Explain-and-fix loop — read rule metadata, fix or suppress with rationale
 * 4. Project policy compliance — load custom rules, allowlists, severity policies
 * 5. "Stop and ask" behavior — flag high-risk changes for human review
 * 6. Gate enforcement — refuse to finalize if gate fails
 * 7. Learning loop — record suppressions and tune rules over time
 *
 * Milestone 3: AI Agent Workflow Integration
 *
 * Context Interceptor (Milestone 4) — wires diff validation, gate enforcement,
 * and codemap coupling analysis into VS Code save events and AI session lifecycle.
 * Uses the existing RealtimeMonitor heuristic (rapid file changes) for agent
 * detection — no fiction env vars or app-name sniffing.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RealtimeIssue } from '../realtimeIssue';
import { FileRole, classifyFileRole, shouldScanRole } from '../classifiers/fileRoleClassifier';
import { calibrateSeverity } from '../classifiers/severityCalibrator';
import { shouldSuppress } from '../classifiers/smartSuppressor';
import { getCustomRulesConfig, runCustomRules, applySeverityOverrides } from '../customRules/customRuleEngine';
import { DiffFile, buildDiffScanResult, DiffScanResult, formatDiffScanReport } from './diffScanner';
import { getDismissalTracker } from '../classifiers/dismissalTracker';

// ─── Types ───

export interface PreflightContext {
  /** Custom rules loaded from .simplebeacon/custom-rules.json */
  customRuleCount: number;
  /** Severity overrides from config.json */
  severityOverrideCount: number;
  /** Allowlist patterns */
  allowlistPatterns: string[];
  /** File roles present in the workspace */
  fileRoleDistribution: Record<string, number>;
  /** Known repo conventions (inferred from rules) */
  conventions: string[];
  /** High-risk rule types for this repo */
  highRiskRules: string[];
}

export interface ExplainResult {
  ruleType: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  fileRole: FileRole;
  isFalsePositive: boolean;
  falsePositiveReason?: string;
  recommendedAction: 'fix' | 'suppress' | 'ignore';
  fixInstructions?: string;
  suppressionRationale?: string;
}

export interface GateDecision {
  canFinalize: boolean;
  blockingCount: number;
  warningCount: number;
  findings: RealtimeIssue[];
  report: string;
  recommendation: 'proceed' | 'fix-required' | 'human-review' | 'proceed-with-notes';
}

// ─── 1. Preflight scan ───

/**
 * Run a preflight scan to understand repo conventions before the agent writes code.
 *
 * This gives the agent context about:
 * - What custom rules exist
 * - What severity overrides are configured
 * - What file types are present
 * - What counts as risky for this project
 */
export function preflightScan(workspaceRoot: string): PreflightContext {
  const { config, overrides } = getCustomRulesConfig(workspaceRoot);

  // Analyze file role distribution
  const roleDist: Record<string, number> = {};
  try {
    walkDir(
      workspaceRoot,
      (filePath) => {
        const role = classifyFileRole(filePath).role;
        roleDist[role] = (roleDist[role] || 0) + 1;
      },
      3
    ); // Limit depth for performance
  } catch {
    /* ignore walk errors */
  }

  // Infer conventions from custom rules
  const conventions: string[] = [];
  for (const rule of config.rules) {
    if (rule.message) conventions.push(`${rule.id}: ${rule.message}`);
  }

  // Identify high-risk rules (error severity)
  const highRiskRules = config.rules.filter((r) => r.severity === 'error').map((r) => r.id);

  // Add high-risk overrides
  for (const override of overrides) {
    if (override.severity === 'error') {
      highRiskRules.push(override.ruleType);
    }
  }

  return {
    customRuleCount: config.rules.length,
    severityOverrideCount: overrides.length,
    allowlistPatterns: config.allowlist || [],
    fileRoleDistribution: roleDist,
    conventions,
    highRiskRules: [...new Set(highRiskRules)],
  };
}

// ─── 2. Diff-based validation ───

/**
 * Validate a diff by scanning only changed files and lines.
 *
 * @param changedFiles Files with changed line ranges
 * @param fileContents Map of file path → content
 * @param blockOnSeverity Minimum severity to block finalization
 * @returns DiffScanResult with only new findings on changed lines
 */
export function validateDiff(
  changedFiles: DiffFile[],
  fileContents: Map<string, string>,
  blockOnSeverity: 'error' | 'warning' | 'info' = 'error'
): DiffScanResult {
  const allFindings: RealtimeIssue[] = [];

  for (const diffFile of changedFiles) {
    const content = fileContents.get(diffFile.filePath);
    if (!content) continue;

    // Classify file role
    const roleResult = classifyFileRole(diffFile.filePath, content.slice(0, 500));
    if (!shouldScanRole(roleResult.role)) continue;

    const fileExt = path.extname(diffFile.filePath).slice(1).toLowerCase();

    // Run custom rules on the full file
    const { config, overrides } = getCustomRulesConfig();
    const customIssues = runCustomRules(config, diffFile.filePath, content, roleResult.role, fileExt);

    // Apply severity overrides
    const overriddenIssues = applySeverityOverrides(overrides, customIssues, diffFile.filePath, roleResult.role);

    // Apply severity calibration + smart suppression (M1 pipeline)
    const calibratedIssues: RealtimeIssue[] = [];
    const lines = content.split('\n');
    for (const issue of overriddenIssues) {
      const lineText = lines[issue.line - 1] || '';
      const suppression = shouldSuppress(issue.type, lineText, diffFile.filePath, lineText, roleResult.role, content);
      if (suppression.suppressed) continue;

      const calibration = calibrateSeverity(issue.type, issue.severity, roleResult.role);
      if (calibration.severity === 'suppressed') continue;

      calibratedIssues.push({
        ...issue,
        severity: calibration.severity as 'error' | 'warning' | 'info',
        fileRole: roleResult.role,
        calibrated: calibration.severity !== issue.severity,
      });
    }

    // Filter to only changed lines
    const changedLineFindings = calibratedIssues.filter((f) =>
      diffFile.changedLines.some((range) => f.line >= range.start && f.line <= range.end)
    );

    allFindings.push(...changedLineFindings);
  }

  return buildDiffScanResult(changedFiles, allFindings, [], blockOnSeverity);
}

// ─── 3. Explain-and-fix loop ───

/**
 * Explain a finding and recommend an action.
 *
 * This is the "explain" step in the agent's explain-and-fix loop.
 * The agent reads the rule metadata, understands the reason, and decides
 * whether to fix it or suppress it as a false positive.
 */
export function explainFinding(issue: RealtimeIssue, lineText: string, fileContent: string): ExplainResult {
  const fileRole = issue.fileRole || classifyFileRole(issue.file, fileContent.slice(0, 500)).role;

  // Check if this is a false positive
  const suppression = shouldSuppress(issue.type, lineText, issue.file, lineText, fileRole, fileContent);

  // Check if severity was already calibrated
  const calibration = calibrateSeverity(issue.type, issue.severity, fileRole);

  let recommendedAction: 'fix' | 'suppress' | 'ignore' = 'fix';
  let fixInstructions: string | undefined;
  let suppressionRationale: string | undefined;

  if (suppression.suppressed) {
    recommendedAction = 'suppress';
    suppressionRationale = `False positive: ${suppression.reason} (suppressor: ${suppression.suppressor})`;
  } else if (calibration.severity === 'suppressed') {
    recommendedAction = 'ignore';
    suppressionRationale = `Suppressed by severity calibration: ${calibration.reason}`;
  } else if (issue.severity === 'info') {
    // Low severity — agent can decide
    recommendedAction = 'fix';
    fixInstructions = issue.suggestion || 'Review and fix if relevant';
  } else {
    // Error or warning — must fix
    recommendedAction = 'fix';
    fixInstructions = issue.suggestion || `Fix the ${issue.type} issue`;
  }

  return {
    ruleType: issue.type,
    severity: issue.severity,
    message: issue.message,
    suggestion: issue.suggestion,
    fileRole,
    isFalsePositive: suppression.suppressed,
    falsePositiveReason: suppression.suppressed ? suppression.reason : undefined,
    recommendedAction,
    fixInstructions,
    suppressionRationale,
  };
}

// ─── 4. Gate enforcement ───

/**
 * Make a gate decision: can the agent finalize this change?
 *
 * This is the "refuse-to-commit" gate from Milestone 3.
 *
 * @param scanResult The diff scan result
 * @param requireHumanReviewForWarnings If true, warnings require human review
 * @returns GateDecision with the final recommendation
 */
export function makeGateDecision(
  scanResult: DiffScanResult,
  requireHumanReviewForWarnings: boolean = false
): GateDecision {
  const blocking = scanResult.blockingFindings;
  const warnings = scanResult.newFindings.filter((f) => f.severity === 'warning' && !blocking.includes(f));

  let recommendation: GateDecision['recommendation'] = 'proceed';
  let canFinalize = true;

  if (blocking.length > 0) {
    recommendation = 'fix-required';
    canFinalize = false;
  } else if (requireHumanReviewForWarnings && warnings.length > 0) {
    recommendation = 'human-review';
    canFinalize = false;
  } else if (scanResult.newFindings.length > 0) {
    recommendation = 'proceed-with-notes';
  }

  return {
    canFinalize,
    blockingCount: blocking.length,
    warningCount: warnings.length,
    findings: scanResult.newFindings,
    report: formatDiffScanReport(scanResult),
    recommendation,
  };
}

// ─── 5. Learning loop ───

/**
 * Record a suppression decision in the repo policy.
 *
 * This is the learning loop from Milestone 3:
 * - If a suppression is accepted, record it
 * - The agent learns from it next time
 * - Noise reduces over time
 */
export function recordSuppression(
  workspaceRoot: string,
  ruleType: string,
  filePath: string,
  line: number,
  rationale: string
): void {
  // Track in the dismissal tracker
  const tracker = getDismissalTracker();
  const signature = `${filePath}:${line}:${ruleType}`;
  tracker.recordDismissal(ruleType, signature);

  // Also persist to the suppression log
  const sbDir = path.join(workspaceRoot, '.simplebeacon');
  if (!fs.existsSync(sbDir)) {
    fs.mkdirSync(sbDir, { recursive: true });
  }

  const logPath = path.join(sbDir, 'suppression-log.json');
  let log: Array<{
    ruleType: string;
    filePath: string;
    line: number;
    rationale: string;
    timestamp: string;
  }> = [];

  try {
    if (fs.existsSync(logPath)) {
      log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
  } catch {
    /* start fresh */
  }

  log.push({
    ruleType,
    filePath,
    line,
    rationale,
    timestamp: new Date().toISOString(),
  });

  fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n', 'utf8');
}

/**
 * Load the suppression log for agent context.
 */
export function loadSuppressionLog(workspaceRoot: string): Array<{
  ruleType: string;
  filePath: string;
  line: number;
  rationale: string;
  timestamp: string;
}> {
  const logPath = path.join(workspaceRoot, '.simplebeacon', 'suppression-log.json');
  try {
    if (!fs.existsSync(logPath)) return [];
    return JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch {
    return [];
  }
}

// ─── 6. Context Interceptor (Milestone 4) ───

/**
 * Dependencies needed by the context interceptor.
 * Uses minimal interfaces so the wiring function is testable without
 * importing the full RealtimeMonitor.
 */
export interface ContextInterceptorDeps {
  /** Returns true when the RealtimeMonitor heuristic detects an active AI editing session */
  isAiSessionActive: () => boolean;
  /** Returns the list of file paths edited during the current AI session */
  getAiEditedFiles: () => string[];
  /** Registers a callback fired when the AI session ends (5s after last file change) */
  onAiSessionEnd: (callback: (files: string[]) => void) => void;
  /** Workspace root path for resolving .simplebeacon/codemap-analysis.json */
  workspaceRoot: string;
  /** Output channel for logging interceptor activity */
  outputChannel: { appendLine: (msg: string) => void };
}

/**
 * Agent detection modes:
 * - 'off':       No save-time validation. AI session detection disabled.
 * - 'heuristic': (default) Use RealtimeMonitor's rapid-file-change detection.
 * - 'always':    Always validate on save, regardless of AI session state.
 *                Useful for agents that don't trigger rapid file changes.
 */
export type AgentDetectionMode = 'off' | 'heuristic' | 'always';

/**
 * Source file extensions that the interceptor validates on save.
 * Non-source files (images, binaries, configs outside scanPaths) are skipped.
 */
const VALIDATED_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.json']);

/**
 * Register the Context Interceptor — wires agent validation into VS Code save
 * events and AI session lifecycle.
 *
 * What it does:
 * 1. On save: if an AI session is active (or mode is 'always'), runs validateDiff()
 *    on the saved file and surfaces findings as VS Code diagnostics (squiggly
 *    underlines + Problems panel). Cursor and Windsurf agents auto-read diagnostics.
 * 2. On AI session end: reads .simplebeacon/codemap-analysis.json, finds coupled
 *    dependencies for the edited files, and copies a coupling summary to the
 *    clipboard so the agent receives monorepo-wide context.
 *
 * What it does NOT do:
 * - Does not block saves (diagnostics are advisory; the commit gate is the hard boundary)
 * - Does not use fiction env vars (AI_AGENT_RUNNING, CURSOR_AGENT, etc.)
 * - Does not block the human user's saves (heuristic mode only fires during AI sessions)
 *
 * @returns vscode.Disposable — call .dispose() to unregister all listeners
 */
export function registerContextInterceptor(
  deps: ContextInterceptorDeps,
  context: vscode.ExtensionContext
): vscode.Disposable {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('simplebeacon-agent-guard');

  // ─── 1. Save-time validation ───
  const saveListener = vscode.workspace.onWillSaveTextDocument((event) => {
    const config = vscode.workspace.getConfiguration('simplebeacon');
    const mode = config.get<AgentDetectionMode>('agentDetectionMode', 'heuristic');
    if (mode === 'off') return;

    const isAgentActive = mode === 'always' || deps.isAiSessionActive();
    if (!isAgentActive) return;

    const doc = event.document;
    const filePath = doc.uri.fsPath;

    // Skip files outside the workspace root
    const root = deps.workspaceRoot;
    if (!filePath.startsWith(root)) return;

    // Skip non-source files
    const ext = path.extname(filePath).toLowerCase();
    if (!VALIDATED_EXTENSIONS.has(ext)) return;

    // Build a DiffFile covering all lines (conservative — scan full file on save)
    const lineCount = doc.lineCount;
    const content = doc.getText();
    const diffFile: DiffFile = {
      filePath,
      status: 'modified',
      changedLines: [{ start: 1, end: lineCount }],
    };

    const fileContents = new Map<string, string>();
    fileContents.set(filePath, content);

    try {
      const scanResult = validateDiff([diffFile], fileContents, 'error');
      const decision = makeGateDecision(scanResult);

      // Surface findings as VS Code diagnostics
      const diagnostics: vscode.Diagnostic[] = scanResult.newFindings.map((f) => {
        const line = Math.max(0, f.line - 1);
        const col = Math.max(0, f.column - 1);
        const range = new vscode.Range(line, col, line, col + 1);
        const severity =
          f.severity === 'error'
            ? vscode.DiagnosticSeverity.Error
            : f.severity === 'warning'
              ? vscode.DiagnosticSeverity.Warning
              : vscode.DiagnosticSeverity.Information;
        const diag = new vscode.Diagnostic(range, `[SimpleBeacon Agent Guard] ${f.message}`, severity);
        diag.source = 'SimpleBeacon';
        diag.code = f.type;
        return diag;
      });

      if (diagnostics.length > 0) {
        diagnosticCollection.set(doc.uri, diagnostics);
      } else {
        diagnosticCollection.delete(doc.uri);
      }

      // Warn if gate fails — this is advisory, not a save block
      if (!decision.canFinalize && decision.recommendation === 'fix-required') {
        vscode.window.showWarningMessage(
          `[SimpleBeacon] Agent Guard: ${decision.blockingCount} blocking issue(s) in ${path.basename(filePath)}. ` +
            `Fix before committing — the pre-commit gate will block this.`
        );
        deps.outputChannel.appendLine(
          `[Agent Guard] Save validation: ${decision.blockingCount} blocking, ` +
            `${decision.warningCount} warnings in ${path.basename(filePath)}`
        );
      }
    } catch (e) {
      // Validation errors should never block the save
      deps.outputChannel.appendLine(`[Agent Guard] Validation error for ${path.basename(filePath)}: ${e}`);
    }
  });

  // ─── 2. AI session end — coupling analysis ───
  deps.onAiSessionEnd((files) => {
    if (files.length === 0) return;

    const couplingSummary = buildCouplingSummary(files, deps.workspaceRoot);
    if (!couplingSummary) return;

    deps.outputChannel.appendLine(couplingSummary);

    // Copy to clipboard — agents paste clipboard content into their context
    vscode.env.clipboard.writeText(couplingSummary).then(
      () => deps.outputChannel.appendLine('[Agent Guard] Coupling summary copied to clipboard for agent context'),
      () => deps.outputChannel.appendLine('[Agent Guard] Failed to copy coupling summary to clipboard')
    );
  });

  context.subscriptions.push(saveListener, diagnosticCollection);
  return vscode.Disposable.from(saveListener, diagnosticCollection);
}

/**
 * Build a coupling summary from .simplebeacon/codemap-analysis.json for the
 * files edited during an AI session.
 *
 * Reads the codemap issues (High Coupling, Bidirectional Dependencies, Circular
 * Dependencies) and checks if any edited file appears in those issue lists.
 * If so, produces a warning with the coupled file names so the agent knows
 * what else it needs to check.
 *
 * This is a pure function — no vscode dependency — so it's unit-testable.
 */
export function buildCouplingSummary(editedFiles: string[], workspaceRoot: string): string | null {
  const codemapPath = path.join(workspaceRoot, '.simplebeacon', 'codemap-analysis.json');
  if (!fs.existsSync(codemapPath)) return null;

  let codemap: { issues?: Array<{ title?: string; severity?: string; files?: string[]; description?: string }> };
  try {
    codemap = JSON.parse(fs.readFileSync(codemapPath, 'utf8'));
  } catch {
    return null;
  }

  const issues = codemap.issues;
  if (!issues || !Array.isArray(issues)) return null;

  // Match edited files against codemap issue file lists by basename
  const editedBasenames = editedFiles.map((f) => path.basename(f));
  const warnings: string[] = [];

  for (const issue of issues) {
    if (!issue.files || !Array.isArray(issue.files)) continue;

    // Find which edited files appear in this issue's file list
    const matchedFiles = issue.files.filter((f) => editedBasenames.some((b) => f.includes(b)));
    if (matchedFiles.length === 0) continue;

    // Find coupled files (files in the same issue that were NOT edited)
    const coupledFiles = issue.files.filter((f) => !editedBasenames.some((b) => f.includes(b)));

    warnings.push(`[${issue.severity?.toUpperCase() || 'WARN'}] ${issue.title || 'Coupling Issue'}`);
    warnings.push(`  Edited files affected: ${matchedFiles.join(', ')}`);
    if (coupledFiles.length > 0) {
      const shown = coupledFiles.slice(0, 8);
      const extra = coupledFiles.length > 8 ? ` (+${coupledFiles.length - 8} more)` : '';
      warnings.push(`  Coupled files to check: ${shown.join(', ')}${extra}`);
    }
    if (issue.description) {
      warnings.push(`  ${issue.description}`);
    }
    warnings.push('');
  }

  if (warnings.length === 0) return null;

  return [
    '=== SimpleBeacon Agent Coupling Summary ===',
    `AI session edited ${editedFiles.length} file(s).`,
    'The following coupling issues were detected in the codemap:',
    '',
    ...warnings,
    'Before committing, verify that coupled files still pass tests.',
    'Run: node -c <changed-file> && npm test --workspace=ai-platform',
    '=== End Coupling Summary ===',
  ].join('\n');
}

// ─── Helpers ───

function walkDir(
  dir: string,
  callback: (filePath: string) => void,
  maxDepth: number = 5,
  currentDepth: number = 0
): void {
  if (currentDepth >= maxDepth) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (
      entry.name.startsWith('.') ||
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'build'
    ) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback, maxDepth, currentDepth + 1);
    } else if (entry.isFile()) {
      callback(fullPath);
    }
  }
}
