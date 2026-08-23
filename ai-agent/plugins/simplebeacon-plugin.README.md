SimpleBeacon Agent Plugin (starter)

Location: ai-agent/plugins/simplebeacon-plugin.cjs

Purpose:
- Minimal example plugin that exposes two handlers to the agent runtime:
  - simplebeacon.scan_project(opts)
  - simplebeacon.gate_status(opts)

How to load:
- If your agent runtime supports plugin registration (registerHandler), require and register:

  const plugin = require('./plugins/simplebeacon-plugin.cjs');
  const handle = plugin.register(agentContext);

- Or, after requiring the plugin, call register() with a simple object that exposes registerHandler(name, fn).

Notes:
- The plugin runs the local `npx simplebeacon` CLI in a child process. Ensure `simplebeacon` is installed (dev dependency or CLI available) and that calling `npx simplebeacon` is safe in your environment.
- Validate and sanitize `opts.projectPath` before passing to the CLI in production.
- Expand handlers to implement additional endpoints (scan_file, scan_snippet, suggest_fixes) as needed.
