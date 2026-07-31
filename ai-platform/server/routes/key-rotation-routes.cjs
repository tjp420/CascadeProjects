'use strict';

/**
 * Key Rotation API — Endpoints for managing encryption key rotation.
 *
 * Endpoints:
 *   GET  /api/key-rotation/status     — Current rotation status
 *   GET  /api/key-rotation/history    — Rotation history (no key material)
 *   POST /api/key-rotation/rotate     — Trigger a key rotation (admin only)
 *   POST /api/key-rotation/revoke/:v  — Revoke a retired key version (admin only)
 *
 * @module key-rotation-routes
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const keyRotationStore = require('../lib/key-rotation-store.cjs');
const keyRotationWorker = require('../lib/key-rotation-worker.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

// GET /api/key-rotation/status
router.get('/status', (req, res) => {
  try {
    const status = keyRotationStore.getStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    logger.warn('[KeyRotation] status_failed:', err.message);
    sendError(res, 500, 'key_rotation_status_failed', { message: err.message });
  }
});

// GET /api/key-rotation/history
router.get('/history', (req, res) => {
  try {
    const history = keyRotationStore.getHistory();
    res.json({ success: true, history });
  } catch (err) {
    logger.warn('[KeyRotation] history_failed:', err.message);
    sendError(res, 500, 'key_rotation_history_failed', { message: err.message });
  }
});

// POST /api/key-rotation/rotate — trigger key rotation (admin only)
router.post('/rotate', authorize('admin:all'), (req, res) => {
  try {
    const rotatedBy = req.user?.email || req.user?.id || 'admin';
    logger.info(`[KeyRotation] Rotation triggered by ${rotatedBy}`);

    const result = keyRotationWorker.performRotation(rotatedBy);
    if (!result.success) {
      return sendError(res, 500, 'key_rotation_failed', { message: result.error });
    }

    res.json({
      success: true,
      newVersion: result.newVersion,
      storeResults: result.results,
    });
  } catch (err) {
    logger.error('[KeyRotation] rotate_failed:', err.message);
    sendError(res, 500, 'key_rotation_failed', { message: err.message });
  }
});

// POST /api/key-rotation/revoke/:version — revoke a retired key (admin only)
router.post('/revoke/:version', authorize('admin:all'), (req, res) => {
  try {
    const version = parseInt(req.params.version, 10);
    if (isNaN(version)) {
      return sendError(res, 400, 'Invalid version number');
    }

    const result = keyRotationStore.revokeKey(version);
    if (!result.success) {
      return sendError(res, 400, 'key_revoke_failed', { message: result.error });
    }

    // Refresh decryption keys so the revoked key is no longer used
    const cryptoUtils = require('../lib/crypto-utils.cjs');
    cryptoUtils.refreshDecryptionKeys();

    logger.info(`[KeyRotation] Key v${version} revoked by ${req.user?.email || 'admin'}`);
    res.json({ success: true, message: `Key version ${version} revoked` });
  } catch (err) {
    logger.warn('[KeyRotation] revoke_failed:', err.message);
    sendError(res, 500, 'key_revoke_failed', { message: err.message });
  }
});

module.exports = router;
