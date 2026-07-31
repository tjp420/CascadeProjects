/**
 * Audit Log Retrieval API — Paginated audit log endpoint with strict memory limits.
 * Default LIMIT 50, max LIMIT 200. Supports offset-based pagination and filters.
 */

const express = require('express');
const { queryAuditLogs } = require('../middleware/audit.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const logger = require('../lib/app-logger.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

/**
 * GET /api/v2/audit
 * Retrieve paginated audit logs with optional filtering.
 * Query params:
 *   - limit:  number (default 50, max 200)
 *   - offset: number (default 0)
 *   - level:  string (debug|info|warn|error|critical)
 *   - eventType: string
 *   - userId:  string
 *   - startDate: ISO date string
 *   - endDate:   ISO date string
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const filters = {
      limit: req.query.limit,
      offset: req.query.offset,
      level: req.query.level,
      eventType: req.query.eventType,
      userId: req.query.userId,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const result = await queryAuditLogs(filters);

    res.json({
      success: true,
      data: result.entries,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasNext: result.offset + result.limit < result.total,
        hasPrev: result.offset > 0
      }
    });
  } catch (error) {
    logger.error('[Audit API] Failed to retrieve audit logs:', error.message);
    sendError(res, 500, 'Failed to retrieve audit logs', { message: error.message });
  }
});

module.exports = router;
