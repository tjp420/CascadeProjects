/**
 * POST /api/analyze/eu-ai-act-audit-report — EU compliance PDF HTML from sprint artifacts.
 */

const path = require('path');
const fs = require('fs');

const { assertSafeProjectPath, resolveDefaultAllowedRoots } = require('../lib/path-safety.cjs');
const { toClientError } = require('../../shared-utils/index.cjs');
const logger = require('../lib/app-logger.cjs');
const { resolvePlatformRoot } = require('../lib/simplebeacon-proxy.cjs');
const { optionalAuthenticate } = require('../middleware/auth.cjs');

/**
 * Resolve project path.
 * @param {string} baseDir
 * @param {string} rawPath
 * @returns {any}
 */
function resolveProjectPath(baseDir, rawPath) {
  const value = String(rawPath || '').trim();
  if (!value) return null;
  if (path.isAbsolute(value)) return path.normalize(value);
  return path.normalize(path.join(baseDir, value));
}

/**
 * Resolve eu ai act project path.
 * @param {string} rawPath
 * @param {Object} options
 * @returns {any}
 */
function resolveEuAiActProjectPath(rawPath, options = {}) {
  const { baseDir, monorepoRoot, allowedRoots } = options;
  const value = String(rawPath || '').trim();
  if (!value) return path.resolve(baseDir);

  const candidates = [];
/**
 * Push.
 * @param {string} candidate
 * @returns {any}
 */
  const push = (candidate) => {
    if (!candidate) return;
    const resolved = path.resolve(candidate);
    if (!candidates.some((entry) => path.resolve(entry) === resolved)) {
      candidates.push(resolved);
    }
  };

  push(resolveProjectPath(baseDir, value));
  if (path.isAbsolute(value)) {
    push(value);
  } else {
    push(path.join(monorepoRoot, value));
    push(path.join(baseDir, '..', value));
    const monorepoLabel = path.basename(monorepoRoot);
    if (monorepoLabel && value.toLowerCase() === monorepoLabel.toLowerCase()) {
      push(monorepoRoot);
    }
    if (value.toLowerCase() === 'cascadeprojects') {
      push(monorepoRoot);
    }
  }

  try {
    const seed = path.isAbsolute(value)
      ? value
      : (fs.existsSync(path.join(monorepoRoot, value))
        ? path.join(monorepoRoot, value)
        : monorepoRoot);
    const { platformRoot, scanRoot } = resolvePlatformRoot(seed);
    push(platformRoot);
    push(scanRoot);
  } catch {
    /* fall through */
  }

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const artifactPath = path.join(candidate, '.simplebeacon', 'eu-ai-act-report.json');
    if (fs.existsSync(artifactPath)) {
      return assertSafeProjectPath(candidate, allowedRoots);
    }
  }

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    return assertSafeProjectPath(candidate, allowedRoots);
  }

  const fallback = candidates[0] || value;
  return assertSafeProjectPath(fallback, allowedRoots);
}

/**
 * Register eu ai act audit route.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function registerEuAiActAuditRoute(app, options = {}) {
  if (app.__euAiActAuditRouteRegistered) return;
  app.__euAiActAuditRouteRegistered = true;

  const baseDir = options.baseDir || path.join(__dirname, '..', '..');
  const monorepoRoot = options.monorepoRoot || path.resolve(path.join(baseDir, '..'));
  const publicGateEnabled = options.publicGateEnabled === true;
  const auditCheckoutUrl = options.auditCheckoutUrl
    || process.env.SIMPLEBEACON_AUDIT_CHECKOUT_URL
    || 'mailto:audit@simplebeacon.ai?subject=Unlock%20Pre-Launch%20Audit%20Report';

/**
 * Get allowed roots.
 * @returns {any}
 */
  function getAllowedRoots() {
    return resolveDefaultAllowedRoots(baseDir, { monorepoRoot });
  }

/**
 * Resolve safe project path.
 * @param {string} rawPath
 * @returns {any}
 */
  function resolveSafeProjectPath(rawPath) {
    return resolveEuAiActProjectPath(rawPath, {
      baseDir,
      monorepoRoot,
      allowedRoots: getAllowedRoots()
    });
  }

  /**
   * Check whether an authenticated user may bypass the public audit gate.
   * @param {Object|null} user
   * @returns {boolean}
   */
  function canAccessAuditReport(user) {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'superadmin') return true;
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    return permissions.includes('admin:basic')
      || permissions.includes('admin:full')
      || permissions.includes('analyze:private');
  }

  /**
   * Build an EU AI Act audit report from request parameters.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {Object} params
   * @returns {Promise<any>}
   */
  async function buildAuditReport(req, res, params) {
    if (publicGateEnabled && !canAccessAuditReport(req.user)) {
      return res.status(402).json({
        success: false,
        publicGateLocked: true,
        error: 'Pre-Launch Audit PDF is a paid deliverable ($499). Unlock the full remediation log and executive PDF.',
        checkoutUrl: auditCheckoutUrl,
        auditPriceLabel: '$499'
      });
    }

    const reportModulePath = require.resolve('../lib/eu-ai-act-audit-report.cjs');
    if (process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true') {
      delete require.cache[reportModulePath];
    }
    const { buildEuAiActAuditReport } = require('../lib/eu-ai-act-audit-report.cjs');

    const projectPath = params.projectPath
      ? resolveSafeProjectPath(params.projectPath)
      : baseDir;
    const report = await buildEuAiActAuditReport({
      projectPath,
      clientName: params.client || params.company || undefined,
      deliverableSku: params.deliverableSku || params.productSku || 'euai2499',
      artifacts: params.sprintArtifacts || undefined,
      credentials: params.credentials
    });
    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      html: report.html,
      filename: report.filename,
      reportId: report.reportId,
      tier: report.exportTier,
      exportTierLabel: report.exportTierLabel
    });
  }

  app.post('/api/analyze/eu-ai-act-audit-report', optionalAuthenticate, async (req, res) => {
    try {
      await buildAuditReport(req, res, req.body || {});
    } catch (error) {
      if (error.code === 'eu_ai_act_artifacts_missing') {
        return res.status(422).json({ success: false, error: error.message });
      }
      logger.warn('[eu-ai-act-audit-report] generation failed', { error: error.message });
      return res.status(400).json({
        success: false,
        error: toClientError(error, 'EU AI Act audit report generation failed')
      });
    }
  });

  app.get('/api/analyze/eu-ai-act-audit-report', optionalAuthenticate, async (req, res) => {
    try {
      await buildAuditReport(req, res, req.query || {});
    } catch (error) {
      if (error.code === 'eu_ai_act_artifacts_missing') {
        return res.status(422).json({ success: false, error: error.message });
      }
      logger.warn('[eu-ai-act-audit-report] generation failed', { error: error.message });
      return res.status(400).json({
        success: false,
        error: toClientError(error, 'EU AI Act audit report generation failed')
      });
    }
  });

  if (process.env.NODE_ENV !== 'test') {
    logger.info('[Simplebeacon] Registered POST and GET /api/analyze/eu-ai-act-audit-report');
  }
}

module.exports = {
  registerEuAiActAuditRoute,
  resolveEuAiActProjectPath
};
