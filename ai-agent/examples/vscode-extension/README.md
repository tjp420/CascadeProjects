Example VS Code extension for SimpleBeacon plugin

This folder contains a minimal example `activate.js` that demonstrates how to
install the SimpleBeacon plugin into a VS Code extension using the adapter in
this repo.

Files:
- activate.js — example `activate(context, vscode)` handler.

How to use in a real extension
1. Copy the `activate.js` contents into your extension's activate function (or require it).
2. Ensure your extension's package.json declares the command `simplebeacon.runQuickScan` if you want it to appear in the command palette.
3. Ensure the extension has access to the workspace and that calling `npx simplebeacon` is allowed in your environment.

Security notes
- The example runs the SimpleBeacon CLI in-process via the plugin which uses child_process. For remote or untrusted workspaces, prefer running scans in a separate worker process or a background service.
- Validate `projectPath` before passing into the plugin and consider restricting paths to the current workspace.
