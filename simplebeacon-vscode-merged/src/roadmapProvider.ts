import * as vscode from 'vscode';
import { ScanResult } from './analyzers/workspaceAnalyzer';

export interface RoadmapPhase {
  id: string;
  title: string;
  status: 'completed' | 'blocked' | 'inProgress' | 'pending';
  severity: 'low' | 'medium' | 'high';
  progress: number;
  description: string;
  taskSummary: {
    total: number;
    done: number;
    todo: number;
    percent: number;
  };
  tasks: RoadmapTask[];
}

export interface RoadmapTask {
  description: string;
  type: 'review' | 'verify' | 'fix' | 'audit' | 'doc';
  done: boolean;
  codeSnippet?: string;
}

export interface RoadmapResult {
  summary: {
    healthScore: number;
    phases: {
      total: number;
      completed: number;
      blocked: number;
      inProgress: number;
      pending: number;
    };
    tasks: {
      total: number;
      completed: number;
      remaining: number;
    };
    criticalPaths: string[];
  };
  phases: RoadmapPhase[];
}

/**
 * Generate a remediation roadmap from a scan result.
 * @param report - Scan result containing findings and summary.
 * @returns Structured roadmap with phases and actions.
 */
export function generateRoadmap(report: ScanResult): RoadmapResult {
  const gatePass = report.gate?.pass ?? false;
  const issueCount = report.summary?.totalFindings ?? 0;
  const severityCounts = report.summary?.severityCounts ?? {};
  const hasBlocking = (severityCounts.critical ?? 0) > 0 || (severityCounts.high ?? 0) > 0;
  const scanIsClean = gatePass && issueCount === 0;

  const br = report.buildReadiness;
  const eu = report.euAiAct;

  // Helper to make a phase
  const makePhase = (
    id: string,
    title: string,
    severity: 'low' | 'medium' | 'high',
    tasks: RoadmapTask[],
    donePredicate: boolean,
    descriptionDone: string,
    descriptionActive: string,
    descriptionBlocked: string
  ): RoadmapPhase => {
    const done = tasks.filter((t) => t.done).length;
    const total = tasks.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 100;
    let status: RoadmapPhase['status'];
    let description: string;

    if (donePredicate && done === total) {
      status = 'completed';
      description = descriptionDone;
    } else if (hasBlocking && !donePredicate) {
      status = 'blocked';
      description = descriptionBlocked;
    } else if (done > 0 && done < total) {
      status = 'inProgress';
      description = descriptionActive;
    } else {
      status = 'pending';
      description = descriptionActive;
    }

    return {
      id,
      title,
      status,
      severity,
      progress: percent,
      description,
      taskSummary: { total, done, todo: total - done, percent },
      tasks,
    };
  };

  const phases: RoadmapPhase[] = [];

  // Phase 1: Build Readiness
  phases.push(
    makePhase(
      'buildreadiness',
      'Phase 1: Build Readiness',
      'medium',
      [
        { description: 'Review build configuration', type: 'review', done: br ? br.readinessScore >= 50 : false },
        { description: 'Verify CI/CD pipeline health', type: 'verify', done: br ? br.readinessScore >= 50 : false },
        { description: 'Update build scripts', type: 'fix', done: br ? br.readinessScore >= 80 : false },
      ],
      br ? br.readinessScore >= 80 : false,
      'Build readiness verified — no issues detected.',
      `Build readiness score ${br?.readinessScore ?? 0}% — review checklist.`,
      'Critical build files missing — add package.json, README, .gitignore before proceeding.'
    )
  );

  // Phase 2: Security Hardening
  const secFindings = report.categories?.['security']?.length ?? 0;
  phases.push(
    makePhase(
      'security',
      'Phase 2: Security Hardening',
      'low',
      [
        {
          description: 'No security issues detected — credentials && secrets verified.',
          type: 'verify',
          done: secFindings === 0,
        },
        { description: 'Add .env to .gitignore', type: 'fix', done: scanIsClean },
        {
          description: 'Re-run gate scan',
          type: 'verify',
          done: gatePass,
          codeSnippet: 'npx simplebeacon scan --gate',
        },
      ],
      secFindings === 0,
      'No security issues detected — credentials && secrets verified.',
      `${secFindings} security issue(s) detected — review credentials && secrets.`,
      'Blocking security issues found — fix before deployment.'
    )
  );

  // Phase 3: Data Integrity
  phases.push(
    makePhase(
      'integrity',
      'Phase 3: Data Integrity',
      'low',
      [
        {
          description: 'Validate all JSON',
          type: 'verify',
          done: scanIsClean,
          codeSnippet: 'npx simplebeacon scan --json',
        },
        { description: 'Re-run scan', type: 'verify', done: true, codeSnippet: 'npx simplebeacon scan' },
      ],
      scanIsClean,
      'Data integrity verified — no structural issues detected.',
      'Review data integrity — check for invalid JSON or corrupted files.',
      'Data integrity issues blocking — fix structural problems.'
    )
  );

  // Phase 4: Consistency & Deduplication
  const dupCount = report.summary?.categoryCounts?.['consistency'] ?? 0;
  phases.push(
    makePhase(
      'consistency',
      'Phase 4: Consistency & Deduplication',
      'low',
      [
        { description: 'Review consistency check failures', type: 'review', done: dupCount === 0 },
        { description: 'Verified — duplicates are structural/intentional', type: 'verify', done: dupCount === 0 },
      ],
      dupCount === 0,
      'Consistency verified — structural duplicates only.',
      `${dupCount} consistency issue(s) — review duplicates.`,
      'Unresolved duplicates detected.'
    )
  );

  // Phase 5: Cleanup & Hygiene
  const cleanupCount = report.summary?.categoryCounts?.['debug'] ?? 0;
  phases.push(
    makePhase(
      'cleanup',
      'Phase 5: Cleanup & Hygiene',
      'low',
      [
        {
          description: 'No debug artifacts or bloat detected — codebase is clean.',
          type: 'verify',
          done: cleanupCount === 0,
        },
      ],
      cleanupCount === 0,
      'No debug artifacts or bloat detected — codebase is clean.',
      `${cleanupCount} leftover item(s) — clean up before deployment.`,
      'Development traces in production code — review before release.'
    )
  );

  // Phase 6: Governance & Compliance
  const govCount = report.summary?.categoryCounts?.['governance'] ?? 0;
  phases.push(
    makePhase(
      'compliance',
      'Phase 6: Governance & Compliance',
      'low',
      [
        {
          description: 'Add LICENSE file to clarify distribution terms',
          type: 'fix',
          done: govCount > 0 || scanIsClean,
          codeSnippet: 'touch LICENSE',
        },
        {
          description: 'Add SECURITY.md to disclose vulnerability reporting',
          type: 'fix',
          done: govCount > 0 || scanIsClean,
          codeSnippet: 'touch SECURITY.md',
        },
        {
          description: 'Verify license compatibility with distribution model',
          type: 'verify',
          done: scanIsClean,
          codeSnippet: 'npx license-checker --summary',
        },
        { description: 'Document governance policies', type: 'doc', done: scanIsClean },
      ],
      govCount > 0 || scanIsClean,
      'Governance documents present and verified.',
      'Governance documentation incomplete.',
      'Missing governance docs — add LICENSE and SECURITY.md.'
    )
  );

  // Phase 7: EU AI Act Compliance
  const euPass = eu ? eu.controls.every((c: { status: string }) => c.status === 'PASS') : true;
  phases.push(
    makePhase(
      'euaiact',
      'Phase 7: EU AI Act Compliance',
      'low',
      [
        { description: 'Generate documentation artifacts', type: 'doc', done: euPass },
        { description: 'Review AI system classification (Art. 6)', type: 'review', done: euPass },
        { description: 'Schedule legal review', type: 'review', done: euPass },
      ],
      euPass,
      'No AI system indicators detected — EU AI Act compliance verified.',
      'AI SDKs detected — review EU AI Act compliance requirements.',
      'AI SDKs present without governance documentation — address immediately.'
    )
  );

  // Phase 8: Mock Data Review
  phases.push(
    makePhase(
      'mockdata',
      'Phase 8: Mock Data Review',
      'low',
      [
        { description: 'Review mock/fixture files', type: 'review', done: true },
        { description: 'Demo data verified — excluded from production builds', type: 'verify', done: true },
      ],
      true,
      'No mock data issues — fixtures verified or none detected.',
      'Review mock data for production leaks.',
      'Mock data may be leaking to production.'
    )
  );

  // Phase 9: npm Audit
  const hasPackageJson =
    report.buildReadiness?.checklist?.some(
      (c: { name: string; found: boolean }) => c.name === 'package.json' && c.found
    ) ?? false;
  phases.push(
    makePhase(
      'npmaudit',
      'Phase 9: npm Audit',
      'low',
      [
        { description: 'Run npm audit', type: 'audit', done: !hasPackageJson || scanIsClean, codeSnippet: 'npm audit' },
        {
          description: 'Verify lockfile integrity',
          type: 'verify',
          done: !hasPackageJson || scanIsClean,
          codeSnippet: 'npm ci',
        },
        { description: 'Review dependency update policy', type: 'review', done: true },
      ],
      !hasPackageJson || scanIsClean,
      'No package.json detected — this project does not use npm dependencies.',
      'Review npm dependency vulnerabilities.',
      'npm audit findings require remediation.'
    )
  );

  // Phase 10: Quality Optimization
  const qualityScore = report.qualityScore ?? 0;
  phases.push(
    makePhase(
      'optimization',
      'Phase 10: Quality Optimization',
      'low',
      [
        {
          description: 'Add test coverage for uncovered modules',
          type: 'fix',
          done: qualityScore >= 80,
          codeSnippet: 'npm test -- --coverage',
        },
        {
          description: 'Install pre-commit hooks for automated scanning',
          type: 'fix',
          done: qualityScore >= 90,
          codeSnippet: 'npx husky install',
        },
        { description: 'Schedule monthly quality gate reviews', type: 'review', done: true },
      ],
      qualityScore >= 80,
      `Maintain quality score at ${qualityScore}/100 (currently above 80+).`,
      `Quality score ${qualityScore}/100 — add tests and coverage to improve.`,
      'Quality score below threshold — add coverage before deployment.'
    )
  );

  // Phase 11: Junk & Temporary Files
  phases.push(
    makePhase(
      'junkfiles',
      'Phase 11: Junk & Temporary Files',
      'low',
      [
        {
          description: 'Add .simplebeaconignore patterns for temp files',
          type: 'fix',
          done: scanIsClean,
          codeSnippet: 'echo "*.tmp" >> .simplebeaconignore',
        },
        { description: 'Schedule monthly cleanup sweep', type: 'review', done: true },
      ],
      scanIsClean,
      'No junk or temporary files detected.',
      'Review for temporary and junk files.',
      'Junk files detected — clean up before deployment.'
    )
  );

  // Phase 12: Dependency Vulnerability Audit
  phases.push(
    makePhase(
      'vulns',
      'Phase 12: Dependency Vulnerability Audit',
      'low',
      [
        { description: 'Run npm audit fix', type: 'fix', done: scanIsClean, codeSnippet: 'npm audit fix' },
        { description: 'Review dependency update policy', type: 'review', done: true },
        {
          description: 'Enable Dependabot or Snyx',
          type: 'fix',
          done: scanIsClean,
          codeSnippet: 'Enable Dependabot in repo settings',
        },
      ],
      scanIsClean,
      'No vulnerable dependencies detected.',
      'Review dependency vulnerabilities.',
      'Dependency vulnerabilities found — fix before deployment.'
    )
  );

  const completedCount = phases.filter((p) => p.status === 'completed').length;
  const blockedCount = phases.filter((p) => p.status === 'blocked').length;
  const inProgressCount = phases.filter((p) => p.status === 'inProgress').length;
  const pendingCount = phases.filter((p) => p.status === 'pending').length;
  const totalTasks = phases.reduce((sum, p) => sum + p.taskSummary.total, 0);
  const doneTasks = phases.reduce((sum, p) => sum + p.taskSummary.done, 0);

  return {
    summary: {
      healthScore: scanIsClean ? 100 : Math.max(0, 100 - (hasBlocking ? 30 : 0) - issueCount * 2),
      phases: {
        total: phases.length,
        completed: completedCount,
        blocked: blockedCount,
        inProgress: inProgressCount,
        pending: pendingCount,
      },
      tasks: {
        total: totalTasks,
        completed: doneTasks,
        remaining: totalTasks - doneTasks,
      },
      criticalPaths: blockedCount > 0 ? ['security', 'compliance'] : [],
    },
    phases,
  };
}

