/**
 * MCP deployment-readiness handler — scan_deployment_readiness
 *
 * Exposes the deployment-readiness scanner as an agent-native MCP tool so
 * agents can validate monorepo deployment topology before claiming
 * "ready to deploy". Runs locally — no source uploaded.
 */

function createDeploymentHandlers({
  withGuard,
  resolveProjectRoot,
  formatToolResult,
}) {
  return {
    scan_deployment_readiness: withGuard(async (args) => {
      const root = resolveProjectRoot(args?.projectRoot);
      try {
        const {
          scanDeploymentReadiness,
        } = require("../../rules/deployment-readiness-scanner");
        const result = await scanDeploymentReadiness(root, {});
        const blocking = result.issues.filter(
          (i) => i.severity === "high" || i.severity === "critical",
        );
        const warnings = result.issues.filter(
          (i) => i.severity === "medium" || i.severity === "low",
        );
        const info = result.issues.filter((i) => i.severity === "info");
        const payload = {
          ready: blocking.length === 0,
          scanned: result.scanned,
          totalFindings: result.findings,
          blockingCount: blocking.length,
          warningCount: warnings.length,
          infoCount: info.length,
          blockingIssues: blocking.map((i) => ({
            severity: i.severity,
            rule: i.pattern,
            type: i.type,
            description: i.description,
            recommendation: i.recommendation,
            affectedFiles: (i.affectedFiles || []).slice(0, 5),
          })),
          warningIssues: warnings.map((i) => ({
            severity: i.severity,
            rule: i.pattern,
            type: i.type,
            description: i.description,
            recommendation: i.recommendation,
            affectedFiles: (i.affectedFiles || []).slice(0, 5),
          })),
          documentedExceptions: info.map((i) => ({
            rule: i.pattern,
            type: i.type,
            description: i.description,
            exception: i.metadata?.exception || null,
          })),
          localOnly: true,
          methodology: "Deterministic topology scan — no code uploaded",
        };
        return formatToolResult(payload);
      } catch (err) {
        return formatToolResult({ error: err.message, projectRoot: root });
      }
    }),
  };
}

module.exports = { createDeploymentHandlers };
