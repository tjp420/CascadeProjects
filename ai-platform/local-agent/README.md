# SimpleBeacon Local Agent

A tiny localhost-only Node.js service that lets the public SimpleBeacon web dashboard scan local filesystem paths that the remote server cannot reach.

## Why this exists

The public dashboard is hosted on Render and has no access to your local `C:\\`, `G:\\`, or `~/Projects` directories. The local agent runs on your machine, reads those paths, runs the same SimpleBeacon scan used by the CLI, and returns the report to the dashboard over `http://127.0.0.1:55432`.

## Install and run from the monorepo

From the monorepo root:

```bash
cd ai-platform/local-agent
npm install
```

## Run

```bash
npm start
```

The agent prints:

```
[agent] Listening on http://127.0.0.1:55432
[agent] Scanner root: <monorepo-root>
[agent] Scanner available: true
```

## Dashboard integration

When the agent is running, the Analyze page auto-detects it and shows a status line under the path input. Typing an absolute local path (e.g., `G:\\Games\\Ubisoft`) and clicking **Run** routes the scan through the agent instead of the remote server.

## Security notes

- The agent binds to `127.0.0.1` only and rejects non-loopback TCP connections.
- CORS is restricted to `localhost` / `127.0.0.1` origins.
- The agent validates that the requested path exists and is a directory.
- No cloud upload or remote access is performed by the agent itself.

## Distribute to end users

### Recommended: portable zip

The simplest way to ship the agent to users who don't have Node.js is a portable zip that contains the agent, its dependencies, and the SimpleBeacon scanner source:

```bash
cd ai-platform/local-agent
npm install
npm run package:portable
```

This produces `dist/simplebeacon-local-agent-portable.zip`. Users extract the zip and run:

- Windows: `start-agent.bat`
- macOS / Linux: `start-agent.sh`

### Experimental: single executable with pkg

You can also try to build a single executable using `pkg`:

```bash
cd ai-platform/local-agent
npm install
npm run package
```

This produces `dist/simplebeacon-local-agent.exe` (Windows), `dist/simplebeacon-local-agent-macos` (macOS), and `dist/simplebeacon-local-agent-linux` (Linux). Note: `pkg` may not bundle every dynamic require in `simplebeacon-cli`, so the scanner may be unavailable unless the `packages/simplebeacon-cli/src` directory is also shipped alongside the executable.

## Browser compatibility note

The dashboard is served over HTTPS, while the agent is HTTP on `127.0.0.1`. Chromium-based browsers (Chrome, Edge, Brave) treat `localhost` as a secure context and allow the dashboard to talk to the agent. Firefox and Safari may block the connection as mixed content. For those browsers, use the browser extension bridge or run the dashboard in a native Electron wrapper.

## Uninstall

### Windows (setup.exe or install-windows.bat)

After installation, an **Uninstall SimpleBeacon Local Agent** shortcut is created in the Start Menu under `SimpleBeacon`. Running it removes:

- The installed agent folder at `%LOCALAPPDATA%\SimpleBeaconLocalAgent`
- The Start Menu folder
- The startup shortcut
- Any running agent process started from that folder

You can also run the uninstaller manually from the install folder:

```powershell
& "$env:LOCALAPPDATA\SimpleBeaconLocalAgent\uninstall-windows.bat"
```

### Portable zip (without running the installer)

If you only extracted the zip and ran `start-agent.bat`, stop the agent window and delete the extracted folder.

## Environment variables

- `SIMPLEBEACON_AGENT_PORT` — override the default port `55432`.
- `SIMPLEBEACON_AGENT_HOST` — override the default bind address `127.0.0.1`.
