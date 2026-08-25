// SPDX-License-Identifier: MIT
/**
 * Unified database configuration for Phase 2 integration.
 * Supports DATABASE_URL and individual DB_* environment variables.
 *
 * @license MIT
 */

const logger = require("../lib/app-logger.cjs");
const constants = require("./constants.cjs");

const DEFAULT_PG_PORT = constants.POSTGRES_PORT;
// Hardened defaults (can be overridden via env):
const DEFAULT_POOL_MAX = Number.isFinite(Number(process.env.DB_POOL_MAX))
  ? Number(process.env.DB_POOL_MAX)
  : 15;
const DEFAULT_CONNECT_TIMEOUT_MS = Number.isFinite(
  Number(process.env.DB_CONNECT_TIMEOUT_MS),
)
  ? Number(process.env.DB_CONNECT_TIMEOUT_MS)
  : 5000; // 5s
const DEFAULT_IDLE_TIMEOUT_MS = Number.isFinite(
  Number(process.env.DB_IDLE_TIMEOUT_MS),
)
  ? Number(process.env.DB_IDLE_TIMEOUT_MS)
  : constants.TIMEOUT_30S;

// simplebeacon-ignore secret-in-comments — database URL parsing utility documentation
/**
 * Parse a PostgreSQL connection URL into component parts.
 * @param {string} url - PostgreSQL connection URL.
 * @returns {{host:string,port:number,database:string,user:string,password:string}|null}
 */
function parseDatabaseUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : DEFAULT_PG_PORT,
      database: parsed.pathname.replace(/^\//, ""),
      user: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
    };
  } catch (error) {
    logger.warn("[DB] Invalid DATABASE_URL:", error.message);
    return null;
  }
}

/**
 * Resolve the database password from overrides, parsed URL, or environment.
 * @param {{password?:string}|null} fromUrl - Parsed URL object.
 * @param {{password?:string}} [overrides={}] - Runtime overrides.
 * @returns {string} Resolved password.
 * @throws {Error} When database is enabled but no password is configured.
 */
function resolveDatabasePassword(fromUrl, overrides = {}) {
  const password =
    overrides.password ?? fromUrl?.password ?? process.env.DB_PASSWORD;
  if (password != null && String(password).length > 0) {
    return String(password);
  }
  const enabled =
    process.env.ENABLE_DATABASE === "true" ||
    Boolean(process.env.DATABASE_URL) ||
    process.env.DB_HOST != null;
  if (enabled) {
    throw new Error(
      "Database is enabled but DB_PASSWORD (or DATABASE_URL with password) is not set. " +
        "Configure credentials via environment — do not rely on hardcoded defaults.",
    );
  }
  return "";
}

/**
 * Get database config.
 * @param {Array} overrides
 * @returns {any}
 */
function getDatabaseConfig(overrides = {}) {
  const fromUrl = parseDatabaseUrl(process.env.DATABASE_URL);
  const rawPort =
    overrides.port || fromUrl?.port || process.env.DB_PORT || DEFAULT_PG_PORT;
  const rawMax = process.env.DB_POOL_MAX || overrides.max || DEFAULT_POOL_MAX;
  const rawIdle =
    process.env.DB_IDLE_TIMEOUT_MS ||
    overrides.idleTimeoutMillis ||
    DEFAULT_IDLE_TIMEOUT_MS;
  const rawConnect =
    process.env.DB_CONNECT_TIMEOUT_MS ||
    overrides.connectionTimeoutMillis ||
    DEFAULT_CONNECT_TIMEOUT_MS;
  return {
    host: overrides.host || fromUrl?.host || process.env.DB_HOST || "localhost",
    port: Number.isFinite(Number(rawPort)) ? Number(rawPort) : DEFAULT_PG_PORT,
    database:
      overrides.database ||
      fromUrl?.database ||
      process.env.DB_NAME ||
      "cascade_ai_platform",
    user:
      overrides.user || fromUrl?.user || process.env.DB_USER || "cascade_user",
    password: resolveDatabasePassword(fromUrl, overrides),
    max: Number.isFinite(Number(rawMax)) ? Number(rawMax) : DEFAULT_POOL_MAX,
    idleTimeoutMillis: Number.isFinite(Number(rawIdle))
      ? Number(rawIdle)
      : constants.TIMEOUT_30S,
    connectionTimeoutMillis: Number.isFinite(Number(rawConnect))
      ? Number(rawConnect)
      : DEFAULT_CONNECT_TIMEOUT_MS,
  };
}

// Cluster sizing safety check — warn if projected instance footprint would exhaust DB connections
try {
  const PROJECTED_INSTANCES = Number.isFinite(
    Number(process.env.PROJECTED_INSTANCE_COUNT),
  )
    ? Number(process.env.PROJECTED_INSTANCE_COUNT)
    : 1;
  const configuredPoolMax = Number.isFinite(Number(process.env.DB_POOL_MAX))
    ? Number(process.env.DB_POOL_MAX)
    : DEFAULT_POOL_MAX;
  const EXPECTED_MAX_CONNECTIONS = PROJECTED_INSTANCES * configuredPoolMax;
  const DB_HARD_CEILING = Number.isFinite(
    Number(process.env.DB_SERVER_MAX_CONNECTIONS),
  )
    ? Number(process.env.DB_SERVER_MAX_CONNECTIONS)
    : 100;
  const SAFETY_MARGIN = 15; // keep some reserved connections for maintenance/admin
  if (EXPECTED_MAX_CONNECTIONS > DB_HARD_CEILING - SAFETY_MARGIN) {
    logger.warn(
      `[CLUSTER WARNING] Projected app footprint (${PROJECTED_INSTANCES} instances * max ${configuredPoolMax} pools) ` +
        `requires up to ${EXPECTED_MAX_CONNECTIONS} connections. This encroaches upon the database hard ceiling of ${DB_HARD_CEILING}. ` +
        `Consider implementing an external PgBouncer connection pooler or reducing per-process DB_POOL_MAX.`,
    );
  }
} catch (e) {
  console.error("database.cjs error:", e);
  // Non-fatal — do not disrupt startup
}

/**
 * Is database enabled.
 * @returns {any}
 */
function isDatabaseEnabled() {
  return (
    process.env.ENABLE_DATABASE === "true" ||
    Boolean(process.env.DATABASE_URL) ||
    process.env.DB_HOST != null
  );
}

module.exports = {
  parseDatabaseUrl,
  getDatabaseConfig,
  isDatabaseEnabled,
};
