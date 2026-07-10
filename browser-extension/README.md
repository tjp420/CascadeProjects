# Simplebeacon Local Agent Bridge

A minimal browser extension that lets the public Simplebeacon dashboard talk to the Local Scan Agent running on the user's own machine (`http://127.0.0.1:55432`).

## Why this is needed

Browsers block HTTPS pages from fetching HTTP localhost due to mixed-content policy. This extension acts as a privileged bridge: the dashboard calls `window.simplebeaconAgentBridge.fetch(...)`, the content script forwards the request to the extension's service worker, and the service worker fetches the agent directly.

## Files

- `manifest.json` — MV3 extension manifest.
- `service-worker.js` — fetches the localhost agent on behalf of the page.
- `content.js` — injects the bridge and relays messages.
- `bridge-inject.js` — page-side proxy exposed as `window.simplebeaconAgentBridge`.

## Load the extension for development

1. Open Chrome/Edge and go to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `browser-extension/` folder.
4. Open the Simplebeacon dashboard. The dashboard will auto-detect the bridge and route agent calls through it.

## Build a distribution zip

```bash
node build-extension.cjs
```

The zip is written to `browser-extension/dist/simplebeacon-local-agent-bridge-<version>.zip`.

## Dashboard integration

`ai-platform/web/simplebeacon-dashboard/js-es2018/services/localAgentService.js` detects `window.simplebeaconAgentBridge` and prefers it over direct `fetch()` when the page is served over HTTPS. No other page code needs to change.

## Permissions

- `activeTab`, `storage`
- `http://127.0.0.1:55432/*` and `http://localhost:55432/*`
- Content script matches for `https://*.simplebeacon.ai/*` and `https://*.onrender.com/*`

The extension only requests the host permissions it needs to reach the agent and does not read page content beyond the bridge messages it relays.
