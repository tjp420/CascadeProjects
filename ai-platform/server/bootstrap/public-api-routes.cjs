/**
 * Canonical source-of-truth for API routes that bypass the REQUIRE_AUTH gate.
 * Paths are relative to /api and should not include a leading slash.
 */

const PUBLIC_API_PATHS = new Set([
  "health",
  "health/db",
  "auth/login",
  "auth/register",
  "auth/refresh",
  "auth/logout",
  "auth/me",
  "platform/status",
  "mock-backend.js",
  "simplebeacon/billing/plan",
  "simplebeacon/billing/webhook",
  "simplebeacon/billing/checkout",
  "billing/tiers",
  "billing/proration-preview",
  "simplebeacon/config",
  "simplebeacon/config/presets",
  "simplebeacon/history",
  "simplebeacon/baseline",
  "simplebeacon/report",
  "config/pricing",
  "waitlist",
  "waitlist/count",
  "waitlist/event",
  "audit-booking",
  "audit-bookings",
  "free-token",
  "tokens/sandbox",
  "simplebeacon/billing/resend-token",
  "simplebeacon/billing/status",
  "simplebeacon/billing/session",
  "simplebeacon/billing/license",
  "simplebeacon/billing/portal",
  "simplebeacon/ci/telemetry",
  "simplebeacon/ci/telemetry/summary",
  "quota/check",
  "quota/consume",
  "subscribe",
  "reports/upload",
  "trust/verification",
  "trust/verify",
  "trust/history",
  "trust/trend",
  "trust/methodology",
  "trust/badge.svg",
  "trust/badge",
  "optimization/health",
  "optimization/compliance",
  "optimization/candidates",
  "analyze/upload-directory",
  "reports/download",
  "chatbot/disclosure",
  "chatbot/providers",
  "chatbot/message",
  // Referral program — public capture, link generation, stats, invites
  "referral/capture",
  "referral/link",
  "referral/stats",
  "referral/invite",
  // Legacy dashboard.html scanner wiring (read-only repository scans)
  "project-structure",
  "backlog",
  "mock-analysis",
  "mock-conversion",
  "mock-validation",
  "mock-cleaning",
  "gguf/mock-analysis-report",
  // Enterprise onboarding — org provisioning, seat management, trial, Azure DevOps
  "enterprise/onboard",
  "enterprise/organizations",
  "enterprise/trial",
  // Whitelabel branding — public resolve + CSS endpoints for dashboard BrandContext
  "whitelabel/resolve",
  "whitelabel/brand.css",
  // Prompt service — GET /api/prompts/get is read-only and returns the user's custom
  // chatbot prompt (empty for anonymous). Required by the chatbot UI on the public
  // dashboard. POST /set and DELETE /delete remain auth-gated.
  "prompts/get",
  // SSO domain resolution — pre-login lookup for login page auto-detection.
  // The frontend calls this before the user authenticates to check if SSO is
  // available for a given email domain. Presets are read-only provider configs.
  "sso/resolve",
  "sso/presets",
  // SSO protocol routes — IdP redirect targets (user is not authenticated yet)
  "sso/oidc/login",
  "sso/oidc/callback",
  "sso/saml/login",
  "sso/saml/acs",
  "sso/saml/metadata",
  // Contact form — public endpoint, delivers to Zoho via email service
  "contact",
  // One-time checkout — certificate passes ($149/$499/$2,499) from coming-soon
  "create-checkout-session",
  "test-checkout",
  "checkout/webhook",
  "session-token",
  "receipt",
  // CLI license validation — public, token-only auth (used by GitHub Action in CI)
  "license/validate",
  // License token status — dashboard sign-in flow validates token before activating
  "auth/token-status",
  // Subscription webhook — Stripe signs requests, no JWT auth
  "subscription/webhook",
  "create-subscription-session",
]);

/**
 * Is public optimization route.
 * @param {string} relativePath
 * @param {any} method
 * @returns {any}
 */
