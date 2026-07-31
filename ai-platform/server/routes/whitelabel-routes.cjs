'use strict';

/**
 * Whitelabel Partner Branding API — CRUD endpoints for managing partner
 * brand configurations, domain routing, sub-tenant assignment, and
 * dynamic CSS serving.
 *
 * Endpoints:
 *   GET    /api/whitelabel/partners             — List all partners
 *   POST   /api/whitelabel/partners             — Create partner
 *   GET    /api/whitelabel/partners/:partnerId  — Get partner details
 *   PUT    /api/whitelabel/partners/:partnerId  — Update partner
 *   DELETE /api/whitelabel/partners/:partnerId  — Delete partner
 *   GET    /api/whitelabel/resolve              — Resolve brand by domain
 *   GET    /api/whitelabel/:partnerId/brand.css — Dynamic CSS
 *   POST   /api/whitelabel/partners/:partnerId/subtenants   — Add sub-tenant
 *   DELETE /api/whitelabel/partners/:partnerId/subtenants/:orgId — Remove sub-tenant
 *   GET    /api/whitelabel/stats                — Partner stats
 *
 * @module whitelabel-routes
 */

const express = require('express');
const logger = require('../lib/app-logger.cjs');
const wlStore = require('../lib/whitelabel-config-store.cjs');
const { validateParam, VALIDATION_PATTERNS } = require('../middleware/validate-params.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

// GET /api/whitelabel/stats
router.get('/stats', (req, res) => {
  try {
    res.json({ success: true, ...wlStore.getStats() });
  } catch (err) {
    logger.warn('[Whitelabel] stats_failed failed:', err.message);
    sendError(res, 500, 'stats_failed', { message: err.message });
  }
});

// GET /api/whitelabel/partners — list all
router.get('/partners', (req, res) => {
  try {
    const partners = wlStore.getAllPartners();
    res.json({ success: true, partners });
  } catch (err) {
    logger.warn('[Whitelabel] list_failed failed:', err.message);
    sendError(res, 500, 'list_failed', { message: err.message });
  }
});

// POST /api/whitelabel/partners — create
router.post('/partners', (req, res) => {
  try {
    const partner = wlStore.createPartner(req.body || {});
    res.status(201).json({ success: true, partner });
  } catch (err) {
    logger.error('[Whitelabel] Create failed:', err.message);
    sendError(res, 400, 'create_failed', { message: err.message });
  }
});

// GET /api/whitelabel/partners/:partnerId
router.get(
  '/partners/:partnerId',
  validateParam('partnerId', VALIDATION_PATTERNS.partnerId),
  (req, res) => {
    try {
      const partner = wlStore.getPartner(req.params.partnerId);
      if (!partner) return sendError(res, 404, 'not_found');
      res.json({ success: true, partner });
    } catch (err) {
      logger.warn('[Whitelabel] get_failed failed:', err.message);
      sendError(res, 500, 'get_failed', { message: err.message });
    }
  }
);

// PUT /api/whitelabel/partners/:partnerId
router.put(
  '/partners/:partnerId',
  validateParam('partnerId', VALIDATION_PATTERNS.partnerId),
  (req, res) => {
    try {
      const partner = wlStore.updatePartner(req.params.partnerId, req.body || {});
      res.json({ success: true, partner });
    } catch (err) {
      logger.warn('[Whitelabel] update_failed failed:', err.message);
      sendError(res, 400, 'update_failed', { message: err.message });
    }
  }
);

// DELETE /api/whitelabel/partners/:partnerId
router.delete(
  '/partners/:partnerId',
  validateParam('partnerId', VALIDATION_PATTERNS.partnerId),
  (req, res) => {
    try {
      const deleted = wlStore.deletePartner(req.params.partnerId);
      if (!deleted) return sendError(res, 404, 'not_found');
      res.json({ success: true, deleted: true });
    } catch (err) {
      logger.warn('[Whitelabel] delete_failed failed:', err.message);
      sendError(res, 500, 'delete_failed', { message: err.message });
    }
  }
);

// GET /api/whitelabel/resolve?domain=example.com
router.get('/resolve', (req, res) => {
  try {
    const domain = req.query.domain || req.hostname || '';
    const partner = wlStore.resolveByDomain(domain);
    if (!partner) {
      return res.json({ success: true, found: false, brand: wlStore.DEFAULT_BRAND });
    }
    res.json({ success: true, found: true, partnerId: partner.partnerId, brand: partner.brand });
  } catch (err) {
    logger.warn('[Whitelabel] resolve_failed failed:', err.message);
    sendError(res, 500, 'resolve_failed', { message: err.message });
  }
});

// GET /api/whitelabel/:partnerId/brand.css — dynamic CSS injection
router.get(
  '/:partnerId/brand.css',
  validateParam('partnerId', VALIDATION_PATTERNS.partnerId),
  (req, res) => {
    try {
      const css = wlStore.getBrandCss(req.params.partnerId);
      if (!css) return sendError(res, 404, 'not_found');
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(css);
    } catch (err) {
      logger.warn('[Whitelabel] css_failed failed:', err.message);
      sendError(res, 500, 'css_failed', { message: err.message });
    }
  }
);

// GET /api/whitelabel/brand.css?domain=example.com — domain-resolved CSS
router.get('/brand.css', (req, res) => {
  try {
    const domain = req.query.domain || req.hostname || '';
    const result = wlStore.resolveBrandCssByDomain(domain);
    if (!result) {
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send('/* No whitelabel partner found for this domain */');
    }
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Whitelabel-Partner', result.partnerId);
    res.send(result.css);
  } catch (err) {
    logger.warn('[Whitelabel] css_failed failed:', err.message);
    sendError(res, 500, 'css_failed', { message: err.message });
  }
});

// POST /api/whitelabel/partners/:partnerId/subtenants
router.post(
  '/partners/:partnerId/subtenants',
  validateParam('partnerId', VALIDATION_PATTERNS.partnerId),
  (req, res) => {
    try {
      const partner = wlStore.addSubTenant(req.params.partnerId, req.body || {});
      res.status(201).json({ success: true, subTenants: partner.subTenants });
    } catch (err) {
      logger.warn('[Whitelabel] add_subtenant_failed failed:', err.message);
      sendError(res, 400, 'add_subtenant_failed', { message: err.message });
    }
  }
);

// DELETE /api/whitelabel/partners/:partnerId/subtenants/:orgId
router.delete(
  '/partners/:partnerId/subtenants/:orgId',
  validateParam('partnerId', VALIDATION_PATTERNS.partnerId),
  validateParam('orgId', VALIDATION_PATTERNS.orgId),
  (req, res) => {
    try {
      const partner = wlStore.removeSubTenant(req.params.partnerId, req.params.orgId);
      res.json({ success: true, subTenants: partner.subTenants });
    } catch (err) {
      logger.warn('[Whitelabel] remove_subtenant_failed failed:', err.message);
      sendError(res, 400, 'remove_subtenant_failed', { message: err.message });
    }
  }
);

module.exports = router;
