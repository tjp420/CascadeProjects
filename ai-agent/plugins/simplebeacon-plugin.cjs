"use strict";
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileP = promisify(execFile);

// SimpleBeacon Agent Plugin (starter)
// - Exports metadata and a register(agentContext) function
// - Handlers run the local `npx simplebeacon` CLI in a child process
// - Designed as a minimal, safe example to adapt for your agent runtime

module.exports = {
  name: "simplebeacon-plugin",
  version: "0.1.0",
  description: "Starter plugin to run SimpleBeacon scans from agent contexts",

  register: function register(agent) {
    // agent is expected to provide `registerHandler(name, fn)` or an `on` API.
    const registerHandler =
      typeof agent.registerHandler === "function"
        ? agent.registerHandler.bind(agent)
        : typeof agent.on === "function"
          ? agent.on.bind(agent)
          : null;

    // Fallback: attach helpers directly if no handler registration exists
    function attachHelpers() {
      agent.simplebeacon = agent.simplebeacon || {};
      agent.simplebeacon.scanProject = async (opts = {}) =>
        handlerScanProject(opts);
      agent.simplebeacon.getGateStatus = async (opts = {}) =>
        handlerGateStatus(opts);
    }

    async function runSimplebeaconCli(args, cwd) {
      const npx = process.platform === "win32" ? "npx.cmd" : "npx";
      try {
        const { stdout } = await execFileP(npx, ["simplebeacon", ...args], {
          cwd: cwd || process.cwd(),
          maxBuffer: 20 * 1024 * 1024,
        });
        // CLI prints JSON when --format json and --output - are used
        try {
          return { success: true, stdout: stdout, json: JSON.parse(stdout) };
        } catch (e) {
          return {
            success: true,
            stdout: stdout,
            json: null,
            parseError: e.message,
          };
        }
      } catch (err) {
        return {
          success: false,
          error: err.message,
          code: err.code,
          stderr: err.stderr && err.stderr.toString(),
        };
      }
    }

    async function handlerScanProject(opts = {}) {
      const projectPath = opts.projectPath || process.cwd();
      const fullArgs = ["scan", "--gate", "--format", "json", "--output", "-"];
      if (opts.full) fullArgs.splice(1, 0, "--full");
      return await runSimplebeaconCli(fullArgs, projectPath);
    }

    async function handlerGateStatus(opts = {}) {
      const projectPath = opts.projectPath || process.cwd();
      const args = ["scan", "--gate", "--format", "json", "--output", "-"];
      const res = await runSimplebeaconCli(args, projectPath);
      if (!res.success) return res;
      const report = res.json || {};
      const gate = report.gate || {}; // depends on CLI output shape
      return { success: true, gate };
    }

    if (registerHandler) {
      try {
        registerHandler("simplebeacon.scan_project", handlerScanProject);
        registerHandler("simplebeacon.gate_status", handlerGateStatus);
      } catch (e) {
        // Not fatal — fall back to helpers, but log for debuggability
        console.error(
          "[simplebeacon-plugin] registerHandler failed, falling back to helpers:",
          e && e.message ? e.message : e,
        );
        attachHelpers();
      }
    } else {
      attachHelpers();
    }

    return { scanProject: handlerScanProject, gateStatus: handlerGateStatus };
  },
};