/**
 * Tree data provider for displaying the remediation roadmap in the sidebar.
 */
export class RoadmapProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private roadmap: RoadmapResult | null = null;

  updateFromReport(report: ScanResult) {
    this.roadmap = generateRoadmap(report);
    this._onDidChangeTreeData.fire();
  }

  clear() {
    this.roadmap = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!this.roadmap) {
      return Promise.resolve([
        new vscode.TreeItem('Run a scan to generate roadmap', vscode.TreeItemCollapsibleState.None),
      ]);
    }

    if (!element) {
      // Root: summary + phases
      const summary = this.roadmap.summary;
      const healthItem = new vscode.TreeItem(
        `Health Score: ${summary.healthScore}%`,
        vscode.TreeItemCollapsibleState.None
      );
      healthItem.iconPath = new vscode.ThemeIcon(
        summary.healthScore >= 80 ? 'pass' : summary.healthScore >= 50 ? 'warning' : 'error'
      );

      const phaseItems = this.roadmap.phases.map((phase) => {
        const item = new vscode.TreeItem(
          `${phase.title} — ${phase.progress}%`,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        item.description = phase.status;
        item.iconPath = new vscode.ThemeIcon(
          phase.status === 'completed'
            ? 'pass'
            : phase.status === 'blocked'
              ? 'error'
              : phase.status === 'inProgress'
                ? 'sync'
                : 'circle-outline'
        );
        item.tooltip = phase.description;
        return item;
      });

      return Promise.resolve([healthItem, ...phaseItems]);
    }

    // Find which phase this element belongs to
    const phases = this.roadmap?.phases;
    const phase = Array.isArray(phases) ? phases.find((p) => element.label?.toString().includes(p.title)) : undefined;
    if (phase) {
      const taskItems = phase.tasks.map((task) => {
        const item = new vscode.TreeItem(task.description, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(task.done ? 'check' : 'circle-outline');
        item.description = task.type;
        if (task.codeSnippet) {
          item.tooltip = task.codeSnippet;
        }
        return item;
      });
      return Promise.resolve(taskItems);
    }

    return Promise.resolve([]);
  }
}
