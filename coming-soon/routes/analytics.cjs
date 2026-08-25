/**
 * Funnel analytics tracking endpoint.
 * Receives client-side events (page views, CTA clicks, scan runs, checkout starts).
 * Stores events in the SQLite DB for funnel analysis.
 * All tracking is anonymous — no PII, no source code, best-effort delivery.
 */

'use strict';

const express = require('express');
const router = express.Router();

// In-memory event buffer (flushed to DB if available, otherwise kept in memory)
const eventBuffer = [];
const MAX_BUFFER = 1000;

// Rate limiter: max 60 events per IP per minute (prevents abuse)
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 60;
const rateLog = new Map();

function checkRate(ip) {
    const now = Date.now();
    const entry = rateLog.get(ip);
    if (entry && now < entry.resetAt) {
        if (entry.count >= RATE_MAX) return false;
        entry.count++;
    } else {
        rateLog.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    }
    return true;
}

// Periodic cleanup of rate log
setInterval(
    () => {
        const now = Date.now();
        for (const [ip, entry] of rateLog) {
            if (now >= entry.resetAt) rateLog.delete(ip);
        }
    },
    5 * 60 * 1000
);

// Try to load DB for persistent storage
let db = null;
try {
    db = require('../lib/db.cjs');
} catch (e) {
    db = null;
}

// Try to create events table if DB is available
try {
    if (db && typeof db.run === 'function') {
        db.run(`CREATE TABLE IF NOT EXISTS funnel_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event TEXT NOT NULL,
            page TEXT,
            session_id TEXT,
            utm_source TEXT,
            utm_medium TEXT,
            utm_campaign TEXT,
            utm_content TEXT,
            utm_term TEXT,
            payload TEXT,
            ip_hash TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )`);
    }
} catch (e) {
    // DB not available — events stay in memory buffer
}

function hashIp(ip) {
    const crypto = require('crypto');
    return crypto
        .createHash('sha256')
        .update(String(ip || '') + (process.env.SIMPLEBEACON_LICENSE_SECRET || 'fallback'))
        .digest('hex')
        .slice(0, 16);
}

function persistEvent(eventData) {
    const utm = eventData.utm || {};
    const payloadStr = JSON.stringify(eventData.data || {});

    // Try DB first
    if (db && typeof db.run === 'function') {
        try {
            db.run(
                `INSERT INTO funnel_events (event, page, session_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, payload, ip_hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                eventData.event,
                eventData.page || null,
                eventData.sessionId || null,
                utm.utm_source || null,
                utm.utm_medium || null,
                utm.utm_campaign || null,
                utm.utm_content || null,
                utm.utm_term || null,
                payloadStr,
                eventData.ipHash || null
            );
            return;
        } catch (e) {
            // Fall through to buffer
        }
    }

    // Fallback: in-memory buffer
    eventBuffer.push(eventData);
    if (eventBuffer.length > MAX_BUFFER) eventBuffer.shift();
}

router.post('/api/track', express.json({ limit: '256kb' }), (req, res) => {
    try {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';

        if (!checkRate(ip)) {
            return res.status(429).json({ error: 'Rate limited' });
        }

        const body = req.body || {};
        const event = String(body.event || '').slice(0, 100);
        if (!event) {
            return res.status(400).json({ error: 'Event name required' });
        }

        const eventData = {
            event: event,
            page: String(body.page || '').slice(0, 200),
            sessionId: String(body.sessionId || '').slice(0, 100),
            utm: body.utm || {},
            data: body.data || body.payload || {},
            ipHash: hashIp(ip),
            timestamp: body.timestamp || new Date().toISOString()
        };

        persistEvent(eventData);

        return res.status(202).json({ received: true });
    } catch (err) {
        // Analytics should never break the page — fail silently
        return res.status(202).json({ received: true });
    }
});

// Admin endpoint to read funnel events (protected)
router.get('/api/funnel/events', (req, res) => {
    try {
        // Basic auth check — in production, wire to real auth middleware
        const authHeader = req.get('authorization') || '';
        if (!authHeader.startsWith('Bearer ') && process.env.NODE_ENV === 'production') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        if (db && typeof db.all === 'function') {
            try {
                const rows = db.all(
                    `SELECT event, page, session_id, utm_source, utm_medium, utm_campaign, payload, created_at
                     FROM funnel_events ORDER BY created_at DESC LIMIT ? OFFSET ?`,
                    limit,
                    offset
                );
                return res.json({ events: rows, source: 'db' });
            } catch (e) {
                // Fall through to buffer
            }
        }

        return res.json({ events: eventBuffer.slice(-limit), source: 'memory' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to read events' });
    }
});

// Funnel summary — counts by event type
router.get('/api/funnel/summary', (req, res) => {
    try {
        if (db && typeof db.all === 'function') {
            try {
                const rows = db.all(
                    `SELECT event, COUNT(*) as count, COUNT(DISTINCT session_id) as unique_sessions
                     FROM funnel_events
                     WHERE created_at >= datetime('now', '-30 days')
                     GROUP BY event ORDER BY count DESC`
                );
                return res.json({ summary: rows, source: 'db', window: '30d' });
            } catch (e) {
                // Fall through
            }
        }

        // In-memory fallback
        const counts = {};
        for (const e of eventBuffer) {
            counts[e.event] = (counts[e.event] || 0) + 1;
        }
        return res.json({ summary: counts, source: 'memory', window: 'buffer' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to build summary' });
    }
});

module.exports = router;
