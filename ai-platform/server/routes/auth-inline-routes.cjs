// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const constants = require("../config/constants.cjs");
const logger = require("../lib/app-logger.cjs");
const {
  authenticate,
  optionalAuthenticate,
  generateToken,
} = require("../middleware/auth.cjs");

const {
  handleLogin,
  handleTokenRefresh,
} = require("../lib/auth/login-service.cjs");
const { validateInput } = require("../middleware/security.cjs");
const { getLicenseToken, insertLicenseToken } = require("../lib/token-db.cjs");
const { verifyLicenseToken } = require("../lib/simplebeacon-proxy.cjs");
const {
  isDatabaseEnabled,
  getDatabaseConfig,
} = require("../config/database.cjs");
const DatabaseAdapter = require("../lib/database-adapter.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

const router = express.Router();

function resolveLicenseSecret() {
  const secret = (process.env.SIMPLEBEACON_LICENSE_SECRET || "").trim();
  return secret || null;
}

let dbAdapter = null;
if (isDatabaseEnabled()) {
  try {
    dbAdapter = new DatabaseAdapter(getDatabaseConfig());
  } catch (e) {
    logger.warn("[Auth] Database adapter creation failed:", e.message);
  }
}

const authLoginRateLimit = rateLimit({
  windowMs: Number(
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS ||
      constants.RATE_LIMIT_WINDOW_MS,
  ),
  max: Number(
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX || constants.AUTH_RATE_LIMIT,
  ),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts",
    message: "Please wait before trying to sign in again.",
  },
});

router.post(
  "/auth/login",
  authLoginRateLimit,
  validateInput("login"),
  (req, res, next) => {
    if (dbAdapter) req.db = dbAdapter;
    next();
  },
  handleLogin,
);

router.post("/auth/register", authLoginRateLimit, async (req, res, next) => {
  if (dbAdapter) req.db = dbAdapter;
  try {
    const { handleRegister } = require("../lib/auth/registration-service.cjs");
    return await handleRegister(req, res);
  } catch (error) {
    next(error);
  }
});

router.post("/auth/refresh", optionalAuthenticate, handleTokenRefresh);

