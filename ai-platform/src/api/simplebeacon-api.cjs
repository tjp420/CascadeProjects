/**
 * Simplebeacon dashboard API — serves scan report, baseline, config, and scan trigger.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const { validateConfig } = require('../../packages/simplebeacon-cli/src/config-schema');
const {
  PROFILE_RULES,
  DEFAULT_MOCK_SCAN_RELATIVE_PATHS,
  DEFAULT_CONFIG
} = require('../../packages/simplebeacon-cli/src/config');
const {
  buildFictionPatternCatalog,
  countFictionIssues
} = require('../../packages/simplebeacon-cli/src/rules/ai-fiction-detection');
const {
  buildDashboardPayload,
  buildScanResults,
  buildAuditPayload,
  findHistoryEntry
} = require('../../packages/simplebeacon-cli/src/lib/dashboard-payload');
const { buildAssessmentReport } = require('../../packages/simplebeacon-cli/src/assessment');
const {
  readScanProgress,
  resolveScanProgressPath
} = require('../../packages/simplebeacon-cli/src/lib/scan-progress');
const { runNpmAudit } = require('../../server/lib/npm-audit-runner.cjs');
const {
  resolveDefaultAllowedRoots,
  assertSafeProjectPath
} = require('../../server/lib/path-safety.cjs');
const { resolvePlatformRoot } = require('../../packages/simplebeacon-cli/src/project-detect');
const { createRequireSubscription } = require('../../server/middleware/simplebeacon-subscription.cjs');
const {
  getUserAiKeysPublic,
  saveUserAiKeys,
  clearUserAiKeys
} = require('../../server/lib/user-ai-keys-store.cjs');

const PROJECT_ROOT = path.join(__dirname, '../..');
const MONOREPO_ROOT = path.join(PROJECT_ROOT, '..');

function getAnalyzeAllowedRoots() {
  return resolveDefaultAllowedRoots(PROJECT_ROOT, { monorepoRoot: MONOREPO_ROOT });
}
const SIMPLEBEACON_DIR = path.join(PROJECT_ROOT, '.simplebeacon');
const REPORT_PATH = path.join(SIMPLEBEACON_DIR, 'report.json');
const BASELINE_PATH = path.join(SIMPLEBEACON_DIR, 'baseline.json');
const CONFIG_PATH = path.join(SIMPLEBEACON_DIR, 'config.json');
const HISTORY_PATH = path.join(SIMPLEBEACON_DIR, 'history.json');
const ASSESSMENT_PATH = path.join(SIMPLEBEACON_DIR, 'assessment.json');
const AUDIT_SAMPLE_FILES = {
  fictionPatterns: 'fictional-patterns-sample.json',
  qualityMetrics: 'ai-quality-metrics-sample.json',
  baselineComparison: 'baseline-comparison-sample.json',
  adoptionTrends: 'ai-adoption-trends-sample.json'
};

async function readJson(filePath, fallback = null) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    if (fallback !== null) return fallback;
    throw err;
  }
}

function resolveSafeAnalyzePath(rawPath) {
  if (!rawPath) return null;
  return assertSafeProjectPath(String(rawPath), getAnalyzeAllowedRoots());
}

function resolveReportFilePath(projectPath) {
  if (!projectPath) return REPORT_PATH;
  const direct = path.join(projectPath, '.simplebeacon', 'report.json');
  if (fs.existsSync(direct)) return direct;

  const projectResolved = path.resolve(projectPath);
  const platformResolved = path.resolve(PROJECT_ROOT);
  if (projectResolved !== platformResolved
    && platformResolved.startsWith(projectResolved + path.sep)
    && fs.existsSync(REPORT_PATH)) {
    return REPORT_PATH;
  }

  try {
    const { platformRoot } = resolvePlatformRoot(projectResolved);
    const nested = path.join(platformRoot, '.simplebeacon', 'report.json');
    if (fs.existsSync(nested)) return nested;
  } catch {
    /* fall through */
  }
  return direct;
}

