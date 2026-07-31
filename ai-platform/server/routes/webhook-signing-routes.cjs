'use strict';

/**
 * Webhook Signing API — Management endpoints for asymmetric webhook signing
 *
 * @module webhook-signing-routes
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/app-logger.cjs');
const signingStore = require('../lib/webhook-signing-store.cjs');
const { authorize } = require('../middleware/authorize.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

router.get('/stats', function (req, res) {
  try { res.json({ success: true, stats: signingStore.getStats() }); }
  catch (err) { sendError(res, 500, 'signing_stats_failed', { message: err.message }); }
});

router.get('/config', function (req, res) {
  try { res.json({ success: true, config: signingStore.getConfig() }); }
  catch (err) { sendError(res, 500, 'signing_config_failed', { message: err.message }); }
});

router.put('/config', authorize('admin:all'), function (req, res) {
  try {
    var result = signingStore.updateConfig(req.body || {});
    logger.info('[WebhookSigning] Config updated by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) { sendError(res, 400, 'signing_config_update_failed', { message: err.message }); }
});

router.post('/config/reset', authorize('admin:all'), function (req, res) {
  try {
    var result = signingStore.resetConfig();
    logger.info('[WebhookSigning] Config reset by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) { sendError(res, 500, 'signing_config_reset_failed', { message: err.message }); }
});

router.get('/keys', function (req, res) {
  try {
    var keys = signingStore.listKeys().map(function (k) {
      return { keyId: k.keyId, algorithm: k.algorithm, orgId: k.orgId, publicKeyPem: k.publicKeyPem, createdAt: k.createdAt };
    });
    res.json({ success: true, keys: keys });
  } catch (err) { sendError(res, 500, 'keys_list_failed', { message: err.message }); }
});

router.post('/keys/generate', authorize('admin:all'), function (req, res) {
  try {
    var keyId = req.body.keyId || 'key-' + crypto.randomBytes(6).toString('hex');
    var algorithm = req.body.algorithm || 'rsa-sha256';
    var orgId = req.body.orgId || null;
    var result = signingStore.generateKeyPair(keyId, algorithm, orgId);
    logger.info('[WebhookSigning] Key generated: ' + keyId + ' (' + algorithm + ') by ' + (req.user && req.user.email || 'admin'));
    res.json({ success: true, key: result });
  } catch (err) { sendError(res, 400, 'key_generation_failed', { message: err.message }); }
});

router.delete('/keys/:keyId', authorize('admin:all'), function (req, res) {
  try {
    var result = signingStore.deleteKey(req.params.keyId);
    logger.info('[WebhookSigning] Key deleted: ' + req.params.keyId + ' by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) { sendError(res, 500, 'key_delete_failed', { message: err.message }); }
});

router.get('/deliveries', function (req, res) {
  try {
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json({ success: true, deliveries: signingStore.getDeliveryHistory(limit) });
  } catch (err) { sendError(res, 500, 'deliveries_list_failed', { message: err.message }); }
});

router.post('/deliveries/clear', authorize('admin:all'), function (req, res) {
  try {
    var result = signingStore.clearDeliveryHistory();
    logger.info('[WebhookSigning] Delivery history cleared by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) { sendError(res, 500, 'deliveries_clear_failed', { message: err.message }); }
});

router.post('/test-sign', authorize('admin:all'), function (req, res) {
  try {
    var payload = req.body.payload || JSON.stringify({ test: true, timestamp: Date.now() });
    var keyId = req.body.keyId || null;
    var result = signingStore.testSign(payload, keyId);
    res.json({ success: true, result: result });
  } catch (err) { sendError(res, 500, 'test_sign_failed', { message: err.message }); }
});

router.post('/verify', function (req, res) {
  try {
    var payload = req.body.payload;
    var signature = req.body.signature;
    var keyId = req.body.keyId;
    if (!payload || !signature || !keyId) return sendError(res, 400, 'payload_signature_and_keyId_required');
    var result = signingStore.verifySignature(payload, signature, keyId);
    res.json({ success: true, result: result });
  } catch (err) { sendError(res, 500, 'verify_failed', { message: err.message }); }
});

module.exports = router;