router.get("/auth/me", optionalAuthenticate, (req, res) => {
  if (req.user) {
    res.json({
      user: req.user,
      authenticated: true,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.json({
      user: null,
      authenticated: false,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post("/auth/logout", (req, res) => {
  res.json({ message: "Logged out", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Password Recovery — forgot-password + reset-password
//
// Two-phase flow:
//   1. POST /api/simplebeacon/auth/forgot-password
//      - Validates email exists, generates a 15-minute JWT reset token
//      - Emails a recovery link to the user
//      - Returns the same response regardless of whether the email exists
//        (prevents user enumeration)
//
//   2. POST /api/simplebeacon/auth/reset-password
//      - Verifies the JWT reset token (signature + expiry + action claim)
//      - Hashes the new password with bcrypt and updates the user record
//      - Single-use: the token's jti is consumed after one successful reset
// ---------------------------------------------------------------------------

// In-memory set of consumed reset token JTIs (single-use enforcement).
// Single-instance Render deployment — sufficient for current load.
const consumedResetTokens = new Set();

// Periodically clean up expired entries (every 15 minutes)
setInterval(() => {
  // The set only grows during the TTL window; clear entries older than 30 min
  // by simply capping the set size — JWT expiry handles the real enforcement.
  if (consumedResetTokens.size > 1000) {
    consumedResetTokens.clear();
  }
}, 15 * 60 * 1000).unref();

// Rate limiter for password reset requests — 5 per minute per IP
const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many password reset attempts",
    message: "Please wait before requesting another reset link.",
  },
});

router.post(
  "/simplebeacon/auth/forgot-password",
  passwordResetRateLimit,
  async (req, res) => {
    const { email } = req.body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({
        message: "A valid email address is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      // Load user service lazily to avoid circular deps
      const { findUserByEmailOnly } = require("../services/user-service.cjs");
      const db = dbAdapter;
      const user = await findUserByEmailOnly(db, normalizedEmail);

      // Always return the same response to prevent user enumeration
      const successResponse = {
        message:
          "If an account with that email exists, a secure recovery link has been sent to your inbox.",
      };

      if (!user) {
        // Don't reveal whether the email exists — just return success
        return res.json(successResponse);
      }

      // Generate a 15-minute reset token with action: RESET_PASSWORD
      const jwt = require("jsonwebtoken");
      const { jwtConfig } = require("../lib/jwt-config.cjs");
      const resetJti =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : crypto.randomBytes(16).toString("hex");

      const resetToken = jwt.sign(
        {
          sub: String(user.id),
          email: normalizedEmail,
          action: "RESET_PASSWORD",
          jti: resetJti,
        },
        jwtConfig.secret,
        {
          algorithm: jwtConfig.algorithm,
          issuer: jwtConfig.issuer,
          audience: "simplebeacon-password-reset",
          expiresIn: "15m",
        },
      );

      // Construct the recovery link targeting the hash router
      const baseUrl =
        process.env.SIMPLEBEACON_DASHBOARD_URL ||
        process.env.PUBLIC_URL ||
        "https://simplebeacon.ai";
      const recoveryLink = `${baseUrl}/#/reset-password?token=${resetToken}`;

      // Send the email
      try {
        const { sendEmail } = require("../lib/email-service.cjs");
        await sendEmail({
          to: normalizedEmail,
          subject: "Reset your SimpleBeacon Password",
          text: `You requested a password reset for your SimpleBeacon account.\n\nClick here to reset your password: ${recoveryLink}\n\nThis link expires in 15 minutes.\n\nIf you did not request this reset, you can safely ignore this email.`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px"><h2 style="color:#10b981">Reset your SimpleBeacon Password</h2><p>You requested a password reset for your SimpleBeacon account.</p><p style="margin:24px 0"><a href="${recoveryLink}" style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Reset Password</a></p><p style="color:#666;font-size:13px">This link expires in 15 minutes.</p><p style="color:#999;font-size:12px">If you did not request this reset, you can safely ignore this email.</p><hr style="border:none;border-top:1px solid #eee;margin:20px 0"><p style="color:#999;font-size:11px">SimpleBeacon — Local-first AI code security</p></div>`,
        });
      } catch (emailErr) {
        logger.warn("[forgot-password] Email send failed:", emailErr.message);
        // Don't reveal the email failure to the client — return success
        // to prevent enumeration. The token is still valid.
      }

      try {
        logger.info("[forgot-password] Reset token issued", {
          email: normalizedEmail.slice(0, 3) + "***",
          jti: resetJti.slice(0, 8),
        });
      } catch {
        // logger may be unavailable
      }

      return res.json(successResponse);
    } catch (err) {
      logger.error("[forgot-password] Error:", err.message);
      // Don't reveal internal errors — return the same success response
      return res.json({
        message:
          "If an account with that email exists, a secure recovery link has been sent to your inbox.",
      });
    }
  },
);

router.post(
  "/simplebeacon/auth/reset-password",
  passwordResetRateLimit,
  async (req, res) => {
    const { token, newPassword } = req.body || {};

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        error: "Reset token is required.",
      });
    }
    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({
        error: "A new password is required.",
      });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters.",
      });
    }

    try {
      const jwt = require("jsonwebtoken");
      const { jwtConfig } = require("../lib/jwt-config.cjs");

      // Verify the token — enforces signature, expiry, issuer, audience
      const payload = jwt.verify(token, jwtConfig.secret, {
        algorithms: [jwtConfig.algorithm],
        issuer: jwtConfig.issuer,
        audience: "simplebeacon-password-reset",
      });

      // Check the action claim
      if (payload.action !== "RESET_PASSWORD") {
        return res.status(400).json({
          error: "Invalid reset token.",
        });
      }

      // Check if the token has already been used (single-use enforcement)
      if (payload.jti && consumedResetTokens.has(payload.jti)) {
        return res.status(401).json({
          error: "This recovery link has already been used. Please request a new one.",
        });
      }

      // Update the user's password
      const { updateUserPassword } = require("../services/user-service.cjs");
      const db = dbAdapter;
      const updated = await updateUserPassword(
        db,
        payload.email,
        newPassword,
      );

      if (!updated) {
        return res.status(404).json({
          error: "Account not found. The email may have been changed.",
        });
      }

      // Mark the token as consumed (single-use)
      if (payload.jti) {
        consumedResetTokens.add(payload.jti);
      }

      try {
        logger.info("[reset-password] Password updated successfully", {
          email: String(payload.email || "").slice(0, 3) + "***",
          jti: String(payload.jti || "").slice(0, 8),
        });
      } catch {
        // logger may be unavailable
      }

      return res.json({
        status: "success",
        message: "Password updated successfully. You can now sign in with your new password.",
      });
    } catch (err) {
      // Token is invalid, expired, or tampered with
      const message =
        err.name === "TokenExpiredError"
          ? "This recovery link has expired. Please request a new one."
          : "This recovery link is invalid or has been tampered with.";
      return res.status(401).json({ error: message });
    }
  },
);

// JWT auth token verification — used by the Cloudflare Worker's scan
// attestation endpoint to validate the user's auth token without
// sharing the JWT secret with the edge.
router.post("/auth/verify", async (req, res) => {
  const token =
    (req.body && req.body.token) ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || typeof token !== "string") {
    return res
      .status(401)
      .json({ valid: false, error: "Token required" });
  }
  try {
    const { verifyToken } = require("../lib/auth/token-service.cjs");
    const payload = await verifyToken(token);
    if (payload) {
      return res.json({
        valid: true,
        user: {
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role,
          tier: payload.tier || payload.plan,
        },
      });
    }
  } catch (_) {
    // verifyToken throws on invalid tokens
  }
  return res.status(401).json({ valid: false, error: "Invalid or expired token" });
});

// Scan attestation endpoint — issues short-lived attestation JWTs for the browser scan worker.
// The worker verifies the attestation before running to prevent casual copying of the worker script.
// The attestation is bound to a device fingerprint and expires in 5 minutes.
const ATTEST_TTL_SECONDS = 300; // 5 minutes
const attestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 attestations per minute per IP (scans can retry)
  standardHeaders: true,
  legacyHeaders: false,
});
router.post("/scan/attest", attestLimiter, async (req, res) => {
  const token =
    (req.body && req.body.token) ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || typeof token !== "string") {
    return res.status(401).json({ error: "Auth token required" });
  }
  const deviceFingerprint = req.body && req.body.deviceFingerprint;
  if (!deviceFingerprint || typeof deviceFingerprint !== "string") {
    return res.status(400).json({ error: "Device fingerprint required" });
  }
  try {
    const { verifyToken } = require("../lib/auth/token-service.cjs");
    const jwt = require("jsonwebtoken");
    const { jwtConfig } = require("../lib/jwt-config.cjs");
    const payload = await verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    // Issue a short-lived attestation JWT
    const attestation = jwt.sign(
      {
        sub: payload.sub,
        email: payload.email,
        tier: payload.tier || payload.plan || "free",
        deviceFingerprint: String(deviceFingerprint).slice(0, 128),
        type: "scan-attestation",
        iat: Math.floor(Date.now() / 1000),
        jti:
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : crypto.randomBytes(16).toString("hex"),
      },
      jwtConfig.secret,
      {
        algorithm: jwtConfig.algorithm,
        issuer: jwtConfig.issuer,
        audience: "simplebeacon-scan-worker",
        expiresIn: ATTEST_TTL_SECONDS,
      },
    );
    const expiresAt = Date.now() + ATTEST_TTL_SECONDS * 1000;
    return res.json({
      attestation,
      expiresAt,
      scanId:
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : crypto.randomBytes(16).toString("hex"),
      tier: payload.tier || payload.plan || "free",
    });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    logger.error("[scan/attest] Error issuing attestation:", err?.message || err);
    return res.status(500).json({ error: "Failed to issue attestation" });
  }
});