function isPublicOptimizationRoute(relativePath, method) {
  if (
    method === "GET" &&
    (relativePath === "optimization/health" ||
      relativePath === "optimization/compliance" ||
      relativePath === "optimization/candidates")
  ) {
    return true;
  }
  if (
    method === "POST" &&
    (relativePath === "optimization/analyze" ||
      relativePath === "optimization/merge-preview")
  ) {
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
  if (relativePath === "assessments" && method === "POST") return true;
  if (relativePath === "assessment/scan" && method === "POST") return true;
  if (relativePath === "assessment/health" && method === "GET") return true;
  if (
    method === "GET" &&
    /^assessments\/assessment_\d+(?:\/download\/[\w-]+)?$/.test(relativePath)
  )
    return true;
  if (
    method === "GET" &&
    /^assessment\/report\/assessment_\d+(?:\/download\/[\w-]+)?$/.test(
      relativePath,
    )
  )
    return true;
  return false;
}

/**
 * Is public simplebeacon demo route.
 * @param {string} relativePath
 * @returns {any}
 */
function isPublicSimplebeaconDemoRoute(relativePath) {
  return relativePath.startsWith("simplebeacon/demo");
}

/**
 * Chatbot routes use optionalAuthenticate on handlers; bypass global REQUIRE_AUTH gate.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isPublicChatbotRoute(relativePath) {
  const pathKey = String(relativePath || "").replace(/^\/+/, "");
  return pathKey === "chatbot" || pathKey.startsWith("chatbot/");
}

/**
 * WebAuthn sign-in challenge + assertion are public; register/credentials require JWT.
 * @param {string} relativePath
 * @param {string} method
 * @returns {boolean}
 */
function isPublicWebAuthnRoute(relativePath, method) {
  const pathKey = String(relativePath || "").replace(/^\/+/, "");
  return (
    method === "POST" &&
    (pathKey === "webauthn/challenge" || pathKey === "webauthn/authenticate")
  );
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
  if (method !== "GET") return false;
  const pathKey = String(relativePath || "").replace(/^\/+/, "");
  const publicExact = new Set(["dashboard-home", "status"]);
  if (publicExact.has(pathKey)) return true;
  const publicPrefixes = [
    "dev-tools",
    "analytics",
    "merger-tool/merges",
    "merger-tool/overview",
    "merger-tool/activity",
    "merger-tool/statistics",
    "coverage-reports",
    "settings",
    "help",
    "quality",
    "security/overview",
    "security/threats",
    "security/vulnerabilities",
    "security/incidents",
    "security/compliance",
    "support",
  ];
  for (const prefix of publicPrefixes) {
    if (pathKey === prefix || pathKey.startsWith(prefix + "/")) return true;
  }
  return false;
}

/**
 * Resolve api relative path.
 * @param {any} req
 * @returns {any}
 */
function resolveApiRelativePath(req) {
  const mounted = String(req.path || "")
    .replace(/^\/+/, "")
    .replace(/^api\/?/i, "");
  if (mounted) return mounted;
  const raw = String(req.originalUrl || req.url || "").split("?")[0];
  return raw.replace(/^\/api\/?/i, "").replace(/^\/+/, "");
}

/**
 * Is public api route.
 * @param {string} relativePath
 * @param {any} method
 * @returns {any}
 */
function isPublicApiRoute(relativePath, method) {
  const pathKey = String(relativePath || "").replace(/^\/+/, "");
  return (
    PUBLIC_API_PATHS.has(pathKey) ||
    pathKey.startsWith("session-token/") ||
    pathKey.startsWith("health") ||
    isPublicAssessmentRoute(pathKey, method) ||
    isPublicOptimizationRoute(pathKey, method) ||
    isPublicSimplebeaconDemoRoute(pathKey) ||
    isPublicChatbotRoute(pathKey) ||
    isPublicWebAuthnRoute(pathKey, method) ||
    isPublicDashboardRoute(pathKey, method)
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
  isPublicDashboardRoute,
};
