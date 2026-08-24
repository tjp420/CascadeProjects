/**
 * Diff scanner — scans only changed files/lines from a git diff.
 *
 * This is the core of diff-based gating (Milestone 3):
 * - IDE mode: scan only the file you're editing
 * - PR mode: scan only changed files in the branch diff
 * - CI mode: full repo scan with baseline (separate)
 *
 * The diff scanner:
 * 1. Gets the git diff (staged, unstaged, or branch-vs-base)
 * 2. Parses which files and lines changed
 * 3. Runs detection only on changed lines
 * 4. Reports only NEW findings (not pre-existing baseline)
 *
 * Milestone 3: AI Agent Workflow Integration
 */

import * as cp from 'child_process';
import * as path from 'path';
import { RealtimeIssue } from '../realtimeIssue';

export interface DiffFile {
  /** File path relative to repo root */
  filePath: string;
  /** Old file path (for renames) */
  oldPath?: string;
  /** Status: added, modified, deleted, renamed */
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Changed line ranges in the new file (1-based, inclusive) */
  changedLines: Array<{ start: number; end: number }>;
  /** Full new content of the file (if available) */
  content?: string;
}

export interface DiffScanResult {
  files: DiffFile[];
  /** Findings on changed lines only */
  newFindings: RealtimeIssue[];
  /** Findings that existed before the diff (baseline) */
  baselineFindings: RealtimeIssue[];
  /** Whether the gate passes */
  gatePassed: boolean;
  /** Blocking findings that prevent finalization */
  blockingFindings: RealtimeIssue[];
  /** Summary for agent consumption */
  summary: DiffScanSummary;
}

export interface DiffScanSummary {
  totalFiles: number;
  totalChanges: number;
  newFindings: number;
  blockingFindings: number;
  bySeverity: { error: number; warning: number; info: number };
  gateStatus: 'pass' | 'fail' | 'review';
  message: string;
}

/**
 * Get the git diff for a workspace.
 *
 * @param workspaceRoot The workspace root directory
 * @param mode 'staged' = staged changes, 'unstaged' = unstaged, 'branch' = branch vs main
 * @param baseBranch The base branch for 'branch' mode (default: 'main')
 * @returns Raw diff output
 */
export function getGitDiff(
  workspaceRoot: string,
  mode: 'staged' | 'unstaged' | 'branch' = 'staged',
  baseBranch: string = 'main'
): string {
  try {
    let cmd: string;
    switch (mode) {
      case 'staged':
        cmd = 'git diff --cached --unified=0';
        break;
      case 'unstaged':
        cmd = 'git diff --unified=0';
        break;
      case 'branch':
        cmd = `git diff ${baseBranch}...HEAD --unified=0`;
        break;
    }

    const result = cp.execSync(cmd, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    return result;
  } catch {
    // git not available or no diff — return empty
    return '';
  }
}

/**
 * Parse a unified diff into structured DiffFile objects.
 *
 * Only handles the `--unified=0` format (no context lines).
 * Each hunk looks like:
 *   @@ -oldStart,oldLen +newStart,newLen @@ optional context
 */
export function parseDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;

  const lines = diffText.split('\n');

  for (const line of lines) {
    // File header: diff --git a/path b/path
    if (line.startsWith('diff --git ')) {
      if (currentFile) files.push(currentFile);
      // Extract paths from "diff --git a/foo.ts b/foo.ts"
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (match) {
        currentFile = {
          filePath: match[2],
          oldPath: match[1] !== match[2] ? match[1] : undefined,
          status: 'modified',
          changedLines: [],
        };
      }
      continue;
    }

    // New file
    if (line.startsWith('new file mode')) {
      if (currentFile) currentFile.status = 'added';
      continue;
    }

    // Deleted file
    if (line.startsWith('deleted file mode')) {
      if (currentFile) currentFile.status = 'deleted';
      continue;
    }

    // Rename
    if (line.startsWith('rename from ') || line.startsWith('rename to ')) {
      if (currentFile) currentFile.status = 'renamed';
      continue;
    }

    // Hunk header: @@ -oldStart,oldLen +newStart,newLen @@
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch && currentFile) {
      const newStart = parseInt(hunkMatch[1], 10);
      const newLen = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
      if (newLen > 0) {
        currentFile.changedLines.push({
          start: newStart,
          end: newStart + newLen - 1,
        });
      }
      continue;
    }
  }

  if (currentFile) files.push(currentFile);

  // Filter out deleted files (no lines to scan)
  return files.filter((f) => f.status !== 'deleted' && f.changedLines.length > 0);
}

/**
 * Check if a line number falls within any of the changed line ranges.
 */
