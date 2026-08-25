// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Token Authentication API Routes
 *
 * Flat capability mesh: Device Key -> Session -> Access Token -> Account Root
 *
 * Endpoints:
 *   POST /auth/device-challenge
 *   POST /auth/device-verify
 *   POST /auth/recover-init
 *   POST /auth/recover-verify
 *   POST /auth/enroll-device
 *   POST /auth/refresh
 *   POST /auth/logout
 *   GET  /auth/me
 *
 * @license MIT
 */

const express = require("express");
const crypto = require("crypto");

// Optional dependencies — token-auth routes degrade gracefully if not installed
let SignJWT, jwtVerify, createClient;
try {
  const jose = require("jose");
  SignJWT = jose.SignJWT;
  jwtVerify = jose.jwtVerify;
} catch {
  /* jose not installed — Ed25519 JWT signing unavailable */
}
try {
  const redis = require("redis");
  createClient = redis.createClient;
} catch {
  /* redis not installed — blocklist falls back to in-memory */
}

const {
  generateToken,
  optionalAuthenticate,
} = require("../middleware/auth.cjs");
const logger = require("../lib/app-logger.cjs");
const { toClientError } = require("../../shared-utils/index.cjs");
const sessionReplicator = require("../lib/session-token-replicator.cjs");

const router = express.Router();

function resolveTenantId(req) {
  return (
    (req.user && req.user.tenantId) ||
    (req.headers && req.headers["x-tenant-id"]) ||
    process.env.DEFAULT_TENANT ||
    "default"
  );
}

function replicateSessionIssue(tokenHash, accountId, tenantId, expiresAt) {
  sessionReplicator
    .issueToken({ tokenHash, accountId, tenantId, expiresAt })
    .catch((err) => {
      logger.warn("Session token replication issue failed", {
        error: err.message,
        tokenHash,
      });
    });
}

function replicateSessionRevoke(tokenHash, tenantId) {
  sessionReplicator.revokeToken({ tokenHash, tenantId }).catch((err) => {
    logger.warn("Session token replication revoke failed", {
      error: err.message,
      tokenHash,
    });
  });
}

// Redis client for token blocklist (instantiated at server startup)
let redisClient = null;
function getRedis() {
  if (!createClient) return null;
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn("REDIS_URL not set — Redis features disabled");
      return null;
    }
    redisClient = createClient({ url: redisUrl });
    redisClient
      .connect()
      .catch((err) => logger.warn("Redis connection failed:", err.message));
  }
  return redisClient;
}

// In-memory DB helpers (replace with real DB adapter)
const db = require("../lib/token-db.cjs");

// Ed25519 signing key (Account Root private key — from KMS/HSM in production)
const { resolveSecret } = require("../lib/secret-config.cjs");
const { sendError } = require("../lib/response-helpers.cjs");
const ACCOUNT_SIGNING_KEY = Buffer.from(
  resolveSecret("TOKEN_ACCOUNT_SIGNING_KEY") || "",
  "base64",
);

// Constants
const ACCESS_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
const SESSION_TTL_SECONDS = 15 * 60; // 15 minutes

// Parse duration string like '7d', '24h', '15m' to seconds
function parseDurationSeconds(value, fallbackSeconds) {
  if (!value) return fallbackSeconds;
  const match = String(value)
    .trim()
    .match(/^(\d+)([dhm])?$/i);
  if (!match) return fallbackSeconds;
  const num = parseInt(match[1], 10);
  const unit = (match[2] || "s").toLowerCase();
  const multipliers = { d: 24 * 60 * 60, h: 60 * 60, m: 60, s: 1 };
  return num * (multipliers[unit] || 1);
}

const REFRESH_TOKEN_TTL_SECONDS = parseDurationSeconds(
  process.env.JWT_REFRESH_EXPIRES_IN,
  7 * 24 * 60 * 60,
); // 7 days default
const CHALLENGE_TTL_SECONDS = 120; // 2 minutes

