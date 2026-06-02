/**
 * Structured inference audit logging for EU AI Act accountability trails.
 */
const crypto = require('crypto');
const logger = require('./app-logger.cjs');

function logInferenceEvent(event = {}) {
    const traceId = event.traceId || crypto.randomUUID();
    logger.info('[ai-audit] inference decision', {
        traceId,
        provider: event.provider || 'unknown',
        operation: event.operation || 'inference',
        projectLabel: event.projectLabel || null,
        outcome: event.outcome || 'ok',
        ...(event.metadata && typeof event.metadata === 'object' ? event.metadata : {})
    });
    return traceId;
}

module.exports = {
    logInferenceEvent
};
