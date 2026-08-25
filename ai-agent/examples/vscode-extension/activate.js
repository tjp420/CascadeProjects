"use strict";
// Example VS Code extension activation that installs the SimpleBeacon plugin
// and exposes commands to run scans and check gate status on the current workspace.
//
// This file serves as the extension entry point (the "main" field in package.json).
// Press F5 in VS Code with this folder open to launch the Extension Development Host.

const path = require("path");

/**
 * Minimal example of what an extension's `activate(context)` looks like.
 * It requires the adapter shipped in this repo and installs the plugin into
 * the provided VS Code extension `context`.
 *
 * In a real extension, copy this logic into your extension's activate() and
 * adjust command names, permissions, and UI handlers accordingly.
 */

// Persistent output channel — created once, reused across scans
let _outputChannel = null;

function getOutputChannel(vscode) {
  if (!_outputChannel) {
    _outputChannel = vscode.window.createOutputChannel("SimpleBeacon");
  }
  return _outputChannel;
}

/**
 * Validate that projectPath is inside the current workspace.
 * Prevents scanning arbitrary filesystem locations from untrusted workspace inputs.
 */
function resolveSafeProjectPath(vscode) {
  const workspaceFolders = vscode.workspace.workspaceFolders || [];
  if (!workspaceFolders.length) {
    return null;
  }
  return workspaceFolders[0].uri.fsPath;
}

module.exports = {
  activate: function activate(context, vscode) {
    // Resolve adapter relative to the repo workspace; adapt the path if your extension
    // is not colocated with this repo.
    const adapterPath = path.resolve(
      __dirname,
      "..",
      "..",
      "plugins",
      "vscode-agent-integration.cjs",
    );
    const pluginPath = path.resolve(
      __dirname,
      "..",
      "..",
      "plugins",
      "simplebeacon-plugin.cjs",
    );

    let adapter;
    try {
      adapter = require(adapterPath);
    } catch (err) {
      console.error("Example activate: failed to load adapter", err.message);
      return;
    }

    let handlers;
    try {
      const result = adapter.install(context, vscode, { pluginPath });
      handlers = result.handlers;
      console.log(
        "SimpleBeacon plugin installed. Registered commands:",
        result.registeredCommands,
      );
    } catch (err) {
      console.error(
        "Example activate: failed to install plugin into VS Code adapter",
        err.message,
      );
      return;
    }

    const out = getOutputChannel(vscode);

    // --- Quick Scan command with progress UI ---
    const scanCmd = vscode.commands.registerCommand(
      "simplebeacon.runQuickScan",
      async () => {
        const projectPath = resolveSafeProjectPath(vscode);
        if (!projectPath) {
          vscode.window.showErrorMessage(
            "SimpleBeacon: No workspace folder open. Open a folder and try again.",
          );
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "SimpleBeacon: Scanning workspace...",
            cancellable: false,
          },
          async () => {
            try {
              const res = await handlers.scanProject({
                projectPath,
                full: false,
              });
              const ok =
                res &&
                res.success &&
                res.json &&
                res.json.gate &&
                res.json.gate.pass;
              out.show(true);
              out.appendLine(`--- Scan at ${new Date().toISOString()} ---`);
              out.appendLine(JSON.stringify(res.json || res, null, 2));
              vscode.window.showInformationMessage(
                ok
                  ? "SimpleBeacon: Gate PASSED"
                  : "SimpleBeacon: Gate reported findings — see Output",
              );
            } catch (err) {
              out.appendLine(`Scan error: ${err.message}`);
              out.show(true);
              vscode.window.showErrorMessage(
                "SimpleBeacon scan failed: " + err.message,
              );
            }
          },
        );
      },
    );
    context.subscriptions.push(scanCmd);

    // --- Gate Status command ---
    const gateCmd = vscode.commands.registerCommand(
      "simplebeacon.gateStatus",
      async () => {
        const projectPath = resolveSafeProjectPath(vscode);
        if (!projectPath) {
          vscode.window.showErrorMessage(
            "SimpleBeacon: No workspace folder open.",
          );
          return;
        }
        try {
          const res = await handlers.gateStatus({ projectPath });
          const gate = res && res.gate;
          if (!gate) {
            vscode.window.showWarningMessage(
              "SimpleBeacon: No gate data — run a scan first.",
            );
            return;
          }
          out.show(true);
          out.appendLine(`--- Gate status at ${new Date().toISOString()} ---`);
          out.appendLine(`Pass: ${gate.pass}`);
          out.appendLine(`Blocking: ${gate.blockingCount || 0}`);
          out.appendLine(`Warnings: ${gate.warningCount || 0}`);
          vscode.window.showInformationMessage(
            gate.pass
              ? `SimpleBeacon: Gate PASSED (${gate.warningCount || 0} warnings)`
              : `SimpleBeacon: Gate FAILED (${gate.blockingCount || 0} blocking)`,
          );
        } catch (err) {
          vscode.window.showErrorMessage(
            "SimpleBeacon gate status failed: " + err.message,
          );
        }
      },
    );
    context.subscriptions.push(gateCmd);
  },

  deactivate: function deactivate() {
    if (_outputChannel) {
      _outputChannel.dispose();
      _outputChannel = null;
    }
  },
};
