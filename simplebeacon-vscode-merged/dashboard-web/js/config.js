// simplebeacon-ignore ai-indicators
/**
 * Runtime configuration — values are injected by the server via window.__SIMPLEBEACON_ENV__.
 * Falls back to development defaults when served as static files.
 */

const env = (typeof window !== 'undefined' && window.__SIMPLEBEACON_ENV__) || {};

/**
 * D a s h b o a r d  b a s e  u r l.
 */
export const DASHBOARD_BASE_URL = env.DASHBOARD_BASE_URL || '';
/**
 * O l l a m a  d e f a u l t  u r l.
 */
export const OLLAMA_DEFAULT_URL = env.OLLAMA_DEFAULT_URL || '';
/**
 * C o m i n g  s o o n  u r l.
 */
export const COMING_SOON_URL = env.COMING_SOON_URL || '/coming-soon/upload.html';
// DEMO_PASSWORD removed — token-based auth only, no hardcoded credentials
