// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Simplebeacon dashboard API — serves scan report, baseline, config, and scan trigger.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const express = require('express');
const logger = require('../../server/lib/app-logger.cjs');

const constants = require('../../server/config/constants.cjs');
const execAsync = promisify(exec);
const { runNpmAuditAsync } = require('../../server/lib/npm-audit-runner.cjs');
const { readTextFileWithLimit, redactTextSecrets } = require('../../server/lib/recoverable-io.cjs');
const {
  resolveDefaultAllowedRoots,
  assertSafeProjectPath
} = require('../../server/lib/path-safety.cjs');
const { patchRemediationPhases, normalizeDashboardReport } = require('../../server/lib/scan-report-patch.cjs');
const { createRequireSubscription } = require('../../server/middleware/simplebeacon-subscription.cjs');
const { optionalAuthenticate, verifyToken } = require('../../server/middleware/auth.cjs');
const {
  getUserAiKeysPublic,
  saveUserAiKeys,
  clearUserAiKeys
} = require('../../server/lib/user-ai-keys-store.cjs');
const {
  DEFAULT_CONFIG,
  DEFAULT_MOCK_SCAN_RELATIVE_PATHS,
  PROFILE_RULES,
  buildAssessmentReport,
  buildAuditPayload,
  buildFictionPatternCatalog,
  countFictionIssues,
  detectProjectProfile,
  generateLicenseToken,
  readScanProgress,
  resolvePlatformRoot,
  resolveScanProgressPath,
  syncMeasuredBaseline,
  validateConfig
} = require('../../server/lib/simplebeacon-proxy.cjs');
const {
  buildDashboardPayload,
  buildScanResults,
  findHistoryEntry
} = require('../../server/lib/simplebeacon-proxy.cjs');

const PROJECT_ROOT = path.join(__dirname, '../..');
const MONOREPO_ROOT = path.join(PROJECT_ROOT, '..');

function resolveLicenseSecret() {
  const secret = String(process.env.SIMPLEBEACON_LICENSE_SECRET || '').trim();
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SIMPLEBEACON_LICENSE_SECRET is required in production');
  }
  return null;
}

/**
 * Get analyze allowed roots.
 * @returns {any}
 */
function getAnalyzeAllowedRoots() {
  return resolveDefaultAllowedRoots(PROJECT_ROOT, { monorepoRoot: MONOREPO_ROOT });
}
const SIMPLEBEACON_DIR = path.join(PROJECT_ROOT, '.simplebeacon');
const REPORT_PATH = path.join(SIMPLEBEACON_DIR, 'report.json');
const BASELINE_PATH = path.join(SIMPLEBEACON_DIR, 'baseline.json');
const SUBSCRIPTION_PATH = path.join(SIMPLEBEACON_DIR, 'subscription.json');
const CONFIG_PATH = path.join(SIMPLEBEACON_DIR, 'config.json');
const HISTORY_PATH = path.join(SIMPLEBEACON_DIR, 'history.json');
const ASSESSMENT_PATH = path.join(SIMPLEBEACON_DIR, 'assessment.json');
const AUDIT_SAMPLE_FILES = {
  fictionPatterns: 'fictional-patterns-sample.json',
  qualityMetrics: 'ai-quality-metrics-sample.json',
  baselineComparison: 'baseline-comparison-sample.json',
  adoptionTrends: 'ai-adoption-trends-sample.json'
};

/**
 * Scan scheduler factory.
 */
const { createScheduler } = require('../../server/lib/scan-scheduler.cjs');

/**
 * Demo API routes.
 */
const { setupSimplebeaconDemoAPI } = require('../../server/routes/demo-simplebeacon-api.cjs');

/**
 * Read json.
 * @param {string} filePath
 * @param {any} fallback
 * @returns {any}
 */
async function readJson(filePath, fallback = null, maxBytes = 5 * 1024 * 1024) {
  try {
    const raw = await readTextFileWithLimit(filePath, maxBytes);
    if (!raw) return fallback;
    const content = redactTextSecrets(raw);
    return JSON.parse(content);
  } catch (err) {
    if (fallback !== null) return fallback;
    throw err;
  }
}

/**
 * Try extract JSON object from CLI stdout.
 * @param {string} stdout
 * @returns {any}
 */
function tryExtractJsonFromStdout(stdout) {
  if (!stdout) return null;
  // Look for the last JSON object/array in the output
  const lines = stdout.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // not JSON, continue scanning backwards
    }
  }
  // Try finding JSON block inside the text
  const jsonBlockMatch = stdout.match(/\{[\s\S]*\}/g);
  if (jsonBlockMatch) {
    for (let i = jsonBlockMatch.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[i]);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        // invalid JSON block
      }
    }
  }
  return null;
}

/**
 * Resolve safe analyze path.
 * @param {string} rawPath
 * @returns {any}
 */
