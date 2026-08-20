# Release Notes — v3.0.491

**Artifacts**

- **VSIX**: generated/simplebeacon-vscode-3.0.491.vsix
- **Dashboard bundle**: ai-platform/web/simplebeacon-dashboard/dist/
- **VSIX SHA-256**: 57AA1C946658A48FE5D3E98C53F4BFEC74809891990DDE94A6F5A9D2F3439BB0

**Summary**

- Local packaging completed using `npx @vscode/vsce package` — no global `vsce` required.
- Dashboard assets built with `vite` and staged to the extension via `sync-dashboard-web`.
- Smoke install verified; extension id `simplebeacon.simplebeacon-vscode` installed then uninstalled successfully.

**Notes & Next Steps**

- Consider publishing the VSIX to your marketplace or attaching it to a GitHub Release.
- Optionally run an activation smoke test with `--extensionDevelopmentPath` to verify runtime initialization and full dashboard loading.
