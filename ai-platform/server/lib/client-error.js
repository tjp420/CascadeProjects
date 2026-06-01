/**
 * Sanitize errors returned to API clients — generic messages in production.
 */

function isProduction() {
    return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function toClientError(error, fallback = 'An unexpected error occurred') {
    if (!error) return fallback;
    const message = typeof error === 'string' ? error : error.message;
    if (message && /outside allowed analysis roots/i.test(message)) {
        return message;
    }
    if (isProduction()) {
        return fallback;
    }
    return message || fallback;
}

function clientErrorPayload(error, options = {}) {
    const fallback = options.fallback || 'An unexpected error occurred';
    const payload = {
        error: options.errorLabel || 'Request failed',
        message: toClientError(error, fallback)
    };
    if (options.requestId) payload.requestId = options.requestId;
    return payload;
}

module.exports = {
    isProduction,
    toClientError,
    clientErrorPayload
};