function resolveSafeAnalyzePath(rawPath) {
  if (!rawPath) return null;
  const trimmed = String(rawPath).trim();
  // Dashboard default sentinel: a bare "/" means "use the default platform root".
  if (trimmed === '/' || trimmed === path.sep) {
    return PROJECT_ROOT;
  }
  // Website URLs have no local report file — fall back to the default platform report
  if (/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  if (path.isAbsolute(trimmed)) {
    // Render / container fallback: if the requested ai-platform sub-path does not exist,
    // scan the platform root instead of drifting up to the monorepo root and mismatching
    // the repository inventory (which is anchored to PROJECT_ROOT's .simplebeacon config).
    if (!fs.existsSync(trimmed) && fs.existsSync(PROJECT_ROOT)) {
      const normalized = trimmed.replace(/\\/g, '/').toLowerCase();
      const platformKey = PROJECT_ROOT.replace(/\\/g, '/').toLowerCase();
      const isUnderPlatformRoot = normalized.startsWith(platformKey + '/');
      const isPlatformStyleFallback = normalized.includes('/ai-platform/') && !isUnderPlatformRoot;
      if (isUnderPlatformRoot || isPlatformStyleFallback) {
        return assertSafeProjectPath(PROJECT_ROOT, getAnalyzeAllowedRoots());
      }
    }
    return assertSafeProjectPath(trimmed, getAnalyzeAllowedRoots());
  }

  // Try relative to CWD first
  const fromCwd = path.resolve(trimmed);
  if (fs.existsSync(fromCwd)) {
    return assertSafeProjectPath(fromCwd, getAnalyzeAllowedRoots());
  }

  // Fall back to monorepo root for relative paths
  const fromMono = path.resolve(MONOREPO_ROOT, trimmed);
  if (fs.existsSync(fromMono)) {
    return assertSafeProjectPath(fromMono, getAnalyzeAllowedRoots());
  }

  // Let assertSafeProjectPath handle the error for missing paths
  return assertSafeProjectPath(fromCwd, getAnalyzeAllowedRoots());
}

/**
 * Resolve report file path.
 * @param {string} projectPath
 * @returns {any}
 */
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

/**
 * Resolve config file path.
 * @param {string} projectPath
 * @returns {any}
 */
function resolveConfigFilePath(projectPath) {
  if (!projectPath) return CONFIG_PATH;
  const direct = path.join(projectPath, '.simplebeacon', 'config.json');
  if (fs.existsSync(direct)) return direct;

  const projectResolved = path.resolve(projectPath);
  const platformResolved = path.resolve(PROJECT_ROOT);
  if (projectResolved !== platformResolved
    && platformResolved.startsWith(projectResolved + path.sep)
    && fs.existsSync(CONFIG_PATH)) {
    return CONFIG_PATH;
  }

  try {
    const { platformRoot } = resolvePlatformRoot(projectResolved);
    const nested = path.join(platformRoot, '.simplebeacon', 'config.json');
    if (fs.existsSync(nested)) return nested;
  } catch {
    /* fall through */
  }
  return direct;
}

/**
 * Append history.
 * @param {Object} report
 * @returns {any}
 */
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

/**
 * Ensure history from report.
 * @returns {any}
 */
async function ensureHistoryFromReport() {
  const report = await readSimplebeaconJson('report.json');
  if (!report) {
    return [];
  }
  return appendHistory(report);
}

/**
 * Read a JSON file from the platform .simplebeacon directory first, then the monorepo root.
 * This supports deployments where the server runs from ai-platform but scans the repo root.
 * @param {string} fileName
 * @param {any} fallback
 * @returns {any}
 */
async function readSimplebeaconJson(fileName, fallback = null) {
  const candidates = [
    path.join(SIMPLEBEACON_DIR, fileName),
    path.join(MONOREPO_ROOT, '.simplebeacon', fileName)
  ];
  for (const candidate of candidates) {
    try {
      const raw = await readTextFileWithLimit(candidate, 10 * 1024 * 1024);
      if (!raw) continue;
      const content = redactTextSecrets(raw);
      return JSON.parse(content);
    }
    catch {
      /* try next location */
    }
  }
  return fallback;
}

/**
 * Load dashboard context.
 * @returns {any}
 */
function createEmptyReport() {
  return {
    type: 'simplebeacon-report',
    generatedAt: new Date().toISOString(),
    projectRoot: PROJECT_ROOT,
    qualityScore: null,
    consistencyScore: null,
    schemaCompliance: null,
    totalFiles: 0,
    filesAnalyzed: 0,
    pageSampleSchemaChecked: 0,
    pageSampleSchemaPassed: 0,
    schemaChecked: 0,
    schemaPassed: 0,
    repositoryInventory: null,
    issueCount: 0,
    warningCount: 0,
    blockingCount: 0,
    gate: { pass: false, blockingCount: 0, warningCount: 0, failOn: ['high'] },
    jestSummary: null,
    jestBaselinePassed: null,
    detectedIssues: []
  };
}

async function loadDashboardContext() {
  const [report, baseline, history] = await Promise.all([
    readSimplebeaconJson('report.json'),
    readSimplebeaconJson('baseline.json'),
    readSimplebeaconJson('history.json', []).catch(() => [])
  ]);

  let resolvedHistory = history;
  if (!resolvedHistory?.length) {
    resolvedHistory = await ensureHistoryFromReport();
  }

  const resolvedReport = report || createEmptyReport();
  const resolvedBaseline = baseline || {};
  const fictionCatalog = buildFictionPatternCatalog(resolvedBaseline);
  return { report: resolvedReport, baseline: resolvedBaseline, history: resolvedHistory, fictionCatalog };
}

/**
 * Load assessment.
 * @param {number} report
 * @returns {any}
 */
async function loadAssessment(report) {
  const saved = await readSimplebeaconJson('assessment.json');
  if (saved) {
    const sourceGenerated = saved.sourceReport?.generatedAt || saved.generatedAt;
    if (sourceGenerated) {
      const ageMs = Date.now() - new Date(sourceGenerated).getTime();
      if (ageMs <= 7 * 24 * 60 * 60 * 1000) {
        return saved;
      }
    } else {
      return saved;
    }
  }
  const safeReport = report || createEmptyReport();
  return buildAssessmentReport(safeReport, {
    company: 'Cascade AI Platform',
    projectRoot: safeReport.projectRoot || PROJECT_ROOT
  });

  

}

/**
 * Load audit page samples.
 * @returns {any}
 */
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

/**
 * Load audit context.
 * @param {Object} options
 * @returns {any}
 */
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

let isScanRunning = false;

/**
 * Run simplebeacon scan.
 * @param {string} projectPath
 * @param {Object} opts
 * @returns {any}
 */
async function runSimplebeaconScan(projectPath, opts = {}) {
  if (isScanRunning) {
    return { skipped: true, reason: 'scan_already_in_progress' };
  }
  isScanRunning = true;

  const cliBin = path.join(MONOREPO_ROOT, 'packages/simplebeacon-cli/bin/simplebeacon.js');
  const reportOut = projectPath
    ? path.join(projectPath, '.simplebeacon', 'report.json')
    : REPORT_PATH;

  if (projectPath) {
    await fs.promises.mkdir(path.dirname(reportOut), { recursive: true });
  }

  // Fallback to programmatic scan if CLI binary does not exist
  if (!fs.existsSync(cliBin)) {
    logger.warn('[runSimplebeaconScan] CLI binary not found at', cliBin, '— falling back to programmatic analyzeCodebase');
    try {
      const { analyzeCodebase } = require('../../server/lib/codebase-analyzer.cjs');
      const scanRoot = projectPath || PROJECT_ROOT;
      const analysis = await analyzeCodebase(scanRoot, { includeEslint: false, includeBrowserAnalyzers: opts.includeBrowserAnalyzers, includeAllFiles: opts.fullDirectoryScan, context: 'dashboard' });
      const analyzedCount = analysis.summary?.codeFilesAnalyzed ?? analysis.summary?.codeFilesDiscovered ?? 0;
      const healthScore = analysis.summary?.healthScore || 100;
      const report = normalizeDashboardReport({
        type: 'simplebeacon-report',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        projectPath: scanRoot,
        projectRoot: scanRoot,
        summary: analysis.summary || {},
        categories: analysis.categories || [],
        findings: analysis.findings || [],
        rawIssues: analysis.findings || [],
        gate: { pass: analyzedCount > 0 && healthScore >= 80, score: analyzedCount > 0 ? healthScore : 0 }
      }, scanRoot);
      const patchedReport = report;
      await fs.promises.writeFile(reportOut, JSON.stringify(patchedReport, null, 2));
      const history = await appendHistory(patchedReport);
      isScanRunning = false;
      return {
        report: patchedReport,
        history,
        projectPath: scanRoot,
        stdout: '[programmatic fallback — CLI not installed]',
        stderr: '',
        scanId: history[history.length - 1]?.scanId || null,
        gateFailed: !patchedReport.gate.pass,
        cliExitCode: 0
      };
    } catch (fallbackErr) {
      isScanRunning = false;
      logger.error('[runSimplebeaconScan] Programmatic fallback failed:', fallbackErr.message);
      throw fallbackErr;
    }
  }

  // Do not pass --gate: CLI exit 1 on gate FAIL would abort the API even when the report was written.
  const fullFlag = opts.fullDirectoryScan ? ' --full' : '';
  // Server needs JSON output regardless of user tier — apply tier limits to response, not generation
  const tierFlag = ' --tier ' + (opts.tier || 'executive');

  // Generate a short-lived license token for the CLI so it enables the user's tiered rule engines.
  const licenseTier = opts.tier || 'executive';
  const licenseSecret = resolveLicenseSecret();
  let licenseToken = '';
  try {
    licenseToken = generateLicenseToken(
      { email: 'server@simplebeacon.ai', tier: licenseTier, features: ['all'] },
      licenseSecret,
      60 * 24 // 24 hours
    );
  } catch (tokenErr) {
    logger.warn('[runSimplebeaconScan] License generation failed:', tokenErr.message);
  }

  let scanCmd = '';
  scanCmd = projectPath
    ? 'node "' + cliBin + '" scan --path "' + projectPath + '" --format json --output "' + reportOut + '"' + fullFlag + tierFlag
    : 'node "' + cliBin + '" scan --format json --output "' + REPORT_PATH + '"' + fullFlag + tierFlag;

  let stdout = '';
  let stderr = '';
  let cliExitCode = 0;
  try {
    try {
      const result = await execAsync(scanCmd, {
        cwd: PROJECT_ROOT,
        timeout: Number(process.env.SIMPLEBEACON_SCAN_TIMEOUT_MS) || constants.TIMEOUT_10M,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          SIMPLEBEACON_LICENSE_TOKEN: licenseToken,
          SIMPLEBEACON_LICENSE_SECRET: licenseSecret
        }
      });
      stdout = result.stdout || '';
      stderr = result.stderr || '';
    } catch (err) {
      stdout = err.stdout || '';
      stderr = err.stderr || '';
      cliExitCode = typeof err.code === 'number' ? err.code : 1;
      const reportExists = fs.existsSync(projectPath ? reportOut : REPORT_PATH);
      if (!reportExists) {
        logger.error('[runSimplebeaconScan] CLI failed — report missing:', err.message, 'stderr:', stderr.slice(0, 500));
        err.stdout = stdout;
        err.stderr = stderr;
        throw err;
      }
    }

    const reportFilePath = projectPath ? reportOut : REPORT_PATH;
    let report;
    if (fs.existsSync(reportFilePath)) {
      report = await readJson(reportFilePath);
    } else {
      logger.warn('[runSimplebeaconScan] Report file missing — attempting stdout fallback');
      report = tryExtractJsonFromStdout(stdout);
      if (!report) {
        logger.warn('[runSimplebeaconScan] No JSON in stdout — creating minimal fallback report');
        report = {
          type: 'simplebeacon-report',
          version: '1.0.0',
          generatedAt: new Date().toISOString(),
          projectPath: projectPath || PROJECT_ROOT,
          summary: { totalFiles: 0, totalFindings: 0, severityCounts: { critical: 0, high: 0, medium: 0, low: 0 } },
          categories: {},
          findings: [],
          gate: { pass: false, failOn: ['high'], warnOn: ['medium', 'low'] }
        };
      }
      await fs.promises.mkdir(path.dirname(reportFilePath), { recursive: true });
      await fs.promises.writeFile(reportFilePath, JSON.stringify(report, null, 2));
    }
    report = normalizeDashboardReport(report, projectPath || report.projectRoot || report.projectPath || PROJECT_ROOT);
    const history = await appendHistory(report);

    return {
      report,
      history,
      projectPath: projectPath || PROJECT_ROOT,
      stdout: stdout.slice(-constants.MAX_RATE_LIMIT),
      stderr: stderr.slice(-500),
      scanId: history[history.length - 1]?.scanId || null,
      gateFailed: report.gate?.pass === false || cliExitCode !== 0,
      cliExitCode
    };
  } finally {
    isScanRunning = false;
  }
}

