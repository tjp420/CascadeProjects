import * as vscode from 'vscode';

/**
 * Quick-fix provider that adds a `// slop-cop-disable-next-line` comment
 * above diagnostics emitted by the SimpleBeacon AI Slop Cop realtime monitor.
 */
export class SlopCopQuickFixProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    const slopDiagnostics = context.diagnostics.filter(
      (diagnostic) => diagnostic.source === 'SimpleBeacon AI Slop Cop' || diagnostic.code === 'simplebeacon-ai-slop'
    );

    for (const diagnostic of slopDiagnostics) {
      const action = new vscode.CodeAction(
        'Ignore this finding with // slop-cop-disable-next-line',
        vscode.CodeActionKind.QuickFix
      );

      const targetLine = diagnostic.range.start.line;
      const indent = document.lineAt(targetLine).text.match(/^\s*/)?.[0] || '';

      const edit = new vscode.WorkspaceEdit();
      edit.insert(document.uri, new vscode.Position(targetLine, 0), `${indent}// slop-cop-disable-next-line\n`);

      action.edit = edit;
      action.diagnostics = [diagnostic];
      action.isPreferred = true;

      actions.push(action);

      const jumpAction = new vscode.CodeAction('Jump to this finding', vscode.CodeActionKind.QuickFix);
      jumpAction.command = {
        title: 'Jump to this finding',
        command: 'simplebeacon.jumpToFinding',
        arguments: [document.uri, diagnostic.range.start.line, diagnostic.range.start.character],
      };
      jumpAction.diagnostics = [diagnostic];
      actions.push(jumpAction);

      const reportAction = new vscode.CodeAction('Open SimpleBeacon remediation panel', vscode.CodeActionKind.QuickFix);
      reportAction.command = {
        title: 'Open SimpleBeacon remediation panel',
        command: 'simplebeacon.showReport',
      };
      reportAction.diagnostics = [diagnostic];
      actions.push(reportAction);
    }

    return actions;
  }
}
