let vscode;
try {
  vscode = require('vscode');
} catch (e) {
  vscode = null;
}

const { buildWorkspaceVerificationPayload } = require('./ai-context');

function jsonResult(payload) {
  const text = JSON.stringify(payload);
  if (vscode && vscode.lm && vscode.lm.LanguageModelTextPart && vscode.lm.LanguageModelToolResult) {
    return new vscode.lm.LanguageModelToolResult([
      new vscode.lm.LanguageModelTextPart(text),
    ]);
  }
  return [{ text }];
}

class SimpleBeaconWorkspaceTool {
  async invoke(options, token) {
    const input = (options && options.input) || {};
    const editor = vscode && vscode.window ? vscode.window.activeTextEditor : null;
    let document = editor ? editor.document : null;

    if (input.requestedFile && vscode && vscode.workspace && typeof vscode.workspace.openTextDocument === 'function') {
      try {
        document = await vscode.workspace.openTextDocument(input.requestedFile);
      } catch (e) {
        return jsonResult(buildWorkspaceVerificationPayload(null, input));
      }
    }

    if (!document) {
      return jsonResult(buildWorkspaceVerificationPayload(null, input));
    }

    return jsonResult(buildWorkspaceVerificationPayload(document, input));
  }

  async prepareInvocation(options, token) {
    return { invocationMessage: 'SimpleBeacon is verifying workspace files and symbols' };
  }
}

function registerSimpleBeaconTool(context) {
  if (!vscode || !vscode.lm || typeof vscode.lm.registerTool !== 'function') {
    console.log('[SimpleBeacon] vscode.lm.registerTool unavailable — simplebeacon_workspace_context not registered');
    return;
  }
  try {
    const tool = new SimpleBeaconWorkspaceTool();
    context.subscriptions.push(vscode.lm.registerTool('simplebeacon_workspace_context', tool));
    console.log('[SimpleBeacon] simplebeacon_workspace_context registered');
  } catch (e) {
    console.error('SimpleBeacon: LM tool registration failed', e && e.message);
  }
}

module.exports = { registerSimpleBeaconTool };
