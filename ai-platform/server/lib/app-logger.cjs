/**
 * Production-safe logger — respects LOG_LEVEL and NODE_ENV.
 * Use instead of console.log in server hot paths.
 *
 * LOG_LEVEL: error | warn | info | debug (default: info in production, debug otherwise)
 *
 * @license MIT
 */

const LEVEL_RANK = { error: 0, warn: 1, info: 2, debug: 3 };

/**
 * Resolve the active log level from environment.
 * @returns {'error'|'warn'|'info'|'debug'}
 */
function resolveLevel() {
    const raw = String(process.env.LOG_LEVEL || '').toLowerCase();
    if (LEVEL_RANK[raw] !== undefined) return raw;
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const activeLevel = resolveLevel();

/**
 * Determine whether a message at the given level should be emitted.
 * @param {'error'|'warn'|'info'|'debug'} level - Log level to check.
 * @returns {boolean}
 */
function shouldLog(level) {
    return LEVEL_RANK[level] <= LEVEL_RANK[activeLevel];
}

/**
 * Write a log entry if the level is active.
 * @param {'error'|'warn'|'info'|'debug'} level - Log level.
 * @param {Function} fn - Console method to invoke.
 * @param {Array} args - Arguments to pass to the console method.
 */
function write(level, fn, args) {
    if (!shouldLog(level)) return;
    fn(...args);
}

const logger = {
    error: (...args) => console.error(...args),
    warn: (...args) => write('warn', console.warn, args),
    info: (...args) => write('info', console.info, args),
    debug: (...args) => write('debug', console.log, args)
};

module.exports = logger;