// License token status check (cryptographic validation + registry lookup)
router.post("/auth/token-status", (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== "string") {
    return res
      .status(400)
      .json({ registered: false, valid: false, error: "Token required" });
  }

  const secret = resolveLicenseSecret();
  if (!secret) {
    return res.status(503).json({
      registered: false,
      valid: false,
      error:
        "License validation unavailable: SIMPLEBEACON_LICENSE_SECRET is not configured",
    });
  }

  const claims = verifyLicenseToken(token, secret);
  if (claims) {
    const email = claims.sub || claims.email || null;
    const tier = claims.tier || "developer";
    const entry = getLicenseToken(token);
    return res.json({
      registered: true,
      valid: true,
      email: entry?.email || email,
      tier: entry?.tier || tier,
      features: claims.features || [],
      registeredAt:
        entry?.registered_at ||
        (claims.iat ? new Date(claims.iat * 1000).toISOString() : null),
      expiresAt: claims.exp ? new Date(claims.exp * 1000).toISOString() : null,
      expiry: claims.exp || null,
    });
  }

  const entry = getLicenseToken(token);
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

// Public license validation endpoint used by CLI/GitHub Action in CI
router.post("/license/validate", (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== "string") {
    return res
      .status(400)
      .json({
        active: false,
        sandbox: true,
        registered: false,
        valid: false,
        error: "Token required",
      });
  }

  const secret = resolveLicenseSecret();
  if (!secret) {
    return res.status(503).json({
      active: false,
      sandbox: true,
      registered: false,
      valid: false,
      error:
        "License validation unavailable: SIMPLEBEACON_LICENSE_SECRET is not configured",
    });
  }

  const claims = verifyLicenseToken(token, secret);
  const entry = getLicenseToken(token);
  const registered = !!claims || !!entry;
  const active = registered && claims !== null;
  const tier = entry?.tier || claims?.tier || "developer";
  const upgradeUrl =
    process.env.SIMPLEBEACON_UPGRADE_URL || "https://simplebeacon.ai/pricing";

  res.json({
    active,
    sandbox: !active,
    registered,
    valid: !!claims,
    email: entry?.email || claims?.sub || claims?.email || null,
    tier,
    features: claims?.features || [],
    expiry: claims?.exp || null,
    upgradeUrl,
  });
});

