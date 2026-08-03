import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { resolveCliSpawnEnv } from '../utils/cliEnv';

export type CliResolver = () => { cmd: string; args: string[] } | null;

const SAVE_SUPPORTED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.json', '.cjs', '.mjs']);

interface FixPlanRow {
  severity?: string;
  location?: string;
  kind?: string;
  recipe?: string;
  blocksGate?: boolean;
  estimatedMinutes?: number;
  businessImpact?: string;
  fixSpec?: { blocksGate?: boolean };
}

interface FixPlanPayload {
  reportSource?: string;
  verify?: string;
  fixCount?: number;
  gatePass?: boolean | null;
  summary?: {
    gateBlockingCount?: number;
    hygieneCount?: number;
    estimatedTotalMinutes?: number;
  };
  fixes?: FixPlanRow[];
}

export class SimpleBeaconFixEngine {
  constructor(
    private readonly outputChannel: vscode.OutputChannel,
    private readonly resolveCli: CliResolver
  ) {}

  async executeFixWorkflow(isDryRun: boolean, targetFile?: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('SimpleBeacon: No active workspace found.');
      return;
    }

    const rootPath = workspaceFolder.uri.fsPath;
    const reportPath = path.join(rootPath, '.simplebeacon', 'report.json');

    if (!isDryRun) {
      const confirm = await vscode.window.showWarningMessage(
        'SimpleBeacon will apply remediation recipes to your workspace. Continue?',
        'Apply Fixes',
        'Cancel'
      );
      if (confirm !== 'Apply Fixes') {
        return;
      }
    } else if (!targetFile && !fs.existsSync(reportPath)) {
      const choice = await vscode.window.showWarningMessage(
        'No scan report found. Run a scan first, or run a live fix dry-run (slower)?',
        'Scan Now',
        'Run Live Dry-Run',
        'Cancel'
      );
      if (choice === 'Scan Now') {
        await vscode.commands.executeCommand('simplebeacon.scanWorkspace');
        return;
      }
      if (choice !== 'Run Live Dry-Run') {
        return;
      }
    }

