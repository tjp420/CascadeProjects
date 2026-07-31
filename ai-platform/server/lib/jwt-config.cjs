/**
 * JWT Configuration — extracted to break auth.cjs ↔ token-service.cjs cycle.
 */
const { resolveSecret } = require('./secret-config.cjs');

const jwtConfig = {
  secret: resolveSecret('JWT_SECRET'),
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  algorithm: 'HS256',
  issuer: 'cascade-ai-platform',
  audience: 'cascade-ai-users',
};

const refreshConfig = {
  secret: resolveSecret('JWT_REFRESH_SECRET') || jwtConfig.secret,
  expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  algorithm: 'HS256',
  issuer: 'cascade-ai-platform',
  audience: 'cascade-ai-refresh',
};

module.exports = { jwtConfig, refreshConfig };
