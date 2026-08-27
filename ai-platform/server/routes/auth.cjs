// SPDX-License-Identifier: MIT
/**
 * Authentication routes — login, logout, refresh, me.
 *
 * Role: Express route handlers (HTTP endpoints).
 * Distinct from middleware/auth.cjs (JWT verification & role-check middleware).
 * Both named auth.cjs by architectural convention (routes vs middleware layer).
 *
 * @license MIT
 */

const express = require("express");
const {
  authenticate,
  optionalAuthenticate,
  generateToken,
} = require("../middleware/auth.cjs");

const {
  handleLogin,
  handleTokenRefresh,
} = require("../lib/auth/login-service.cjs");

const {
  generateToken: tokenServiceGenerateToken,
} = require("../lib/auth/token-service.cjs");
const { registerUser } = require("../services/user-service.cjs");
const { trustLevels } = require("../lib/auth/trust-levels.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

// License token validation helpers (used by token-status endpoint)
let getLicenseToken = null;
let verifyLicenseToken = null;
let resolveLicenseSecret = null;
try {
  ({ getLicenseToken } = require("../lib/token-db.cjs"));
} catch (_) {}
try {
  ({ verifyLicenseToken } = require("../lib/simplebeacon-proxy.cjs"));
} catch (_) {}
try {
  // resolveLicenseSecret is defined in simplebeacon-proxy.cjs in some versions
  if (!resolveLicenseSecret) {
    const proxy = require("../lib/simplebeacon-proxy.cjs");
    resolveLicenseSecret = proxy.resolveLicenseSecret || null;
  }
} catch (_) {}

const router = express.Router();

router.post("/login", handleLogin);

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return sendError(res, 400, "Email and password required");
    }
    const result = await registerUser(email, password, name, {
      db: req.app?.locals?.db || req.db || null,
    });
    if (result.error) {
      return sendError(res, 409, "Registration failed", {
        message: result.error,
      });
    }
    try {
      const {
        processReferralSignup,
      } = require("../../../coming-soon/lib/referral-webhook.cjs");
      processReferralSignup(req, result.user.email);
    } catch (referralErr) {
      console.error("auth.cjs error:", referralErr);
      // Non-blocking — signup succeeds even if referral cookie is absent
    }
    const token = tokenServiceGenerateToken(result.user);
    res.json({
      message: "Registration successful",
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        trustLevel: result.user.trustLevel,
        permissions: (trustLevels[result.user.trustLevel] || trustLevels.bronze)
          .permissions,
      },
    });
  } catch (error) {
    sendError(res, 500, "register_error", { message: error.message });
  }
});

// simplebeacon-ignore sensitive-data — health-check test token, not a real secret
router.get("/health", (req, res) => {
  try {
    const token = tokenServiceGenerateToken({
      id: "user-healthcheck",
      email: "health@simplebeacon.ai",
      name: "Health Check",
      trustLevel: "silver",
    });
    res.json({ ok: true, jwtWorks: true, token });
  } catch (err) {
    res
      .status(500)
      .json({ ok: false, jwtWorks: false, error: "jwt_generation_failed" });
  }
});

router.post("/logout", optionalAuthenticate, (req, res) => {
  // JWT is stateless; logout is client-side token discard.
  // For future sessions, we could add a token denylist here.
  res.json({ success: true, message: "Logged out successfully" });
});

router.post("/refresh", optionalAuthenticate, handleTokenRefresh);

router.get("/me", optionalAuthenticate, (req, res) => {
  if (req.user) {
    return res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        trustLevel: req.user.trustLevel,
        permissions: req.user.permissions,
      },
    });
  }
  // Return a guest user so the dashboard can load without an explicit 401
  res.json({
    success: true,
    user: {
      id: "guest",
      email: null,
      name: "Guest",
      trustLevel: "bronze",
      permissions: (trustLevels.bronze || { permissions: [] }).permissions,
    },
  });
});

// License token status check — used by dashboard sign-in flow to validate
// a license token before activating. Public (no JWT auth) because the
// license token itself is the credential.
router.post("/token-status", express.json(), (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== "string") {
    return res
      .status(400)
      .json({ registered: false, valid: false, error: "Token required" });
  }

  const secret = resolveLicenseSecret
    ? resolveLicenseSecret()
    : (process.env.SIMPLEBEACON_LICENSE_SECRET || "").trim() || null;
  if (!secret) {
    return res.status(503).json({
      registered: false,
      valid: false,
      error:
        "License validation unavailable: SIMPLEBEACON_LICENSE_SECRET is not configured",
    });
  }

  if (verifyLicenseToken) {
    const claims = verifyLicenseToken(token, secret);
    if (claims) {
      const email = claims.sub || claims.email || null;
      const tier = claims.tier || "developer";
      let entry = null;
      try {
        if (getLicenseToken) entry = getLicenseToken(token);
      } catch (_) {}
      return res.json({
        registered: true,
        valid: true,
        email: (entry && entry.email) || email,
        tier: (entry && entry.tier) || tier,
        features: claims.features || [],
        registeredAt:
          (entry && entry.registered_at) ||
          (claims.iat ? new Date(claims.iat * 1000).toISOString() : null),
        expiresAt: claims.exp
          ? new Date(claims.exp * 1000).toISOString()
          : null,
        expiry: claims.exp || null,
      });
    }
  }

  // Token signature invalid — check if it's registered in the DB
  let entry = null;
  try {
    if (getLicenseToken) entry = getLicenseToken(token);
  } catch (_) {}
  if (entry) {
    return res.json({
      registered: true,
      valid: false,
      email: entry.email,
      tier: entry.tier,
      registeredAt: entry.registered_at,
    });
  }
  return res.json({ registered: false, valid: false });
});

module.exports = router;