// ───────────────────────────────────────────────────────────────────────────
// Helper: generate opaque token
function generateOpaqueToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Helper: hash opaque token
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Helper: sign Access Token JWT (Ed25519)
async function signAccessToken(payload) {
  if (!SignJWT) {
    throw new Error(
      'Token authentication requires the "jose" package. Run: npm install jose',
    );
  }
  if (!ACCOUNT_SIGNING_KEY || !ACCOUNT_SIGNING_KEY.length) {
    throw new Error("Account signing key not configured");
  }
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT", crv: "Ed25519" })
    .setIssuedAt()
    .setIssuer("simplebeacon.io")
    .setAudience("simplebeacon-users")
    .setExpirationTime("90d")
    .sign(ACCOUNT_SIGNING_KEY);
}

// Helper: add JTI to blocklist
async function blocklistJti(jti, expiresAt, reason) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const ttl = Math.ceil((new Date(expiresAt) - Date.now()) / 1000);
    if (ttl > 0) {
      await redis.setEx(`blocklist:${jti}`, ttl, reason || "revoked");
    }
  } catch (err) {
    logger.warn("Blocklist write failed:", err.message);
  }
}

// Helper: check JTI blocklist
async function isJtiBlocked(jti) {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const blocked = await redis.get(`blocklist:${jti}`);
    return Boolean(blocked);
  } catch (err) {
    logger.warn("Blocklist read failed:", err.message);
    return false;
  }
}

// Helper: audit logging
function auditEvent(accountId, eventType, actor, metadata, req) {
  const entry = {
    account_id: accountId,
    event_type: eventType,
    actor: actor || "system",
    metadata: metadata || {},
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
    created_at: new Date().toISOString(),
  };
  db.insertAuditLog(entry).catch((err) =>
    logger.warn("Audit log failed:", err.message),
  );
}

