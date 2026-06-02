/**
 * Assessment API routes — mounted at /api/assessment
 *
 * POST /api/assessment/scan          → clone (optional) + simplebeacon scan + assessment
 * GET  /api/assessment/report/:id    → full assessment JSON
 * GET  /api/assessment/report/:id/download/:format → attachment download
 * GET  /api/assessment/health        → route health
 */

const express = require('express');
const controller = require('./AssessmentController.cjs');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'assessment-api',
    routes: [
      'POST /api/assessment/scan',
      'GET /api/assessment/report/:id',
      'GET /api/assessment/report/:id/download/:format'
    ],
    timestamp: new Date().toISOString()
  });
});

router.post('/scan', (req, res) => controller.triggerScan(req, res));
router.get('/report/:id', (req, res) => controller.getReport(req, res));
router.get('/report/:id/download/:format', (req, res) => controller.downloadReport(req, res));

module.exports = router;
