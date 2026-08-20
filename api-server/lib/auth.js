/**
 * SimpleBeacon Enterprise Auth — Password hashing, JWT issuance/verification.
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.SIMPLEBEACON_JWT_SECRET ||
  process.env.SIMPLEBEACON_LICENSE_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "SIMPLEBEACON_JWT_SECRET (or SIMPLEBEACON_LICENSE_SECRET) must be set and >= 32 chars",
  );
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

/**
 * Hash a plaintext password with bcrypt (cost factor 12).
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Compare plaintext password against bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Issue a short-lived access JWT.
 * @param {{userId:string, email:string, role:string, workspaceId?:string}} payload
 * @returns {string}
 */
function issueAccessToken(payload) {
  return jwt.sign(
    {
      sub: payload.userId,
      email: payload.email,
      role: payload.role,
      workspace_id: payload.workspaceId || null,
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: "simplebeacon",
      audience: "simplebeacon-api",
    },
  );
}

/**
 * Issue a long-lived refresh JWT.
 * @param {{userId:string}} payload
 * @returns {string}
 */
function issueRefreshToken(payload) {
  return jwt.sign({ sub: payload.userId, type: "refresh" }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: "simplebeacon",
    audience: "simplebeacon-api",
  });
}

/**
 * Verify and decode a JWT (access or refresh).
 * @param {string} token
 * @returns {{sub:string, email?:string, role?:string, workspace_id?:string, type?:string}}
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: "simplebeacon",
    audience: "simplebeacon-api",
  });
}

/**
 * Express middleware: extract and verify Bearer token from Authorization header.
 * Attaches `req.auth = { userId, email, role, workspaceId }` on success.
 * Returns 401 on missing/invalid token.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }
  try {
    const decoded = verifyToken(match[1]);
    req.auth = {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      workspaceId: decoded.workspace_id,
    };
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Invalid or expired token", detail: err.message });
  }
}

/**
 * Optional auth middleware: same as requireAuth but continues without error if no token.
 * Attaches `req.auth` when present, leaves undefined otherwise.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next();
  try {
    const decoded = verifyToken(match[1]);
    req.auth = {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      workspaceId: decoded.workspace_id,
    };
  } catch (_) {
    // Invalid token on optional auth is silently ignored
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  issueAccessToken,
  issueRefreshToken,
  verifyToken,
  requireAuth,
  optionalAuth,
  JWT_SECRET,
};
