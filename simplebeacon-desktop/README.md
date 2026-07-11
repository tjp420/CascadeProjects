# SimpleBeacon Desktop

A Tauri-based desktop wrapper around the SimpleBeacon dashboard. It bundles the
production static dashboard files and uses Tauri plugins to expose native
system APIs to the web UI, bypassing browser sandbox restrictions for local
scanning, file system access, and CLI/agent execution.

## What it does

- Bundles `ai-platform/web/simplebeacon-dashboard` as a static frontend served
  from inside the app — works offline, no CORS, no remote URL dependency.
- Exposes Tauri commands for selecting folders, reading directories, and
  reading/writing text files from the native OS.
- Provides a global bridge script (`desktop-bridge.js`) that the dashboard can
  call via `window.__SBD_SELECT_FOLDER__`, `window.__SBD_READ_DIRECTORY__`, etc.
- Configured with permissions for the full scope: filesystem, dialog, and shell
  execution.

## Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- Tauri CLI: `npm install -g @tauri-apps/cli`

## Project layout

```
simplebeacon-desktop/
├── build-frontend.js      # Copies dashboard into dist/dashboard and injects bridge
├── desktop-bridge.js      # Global JS bridge exposing Tauri APIs to the dashboard
├── serve.js               # Tiny static server used during tauri dev
├── dist/                  # Frontend build output (generated)
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json   # Tauri v2 capability/permission definitions
│   └── src/
│       ├── main.rs
│       └── lib.rs         # Tauri commands
```

## Commands

```bash
# Install dependencies
npm install

# Run in development mode (builds dashboard, serves it, opens Tauri window)
npm run tauri:dev

# Build a production installer
npm run tauri:build
```

## Next integration steps

The dashboard can detect the desktop runtime with `window.__SIMPLEBEACON_DESKTOP__`.
Update the Analyze page to use the bridge functions instead of browser-only
APIs when that flag is set, e.g.:

```js
if (window.__SIMPLEBEACON_DESKTOP__) {
  const path = await window.__SBD_SELECT_FOLDER__();
  const result = await window.__SBD_READ_DIRECTORY__(path);
  // feed result into the existing SimpleBeacon scanner logic
}
```