async function appendHistory(report) {
  const entry = {
    scanId: crypto.randomUUID(),
    date: report.generatedAt || new Date().toISOString(),
    issueCount: report.issueCount ?? 0,
    qualityScore: report.qualityScore ?? 0,
    gatePass: report.gate?.pass ?? false,
    severityCounts: report.severityCounts || {},
    fictionPatternsFound: countFictionIssues(report),
    totalFilesScanned: report.filesAnalyzed ?? report.totalFiles ?? 0
  };

  let history = [];
  try {
    history = await readJson(HISTORY_PATH, []);
  } catch {
    history = [];
  }

  const last = history[history.length - 1];
  if (last && last.date === entry.date && last.issueCount === entry.issueCount) {
    return history;
  }

  history.push(entry);
  if (history.length > 30) {
    history = history.slice(-30);
  }

  await fs.promises.mkdir(SIMPLEBEACON_DIR, { recursive: true });
  await fs.promises.writeFile(HISTORY_PATH, JSON.stringify(history, null, 2));
  return history;
}

async function ensureHistoryFromReport() {
  const report = await readJson(REPORT_PATH);
  return appendHistory(report);
}

async function loadDashboardContext() {
  const [report, baseline, history] = await Promise.all([
    readJson(REPORT_PATH),
    readJson(BASELINE_PATH),
    readJson(HISTORY_PATH, []).catch(() => [])
  ]);

  let resolvedHistory = history;
  if (!resolvedHistory?.length) {
    resolvedHistory = await ensureHistoryFromReport();
  }

  const fictionCatalog = buildFictionPatternCatalog(baseline);
  return { report, baseline, history: resolvedHistory, fictionCatalog };
}

async function loadAssessment(report) {
  try {
    return await readJson(ASSESSMENT_PATH);
  } catch {
    return buildAssessmentReport(report, {
      company: 'Cascade AI Platform',
      projectRoot: report.projectRoot || PROJECT_ROOT
    });
  }
}

async function loadAuditPageSamples() {
  const dataDir = path.join(PROJECT_ROOT, 'web', 'data');
  const samples = {};
  for (const [key, fileName] of Object.entries(AUDIT_SAMPLE_FILES)) {
    const filePath = path.join(dataDir, fileName);
    try {
      samples[key] = await readJson(filePath);
    } catch {
      samples[key] = null;
    }
  }
  return samples;
}

async function loadAuditContext(options = {}) {
  const context = await loadDashboardContext();
  const assessment = await loadAssessment(context.report);
  const pageSamples = await loadAuditPageSamples();
  let npmAudit = null;
  if (options.includeNpmAudit) {
    try {
      npmAudit = runNpmAudit(PROJECT_ROOT, { force: options.forceNpmAudit });
    } catch (err) {
      npmAudit = { error: err.message };
    }
  }
  return { ...context, assessment, pageSamples, npmAudit };
}

async function runSimplebeaconScan(projectPath) {
  const cliBin = path.join(PROJECT_ROOT, 'packages/simplebeacon-cli/bin/simplebeacon.js');
  const reportOut = projectPath
    ? path.join(projectPath, '.simplebeacon', 'report.json')
    : REPORT_PATH;

  if (projectPath) {
    await fs.promises.mkdir(path.dirname(reportOut), { recursive: true });
  }

  // Do not pass --gate: CLI exit 1 on gate FAIL would abort the API even when the report was written.
  const scanCmd = projectPath
    ? 'node "' + cliBin + '" scan --path "' + projectPath + '" --format json --output "' + reportOut + '"'
    : 'node "' + cliBin + '" scan --format json --output "' + REPORT_PATH + '"';

  let stdout = '';
  let stderr = '';
  let cliExitCode = 0;
  try {
    const result = await execAsync(scanCmd, {
      cwd: PROJECT_ROOT,
      timeout: 120000,
      env: { ...process.env, FORCE_COLOR: '0' }
    });
    stdout = result.stdout || '';
    stderr = result.stderr || '';
  } catch (err) {
    stdout = err.stdout || '';
    stderr = err.stderr || '';
    cliExitCode = typeof err.code === 'number' ? err.code : 1;
    const reportExists = fs.existsSync(projectPath ? reportOut : REPORT_PATH);
    if (!reportExists) {
      err.stdout = stdout;
      err.stderr = stderr;
      throw err;
    }
  }

  const report = await readJson(projectPath ? reportOut : REPORT_PATH);
  const history = await appendHistory(report);

  return {
    report,
    history,
    projectPath: projectPath || PROJECT_ROOT,
    stdout: stdout.slice(-2000),
    stderr: stderr.slice(-500),
    scanId: history[history.length - 1]?.scanId || null,
    gateFailed: report.gate?.pass === false || cliExitCode !== 0,
    cliExitCode
  };
}

