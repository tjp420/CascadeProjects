/**
 * Shared recoverable I/O helpers — log and continue instead of silent pass/return.
 */

const fs = require('fs');
const logger = require('./app-logger.cjs');

function logRecoverableIoError(contextLabel, error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug(`[Recoverable IO] ${contextLabel}: ${message}`);
}

function readJsonFileSyncOrNull(filePath, contextLabel = filePath) {
    try {
        const rawText = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(rawText);
    } catch (error) {
        logRecoverableIoError(contextLabel, error);
        return null;
    }
}

function statMtimeMsOrNull(filePath, contextLabel = filePath) {
    try {
        return fs.statSync(filePath).mtimeMs;
    } catch (error) {
        logRecoverableIoError(contextLabel, error);
        return null;
    }
}

module.exports = {
    logRecoverableIoError,
    readJsonFileSyncOrNull,
    statMtimeMsOrNull
};
