// Compatibility shim: some tests require this relative path from src/api/__tests__
// Re-export the real implementation from the repo's server/lib location and
// force the debug `usingRedis` probe to false so unit tests use the in-memory
// fallback instead of attempting a Redis connection during CI/local runs.
const real = require('../../../server/lib/redis-rate-limiter.cjs');
real._debug = real._debug || {};
real._debug.usingRedis = () => false;
module.exports = real;
