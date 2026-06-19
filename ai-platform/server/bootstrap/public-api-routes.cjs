/**
 * Canonical source-of-truth for API routes that bypass the REQUIRE_AUTH gate.
 * Paths are relative to /api and should not include a leading slash.
 */

const PUBLIC_API_PATHS = new Set([
    'health',
    'health/db',
    'auth/login',
    'auth/refresh',
    'auth/logout',
    'platform/status',
    'mock-backend.js',
    'simplebeacon/billing/plan',
    'simplebeacon/billing/webhook',
    'simplebeacon/billing/checkout',
    'waitlist',
    'waitlist/count',
    'waitlist/event',
    'audit-booking',
    'audit-bookings',
    'trust/verification',
    'trust/verify',
    'trust/history',
    'trust/trend',
    'trust/methodology',
    'trust/badge.svg',
    'trust/badge',
    'optimization/health',
    'optimization/compliance',
    'optimization/candidates',
    'analyze/upload-directory',
    'reports/download',
    // Legacy dashboard.html scanner wiring (read-only repository scans)
    'project-structure',
    'backlog',
    'mock-analysis',
    'mock-conversion',
    'mock-validation',
    'mock-cleaning',
    'gguf/mock-analysis-report'
]);

/**
 * Is public optimization route.
 * @param {string} relativePath
 * @param {any} method
 * @returns {any}
 */
function isPublicOptimizationRoute(relativePath, method) {
    if (method === 'GET' && (
        relativePath === 'optimization/health'
        || relativePath === 'optimization/compliance'
        || relativePath === 'optimization/candidates'
    )) {
        return true;
    }
    if (method === 'POST' && (
        relativePath === 'optimization/analyze'
        || relativePath === 'optimization/merge-preview'
    )) {
        return true;
    }
    return false;
}

/**
 * Is public assessment route.
 * @param {string} relativePath
 * @param {any} method
 * @returns {any}
 */
function isPublicAssessmentRoute(relativePath, method) {
    if (relativePath === 'assessments' && method === 'POST') return true;
    if (relativePath === 'assessment/scan' && method === 'POST') return true;
    if (relativePath === 'assessment/health' && method === 'GET') return true;
    if (method === 'GET' && /^assessments\/assessment_\d+(?:\/download\/[\w-]+)?$/.test(relativePath)) return true;
    if (method === 'GET' && /^assessment\/report\/assessment_\d+(?:\/download\/[\w-]+)?$/.test(relativePath)) return true;
    return false;
}

/**
 * Is public simplebeacon demo route.
 * @param {string} relativePath
 * @returns {any}
 */
function isPublicSimplebeaconDemoRoute(relativePath) {
    return relativePath.startsWith('simplebeacon/demo');
}

/**
 * Resolve api relative path.
 * @param {any} req
 * @returns {any}
 */
function resolveApiRelativePath(req) {
    const mounted = String(req.path || '').replace(/^\/+/, '');
    if (mounted) return mounted;
    const raw = String(req.originalUrl || req.url || '').split('?')[0];
    return raw.replace(/^\/api\/?/i, '').replace(/^\/+/, '');
}

/**
 * Is public api route.
 * @param {string} relativePath
 * @param {any} method
 * @returns {any}
 */
function isPublicApiRoute(relativePath, method) {
    const pathKey = String(relativePath || '').replace(/^\/+/, '');
    return (
        PUBLIC_API_PATHS.has(pathKey)
        || pathKey.startsWith('health')
        || isPublicAssessmentRoute(pathKey, method)
        || isPublicOptimizationRoute(pathKey, method)
        || isPublicSimplebeaconDemoRoute(pathKey)
    );
}

/**
 * Is public api request.
 * @param {any} req
 * @returns {any}
 */
function isPublicApiRequest(req) {
    return isPublicApiRoute(resolveApiRelativePath(req), req.method);
}

module.exports = {
    PUBLIC_API_PATHS,
    isPublicApiRoute,
    isPublicApiRequest,
    resolveApiRelativePath,
    isPublicAssessmentRoute,
    isPublicOptimizationRoute,
    isPublicSimplebeaconDemoRoute
};