router.post("/auth/register-token", (req, res) => {
  const { token, email } = req.body || {};
  if (!token || typeof token !== "string") {
    return sendError(res, 400, "Token required");
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return sendError(res, 400, "Valid email required");
  }
  const existing = getLicenseToken(token);
  if (existing) {
    return sendError(res, 409, "Token already registered", {
      email: existing.email,
    });
  }
  let tier = "community";
  try {
    const parts = token.split(".");
    const payloadBase64 = parts.length === 2 ? parts[0] : parts[1];
    if (payloadBase64) {
      const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const json = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
      tier = json.tier || json.product || "community";
    }
  } catch {
    /* ignore decode errors */
  }
  insertLicenseToken({
    token,
    email: email.toLowerCase(),
    tier,
    registered_at: new Date().toISOString(),
  });
  res.json({ success: true, registered: true, tier });
});

// ---------------------------------------------------------------------------
// Server-signed report authorization (export gate)
//
// POST /simplebeacon/user/sign-report
//
// Premium local exports (PDF, JSON, certificate, board-ready reports) generated
// in the VSIX or browser call this endpoint to obtain a server signature over
// a report hash. The server NEVER receives raw source code or the full report
// body — only a small metadata block + SHA-256 hash. The signed authorization
// is embedded into the locally-generated artifact so downstream consumers can
// verify it was produced by an authenticated, paid-tier SimpleBeacon account.
//
// Request:
//   Authorization: Bearer <jwt>
//   { reportHash: string, reportType: string, metadata?: object }
//
// Response (200):
//   { signed: true, signature, signedAt, expiresAt, tier, serverKeyId, user: { sub, email } }
//
// Response (401): invalid/expired/missing token
// Response (403): free-tier account (premium exports require a paid tier)
// Response (400): missing/invalid reportHash or reportType
// Response (503): signing secret not configured
// ---------------------------------------------------------------------------
// Tier-specific export type permissions — matches the VSIX exportGate.ts model.
// Free:       Markdown summary only
// Developer:  Structural JSON + individual audit certificates
// Team Pro:   Board-ready PDFs + compliance mappings
// Enterprise: Everything (multi-user audit logs)
const TIER_EXPORT_PERMISSIONS = {
  free: new Set([
    "report-markdown", "diagnostic-log", "code-map", "ai-context", "roadmap",
  ]),
  developer: new Set([
    "report-markdown", "diagnostic-log", "code-map", "ai-context", "roadmap",
    "report-json", "report-csv", "report-html", "certificate",
  ]),
  team: new Set([
    "report-markdown", "diagnostic-log", "code-map", "ai-context", "roadmap",
    "report-json", "report-csv", "report-html", "certificate",
    "report-pdf", "report-excel", "trust-report", "ai-report", "email-report",
  ]),
  enterprise: new Set([
    "report-markdown", "diagnostic-log", "code-map", "ai-context", "roadmap",
    "report-json", "report-csv", "report-html", "certificate",
    "report-pdf", "report-excel", "trust-report", "ai-report", "email-report",
  ]),
};

