/**
 * Shared Response Helpers — Standardized API response format.
 *
 * Provides sendError() and sendSuccess() helpers to enforce consistent
 * response shapes across all Express route handlers.
 *
 * Target error format (backward-compatible superset):
 *   { success: false, error: '...', message?: '...', code?: '...', details?: '...' }
 *
 * Target success format:
 *   { success: true, ...data }
 *
 * Usage:
 *   const { sendError, sendSuccess } = require('../lib/response-helpers.cjs');
 *   sendError(res, 500, 'stats_failed', { message: err.message });
 *   sendSuccess(res, { scans, total });
 */

/**
 * Send a standardized error response.
 * @param {import('express').Response} res
 * @param {number} status - HTTP status code (400, 401, 403, 404, 500, etc.)
 * @param {string} error - Error message or machine-readable error code
 * @param {Object} [options] - Additional fields merged into the response body
 *   (e.g. { message, code, details, target, schedule, ... })
 * @returns {import('express').Response}
 */
function sendError(res, status, error, options = {}) {
    const { message, code, details, ...extra } = options;
    const body = { success: false, error };
    if (message) body.message = message;
    if (code) body.code = code;
    if (details) body.details = details;
    return res.status(status).json({ ...body, ...extra });
}

/**
 * Send a standardized success response.
 * @param {import('express').Response} res
 * @param {Object} [data] - Additional fields to merge into the response
 * @param {number} [status=200] - HTTP status code
 * @returns {import('express').Response}
 */
function sendSuccess(res, data = {}, status = 200) {
    return res.status(status).json({ success: true, ...data });
}

module.exports = { sendError, sendSuccess };
