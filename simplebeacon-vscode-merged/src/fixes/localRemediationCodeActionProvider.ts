import * as vscode from 'vscode';
import { stripMarkdownFenceBlock } from './localRemediationText';

function isTargetDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  const code = String(diagnostic.code || '');
  return code === 'RULE_AI_045' || code === 'RULE_SEC_020' || diagnostic.source === 'SimpleBeacon AI Slop Cop';
}

export class LocalRemediationCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics.filter(isTargetDiagnostic)) {
      const diagnosticCode = String(diagnostic.code || '');
      const snippet = document.getText(diagnostic.range);

      if (diagnosticCode === 'RULE_AI_045') {
        const stripped = stripMarkdownFenceBlock(snippet);
        if (stripped && stripped !== snippet) {
          const quickFix = new vscode.CodeAction('Remove markdown fence block', vscode.CodeActionKind.QuickFix);
          quickFix.diagnostics = [diagnostic];
          quickFix.isPreferred = true;
          quickFix.edit = new vscode.WorkspaceEdit();
          quickFix.edit.replace(document.uri, diagnostic.range, stripped);
          actions.push(quickFix);
        }
      }

      // In-place Ollama fix — applies the generated fix directly to the editor buffer
      const inPlaceAction = new vscode.CodeAction(
        'Fix with local Ollama (in-place)',
        vscode.CodeActionKind.QuickFix
      );
      inPlaceAction.diagnostics = [diagnostic];
      inPlaceAction.command = {
        title: 'Fix with local Ollama (in-place)',
        command: 'simplebeacon.remediateDiagnosticInPlace',
        arguments: [document.uri, diagnostic.range, diagnosticCode, diagnostic.message, snippet],
      };
      actions.push(inPlaceAction);

      // Legacy Ollama action — sends to Ollama and shows response in output channel
      const ollamaAction = new vscode.CodeAction(
        'Send finding to local Ollama (view response)',
        vscode.CodeActionKind.QuickFix
      );
      ollamaAction.diagnostics = [diagnostic];
      ollamaAction.command = {
        title: 'Send finding to local Ollama (view response)',
        command: 'simplebeacon.remediateDiagnostic',
        arguments: [document.uri, diagnostic.range, diagnosticCode, diagnostic.message, snippet],
      };
      actions.push(ollamaAction);

      const guideAction = new vscode.CodeAction('Open SimpleBeacon remediation guide', vscode.CodeActionKind.QuickFix);
      guideAction.diagnostics = [diagnostic];
      guideAction.command = {
        title: 'Open SimpleBeacon remediation guide',
        command: 'simplebeacon.showRemediationGuide',
      };
      actions.push(guideAction);
    }

    return actions;
  }
}
