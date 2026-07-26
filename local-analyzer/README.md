Local Analyzer bridge

This lightweight Node.js server exposes a single endpoint to return directory metadata for a small set of whitelisted folders. Intended for local-only use (loopback) and only trust dashboards you control.

Quick start

1. Node.js >= 18 installed.
2. From this folder:

```powershell
npm install
npm run start
```

3. By default the server listens on port 8080. Set `PORT`, `ALLOWED_ORIGIN`, and `ALLOWED_PATHS` as environment variables to configure.

Build a Windows standalone exe (optional)

```powershell
npm install
npm run build:exe
```

This uses `pkg` to create `local-analyzer.exe` in this folder. Test the exe on a Windows machine.

Security notes

- Never set `ALLOWED_ORIGIN='*'` in production.
- Do not whitelist sensitive system paths. Use strict whitelists.
- Consider adding an access token and user confirmation UI before returning file lists.
