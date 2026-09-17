let vscode;
try {
  vscode = require('vscode');
} catch (e) {
  vscode = null;
}

class SimpleBeaconWorkspaceTool {
  async invoke(options, token) {
    const editor = vscode && vscode.window ? vscode.window.activeTextEditor : null;
    if (!editor) {
      const payload = JSON.stringify({ status: 'error', reason: 'No active editor' });
      return new (vscode && vscode.lm ? vscode.lm.LanguageModelToolResult : Array)([
        new (vscode && vscode.lm ? vscode.lm.LanguageModelTextPart : String)(payload),
      ]);
    }

    const document = editor.document;
    const result = {
      status: 'ok',
      file: document.uri.fsPath,
      language: document.languageId,
      lines: document.lineCount,
      constraints: [
        'preserve_existing_api',
        'no_new_dependencies',
        'avoid_unrelated_files',
      ],
    };

    const payload = JSON.stringify({ simplebeacon: { version: 1 }, result });

    if (vscode && vscode.lm && vscode.lm.LanguageModelTextPart && vscode.lm.LanguageModelToolResult) {
      return new vscode.lm.LanguageModelToolResult([
        new vscode.lm.LanguageModelTextPart(payload),
      ]);
    }

    // Fallback for environments without the lm API
    return [{ text: payload }];
  }

  async prepareInvocation(options, token) {
    return { invocationMessage: 'SimpleBeacon is analyzing workspace context' };
  }
}

function registerSimpleBeaconTool(context) {
  if (!vscode || !vscode.lm || !vscode.lm.registerTool) return;
  try {
    const tool = new SimpleBeaconWorkspaceTool();
    context.subscriptions.push(vscode.lm.registerTool('simplebeacon_workspace_context', tool));
  } catch (e) {
    // don't block activation if registration fails
    console.error('SimpleBeacon: LM tool registration failed', e && e.message);
  }
}

module.exports = { registerSimpleBeaconTool };
