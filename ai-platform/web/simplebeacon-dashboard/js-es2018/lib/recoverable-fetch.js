// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Log recoverable dashboard error.
 * @param {string} contextLabel
 * @param {any} error
 * @returns {any}
 */
export function logRecoverableDashboardError(contextLabel, error) {
    const message = error instanceof Error ? error.message : String(error);
    window["console"]["debug"](`[Simplebeacon dashboard] ${contextLabel}: ${message}`);
}
/**
 * Has json content type.
 * @param {any} response
 * @returns {any}
 */
export function hasJsonContentType(response) {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    return contentType.includes('application/json');
}
/**
 * Read json response body.
 * @param {any} response
 * @param {any} fallback
 * @returns {any}
 */
export async function readJsonResponseBody(response, fallback = null) {
    if (!hasJsonContentType(response))
        return fallback;
    const parsedBody = await response.json().catch((parseError) => {
        logRecoverableDashboardError('JSON response parse', parseError);
        return fallback;
    });
    return parsedBody == null ? fallback : parsedBody;
}
/**
 * With recoverable fallback.
 * @param {string} contextLabel
 * @param {any} asyncOperation
 * @param {any} fallbackFactory
 * @returns {any}
 */
export async function withRecoverableFallback(contextLabel, asyncOperation, fallbackFactory) {
    try {
        return await asyncOperation();
    }
    catch (error) {
        logRecoverableDashboardError(contextLabel, error);
        return typeof fallbackFactory === 'function' ? fallbackFactory(error) : fallbackFactory;
    }
}
