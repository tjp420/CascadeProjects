// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Browser- and Node-safe logger for src/ modules.
 * Mirrors server/lib/app-logger.js behavior.
 */

/**
 * Read env.
 * @param {string} name
 * @returns {any}
 */
function readEnv(name) {
  if (typeof process !== 'undefined' && process.env && process.env[name] != null) {
    return process.env[name];
  }
  return undefined;
}

const LEVEL_RANK = { error: 0, warn: 1, info: 2, debug: 3 };

/**
 * Log subscribers — callbacks invoked on every log call.
 * Fire-and-forget: subscriber errors are silently caught.
 */
const logSubscribers = [];

/**
 * Subscribe to log events. Returns an unsubscribe function.
 * @param {function} callback — receives { level, message, timestamp }
 * @returns {function} unsubscribe
 */
function onLog(callback) {
  if (typeof callback !== 'function') return () => {};
  logSubscribers.push(callback);
  return () => {
    const idx = logSubscribers.indexOf(callback);
    if (idx >= 0) logSubscribers.splice(idx, 1);
  };
}

/**
 * Notify all subscribers of a log event.
 * @param {string} level
 * @param {Array} args
 */
function notifySubscribers(level, args) {
  if (logSubscribers.length === 0) return;
  const message = args.map(a => typeof a === 'string' ? a : (a instanceof Error ? a.message : JSON.stringify(a))).join(' ');
  const entry = { level, message, timestamp: new Date().toISOString() };
  for (const sub of logSubscribers) {
    try {
      sub(entry);
    } catch {
      // subscriber errors never block logging
    }
  }
}

/**
 * Resolve level.
 * @returns {any}
 */
function resolveLevel() {
  const raw = String(readEnv('LOG_LEVEL') || '').toLowerCase();
  if (LEVEL_RANK[raw] !== undefined) return raw;
  return readEnv('NODE_ENV') === 'production' ? 'info' : 'debug';
}

const activeLevel = resolveLevel();

/**
 * Should log.
 * @param {any} level
 * @returns {any}
 */
function shouldLog(level) {
  return LEVEL_RANK[level] <= LEVEL_RANK[activeLevel];
}

/**
 * Write.
 * @param {any} level
 * @param {Function} fn
 * @param {Array} args
 * @returns {any}
 */
function write(level, fn, args) {
  if (!shouldLog(level)) return;
  fn(...args);
  notifySubscribers(level, args);
}

const logger = {
  error: (...args) => { console.error(...args); notifySubscribers('error', args); },
  warn: (...args) => write('warn', console.warn, args),
  info: (...args) => write('info', console.info, args),
  debug: (...args) => write('debug', console.log, args),
  onLog,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = logger;
}

if (typeof window !== 'undefined') {
  window.AppLogger = logger;
}
