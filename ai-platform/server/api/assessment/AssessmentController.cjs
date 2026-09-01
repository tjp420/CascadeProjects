// simplebeacon-ignore: Scanner pattern definitions, dashboard code, security — all findings are false positives, debugArtifacts, test fixtures
/**
 * AI Data Quality Assessment — clone repo (optional), scan, deliver assessment JSON.
 */

const fs = require("fs");
const constants = require("../../config/constants.cjs");
const fsp = fs.promises;
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const logger = require("../../lib/app-logger.cjs");

const {
  startAssessmentRetentionJob,
  resolveAssessmentTtlMs,
} = require("../../lib/assessment-retention.cjs");
const {
  validateRepoUrl,
  resolveDefaultAllowedRoots,
  assertSafeProjectPath,
} = require("../../lib/path-safety.cjs");
const { toClientError } = require("../../../shared-utils/index.cjs");
const {
  buildAssessmentReport,
  evaluateGate,
  formatJsonReport,
  loadSimplebeaconConfig,
  resolvePlatformRoot,
  runScan,
  sanitizeScanReport,
} = require("../../lib/simplebeacon-proxy.cjs");

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.join(__dirname, "../../..");

/**
 * Assessment controller.
 */
class AssessmentController {
  constructor() {
    this.assessmentsDir = path.join(PROJECT_ROOT, "assessments");
    if (process.env.ASSESSMENT_RETENTION_ENABLED !== "false") {
      startAssessmentRetentionJob({ assessmentsDir: this.assessmentsDir });
    }
  }

  resolveAssessmentId(req) {
    return req.params.id || req.params.assessmentId;
  }

  async triggerScan(req, res) {
    return this.createAssessment(req, res);
  }

  async getReport(req, res) {
    req.params.assessmentId = this.resolveAssessmentId(req);
    return this.getAssessment(req, res);
  }

  async downloadReport(req, res) {
    req.params.assessmentId = this.resolveAssessmentId(req);
    return this.downloadAssessment(req, res);
  }

  async createAssessment(req, res) {
    try {
      const {
        repoUrl,
        company,
        email,
        assessmentType,
        projectPath: bodyPath,
      } = req.body || {};
      const isAuthenticated = Boolean(req.user?.id || req.user?.email);

      if (!isAuthenticated && bodyPath) {
        return res.status(403).json({
          success: false,
          error:
            "projectPath requires sign-in; use repoUrl for public assessments",
        });
      }
      if (!isAuthenticated && !repoUrl) {
        return res.status(400).json({
          success: false,
          error: "repoUrl is required for public assessments",
        });
      }

      const assessmentId = `assessment_${Date.now()}`;
      const assessmentDir = path.join(this.assessmentsDir, assessmentId);
      await fsp.mkdir(assessmentDir, { recursive: true });

      let projectPath = assessmentDir;
      if (repoUrl) {
        projectPath = await this.cloneRepo(repoUrl, assessmentDir);
      } else if (bodyPath) {
        const allowedRoots = resolveDefaultAllowedRoots(PROJECT_ROOT);
        projectPath = assertSafeProjectPath(
          String(bodyPath),
          allowedRoots,
          "projectPath",
        );
      }

      const scanResult = sanitizeScanReport(
        await this.runSimplebeaconScan(projectPath),
      );
      const assessment = buildAssessmentReport(scanResult, {
        company: company || "Unknown",
        assessor: "Simplebeacon AI",
        projectRoot: projectPath,
        commandsRun: [
          `node packages/simplebeacon-cli/bin/simplebeacon.js scan --path "${projectPath}" --format json --output .simplebeacon/report.json --gate`,
          `node packages/simplebeacon-cli/bin/simplebeacon.js assess --path "${projectPath}" --company "${company || "Unknown"}"`,
        ],
      });

      assessment.metadata = {
        assessmentId,
        company,
        email,
        assessmentType,
        createdAt: new Date().toISOString(),
        repoUrl: repoUrl || null,
        projectPath: repoUrl ? "[cloned-repo-redacted]" : projectPath,
        expiresAt: new Date(
          Date.now() + resolveAssessmentTtlMs(),
        ).toISOString(),
      };

      if (repoUrl) {
        await this.removeClonedSource(assessmentDir);
      }

      const assessmentPath = path.join(assessmentDir, "assessment.json");
      await fsp.writeFile(
        assessmentPath,
        `${JSON.stringify(assessment, null, 2)}\n`,
        "utf8",
      );

      const findings = assessment.findings || {};
      const totalFindings = Object.values(findings).reduce(
        (sum, cat) =>
          sum +
          (typeof cat === "object" && cat?.findings != null ? cat.findings : 0),
        0,
      );

      res.json({
        success: true,
        assessmentId,
        reportUrl: `/api/assessment/report/${assessmentId}`,
        summary: {
          executiveSummary: assessment.executiveSummary,
          complianceChecklist: assessment.complianceChecklist?.summary,
          totalFindings,
          status: "completed",
        },
      });
    } catch (error) {
      logger.error("[Assessment] create error:", error.message);
      const status = /required|invalid|outside allowed|does not exist/i.test(
        error.message,
      )
        ? 400
        : 500;
      res
        .status(status)
        .json({
          success: false,
          error: toClientError(error, "Assessment failed"),
        });
    }
  }

