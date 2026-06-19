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
}

const logger = {
    error: (...args) => console.error(...args),
    warn: (...args) => write('warn', console.warn, args),
    info: (...args) => write('info', console.info, args),
    debug: (...args) => write('debug', console.log, args)
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = logger;
}

if (typeof window !== 'undefined') {
    window.AppLogger = logger;
}
