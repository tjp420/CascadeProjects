/**
 * Internal dashboard vault session — local operator gate only.
 */

const crypto = require("crypto");

/**
 * Parse request cookies.
 * @param {any} req
 * @returns {any}
 */
function parseRequestCookies(req) {
  const header = req?.headers?.cookie;
  if (!header) return {};
  return header.split(";").reduce((acc, part) => {
    const eq = part.indexOf("=");
    if (eq === -1) return acc;
    acc[part.slice(0, eq).trim()] = decodeURIComponent(
      part.slice(eq + 1).trim(),
    );
    return acc;
  }, {});
}

/**
 * Get vault session token.
 * @param {any} secret
 * @returns {any}
 */
function getVaultSessionToken(secret) {
  if (!secret) return null;
  return crypto
    .createHmac("sha256", secret)
    .update("simplebeacon-vault")
    .digest("hex");
}

/**
 * Is vault authenticated.
 * @param {any} req
 * @param {Object} options
 * @returns {any}
 */
function isVaultAuthenticated(req, options = {}) {
  const internalDashboard = options.internalDashboard === true;
  if (!internalDashboard) return true;

  const secret = options.vaultPassword || process.env.DASHBOARD_VAULT_PASSWORD;
  const expected = getVaultSessionToken(secret);
  if (!expected) return false;
  // Cookie only — never accept ?password= on arbitrary routes (leaks in logs/referrers).
  return parseRequestCookies(req).sb_vault === expected;
}

/**
 * Is protected dashboard path.
 * @param {string} reqPath
 * @returns {any}
 */
function isProtectedDashboardPath(reqPath) {
  if (reqPath === "/favicon.svg" || reqPath === "/favicon.ico") return false;
  // Exclude static assets (CSS, JS, images, fonts) from vault protection
  if (
    /\.(css|js|mjs|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i.test(
      reqPath,
    )
  )
    return false;
  return /^\/(app|demo|signin|dashboard-new\.html|simplebeacon-dashboard|services|scripts|components|assets)(\/|$)/.test(
    reqPath,
  );
}

/** @deprecated Dashboard JS/CSS/JSON are vault-gated when DASHBOARD_VAULT_PASSWORD is set. */
function isPublicDashboardAssetPath(reqPath) {
  return reqPath === "/favicon.svg" || reqPath === "/favicon.ico";
}

/**
 * Set vault session cookie.
 * @param {Array} res
 * @param {any} secret
 * @returns {any}
 */
function setVaultSessionCookie(res, secret) {
  const token = getVaultSessionToken(
    secret || process.env.DASHBOARD_VAULT_PASSWORD,
  );
  if (!token) return;
  const isProduction = process.env.NODE_ENV === "production";
  // SameSite=Strict prevents CSRF — cookie is never sent on cross-site requests.
  // Secure=true in production ensures cookie is only sent over HTTPS.
  const flags = [
    `sb_vault=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=86400`,
  ];
  if (isProduction) flags.push("Secure");
  res.setHeader("Set-Cookie", flags.join("; "));
}

module.exports = {
  parseRequestCookies,
  getVaultSessionToken,
  isVaultAuthenticated,
  isProtectedDashboardPath,
  isPublicDashboardAssetPath,
  setVaultSessionCookie,
};
