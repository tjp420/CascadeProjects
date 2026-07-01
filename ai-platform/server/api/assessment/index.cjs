// SPDX-License-Identifier: MIT
'use strict';

/**
 * @module assessment
 * Assessment API routes — mounted at /api/assessment.
 *
 * Provides endpoints to trigger a SimpleBeacon scan, retrieve the full
 * assessment report, and download reports in various formats.
 *
 * @example <caption>API usage</caption>
 * // Health check
 * curl http://localhost:3000/api/assessment/health
 *
 * // Trigger a scan
 * curl -X POST http://localhost:3000/api/assessment/scan \
 *   -H "Content-Type: application/json" \
 *   -d '{"repoUrl":"https://github.com/org/repo"}'
 *
 * // Get report
 * curl http://localhost:3000/api/assessment/report/<id>
 *
 * // Download PDF
 * curl -O http://localhost:3000/api/assessment/report/<id>/download/pdf
 *
 * @file server/api/assessment/index.cjs
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
