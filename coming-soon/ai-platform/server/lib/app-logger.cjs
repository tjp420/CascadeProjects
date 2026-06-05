/**
 * Production-safe logger — respects LOG_LEVEL and NODE_ENV.
 * Use instead of console.log in server hot paths.
 *
 * LOG_LEVEL: error | warn | info | debug (default: info in production, debug otherwise)
 */

const LEVEL_RANK = { error: 0, warn: 1, info: 2, debug: 3 };

function resolveLevel() {
    const raw = String(process.env.LOG_LEVEL || '').toLowerCase();
    if (LEVEL_RANK[raw] !== undefined) return raw;
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const activeLevel = resolveLevel();

function shouldLog(level) {
    return LEVEL_RANK[level] <= LEVEL_RANK[activeLevel];
}

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