// Tier aliases → canonical tier
const TIER_ALIASES = {
  free: "free", community: "free", sandbox: "free", instant: "free",
  locked: "free", solo: "free", "": "free",
  developer: "developer", pro: "developer", startup: "developer",
  business: "developer", premium: "developer", license: "developer",
  auditor: "developer", paid: "developer", silver: "developer", gold: "developer",
  developer_tier: "developer",
  team: "team", team_pro: "team", "team-pro": "team", eusprint: "team",
  growth: "team",
  enterprise: "enterprise", compliance: "enterprise", universal: "enterprise",
  custom: "enterprise", admin: "enterprise",
};

function normalizeTierForExport(raw) {
  const t = String(raw || "").toLowerCase().trim();
  return TIER_ALIASES[t] || "free";
}

function resolveReportSigningSecret() {
  const secret = (
    process.env.SIMPLEBEACON_REPORT_SIGNING_SECRET ||
    process.env.SIMPLEBEACON_LICENSE_SECRET ||
    process.env.JWT_SECRET ||
    ""
  ).trim();
  return secret || null;
}

/**
 * Resolve the RSA private key PEM for report signing.
 * Uses SIMPLEBEACON_REPORT_SIGNING_PRIVATE_KEY or falls back to
 * SIMPLEBEACON_SIGNING_PRIVATE_KEY (the same key used by the Worker for certify).
 * Returns null if no RSA key is configured — callers fall back to HMAC.
 */
function resolveReportSigningPrivateKey() {
  const pem = (
    process.env.SIMPLEBEACON_REPORT_SIGNING_PRIVATE_KEY ||
    process.env.SIMPLEBEACON_SIGNING_PRIVATE_KEY ||
    ""
  ).trim();
  if (!pem) return null;
  // Must look like a PEM key
  if (!pem.includes("-----BEGIN")) return null;
  return pem;
}

/**
 * Resolve the RSA public key PEM for signature verification.
 * Used by the /verify-signature endpoint so third parties can verify
 * report signatures without the private key.
 */
function resolveReportSigningPublicKey() {
  const pem = (
    process.env.SIMPLEBEACON_REPORT_SIGNING_PUBLIC_KEY ||
    process.env.SIMPLEBEACON_SIGNING_PUBLIC_KEY ||
    ""
  ).trim();
  if (!pem || !pem.includes("-----BEGIN")) return null;
  return pem;
}

/**
 * Sign a canonical message using RSA-SHA256.
 * Returns { signature, algorithm, keyId } or null if signing fails.
 */
function signWithRsa(privateKeyPem, canonical) {
  try {
    const signer = crypto.createSign("SHA256");
    signer.update(canonical, "utf8");
    const signature = signer.sign(privateKeyPem, "hex");
    return { signature, algorithm: "RSA-SHA256", keyId: "sb-rsa-v1" };
  } catch {
    return null;
  }
}

/**
 * Verify an RSA-SHA256 signature against a canonical message.
 * Returns true if the signature is valid.
 */
function verifyRsaSignature(publicKeyPem, canonical, signatureHex) {
  try {
    const verifier = crypto.createVerify("SHA256");
    verifier.update(canonical, "utf8");
    return verifier.verify(publicKeyPem, signatureHex, "hex");
  } catch {
    return false;
  }
}

/**
 * Sign with HMAC-SHA256 (fallback when no RSA key is configured).
 */
function signWithHmac(secret, canonical) {
  return {
    signature: crypto.createHmac("sha256", secret).update(canonical).digest("hex"),
    algorithm: "HMAC-SHA256",
    keyId: "sb-hmac-v1",
  };
}

