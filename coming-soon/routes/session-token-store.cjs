/**
 * Shared in-memory session-token store.
 * Used by checkout.cjs and subscriptions-billing.cjs to map Stripe session IDs
 * to license tokens so the post-checkout redirect page can retrieve them.
 *
 * Entries expire after 24 hours.
 */
const MS_PER_HOUR = 60 * 60 * 1000;
const SESSION_TOKEN_TTL_MS = 24 * MS_PER_HOUR;

const _store = new Map();

function set(sessionId, entry) {
    _store.set(sessionId, {
        ...entry,
        createdAt: Date.now(),
    });
}

function get(sessionId) {
    const entry = _store.get(sessionId);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > SESSION_TOKEN_TTL_MS) {
        _store.delete(sessionId);
        return null;
    }
    return entry;
}

function cleanup() {
    const now = Date.now();
    for (const [sid, entry] of _store) {
        if (now - entry.createdAt > SESSION_TOKEN_TTL_MS) _store.delete(sid);
    }
}

// Periodic cleanup every hour
setInterval(cleanup, MS_PER_HOUR).unref();

module.exports = { set, get, cleanup };
