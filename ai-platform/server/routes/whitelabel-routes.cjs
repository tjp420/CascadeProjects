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

const router = express.Router();

// GET /api/whitelabel/stats
router.get('/stats', (req, res) => {
  try {
    res.json({ success: true, ...wlStore.getStats() });
  } catch (err) {
    res.status(500).json({ error: 'stats_failed', message: err.message });
  }
});

// GET /api/whitelabel/partners — list all
router.get('/partners', (req, res) => {
  try {
    const partners = wlStore.getAllPartners();
    res.json({ success: true, partners });
  } catch (err) {
    res.status(500).json({ error: 'list_failed', message: err.message });
  }
});

// POST /api/whitelabel/partners — create
router.post('/partners', (req, res) => {
  try {
    const partner = wlStore.createPartner(req.body || {});
    res.status(201).json({ success: true, partner });
  } catch (err) {
    logger.error('[Whitelabel] Create failed:', err.message);
    res.status(400).json({ error: 'create_failed', message: err.message });
  }
});

// GET /api/whitelabel/partners/:partnerId
router.get('/partners/:partnerId', (req, res) => {
  try {
    const partner = wlStore.getPartner(req.params.partnerId);
    if (!partner) return res.status(404).json({ error: 'not_found' });
    res.json({ success: true, partner });
  } catch (err) {
    res.status(500).json({ error: 'get_failed', message: err.message });
  }
});

// PUT /api/whitelabel/partners/:partnerId
router.put('/partners/:partnerId', (req, res) => {
  try {
    const partner = wlStore.updatePartner(req.params.partnerId, req.body || {});
    res.json({ success: true, partner });
  } catch (err) {
    res.status(400).json({ error: 'update_failed', message: err.message });
  }
});

// DELETE /api/whitelabel/partners/:partnerId
router.delete('/partners/:partnerId', (req, res) => {
  try {
    const deleted = wlStore.deletePartner(req.params.partnerId);
    if (!deleted) return res.status(404).json({ error: 'not_found' });
    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'delete_failed', message: err.message });
  }
});

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
    res.status(500).json({ error: 'resolve_failed', message: err.message });
  }
});

// GET /api/whitelabel/:partnerId/brand.css — dynamic CSS injection
router.get('/:partnerId/brand.css', (req, res) => {
  try {
    const css = wlStore.getBrandCss(req.params.partnerId);
    if (!css) return res.status(404).json({ error: 'not_found' });
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(css);
  } catch (err) {
    res.status(500).json({ error: 'css_failed', message: err.message });
  }
});

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
    res.status(500).json({ error: 'css_failed', message: err.message });
  }
});

// POST /api/whitelabel/partners/:partnerId/subtenants
router.post('/partners/:partnerId/subtenants', (req, res) => {
  try {
    const partner = wlStore.addSubTenant(req.params.partnerId, req.body || {});
    res.status(201).json({ success: true, subTenants: partner.subTenants });
  } catch (err) {
    res.status(400).json({ error: 'add_subtenant_failed', message: err.message });
  }
});

// DELETE /api/whitelabel/partners/:partnerId/subtenants/:orgId
router.delete('/partners/:partnerId/subtenants/:orgId', (req, res) => {
  try {
    const partner = wlStore.removeSubTenant(req.params.partnerId, req.params.orgId);
    res.json({ success: true, subTenants: partner.subTenants });
  } catch (err) {
    res.status(400).json({ error: 'remove_subtenant_failed', message: err.message });
  }
});

module.exports = router;