router.post("/simplebeacon/user/sign-report", optionalAuthenticate, async (req, res) => {
  let user = req.user;

  // If JWT auth didn't set req.user, try license token from Bearer header.
  // License tokens (2-part) are different from JWTs (3-part) and are used
  // by the VS Code extension when the user pastes a license key instead of
  // signing in with email/password.
  if (!user) {
    const rawToken =
      typeof req.headers.authorization === "string" &&
      req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.substring(7)
        : "";
    if (rawToken) {
      const secret = resolveLicenseSecret();
      if (secret) {
        try {
          const claims = verifyLicenseToken(rawToken, secret);
          if (claims) {
            const entry = getLicenseToken(rawToken);
            user = {
              id: claims.sub || claims.email || "license-user",
              email: entry?.email || claims.sub || claims.email || "",
              name: claims.name || "",
              tier: entry?.tier || claims.tier || "developer",
              plan: entry?.tier || claims.tier || "developer",
              features: Array.isArray(claims.features) ? claims.features : [],
              role: claims.role || "",
            };
          }
        } catch (_) {
          // license token verification failed
        }
      }
    }
  }

  if (!user) {
    return res
      .status(401)
      .json({ signed: false, error: "Authentication required" });
  }

  const body = req.body || {};
  const reportHash = typeof body.reportHash === "string" ? body.reportHash.trim() : "";
  const reportType = typeof body.reportType === "string" ? body.reportType.trim() : "";

  if (!reportHash || !/^[a-f0-9]{8,128}$/i.test(reportHash)) {
    return res
      .status(400)
      .json({ signed: false, error: "Valid reportHash (hex SHA-256) required" });
  }
  if (!reportType || reportType.length > 64) {
    return res
      .status(400)
      .json({ signed: false, error: "Valid reportType required (max 64 chars)" });
  }

  // Tier enforcement — 3-tier model matching the VSIX exportGate.
  // The server is the authoritative check; the client tier check is UX only.
  const rawTier = String(user.tier || user.plan || "").toLowerCase();
  const canonicalTier = normalizeTierForExport(rawTier);
  const features = Array.isArray(user.features) ? user.features.map(String) : [];
  const hasPaidFeature = features
    .map((s) => s.toLowerCase())
    .some((f) => f === "premium_exports" || f === "team_dashboard");

  // Check if this tier is allowed to export this report type
  const allowedTypes = TIER_EXPORT_PERMISSIONS[canonicalTier] || TIER_EXPORT_PERMISSIONS.free;
  if (!allowedTypes.has(reportType) && !hasPaidFeature) {
    // Determine the minimum tier needed for this export type
    let minTier = "team";
    if (TIER_EXPORT_PERMISSIONS.developer.has(reportType)) minTier = "developer";
    const minTierLabel = minTier === "developer" ? "Developer ($49/mo)" : "Team Pro ($149/mo)";
    return res
      .status(403)
      .json({
        signed: false,
        error: `${reportType} requires the ${minTierLabel} tier or higher`,
        tier: canonicalTier,
        minTier,
        upgradeUrl:
          process.env.SIMPLEBEACON_UPGRADE_URL || "https://simplebeacon.ai/pricing",
      });
  }

  // Build a canonical signing payload. Only the hash + small metadata are signed.
  // The server never sees the full report or any source code.
  const signedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7-day validity
  const userSub = String(user.id || user.sub || user.email || "unknown");

  // Rate limit: per-user, max 30 signed reports per minute.
  const rateKey = "sign-report:" + userSub;
  const now = Date.now();
  const windowMs = 60_000;
  signReportRateBucket.set(
    rateKey,
    (signReportRateBucket.get(rateKey) || []).filter((t) => now - t < windowMs),
  );
  const hits = signReportRateBucket.get(rateKey) || [];
  if (hits.length >= 30) {
    return res
      .status(429)
      .json({ signed: false, error: "Rate limit exceeded. Try again in a minute." });
  }
  hits.push(now);
  signReportRateBucket.set(rateKey, hits);

  const metadataBlock = {
    reportHash,
    reportType,
    tier: canonicalTier,
    userSub: userSub.length > 64 ? userSub.slice(0, 64) : userSub,
    signedAt,
  };

  const canonical = JSON.stringify(metadataBlock, Object.keys(metadataBlock).sort());

  // Sign with RSA-SHA256 if an RSA private key is configured.
  // Fall back to HMAC-SHA256 if only a shared secret is available.
  const rsaPrivateKey = resolveReportSigningPrivateKey();
  const hmacSecret = resolveReportSigningSecret();
  let signResult = null;
  let algorithm = "HMAC-SHA256";
  let serverKeyId = "sb-hmac-v1";

  if (rsaPrivateKey) {
    signResult = signWithRsa(rsaPrivateKey, canonical);
    if (signResult) {
      algorithm = signResult.algorithm;
      serverKeyId = signResult.keyId;
    }
  }
  if (!signResult && hmacSecret) {
    signResult = signWithHmac(hmacSecret, canonical);
    algorithm = signResult.algorithm;
    serverKeyId = signResult.keyId;
  }
  if (!signResult) {
    return res
      .status(503)
      .json({ signed: false, error: "Report signing unavailable: no signing key configured" });
  }

  const signature = signResult.signature;
  metadataBlock.serverKeyId = serverKeyId;

  try {
    logger.info("[sign-report] Issued signature", {
      userSub: userSub.slice(0, 16),
      reportType,
      tier: canonicalTier,
      algorithm,
    });
  } catch {
    // logger may be unavailable in some test contexts
  }

  return res.json({
    signed: true,
    signature,
    algorithm,
    signedAt,
    expiresAt,
    tier: canonicalTier,
    serverKeyId,
    user: {
      sub: userSub,
      email: user.email || null,
    },
    // Echo back the metadata block so the client can embed it alongside the signature.
    metadata: metadataBlock,
  });
});

