# SimpleBeacon Example VS Code Extension

A minimal, F5-launchable VS Code extension that wires the SimpleBeacon plugin into VS Code's Copilot Chat agent mode via the adapter in this repo.

## Files

- `package.json` — VS Code extension manifest with command contributions
- `activate.js` — extension entry point (`activate`/`deactivate`), wires adapter + plugin, adds progress UI and output channel

## Quick start (F5 launch)

1. Open this folder (`ai-agent/examples/vscode-extension`) in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open a workspace folder in the dev host
4. Run **SimpleBeacon: Run Quick Scan** from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
5. View results in the **SimpleBeacon** output channel

## Commands

| Command | Description |
|---------|-------------|
| `simplebeacon.runQuickScan` | Runs a gate scan on the current workspace with progress notification |
| `simplebeacon.gateStatus` | Reads gate pass/fail from the latest scan report |

## How it works

1. `activate()` loads the adapter (`ai-agent/plugins/vscode-agent-integration.cjs`)
2. The adapter loads the plugin (`ai-agent/plugins/simplebeacon-plugin.cjs`) and registers its handlers as VS Code commands
3. The example adds two convenience commands that call the plugin handlers with the current workspace path
4. The plugin runs `npx simplebeacon scan --gate --format json` in a child process and returns the parsed JSON

## Using in a real extension

1. Copy `activate.js` logic into your extension's `activate()` (or `require` it)
2. Add the `contributes.commands` entries from `package.json` to your extension's `package.json`
3. Add `simplebeacon` as a devDependency: `npm install --save-dev simplebeacon`
4. Adjust command names to use your extension's publisher prefix (e.g., `myext.simplebeacon.scan`)

## Security notes

- The example restricts `projectPath` to the current workspace folder — no arbitrary path scanning
- The plugin uses `child_process.execFile` with `npx`. For untrusted workspaces, run scans in a separate worker process
- Validate all user-supplied paths before passing to the CLI
- Consider prompting for confirmation before running full scans on large repos