function isChangedLine(line: number, changedLines: Array<{ start: number; end: number }>): boolean {
  return changedLines.some((range) => line >= range.start && line <= range.end);
}

/**
 * Filter findings to only those on changed lines.
 *
 * @param findings All findings from a full file scan
 * @param changedLines The changed line ranges from the diff
 * @returns Only findings on changed lines
 */
export function filterToChangedLines(
  findings: RealtimeIssue[],
  changedLines: Array<{ start: number; end: number }>
): RealtimeIssue[] {
  if (changedLines.length === 0) return [];
  return findings.filter((f) => isChangedLine(f.line, changedLines));
}

/**
 * Generate a summary from scan results.
 */
function generateSummary(
  files: DiffFile[],
  newFindings: RealtimeIssue[],
  blockingFindings: RealtimeIssue[]
): DiffScanSummary {
  const bySeverity = { error: 0, warning: 0, info: 0 };
  for (const f of newFindings) {
    bySeverity[f.severity]++;
  }

  const totalChanges = files.reduce((sum, f) => sum + f.changedLines.reduce((s, r) => s + (r.end - r.start + 1), 0), 0);

  let gateStatus: 'pass' | 'fail' | 'review' = 'pass';
  let message = 'Gate passed — no blocking findings on changed lines';

  if (blockingFindings.length > 0) {
    gateStatus = 'fail';
    message = `Gate FAILED — ${blockingFindings.length} blocking finding(s) on changed lines`;
  } else if (newFindings.length > 0) {
    gateStatus = 'review';
    message = `Gate review — ${newFindings.length} non-blocking finding(s) on changed lines`;
  }

  return {
    totalFiles: files.length,
    totalChanges,
    newFindings: newFindings.length,
    blockingFindings: blockingFindings.length,
    bySeverity,
    gateStatus,
    message,
  };
}

/**
 * Build a DiffScanResult from files, findings, and a blocking severity threshold.
 */
export function buildDiffScanResult(
  files: DiffFile[],
  newFindings: RealtimeIssue[],
  baselineFindings: RealtimeIssue[],
  blockOnSeverity: 'error' | 'warning' | 'info' = 'error'
): DiffScanResult {
  const blockingFindings = newFindings.filter((f) => {
    if (blockOnSeverity === 'error') return f.severity === 'error';
    if (blockOnSeverity === 'warning') return f.severity === 'error' || f.severity === 'warning';
    return true; // block on everything
  });

  const summary = generateSummary(files, newFindings, blockingFindings);

  return {
    files,
    newFindings,
    baselineFindings,
    gatePassed: blockingFindings.length === 0,
    blockingFindings,
    summary,
  };
}

/**
 * Get a human-readable diff scan report for agent consumption.
 */
export function formatDiffScanReport(result: DiffScanResult): string {
  const lines: string[] = [];
  lines.push('═'.repeat(60));
  lines.push('SimpleBeacon Diff Scan Report');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push(`Files changed: ${result.summary.totalFiles}`);
  lines.push(`Lines changed: ${result.summary.totalChanges}`);
  lines.push(`New findings: ${result.summary.newFindings}`);
  lines.push(`Blocking findings: ${result.summary.blockingFindings}`);
  lines.push(`Gate status: ${result.summary.gateStatus.toUpperCase()}`);
  lines.push(`Message: ${result.summary.message}`);
  lines.push('');

  if (result.blockingFindings.length > 0) {
    lines.push('─'.repeat(60));
    lines.push('BLOCKING FINDINGS (must fix before finalizing)');
    lines.push('─'.repeat(60));
    for (const f of result.blockingFindings) {
      lines.push(`  [${f.severity.toUpperCase()}] ${f.type}`);
      lines.push(`    File: ${path.basename(f.file)}:${f.line}`);
      lines.push(`    ${f.message}`);
      if (f.suggestion) lines.push(`    → ${f.suggestion}`);
      lines.push('');
    }
  }

  const nonBlocking = result.newFindings.filter((f) => !result.blockingFindings.includes(f));
  if (nonBlocking.length > 0) {
    lines.push('─'.repeat(60));
    lines.push('NON-BLOCKING FINDINGS (review recommended)');
    lines.push('─'.repeat(60));
    for (const f of nonBlocking) {
      lines.push(`  [${f.severity.toUpperCase()}] ${f.type}`);
      lines.push(`    File: ${path.basename(f.file)}:${f.line}`);
      lines.push(`    ${f.message}`);
      lines.push('');
    }
  }

  lines.push('═'.repeat(60));
  if (result.gatePassed) {
    lines.push('✅ GATE PASSED — safe to finalize the change');
  } else {
    lines.push('❌ GATE FAILED — fix blocking findings before finalizing');
  }
  lines.push('═'.repeat(60));

  return lines.join('\n');
}
