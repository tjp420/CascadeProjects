/**
 * Functional utility functions.
 */

/**
 * No-op function.
 */
function noop() { /* no-op */ }

/**
 * Exhaustiveness checker; throws for unexpected values.
 * @param {any} value
 * @param {string} [message='Unexpected value']
 * @throws {Error}
 */
function assertNever(value, message = 'Unexpected value') {
    const display = (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
    throw new Error(`${message}: ${display}`);
}

module.exports = { noop, assertNever };
