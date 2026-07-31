'use strict';

const constants = require('../../config/constants.cjs');

const SANDBOX_DAILY_LIMIT = 100;
const SANDBOX_WINDOW_MS = 24 * 60 * constants.ONE_MINUTE_MS;

// Sandbox token request tracking — enforce daily limits
const sandboxTokenUsage = new Map();

function isSandboxToken(decoded) {
  if (!decoded || typeof decoded !== 'object') return false;
  const tier = decoded.tier || decoded.plan || '';
  return tier === 'sandbox' || tier === 'community' || tier === 'free' || tier === 'developer';
}

function recordSandboxRequest(jti) {
  if (jti == null) return { allowed: false, remaining: 0 };
  const now = Date.now();
  const entry = sandboxTokenUsage.get(jti);
  if (!entry || now - entry.windowStart > SANDBOX_WINDOW_MS) {
    sandboxTokenUsage.set(jti, { count: 1, windowStart: now });
    return { allowed: true, remaining: SANDBOX_DAILY_LIMIT - 1 };
  }
  entry.count += 1;
  const remaining = Math.max(0, SANDBOX_DAILY_LIMIT - entry.count);
  return { allowed: entry.count < SANDBOX_DAILY_LIMIT, remaining };
}

function getSandboxLimitHeaders(jti) {
  if (jti == null) {
    return {
      'X-Sandbox-Limit': String(SANDBOX_DAILY_LIMIT),
      'X-Sandbox-Remaining': String(SANDBOX_DAILY_LIMIT),
    };
  }
  const entry = sandboxTokenUsage.get(jti);
  if (!entry) {
    return {
      'X-Sandbox-Limit': String(SANDBOX_DAILY_LIMIT),
      'X-Sandbox-Remaining': String(SANDBOX_DAILY_LIMIT),
    };
  }
  const remaining = Math.max(0, SANDBOX_DAILY_LIMIT - entry.count);
  return {
    'X-Sandbox-Limit': String(SANDBOX_DAILY_LIMIT),
    'X-Sandbox-Remaining': String(remaining),
  };
}

// Periodic cleanup of stale sandbox usage records
const sandboxCleanupInterval = setInterval(() => {
  const cutoff = Date.now() - SANDBOX_WINDOW_MS;
  for (const [jti, entry] of sandboxTokenUsage) {
    if (entry.windowStart < cutoff) {
      sandboxTokenUsage.delete(jti);
    }
  }
}, 60 * constants.ONE_MINUTE_MS);
sandboxCleanupInterval.unref();

process.on('SIGINT', () => {
  clearInterval(sandboxCleanupInterval);
});
process.on('SIGTERM', () => {
  clearInterval(sandboxCleanupInterval);
});

module.exports = {
  isSandboxToken,
  recordSandboxRequest,
  getSandboxLimitHeaders,
  SANDBOX_DAILY_LIMIT,
  SANDBOX_WINDOW_MS,
};
