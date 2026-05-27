/**
 * Public demo dashboard — honey-pot fixture, read-only.
 */

export function isDemoMode() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/demo' || path.startsWith('/demo/');
}

export function isSignedOffMode() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/signin' || path.startsWith('/signin/');
}

/** Self-hosted local dashboard (localhost / loopback) — not public Cloud Teams SaaS. */
export function isLocalDevHost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export const DEMO_API_BASE = '/api/simplebeacon/demo';

export function demoReadOnlyMessage() {
  return 'Demo mode — read-only honey-pot preview. Sign in at /app#/signin for Cloud Teams.';
}

export function signedOffReadOnlyMessage() {
  return 'Signed-off copy — payment actions are disabled in this upload.';
}
