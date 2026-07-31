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
    retryAfter: RATE_LIMIT_RETRY_SECONDS,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Wrap async route handlers so rejected promises are forwarded to the error handler. */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Validate POST /scan body fields. */
function validateScanBody(req, res, next) {
  const { repoUrl, projectPath, email } = req.body || {};
  const errors = [];
  if (repoUrl !== undefined && (typeof repoUrl !== 'string' || !repoUrl.startsWith('http'))) {
    errors.push({ field: 'repoUrl', message: 'repoUrl must be a valid HTTP/HTTPS URL string' });
  }
  if (projectPath !== undefined && (typeof projectPath !== 'string' || !projectPath.trim())) {
    errors.push({ field: 'projectPath', message: 'projectPath must be a non-empty string' });
  }
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'email must be a valid email address' });
  }
  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }
  next();
}

/** Validate GET /report/:id params. */
function validateReportId(req, res, next) {
  const id = req.params.id || req.params.assessmentId;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ success: false, error: 'Invalid report ID format' });
  }
  next();
}

/** Validate GET /report/:id/download/:format params. */
function validateDownloadParams(req, res, next) {
  const id = req.params.id || req.params.assessmentId;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ success: false, error: 'Invalid report ID format' });
  }
  const allowedFormats = ['json', 'pdf', 'html'];
  if (!allowedFormats.includes(req.params.format)) {
    return res.status(400).json({
      success: false,
      error: `Invalid format. Must be one of: ${allowedFormats.join(', ')}`,
    });
  }
  next();
}

/** Centralized error handler — must be registered last on the router. */
function assessmentErrorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.name || 'Error',
    message: err.message || 'Internal server error',
  });
}

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'assessment-api',
    routes: [
      'POST /api/assessment/scan',
      'GET /api/assessment/report/:id',
      'GET /api/assessment/report/:id/download/:format',
    ],
    timestamp: new Date().toISOString(),
  });
});

router.post(
  '/scan',
  assessmentRateLimit,
  validateScanBody,
  asyncHandler((req, res) => controller.triggerScan(req, res))
);
router.get(
  '/report/:id',
  assessmentRateLimit,
  validateReportId,
  asyncHandler((req, res) => controller.getReport(req, res))
);
router.get(
  '/report/:id/download/:format',
  assessmentRateLimit,
  validateDownloadParams,
  asyncHandler((req, res) => controller.downloadReport(req, res))
);

router.use(assessmentErrorHandler);

module.exports = router;
