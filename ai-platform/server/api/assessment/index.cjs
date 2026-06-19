// SPDX-License-Identifier: MIT
/**
 * Assessment API routes — mounted at /api/assessment
 *
 * POST /api/assessment/scan          → clone (optional) + simplebeacon scan + assessment
 * GET  /api/assessment/report/:id    → full assessment JSON
 * GET  /api/assessment/report/:id/download/:format → attachment download
 * GET  /api/assessment/health        → route health
 *
 * @license MIT
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./AssessmentController.cjs');

const constants = require('../../config/constants.cjs');
const router = express.Router();

const RATE_LIMIT_WINDOW_MS = constants.RATE_LIMIT_WINDOW_MS; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_RETRY_SECONDS = 900; // 15 minutes

const assessmentRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests',
    message: 'Assessment API rate limit exceeded. Please try again later.',
    retryAfter: RATE_LIMIT_RETRY_SECONDS
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(assessmentRateLimit);

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
