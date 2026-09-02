# SimpleBeacon — Plugins

Purpose
- Plugins extend the agent runtime (and MCP server) with custom tools, skills, or connectors. They can add custom scanners, third-party integrations, or on-demand helper tools.

Where to configure
- Plugin manifests and examples live under packages/simplebeacon-cli/examples and .github/workflows that reference reusable actions.

Installing a plugin locally
- Prefer local, source-installed plugins during development. Example pattern:
  - Clone plugin repo into packages/plugins/<plugin-name>
  - Add a small manifest or registration file the MCP server reads

Security and governance
- Only enable trusted plugins in CI. Audit plugin code before enabling it for repo-level scans.
- Plugins that run external network calls should be opt-in and require explicit allowlisting.

Plugin development tips
- Provide a minimal API surface for the plugin (scan(), transform(), report()).
- Unit test the plugin logic under packages/<plugin>/test.
- Use the same packaging conventions as the SimpleBeacon CLI repository so CI can import them easily.
