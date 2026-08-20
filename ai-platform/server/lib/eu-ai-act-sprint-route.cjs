// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const path = require("path");
const { runEuAiActSprint } = require("./eu-ai-act-sprint-service.cjs");
const { toClientError } = require("../../shared-utils/index.cjs");
const { resolveProjectPath } = require("./flexible-analyze-utils.cjs");

/**
 * Register eu ai act sprint route.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function registerEuAiActSprintRoute(app, options = {}) {
  const projectRoot = options.projectRoot || path.join(__dirname, "../..");
  const monorepoRoot = options.monorepoRoot || path.join(projectRoot, "..");

  app.get("/api/operator/eu-ai-act/bootstrap", (_req, res) => {
    res.json({
      ok: true,
      sku: "euai2499",
      label: "EU AI Act Readiness Sprint ($2,499)",
      pricingUrl: "https://simplebeacon.ai/pricing#eu-ai-act",
      disclaimer:
        "Static technical readiness — not legal conformity certification.",
      cliEquivalent: [
        "npx simplebeacon init --profile eu-ai-act",
        "npx simplebeacon scan --gate --offline --checklist eu-ai-act",
        "npx simplebeacon compliance --checklist eu-ai-act",
        "npx simplebeacon assess --checklist eu-ai-act",
      ],
      artifactNames: {
        report: ".simplebeacon/eu-ai-act-report.json",
        compliance: ".simplebeacon/eu-ai-act-compliance.json",
        assessment: ".simplebeacon/eu-ai-act-assessment.json",
      },
    });
  });

  app.post("/api/operator/eu-ai-act/sprint", async (req, res) => {
    try {
      const body = req.body || {};
      const rawPath = body.projectPath || body.path;
      if (!rawPath) {
        return res.status(400).json({
          ok: false,
          error: "missing_path",
          message: "projectPath is required (folder on this machine)",
        });
      }

      const projectPath = resolveProjectPath(
        projectRoot,
        rawPath,
        monorepoRoot,
      );
      if (!projectPath) {
        return res.status(400).json({
          ok: false,
          error: "invalid_path",
          message: "projectPath could not be resolved",
        });
      }

      let workspaceDir = null;
      if (body.workspaceDir) {
        workspaceDir = path.resolve(projectRoot, body.workspaceDir);
      }

      const result = await runEuAiActSprint(
        {
          projectPath,
          company: body.company,
          client: body.client,
          assessor: body.assessor,
          workspaceDir,
          initProfile: body.initProfile !== false,
          forceInit: body.forceInit === true,
          forceNpmAudit: body.forceNpmAudit === true,
        },
        { platformRoot: projectRoot },
      );

      return res.json({
        ...result,
        sampleReportUrl: "/eu-ai-act-sample-report",
        analyzeHashUrl: "/app#/eu-ai-act",
      });
    } catch (err) {
      const status = /required|does not exist|must be a directory/i.test(
        err.message,
      )
        ? 400
        : 500;
      return res.status(status).json({
        ok: false,
        error: "sprint_failed",
        message: toClientError(err, "EU AI Act sprint failed"),
      });
    }
  });
}

module.exports = { registerEuAiActSprintRoute };
