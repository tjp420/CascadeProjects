/**
 * SimpleBeacon Local Agent
 *
 * A tiny localhost-only service that lets the public web dashboard scan
 * filesystem paths on the user's own machine. It binds to 127.0.0.1 so only
 * the local browser can reach it, validates the requested path, runs the
 * same SimpleBeacon scan used by the CLI, and returns a JSON report.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');

const PORT = Number(process.env.SIMPLEBEACON_AGENT_PORT || 55432);
const HOST = process.env.SIMPLEBEACON_AGENT_HOST || '127.0.0.1';

const app = express();

/**
 * Resolve the project root for the agent so it can locate the SimpleBeacon
 * scanner and config. The agent may be run from inside ai-platform/local-agent
 * or from a global install; try several sensible roots.
 */
function resolveAgentRoot() {
  const candidates = [
    path.join(__dirname, '..', '..'), // ai-platform/local-agent/../../ => monorepo root
    path.join(__dirname, '..'),       // ai-platform/local-agent/../ => ai-platform
    process.cwd()
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(path.join(resolved, 'packages', 'simplebeacon-cli', 'src', 'index.js'))) {
      return resolved;
    }
    if (fs.existsSync(path.join(resolved, 'simplebeacon-cli', 'src', 'index.js'))) {
      return resolved;
    }
  }
  return path.resolve(__dirname, '..', '..');
}

const AGENT_ROOT = resolveAgentRoot();
const SCANNER_MODULE = path.join(AGENT_ROOT, 'packages', 'simplebeacon-cli', 'src', 'index.js');

/**
 * Load the SimpleBeacon scanner API. Returns null if the CLI package is not
 * installed or is otherwise unavailable. When packaged with pkg, the snapshot
 * may not contain the full scanner due to dynamic requires, so the runtime also
 * tries the scanner source shipped alongside the executable on the real filesystem.
 */

// Static literal require signals to pkg that this module must be bundled.
// Runtime resolution happens in loadScannerApi() so the filesystem copy is tried first.
try {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  require('../../packages/simplebeacon-cli/src/index.js');
} catch {
  // Ignore at runtime; this path is only used during pkg analysis.
}

function loadScannerApi() {
  const candidates = [SCANNER_MODULE];

  if (typeof process !== 'undefined' && 'pkg' in process && process.pkg) {
    // Packaged executable: scanner may be shipped alongside the executable on
    // the real filesystem, or bundled in the snapshot as a fallback.
    const exeDir = path.dirname(process.execPath);
    candidates.unshift(
      path.join(exeDir, 'packages', 'simplebeacon-cli', 'src', 'index.js')
    );
    candidates.push(
      path.join('/snapshot', 'packages', 'simplebeacon-cli', 'src', 'index.js'),
      path.join('/snapshot', 'ai-platform', 'local-agent', 'packages', 'simplebeacon-cli', 'src', 'index.js')
    );
  }

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const api = require(candidate);
      if (api && typeof api.runScan === 'function') {
        return api;
      }
    } catch (err) {
      console.warn('[agent] Failed to load SimpleBeacon scanner from', candidate, ':', err.message);
    }
  }
  return null;
}

const scannerApi = loadScannerApi();

/**
 * Validate that the requested path is safe to scan:
 * - Must be a non-empty string
 * - Must not be a URL
 * - Must be absolute
 * - Must exist on disk
 * - Must be a directory
 */
