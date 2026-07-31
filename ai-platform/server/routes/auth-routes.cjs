/**
 * Auth Routes — Token Rotation & Blocklist (DEPRECATED)
 *
 * DEPRECATED: No frontend callers found. The canonical auth routes are in
 * auth.cjs (mounted at /api/auth in simplebeacon-server.cjs). This file is
 * retained for backward compatibility with index.cjs deployments that use
 * the /api/v2/auth/* mount path. Do not add new endpoints here.
 *
 * POST /api/v2/auth/refresh  — rotate refresh token pair
 * POST /api/v2/auth/logout   — blacklist access token, revoke refresh token
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.cjs');
const {
  rotateRefreshToken,
  revokeRefreshToken,
  blacklistAccessToken,
} = require('../lib/token-service.cjs');
const logger = require('../lib/app-logger.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

/**
 * POST /api/v2/auth/refresh
 * Body: { refreshToken: string }
 * Returns: { success, accessToken, refreshToken, expiresAt }
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken || typeof refreshToken !== 'string') {
      return sendError(res, 400, 'Missing refreshToken in request body');
    }

    const result = await rotateRefreshToken(refreshToken, {
      deviceFingerprint: req.headers['x-device-fingerprint'],
      ipAddress: req.ip,
      accessPayload: { ip: req.ip },
    });

    logger.info('[auth] Token rotated');

    res.json({
      success: true,
      accessToken: result.newAccessToken,
      refreshToken: result.newRefreshToken,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    const statusCode = error.statusCode || 401;
    logger.warn('[auth] Refresh failed:', error.message);
    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: error.code || 'REFRESH_FAILED',
    });
  }
});

/**
 * POST /api/v2/auth/logout
 * Headers: Authorization: Bearer <accessToken>
 * Body (optional): { refreshToken: string }
 * Returns: { success }
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');

    // Blacklist the access token
    if (accessToken) {
      await blacklistAccessToken(accessToken, 'logout');
    }

    // Revoke the refresh token if provided
    const { refreshToken } = req.body || {};
    if (refreshToken && typeof refreshToken === 'string') {
      const { hashToken } = require('../lib/token-service.cjs');
      await revokeRefreshToken(hashToken(refreshToken), 'logout');
    }

    logger.info('[auth] Logout completed', { userId: req.user?.id });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('[auth] Logout error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      message: error.message,
    });
  }
});

module.exports = router;
