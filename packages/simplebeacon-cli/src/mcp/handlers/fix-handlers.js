/**
 * MCP fix handlers — propose_fix, verify_fix
 *
 * propose_fix: Returns a structured remediation template + diff preview for a finding.
 *              Does NOT apply the fix — the agent or human must apply it manually.
 * verify_fix:  Re-runs scan_file on the specified file after a fix is applied.
 *              Reports whether findings were resolved.
 */

const fs = require("fs");
const path = require("path");
const { readFile } = fs.promises;
const { scanFileOnDisk } = require("../../lib/snippet-scanner");
const {
  resolveRemediation,
  getRemediationTemplate,
} = require("../../lib/remediation-templates");
const { ACTION_CODES } = require("../../lib/finding-compressor");

function createFixHandlers({
  withGuard,
  resolveProjectRoot,
  formatToolResult,
}) {
  return {
    propose_fix: withGuard(async (args) => {
      if (!args || typeof args !== "object")
        throw new Error("arguments must be an object");

      const root = resolveProjectRoot(args.projectRoot);

      // Accept either a compressed finding {c,s,l,m,a} or a full finding
      // with recommendedAction/pattern/severity/line
      const finding = args.finding || {};
      const actionCode = finding.a || resolveActionCodeFromFullFinding(finding);

      if (!actionCode && !finding.a) {
        return formatToolResult({
          error:
            "Missing action code. Provide a compressed finding {c,s,l,m,a} or a full finding with recommendedAction.",
        });
      }

      const template = getRemediationTemplate(actionCode);
      if (!template) {
        return formatToolResult({
          error: `No remediation template for action code: ${actionCode}`,
        });
      }

      // If a filePath is provided, try to generate a diff preview
      let diffPreview = null;
      let fileContent = null;
      if (args.filePath) {
        const fullPath = path.resolve(root, args.filePath);
        try {
          fileContent = await readFile(fullPath, "utf8");
          if (template.canAutoFix) {
            const compressedFinding = {
              c: finding.c || finding.pattern || "UNKNOWN",
              s: finding.s || finding.severity || "M",
              l: finding.l || finding.line || 0,
              m: finding.m || finding.match || "",
              a: actionCode,
            };
            diffPreview = generateDiffPreviewSafe(
              fileContent,
              compressedFinding,
              template,
            );
          }
        } catch {
          // File not found or not readable — still return the template
        }
      }

      // Look up the human-readable playbook if available
      let playbook = null;
      if (template.playbookId) {
        try {
          const { GUIDE_PLAYBOOKS } = require("../../reporters/remediation-guides");
          const guide = GUIDE_PLAYBOOKS[template.playbookId];
          if (guide) {
            playbook = {
              id: guide.id,
              title: guide.title,
              timeRequired: guide.timeRequired,
              difficulty: guide.difficulty,
              whyItMatters: guide.whyItMatters,
              steps: guide.steps,
              verify: guide.verify,
            };
          }
        } catch {
          // remediation-guides not available — skip playbook
        }
      }

      return formatToolResult({
        actionCode,
        canAutoFix: template.canAutoFix,
        searchPattern: template.searchPattern
          ? template.searchPattern.source
          : null,
        replaceTemplate: template.replaceTemplate,
        envVarHint: template.envVarHint,
        verifyCommand: template.verifyCommand
          ? template.verifyCommand.replace("<file>", args.filePath || "<file>")
          : null,
        manualSteps: template.manualSteps,
        playbookId: template.playbookId,
        playbook,
        diffPreview,
        filePath: args.filePath || null,
        localOnly: true,
        methodology: "Deterministic template lookup — no LLM inference",
      });
    }),

    verify_fix: withGuard(async (args) => {
      if (!args || typeof args !== "object")
        throw new Error("arguments must be an object");
      if (
        !args.filePath ||
        args.filePath === undefined ||
        args.filePath === null ||
        args.filePath === ""
      ) {
        throw new Error("Missing required argument: filePath");
      }

      const root = resolveProjectRoot(args.projectRoot);

      // Re-scan the file after the fix was applied
      let result;
      try {
        result = scanFileOnDisk(root, args.filePath, {
          compressed: args.compressed === true,
        });
      } catch (err) {
        return formatToolResult({
          error: err.message,
          filePath: args.filePath,
        });
      }

      const remainingCount = result.findingCount || 0;
      const remainingBlocking = result.blockingCount || 0;
      const resolved = remainingCount === 0;

      // If a previous finding count was provided, compare
      let comparison = null;
      if (args.previousFindingCount !== undefined) {
        const prev = Number(args.previousFindingCount);
        comparison = {
          previousCount: prev,
          currentCount: remainingCount,
          fixedCount: Math.max(0, prev - remainingCount),
          newFindings: Math.max(0, remainingCount - prev),
        };
      }

      return formatToolResult({
        filePath: args.filePath,
        resolved,
        remainingFindings: remainingCount,
        remainingBlocking,
        findings: result.findings,
        comparison,
        localOnly: true,
        methodology: args.compressed
          ? "Deterministic regex rescan — compressed findings"
          : "Deterministic regex rescan — no LLM inference",
      });
    }),
  };
}

/**
 * Resolve an action code from a full (uncompressed) finding object.
 * Uses the same logic as finding-compressor.js's resolveActionCode().
 */
function resolveActionCodeFromFullFinding(finding) {
  const { resolveActionCode } = require("../../lib/finding-compressor");
  return resolveActionCode(finding.recommendedAction);
}

/**
 * Safe wrapper around generateDiffPreview that catches errors.
 */
function generateDiffPreviewSafe(fileContent, finding, template) {
  try {
    const { generateDiffPreview } = require("../../lib/remediation-templates");
    return generateDiffPreview(fileContent, finding, template);
  } catch (err) {
    return { canPreview: false, diff: null, reason: err.message };
  }
}

module.exports = { createFixHandlers };
