/**
 * Sentry initialization for ai-platform server.
 * No-op if SENTRY_DSN is not set.
 */

'use strict';

let Sentry = null;
let initialized = false;

function initSentry() {
    if (initialized) return Sentry;
    initialized = true;

    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return null;

    try {
        Sentry = require('@sentry/node');
        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
            profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
            release: process.env.SENTRY_RELEASE || undefined,
            serverName: process.env.RENDER_SERVICE_NAME || 'simplebeacon-ai-platform',
        });
        console.log('[Sentry] Initialized for ai-platform');
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

module.exports = { initSentry, captureException, captureMessage, getSentry: () => Sentry };
