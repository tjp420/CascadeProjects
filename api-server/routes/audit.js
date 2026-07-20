/**
 * SimpleBeacon Enterprise Audit Log Routes
 * GET /api/v2/audit — query immutable audit trail (admin/auditor only)
 * GET /api/v2/audit/export — export audit trail as CSV/JSON
 */

const express = require('express');
const db = require('../lib/db.cjs');
const { requireAuth } = require('../lib/auth.js');
const { requirePermission, requireWorkspaceMembership } = require('../lib/rbac.js');

const router = express.Router();

// Pagination and export limits
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 500;
const EXPORT_LIMIT = 10000;
const MAX_PARAM_LENGTH = 200;

function sanitizeParam(v) {
    if (!v || typeof v !== 'string') return v;
    const s = v.trim();
    return s.length > MAX_PARAM_LENGTH ? s.slice(0, MAX_PARAM_LENGTH) : s;
}

function parseIsoDate(value) {
    if (!value) return null;
    const t = Date.parse(value);
    if (Number.isNaN(t)) return null;
    return new Date(t).toISOString();
}

/**
 * GET /api/v2/audit
 * Query parameters:
 *   - workspaceId (optional): filter to specific workspace
 *   - action (optional): filter by action type, e.g. 'scan.triggered'
 *   - resourceType (optional): e.g. 'scan', 'member'
 *   - severity (optional): debug | info | notice | warning | critical
 *   - from, to (optional): ISO date range
 *   - limit (default 50, max 500)
 *   - offset (default 0)
 *
 * Access: audit_log.read permission (admin, manager, auditor)
 */
router.get('/api/v2/audit', requireAuth, requirePermission('audit_log.read'), async (req, res) => {
    let {
        workspaceId,
        action,
        resourceType,
        severity,
        from,
        to,
        limit = DEFAULT_PAGE_LIMIT,
        offset = 0
    } = req.query;

    // Basic sanitization
    action = sanitizeParam(action);
    resourceType = sanitizeParam(resourceType);
    severity = sanitizeParam(severity);
    workspaceId = sanitizeParam(workspaceId);

    // Validate dates early
    if (from && !parseIsoDate(from)) return res.status(400).json({ error: 'Invalid from date; use ISO format' });
    if (to && !parseIsoDate(to)) return res.status(400).json({ error: 'Invalid to date; use ISO format' });

    const conditions = [];
    const params = [];
    let idx = 1;

    if (workspaceId) {
        conditions.push(`workspace_id = $${idx++}`);
        params.push(workspaceId);
    }
    if (action) {
        conditions.push(`action = $${idx++}`);
        params.push(action);
    }
    if (resourceType) {
        conditions.push(`resource_type = $${idx++}`);
        params.push(resourceType);
    }
    if (severity) {
        conditions.push(`severity = $${idx++}`);
        params.push(severity);
    }
    if (from) {
        conditions.push(`created_at >= $${idx++}`);
        params.push(new Date(from).toISOString());
    }
    if (to) {
        conditions.push(`created_at <= $${idx++}`);
        params.push(new Date(to).toISOString());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);
    const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

    try {
        const countResult = await db.get(
            `SELECT COUNT(*)::int AS total FROM audit_log ${whereClause}`,
            params
        );

        const rows = await db.query(
            `SELECT id, workspace_id, user_id, api_key_id, action, resource_type,
                    resource_id, details, ip_address, user_agent, request_id,
                    severity, created_at
             FROM audit_log
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, pageLimit, pageOffset]
        );

        // Pagination helper headers for callers
        res.setHeader('X-Total-Count', String(countResult?.total || 0));
        res.setHeader('X-Limit', String(pageLimit));
        res.setHeader('X-Offset', String(pageOffset));
        res.setHeader('X-Next-Offset', String(pageOffset + pageLimit));
        res.setHeader('X-Prev-Offset', String(Math.max(pageOffset - pageLimit, 0)));
        res.setHeader('Cache-Control', 'no-store');

        res.json({
            total: countResult?.total || 0,
            limit: pageLimit,
            offset: pageOffset,
            events: rows
        });
    } catch (err) {
        res.status(500).json({ error: 'Audit query failed', detail: err.message });
    }
});

/**
 * GET /api/v2/audit/export
 * Export audit trail as JSON or CSV.
 * Query params same as /audit plus `format` (json | csv, default json).
 */
router.get('/api/v2/audit/export', requireAuth, requirePermission('audit_log.read'), async (req, res) => {
    const format = (req.query.format || 'json').toLowerCase();
    let { workspaceId, action, resourceType, severity, from, to } = req.query;
    action = sanitizeParam(action);
    resourceType = sanitizeParam(resourceType);
    severity = sanitizeParam(severity);
    workspaceId = sanitizeParam(workspaceId);

    if (from && !parseIsoDate(from)) return res.status(400).json({ error: 'Invalid from date; use ISO format' });
    if (to && !parseIsoDate(to)) return res.status(400).json({ error: 'Invalid to date; use ISO format' });

    if (!['json', 'csv'].includes(format)) return res.status(400).json({ error: 'Invalid format; supported: json, csv' });

    const conditions = [];
    const params = [];
    let idx = 1;

    if (workspaceId) { conditions.push(`workspace_id = $${idx++}`); params.push(workspaceId); }
    if (action) { conditions.push(`action = $${idx++}`); params.push(action); }
    if (resourceType) { conditions.push(`resource_type = $${idx++}`); params.push(resourceType); }
    if (severity) { conditions.push(`severity = $${idx++}`); params.push(severity); }
    if (from) { conditions.push(`created_at >= $${idx++}`); params.push(new Date(from).toISOString()); }
    if (to) { conditions.push(`created_at <= $${idx++}`); params.push(new Date(to).toISOString()); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
        const rows = await db.query(
            `SELECT id, workspace_id, user_id, api_key_id, action, resource_type,
                    resource_id, details, ip_address, user_agent, request_id,
                    severity, created_at
             FROM audit_log
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT ${EXPORT_LIMIT}`,
            params
        );
        res.setHeader('Cache-Control', 'no-store');

        if (format === 'csv') {
            const headers = ['id', 'workspace_id', 'user_id', 'api_key_id', 'action', 'resource_type',
                'resource_id', 'ip_address', 'user_agent', 'request_id', 'severity', 'created_at'];
            const lines = [headers.join(',')];
            for (const row of rows) {
                lines.push(headers.map(h => {
                    const v = row[h] !== null && row[h] !== undefined ? String(row[h]) : '';
                    return '"' + v.replace(/"/g, '""') + '"';
                }).join(','));
            }
            const csv = lines.join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
            return res.send(csv);
        }

        res.json({ total: rows.length, events: rows });
    } catch (err) {
        res.status(500).json({ error: 'Audit export failed', detail: err.message });
    }
});

module.exports = router;