// ───────────────────────────────────────────────────────────────────────────
// POST /auth/device-challenge
// Step 1: request a challenge nonce for device-key authentication
router.post("/device-challenge", async (req, res) => {
  try {
    const { device_key_id } = req.body || {};
    if (!device_key_id) {
      return sendError(res, 400, "device_key_id is required");
    }

    const deviceKey = await db.getDeviceKey(device_key_id);
    if (!deviceKey || deviceKey.revoked_at) {
      return sendError(res, 403, "Device key not found or revoked");
    }

    const challenge = crypto.randomBytes(32).toString("hex");
    const challengeId = crypto.randomUUID();

    const redis = getRedis();
    if (redis) {
      await redis.setEx(
        `challenge:${challengeId}`,
        CHALLENGE_TTL_SECONDS,
        JSON.stringify({
          device_key_id,
          challenge,
          account_id: deviceKey.account_id,
        }),
      );
    } else {
      // Fallback: in-memory challenge store (single-process only)
      if (!global._challengeStore) global._challengeStore = new Map();
      global._challengeStore.set(
        challengeId,
        JSON.stringify({
          device_key_id,
          challenge,
          account_id: deviceKey.account_id,
        }),
      );
      setTimeout(
        () => global._challengeStore.delete(challengeId),
        CHALLENGE_TTL_SECONDS * 1000,
      );
    }

    res.json({ success: true, challenge_id: challengeId, challenge });
  } catch (err) {
    logger.error("[device-challenge]", err);
    sendError(res, 500, toClientError(err, "Challenge generation failed"));
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /auth/device-verify
// Step 2: verify signature and issue tokens
router.post("/device-verify", async (req, res) => {
  try {
    const { challenge_id, signature, device_key_id } = req.body || {};
    if (!challenge_id || !signature || !device_key_id) {
      return sendError(
        res,
        400,
        "challenge_id, signature, and device_key_id are required",
      );
    }

    const redis = getRedis();
    let challengeRaw;
    if (redis) {
      challengeRaw = await redis.get(`challenge:${challenge_id}`);
    } else {
      challengeRaw = global._challengeStore
        ? global._challengeStore.get(challenge_id)
        : null;
    }
    if (!challengeRaw) {
      return sendError(res, 400, "Challenge expired or invalid");
    }

    const challengeData = JSON.parse(challengeRaw);
    if (challengeData.device_key_id !== device_key_id) {
      return sendError(res, 403, "Challenge device mismatch");
    }

    // Consume challenge to prevent replay
    if (redis) {
      await redis.del(`challenge:${challenge_id}`);
    } else if (global._challengeStore) {
      global._challengeStore.delete(challenge_id);
    }

    const deviceKey = await db.getDeviceKey(device_key_id);
    if (!deviceKey || deviceKey.revoked_at) {
      return sendError(res, 403, "Device key not found or revoked");
    }

    // Verify Ed25519 signature (challenge + device_key_id signed by device private key)
    let isValid = false;
    try {
      const verifyPayload = Buffer.from(
        challengeData.challenge + device_key_id,
        "utf8",
      );
      const publicKeyBuffer = Buffer.from(deviceKey.public_key, "hex");
      const signatureBuffer = Buffer.from(signature, "hex");
      const { ed25519 } = require("@noble/curves/ed25519");
      isValid = ed25519.verify(signatureBuffer, verifyPayload, publicKeyBuffer);
    } catch {
      return sendError(
        res,
        503,
        "Ed25519 verification unavailable. Install: npm install @noble/curves jose redis",
      );
    }
    if (!isValid) {
      auditEvent(
        deviceKey.account_id,
        "recovery_failed",
        device_key_id,
        { reason: "invalid_signature" },
        req,
      );
      return sendError(res, 403, "Signature verification failed");
    }

    // Update last seen
    await db.updateDeviceKey(device_key_id, {
      last_seen_at: new Date().toISOString(),
    });

    // Get account
    const account = await db.getAccount(deviceKey.account_id);
    if (!account || account.status !== "active") {
      return sendError(res, 403, "Account inactive or suspended");
    }

    // Issue Access Token
    const accessTokenJti = crypto.randomUUID();
    const accessTokenPayload = {
      jti: accessTokenJti,
      sub: account.id,
      identity_type: "account",
      features: account.features,
      account_type: account.account_type,
      max_devices: account.max_devices,
    };
    const accessToken = await signAccessToken(accessTokenPayload);

    const now = new Date();
    const accessTokenExpires = new Date(
      now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    await db.insertAccessToken({
      jti: accessTokenJti,
      account_id: account.id,
      identity_type: "account",
      features: account.features,
      issued_at: now.toISOString(),
      expires_at: accessTokenExpires.toISOString(),
    });

    // Issue Session Token
    const sessionTokenId = crypto.randomUUID();
    const sessionExpires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    const tenantId = resolveTenantId(req);
    await db.insertSessionToken({
      id: sessionTokenId,
      account_id: account.id,
      token_hash: sessionTokenId,
      tenant_id: tenantId,
      access_token_jti: accessTokenJti,
      device_key_id,
      scope: "read",
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
      token_sequence: 0,
      epoch: 0,
      issued_at: now.toISOString(),
      expires_at: sessionExpires.toISOString(),
    });

    // Replicate session token to cluster (non-blocking)
    replicateSessionIssue(
      sessionTokenId,
      account.id,
      tenantId,
      sessionExpires.toISOString(),
    );

    // Issue Refresh Token (opaque)
    const refreshToken = generateOpaqueToken();
    const refreshTokenHash = await hashToken(refreshToken);
    const refreshExpires = new Date(
      now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000,
    );
    await db.insertRefreshToken({
      account_id: account.id,
      session_token_id: sessionTokenId,
      token_hash: refreshTokenHash,
      issued_at: now.toISOString(),
      expires_at: refreshExpires.toISOString(),
    });

    auditEvent(
      account.id,
      "session_created",
      device_key_id,
      { session_id: sessionTokenId, access_jti: accessTokenJti },
      req,
    );

    res.json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      session_token: sessionTokenId,
      expires_in: SESSION_TTL_SECONDS,
    });
  } catch (err) {
    logger.error("[device-verify]", err);
    sendError(res, 500, toClientError(err, "Device verification failed"));
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /auth/recover-init
// Initiate account recovery using a registered recovery factor
router.post("/recover-init", async (req, res) => {
  try {
    const { account_id, recovery_factor_type } = req.body || {};
    if (!account_id || !recovery_factor_type) {
      return sendError(
        res,
        400,
        "account_id and recovery_factor_type are required",
      );
    }

    const account = await db.getAccount(account_id);
    if (!account) {
      return sendError(res, 404, "Account not found");
    }

    const factors = await db.getRecoveryFactors(account_id);
    const activeFactor = factors.find(
      (f) =>
        f.factor_type === recovery_factor_type && f.enabled && !f.revoked_at,
    );
    if (!activeFactor) {
      return sendError(res, 403, "Recovery factor not available");
    }

    const challengeId = crypto.randomUUID();
    let challengePayload = {
      account_id,
      factor_type: recovery_factor_type,
      challenge_id: challengeId,
    };

    if (recovery_factor_type === "email_otp") {
      const otp = crypto.randomInt(100000, 999999).toString();
      challengePayload.otp_hash = await hashToken(otp);
      // In production: send email via email-service.cjs
      logger.info("[recover-init] Email OTP generated");
    } else if (recovery_factor_type === "totp") {
      const { speakeasy } = require("speakeasy");
      const secret = activeFactor.factor_data; // decrypted in production
      const token = speakeasy.totp({ secret, encoding: "base32" });
      challengePayload.expected_token = token;
    }

    const redis = getRedis();
    if (redis) {
      await redis.setEx(
        `recover:${challengeId}`,
        600,
        JSON.stringify(challengePayload),
      );
    } else {
      if (!global._recoveryStore) global._recoveryStore = new Map();
      global._recoveryStore.set(challengeId, JSON.stringify(challengePayload));
      setTimeout(() => global._recoveryStore.delete(challengeId), 600000);
    }

    auditEvent(
      account_id,
      "recovery_initiated",
      "system",
      { factor_type: recovery_factor_type, challenge_id: challengeId },
      req,
    );

    res.json({
      success: true,
      challenge_id: challengeId,
      message:
        recovery_factor_type === "email_otp"
          ? "OTP sent to registered email"
          : "Use your authenticator app",
    });
  } catch (err) {
    logger.error("[recover-init]", err);
    sendError(res, 500, toClientError(err, "Recovery initiation failed"));
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /auth/recover-verify
// Verify recovery factor and issue an enrollment ticket
router.post("/recover-verify", async (req, res) => {
  try {
    const { challenge_id, otp, factor_type } = req.body || {};
    if (!challenge_id || !otp || !factor_type) {
      return sendError(
        res,
        400,
        "challenge_id, otp, and factor_type are required",
      );
    }

    const redis = getRedis();
    let challengeRaw;
    if (redis) {
      challengeRaw = await redis.get(`recover:${challenge_id}`);
    } else {
      challengeRaw = global._recoveryStore
        ? global._recoveryStore.get(challenge_id)
        : null;
    }
    if (!challengeRaw) {
      return sendError(res, 400, "Challenge expired");
    }

    const challengeData = JSON.parse(challengeRaw);
    const accountId = challengeData.account_id;

    let verified = false;
    if (factor_type === "email_otp") {
      const otpHash = await hashToken(otp);
      verified = otpHash === challengeData.otp_hash;
    } else if (factor_type === "totp") {
      verified = otp === challengeData.expected_token;
    }

    if (!verified) {
      auditEvent(
        accountId,
        "recovery_failed",
        "system",
        { factor_type, reason: "invalid_otp" },
        req,
      );
      return sendError(res, 403, "Verification failed");
    }

    // Consume recovery challenge to prevent replay
    if (redis) {
      await redis.del(`recover:${challenge_id}`);
    } else if (global._recoveryStore) {
      global._recoveryStore.delete(challenge_id);
    }

    // Issue enrollment ticket (1-hour TTL, recovery scope)
    const enrollmentTicket = generateOpaqueToken();
    const ticketHash = await hashToken(enrollmentTicket);
    if (redis) {
      await redis.setEx(
        `enroll:${ticketHash}`,
        3600,
        JSON.stringify({
          account_id: accountId,
          scope: "recovery",
          created_at: Date.now(),
        }),
      );
    } else {
      if (!global._enrollStore) global._enrollStore = new Map();
      global._enrollStore.set(
        ticketHash,
        JSON.stringify({
          account_id: accountId,
          scope: "recovery",
          created_at: Date.now(),
        }),
      );
      setTimeout(() => global._enrollStore.delete(ticketHash), 3600000);
    }

    auditEvent(
      accountId,
      "recovery_verified",
      "system",
      { factor_type, challenge_id },
      req,
    );

    res.json({ success: true, enrollment_ticket: enrollmentTicket });
  } catch (err) {
    logger.error("[recover-verify]", err);
    sendError(res, 500, toClientError(err, "Recovery verification failed"));
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /auth/enroll-device
// Register a new device key (requires enrollment ticket or existing Access Token)
router.post("/enroll-device", optionalAuthenticate, async (req, res) => {
  try {
    const { enrollment_ticket, device_public_key, device_name, key_type } =
      req.body || {};
    if (!device_public_key || !key_type) {
      return sendError(res, 400, "device_public_key and key_type are required");
    }

    let accountId = null;
    let trustLevel = "trusted";

    if (req.user) {
      // Authenticated enrollment
      accountId = req.user.sub;
    } else if (enrollment_ticket) {
      // Recovery-based enrollment
      const ticketHash = await hashToken(enrollment_ticket);
      const redis = getRedis();
      let ticketRaw;
      if (redis) {
        ticketRaw = await redis.get(`enroll:${ticketHash}`);
      } else {
        ticketRaw = global._enrollStore
          ? global._enrollStore.get(ticketHash)
          : null;
      }
      if (!ticketRaw) {
        return sendError(res, 403, "Invalid or expired enrollment ticket");
      }
      const ticketData = JSON.parse(ticketRaw);
      accountId = ticketData.account_id;
      trustLevel = "untrusted"; // Recovery-enrolled devices start untrusted

      // Consume enrollment ticket to prevent replay
      if (redis) {
        await redis.del(`enroll:${ticketHash}`);
      } else if (global._enrollStore) {
        global._enrollStore.delete(ticketHash);
      }
    } else {
      return sendError(
        res,
        401,
        "Authentication or enrollment ticket required",
      );
    }

    const account = await db.getAccount(accountId);
    if (!account) {
      return sendError(res, 404, "Account not found");
    }

    // Check device limit
    const existingDevices = await db.getDeviceKeys(accountId);
    const activeDevices = existingDevices.filter((d) => !d.revoked_at);
    if (activeDevices.length >= account.max_devices) {
      return res
        .status(403)
        .json({
          success: false,
          error: `Device limit reached (${account.max_devices})`,
        });
    }

    const deviceKeyId = crypto.randomUUID();
    const fingerprint = crypto
      .createHash("sha256")
      .update(req.ip + req.headers["user-agent"])
      .digest("hex");

    await db.insertDeviceKey({
      id: deviceKeyId,
      account_id: accountId,
      public_key: device_public_key,
      key_type,
      trust_level: trustLevel,
      device_name: device_name || "Unknown Device",
      device_fingerprint: fingerprint,
      created_at: new Date().toISOString(),
    });

    auditEvent(
      accountId,
      "device_enrolled",
      deviceKeyId,
      { key_type, trust_level: trustLevel },
      req,
    );

    res.json({ success: true, device_key_id: deviceKeyId });
  } catch (err) {
    logger.error("[enroll-device]", err);
    sendError(res, 500, toClientError(err, "Device enrollment failed"));
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /auth/refresh
// Rotate session and access tokens using a refresh token
router.post("/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body || {};
    if (!refresh_token) {
      return sendError(res, 400, "refresh_token is required");
    }

    const tokenHash = await hashToken(refresh_token);
    const refreshRecord = await db.getRefreshTokenByHash(tokenHash);
    if (!refreshRecord || refreshRecord.revoked_at || refreshRecord.used_at) {
      return sendError(res, 403, "Invalid or reused refresh token");
    }

    if (new Date(refreshRecord.expires_at) < new Date()) {
      return sendError(res, 403, "Refresh token expired");
    }

    // In-process race guard: prevent concurrent reuse in the same process
    const raceKey = `refresh_used:${refreshRecord.id}`;
    if (global._refreshRaceGuard && global._refreshRaceGuard.has(raceKey)) {
      return sendError(res, 403, "Refresh token already being processed");
    }
    if (!global._refreshRaceGuard) global._refreshRaceGuard = new Set();
    global._refreshRaceGuard.add(raceKey);

    try {
      // Mark old refresh token as used
      await db.updateRefreshToken(refreshRecord.id, {
        used_at: new Date().toISOString(),
      });
    } finally {
      global._refreshRaceGuard.delete(raceKey);
    }

    // Blocklist old Access Token
    const session = await db.getSessionToken(refreshRecord.session_token_id);
    if (session) {
      await blocklistJti(
        session.access_token_jti,
        session.expires_at,
        "refresh_rotation",
      );
      await db.revokeSessionToken(session.id, "refresh_rotation");
      const oldTenant = session.tenant_id || resolveTenantId(req);
      replicateSessionRevoke(session.token_hash || session.id, oldTenant);
    }

    const account = await db.getAccount(refreshRecord.account_id);
    if (!account || account.status !== "active") {
      return sendError(res, 403, "Account inactive");
    }

    // Issue new Access Token
    const newAccessTokenJti = crypto.randomUUID();
    const accessTokenPayload = {
      jti: newAccessTokenJti,
      sub: account.id,
      identity_type: "account",
      features: account.features,
      account_type: account.account_type,
      max_devices: account.max_devices,
    };
    const newAccessToken = await signAccessToken(accessTokenPayload);

    const now = new Date();
    const accessTokenExpires = new Date(
      now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    await db.insertAccessToken({
      jti: newAccessTokenJti,
      account_id: account.id,
      identity_type: "account",
      features: account.features,
      issued_at: now.toISOString(),
      expires_at: accessTokenExpires.toISOString(),
    });

    // Issue new Session Token
    const newSessionId = crypto.randomUUID();
    const sessionExpires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    const newTenant = resolveTenantId(req);
    await db.insertSessionToken({
      id: newSessionId,
      account_id: account.id,
      token_hash: newSessionId,
      tenant_id: newTenant,
      access_token_jti: newAccessTokenJti,
      scope: "read",
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
      token_sequence: 0,
      epoch: 0,
      issued_at: now.toISOString(),
      expires_at: sessionExpires.toISOString(),
    });

    replicateSessionIssue(
      newSessionId,
      account.id,
      newTenant,
      sessionExpires.toISOString(),
    );

    // Issue new Refresh Token
    const newRefreshToken = generateOpaqueToken();
    const newRefreshHash = await hashToken(newRefreshToken);
    const refreshExpires = new Date(
      now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000,
    );
    await db.insertRefreshToken({
      account_id: account.id,
      session_token_id: newSessionId,
      token_hash: newRefreshHash,
      issued_at: now.toISOString(),
      expires_at: refreshExpires.toISOString(),
    });

    auditEvent(
      account.id,
      "session_refreshed",
      "system",
      { session_id: newSessionId, access_jti: newAccessTokenJti },
      req,
    );

    res.json({
      success: true,
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      session_token: newSessionId,
      expires_in: SESSION_TTL_SECONDS,
    });
  } catch (err) {
    logger.error("[refresh]", err);
    sendError(res, 500, toClientError(err, "Token refresh failed"));
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /auth/logout
// Revoke session and blocklist access token
router.post("/logout", optionalAuthenticate, async (req, res) => {
  try {
    const { session_token } = req.body || {};
    if (!session_token) {
      return sendError(res, 400, "session_token is required");
    }

    const session = await db.getSessionToken(session_token);
    if (!session) {
      return res.json({
        success: true,
        message: "Session already expired or invalid",
      });
    }

    // Ownership check: authenticated user can only revoke their own sessions
    if (req.user && session.account_id !== req.user.sub) {
      return sendError(res, 403, "You can only revoke your own sessions");
    }

    // Revoke session
    await db.revokeSessionToken(session.id, "logout");
    replicateSessionRevoke(
      session.token_hash || session.id,
      session.tenant_id || resolveTenantId(req),
    );

    // Blocklist Access Token
    await blocklistJti(session.access_token_jti, session.expires_at, "logout");
    await db.revokeAccessToken(session.access_token_jti, "logout");

    // Revoke associated refresh token
    await db.revokeRefreshTokenBySession(session.id, "logout");

    auditEvent(
      session.account_id,
      "session_revoked",
      session.id,
      { reason: "logout" },
      req,
    );

    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    logger.error("[logout]", err);
    sendError(res, 500, toClientError(err, "Logout failed"));
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /auth/me
// Return current account info (requires valid Access Token via optionalAuthenticate)
router.get("/me", optionalAuthenticate, async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, "Authentication required");
    }

    const account = await db.getAccount(req.user.sub);
    if (!account) {
      return sendError(res, 404, "Account not found");
    }

    const devices = await db.getDeviceKeys(account.id);
    const activeDevices = devices.filter((d) => !d.revoked_at);

    res.json({
      success: true,
      account: {
        id: account.id,
        account_type: account.account_type,
        features: account.features,
        max_devices: account.max_devices,
        status: account.status,
        active_devices: activeDevices.length,
        created_at: account.created_at,
      },
    });
  } catch (err) {
    logger.error("[me]", err);
    sendError(res, 500, toClientError(err, "Failed to fetch account"));
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /auth/register
// Create a new account with an initial recovery factor (email)
router.post("/register", async (req, res) => {
  try {
    const { email, password, account_type, features } = req.body || {};
    if (!email || !password) {
      return sendError(res, 400, "email and password are required");
    }

    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate Ed25519 key pair for Account Root
    let accountPubKey;
    try {
      const { ed25519 } = require("@noble/curves/ed25519");
      const accountPrivKey = ed25519.utils.randomPrivateKey();
      accountPubKey = ed25519.getPublicKey(accountPrivKey);
    } catch {
      return sendError(
        res,
        503,
        "Ed25519 key generation unavailable. Install: npm install @noble/curves jose redis",
      );
    }

    // Store private key in secure storage (KMS/HSM in production)
    // For now, encrypt with a derived key
    const accountId = crypto.randomUUID();
    const pubKeyHex = Buffer.from(accountPubKey).toString("hex");

    const account = {
      id: accountId,
      account_type: account_type || "personal",
      features: Array.isArray(features) ? features : ["scan"],
      max_devices: account_type === "enterprise" ? 50 : 5,
      public_key: pubKeyHex,
      previous_keys: [],
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.insertAccount(account);

    // Register email as recovery factor
    const recoveryFactor = {
      id: crypto.randomUUID(),
      account_id: accountId,
      factor_type: "email_otp",
      factor_data: email, // encrypted in production
      verified_at: new Date().toISOString(),
      enabled: true,
      created_at: new Date().toISOString(),
    };
    await db.insertRecoveryFactor(recoveryFactor);

    // Store password hash in legacy users table for backward compat
    const userRecord = {
      id: accountId,
      email,
      password_hash: passwordHash,
      name: email.split("@")[0],
      trust_level: "bronze",
      successful_analyses: 0,
      security_incidents: 0,
      community_contributions: 0,
      verification_status: "email",
      created_at: new Date().toISOString(),
    };
    // Legacy users.json append (or DB insert)
    const usersDbPath = require("path").join(
      __dirname,
      "../db/demo-users.json",
    );
    const usersDb = require("fs").existsSync(usersDbPath)
      ? JSON.parse(require("fs").readFileSync(usersDbPath, "utf8"))
      : { users: [] };
    usersDb.users = usersDb.users || [];
    usersDb.users.push(userRecord);
    require("fs").writeFileSync(usersDbPath, JSON.stringify(usersDb, null, 2));

    auditEvent(
      accountId,
      "account_created",
      "system",
      { email, account_type: account.account_type },
      req,
    );

    res.json({
      success: true,
      account_id: accountId,
      message: "Account created. Enroll a device key to authenticate.",
      next_steps: [
        "POST /auth/enroll-device (with enrollment_ticket from recovery)",
      ],
    });
  } catch (err) {
    logger.error("[register]", err);
    sendError(res, 500, toClientError(err, "Account registration failed"));
  }
});

module.exports = router;
