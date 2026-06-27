/**
 * Public demo dashboard — honey-pot fixture, read-only.
 */
/**
 * D e m o  e m a i l.
 */
export const DEMO_EMAIL = 'dev@simplebeacon.local';
// DEMO_PASSWORD removed — token-based auth only, no hardcoded credentials
/**
 * Is demo mode.
 * @returns {any}
 */
export function isDemoMode() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return path === '/demo' || path.startsWith('/demo/');
}
/**
 * Is signed off mode.
 * @returns {any}
 */
export function isSignedOffMode() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return path === '/signin' || path.startsWith('/signin/');
}
/** Self-hosted local dashboard (localhost / loopback) — not public Cloud Teams SaaS. */
export function isLocalDevHost() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
/**
 * D e m o  a p i  b a s e.
 */
export const DEMO_API_BASE = '/api/simplebeacon/demo';
/**
 * Demo read only message.
 * @returns {any}
 */
export function demoReadOnlyMessage() {
    return 'Demo mode — read-only honey-pot preview. Sign in at /app#/signin for Cloud Teams.';
}
