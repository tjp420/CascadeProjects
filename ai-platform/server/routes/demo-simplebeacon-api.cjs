'use strict';

const path = require('path');
const fs = require('fs');

const {
  buildAssessmentReport,
  buildAuditPayload,
  buildFictionPatternCatalog
} = require('../../server/lib/simplebeacon-proxy.cjs');
const {
  buildDashboardPayload,
  buildScanResults,
  findHistoryEntry
} = require('../../server/lib/simplebeacon-proxy.cjs');

const PROJECT_ROOT = path.join(__dirname, '../..');
const DEMO_DIR = path.join(PROJECT_ROOT, 'data', 'simplebeacon-demo');

/**
 * Read JSON from file with optional fallback.
 * @param {string} filePath
 * @param {any} [fallback=null]
 * @returns {Promise<any>}
 */
async function readJson(filePath, fallback = null) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    if (fallback !== null) return fallback;
    throw err;
  }
}

/**
 * Load demo dashboard context from demo data directory.
 * @returns {Promise<Object>}
 */
async function loadDemoContext() {
  const [report, baseline, history] = await Promise.all([
    readJson(path.join(DEMO_DIR, 'report.json')),
    readJson(path.join(DEMO_DIR, 'baseline.json')),
    readJson(path.join(DEMO_DIR, 'history.json'), [])
  ]);
  const fictionCatalog = buildFictionPatternCatalog(baseline);
  return { report, baseline, history, fictionCatalog };
}

/**
 * Respond with demo readonly error.
 * @param {any} _req
 * @param {any} res
 * @returns {any}
 */
function demoReadonly(_req, res) {
  return res.status(403).json({
    error: 'demo_readonly',
    message: 'Demo dashboard is read-only. Run npx simplebeacon locally or sign in at /app for your workspace.'
  });
}

/**
 * Setup Simplebeacon demo API routes.
 * @param {any} app
 * @returns {void}
 */
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

module.exports = { setupSimplebeaconDemoAPI };
