/**
 * Internal dashboard vault session — local operator gate only.
 */

const crypto = require('crypto');

function parseRequestCookies(req) {
  const header = req?.headers?.cookie;
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const eq = part.indexOf('=');
    if (eq === -1) return acc;
    acc[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
    return acc;
  }, {});
}

function getVaultSessionToken(secret) {
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update('simplebeacon-vault').digest('hex');
}

function isVaultAuthenticated(req, options = {}) {
  const internalDashboard = options.internalDashboard === true;
  if (!internalDashboard) return true;

  const secret = options.vaultPassword || process.env.DASHBOARD_VAULT_PASSWORD;
  const expected = getVaultSessionToken(secret);
  if (!expected) return false;
  // Cookie only — never accept ?password= on arbitrary routes (leaks in logs/referrers).
  return parseRequestCookies(req).sb_vault === expected;
}

function isProtectedDashboardPath(reqPath) {
  if (reqPath === '/favicon.svg' || reqPath === '/favicon.ico') return false;
  // Exclude static assets (CSS, JS, images, fonts) from vault protection
  if (/\.(css|js|mjs|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i.test(reqPath)) return false;
  return /^\/(app|demo|signin|dashboard-new\.html|simplebeacon-dashboard|services|scripts|components|assets)(\/|$)/.test(reqPath);
}

/** @deprecated Dashboard JS/CSS/JSON are vault-gated when DASHBOARD_VAULT_PASSWORD is set. */
function isPublicDashboardAssetPath(reqPath) {
  return reqPath === '/favicon.svg' || reqPath === '/favicon.ico';
}

function setVaultSessionCookie(res, secret) {
  const token = getVaultSessionToken(secret || process.env.DASHBOARD_VAULT_PASSWORD);
  if (!token) return;
  res.setHeader('Set-Cookie', `sb_vault=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
}

module.exports = {
  parseRequestCookies,
  getVaultSessionToken,
  isVaultAuthenticated,
  isProtectedDashboardPath,
  isPublicDashboardAssetPath,
  setVaultSessionCookie
};