function validateTargetPath(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    throw new Error('projectPath is required');
  }
  if (/^https?:\/\//i.test(rawPath) || /^file:\/\//i.test(rawPath)) {
    throw new Error('projectPath must be a local folder path, not a URL');
  }
  if (!path.isAbsolute(rawPath)) {
    throw new Error('projectPath must be an absolute path');
  }
  const resolved = path.resolve(rawPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`projectPath does not exist: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error('projectPath must be a directory');
  }
  return resolved;
}

/**
 * Run a SimpleBeacon scan against a validated local path.
 */
async function runLocalScan(targetPath, scanOptions = {}) {
  if (!scannerApi || typeof scannerApi.runScan !== 'function') {
    throw new Error('SimpleBeacon scanner is not available; install dependencies and run from the monorepo root');
  }

  const options = {
    outputFormat: 'json',
    gate: !scanOptions.inventoryOnly,
    full: Boolean(scanOptions.fullDirectoryScan),
    offline: true
  };

  const report = await scannerApi.runScan(targetPath, options);
  if (!report || typeof report !== 'object') {
    throw new Error('Scan returned an empty or invalid report');
  }
  return report;
}

/**
 * Convert a full SimpleBeacon report into the privacy-safe summary schema
 * that may leave the local perimeter. Source code, AST data, and full file
 * contents are stripped; only severity/type/rule aggregates and one redacted
 * example path per issue are kept.
 */
function toPrivacySummaryReport(report) {
  const root = report?.projectRoot || report?.scanPaths?.[0] || 'local-project';
  const label = path.basename(String(root));

  const rawIssues = Array.isArray(report?.detectedIssues) ? report.detectedIssues : [];
  const detectedIssues = rawIssues.map((issue) => {
    const rawPaths = Array.isArray(issue?.filePaths)
      ? issue.filePaths
      : (issue?.filePath ? [issue.filePath] : []);
    const firstPath = rawPaths[0] || issue?.file || issue?.affectedFiles?.[0] || '—';
    const relativePath = firstPath === '—'
      ? '—'
      : path.relative(root, path.resolve(firstPath)).replace(/\\/g, '/');
    return {
      severity: issue?.severity || 'low',
      type: issue?.type || 'Unknown',
      count: typeof issue?.count === 'number' ? issue.count : 1,
      filePath: relativePath,
      rule: issue?.pattern || issue?.rule || issue?.type || 'unknown',
      impact: issue?.description || issue?.impact || '',
      fix: issue?.recommendation || issue?.recommendedAction || issue?.fix || ''
    };
  });

  return {
    type: 'simplebeacon-report',
    version: '1.3.0',
    generatedAt: report?.generatedAt || new Date().toISOString(),
    projectRoot: label,
    gate: {
      pass: report?.gate?.pass === true,
      blockingCount: report?.gate?.blockingCount ?? 0
    },
    qualityScore: report?.qualityScore ?? null,
    totalFiles: report?.totalFiles ?? report?.repositoryInventory?.totalFiles ?? null,
    issueCount: report?.issueCount ?? detectedIssues.length,
    detectedIssues,
    summary: {
      gatePass: report?.gate?.pass === true,
      qualityScore: report?.qualityScore ?? null
    }
  };
}

// CORS middleware. The requireLoopback middleware below already restricts
// TCP connections to the loopback interface, so reflecting any origin is safe.
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '1mb' }));

// Trust proxy disabled so req.ip is accurate
app.set('trust proxy', false);

/**
 * Enforce that the TCP connection came from the loopback interface. Express
 * sees the socket address in req.socket.remoteAddress.
 */
function requireLoopback(req, res, next) {
  const remote = req.socket?.remoteAddress || '';
  const isLoopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (!isLoopback) {
    res.status(403).json({ success: false, error: 'Forbidden: only localhost connections are allowed' });
    return;
  }
  next();
}

app.use(requireLoopback);

// Health check used by the dashboard to detect the agent.
app.get('/health', (req, res) => {
  res.json({
    success: true,
    agent: 'simplebeacon-local-agent',
    version: '1.0.0',
    scannerAvailable: Boolean(scannerApi && typeof scannerApi.runScan === 'function'),
    timestamp: new Date().toISOString()
  });
});

// Scan a local directory.
app.post('/scan', async (req, res) => {
  try {
    const rawPath = req.body?.projectPath;
    const targetPath = validateTargetPath(rawPath);
    const report = await runLocalScan(targetPath);
    res.json({ success: true, projectPath: targetPath, report });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Fetch inventory for a local directory without running a full gate scan.
app.post('/inventory', async (req, res) => {
  try {
    const rawPath = req.body?.projectPath;
    const targetPath = validateTargetPath(rawPath);
    const report = await runLocalScan(targetPath, { inventoryOnly: true });
    const inventory = report?.repositoryInventory || report?.inventory || null;
    res.json({ success: true, projectPath: targetPath, inventory });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Return a privacy-safe summary report with no source code, AST, or file contents.
app.post('/summary', async (req, res) => {
  try {
    const rawPath = req.body?.projectPath;
    const targetPath = validateTargetPath(rawPath);
    const report = await runLocalScan(targetPath);
    const summary = toPrivacySummaryReport(report);
    res.json({ success: true, projectPath: targetPath, summary });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[agent] Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal agent error' });
});

function start() {
  const server = http.createServer(app);
  server.listen(PORT, HOST, () => {
    console.log(`[agent] Listening on http://${HOST}:${PORT}`);
    console.log(`[agent] Scanner root: ${AGENT_ROOT}`);
    console.log(`[agent] Scanner available: ${Boolean(scannerApi && typeof scannerApi.runScan === 'function')}`);
  });

  server.on('error', (err) => {
    if (err && 'code' in err && err.code === 'EADDRINUSE') {
      console.error(`[agent] Port ${PORT} is already in use. Another agent may be running.`);
    } else {
      console.error('[agent] Server error:', err.message);
    }
    process.exit(1);
  });
}

if (require.main === module) {
  start();
}

module.exports = { start, app, loadScannerApi };
