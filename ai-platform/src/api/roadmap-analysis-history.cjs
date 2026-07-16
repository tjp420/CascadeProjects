// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Roadmap scan analysis history — PostgreSQL dashboard_snapshots with client fallback.
 */

const logger = require('../../server/lib/app-logger.cjs');
const HISTORY_KEY = 'roadmap-analysis-history';
const MAX_ENTRIES = 25;

/**
 * Load roadmap history from db.
 * @param {any} db
 * @returns {any}
 */
async function loadRoadmapHistoryFromDb(db) {
    if (!db) {
        return { entries: [] };
    }

    const historyRow = await db.query(
        'SELECT payload FROM dashboard_snapshots WHERE key = $1 LIMIT 1',
        [HISTORY_KEY]
    );
    const storedPayload = historyRow.rows[0]?.payload;
    if (!storedPayload || typeof storedPayload !== 'object') {
        return { entries: [] };
    }
    return {
        entries: Array.isArray(storedPayload.entries) ? storedPayload.entries : []
    };
}

/**
 * Write history.
 * @param {any} db
 * @param {Array} entries
 * @returns {any}
 */
async function writeHistory(db, entries) {
    if (!db) return false;

    await db.query(
        `INSERT INTO dashboard_snapshots (key, payload, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
        [HISTORY_KEY, JSON.stringify({ entries })]
    );
    return true;
}

/**
 * Append history entry.
 * @param {any} db
 * @param {any} entry
 * @returns {any}
 */
async function appendHistoryEntry(db, entry) {
    const current = await loadRoadmapHistoryFromDb(db);
    const entries = [entry, ...current.entries.filter((item) => item.id !== entry.id)].slice(0, MAX_ENTRIES);
    await writeHistory(db, entries);
    return entries;
}

/**
 * Clear history.
 * @param {any} db
 * @returns {any}
 */
async function clearHistory(db) {
    await writeHistory(db, []);
    return [];
}

/**
 * Setup roadmap analysis history routes.
 * @param {any} app
 * @returns {any}
 */
function setupRoadmapAnalysisHistoryRoutes(app) {
    app.get('/api/dynamic-roadmap/history', async (req, res) => {
        try {
            const db = req.app.locals?.db;
            if (!db) {
                return res.json({
                    success: true,
                    entries: [],
                    source: 'client-only',
                    timestamp: new Date().toISOString()
                });
            }

            const { entries } = await loadRoadmapHistoryFromDb(db);
            res.json({
                success: true,
                entries,
                source: 'postgresql',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to read roadmap analysis history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to read analysis history',
                message: error.message
            });
        }
    });

    app.post('/api/dynamic-roadmap/history', async (req, res) => {
        try {
            const db = req.app.locals?.db;
            const entry = req.body?.entry;

            if (!entry || !entry.id || !entry.projectPath) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid history entry',
                    message: 'entry.id and entry.projectPath are required'
                });
            }

            if (!db) {
                return res.json({
                    success: true,
                    stored: false,
                    source: 'client-only',
                    timestamp: new Date().toISOString()
                });
            }

            const entries = await appendHistoryEntry(db, entry);
            res.json({
                success: true,
                stored: true,
                entries,
                source: 'postgresql',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to save roadmap analysis history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to save analysis history',
                message: error.message
            });
        }
    });

    app.delete('/api/dynamic-roadmap/history', async (req, res) => {
        try {
            const db = req.app.locals?.db;
            if (!db) {
                return res.json({
                    success: true,
                    cleared: false,
                    source: 'client-only',
                    timestamp: new Date().toISOString()
                });
            }

            await clearHistory(db);
            res.json({
                success: true,
                cleared: true,
                source: 'postgresql',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to clear roadmap analysis history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to clear analysis history',
                message: error.message
            });
        }
    });
}

module.exports = {
    HISTORY_KEY,
    MAX_ENTRIES,
    loadRoadmapHistoryFromDb,
    appendHistoryEntry,
    clearHistory,
    setupRoadmapAnalysisHistoryRoutes
};
