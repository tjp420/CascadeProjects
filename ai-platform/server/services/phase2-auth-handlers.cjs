/**
 * Phase 2 login handler — database/demo users with legacy fallback.
 */

const createError = require('http-errors');
const {
    generateToken,
    trustLevels,
    auditAuth,
    handleLogin
} = require('../middleware/auth.cjs');
const { authenticateUser } = require('./user-service.cjs');

/**
 * Handle phase2 login.
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
async function handlePhase2Login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            throw createError(400, 'Email and password required');
        }

        const db = req.app?.locals?.db || null;
        const authResult = await authenticateUser(db, email, password);

        if (authResult) {
            const { user, source } = authResult;
            const token = generateToken(user);
            auditAuth('login_success', user, req);

            return res.json({
                message: 'Login successful',
                token,
                source,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    trustLevel: user.trustLevel,
                    permissions: trustLevels[user.trustLevel]?.permissions || trustLevels.bronze.permissions
                }
            });
        }

        if (process.env.ALLOW_LEGACY_LOGIN === 'true') {
            return handleLogin(req, res, next);
        }

        auditAuth('login_failed', { email }, req);
        return res.status(401).json({
            error: 'Authentication failed',
            message: 'Invalid email or password'
        });
    } catch (error) {
        auditAuth('login_failed', { email: req.body?.email }, req);
        console.error('[Phase2Login] Error during login:', error?.message, error?.stack);
        // Try legacy login handler as a fallback before returning the error
        try {
            if (process.env.ALLOW_LEGACY_LOGIN !== 'false') {
                return await handleLogin(req, res, next);
            }
        } catch (legacyError) {
            console.error('[Phase2Login] Legacy fallback also failed:', legacyError?.message);
        }
        return res.status(500).json({
            error: error?.name || 'login_error',
            message: error?.message || 'Login failed due to a server error.',
            stack: error?.stack
        });
    }
}

module.exports = { handlePhase2Login };