  async getAssessment(req, res) {
    try {
      const assessmentId = this.resolveAssessmentId(req);
      const assessment = await this.readAssessment(assessmentId);
      res.json({ success: true, assessmentId, assessment });
    } catch (error) {
      const status = error.code === "ENOENT" ? 404 : 500;
      res
        .status(status)
        .json({
          success: false,
          error: toClientError(error, "Failed to load assessment"),
        });
    }
  }

  async downloadAssessment(req, res) {
    try {
      const assessmentId = this.resolveAssessmentId(req);
      const { format } = req.params;
      const assessmentPath = path.join(
        this.assessmentsDir,
        assessmentId,
        "assessment.json",
      );
      const assessmentData = await fsp.readFile(assessmentPath, "utf8");

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${assessmentId}.json"`,
        );
        return res.send(assessmentData);
      }

      res.json(JSON.parse(assessmentData));
    } catch (error) {
      const status = error.code === "ENOENT" ? 404 : 500;
      res
        .status(status)
        .json({
          success: false,
          error: toClientError(error, "Failed to download assessment"),
        });
    }
  }

  async readAssessment(assessmentId) {
    try {
      const assessmentPath = path.join(
        this.assessmentsDir,
        assessmentId,
        "assessment.json",
      );
      const assessmentData = await fsp.readFile(assessmentPath, "utf8");
      return JSON.parse(assessmentData);
    } catch (error) {
      if (error.code === "ENOENT") {
        const notFound = new Error(`Assessment ${assessmentId} not found`);
        notFound.code = "ENOENT";
        throw notFound;
      }
      throw new Error(
        `Failed to read assessment ${assessmentId}: ${error.message}`,
      );
    }
  }

  async cloneRepo(repoUrl, targetDir) {
    try {
      const safeUrl = validateRepoUrl(repoUrl);
      const cloneInto = path.join(targetDir, "repo");
      await fsp.mkdir(cloneInto, { recursive: true });
      await execFileAsync(
        "git",
        ["clone", "--depth", "1", safeUrl, cloneInto],
        {
          cwd: PROJECT_ROOT,
          timeout: constants.TIMEOUT_2M,
          maxBuffer: 10 * constants.BYTES_PER_KB * constants.BYTES_PER_KB,
        },
      );
      return cloneInto;
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  async removeClonedSource(assessmentDir) {
    try {
      const repoPath = path.join(assessmentDir, "repo");
      if (fs.existsSync(repoPath)) {
        await fsp.rm(repoPath, { recursive: true, force: true });
      }
    } catch (error) {
      logger.warn("[Assessment] removeClonedSource error:", error.message);
    }
  }

  async runSimplebeaconScan(projectPath, opts = {}) {
    try {
      const resolvedPath = path.resolve(projectPath);
      const { platformRoot } = resolvePlatformRoot(resolvedPath);
      const config = loadSimplebeaconConfig(platformRoot);
      const safeOpts = opts && typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
      const runScanOpts = {
        config,
        configPath: config.configPath,
        // Forward tier if provided so higher-level dispatchers can enforce limits
        tier: safeOpts.tier || safeOpts.userTier || 'starter',
      };
      const report = await runScan(resolvedPath, runScanOpts);
      const gateResult = evaluateGate(report, config.gate);
      const formatted = formatJsonReport(report, gateResult);

      const reportOut = path.join(resolvedPath, ".simplebeacon", "report.json");
      await fsp.mkdir(path.dirname(reportOut), { recursive: true });
      await fsp.writeFile(
        reportOut,
        `${JSON.stringify(formatted, null, 2)}\n`,
        "utf8",
      );

      return formatted;
    } catch (error) {
      throw new Error(`Scan failed for ${projectPath}: ${error.message}`);
    }
  }
}

module.exports = new AssessmentController();
