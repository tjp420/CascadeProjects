'use strict';

/**
 * Backup Snapshot API — Endpoints for creating, listing, restoring,
 * verifying, and deleting encrypted snapshots of platform state.
 *
 * Endpoints:
 *   GET  /api/backup/stats             — Get snapshot statistics
 *   GET  /api/backup/snapshots         — List all snapshots
 *   GET  /api/backup/snapshots/:id     — Get snapshot details
 *   POST /api/backup/create            — Create a new snapshot (admin:all)
 *   POST /api/backup/restore/:id       — Restore a snapshot (admin:all)
 *   POST /api/backup/verify/:id        — Verify snapshot signature (admin:all)
 *   DELETE /api/backup/snapshots/:id   — Delete a snapshot (admin:all)
 *   GET  /api/backup/config            — Get backup config
 *   PUT  /api/backup/config            — Update backup config (admin:all)
 *   POST /api/backup/config/reset      — Reset config to defaults (admin:all)
 *
 * @module backup-snapshot-routes
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const backupStore = require('../lib/backup-snapshot-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

router.get('/stats', (req, res) => {
  try {
    const stats = backupStore.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    sendError(res, 500, 'backup_stats_failed', { message: err.message });
  }
});

router.get('/snapshots', (req, res) => {
  try {
    const snapshots = backupStore.listSnapshots();
    res.json({ success: true, snapshots, count: snapshots.length });
  } catch (err) {
    sendError(res, 500, 'backup_list_failed', { message: err.message });
  }
});

router.get('/snapshots/:id', (req, res) => {
  try {
    const info = backupStore.getSnapshotInfo(req.params.id);
    if (!info) return sendError(res, 404, 'snapshot_not_found');
    res.json({ success: true, snapshot: info });
  } catch (err) {
    sendError(res, 500, 'backup_info_failed', { message: err.message });
  }
});

router.post('/create', authorize('admin:all'), (req, res) => {
  try {
    const result = backupStore.createSnapshot({ userId: req.user?.email || 'admin' });
    if (!result.success) {
      return sendError(res, 400, 'backup_create_failed', { message: result.error });
    }
    logger.info(`[BackupSnapshot] Snapshot created by ${req.user?.email || 'admin'}: ${result.snapshot.id}`);
    res.json({ success: true, snapshot: result.snapshot });
  } catch (err) {
    sendError(res, 500, 'backup_create_failed', { message: err.message });
  }
});

router.post('/restore/:id', authorize('admin:all'), (req, res) => {
  try {
    const result = backupStore.restoreSnapshot(req.params.id, {
      targetDir: req.body?.targetDir,
    });
    if (!result.success) {
      return sendError(res, 400, 'backup_restore_failed', { message: result.error });
    }
    logger.info(`[BackupSnapshot] Snapshot ${req.params.id} restored by ${req.user?.email || 'admin'}`);
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, 500, 'backup_restore_failed', { message: err.message });
  }
});

router.post('/verify/:id', authorize('admin:all'), (req, res) => {
  try {
    const result = backupStore.verifySnapshot(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, 500, 'backup_verify_failed', { message: err.message });
  }
});

router.delete('/snapshots/:id', authorize('admin:all'), (req, res) => {
  try {
    const result = backupStore.deleteSnapshot(req.params.id);
    if (!result.success) {
      return sendError(res, 400, 'backup_delete_failed', { message: result.error });
    }
    logger.info(`[BackupSnapshot] Snapshot ${req.params.id} deleted by ${req.user?.email || 'admin'}`);
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'backup_delete_failed', { message: err.message });
  }
});

router.get('/config', (req, res) => {
  try {
    const config = backupStore.getConfig();
    res.json({ success: true, config });
  } catch (err) {
    sendError(res, 500, 'backup_config_failed', { message: err.message });
  }
});

router.put('/config', authorize('admin:all'), (req, res) => {
  try {
    const result = backupStore.updateConfig(req.body || {});
    logger.info(`[BackupSnapshot] Config updated by ${req.user?.email || 'admin'}`);
    res.json({ success: true, config: result.config });
  } catch (err) {
    sendError(res, 500, 'backup_config_update_failed', { message: err.message });
  }
});

router.post('/config/reset', authorize('admin:all'), (req, res) => {
  try {
    const result = backupStore.resetConfig();
    logger.info(`[BackupSnapshot] Config reset by ${req.user?.email || 'admin'}`);
    res.json({ success: true, config: result.config });
  } catch (err) {
    sendError(res, 500, 'backup_config_reset_failed', { message: err.message });
  }
});

module.exports = router;
