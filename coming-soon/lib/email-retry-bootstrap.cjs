'use strict';

/**
 * Start background retry for pending rows in email_queue (used by production server).
 */

function startEmailRetryWorker(options = {}) {
    const intervalMs = Number(options.intervalMs || 5 * 60 * 1000);
    const logger = options.logger || console;

    try {
        const { processPendingEmails } = require('../scripts/email-retry-worker.cjs');
        const run = () => processPendingEmails().catch((err) => {
            logger.error('[EmailRetry] Cycle error:', err.message);
        });

        run();
        const timer = setInterval(run, intervalMs);
        if (typeof timer.unref === 'function') timer.unref();

        logger.info(`[EmailRetry] Background worker started (${Math.round(intervalMs / 1000)}s interval).`);
        return { started: true, intervalMs };
    } catch (err) {
        logger.warn('[EmailRetry] Failed to start worker:', err.message);
        return { started: false, error: err.message };
    }
}

module.exports = { startEmailRetryWorker };