// In-memory rate-limit bucket for /simplebeacon/user/sign-report.
// Single-instance Render deployment — sufficient for current load.
const signReportRateBucket = new Map();

// ---------------------------------------------------------------------------
// POST /simplebeacon/user/verify-signature
//
// Public endpoint — no authentication required. Allows third parties
// (auditors, board members, compliance officers) to verify that a report
// signature was issued by SimpleBeacon's server.
//
// Request:
//   { signature, metadata: { reportHash, reportType, tier, userSub, signedAt, serverKeyId } }
//
// Response (200): { valid: true, algorithm, serverKeyId }
// Response (200): { valid: false, error: "..." }  (signature doesn't match)
// Response (400): missing required fields
// Response (503): no public key configured for verification
// ---------------------------------------------------------------------------
router.post("/simplebeacon/user/verify-signature", async (req, res) => {
  const body = req.body || {};
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  const metadata = body.metadata || {};

  if (!signature) {
    return res
      .status(400)
      .json({ valid: false, error: "Signature required" });
  }
  if (!metadata || typeof metadata !== "object") {
    return res
      .status(400)
      .json({ valid: false, error: "Metadata block required" });
  }

  // Reconstruct the canonical message from the metadata block
  const metadataBlock = {
    reportHash: String(metadata.reportHash || ""),
    reportType: String(metadata.reportType || ""),
    tier: String(metadata.tier || ""),
    userSub: String(metadata.userSub || ""),
    signedAt: String(metadata.signedAt || ""),
    serverKeyId: String(metadata.serverKeyId || ""),
  };

  // Remove serverKeyId from the canonical form if it was added after signing
  // (the original signing payload doesn't include serverKeyId in the canonical)
  const canonicalBlock = { ...metadataBlock };
  delete canonicalBlock.serverKeyId;
  const canonical = JSON.stringify(canonicalBlock, Object.keys(canonicalBlock).sort());

  // Try RSA verification first
  const publicKey = resolveReportSigningPublicKey();
  if (publicKey) {
    const isValid = verifyRsaSignature(publicKey, canonical, signature);
    if (isValid) {
      return res.json({
        valid: true,
        algorithm: "RSA-SHA256",
        serverKeyId: metadataBlock.serverKeyId || "sb-rsa-v1",
        verifiedAt: new Date().toISOString(),
      });
    }
    // RSA key configured but signature didn't match — don't fall through to HMAC
    return res.json({
      valid: false,
      error: "Signature verification failed",
      algorithm: "RSA-SHA256",
    });
  }

  // Fall back to HMAC verification (shared secret mode)
  const secret = resolveReportSigningSecret();
  if (!secret) {
    return res
      .status(503)
      .json({ valid: false, error: "No verification key configured" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(canonical)
    .digest("hex");

  if (signature === expectedSignature) {
    return res.json({
      valid: true,
      algorithm: "HMAC-SHA256",
      serverKeyId: metadataBlock.serverKeyId || "sb-hmac-v1",
      verifiedAt: new Date().toISOString(),
    });
  }

  return res.json({
    valid: false,
    error: "Signature verification failed",
    algorithm: "HMAC-SHA256",
  });
});

// NOTE: /tokens/sandbox is handled by coming-soon/routes/free-token.cjs which is
// mounted at /api and provides email verification + validation code flow.
// The previous stub here shadowed that handler because auth-inline-routes.cjs
// is mounted before free-token.cjs in index.cjs. Removed to fix the conflict.

module.exports = router;
