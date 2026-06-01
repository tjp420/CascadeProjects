/**
 * Roadmap scan analysis history — PostgreSQL dashboard_snapshots with client fallback.
 */

const HISTORY_KEY = 'roadmap-analysis-history';
const MAX_ENTRIES = 25;

async function readHistory(db) {
    if (!db) {
        return { entries: [] };
    }

    const result = await db.query(
        'SELECT payload FROM dashboard_snapshots WHERE key = $1 LIMIT 1',
        [HISTORY_KEY]
    );
    const payload = result.rows[0]?.payload;
    if (!payload || typeof payload !== 'object') {
        return { entries: [] };
    }
    return {
        entries: Array.isArray(payload.entries) ? payload.entries : []
    };
}

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

async function appendHistoryEntry(db, entry) {
    const current = await readHistory(db);
    const entries = [entry, ...current.entries.filter((item) => item.id !== entry.id)].slice(0, MAX_ENTRIES);
    await writeHistory(db, entries);
    return entries;
}

async function clearHistory(db) {
    await writeHistory(db, []);
    return [];
}

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

            const { entries } = await readHistory(db);
            res.json({
                success: true,
                entries,
                source: 'postgresql',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to read roadmap analysis history:', error);
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
            console.error('Failed to save roadmap analysis history:', error);
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
            console.error('Failed to clear roadmap analysis history:', error);
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
    readHistory,
    appendHistoryEntry,
    clearHistory,
    setupRoadmapAnalysisHistoryRoutes
};
