/**
 * Environment-driven CORS — no wide-open defaults in production.
 */

/**
 * Parse origin list.
 * @param {any} raw
 * @returns {any}
 */
function parseOriginList(raw) {
  return String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Resolve cors options.
 * @param {Array} overrides
 * @returns {any}
 */
function resolveCorsOptions(overrides = {}) {
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const raw =
    process.env.CORS_ORIGINS ||
    process.env.CORS_ORIGIN ||
    overrides.devFallbackOrigin ||
    overrides.defaultOrigin ||
    '';
  const origins = parseOriginList(raw);

  const pagesPreviewOriginRegex = /^https:\/\/(?:[a-z0-9-]+\.)?simplebeacon\.pages\.dev$/;
  const renderOriginRegex = /^https:\/\/[a-z0-9-]+\.onrender\.com$/;
  const netlifyOriginRegex = /^https:\/\/[a-z0-9-]+\.netlify\.app$/;

  function isAllowedCorsOrigin(origin, callback) {
    if (!isProduction) {
      // Development: mirror any origin regardless of env vars
      return callback(null, true);
    }
    if (!origin) {
      return callback(null, true);
    }
    if (origins.includes(origin)) {
      return callback(null, true);
    }
    if (origins.includes('*')) {
      return callback(null, false); // reject wide-open wildcard in production
    }
    if (
      pagesPreviewOriginRegex.test(origin) ||
      renderOriginRegex.test(origin) ||
      netlifyOriginRegex.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  }

  const { devFallbackOrigin, defaultOrigin, ...restOverrides } = overrides;
  return {
    origin: isAllowedCorsOrigin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Token-Password'],
    ...restOverrides,
  };
}

module.exports = {
  parseOriginList,
  resolveCorsOptions,
};
