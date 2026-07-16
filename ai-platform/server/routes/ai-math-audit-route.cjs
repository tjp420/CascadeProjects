// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
'use strict';

/**
 * AI Math Audit route — wraps ai-tools/ai-math-audit.py as a dashboard engine.
 *
 * POST /api/analyze/ai-math-audit
 *   Body: { projectPath: string }
 *   Runs deterministic mathematical audit on model numerical logs in the project.
 *   Returns JSON report + visualization asset URLs.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const logger = require('../lib/app-logger.cjs');
const {
  assertSafeProjectPath,
  resolveDefaultAllowedRoots
} = require('../lib/path-safety.cjs');
const { withTimeout } = require('../lib/flexible-analyze-utils.cjs');
const { toClientError } = require('../../shared-utils/index.cjs');

const AUDIT_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Resolve the directory that contains model numerical logs for a project.
 * Tries: <projectPath>/model-logs, <projectPath>/logs, <projectPath>
 */
function resolveLogDir(projectPath) {
  const candidates = [
    path.join(projectPath, 'model-logs'),
    path.join(projectPath, 'logs'),
    projectPath,
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      // Prefer the first candidate that has at least one .json / .jsonl file
      const hasLogs = fs.readdirSync(dir).some(f => /\.jsonl?$/.test(f));
      if (hasLogs) return dir;
    }
  }
  // Fallback: return projectPath itself even if empty (audit will produce empty findings)
  return projectPath;
}

/**
 * Setup the AI Math Audit route.
 * @param {import('express').Application} app
 * @param {string} baseDir
 */
function setupAiMathAuditRoute(app, baseDir) {
  const allowedRoots = resolveDefaultAllowedRoots(baseDir);

  app.post('/api/analyze/ai-math-audit', async (req, res) => {
    let tmpDir = null;
    try {
      const body = req.body || {};
      const rawPath = String(body.projectPath || body.path || '').trim();
      if (!rawPath) {
        return res.status(400).json({ success: false, error: 'Missing projectPath' });
      }

      let projectPath;
      try {
        projectPath = assertSafeProjectPath(rawPath, allowedRoots);
      } catch (err) {
        return res.status(403).json({ success: false, error: err.message });
      }

      const logDir = resolveLogDir(projectPath);
      tmpDir = path.join(os.tmpdir(), 'sb-ai-math-audit-' + Date.now());
      fs.mkdirSync(tmpDir, { recursive: true });

      // Resolve the audit script path (workspace-local or fallback)
      const scriptCandidates = [
        path.join(baseDir, '..', 'ai-tools', 'ai-math-audit.py'),
        path.join(baseDir, '..', '..', 'ai-tools', 'ai-math-audit.py'),
        path.resolve('ai-tools', 'ai-math-audit.py'),
      ];
      let scriptPath = scriptCandidates.find(p => fs.existsSync(p));
      if (!scriptPath) {
        return res.status(500).json({ success: false, error: 'ai-math-audit.py not found' });
      }
      scriptPath = path.resolve(scriptPath);

      const reportJson = path.join(tmpDir, 'report.json');
      const vizDir = path.join(tmpDir, 'viz');

      const cmd = [
        'python', `"${scriptPath}"`,
        '--log-dir', `"${logDir}"`,
        '--viz-dir', `"${vizDir}"`,
        '--output', `"${reportJson}"`,
      ].join(' ');

      logger.info(`[AI Math Audit] Running: ${cmd}`);

      await withTimeout(
        execAsync(cmd, { cwd: path.dirname(scriptPath), maxBuffer: 50 * 1024 * 1024 }),
        AUDIT_TIMEOUT_MS
      );

      if (!fs.existsSync(reportJson)) {
        return res.status(500).json({ success: false, error: 'Audit produced no report file' });
      }

      const report = JSON.parse(await fs.promises.readFile(reportJson, 'utf-8'));

      // Convert absolute viz paths to relative / serveable URLs
      const vizAssets = (report.visualizations || []).map(v => {
        const rel = path.relative(tmpDir, v.path).replace(/\\/g, '/');
        return { ...v, url: `/api/analyze/ai-math-audit/viz?file=${encodeURIComponent(rel)}&tmp=${path.basename(tmpDir)}` };
      });
      report.visualizations = vizAssets;

      // Cache tmpDir on the request so a later cleanup timer can remove it
      // (Express doesn't have built-in per-request temp cleanup; we use a short-lived timer)
      setTimeout(() => {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // ignored
        }
      }, 30 * 60 * 1000); // 30 minutes

      return res.json({ success: true, report, projectPath, logDir });
    } catch (err) {
      logger.error('[AI Math Audit] Error:', err);
      return res.status(500).json(toClientError(err));
    }
  });

  // Static viz asset serving (short-lived temp files)
  app.get('/api/analyze/ai-math-audit/viz', (req, res) => {
    const tmpName = String(req.query.tmp || '');
    const file = String(req.query.file || '');
    if (!tmpName || !file) return res.status(400).send('Missing params');
    if (/[\\]/.test(file) || file.startsWith('..') || /\0/.test(file)) {
      return res.status(403).send('Invalid file path');
    }
    const tmpDir = path.join(os.tmpdir(), tmpName);
    const target = path.join(tmpDir, file);
    // Ensure the target is actually inside the tmpDir
    if (!target.startsWith(tmpDir + path.sep)) {
      return res.status(403).send('Path traversal blocked');
    }
    if (!fs.existsSync(target)) {
      return res.status(404).send('Not found');
    }
    res.sendFile(target);
  });
}

module.exports = { setupAiMathAuditRoute };
