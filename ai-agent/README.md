# AI Agent

SimpleBeacon AI orchestrator for static analysis and code remediation workflows.

## Installation

```bash
npm install
```

## Usage

```bash
node orchestrator.cjs --help
```

## Testing

```bash
npm test
```

## VS Code Agent integration

A small adapter is provided so the SimpleBeacon plugin can be installed into a VS Code extension or "agent" running inside VS Code.

- Adapter location: [ai-agent/plugins/vscode-agent-integration.cjs](C:/Users/user/CascadeProjects.worktrees/simplebeacon-scan-progress-update/ai-agent/plugins/vscode-agent-integration.cjs)
- Plugin location: [ai-agent/plugins/simplebeacon-plugin.cjs](C:/Users/user/CascadeProjects.worktrees/simplebeacon-scan-progress-update/ai-agent/plugins/simplebeacon-plugin.cjs)

Quick install into a VS Code extension activation() handler:

```js
// Inside your extension's activate(context) function
const vscode = require("vscode");
const adapter = require("./ai-agent/plugins/vscode-agent-integration.cjs");
try {
  const { handlers, registeredCommands } = adapter.install(context, vscode, {
    pluginPath: "./ai-agent/plugins/simplebeacon-plugin.cjs",
  });
  // registeredCommands is an array of command names exposed to VS Code
  console.log("Registered SimpleBeacon commands:", registeredCommands);
} catch (err) {
  console.error(
    "Failed to install SimpleBeacon plugin into VS Code agent:",
    err,
  );
}
```

Notes & safety:

- The adapter registers plugin handlers as vscode.commands. In production, prefix command names with your extension id (e.g., 'simplebeacon.scan_project').
- The adapter runs the SimpleBeacon CLI via npx in the extension process. For untrusted inputs or remote workspaces, run scans in a background worker or separate process and sandbox access.
- Add input validation and restrict projectPath before exposing commands to the VS Code command palette.

## License

MIT — see [LICENSE](LICENSE)
