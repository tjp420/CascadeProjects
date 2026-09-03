# SimpleBeacon — MCP Server

What is the MCP server?
- The MCP (Model Context Protocol) server exposes local APIs that let agent runtimes or automation tooling invoke SimpleBeacon scans, gate status checks, and suggestions without invoking the CLI directly.

Where to find it
- Local implementation (offline-capable): packages/simplebeacon-cli/src/mcp/stdio-server.js
- Programmatic controller: packages/simplebeacon-cli/src/lib/ai-agent-controller.js (or equivalent path in ai-platform)

Common endpoints/methods
- scan(options) — run a scan (full or staged), returns structured report
- getGateStatus() — return gate pass/fail and blocking issues
- suggestFixes() — prioritized remediation suggestions from scan findings
- exportReport(path) — write JSON output to disk

Run locally
- Start a local MCP server (offline mode):
  node packages/simplebeacon-cli/bin/simplebeacon.js mcp --offline

Integration examples
- CI or automation can call the MCP server via stdio or HTTP bridge to run a scan and fetch JSON results instead of spawning the CLI process every time.

Security considerations
- Keep MCP server offline for local runs; do not expose it to public networks unless behind auth and network controls.

Extending the MCP server
- Add new RPCs in the stdio server file and map them to the CLI scan runner. Unit tests should be added under packages/simplebeacon-cli/test/.
