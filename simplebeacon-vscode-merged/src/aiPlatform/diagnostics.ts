import * as vscode from 'vscode';
import { ScanIssue } from './simplebeaconProvider';

/**
 * Manages VS Code diagnostics collection for SimpleBeacon scan issues.
 */
export class DiagnosticsManager {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('simplebeacon');
  }

  updateDiagnostics(issues: ScanIssue[]): void {
    this.clear();

    const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

    for (const issue of issues) {
      if (!issue.filePath) continue;

      const filePath = issue.filePath;
      const line = Math.max(0, (issue.line || 1) - 1);
      const column = Math.max(0, (issue.column || 1) - 1);

      const range = new vscode.Range(line, column, line, column + 1);

      const severityMap: Record<string, vscode.DiagnosticSeverity> = {
        critical: vscode.DiagnosticSeverity.Error,
        high: vscode.DiagnosticSeverity.Error,
        medium: vscode.DiagnosticSeverity.Hint,
        low: vscode.DiagnosticSeverity.Hint,
        info: vscode.DiagnosticSeverity.Hint,
      };

      const diagnostic = new vscode.Diagnostic(
        range,
        `[${issue.type}] ${issue.description}`,
        severityMap[issue.severity] || vscode.DiagnosticSeverity.Information
      );
      diagnostic.code = issue.id;
      diagnostic.source = 'SimpleBeacon';
      if (diagnostic.severity !== vscode.DiagnosticSeverity.Error) {
        diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
      }

      if (!diagnosticsByFile.has(filePath)) {
        diagnosticsByFile.set(filePath, []);
      }
      diagnosticsByFile.get(filePath)!.push(diagnostic);
    }

    for (const [filePath, diagnostics] of diagnosticsByFile) {
      const uri = vscode.Uri.file(filePath);
      this.diagnosticCollection.set(uri, diagnostics);
    }
  }

  clear(): void {
    this.diagnosticCollection.clear();
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
