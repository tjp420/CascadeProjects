/**
 * Canonical source-of-truth for API routes that bypass the REQUIRE_AUTH gate.
 * Paths are relative to /api and should not include a leading slash.
 */

const PUBLIC_API_PATHS = new Set([
    'health',
    'health/db',
    'auth/login',
    'auth/register',
    'auth/refresh',
    'auth/logout',
    'auth/me',
    'platform/status',
    'mock-backend.js',
    'simplebeacon/billing/plan',
    'simplebeacon/billing/webhook',
    'simplebeacon/billing/checkout',
    'simplebeacon/config',
    'simplebeacon/config/presets',
    'simplebeacon/history',
    'simplebeacon/baseline',
    'simplebeacon/report',
    'config/pricing',
    'waitlist',
    'waitlist/count',
    'waitlist/event',
    'audit-booking',
    'audit-bookings',
    'free-token',
    'tokens/sandbox',
    'simplebeacon/billing/resend-token',
    'simplebeacon/billing/status',
    'simplebeacon/billing/session',
    'simplebeacon/billing/license',
    'simplebeacon/billing/portal',
    'simplebeacon/ci/telemetry',
    'simplebeacon/ci/telemetry/summary',
    'quota/check',
    'quota/consume',
    'reports/upload',
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
    'chatbot/disclosure',
    'chatbot/providers',
    'chatbot/message',
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
 * Chatbot routes use optionalAuthenticate on handlers; bypass global REQUIRE_AUTH gate.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isPublicChatbotRoute(relativePath) {
    const pathKey = String(relativePath || '').replace(/^\/+/, '');
    return pathKey === 'chatbot' || pathKey.startsWith('chatbot/');
}

/**
 * WebAuthn sign-in challenge + assertion are public; register/credentials require JWT.
 * @param {string} relativePath
 * @param {string} method
 * @returns {boolean}
 */
function isPublicWebAuthnRoute(relativePath, method) {
    const pathKey = String(relativePath || '').replace(/^\/+/, '');
    return method === 'POST' && (pathKey === 'webauthn/challenge' || pathKey === 'webauthn/authenticate');
}

/**
 * Dashboard stub routes are read-only sample/empty data and should bypass the
 * global REQUIRE_AUTH gate (their own router already uses optionalAuthenticate).
 * POST/mutation endpoints such as merger-tool/reduction-scan and npm-audit are excluded.
 * @param {string} relativePath
 * @param {string} method
 * @returns {boolean}
 */
function isPublicDashboardRoute(relativePath, method) {
    if (method !== 'GET') return false;
    const pathKey = String(relativePath || '').replace(/^\/+/, '');
    const publicExact = new Set(['dashboard-home', 'status']);
    if (publicExact.has(pathKey)) return true;
    const publicPrefixes = [
        'dev-tools',
        'analytics',
        'merger-tool/merges',
        'merger-tool/overview',
        'merger-tool/activity',
        'merger-tool/statistics',
        'coverage-reports',
        'settings',
        'help',
        'quality',
        'security/overview',
        'security/threats',
        'security/vulnerabilities',
        'security/incidents',
        'security/compliance',
        'support'
    ];
    for (const prefix of publicPrefixes) {
        if (pathKey === prefix || pathKey.startsWith(prefix + '/')) return true;
    }
    return false;
}

/**
 * Resolve api relative path.
 * @param {any} req
 * @returns {any}
 */
function resolveApiRelativePath(req) {
    const mounted = String(req.path || '').replace(/^\/+/, '').replace(/^api\/?/i, '');
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
        || isPublicChatbotRoute(pathKey)
        || isPublicWebAuthnRoute(pathKey, method)
        || isPublicDashboardRoute(pathKey, method)
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
    isPublicSimplebeaconDemoRoute,
    isPublicChatbotRoute,
    isPublicWebAuthnRoute,
    isPublicDashboardRoute
};
