# SimpleBeacon Scanner

Scan your codebase for issues, credentials, and quality gates directly from VS Code.

## Features

- **Scan Workspace** — Run a full security & quality scan on your open folder
- **Scan Folder** — Right-click any folder in the explorer to scan it
- **Upload & Validate** — Upload report JSON files and validate them
- **Real-time Diagnostics** — Issues appear as red squiggles in your editor
- **Issue Tree View** — Browse findings by category with severity filtering
- **One-click Navigation** — Jump directly to file:line from any finding
- **Auto-scan on Open** — Optionally scan when you open VS Code

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| `SimpleBeacon: Scan Workspace` | — | Scan the entire workspace |
| `SimpleBeacon: Scan Folder...` | — | Scan a specific folder |
| `SimpleBeacon: Upload & Validate Report` | — | Upload a report JSON |
| `SimpleBeacon: Refresh` | — | Refresh the issues panel |
| `SimpleBeacon: Clear Results` | — | Clear all findings |

## Configuration

Open VS Code Settings (`Ctrl+,`) and search for "SimpleBeacon":

| Setting | Default | Description |
|---------|---------|-------------|
| `simplebeacon.apiUrl` | `http://127.0.0.1:3000` | API server URL |
| `simplebeacon.apiKey` | `""` | API key for authenticated scans |
| `simplebeacon.autoScanOnOpen` | `false` | Auto-scan when opening VS Code |
| `simplebeacon.severityFilter` | `medium` | Minimum severity to display |

## Requirements

- A running SimpleBeacon API server (default: `http://127.0.0.1:3000`)
- VS Code 1.74.0 or higher

## Development

```bash
cd ai-platform/simplebeacon-vscode
npm install
npm run compile       # Compile TypeScript
npm run watch       # Watch mode
```

Press `F5` in VS Code to launch the Extension Development Host.

## Packaging

```bash
npm install -g @vscode/vsce
vsce package          # Creates .vsix file
vsce publish          # Publishes to marketplace
```

## License

MIT
