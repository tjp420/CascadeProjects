/**
 * Production-safe logger — respects LOG_LEVEL and NODE_ENV.
 * Use instead of console.log in server hot paths.
 *
 * Levels (lowest to highest): trace | debug | info | warn | error | fatal
 * LOG_LEVEL env var controls the threshold (default: info in production, debug otherwise).
 *
 * @license MIT
 */

const LEVEL_RANK = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 };

/**
 * Resolve the active log level from environment.
 * @returns {'trace'|'debug'|'info'|'warn'|'error'|'fatal'}
 */
function resolveLevel() {
  const raw = String(process.env.LOG_LEVEL || "").toLowerCase();
  if (LEVEL_RANK[raw] !== undefined) return raw;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

/** Cache active level so hot paths stay fast. Re-evaluated on first read if set to 'dynamic'. */
let activeLevel = resolveLevel();

/** Whether structured JSON mode is enabled via LOG_FORMAT=json. */
const isJsonMode =
  String(process.env.LOG_FORMAT || "").toLowerCase() === "json";

/**
 * Determine whether a message at the given level should be emitted.
 * @param {'trace'|'debug'|'info'|'warn'|'error'|'fatal'} level - Log level to check.
 * @returns {boolean}
 */
function shouldLog(level) {
  if (typeof level !== "string" || LEVEL_RANK[level] === undefined)
    return false;
  const threshold = LEVEL_RANK[activeLevel];
  if (threshold === undefined) return false;
  return LEVEL_RANK[level] >= threshold;
}

/** Small WeakSet for circular-ref detection during serialization. */
const _seen = new WeakSet();

/**
 * Serialize a value safely, handling circular references, Errors, functions, and BigInts.
 * @param {any} value
 * @returns {string}
 */
function safeStringify(value) {
  if (value instanceof Error) {
    return value.stack || value.message || String(value);
  }
  try {
    const result = JSON.stringify(value, (_key, val) => {
      if (typeof val === "object" && val !== null) {
        if (_seen.has(val)) return "[Circular]";
        _seen.add(val);
      }
      if (val instanceof Error) {
        return { name: val.name, message: val.message, stack: val.stack };
      }
      if (typeof val === "bigint") return val.toString();
      if (typeof val === "function")
        return `[Function: ${val.name || "anonymous"}]`;
      if (typeof val === "symbol") return val.toString();
      if (val === undefined) return "[undefined]";
      return val;
    });
    return typeof result === "string" ? result : String(value);
  } catch (e) {
    try { console.warn('app-logger safeStringify error:', e && e.message ? e.message : e); } catch (_) {}
    return "[Unserializable]";
  } finally {
    _seen.clear();
  }
}

/**
 * Format arguments for console output.
 * In JSON mode, returns a single JSON string. Otherwise applies util.format-like behavior.
 * @param {'trace'|'debug'|'info'|'warn'|'error'|'fatal'} level
 * @param {string} [prefix]
 * @param {Array<*>} args
 * @returns {string|Array<*>}
 */
function formatArgs(level, prefix, args) {
  if (isJsonMode) {
    const ts = new Date().toISOString();
    const message = args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        return safeStringify(arg);
      })
      .join(" ");
    const entry = { time: ts, level, msg: message };
    if (prefix) entry.name = prefix;
    return JSON.stringify(entry);
  }
  const ts = new Date().toISOString();
  const lvl = level.toUpperCase().padStart(5, " ");
  const tag = prefix ? `[${prefix}]` : "";
  const header = `${ts} ${lvl}${tag ? " " + tag : ""}:`;
  return [header, ...args];
}

/**
 * Write a log entry if the level is active.
 * @param {'trace'|'debug'|'info'|'warn'|'error'|'fatal'} level - Log level.
 * @param {Function} fn - Console method to invoke.
 * @param {string} [prefix] - Optional namespace prefix.
 * @param {Array<*>} args - Arguments to pass to the console method.
 */
function write(level, fn, prefix, args) {
  if (typeof fn !== "function") return;
  if (!shouldLog(level)) return;
  const formatted = formatArgs(level, prefix, args);
  if (isJsonMode) {
    fn(formatted);
  } else if (Array.isArray(formatted)) {
    fn(...formatted);
  } else {
    fn(formatted);
  }
}

/**
 * Create a logger instance, optionally with a namespace prefix.
 * @param {string} [prefix]
 * @returns {Object}
 */
function createLogger(prefix) {
  const log = {
    trace: (...args) => write("trace", console.log, prefix, args),
    debug: (...args) => write("debug", console.log, prefix, args),
    info: (...args) => write("info", console.log, prefix, args),
    warn: (...args) => write("warn", console.warn, prefix, args),
    error: (...args) => write("error", console.error, prefix, args),
    fatal: (...args) => write("fatal", console.error, prefix, args),
  };

  /**
   * Create a child logger with an appended namespace.
   * @param {string} childPrefix
   * @returns {Object}
   */
  log.child = (childPrefix) =>
    createLogger(
      prefix && typeof childPrefix === "string"
        ? `${prefix}:${childPrefix}`
        : String(childPrefix || ""),
    );

  return log;
}

/** Default root logger. */
const logger = createLogger();

/**
 * Re-evaluate the active log level from environment at runtime.
 * Useful for dynamic log-level changes without restarting the process.
 */
logger.refreshLevel = () => {
  activeLevel = resolveLevel();
};

/**
 * Set the active log level programmatically.
 * @param {'trace'|'debug'|'info'|'warn'|'error'|'fatal'} level
 */
logger.setLevel = (level) => {
  const normalized = String(level || "").toLowerCase();
  if (LEVEL_RANK[normalized] !== undefined) {
    activeLevel = normalized;
  }
};

/**
 * Check whether a given log level is currently enabled.
 * Useful for guarding expensive computations before logging.
 * @param {'trace'|'debug'|'info'|'warn'|'error'|'fatal'} level
 * @returns {boolean}
 */
logger.isLevelEnabled = (level) => shouldLog(level);

/**
 * Get the current active log level.
 * @returns {string}
 */
logger.getLevel = () => activeLevel;

module.exports = logger;
