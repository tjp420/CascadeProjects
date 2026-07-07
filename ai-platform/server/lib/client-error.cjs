/**
 * Sanitize errors returned to API clients — generic messages in production.
 *
 * @license MIT
 */

/**
 * Is production.
 * @returns {any}
 */
function isProduction() {
    return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * To client error.
 * @param {any} error
 * @param {any} fallback
 * @returns {any}
 */
function toClientError(error, fallback = 'An unexpected error occurred') {
    if (!error) return fallback;
    const message = typeof error === 'string' ? error : error.message;
    if (process.env.DEBUG_CLIENT_ERRORS === '1') {
        return message || fallback;
    }
    if (message && /outside allowed analysis roots/i.test(message)) {
        return message;
    }
    if (isProduction()) {
        return fallback;
    }
    return message || fallback;
}

/**
 * Client error payload.
 * @param {any} error
 * @param {Object} options
 * @returns {any}
 */
function clientErrorPayload(error, options = {}) {
    const fallback = options.fallback || 'An unexpected error occurred';
    const payload = {
        error: options.errorLabel || 'Request failed',
        message: toClientError(error, fallback)
    };
    if (options.requestId) payload.requestId = options.requestId;
    if (options.extra && typeof options.extra === 'object') {
        for (const key of Object.keys(options.extra)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
            payload[key] = options.extra[key];
        }
    }
    return payload;
}

/**
 * Send client error.
 * @param {Array} res
 * @param {Array} status
 * @param {any} error
 * @param {Object} options
 * @returns {any}
 */
function sendClientError(res, status, error, options = {}) {
    const errorResponseBody = clientErrorPayload(error, options);
    return res.status(status).json(errorResponseBody);
}

const ERROR_CODES = {
    ERR_OUTREACH_MISSING_ID: 'missing_id',
    ERR_OUTREACH_LOG_NOT_FOUND: 'not_found',
    ERR_OUTREACH_REQUEST_FAILED: 'request_failed',
    ERR_INVALID_EMAIL: 'invalid_email',
    ERR_SUBJECT_TOO_SHORT: 'subject_too_short',
    ERR_MESSAGE_TOO_SHORT: 'message_too_short',
    ERR_MESSAGE_TOO_LONG: 'message_too_long',
    ERR_EMAIL_NOT_CONFIGURED: 'email_not_configured',
    ERR_EMAIL_SEND_FAILED: 'email_send_failed'
};

module.exports = {
    isProduction,
    toClientError,
    clientErrorPayload,
    sendClientError,
    ERROR_CODES
};