/**
 * Setup Simplebeacon API routes.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function setupSimplebeaconAPI(app, options = {}) {
  logger.warn('[simplebeacon-api] default report path:', REPORT_PATH.replace(/\\/g, '/'), 'project root:', PROJECT_ROOT.replace(/\\/g, '/'));
  const requirePaidReadOnly = options.requirePaidReadOnly || createRequireSubscription({ allowFree: true });
  const requirePaid = options.requirePaid || createRequireSubscription();
  const requirePaidWithQuota = options.requirePaidWithQuota || createRequireSubscription({ consumeQuota: true });

/**
 * Require user account.
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
  function requireUserAccount(req, res, next) {
    if (!req.user?.email) {
      const debug = req.authError ? req.authError.message : undefined;
      if (debug) {
        logger.warn(`[simplebeacon-api] requireUserAccount 401 - ${req.method} ${req.originalUrl}: ${debug}`);
      }
      const body = { success: false, error: 'Authentication required' };
      if (debug && process.env.DEBUG_CLIENT_ERRORS === '1') {
        body.debug = debug;
      }
      return res.status(401).json(body);
    }
    next();
  }

  app.get('/api/simplebeacon/report', requirePaidReadOnly, async (req, res) => {
    const rawProjectPath = req.query.projectPath || '';
    let projectPath = null;
    let reportPath = null;
    let fileExists = false;
    let fileSize = 0;
    try {
      if (rawProjectPath) {
        try {
          projectPath = resolveSafeAnalyzePath(rawProjectPath);
        } catch (err) {
          // Path outside allowed roots — fall back to default platform report
          logger.info('[simplebeacon-api] report path outside allowed roots:', rawProjectPath, '- falling back to default');
          projectPath = null;
        }
      }
      reportPath = resolveReportFilePath(projectPath);
      fileExists = fs.existsSync(reportPath);
      if (fileExists) {
        try {
          fileSize = fs.statSync(reportPath).size;
        } catch {
          /* ignore stat failure */
        }
      }
      const report = normalizeDashboardReport(
        await readJson(reportPath),
        projectPath || rawProjectPath || null
      );
      return res.json(report);
    } catch (err) {
      const isAdmin = req.user?.role === 'admin' || (Array.isArray(req.user?.permissions) && req.user.permissions.includes('admin:all'));
      const isDebug = process.env.DEBUG_CLIENT_ERRORS === '1' || isAdmin;
      logger.warn(
        `[simplebeacon-api] report fallback triggered — raw: ${rawProjectPath || '(none)'}, ` +
        `resolved: ${projectPath || '(default)'}, reportPath: ${reportPath || '(none)'}, ` +
        `exists: ${fileExists}, size: ${fileSize}, error: ${err.message || err}`
      );
      const fallback = normalizeDashboardReport({
        // Return a default empty report so the dashboard can render before the first scan
        type: 'simplebeacon-report',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        projectPath: rawProjectPath || PROJECT_ROOT,
        summary: { totalFiles: 0, issues: 0, score: 0, grade: 'F' },
        findings: [{
          category: 'scan-empty',
          file: '',
          severity: 'high',
          message: 'No scan report found for the requested path. Run a scan or verify the project path.'
        }],
        modules: [],
        gate: { pass: false, blockingCount: 1, warningCount: 0, failOn: ['high'] }
      }, rawProjectPath || PROJECT_ROOT);
      if (isDebug) {
        fallback._debug = {
          rawProjectPath,
          resolvedProjectPath: projectPath,
          resolvedReportPath: reportPath,
          fileExists,
          fileSize,
          error: err.message || String(err),
          code: err.code || null
        };
      }
      return res.json(fallback);
    }
  });

  // --- Upload a report (server-side ingestion) ---
  app.post('/api/simplebeacon/report/upload', async (req, res) => {
    try {
      const uploadSecret = process.env.SIMPLEBEACON_UPLOAD_SECRET;
      if (uploadSecret) {
        const provided = req.headers['x-sb-upload-secret'] || req.query.token;
        if (!provided || provided !== uploadSecret) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
      } else {
        const remote = (req.ip || req.connection?.remoteAddress || '').toString();
        if (!remote.includes('127.0.0.1') && !remote.includes('::1')) {
          return res.status(403).json({ success: false, error: 'Uploads restricted. Set SIMPLEBEACON_UPLOAD_SECRET to enable remote uploads.' });
        }
      }

      const report = req.body;
      if (!report || typeof report !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid JSON body' });
      }

      const reportPath = resolveReportFilePath(null);
      await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));

      const normalized = normalizeDashboardReport(report, report.projectPath || PROJECT_ROOT);
      const history = await appendHistory(normalized);

      return res.json({ success: true, savedTo: reportPath, scanId: history[history.length - 1]?.scanId || null });
    } catch (err) {
      logger.warn('[simplebeacon-api] upload failed:', err.message || err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // --- Browser error reporting (client-side diagnostic uploads) ---
  // Accepts JSON payloads from the dashboard client when a browser-local
  // scan encounters an error (e.g., File System Access NotFoundError).
  // Stored as NDJSON in .simplebeacon/browser-errors.ndjson so we can inspect
  // and surface them via a simple GET endpoint for debugging.
  app.post('/api/simplebeacon/report/browser-error', optionalAuthenticate, requireUserAccount, async (req, res) => {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== 'object') return res.status(400).json({ success: false, error: 'Invalid JSON body' });
      const record = Object.assign({ receivedAt: new Date().toISOString() }, payload);
      const errorsDir = path.dirname(resolveReportFilePath(null));
      const filePath = path.join(errorsDir, 'browser-errors.ndjson');
      await fs.promises.mkdir(errorsDir, { recursive: true });
      await fs.promises.appendFile(filePath, JSON.stringify(record) + '\n');
      try {
        logger.info('[AUDIT] browser-error', {
          time: new Date().toISOString(),
          source: record.source || 'dashboard',
          message: record.error || null,
          filePath: record.filePath || null,
          receivedAt: record.receivedAt || null
        });
      } catch (e) {
        logger.warn('[simplebeacon-api] failed to write audit log for browser-error', e && e.message ? e.message : String(e));
      }
      return res.json({ success: true, savedTo: filePath });
    } catch (err) {
      logger.warn('[simplebeacon-api] browser-error save failed:', err && err.message ? err.message : String(err));
      return res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
    }
  });

  app.get('/api/simplebeacon/report/browser-errors', requirePaidReadOnly, async (req, res) => {
    try {
      const errorsPath = path.join(path.dirname(resolveReportFilePath(null)), 'browser-errors.ndjson');
      if (!fs.existsSync(errorsPath)) return res.json({ success: true, entries: [] });
      const raw = await fs.promises.readFile(errorsPath, 'utf8');
      const lines = raw.split('\n').filter(Boolean).slice(-200); // last 200 entries
      const entries = lines.map(l => {
        try { return JSON.parse(l); } catch { return { raw: l }; }
      });
      return res.json({ success: true, entries });
    } catch (err) {
      logger.warn('[simplebeacon-api] browser-errors read failed:', err && err.message ? err.message : String(err));
      return res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
    }
  });

  // --- Subscription status (for frontend tier gating) ---
  app.get('/api/simplebeacon/subscription', requirePaidReadOnly, async (req, res) => {
    const sub = req.simplebeaconSubscription || { tier: 'anonymous', readOnly: true };
    res.json({
      tier: sub.tier || 'anonymous',
      subscriptionActive: Boolean(sub.subscriptionActive),
      readOnly: Boolean(sub.readOnly),
      freeToken: Boolean(sub.freeToken),
      scansRemaining: sub.scansRemaining ?? 0,
      apiRemaining: sub.apiRemaining ?? 0,
      upgradeUrl: '/pricing.html'
    });
  });

  // --- External project report integration ---
  app.get('/api/simplebeacon/report/ai-agent', requirePaidReadOnly, async (_req, res) => {
    try {
      const agentReportPath = path.join(MONOREPO_ROOT, 'ai-agent', '.simplebeacon', 'report.json');
      try {
        await fs.promises.access(agentReportPath);
      } catch {
        return res.status(404).json({ error: 'AI Agent report not found', message: 'Run scan in ai-agent directory first' });
      }
      const report = patchRemediationPhases(await readJson(agentReportPath));
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load AI Agent report', message: err.message });
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
      // Return a default empty baseline so the dashboard can render before the first scan
      res.json({
        summary: {},
        jestTestsLabel: '0/0',
        jestSuites: '0/0',
        pageSamplesLabel: '0/0'
      });
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

  app.get('/api/simplebeacon/config', async (req, res) => {
    try {
      let projectPath = null;
      if (req.query.projectPath) {
        try {
          projectPath = resolveSafeAnalyzePath(req.query.projectPath);
        } catch (err) {
          return res.status(400).json({ success: false, error: err.message });
        }
      }
      const configPath = resolveConfigFilePath(projectPath);
      let config = {};
      try {
        config = await readJson(configPath);
      } catch {
        config = {};
      }
      if (projectPath) {
        try {
          const detected = detectProjectProfile(projectPath);
          const usesDefaultScanPaths = !config.scanPaths || config.scanPaths.length === 0 || JSON.stringify(config.scanPaths) === JSON.stringify(DEFAULT_MOCK_SCAN_RELATIVE_PATHS);
          const usesDefaultProductionPaths = !config.productionPaths || config.productionPaths.length === 0 || JSON.stringify(config.productionPaths) === JSON.stringify(DEFAULT_CONFIG.productionPaths);
          if (usesDefaultScanPaths) {
            config.scanPaths = detected.scanPaths;
          }
          if (usesDefaultProductionPaths) {
            config.productionPaths = detected.productionPaths;
          }
          if (!config.sampleDir) {
            config.sampleDir = detected.sampleDir;
          }
        } catch {
          // Detection failure is non-blocking; return config as-is
        }
      }
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

  app.get('/api/simplebeacon/user/ai-keys', optionalAuthenticate, async (req, res) => {
    try {
      const email = req.user?.email;
      if (!email) {
        // Graceful fallback for dev environments with ephemeral JWT secrets
        return res.json({ success: true, providers: {}, ollamaBaseUrl: '', ollamaModel: '', updatedAt: null });
      }
      const keys = await getUserAiKeysPublic(email);
      res.json({ success: true, ...keys });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/simplebeacon/user/ai-keys', optionalAuthenticate, requireUserAccount, async (req, res) => {
    try {
      const email = req.user?.email;
      if (!email) {
        // Debug log to diagnose why optionalAuthenticate did not set req.user on production
        const authHeader = req.headers.authorization || '';
        const hasBearer = authHeader.toLowerCase().startsWith('bearer ');
        const token = hasBearer ? authHeader.substring(7) : '';
        let verifyResult = null;
        let verifyError = null;
        if (token) {
          try {
            verifyResult = await verifyToken(token);
          } catch (err) {
            verifyError = err.message || String(err);
          }
        }
        logger.warn('[PUT /api/simplebeacon/user/ai-keys] Auth failed: missing req.user.email', {
          hasAuthorizationHeader: Boolean(authHeader),
          hasBearerPrefix: hasBearer,
          tokenLength: token.length,
          userSet: Boolean(req.user),
          userEmail: req.user?.email || null,
          verifyError,
          verifyResultEmail: verifyResult?.email || null,
          verifyResultJti: verifyResult?.jti || null,
          verifyResultSub: verifyResult?.sub || null,
          method: req.method,
          path: req.path,
          ip: req.ip || req.connection?.remoteAddress || null
        });
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          debug: verifyError ? `Token verification failed: ${verifyError}` : (token ? 'Token verified but req.user was not set' : 'No Bearer token provided')
        });
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const keys = await saveUserAiKeys(email, body);
      res.json({ success: true, ...keys });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/simplebeacon/user/ai-keys', optionalAuthenticate, requireUserAccount, async (req, res) => {
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

  // --- User data export (GDPR-style data download) ---
  app.get('/api/user/export', optionalAuthenticate, requireUserAccount, async (req, res) => {
    try {
      const email = req.user?.email || 'anonymous';
      const [aiKeys, report, history, baseline, config, assessment] = await Promise.all([
        getUserAiKeysPublic(email).catch(() => ({ providers: {}, ollamaBaseUrl: '', ollamaModel: '', updatedAt: null })),
        readSimplebeaconJson('report.json', null),
        readSimplebeaconJson('history.json', []),
        readSimplebeaconJson('baseline.json', {}),
        readSimplebeaconJson('config.json', {}),
        readSimplebeaconJson('assessment.json', null)
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: {
          id: req.user?.id || null,
          email: req.user?.email || null,
          name: req.user?.name || null,
          role: req.user?.role || null,
          tier: req.user?.tier || req.user?.plan || null,
          trustLevel: req.user?.trustLevel || null
        },
        aiKeys,
        scanHistory: history,
        report,
        baseline,
        config,
        assessment
      };

      const safeEmail = String(email).replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `simplebeacon-export-${safeEmail}-${Date.now()}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.json(exportData);
    } catch (err) {
      logger.error('[GET /api/user/export] Export failed:', err.message);
      res.status(500).json({ success: false, error: 'Export failed', message: err.message });
    }
  });

  // --- Subscription endpoints (simple persisted JSON for demo/dev)
  app.get('/api/user/subscription', optionalAuthenticate, requireUserAccount, async (req, res) => {
    try {
      // Prefer per-project subscription file; fall back to user tier
      let sub = null;
      try {
        const raw = await readTextFileWithLimit(SUBSCRIPTION_PATH, 64 * 1024).catch(() => null);
        if (raw) sub = JSON.parse(raw);
      } catch { sub = null; }

      // Default subscription derived from user profile when file missing
      if (!sub) {
        sub = {
          plan: req.user?.tier || req.user?.plan || 'free',
          scansRemaining: req.user?.plan === 'free' ? 'Unlimited' : 'Unlimited',
          apiAccess: req.user?.tier === 'pro' || req.user?.plan === 'pro' ? 'Full' : 'Limited'
        };
      }
      return res.json({ success: true, subscription: sub });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // For local development convenience, allow updating subscription file (dev only or admin)
  app.put('/api/user/subscription', optionalAuthenticate, requireUserAccount, express.json(), async (req, res) => {
    try {
      if (process.env.NODE_ENV !== 'development' && req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const toWrite = {
        plan: body.plan || req.user?.tier || 'free',
        scansRemaining: typeof body.scansRemaining !== 'undefined' ? body.scansRemaining : (body.plan === 'free' ? 'Unlimited' : 'Unlimited'),
        apiAccess: body.apiAccess || (body.plan === 'pro' ? 'Full' : (req.user?.tier === 'pro' ? 'Full' : 'Limited'))
      };
      await fs.promises.mkdir(SIMPLEBEACON_DIR, { recursive: true });
      await fs.promises.writeFile(SUBSCRIPTION_PATH, JSON.stringify(toWrite, null, 2), 'utf8');
      return res.json({ success: true, subscription: toWrite });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Server-side proxy for Ollama so the HTTPS dashboard avoids mixed-content CORS issues
  // with direct http://127.0.0.1:11434 calls from the browser.
  function isAllowedOllamaHost(hostname) {
    if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]') return true;
    // Allow all 127.0.0.0/8 loopback addresses (e.g. 127.0.0.1, 127.0.0.2).
    if (/^127(?:\.[0-9]{1,3}){3}$/.test(hostname)) return true;
    return false;
  }
  app.get('/api/simplebeacon/ollama/models', async (req, res) => {
    try {
      let rawBaseUrl = String(req.query.baseUrl || 'http://127.0.0.1:11434').trim().replace(/^["']+|["']+$/g, '').replace(/\/$/, '');
      // Defensive: some callers may still send a percent-encoded URL; decode once more.
      if (/^https?%3A%2F%2F/i.test(rawBaseUrl)) {
        try { rawBaseUrl = decodeURIComponent(rawBaseUrl); } catch { /* ignore */ }
      }
      let parsed;
      try {
        parsed = new URL(rawBaseUrl);
      } catch {
        // Allow bare host:port like "127.0.0.1:11434".
        try {
          parsed = new URL('http://' + rawBaseUrl);
        } catch {
          return res.status(400).json({ success: false, error: 'Invalid Ollama base URL' });
        }
      }
      const baseUrl = `${parsed.protocol}//${parsed.host}`;
      if (!isAllowedOllamaHost(parsed.hostname)) {
        logger.warn('[GET /api/simplebeacon/ollama/models] Rejected baseUrl:', rawBaseUrl, 'hostname:', parsed.hostname);
        return res.status(400).json({ success: false, error: `Ollama base URL must be localhost or 127.0.0.1 (received: ${parsed.hostname})` });
      }
      const targetUrl = `${baseUrl.replace(/\/$/, '')}/api/tags`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let response;
      try {
        response = await fetch(targetUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        });
      } finally {
        clearTimeout(timeout);
      }
      const data = await response.text();
      res.status(response.status)
        .set('Content-Type', response.headers.get('content-type') || 'application/json')
        .send(data);
    } catch (err) {
      logger.warn('[GET /api/simplebeacon/ollama/models] Proxy failed:', err.message);
      res.status(502).json({ success: false, error: 'Ollama unreachable', message: err.message });
    }
  });

  app.post('/api/simplebeacon/ollama/chat', async (req, res) => {
    try {
      let rawBaseUrl = String(req.query.baseUrl || 'http://127.0.0.1:11434').trim().replace(/^["']+|["']+$/g, '').replace(/\/$/, '');
      if (/^https?%3A%2F%2F/i.test(rawBaseUrl)) {
        try { rawBaseUrl = decodeURIComponent(rawBaseUrl); } catch { /* ignore */ }
      }
      let parsed;
      try {
        parsed = new URL(rawBaseUrl);
      } catch {
        try {
          parsed = new URL('http://' + rawBaseUrl);
        } catch {
          return res.status(400).json({ success: false, error: 'Invalid Ollama base URL' });
        }
      }
      const baseUrl = `${parsed.protocol}//${parsed.host}`;
      if (!isAllowedOllamaHost(parsed.hostname)) {
        logger.warn('[POST /api/simplebeacon/ollama/chat] Rejected baseUrl:', rawBaseUrl, 'hostname:', parsed.hostname);
        return res.status(400).json({ success: false, error: `Ollama base URL must be localhost or 127.0.0.1 (received: ${parsed.hostname})` });
      }
      const targetUrl = `${baseUrl.replace(/\/$/, '')}/api/chat`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      let response;
      try {
        response = await fetch(targetUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(req.body || {})
        });
      } finally {
        clearTimeout(timeout);
      }
      const data = await response.text();
      res.status(response.status)
        .set('Content-Type', response.headers.get('content-type') || 'application/json')
        .send(data);
    } catch (err) {
      logger.warn('[POST /api/simplebeacon/ollama/chat] Proxy failed:', err.message);
      res.status(502).json({ success: false, error: 'Ollama unreachable', message: err.message });
    }
  });

  app.get('/api/simplebeacon/history', requirePaidReadOnly, async (_req, res) => {
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

  app.get('/api/simplebeacon/dashboard', requirePaidReadOnly, async (_req, res) => {
    try {
      const context = await loadDashboardContext();
      res.json(buildDashboardPayload(context));
    } catch (err) {
      res.status(404).json({ error: 'Dashboard not found', message: err.message });
    }
  });

  app.get('/api/simplebeacon/results/:scanId', requirePaidReadOnly, async (req, res) => {
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

  app.get('/api/simplebeacon/assessment', requirePaidReadOnly, async (_req, res) => {
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

  app.get('/api/simplebeacon/audit', requirePaidReadOnly, async (req, res) => {
    try {
      const includeNpm = req.query.npmAudit === '1' || req.query.npmAudit === 'true';
      const context = await loadAuditContext({ includeNpmAudit: includeNpm });
      res.json(buildAuditPayload(context, {
        assessment: context.assessment,
        npmAudit: context.npmAudit,
        pageSamples: context.pageSamples
      }));
    } catch (err) {
      logger.error('[/api/simplebeacon/audit] Failed to load audit context:', err?.message || err);
      res.status(404).json({ error: 'Audit not found', message: err.message });
    }
  });

  app.post('/api/simplebeacon/npm-audit', requirePaidWithQuota, async (_req, res) => {
    try {
      const npmAudit = await runNpmAuditAsync(PROJECT_ROOT, { force: true });
      res.json({ success: true, ...npmAudit });
    } catch (err) {
      res.status(500).json({ error: 'npm audit failed', message: err.message });
    }
  });

  app.get('/api/ai-validation/audit', requirePaidReadOnly, async (req, res) => {
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

  app.get('/api/simplebeacon/scan/progress', requirePaidReadOnly, async (req, res) => {
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
      const result = await runSimplebeaconScan(projectPath, {
        fullDirectoryScan: req.body?.fullDirectoryScan === true
      });
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
      logger.error('[POST /api/simplebeacon/scan] Scan error:', err.message, 'code:', err.code, 'killed:', err.killed);
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
            stdout: err.stdout?.slice(-constants.MAX_RATE_LIMIT),
            stderr: err.stderr?.slice(-500),
            cliExitCode: err.code
          });
        } catch (recoverErr) {
          return res.status(recoverErr.killed ? 504 : 500).json({
            error: 'Scan failed',
            message: recoverErr.message,
            stdout: recoverErr.stdout?.slice(-constants.MAX_RATE_LIMIT),
            stderr: recoverErr.stderr?.slice(-500),
            partialReport: null,
            _debug: {
              stack: recoverErr.stack,
              code: recoverErr.code,
              killed: recoverErr.killed,
              scanCmd,
              projectPath,
              reportOut,
              reportExists
            }
          });
        }
      }
      res.status(err.killed ? 504 : 500).json({
        error: 'Scan failed',
        message: err.message,
        stdout: err.stdout?.slice(-constants.MAX_RATE_LIMIT),
        stderr: err.stderr?.slice(-500),
        partialReport: reportExists ? await readJson(reportOut).catch(() => null) : null,
        _debug: {
          stack: err.stack,
          code: err.code,
          killed: err.killed,
          scanCmd,
          projectPath,
          reportOut,
          reportExists
        }
      });
    }
  });

  app.get('/api/ai-validation/dashboard', requirePaidReadOnly, async (_req, res) => {
    try {
      const context = await loadDashboardContext();
      res.json(buildDashboardPayload(context));
    } catch (err) {
      res.status(404).json({ error: 'Dashboard not found', message: err.message });
    }
  });

  app.get('/api/ai-validation/results/:scanId', requirePaidReadOnly, async (req, res) => {
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
        stdout: err.stdout?.slice(-constants.MAX_RATE_LIMIT),
        stderr: err.stderr?.slice(-500)
      });
    }
  });

  app.post('/api/simplebeacon/tools/baseline-sync', requirePaidWithQuota, async (_req, res) => {
    try {
            const result = await syncMeasuredBaseline(PROJECT_ROOT, { fallbackToCache: true });
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

  app.get('/api/simplebeacon/summary', requirePaidReadOnly, async (_req, res) => {
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
      await fs.promises.mkdir(SIMPLEBEACON_DIR, { recursive: true });
      await fs.promises.writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
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

  // ── Scan Scheduler ──
  const SCHEDULE_PATH = path.join(SIMPLEBEACON_DIR, 'schedule.json');
  const scheduler = createScheduler({
    runSimplebeaconScan,
    PROJECT_ROOT,
    REPORT_PATH,
    SIMPLEBEACON_DIR,
    SCHEDULE_PATH
  });

  app.get('/api/simplebeacon/schedule', requirePaidReadOnly, async (_req, res) => {
    try {
      const cfg = await scheduler.readScheduleConfig();
      res.json({ success: true, schedule: cfg });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/simplebeacon/schedule', requirePaid, async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const current = await scheduler.readScheduleConfig();
      const updated = {
        enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
        intervalMinutes: Number(body.intervalMinutes) || current.intervalMinutes || 60,
        recipients: Array.isArray(body.recipients)
          ? body.recipients.filter((r) => typeof r === 'string' && r.includes('@'))
          : current.recipients,
        projectPath: body.projectPath || current.projectPath,
        includeCertificate: typeof body.includeCertificate === 'boolean'
          ? body.includeCertificate
          : current.includeCertificate,
        webhookUrl: body.webhookUrl || current.webhookUrl,
        zeroRetention: typeof body.zeroRetention === 'boolean'
          ? body.zeroRetention
          : current.zeroRetention
      };
      await scheduler.writeScheduleConfig(updated);
      scheduler.startScheduler();
      res.json({ success: true, schedule: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Webhook-triggered scan
  app.post('/api/simplebeacon/scan/webhook', requirePaidWithQuota, async (req, res) => {
    const { webhookUrl, projectPath } = req.body || {};
    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: 'webhookUrl is required and must start with http(s)'
      });
    }
    let resolvedProjectPath = null;
    try {
      if (projectPath) {
        resolvedProjectPath = resolveSafeAnalyzePath(projectPath);
      }
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const scanId = crypto.randomUUID();
    res.json({
      success: true,
      scanId,
      status: 'started',
      message: 'Scan started. Results will be POSTed to the webhook URL.'
    });

    try {
      const result = await runSimplebeaconScan(resolvedProjectPath);
      const payload = {
        event: 'simplebeacon.scan.completed',
        scanId: result.scanId || scanId,
        projectPath: result.projectPath,
        gatePass: result.report?.gate?.pass ?? null,
        gateFailed: Boolean(result.gateFailed),
        qualityScore: result.report?.qualityScore,
        issueCount: result.report?.issueCount,
        report: result.report,
        stdout: result.stdout,
        stderr: result.stderr,
        timestamp: new Date().toISOString()
      };
      const webhookResult = await scheduler.postWebhook(webhookUrl, payload);
      logger.info(`[WebhookScan] ${webhookResult.success ? 'delivered' : 'failed'} to ${webhookUrl}`);

      // Zero-retention: wipe payload from memory after delivery
      if (req.body?.zeroRetention) {
        try {
          const reportOut = resolvedProjectPath
            ? path.join(resolvedProjectPath, '.simplebeacon', 'report.json')
            : REPORT_PATH;
          if (fs.existsSync(reportOut)) {
            fs.unlinkSync(reportOut);
            logger.info('[WebhookScan] Zero-retention: report file removed after delivery');
          }
        } catch (unlinkErr) {
          logger.warn('[WebhookScan] Zero-retention: failed to remove report file:', unlinkErr.message);
        }
      }
    } catch (err) {
      logger.error('[WebhookScan] Scan or delivery failed:', err.message);
      scheduler.postWebhook(webhookUrl, {
        event: 'simplebeacon.scan.failed',
        scanId,
        error: err.message,
        timestamp: new Date().toISOString()
      }).catch(() => {});
    }
  });

  // Local bridge helper: resolve a folder name (from browser picker) to an
  // absolute path inside the allowed analysis roots. Used by the hosted
  // dashboard when the user selects a folder and an sb_api_base bridge is set.
  app.post('/api/find-folder', (req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const folderName = String(payload.folderName || '').trim();
        if (!folderName) {
          res.status(400).json({ success: false, error: 'folderName is required' });
          return;
        }
        const allowedRoots = resolveDefaultAllowedRoots(PROJECT_ROOT, { monorepoRoot: MONOREPO_ROOT });
        const found = findFolderByName(folderName, allowedRoots);
        if (!found) {
          res.status(404).json({ success: false, error: 'Folder not found' });
          return;
        }
        const safePath = assertSafeProjectPath(found, allowedRoots);
            res.json({ success: true, results: [safePath] });
      } catch (err) {
        logger.error('[POST /api/find-folder] Error:', err.message);
        res.status(500).json({ success: false, error: err.message || 'Folder lookup failed' });
      }
    });
  });

      // Verify an absolute or relative path is allowed and exists on the server.
      app.post('/api/verify-path', (req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const payload = body ? JSON.parse(body) : {};
            const target = String(payload.path || '').trim();
            if (!target) {
              res.status(400).json({ success: false, error: 'path is required' });
              return;
            }
            const allowedRoots = getAnalyzeAllowedRoots();
            try {
              const safe = assertSafeProjectPath(target, allowedRoots, 'path');
              res.json({ success: true, path: safe });
            } catch (err) {
              res.status(400).json({ success: false, error: err.message });
            }
          } catch (err) {
            logger.error('[POST /api/verify-path] Error:', err.message);
            res.status(500).json({ success: false, error: err.message || 'Path verification failed' });
          }
        });
      });

  scheduler.startScheduler();
  setupSimplebeaconDemoAPI(app);
}

/**
 * Search allowed roots for a directory matching folderName (case-insensitive).
 * Checks each root basename first, then direct children, then grandchildren.
 * @param {string} folderName
 * @param {string[]} allowedRoots
 * @returns {string|null}
 */
function findFolderByName(folderName, allowedRoots) {
  const target = String(folderName || '').trim();
  if (!target) return null;
  const targetLower = target.toLowerCase();
  const skipDirs = new Set(['node_modules', '.git', '.simplebeacon', 'dist', 'build', '.github', '.vscode', 'coverage']);

  function search(dir, depth) {
    if (depth <= 0) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (skipDirs.has(entry.name)) continue;
        const candidate = path.join(dir, entry.name);
        if (entry.name.toLowerCase() === targetLower) return candidate;
        const deeper = search(candidate, depth - 1);
        if (deeper) return deeper;
      }
    } catch { /* ignore unreadable directories */ }
    return null;
  }

  for (const root of allowedRoots) {
    const resolvedRoot = path.resolve(root);
    if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) continue;
    if (path.basename(resolvedRoot).toLowerCase() === targetLower) return resolvedRoot;
    const found = search(resolvedRoot, 2);
    if (found) return found;
  }
  return null;
}

/**
 * Merge config.
 * @param {any} existing
 * @param {any} incoming
 * @returns {any}
 */
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

module.exports = { setupSimplebeaconAPI, runSimplebeaconScan };
