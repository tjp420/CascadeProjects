'use strict';

/**
 * Daily Ops Report API — manual trigger and scheduler control.
 *
 * POST /api/ops-report/trigger   — generate and send the daily report now
 * GET  /api/ops-report/status    — check scheduler status
 */

const express = require('express');
const { authorize } = require('../middleware/authorize.cjs');
const { sendDailyReport, startScheduler, stopScheduler } = require('../lib/daily-ops-report.cjs');

const router = express.Router();

router.post('/trigger', authorize('admin:all'), async (req, res) => {
  try {
    const to = req.body?.to || undefined;
    const result = await sendDailyReport({ to });
    if (result.sent || result.queued) {
      res.json({ success: true, ...result });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to send report' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate ops report' });
  }
});

router.get('/status', authorize('admin:all'), (req, res) => {
  res.json({
    success: true,
    schedulerEnabled: process.env.OPS_REPORT_ENABLED === 'true',
    recipient: process.env.OPS_REPORT_EMAIL || 'ops@simplebeacon.ai',
    scheduledHour: parseInt(process.env.OPS_REPORT_HOUR || '8', 10)
  });
});

module.exports = router;
