/**
 * Route Parameter Validation Middleware
 *
 * Provides format validation for route parameters to enforce
 * defense-in-depth and fail fast on malformed input.
 *
 * Usage:
 *   const { validateParam, VALIDATION_PATTERNS } = require('../middleware/validate-params.cjs');
 *   router.get('/org/:orgId', validateParam('orgId', VALIDATION_PATTERNS.orgId), handler);
 */

/**
 * Canonical validation patterns for route parameters.
 * @type {Object<string, RegExp>}
 */
const VALIDATION_PATTERNS = {
    // Alphanumeric slug (org IDs, user IDs) — max 100 chars
    orgId: /^[a-zA-Z0-9_-]{1,100}$/,
    userId: /^[a-zA-Z0-9_-]{1,100}$/,
    // Whitelabel partner ID — wl- + 8 hex chars
    partnerId: /^wl-[a-f0-9]{8}$/,
    // Integration config ID — int- + 8 hex chars
    configId: /^int-[a-f0-9]{8}$/,
    // SSO provider ID — sso- + 8 hex chars
    providerId: /^sso-[a-f0-9]{8}$/,
    // SSO provider name — lowercase alphabetic, 3-20 chars
    provider: /^[a-z]{3,20}$/,
    // UUID — standard 36-char format with hyphens
    uuid: /^[a-f0-9-]{36}$/,
};

/**
 * Create a validation middleware for a specific route parameter.
 * @param {string} paramName - The req.params key to validate.
 * @param {RegExp} pattern - The regex pattern to test against.
 * @returns {import('express').RequestHandler}
 */
function validateParam(paramName, pattern) {
    return (req, res, next) => {
        const value = req.params[paramName];
        if (value === undefined || value === null || !pattern.test(String(value))) {
            return res.status(400).json({
                error: 'invalid_parameter',
                message: `Invalid ${paramName} format`,
                paramName,
                received: String(value).slice(0, 50),
            });
        }
        next();
    };
}

module.exports = { validateParam, VALIDATION_PATTERNS };
