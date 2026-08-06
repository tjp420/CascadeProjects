/**
 * Lightweight resource guard for scans.
 * Exposes preflight and sampling checks that throw when host resources
 * are below configured safe thresholds.
 */
const os = require('os');

const DEFAULT_MIN_FREE_BYTES = 512 * 1024 * 1024; // 512 MB
const DEFAULT_MIN_FREE_PERCENT = 5; // 5%

function parseEnvNumber(name, fallback) {
    const v = process.env[name];
    if (v == null || String(v).trim() === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function getSystemMemory() {
    const total = os.totalmem();
    const free = os.freemem();
    const freePercent = (free / total) * 100;
    return { total, free, freePercent };
}

function buildAdvice() {
    return [
        'Suggested mitigations: ',
        `- Reduce scan scope or set SIMPLEBEACON_FULL_SCAN_MAX_FILES to a positive integer`,
        `- Increase worker memory: set SIMPLEBEACON_WORKER_OLD_SPACE_MB (e.g. 4096 or 8192)`,
        `- Reduce parallelism: set SIMPLEBEACON_PARALLEL=0 or lower SIMPLEBEACON_PARALLEL_MAX_WORKERS`,
        `- Run the scan on a machine/container with more RAM or swap configured`
    ].join('\n');
}

function preflightOrThrow() {
    const minFreeBytes = parseEnvNumber('SIMPLEBEACON_MIN_FREE_BYTES', DEFAULT_MIN_FREE_BYTES);
    const minFreePercent = parseEnvNumber('SIMPLEBEACON_MIN_FREE_PERCENT', DEFAULT_MIN_FREE_PERCENT);
    const { total, free, freePercent } = getSystemMemory();
    if (free < minFreeBytes || freePercent < minFreePercent) {
        const msg = `ResourceGuard preflight failed: free=${Math.round(free / 1024 / 1024)}MB (${freePercent.toFixed(1)}%) < required ${Math.round(minFreeBytes / 1024 / 1024)}MB or ${minFreePercent}%\n` + buildAdvice();
        const err = new Error(msg);
        err.code = 'RESOURCE_GUARD_PRECHECK_FAILED';
        throw err;
    }
    return { total, free, freePercent };
}

function sampleAndThrow(context = {}) {
    const minFreeBytes = parseEnvNumber('SIMPLEBEACON_MIN_FREE_BYTES', DEFAULT_MIN_FREE_BYTES);
    const minFreePercent = parseEnvNumber('SIMPLEBEACON_MIN_FREE_PERCENT', DEFAULT_MIN_FREE_PERCENT);
    const { total, free, freePercent } = getSystemMemory();
    if (free < minFreeBytes || freePercent < minFreePercent) {
        const details = [];
        if (context && context.filesFound != null) details.push(`filesFound=${context.filesFound}`);
        if (context && context.phase) details.push(`phase=${context.phase}`);
        const msg = `ResourceGuard triggered during scan ${details.length ? '(' + details.join(',') + ')' : ''}: free=${Math.round(free / 1024 / 1024)}MB (${freePercent.toFixed(1)}%) < required ${Math.round(minFreeBytes / 1024 / 1024)}MB or ${minFreePercent}%\n` + buildAdvice();
        const err = new Error(msg);
        err.code = 'RESOURCE_GUARD_TRIGGERED';
        throw err;
    }
    return { total, free, freePercent };
}

module.exports = { preflightOrThrow, sampleAndThrow, getSystemMemory };
