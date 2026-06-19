const logger = require('../lib/production-logger.cjs');
/**
 * Public trust verification API — read-only, no auth required.
 */

const path = require('path');
const fs = require('fs');
const {
    buildTrustVerificationPayload,
    buildTrustBadgeSvg,
    buildTrustVerifyHtml,
    buildTrustVerifyCompact,
    buildTrustBadgeHtml
} = require('../../server/lib/trust-verification-payload.cjs');
const {
    resolveTrustHistoryPath,
    readTrustHistory,
    buildTrustTrend
} = require('../../server/lib/trust-history-store.cjs');
const { readJsonFileCached } = require('../../server/lib/json-file-cache.cjs');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const PUBLIC_TRUST_PATH = path.join(PROJECT_ROOT, 'public', 'trust-verification.json');

/**
 * Wants html response.
 * @param {any} req
 * @returns {any}
 */
function wantsHtmlResponse(req) {
    if (String(req.query.format || '').toLowerCase() === 'html') return true;
    if (String(req.query.format || '').toLowerCase() === 'json') return false;
    const accept = String(req.headers.accept || '');
    return accept.includes('text/html') && !accept.includes('application/json');
}

/**
 * Wants raw svg.
 * @param {any} req
 * @returns {any}
 */
function wantsRawSvg(req) {
    const raw = String(req.query.raw || '').toLowerCase().trim();
    return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * Read published trust payload.
 * @returns {any}
 */
function readPublishedTrustPayload() {
    if (!fs.existsSync(PUBLIC_TRUST_PATH)) return null;
    return readJsonFileCached(PUBLIC_TRUST_PATH);
}

/**
 * Build live trust payload.
 * @param {any} platformRoot
 * @param {any} monorepoRoot
 * @returns {any}
 */
function buildLiveTrustPayload(platformRoot, monorepoRoot) {
    return buildTrustVerificationPayload({
        platformRoot,
        monorepoRoot
    });
}

/**
 * Build verification envelope.
 * @param {any} live
 * @param {any} published
 * @returns {any}
 */
function buildVerificationEnvelope(live, published) {
    return {
        success: true,
        ...live,
        publishedAt: published?.generatedAt || null
    };
}

/**
 * Parse positive integer.
 * @param {any} value
 * @param {any} fallback
 * @returns {any}
 */
function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Build scope transparency.
 * @param {any} payload
 * @returns {any}
 */
function buildScopeTransparency(payload) {
    const primary = payload?.headlineSource === 'monorepo' ? payload?.monorepo : payload?.platform;
    const repositoryFilesTotal = primary?.repositoryFilesTotal ?? payload?.headline?.repositoryFilesTotal ?? null;
    const ruleScopedFilesAnalyzed = primary?.ruleScopedFilesAnalyzed ?? payload?.headline?.ruleScopedFilesAnalyzed ?? null;
    const coveragePercent = repositoryFilesTotal && ruleScopedFilesAnalyzed
        ? Number(((ruleScopedFilesAnalyzed / Math.max(repositoryFilesTotal, 1)) * 100).toFixed(2))
        : null;
    const fiction = payload?.fictionScope || null;
    return {
        headlineSource: payload?.headlineSource || null,
        repositoryFilesTotal,
        ruleScopedFilesAnalyzed,
        coveragePercent,
        fictionScope: fiction?.mode || null,
        fictionJsonFilesScanned: fiction?.fictionJsonFilesScanned ?? primary?.fictionJsonFilesScanned ?? null,
        fictionSampleFilesScanned: fiction?.fictionSampleFilesScanned ?? primary?.fictionSampleFilesScanned ?? null,
        fictionWalkRoot: fiction?.walkRoot ?? null,
        limitations: primary?.scopeNote
            ? [primary.scopeNote]
            : payload?.disclaimers || []
    };
}

/**
 * Build badge unavailable svg.
 * @param {string} message
 * @returns {any}
 */
function buildBadgeUnavailableSvg(message = 'trust badge unavailable') {
    const safeMessage = String(message)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .slice(0, 120);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="72" viewBox="0 0 320 72" role="img" aria-label="Trust badge unavailable">
  <rect width="320" height="72" rx="8" fill="#161b22" stroke="#d29922" stroke-width="2"/>
  <text x="12" y="28" fill="#f0f6fc" font-family="Inter,Segoe UI,sans-serif" font-size="14" font-weight="600">SimpleBeacon badge unavailable</text>
  <text x="12" y="50" fill="#8b949e" font-family="Inter,Segoe UI,sans-serif" font-size="10">${safeMessage}</text>
</svg>`;
}

/**
 * Setup trust a p i.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function setupTrustAPI(app, options = {}) {
    const platformRoot = options.platformRoot || PROJECT_ROOT;
    const monorepoRoot = options.monorepoRoot || path.join(platformRoot, '..');
    const trustHistoryPath = resolveTrustHistoryPath(platformRoot, options.trustHistoryPath);

    app.get('/api/trust/verification', (req, res) => {
        try {
            const cached = readPublishedTrustPayload();
            const live = buildLiveTrustPayload(platformRoot, monorepoRoot);
            res.set('Cache-Control', 'public, max-age=300');
            const includePublished = String(req.query.includePublished || '').toLowerCase();
            if (includePublished === '1' || includePublished === 'true' || includePublished === 'yes') {
                return res.json({
                    success: true,
                    live,
                    published: cached,
                    publishedAt: cached?.generatedAt || null
                });
            }
            return res.json(buildVerificationEnvelope(live, cached));
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/trust/badge.svg', (req, res) => {
        const forceRaw = wantsRawSvg(req);
        const explicitHtml = String(req.query.format || '').toLowerCase() === 'html';
        const wantsHtml = !forceRaw && explicitHtml;
        try {
            const payload = buildLiveTrustPayload(platformRoot, monorepoRoot);
            if (wantsHtml) {
                const origin = `${req.protocol}://${req.get('host')}`;
                res.set('Content-Type', 'text/html; charset=utf-8');
                res.set('Cache-Control', 'public, max-age=300');
                return res.send(buildTrustBadgeHtml(payload, origin));
            }
            const svg = buildTrustBadgeSvg(payload);
            res.set('Content-Type', 'image/svg+xml; charset=utf-8');
            res.set('Cache-Control', 'public, max-age=300');
            return res.send(svg);
        } catch (error) {
            if (wantsHtml) {
                res.status(500).set('Content-Type', 'text/html; charset=utf-8');
                return res.send(`<!DOCTYPE html><html><body><h1>Badge unavailable</h1><p>${error.message}</p></body></html>`);
            }
            res.status(500).set('Content-Type', 'image/svg+xml; charset=utf-8');
            return res.send(buildBadgeUnavailableSvg(error.message));
        }
    });

    app.get('/api/trust/badge', (req, res) => {
        try {
            const payload = buildTrustVerificationPayload({ platformRoot, monorepoRoot });
            const origin = `${req.protocol}://${req.get('host')}`;
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('Cache-Control', 'public, max-age=300');
            res.send(buildTrustBadgeHtml(payload, origin));
        } catch (error) {
            res.status(500).set('Content-Type', 'text/html; charset=utf-8');
            res.send(`<!DOCTYPE html><html><body><h1>Badge unavailable</h1><p>${error.message}</p></body></html>`);
        }
    });

    app.get('/api/trust/verify', (req, res) => {
        try {
            const payload = buildLiveTrustPayload(platformRoot, monorepoRoot);
            const _published = readPublishedTrustPayload();
            res.set('Cache-Control', 'public, max-age=300');
            if (wantsHtmlResponse(req)) {
                res.set('Content-Type', 'text/html; charset=utf-8');
                return res.send(buildTrustVerifyHtml(payload));
            }
            return res.json(buildTrustVerifyCompact(payload));
        } catch (error) {
            if (wantsHtmlResponse(req)) {
                res.status(500).set('Content-Type', 'text/html; charset=utf-8');
                return res.send(`<!DOCTYPE html><html><body><h1>Trust verify unavailable</h1><p>${error.message}</p></body></html>`);
            }
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/trust/history', (req, res) => {
        try {
            const history = readTrustHistory(trustHistoryPath);
            const limit = Number.parseInt(String(req.query.limit || ''), 10);
            const hasLimit = Number.isFinite(limit) && limit > 0;
            const entries = hasLimit
                ? history.entries.slice(0, Math.min(limit, 365))
                : history.entries;
            const trend = buildTrustTrend(entries, Number.parseInt(String(req.query.window || ''), 10) || 30);
            res.set('Cache-Control', 'public, max-age=120');
            return res.json({
                success: true,
                type: history.type,
                version: history.version,
                historyPath: history.historyPath,
                count: entries.length,
                trend,
                entries
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/trust/trend', (req, res) => {
        try {
            const history = readTrustHistory(trustHistoryPath);
            const window = Number.parseInt(String(req.query.window || ''), 10) || 30;
            const entries = history.entries.slice(0, Math.max(1, Math.min(window, 365)));
            const trend = buildTrustTrend(entries, window);
            res.set('Cache-Control', 'public, max-age=120');
            return res.json({
                success: true,
                type: 'simplebeacon-trust-trend',
                historyCount: history.entries.length,
                trend
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/trust/methodology', (req, res) => {
        try {
            const payload = buildLiveTrustPayload(platformRoot, monorepoRoot);
            const history = readTrustHistory(trustHistoryPath);
            const window = parsePositiveInteger(req.query.window, 30);
            const entries = history.entries.slice(0, Math.min(window, 365));
            const trend = buildTrustTrend(entries, window);
            res.set('Cache-Control', 'public, max-age=300');
            return res.json({
                success: true,
                type: 'simplebeacon-trust-methodology',
                verificationMethod: payload.verificationMethod || null,
                methodology: payload.methodology || [],
                disclaimers: payload.disclaimers || [],
                fictionScope: payload.fictionScope || null,
                scope: buildScopeTransparency(payload),
                trend
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    logger.debug('✅ Trust verification API at /api/trust/verification (public)');
}

module.exports = { setupTrustAPI, PUBLIC_TRUST_PATH };

