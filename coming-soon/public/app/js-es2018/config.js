// simplebeacon-ignore ai-indicators
/**
 * Runtime configuration — values are injected by the server via window.__SIMPLEBEACON_ENV__.
 * Falls back to development defaults when served as static files.
 */
const env = (typeof window !== 'undefined' && window.__SIMPLEBEACON_ENV__) || {};
/**
 * D a s h b o a r d  b a s e  u r l.
 */
export const DASHBOARD_BASE_URL =
    env.DASHBOARD_BASE_URL || (typeof window !== 'undefined' && window.__SB_API_HOST__) || '';
/**
 * O l l a m a  d e f a u l t  u r l.
 */
export const OLLAMA_DEFAULT_URL = env.OLLAMA_DEFAULT_URL || 'http://127.0.0.1:11434'; // simplebeacon-ignore hardcoded-url — default local Ollama URL for static dashboards
/**
 * C o m i n g  s o o n  u r l.
 */
export const COMING_SOON_URL = env.COMING_SOON_URL || '/';
/** Latest VS Code extension package for hosted-dashboard bridge setup. */
export const VSIX_DOWNLOAD_URL =
    env.VSIX_DOWNLOAD_URL ||
    (typeof window !== 'undefined' && window.SIMPLEBEACON_SITE && window.SIMPLEBEACON_SITE.vsixDownloadUrl) ||
    'https://github.com/tjp420/simplebeacon/releases/latest/download/simplebeacon.vsix';
/** Portable local scan agent (~70 MiB) — hosted on GitHub releases, not Cloudflare Pages. */
export const LOCAL_AGENT_DOWNLOAD_URL =
    env.LOCAL_AGENT_DOWNLOAD_URL ||
    (typeof window !== 'undefined' && window.SIMPLEBEACON_SITE && window.SIMPLEBEACON_SITE.localAgentDownloadUrl) ||
    'https://github.com/tjp420/simplebeacon/releases/latest/download/simplebeacon-local-agent-portable.zip';
export const EXTENSION_ID = env.EXTENSION_ID || 'simplebeacon.simplebeacon-vscode';
// DEMO_PASSWORD removed — token-based auth only, no hardcoded credentials
