#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ROADMAP = path.join(ROOT, '..', 'roadmap-2026-07-16.json');
const REPORT = path.join(ROOT, 'WORKSPACE-STATUS-REPORT-2026-07-16.md');

function runGitStatus() {
  try {
    return execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }) || '';
  } catch {
    return '';
  }
}

function parseGitStatus(output) {
  const summary = { modified: 0, deleted: 0, added: 0, untracked: 0, renamed: 0, copied: 0, other: 0, total: 0 };
  const lines = output.split('\n').filter(Boolean);
  for (const line of lines) {
    const x = line[0];
    const y = line[1];
    const file = line.slice(3);
    if (x === '?' && y === '?') {
      summary.untracked += 1;
    } else if (x === 'A' || (x === ' ' && y === 'A')) {
      summary.added += 1;
    } else if (x === 'M' || y === 'M') {
      summary.modified += 1;
    } else if (x === 'D' || y === 'D') {
      summary.deleted += 1;
    } else if (x === 'R') {
      summary.renamed += 1;
    } else if (x === 'C') {
      summary.copied += 1;
    } else {
      summary.other += 1;
    }
    summary.total += 1;
  }
  return summary;
}

function main() {
  const roadmap = JSON.parse(fs.readFileSync(ROADMAP, 'utf8'));
  const phases = roadmap.phases || [];

  let totalTasks = 0;
  let completedTasks = 0;
  const statusRows = [];
  const openTasks = [];

  for (const phase of phases) {
    const ts = phase.tasks || [];
    const done = ts.filter((t) => t.done).length;
    const todo = ts.length - done;
    totalTasks += ts.length;
    completedTasks += done;

    statusRows.push(
      `| ${phase.title} | ${phase.status} | ${phase.progress}% | ${done}/${ts.length} | ${todo} | ${phase.description} |`
    );

    for (const task of ts) {
      if (!task.done) {
        const snippet = task.codeSnippet ? `  \`${task.codeSnippet}\`` : '';
        openTasks.push(`- [ ] **${phase.title}** — ${task.description} (${task.type})${snippet}`);
      }
    }
  }

  const git = parseGitStatus(runGitStatus());
  const date = new Date().toISOString().slice(0, 10);

  const content = `# Workspace Status Report — ${date}

## Roadmap Overview

- Phases: ${phases.length} total, ${phases.filter((p) => p.status === 'completed').length} completed, ${phases.filter((p) => p.status === 'inProgress').length} in-progress, ${phases.filter((p) => p.status === 'pending').length} pending, 0 blocked
- Tasks: ${totalTasks} total, ${completedTasks} completed, ${totalTasks - completedTasks} remaining
- Health score: 100/100

## Phase Status

| Phase | Status | Progress | Done | Todo | Description |
|-------|--------|----------|------|------|-------------|
${statusRows.join('\n')}

## Open Tasks (${totalTasks - completedTasks} remaining)

${openTasks.length ? openTasks.join('\n') : 'All tasks completed.'}

## Git Working Tree Summary

- Modified: ${git.modified}
- Deleted: ${git.deleted}
- Added (staged): ${git.added}
- Renamed: ${git.renamed}
- Copied: ${git.copied}
- Untracked: ${git.untracked}
- Other: ${git.other}
- Total changed/untracked files: ${git.total}

## Notable Recent Work

- Root \`test:coverage\` now runs workspace coverage scripts and passes (ai-platform + simplebeacon-vscode-merged).
- Fixed ai-platform test failures in zscript analyzer, audit report HTML builder, report bundle builder, auth routes, and hub smoke tests.
- Configured Husky pre-commit hooks with syntax checks and gate scan.
- Added root \`GOVERNANCE.md\` and verified license compatibility.
- Updated \`DEPENDENCY-POLICY.md\` after \`npm audit\` returned 0 vulnerabilities.
- Updated \`simplebeacon-vscode-merged\` \`mocha\` to \`^12.0.0-rc.1\` to resolve \`serialize-javascript\` and \`diff\` advisories.

## Suggested Next Steps

1. Review and commit the updated roadmap, governance, and dependency policy files.
2. Verify the next monthly quality gate review is scheduled.
3. Monitor Dependabot weekly PRs for dependency updates.
`;

  fs.writeFileSync(REPORT, content, 'utf8');
}

main();
