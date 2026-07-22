# Sidebar Integration Guide

This file documents a minimal integration to expose the hosted dashboard inside the VS Code sidebar webview and provide a secure local loopback `apiBase` for the web UI.

Steps to wire into the extension:

1. Import the helper in your extension activation code and call `createSidebarWebview(context)`.
2. Ensure your webview HTML listens for an `init` message and uses the provided `apiBase` to contact the local agent (loopback) when present.
3. Allow the webview to request updates to `apiBase` by posting `{ type: 'setApiBase', apiBase: 'http://127.0.0.1:53099/api' }`.

Security notes:
- Only honor loopback origins provided by the extension to the webview, do not auto-allow insecure origins from query params.
- Validate and persist the `apiBase` setting in user settings, not workspace settings, by default.
