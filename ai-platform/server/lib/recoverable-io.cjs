// simplebeacon-ignore test-coverage
/**
 * Shared recoverable I/O helpers — log and continue instead of silent pass/return.
 */

const fs = require('fs');
const logger = require('./app-logger.cjs');

/**
 * Log recoverable io error.
 * @param {string} contextLabel
 * @param {any} error
 * @returns {any}
 */
function logRecoverableIoError(contextLabel, error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug(`[Recoverable IO] ${contextLabel}: ${message}`);
}

/**
 * Read json file sync or null.
 * @param {string} filePath
 * @param {string} contextLabel
 * @returns {any}
 */
function readJsonFileSyncOrNull(filePath, contextLabel = filePath) {
    try {
        const rawText = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(rawText);
    } catch (error) {
        logRecoverableIoError(contextLabel, error);
        return null;
    }
}

/**
 * Stat mtime ms or null.
 * @param {string} filePath
 * @param {string} contextLabel
 * @returns {any}
 */
function statMtimeMsOrNull(filePath, contextLabel = filePath) {
    try {
        return fs.statSync(filePath).mtimeMs;
    } catch (error) {
        logRecoverableIoError(contextLabel, error);
        return null;
    }
}

/**
 * Read a text file via stream with a maximum byte limit to avoid large in-memory reads.
 * Returns the joined string (may be truncated) or throws on stream error.
 */
async function readTextFileWithLimit(filePath, maxBytes = 256 * 1024) {
    let handle;
    try {
        handle = await fs.promises.open(filePath, 'r');
        const { size } = await handle.stat();
        const toRead = Math.min(maxBytes, Math.max(0, size));
        const buffer = Buffer.alloc(toRead);
        if (toRead > 0) {
            await handle.read(buffer, 0, toRead, 0);
        }
        return buffer.toString('utf8');
    } catch (err) {
        throw err;
    } finally {
        if (handle) await handle.close();
    }
}

/**
 * Redact token-like or long-secret strings from free-form text.
 */
function redactTextSecrets(text) {
    if (!text || typeof text !== 'string') return text;
    const tokenLike = /(?:api[_-]?key|openai[_-]?key|secret|token|access[_-]?key|aws[_-]?secret)["'`]?\s*[:=]?\s*["'`]?([A-Za-z0-9\-_.]{8,})/ig;
    const longSecret = /[A-Za-z0-9_\-]{32,}/g;
    try {
        let out = text.replace(tokenLike, (m) => {
            return m.replace(/([A-Za-z0-9\-_.]{8,})/, '[REDACTED]');
        });
        out = out.replace(longSecret, '[REDACTED]');
        return out;
    } catch (err) {
        return text;
    }
}

module.exports = {
    logRecoverableIoError,
    readJsonFileSyncOrNull,
    statMtimeMsOrNull
};
// Export helpers used across the platform
module.exports.readTextFileWithLimit = readTextFileWithLimit;
module.exports.redactTextSecrets = redactTextSecrets;
