/**
 * MCP scan handlers — scan_snippet, scan_file, scan_project
 */

const {
  scanSnippetContent,
  scanFileOnDisk,
} = require("../../lib/snippet-scanner");
const {
  evaluateScannablePath,
  skippedScanResult,
  slimScanResult,
  slimScanFindings,
} = require("../../lib/scannable-path");

function createScanHandlers({
  withGuard,
  resolveProjectRoot,
  formatToolResult,
  cacheReport,
}) {
  return {
    scan_snippet: withGuard((args) => {
      if (!args || typeof args !== "object")
        throw new Error("arguments must be an object");
      if (
        args.content === undefined ||
        args.content === null ||
        args.content === ""
      ) {
        throw new Error("Missing required argument: content");
      }
      const filePath = args.filePath || "snippet.txt";
      const skipGate = evaluateScannablePath(filePath);
      if (!skipGate.scannable) {
        return formatToolResult(slimScanResult(skippedScanResult(filePath)));
      }
      const result = scanSnippetContent(String(args.content || ""), {
        filePath,
        projectRoot: resolveProjectRoot(args.projectRoot),
      });
      return formatToolResult(slimScanResult(result));
    }),

    scan_file: withGuard((args) => {
      if (!args || typeof args !== "object")
        throw new Error("arguments must be an object");
      if (
        args.filePath === undefined ||
        args.filePath === null ||
        args.filePath === ""
      ) {
        throw new Error("Missing required argument: filePath");
      }
      const { filePath, projectRoot } = args;
      try {
        const result = scanFileOnDisk(
          resolveProjectRoot(projectRoot),
          filePath,
        );
        return formatToolResult(slimScanResult(result));
      } catch (err) {
        return formatToolResult(
          slimScanResult({
            error: err.message,
            filePath,
          }),
        );
      }
    }),

    scan_project: withGuard(async (args) => {
      const root = resolveProjectRoot(args.projectRoot);
      const { runScan } = require("../../scan");
      const { loadSimplebeaconConfig } = require("../../config");
      const fs = require("fs");
      const path = require("path");
      try {
        const configPath = args.configPath
          ? path.resolve(root, args.configPath)
          : null;
        const config =
          configPath && fs.existsSync(configPath)
            ? loadSimplebeaconConfig(root, configPath)
            : loadSimplebeaconConfig(root);
        if (args.complete === true) {
          config.fullDirectoryScan = true;
        }
        if (args.profile) {
          config.profile = args.profile;
        }
        if (args.gate === true) {
          config.gate = config.gate || {};
          config.gate.enabled = true;
        }
        const report = await runScan(root, {
          config,
          configPath,
          offline: true,
        });
        cacheReport(root, report);
        const detectedIssues = slimScanFindings(
          (report.detectedIssues || []).map((i) => ({
            file:
              (Array.isArray(i.filePaths) && i.filePaths[0]) ||
              (Array.isArray(i.affectedFiles) && i.affectedFiles[0]) ||
              i.filePath ||
              "",
            line: i.line ?? null,
            rule: i.pattern || i.rule || "unknown",
            severity: i.severity || "low",
            fix:
              i.recommendedAction ||
              i.recommendation ||
              i.fix ||
              i.description ||
              "",
          })),
          8,
        );
        const gateBlocking = slimScanFindings(
          (report.gate?.blockingIssues || []).map((i) => ({
            file:
              (Array.isArray(i.filePaths) && i.filePaths[0]) ||
              (Array.isArray(i.affectedFiles) && i.affectedFiles[0]) ||
              i.filePath ||
              "",
            line: i.line ?? null,
            rule: i.pattern || i.rule || "unknown",
            severity: i.severity || "medium",
            fix:
              i.recommendedAction ||
              i.recommendation ||
              i.fix ||
              i.description ||
              "",
          })),
          8,
        );
        const payload = {
          ok: true,
          skipped: false,
          cached: false,
          reason: null,
          gatePass: report.gate?.pass ?? null,
          blockingCount: report.gate?.blockingCount ?? 0,
          warningCount: report.gate?.warningCount ?? 0,
          findingCount: report.issueCount ?? detectedIssues.length,
          findings: detectedIssues,
          gate: {
            pass: report.gate?.pass ?? null,
            blockingCount: report.gate?.blockingCount ?? 0,
            warningCount: report.gate?.warningCount ?? 0,
            findings: gateBlocking,
          },
          next:
            report.gate?.blockingCount > 0 ? "fix_then_rescan_once" : "done",
        };
        return formatToolResult(payload);
      } catch (err) {
        return formatToolResult({ error: err.message, projectRoot: root });
      }
    }),
  };
}

module.exports = { createScanHandlers };