    const title = isDryRun ? 'SimpleBeacon: Analyzing fixes (dry run)…' : 'SimpleBeacon: Applying fixes…';
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title, cancellable: false },
      async () => {
        if (isDryRun && !targetFile && fs.existsSync(reportPath)) {
          await this.runStructuredFixDryRun(rootPath, reportPath);
          return;
        }
        await this.runCliFix(rootPath, isDryRun, targetFile);
      }
    );
  }

  private resolveFixDryRunModule(cli: { cmd: string; args: string[] }): string | null {
    if (cli.cmd === 'node' && cli.args[0]) {
      const candidate = path.join(path.dirname(cli.args[0]), '..', 'src', 'fix-dry-run.js');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      const monorepoCandidate = path.join(workspaceRoot, 'packages', 'simplebeacon-cli', 'src', 'fix-dry-run.js');
      if (fs.existsSync(monorepoCandidate)) {
        return monorepoCandidate;
      }
    }
    return null;
  }

  private spawnCollect(
    cmd: string,
    args: string[],
    cwd: string
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      const useShell = process.platform === 'win32' && (cmd.endsWith('.cmd') || cmd.endsWith('.bat'));
      const child = spawn(cmd, args, {
        cwd,
        shell: useShell,
        env: resolveCliSpawnEnv(),
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    });
  }

  private async runStructuredFixDryRun(rootPath: string, reportPath: string): Promise<void> {
    const cli = this.resolveCli();
    if (!cli) {
      vscode.window.showErrorMessage('SimpleBeacon CLI not found. Install with: npm install -g simplebeacon-cli');
      return;
    }

    const modulePath = this.resolveFixDryRunModule(cli);
    if (!modulePath) {
      this.outputChannel.appendLine('[SimpleBeacon] Structured fix-dry-run module not found; falling back to CLI fix.');
      await this.runCliFix(rootPath, true);
      return;
    }

    const relReport = path.relative(rootPath, reportPath).replace(/\\/g, '/');
    const script = [
      `const m = require(${JSON.stringify(modulePath)});`,
      `const plan = m.runFixDryRun({ path: ${JSON.stringify(rootPath)}, reportPath: ${JSON.stringify(relReport)} });`,
      'process.stdout.write(JSON.stringify(plan));',
    ].join(' ');

    this.outputChannel.appendLine(`[INFO] [${new Date().toLocaleTimeString()}] Structured dry-run from ${relReport}`);

    try {
      const { stdout, stderr, code } = await this.spawnCollect('node', ['-e', script], rootPath);
      if (stderr.trim()) {
        this.outputChannel.appendLine(stderr.trim());
      }
      if (code !== 0 && !stdout.trim()) {
        throw new Error(stderr.trim() || `Structured dry-run exited with code ${code}`);
      }

      let plan: FixPlanPayload;
      try {
        plan = JSON.parse(stdout) as FixPlanPayload;
      } catch {
        this.outputChannel.appendLine(stdout || '(no output)');
        vscode.window.showInformationMessage('SimpleBeacon: Dry-run complete (see output channel).');
        return;
      }

      this.renderFixPlan(plan, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[ERROR] Structured dry-run failed: ${msg}`);
      vscode.window.showErrorMessage(`SimpleBeacon: Dry-run fix plan failed — ${msg}`);
    }
  }

  private async runCliFix(rootPath: string, isDryRun: boolean, targetFile?: string): Promise<void> {
    const cli = this.resolveCli();
    if (!cli) {
      vscode.window.showErrorMessage('SimpleBeacon CLI not found. Install with: npm install -g simplebeacon-cli');
      return;
    }

    const targetPath = targetFile ? path.relative(rootPath, targetFile).replace(/\\/g, '/') : '.';

    const args = [...cli.args, 'fix', targetPath, '--offline', '--quiet'];
    if (isDryRun) {
      args.push('--fix-dry-run');
    }

    this.outputChannel.appendLine(
      `[INFO] [${new Date().toLocaleTimeString()}] Executing: ${cli.cmd} ${args.join(' ')}`
    );
    if (isDryRun) {
      this.outputChannel.appendLine(`[INFO] Analyzing remediation recipes for ${targetPath}…`);
    }

    try {
      const { stdout, stderr, code } = await this.spawnCollect(cli.cmd, args, rootPath);
      const combined = [stdout, stderr].filter(Boolean).join('\n').trim();

      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(`--- ${isDryRun ? 'DRY RUN FIX PLAN' : 'APPLIED CHANGES'} ---`);
      this.outputChannel.appendLine(combined || 'No compliance issues detected requiring modifications.');
      this.outputChannel.appendLine('--------------------------------------------------');

      if (code !== 0 && !combined) {
        throw new Error(`Fix command exited with code ${code}`);
      }

      if (isDryRun) {
        this.outputChannel.show(true);
        vscode.window.showInformationMessage('SimpleBeacon: Dry run complete. Fix plan available in Output panel.');
      } else {
        vscode.window.showInformationMessage('SimpleBeacon: Applied remediation recipes successfully.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[ERROR] Execution failed: ${msg}`);
      vscode.window.showErrorMessage('SimpleBeacon: Fix action failed. Check output console.');
    }
  }

  private renderFixPlan(plan: FixPlanPayload, isDryRun: boolean): void {
    const fixes = Array.isArray(plan.fixes) ? plan.fixes : [];
    const blocking = fixes.filter(
      (row) => row.severity === 'critical' || row.severity === 'high' || row.blocksGate || row.fixSpec?.blocksGate
    ).length;

    this.outputChannel.appendLine('');
    this.outputChannel.appendLine('═══════════════════════════════════════════════════');
    this.outputChannel.appendLine(`  SimpleBeacon ${isDryRun ? 'Dry-Run Fix Plan' : 'Fix Plan'}`);
    this.outputChannel.appendLine(`  Total fixes: ${plan.fixCount ?? fixes.length}`);
    this.outputChannel.appendLine(`  Blocking (critical/high): ${blocking}`);
    this.outputChannel.appendLine(`  Report source: ${plan.reportSource || '.simplebeacon/report.json'}`);
    if (plan.verify) {
      this.outputChannel.appendLine(`  Verify command: ${plan.verify}`);
    }
    this.outputChannel.appendLine('═══════════════════════════════════════════════════');
    this.outputChannel.appendLine('');

    for (const row of fixes) {
      const sev = row.severity || 'unknown';
      const location = row.location || '(no location)';
      const recipeLine = row.recipe ? row.recipe.split('\n')[0] : row.kind || '(no action)';
      this.outputChannel.appendLine(`  [${sev.toUpperCase()}] ${location}`);
      this.outputChannel.appendLine(`    Action: ${recipeLine}`);
      if (row.estimatedMinutes) {
        this.outputChannel.appendLine(`    Est:    ~${row.estimatedMinutes} min`);
      }
      this.outputChannel.appendLine('');
    }

    this.outputChannel.show(true);

    if (fixes.length === 0) {
      vscode.window.showInformationMessage('SimpleBeacon: Dry-run fix plan complete — no issues found.');
    } else {
      vscode.window.showInformationMessage(
        `SimpleBeacon: Dry-run fix plan — ${fixes.length} fix(es) (${blocking} blocking). See output channel.`
      );
    }
  }

  shouldRunOnSave(document: vscode.TextDocument): boolean {
    if (document.uri.scheme !== 'file') {
      return false;
    }
    return SAVE_SUPPORTED_EXTENSIONS.has(path.extname(document.fileName).toLowerCase());
  }
}
