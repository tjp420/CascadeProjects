/**
 * Sentry initialization for SimpleBeacon backend.
 *
 * Reads SSENTRY_DSN from env. If not set, Sentry is a no-op —
 * all capture functions safely do nothing.
 */

'use strict';

let Sentry = null;
let initialized = false;

function initSentry() {
    if (initialized) return Sentry;
    initialized = true;

    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        return null;
    }

    try {
        Sentry = require('@sentry/node');
        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
            profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
            release: process.env.SENTRY_RELEASE || undefined,
            serverName: process.env.RENDER_SERVICE_NAME || 'simplebeacon-server',
        });
        console.log('[Sentry] Initialized — DSN:', dsn.substring(0, 20) + '...');
    } catch (err) {
        console.error('[Sentry] Failed to initialize:', err.message);
        Sentry = null;
    }

    return Sentry;
}

function captureException(error, context) {
    const s = initSentry();
    if (!s) return;
    if (context && typeof context === 'object') {
        s.withScope((scope) => {
            for (const [key, value] of Object.entries(context)) {
                scope.setContext(key, { value });
            }
            s.captureException(error);
        });
    } else {
        s.captureException(error);
    }
}

function captureMessage(message, level) {
    const s = initSentry();
    if (!s) return;
    s.captureMessage(message, level || 'info');
}

function setTag(key, value) {
    const s = initSentry();
    if (!s) return;
    s.setTag(key, value);
}

function setUser(user) {
    const s = initSentry();
    if (!s) return;
    s.setUser(user);
}

module.exports = {
    initSentry,
    captureException,
    captureMessage,
    setTag,
    setUser,
    getSentry: () => Sentry,
};
