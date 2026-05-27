/**
 * AI Data Quality Assessment — clone repo (optional), scan, deliver assessment JSON.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const {
  runScan,
  evaluateGate,
  loadSimplebeaconConfig,
  resolvePlatformRoot
} = require('../../../packages/simplebeacon-cli/src/index');
const { formatJsonReport } = require('../../../packages/simplebeacon-cli/src/reporters/json');
const { buildAssessmentReport } = require('../../../packages/simplebeacon-cli/src/assessment');
const { sanitizeScanReport } = require('../../../packages/simplebeacon-cli/src/lib/report-sanitizer');
const { startAssessmentRetentionJob, resolveAssessmentTtlMs } = require('../../lib/assessment-retention');
const { validateRepoUrl, resolveDefaultAllowedRoots, assertSafeProjectPath } = require('../../lib/path-safety');
const { toClientError } = require('../../lib/client-error');

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.join(__dirname, '../../..');

class AssessmentController {
  constructor() {
    this.assessmentsDir = path.join(PROJECT_ROOT, 'assessments');
    if (process.env.ASSESSMENT_RETENTION_ENABLED !== 'false') {
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
      const { repoUrl, company, email, assessmentType, projectPath: bodyPath } = req.body || {};
      const isAuthenticated = Boolean(req.user?.id || req.user?.email);

      if (!isAuthenticated && bodyPath) {
        return res.status(403).json({
          success: false,
          error: 'projectPath requires sign-in; use repoUrl for public assessments'
        });
      }
      if (!isAuthenticated && !repoUrl) {
        return res.status(400).json({
          success: false,
          error: 'repoUrl is required for public assessments'
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
        projectPath = assertSafeProjectPath(String(bodyPath), allowedRoots, 'projectPath');
      }

      const scanResult = sanitizeScanReport(await this.runSimplebeaconScan(projectPath));
      const assessment = buildAssessmentReport(scanResult, {
        company: company || 'Unknown',
        assessor: 'Simplebeacon AI',
        projectRoot: projectPath,
        commandsRun: [
          `node packages/simplebeacon-cli/bin/simplebeacon.js scan --path "${projectPath}" --format json --output .simplebeacon/report.json --gate`,
          `node packages/simplebeacon-cli/bin/simplebeacon.js assess --path "${projectPath}" --company "${company || 'Unknown'}"`
        ]
      });

      assessment.metadata = {
        assessmentId,
        company,
        email,
        assessmentType,
        createdAt: new Date().toISOString(),
        repoUrl: repoUrl || null,
        projectPath: repoUrl ? '[cloned-repo-redacted]' : projectPath,
        expiresAt: new Date(Date.now() + resolveAssessmentTtlMs()).toISOString()
      };

      if (repoUrl) {
        await this.removeClonedSource(assessmentDir);
      }

      const assessmentPath = path.join(assessmentDir, 'assessment.json');
      await fsp.writeFile(assessmentPath, `${JSON.stringify(assessment, null, 2)}\n`, 'utf8');

      const findings = assessment.findings || {};
      const totalFindings = Object.values(findings).reduce(
        (sum, cat) => sum + (typeof cat === 'object' && cat?.findings != null ? cat.findings : 0),
        0
      );

      res.json({
        success: true,
        assessmentId,
        reportUrl: `/api/assessment/report/${assessmentId}`,
        summary: {
          executiveSummary: assessment.executiveSummary,
          complianceChecklist: assessment.complianceChecklist?.summary,
          totalFindings,
          status: 'completed'
        }
      });
    } catch (error) {
      console.error('[Assessment] create error:', error.message);
      const status = /required|invalid|outside allowed|does not exist/i.test(error.message) ? 400 : 500;
      res.status(status).json({ success: false, error: toClientError(error, 'Assessment failed') });
    }
  }

  async getAssessment(req, res) {
    try {
      const assessmentId = this.resolveAssessmentId(req);
      const assessment = await this.readAssessment(assessmentId);
      res.json({ success: true, assessmentId, assessment });
    } catch {
      res.status(404).json({ success: false, error: 'Assessment not found' });
    }
  }

  async downloadAssessment(req, res) {
    try {
      const assessmentId = this.resolveAssessmentId(req);
      const { format } = req.params;
      const assessmentPath = path.join(this.assessmentsDir, assessmentId, 'assessment.json');
      const assessmentData = await fsp.readFile(assessmentPath, 'utf8');

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${assessmentId}.json"`);
        return res.send(assessmentData);
      }

      res.json(JSON.parse(assessmentData));
    } catch {
      res.status(404).json({ success: false, error: 'Assessment not found' });
    }
  }

  async readAssessment(assessmentId) {
    const assessmentPath = path.join(this.assessmentsDir, assessmentId, 'assessment.json');
    const assessmentData = await fsp.readFile(assessmentPath, 'utf8');
    return JSON.parse(assessmentData);
  }

  async cloneRepo(repoUrl, targetDir) {
    const safeUrl = validateRepoUrl(repoUrl);
    const cloneInto = path.join(targetDir, 'repo');
    await fsp.mkdir(cloneInto, { recursive: true });
    await execFileAsync('git', ['clone', '--depth', '1', safeUrl, cloneInto], {
      cwd: PROJECT_ROOT,
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024
    });
    return cloneInto;
  }

  async removeClonedSource(assessmentDir) {
    const repoPath = path.join(assessmentDir, 'repo');
    if (fs.existsSync(repoPath)) {
      await fsp.rm(repoPath, { recursive: true, force: true });
    }
  }

  async runSimplebeaconScan(projectPath) {
    const resolvedPath = path.resolve(projectPath);
    const { platformRoot } = resolvePlatformRoot(resolvedPath);
    const config = loadSimplebeaconConfig(platformRoot);
    const report = await runScan(resolvedPath, { config, configPath: config.configPath });
    const gateResult = evaluateGate(report, config.gate);
    const formatted = formatJsonReport(report, gateResult);

    const reportOut = path.join(resolvedPath, '.simplebeacon', 'report.json');
    await fsp.mkdir(path.dirname(reportOut), { recursive: true });
    await fsp.writeFile(reportOut, `${JSON.stringify(formatted, null, 2)}\n`, 'utf8');

    return formatted;
  }
}

module.exports = new AssessmentController();