function setupSimplebeaconAPI(app, options = {}) {
  const requirePaid = options.requirePaid || createRequireSubscription();
  const requirePaidWithQuota = options.requirePaidWithQuota || createRequireSubscription({ consumeQuota: true });

  function requireUserAccount(req, res, next) {
    if (!req.user?.email) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    next();
  }

  app.get('/api/simplebeacon/report', requirePaid, async (req, res) => {
    try {
      let projectPath = null;
      if (req.query.projectPath) {
        try {
          projectPath = resolveSafeAnalyzePath(req.query.projectPath);
        } catch (err) {
          return res.status(400).json({ success: false, error: err.message });
        }
      }
      const reportPath = resolveReportFilePath(projectPath);
      const report = await readJson(reportPath);
      res.json(report);
    } catch (err) {
      res.status(404).json({ error: 'Report not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/baseline', async (_req, res) => {
    try {
      const baseline = await readJson(BASELINE_PATH);
      let report = null;
      try {
        report = await readJson(REPORT_PATH);
      } catch {
        report = null;
      }
      const enriched = { ...baseline };
      if (report?.pageSampleSchemaChecked != null) {
        enriched.pageSamplesLabel = `${report.pageSampleSchemaPassed ?? 0}/${report.pageSampleSchemaChecked}`;
      }
      if (!enriched.jestTestsLabel && report?.jestSummary?.testsTotal != null) {
        enriched.jestTestsLabel = `${report.jestSummary.testsPassed ?? 0}/${report.jestSummary.testsTotal}`;
        enriched.jestSuites = report.jestSummary.suitesPassed ?? enriched.jestSuites;
      }
      res.json(enriched);
    } catch (err) {
      res.status(404).json({ error: 'Baseline not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/config/presets', async (_req, res) => {
    try {
      const presets = {};
      for (const profile of ['minimal', 'standard', 'cascade']) {
        presets[profile] = {
          profile,
          scanPaths: [...DEFAULT_MOCK_SCAN_RELATIVE_PATHS],
          productionPaths: profile === 'minimal'
            ? ['server/', 'src/']
            : [...(DEFAULT_CONFIG.productionPaths || ['server/'])],
          sampleDir: DEFAULT_CONFIG.sampleDir,
          rules: JSON.parse(JSON.stringify(PROFILE_RULES[profile] || PROFILE_RULES.standard)),
          gate: { failOn: ['high'], warnOn: ['medium', 'low'] }
        };
      }
      res.json({ success: true, presets });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load presets', message: err.message });
    }
  });

  app.get('/api/simplebeacon/config', async (_req, res) => {
    try {
      const config = await readJson(CONFIG_PATH);
      res.json(config);
    } catch (err) {
      res.status(404).json({ error: 'Config not found', message: err.message });
    }
  });

  app.put('/api/simplebeacon/config', requirePaid, async (req, res) => {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ error: 'Invalid config', message: 'Request body must be a JSON object' });
    }

    let existing = {};
    try {
      existing = await readJson(CONFIG_PATH);
    } catch {
      existing = {};
    }

    const merged = mergeConfig(existing, incoming);
    const validation = validateConfig(merged);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid config',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    try {
      await fs.promises.mkdir(SIMPLEBEACON_DIR, { recursive: true });
      await fs.promises.writeFile(CONFIG_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
      res.json({
        success: true,
        config: merged,
        warnings: validation.warnings
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to write config', message: err.message });
    }
  });

  app.get('/api/simplebeacon/user/ai-keys', requireUserAccount, async (req, res) => {
    try {
      const email = req.user?.email;
      if (!email) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const keys = await getUserAiKeysPublic(email);
      res.json({ success: true, ...keys });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/simplebeacon/user/ai-keys', requireUserAccount, async (req, res) => {
    try {
      const email = req.user?.email;
      if (!email) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const keys = await saveUserAiKeys(email, body);
      res.json({ success: true, ...keys });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/simplebeacon/user/ai-keys', requireUserAccount, async (req, res) => {
    try {
      const email = req.user?.email;
      if (!email) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const keys = await clearUserAiKeys(email);
      res.json({ success: true, ...keys });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/simplebeacon/history', requirePaid, async (_req, res) => {
    try {
      let history = await readJson(HISTORY_PATH, null);
      if (!history) {
        history = await ensureHistoryFromReport();
      }
      res.json(history);
    } catch {
      res.json([]);
    }
  });

  app.get('/api/simplebeacon/dashboard', requirePaid, async (_req, res) => {
    try {
      const context = await loadDashboardContext();
      res.json(buildDashboardPayload(context));
    } catch (err) {
      res.status(404).json({ error: 'Dashboard not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/results/:scanId', requirePaid, async (req, res) => {
    try {
      const context = await loadDashboardContext();
      const entry = findHistoryEntry(context.history, req.params.scanId);
      if (!entry) {
        return res.status(404).json({ error: 'Scan not found', scanId: req.params.scanId });
      }
      res.json(buildScanResults(context.report, entry, context.baseline));
    } catch (err) {
      res.status(404).json({ error: 'Results not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/assessment', requirePaid, async (_req, res) => {
    try {
      const context = await loadDashboardContext();
      const assessment = await loadAssessment(context.report);
      res.json(assessment);
    } catch (err) {
      res.status(404).json({ error: 'Assessment not found', message: err.message });
    }
  });

  app.post('/api/simplebeacon/assess', requirePaidWithQuota, async (_req, res) => {
    try {
      const context = await loadDashboardContext();
      const assessment = buildAssessmentReport(context.report, {
        company: 'Cascade AI Platform',
        projectRoot: context.report.projectRoot || PROJECT_ROOT
      });
      await fs.promises.mkdir(SIMPLEBEACON_DIR, { recursive: true });
      await fs.promises.writeFile(ASSESSMENT_PATH, `${JSON.stringify(assessment, null, 2)}\n`, 'utf8');
      res.json({ success: true, assessment });
    } catch (err) {
      res.status(500).json({ error: 'Assessment failed', message: err.message });
    }
  });

  app.get('/api/simplebeacon/audit', requirePaid, async (req, res) => {
    try {
      const includeNpm = req.query.npmAudit === '1' || req.query.npmAudit === 'true';
      const context = await loadAuditContext({ includeNpmAudit: includeNpm });
      res.json(buildAuditPayload(context, {
        assessment: context.assessment,
        npmAudit: context.npmAudit,
        pageSamples: context.pageSamples
      }));
    } catch (err) {
      res.status(404).json({ error: 'Audit not found', message: err.message });
    }
  });

  app.post('/api/simplebeacon/npm-audit', requirePaidWithQuota, async (_req, res) => {
    try {
      const npmAudit = runNpmAudit(PROJECT_ROOT, { force: true });
      res.json({ success: true, ...npmAudit });
    } catch (err) {
      res.status(500).json({ error: 'npm audit failed', message: err.message });
    }
  });

  app.get('/api/ai-validation/audit', requirePaid, async (req, res) => {
    try {
      const includeNpm = req.query.npmAudit === '1' || req.query.npmAudit === 'true';
      const context = await loadAuditContext({ includeNpmAudit: includeNpm });
      res.json(buildAuditPayload(context, {
        assessment: context.assessment,
        npmAudit: context.npmAudit,
        pageSamples: context.pageSamples
      }));
    } catch (err) {
      res.status(404).json({ error: 'Audit not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/scan/progress', requirePaid, async (req, res) => {
    try {
      let projectPath = PROJECT_ROOT;
      if (req.query.projectPath) {
        projectPath = resolveSafeAnalyzePath(req.query.projectPath);
      }
      const progressPath = resolveScanProgressPath(projectPath);
      const progress = readScanProgress(progressPath);
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, progress });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err.message,
        progress: { active: false }
      });
    }
  });

  app.post('/api/simplebeacon/scan', requirePaidWithQuota, async (req, res) => {
    let projectPath = null;
    try {
      if (req.body?.projectPath) {
        projectPath = resolveSafeAnalyzePath(req.body.projectPath);
      }
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    try {
      const result = await runSimplebeaconScan(projectPath);
      res.json({
        success: true,
        scanId: result.scanId,
        status: result.gateFailed ? 'gate_review' : 'completed',
        gateFailed: Boolean(result.gateFailed),
        message: result.gateFailed
          ? 'Simplebeacon scan complete — gate review (report written)'
          : 'Simplebeacon scan complete',
        ...result
      });
    } catch (err) {
      const reportOut = projectPath
        ? path.join(projectPath, '.simplebeacon', 'report.json')
        : REPORT_PATH;
      const reportExists = fs.existsSync(reportOut);
      if (reportExists) {
        try {
          const report = await readJson(reportOut);
          const history = await appendHistory(report);
          return res.json({
            success: true,
            scanId: history[history.length - 1]?.scanId || null,
            status: 'gate_review',
            gateFailed: true,
            message: 'Simplebeacon scan complete — gate review (recovered from CLI exit)',
            report,
            history,
            projectPath: projectPath || PROJECT_ROOT,
            stdout: err.stdout?.slice(-2000),
            stderr: err.stderr?.slice(-500),
            cliExitCode: err.code
          });
        } catch (recoverErr) {
          return res.status(recoverErr.killed ? 504 : 500).json({
            error: 'Scan failed',
            message: recoverErr.message,
            stdout: recoverErr.stdout?.slice(-2000),
            stderr: recoverErr.stderr?.slice(-500),
            partialReport: null
          });
        }
      }
      res.status(err.killed ? 504 : 500).json({
        error: 'Scan failed',
        message: err.message,
        stdout: err.stdout?.slice(-2000),
        stderr: err.stderr?.slice(-500),
        partialReport: reportExists ? await readJson(reportOut).catch(() => null) : null
      });
    }
  });

  app.get('/api/ai-validation/dashboard', requirePaid, async (_req, res) => {
    try {
      const context = await loadDashboardContext();
      res.json(buildDashboardPayload(context));
    } catch (err) {
      res.status(404).json({ error: 'Dashboard not found', message: err.message });
    }
  });

  app.get('/api/ai-validation/results/:scanId', requirePaid, async (req, res) => {
    try {
      const context = await loadDashboardContext();
      const entry = findHistoryEntry(context.history, req.params.scanId);
      if (!entry) {
        return res.status(404).json({ error: 'Scan not found', scanId: req.params.scanId });
      }
      res.json(buildScanResults(context.report, entry, context.baseline));
    } catch (err) {
      res.status(404).json({ error: 'Results not found', message: err.message });
    }
  });

  app.post('/api/ai-validation/scan', requirePaidWithQuota, async (req, res) => {
    let projectPath = null;
    try {
      if (req.body?.projectPath) {
        projectPath = resolveSafeAnalyzePath(req.body.projectPath);
      }
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    try {
      const result = await runSimplebeaconScan(projectPath);
      res.json({
        scanId: result.scanId,
        status: 'completed',
        message: 'Scanning for AI-generated fiction patterns... complete',
        report: result.report,
        history: result.history
      });
    } catch (err) {
      res.status(err.killed ? 504 : 500).json({
        error: 'Scan failed',
        message: err.message,
        stdout: err.stdout?.slice(-2000),
        stderr: err.stderr?.slice(-500)
      });
    }
  });

  app.post('/api/simplebeacon/tools/baseline-sync', requirePaidWithQuota, async (_req, res) => {
    try {
      const { syncMeasuredBaseline } = require('../../packages/simplebeacon-cli/src/baseline-sync');
      const result = await syncMeasuredBaseline(PROJECT_ROOT);
      res.json({
        success: true,
        baseline: result.baseline,
        baselinePath: result.baselinePath,
        pageSamplesLabel: result.pageSamplesLabel ?? result.baseline?.pageSamplesLabel ?? null,
        jestSynced: Boolean(result.jestSynced),
        note: result.jestNote || null
      });
    } catch (err) {
      const message = err.message || 'Baseline sync failed';
      const clientError = /Jest is not configured|Could not parse Jest summary|Jest reported failures/i.test(message);
      res.status(clientError ? 400 : 500).json({
        success: false,
        error: 'Baseline sync failed',
        message
      });
    }
  });

  app.get('/api/simplebeacon/summary', requirePaid, async (_req, res) => {
    try {
      const [report, baseline, config] = await Promise.all([
        readJson(REPORT_PATH),
        readJson(BASELINE_PATH),
        readJson(CONFIG_PATH)
      ]);
      res.json({
        report,
        baseline,
        config,
        metrics: {
          qualityScore: report.qualityScore,
          schemaCompliance: report.schemaCompliance,
          consistencyScore: report.consistencyScore,
          gatePass: report.gate?.pass,
          jestTestsLabel: baseline.jestTestsLabel
            || (report?.jestSummary?.testsTotal != null
              ? `${report.jestSummary.testsPassed ?? 0}/${report.jestSummary.testsTotal}`
              : null),
          pageSamplesLabel: report?.pageSampleSchemaChecked != null
            ? `${report.pageSampleSchemaPassed ?? 0}/${report.pageSampleSchemaChecked}`
            : baseline.pageSamplesLabel,
          totalFiles: report.totalFiles,
          issueCount: report.issueCount,
          severityCounts: report.severityCounts
        }
      });
    } catch (err) {
      res.status(404).json({ error: 'Summary not found', message: err.message });
    }
  });

  app.post('/api/simplebeacon/cloud-scan', requirePaidWithQuota, async (req, res) => {
    const report = req.body?.report;
    if (!report || typeof report !== 'object') {
      return res.status(400).json({ error: 'report object is required' });
    }

    try {
      const history = await appendHistory(report);
      res.json({
        success: true,
        scanId: history[history.length - 1]?.scanId || null,
        message: 'Scan uploaded to Simplebeacon cloud'
      });
    } catch (err) {
      res.status(500).json({ error: 'upload_failed', message: err.message });
    }
  });

  app.get('/simplebeacon-dashboard', (_req, res) => {
    res.redirect('/simplebeacon-dashboard/index.html');
  });

  setupSimplebeaconDemoAPI(app);
}

const DEMO_DIR = path.join(PROJECT_ROOT, 'data', 'simplebeacon-demo');

async function loadDemoContext() {
  const [report, baseline, history] = await Promise.all([
    readJson(path.join(DEMO_DIR, 'report.json')),
    readJson(path.join(DEMO_DIR, 'baseline.json')),
    readJson(path.join(DEMO_DIR, 'history.json'), [])
  ]);
  const fictionCatalog = buildFictionPatternCatalog(baseline);
  return { report, baseline, history, fictionCatalog };
}

function demoReadonly(_req, res) {
  return res.status(403).json({
    error: 'demo_readonly',
    message: 'Demo dashboard is read-only. Run npx simplebeacon locally or sign in at /app for your workspace.'
  });
}

function setupSimplebeaconDemoAPI(app) {
  app.get('/api/simplebeacon/demo/report', async (_req, res) => {
    try {
      const report = await readJson(path.join(DEMO_DIR, 'report.json'));
      res.json(report);
    } catch (err) {
      res.status(404).json({ error: 'Demo report not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/demo/baseline', async (_req, res) => {
    try {
      res.json(await readJson(path.join(DEMO_DIR, 'baseline.json')));
    } catch (err) {
      res.status(404).json({ error: 'Demo baseline not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/demo/config', async (_req, res) => {
    try {
      res.json(await readJson(path.join(DEMO_DIR, 'config.json')));
    } catch (err) {
      res.status(404).json({ error: 'Demo config not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/demo/history', async (_req, res) => {
    try {
      res.json(await readJson(path.join(DEMO_DIR, 'history.json'), []));
    } catch {
      res.json([]);
    }
  });

  app.get('/api/simplebeacon/demo/dashboard', async (_req, res) => {
    try {
      const context = await loadDemoContext();
      res.json(buildDashboardPayload(context));
    } catch (err) {
      res.status(404).json({ error: 'Demo dashboard not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/demo/results/:scanId', async (req, res) => {
    try {
      const context = await loadDemoContext();
      const entry = findHistoryEntry(context.history, req.params.scanId);
      if (!entry) {
        return res.status(404).json({ error: 'Scan not found', scanId: req.params.scanId });
      }
      res.json(buildScanResults(context.report, entry, context.baseline));
    } catch (err) {
      res.status(404).json({ error: 'Demo results not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/demo/assessment', async (_req, res) => {
    try {
      const context = await loadDemoContext();
      const assessment = buildAssessmentReport(context.report, {
        company: 'Acme Corp (demo honey-pot)',
        projectRoot: context.report.projectRoot || '/demo/toxic-honeypot'
      });
      res.json(assessment);
    } catch (err) {
      res.status(404).json({ error: 'Demo assessment not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/demo/audit', async (_req, res) => {
    try {
      const context = await loadDemoContext();
      const assessment = buildAssessmentReport(context.report, {
        company: 'Acme Corp (demo honey-pot)',
        projectRoot: context.report.projectRoot || '/demo/toxic-honeypot'
      });
      res.json(buildAuditPayload(
        { ...context, assessment, pageSamples: {}, npmAudit: null },
        { assessment, npmAudit: null, pageSamples: {} }
      ));
    } catch (err) {
      res.status(404).json({ error: 'Demo audit not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/demo/config/presets', async (_req, res) => {
    res.json({ success: true, presets: {} });
  });

  const block = ['scan', 'assess', 'npm-audit', 'cloud-scan'];
  for (const action of block) {
    app.post(`/api/simplebeacon/demo/${action}`, demoReadonly);
  }
  app.put('/api/simplebeacon/demo/config', demoReadonly);
  app.post('/api/simplebeacon/demo/tools/baseline-sync', demoReadonly);

  const { registerOutreachRoutes } = require('../../server/lib/outreach-route.cjs');
  registerOutreachRoutes(app, {
    dataDir: path.join(PROJECT_ROOT, 'data'),
    prefixes: ['/api/simplebeacon/outreach']
  });
}

function mergeConfig(existing, incoming) {
  const merged = { ...existing, ...incoming };

  if (existing.rules || incoming.rules) {
    merged.rules = { ...(existing.rules || {}) };
    for (const [name, rule] of Object.entries(incoming.rules || {})) {
      merged.rules[name] = { ...(existing.rules?.[name] || {}), ...rule };
    }
  }

  if (existing.gate || incoming.gate) {
    merged.gate = { ...(existing.gate || {}), ...(incoming.gate || {}) };
  }

  return merged;
}

module.exports = setupSimplebeaconAPI;
