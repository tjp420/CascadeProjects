'use strict';
// Example VS Code extension activation that installs the SimpleBeacon plugin
// and exposes a command to run a quick gate scan on the current workspace.

const path = require('path');

/**
 * This is a minimal example of what an extension's `activate(context)` might look like.
 * It requires the adapter shipped in this repo and installs the plugin into the
 * provided VS Code extension `context`.
 *
 * In a real extension, copy this logic into your extension's activate() and
 * adjust command names, permissions, and UI handlers accordingly.
 */

module.exports = {
  activate: function activate(context, vscode) {
    // Resolve adapter relative to the repo workspace; adapt the path if your extension
    // is not colocated with this repo.
    const adapterPath = path.resolve(__dirname, '..', '..', 'plugins', 'vscode-agent-integration.cjs');
    const pluginPath = path.resolve(__dirname, '..', '..', 'plugins', 'simplebeacon-plugin.cjs');

    let adapter;
    try {
      adapter = require(adapterPath);
    } catch (err) {
      console.error('Example activate: failed to load adapter', err.message);
      return;
    }

    try {
      const { handlers, registeredCommands } = adapter.install(context, vscode, { pluginPath });
      console.log('SimpleBeacon plugin installed. Registered commands:', registeredCommands);

      // Example: add a convenience command that runs a quick scan on the current workspace
      const cmdId = 'simplebeacon.runQuickScan';
      const disposable = vscode.commands.registerCommand(cmdId, async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const projectPath = workspaceFolders.length ? workspaceFolders[0].uri.fsPath : process.cwd();
        try {
          const res = await handlers.scanProject({ projectPath, full: false });
          // Show a quick notification with the gate result
          const ok = res && res.success && res.json && res.json.gate && res.json.gate.pass;
          vscode.window.showInformationMessage(ok ? 'SimpleBeacon: Gate PASSED' : 'SimpleBeacon: Gate reported findings — see Output');
          // Dump details to the output channel
          const out = vscode.window.createOutputChannel('SimpleBeacon');
          out.show(true);
          out.appendLine(JSON.stringify(res.json || res, null, 2));
        } catch (err) {
          vscode.window.showErrorMessage('SimpleBeacon scan failed: ' + err.message);
        }
      });
      context.subscriptions.push(disposable);

    } catch (err) {
      console.error('Example activate: failed to install plugin into VS Code adapter', err.message);
    }
  },
};
