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
function readTextFileWithLimit(filePath, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      let received = 0;
      const rs = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
      rs.on('data', (c) => {
        received += c.length;
        if (received > maxBytes) {
          rs.destroy();
          // Resolve with truncated content
          chunks.push(c.slice(0, Math.max(0, c.length - (received - maxBytes))));
          return resolve(chunks.join(''));
        }
        chunks.push(c);
      });
      rs.on('error', (err) => reject(err));
      rs.on('end', () => resolve(chunks.join('')));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Redact token-like or long-secret strings from free-form text.
 */
function redactTextSecrets(text) {
  if (!text || typeof text !== 'string') return text;
  const tokenLike =
    /(?:api[_-]?key|openai[_-]?key|secret|token|access[_-]?key|aws[_-]?secret)["'`]?\s*[:=]?\s*["'`]?([A-Za-z0-9\-_.]{8,})/gi;
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
  statMtimeMsOrNull,
};
// Export helpers used across the platform
module.exports.readTextFileWithLimit = readTextFileWithLimit;
module.exports.redactTextSecrets = redactTextSecrets;
