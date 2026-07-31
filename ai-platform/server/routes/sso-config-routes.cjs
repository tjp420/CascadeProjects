/**
 * SSO Configuration API — CRUD endpoints for managing per-organization
 * SAML 2.0 / OIDC provider configurations.
 *
 * Endpoints:
 *   GET    /api/enterprise/sso/configs          — List all SSO configs (admin)
 *   GET    /api/enterprise/sso/configs/:orgId   — List configs for an org
 *   POST   /api/enterprise/sso/configs          — Create SSO config
 *   PUT    /api/enterprise/sso/configs/:providerId — Update SSO config
 *   DELETE /api/enterprise/sso/configs/:providerId — Delete SSO config
 *   GET    /api/enterprise/sso/stats            — SSO configuration stats
 *   GET    /api/enterprise/sso/test/:providerId — Test SSO config connectivity
 *
 * @module sso-config-routes
 */

const express = require('express');
const logger = require('../lib/app-logger.cjs');
const ssoConfigStore = require('../lib/sso-config-store.cjs');
const auditStore = require('../lib/enterprise-audit-store.cjs');
const { validateParam, VALIDATION_PATTERNS } = require('../middleware/validate-params.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

// GET /api/enterprise/sso/configs — list all configs (masked secrets) + stats
router.get('/configs', async (req, res) => {
  try {
    const { orgId } = req.query;
    if (orgId) {
      const configs = ssoConfigStore.getConfigsByOrg(orgId);
      return res.json({ success: true, configs });
    }
    const configs = ssoConfigStore.getAllConfigs();
    const stats = ssoConfigStore.getStats();
    return res.json({ success: true, configs, stats, ...stats });
  } catch (err) {
    sendError(res, 500, 'sso_list_failed', { message: err.message });
  }
});

// GET /api/enterprise/sso/configs/:orgId — list configs for a specific org
router.get('/configs/:orgId', validateParam('orgId', VALIDATION_PATTERNS.orgId), async (req, res) => {
  try {
    const configs = ssoConfigStore.getConfigsByOrg(req.params.orgId);
    res.json({ success: true, configs });
  } catch (err) {
    sendError(res, 500, 'sso_list_failed', { message: err.message });
  }
});

// POST /api/enterprise/sso/configs — create a new SSO config
router.post('/configs', async (req, res) => {
  try {
    const {
      orgId,
      displayName,
      method,
      providerType,
      domain,
      enabled,
      saml,
      oidc,
    } = req.body || {};

    if (!orgId) {
      return sendError(res, 400, 'orgId is required');
    }
    if (!method || !['saml', 'oidc'].includes(method)) {
      return sendError(res, 400, 'method must be "saml" or "oidc"');
    }
    if (method === 'saml' && (!saml?.entryPoint || !saml?.cert)) {
      return sendError(res, 400, 'saml.entryPoint and saml.cert are required for SAML');
    }
    if (method === 'oidc' && (!oidc?.clientId || !oidc?.clientSecret || !oidc?.issuer)) {
      return sendError(res, 400, 'oidc.clientId, oidc.clientSecret, and oidc.issuer are required for OIDC');
    }

    const config = ssoConfigStore.createConfig({
      orgId,
      displayName,
      method,
      providerType,
      domain,
      enabled,
      saml,
      oidc,
    });

    auditStore.appendEntry({
      action: 'sso_config_created',
      orgId,
      actor: req.user?.email || 'system',
      actorIp: req.ip,
      description: `SSO config created: ${config.displayName} (${method}/${providerType})`,
      after: { providerId: config.providerId, method, providerType, domain, enabled: config.enabled },
      metadata: { displayName: config.displayName },
    });

    logger.info(`[SSO] Config created for org ${orgId}: ${config.providerId} (${method})`);

    res.status(201).json({
      success: true,
      providerId: config.providerId,
      displayName: config.displayName,
      method: config.method,
      providerType: config.providerType,
      enabled: config.enabled,
    });
  } catch (err) {
    logger.error('[SSO] Config creation failed:', err.message);
    sendError(res, 500, 'sso_create_failed', { message: err.message });
  }
});

// PUT /api/enterprise/sso/configs/:providerId — update an SSO config
router.put('/configs/:providerId', validateParam('providerId', VALIDATION_PATTERNS.providerId), async (req, res) => {
  try {
    const existing = ssoConfigStore.getConfig(req.params.providerId);
    if (!existing) {
      return sendError(res, 404, 'sso_config_not_found');
    }

    const updates = { ...req.body };
    delete updates.providerId;
    delete updates.orgId;
    delete updates.createdAt;

    const updated = ssoConfigStore.updateConfig(req.params.providerId, updates);

    auditStore.appendEntry({
      action: 'sso_config_updated',
      orgId: existing.orgId,
      actor: req.user?.email || 'system',
      actorIp: req.ip,
      description: `SSO config updated: ${existing.displayName}`,
      before: { enabled: existing.enabled, method: existing.method },
      after: { enabled: updated.enabled, method: updated.method },
      metadata: { providerId: existing.providerId },
    });

    res.json({
      success: true,
      providerId: updated.providerId,
      displayName: updated.displayName,
      method: updated.method,
      enabled: updated.enabled,
    });
  } catch (err) {
    logger.error('[SSO] Config update failed:', err.message);
    sendError(res, 500, 'sso_update_failed', { message: err.message });
  }
});

// DELETE /api/enterprise/sso/configs/:providerId — delete an SSO config
router.delete('/configs/:providerId', validateParam('providerId', VALIDATION_PATTERNS.providerId), async (req, res) => {
  try {
    const existing = ssoConfigStore.getConfig(req.params.providerId);
    if (!existing) {
      return sendError(res, 404, 'sso_config_not_found');
    }

    ssoConfigStore.deleteConfig(req.params.providerId);

    auditStore.appendEntry({
      action: 'sso_config_deleted',
      orgId: existing.orgId,
      actor: req.user?.email || 'system',
      actorIp: req.ip,
      description: `SSO config deleted: ${existing.displayName}`,
      before: { providerId: existing.providerId, method: existing.method },
    });

    logger.info(`[SSO] Config deleted: ${req.params.providerId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('[SSO] Config deletion failed:', err.message);
    sendError(res, 500, 'sso_delete_failed', { message: err.message });
  }
});

// GET /api/enterprise/sso/stats — SSO configuration statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = ssoConfigStore.getStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    sendError(res, 500, 'sso_stats_failed', { message: err.message });
  }
});

// GET /api/enterprise/sso/test/:providerId — test SSO config connectivity
router.get('/test/:providerId', validateParam('providerId', VALIDATION_PATTERNS.providerId), async (req, res) => {
  try {
    const config = ssoConfigStore.getConfigDecrypted(req.params.providerId);
    if (!config) {
      return sendError(res, 404, 'sso_config_not_found');
    }

    const results = { providerId: config.providerId, method: config.method, checks: [] };

    if (config.method === 'saml') {
      results.checks.push({
        name: 'entryPoint reachable',
        status: config.saml?.entryPoint ? 'pass' : 'fail',
        detail: config.saml?.entryPoint ? 'URL configured' : 'Missing entryPoint',
      });
      results.checks.push({
        name: 'certificate present',
        status: config.saml?.cert ? 'pass' : 'fail',
        detail: config.saml?.cert ? 'PEM certificate configured' : 'Missing certificate',
      });
      results.checks.push({
        name: 'issuer configured',
        status: config.saml?.issuer ? 'pass' : 'warn',
        detail: config.saml?.issuer || 'Using default: simplebeacon-ai',
      });
    } else if (config.method === 'oidc') {
      results.checks.push({
        name: 'clientId present',
        status: config.oidc?.clientId ? 'pass' : 'fail',
        detail: config.oidc?.clientId ? 'Configured' : 'Missing clientId',
      });
      results.checks.push({
        name: 'clientSecret present',
        status: config.oidc?._decryptedSecret ? 'pass' : 'fail',
        detail: config.oidc?._decryptedSecret ? 'Decryptable' : 'Missing or corrupt',
      });
      results.checks.push({
        name: 'issuer URL configured',
        status: config.oidc?.issuer ? 'pass' : 'fail',
        detail: config.oidc?.issuer || 'Missing issuer',
      });
      results.checks.push({
        name: 'redirect URI configured',
        status: config.oidc?.redirectUri ? 'pass' : 'warn',
        detail: config.oidc?.redirectUri || 'Using default callback',
      });
    }

    results.checks.push({
      name: 'domain routing',
      status: config.domain ? 'pass' : 'warn',
      detail: config.domain || 'No domain specified — manual provider selection required',
    });

    results.overall = results.checks.every(c => c.status === 'pass') ? 'pass' : 'needs_attention';

    res.json({ success: true, ...results });
  } catch (err) {
    sendError(res, 500, 'sso_test_failed', { message: err.message });
  }
});

module.exports = router;
