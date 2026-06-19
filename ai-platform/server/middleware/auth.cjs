/**
 * Authentication and Authorization Middleware
 *
 * Role: Express middleware — JWT verification, role checks, trust levels.
 * Distinct from routes/auth.cjs (login/logout/refresh route handlers).
 * Both named auth.cjs by architectural convention (middleware vs routes layer).
 *
 * Provides JWT-based authentication and role-based authorization
 * with progressive trust levels and audit logging
 */

const logger = require('../lib/app-logger.cjs');

const fs = require('fs');
const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const bcrypt = require('bcryptjs');
const { resolveSecret } = require('../lib/secret-config.cjs');
const { toClientError } = require('../lib/client-error.cjs');
const { isVaultAuthenticated } = require('../lib/dashboard-vault-auth.cjs');

const constants = require('../config/constants.cjs');
// JWT Configuration
const jwtConfig = {
  secret: resolveSecret('JWT_SECRET'),
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  algorithm: 'HS256',
  issuer: 'cascade-ai-platform',
  audience: 'cascade-ai-users'
};

// Trust levels and their permissions
const trustLevels = {
  bronze: {
    level: 1,
    permissions: ['read:own', 'write:own', 'analyze:public'],
    rateLimitMultiplier: 1,
    features: ['basic_analysis', 'sample_data_basic'],
    mfaRequired: false
  },
  silver: {
    level: 2,
    permissions: ['read:own', 'write:own', 'read:shared', 'analyze:public', 'analyze:private'],
    rateLimitMultiplier: 2,
    features: ['advanced_analysis', 'sample_data_advanced', 'collaboration'],
    mfaRequired: false
  },
  gold: {
    level: 3,
    permissions: ['read:own', 'write:own', 'read:shared', 'write:shared', 'analyze:public', 'analyze:private', 'admin:basic'],
    rateLimitMultiplier: 5,
    features: ['enterprise_features', 'api_access', 'advanced_security'],
    mfaRequired: true
  }
};

/**
 * Apply vault operator user.
 * @param {any} req
 * @returns {any}
 */
function applyVaultOperatorUser(req) {
  const email = process.env.SIMPLEBEACON_BYPASS_EMAIL;
  if (!email) {
    logger.warn('[auth] SIMPLEBEACON_BYPASS_EMAIL not set — vault operator user will use anonymous identity');
  }
  req.user = {
    id: 'vault-operator',
    email: email || 'anonymous@localhost',
    name: 'Vault Operator',
    trustLevel: 'gold',
    permissions: trustLevels.gold.permissions,
    vaultSession: true
  };
}

/**
 * Vault operator session active.
 * @param {any} req
 * @returns {any}
 */
function vaultOperatorSessionActive(req) {
  // Development convenience: only auto-bypass when explicitly opted-in.
  // Prevents accidental unconditional auth bypass in local dev.
  const devBypass = process.env.SIMPLEBEACON_DEV_BYPASS_AUTH === 'true';
  if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined) && devBypass) {
    return true;
  }
  const vaultPassword = process.env.DASHBOARD_VAULT_PASSWORD;
  if (!vaultPassword) return false;
  return isVaultAuthenticated(req, {
    internalDashboard: true,
    vaultPassword
  });
}

// Device tracking
const deviceTrust = new Map();
const _mfaSessions = new Map();

// Token first-use tracking — expiry counts from first validation, not creation
const tokenFirstUse = new Map();
const TOKEN_LIFETIME_MS = 24 * 60 * constants.ONE_MINUTE_MS; // 24 hours from first use

// Sandbox token request tracking — enforce daily limits
const sandboxTokenUsage = new Map(); // jti -> { count, windowStart }
const SANDBOX_DAILY_LIMIT = 100;
const SANDBOX_WINDOW_MS = 24 * 60 * constants.ONE_MINUTE_MS;

/**
 * Is sandbox token.
 * @param {any} decoded
 * @returns {any}
 */
function isSandboxToken(decoded) {
    const tier = decoded.tier || decoded.plan || '';
    return tier === 'sandbox' || tier === 'community' || tier === 'free' || tier === 'developer';
}

/**
 * Record sandbox request.
 * @param {any} jti
 * @returns {any}
 */
function recordSandboxRequest(jti) {
    const now = Date.now();
    const entry = sandboxTokenUsage.get(jti);
    if (!entry || (now - entry.windowStart) > SANDBOX_WINDOW_MS) {
        sandboxTokenUsage.set(jti, { count: 1, windowStart: now });
        return { allowed: true, remaining: SANDBOX_DAILY_LIMIT - 1 };
    }
    entry.count += 1;
    const remaining = Math.max(0, SANDBOX_DAILY_LIMIT - entry.count);
    return { allowed: entry.count <= SANDBOX_DAILY_LIMIT, remaining };
}

/**
 * Get sandbox limit headers.
 * @param {any} jti
 * @returns {any}
 */
function getSandboxLimitHeaders(jti) {
    const entry = sandboxTokenUsage.get(jti);
    if (!entry) return { 'X-Sandbox-Limit': String(SANDBOX_DAILY_LIMIT), 'X-Sandbox-Remaining': String(SANDBOX_DAILY_LIMIT) };
    const remaining = Math.max(0, SANDBOX_DAILY_LIMIT - entry.count);
    return { 'X-Sandbox-Limit': String(SANDBOX_DAILY_LIMIT), 'X-Sandbox-Remaining': String(remaining) };
}

// Periodic cleanup of stale sandbox usage records
setInterval(() => {
    const cutoff = Date.now() - SANDBOX_WINDOW_MS;
    for (const [jti, entry] of sandboxTokenUsage) {
        if (entry.windowStart < cutoff) {
            sandboxTokenUsage.delete(jti);
        }
    }
}, 60 * constants.ONE_MINUTE_MS);

/**
 * Record token first use.
 * @param {any} jti
 * @returns {any}
 */
function recordTokenFirstUse(jti) {
    if (!tokenFirstUse.has(jti)) {
        tokenFirstUse.set(jti, Date.now());
    }
    return tokenFirstUse.get(jti);
}

/**
 * Is token expired by first use.
 * @param {any} jti
 * @returns {any}
 */
function isTokenExpiredByFirstUse(jti) {
    const firstUsed = tokenFirstUse.get(jti);
    if (!firstUsed) return false; // Not used yet — not expired
    return Date.now() - firstUsed > TOKEN_LIFETIME_MS;
}

/**
 * Invalidate token.
 * @param {any} jti
 * @returns {any}
 */
function invalidateToken(jti) {
    tokenFirstUse.delete(jti);
}

// Periodic cleanup of stale first-use records (every hour)
setInterval(() => {
    const cutoff = Date.now() - TOKEN_LIFETIME_MS;
    for (const [jti, firstUsed] of tokenFirstUse) {
        if (firstUsed < cutoff) {
            tokenFirstUse.delete(jti);
        }
    }
}, 60 * constants.ONE_MINUTE_MS);

/**
 * Is auth debug enabled.
 * @returns {any}
 */
function isAuthDebugEnabled() {
  return process.env.LOG_AUTH === 'true' || process.env.AUTH_DEBUG === 'true';
}

/**
 * Auth log.
 * @param {string} message
 * @returns {any}
 */
function authLog(message) {
  if (isAuthDebugEnabled()) {
    logger.info(message);
  }
}

/**
 * Auth warn.
 * @param {string} message
 * @returns {any}
 */
function authWarn(message) {
  if (isAuthDebugEnabled()) {
    logger.warn(message);
  }
}

/**
 * Should write audit events.
 * @returns {any}
 */
function shouldWriteAuditEvents() {
  return process.env.AUDIT_AUTH_LOGS !== 'false';
}

// Generate JWT token (no built-in expiry — expiry is first-use-based)
/**
 * Generate token.
 * @param {any} user
 * @returns {any}
 */
const generateToken = (user) => {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    trustLevel: user.trustLevel || 'bronze',
    permissions: trustLevels[user.trustLevel || 'bronze'].permissions,
    iat: Math.floor(Math.floor(Date.now() / constants.MS_PER_SECOND)),
    jti: crypto.randomUUID()
  };

  return jwt.sign(payload, jwtConfig.secret, {
    algorithm: jwtConfig.algorithm,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience
  });
};

// Verify JWT token
/**
 * Verify token.
 * @param {string} token
 * @returns {any}
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, jwtConfig.secret, {
      algorithms: [jwtConfig.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    });
  } catch {
    throw createError(401, 'Invalid or expired token');
  }
};

// Enhanced authentication middleware with MFA and device trust
/**
 * Authenticate.
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
const authenticate = async (req, res, next) => {
  try {
    if (vaultOperatorSessionActive(req)) {
      applyVaultOperatorUser(req);
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw createError(401, 'Authorization header required');
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      throw createError(401, 'Token required');
    }

    const decoded = verifyToken(token);

    // First-use-based expiry: record first validation time, then enforce lifetime
    recordTokenFirstUse(decoded.jti);
    if (isTokenExpiredByFirstUse(decoded.jti)) {
        invalidateToken(decoded.jti);
        throw createError(401, 'Token expired');
    }

    // Sandbox enforcement
    const sandbox = isSandboxToken(decoded);
    if (sandbox) {
        const { allowed, remaining } = recordSandboxRequest(decoded.jti);
        if (!allowed) {
            const headers = getSandboxLimitHeaders(decoded.jti);
            Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
            throw createError(429, `Sandbox daily limit reached (${SANDBOX_DAILY_LIMIT} requests). Upgrade to a paid license for unlimited access.`);
        }
        const headers = getSandboxLimitHeaders(decoded.jti);
        Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    }

    // Attach user info to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      trustLevel: decoded.trustLevel,
      permissions: decoded.permissions,
      tokenId: decoded.jti,
      sessionId: decoded.sessionId,
      isSandbox: sandbox,
      tier: decoded.tier || decoded.plan || ''
    };

    // Log only when LOG_AUTH=true — per-request success logs flood the console during SPA loads
    authLog(`[AUTH] User authenticated - ID: ${decoded.sub} - Email: ${decoded.email} - Trust: ${decoded.trustLevel}`);

    next();
  } catch (error) {
    authWarn(`[AUTH] Authentication failed - ${req.method} ${req.originalUrl} - IP: ${req.ip} - Error: ${error.message}`);
    return res.status(401).json({
      error: 'Authentication failed',
      message: toClientError(error, 'Invalid or expired token'),
      requestId: req.requestId
    });
  }
};

/** Populate req.user when a valid Bearer token is present; never reject. */
const optionalAuthenticate = async (req, res, next) => {
  try {
    if (vaultOperatorSessionActive(req)) {
      applyVaultOperatorUser(req);
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) return next();

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;
    if (!token) return next();

    const decoded = verifyToken(token);

    // First-use-based expiry for optional auth too
    recordTokenFirstUse(decoded.jti);
    if (isTokenExpiredByFirstUse(decoded.jti)) {
        invalidateToken(decoded.jti);
        throw new Error('Token expired');
    }

    const sandbox = isSandboxToken(decoded);
    if (sandbox) {
        recordSandboxRequest(decoded.jti);
        const headers = getSandboxLimitHeaders(decoded.jti);
        Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      trustLevel: decoded.trustLevel,
      permissions: decoded.permissions,
      tokenId: decoded.jti,
      sessionId: decoded.sessionId,
      isSandbox: sandbox,
      tier: decoded.tier || decoded.plan || ''
    };
  } catch {
    /* public route — ignore invalid or expired tokens */
  }
  return next();
};

// Authorization middleware factory
/**
 * Authorize.
 * @param {Array} requiredPermissions
 * @returns {any}
 */
const authorize = (requiredPermissions = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      authWarn(`[AUTHZ] Authorization failed - User: ${req.user.id} - Required: ${requiredPermissions.join(', ')} - Has: ${userPermissions.join(', ')}`);
      
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        required: requiredPermissions,
        current: userPermissions
      });
    }

    authLog(`[AUTHZ] Authorization successful - User: ${req.user.id} - Permissions: ${requiredPermissions.join(', ')}`);
    next();
  };
};

// MFA verification
/**
 * Verify m f a.
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
const verifyMFA = (req, res, next) => {
  const user = req.user;
  const trustConfig = trustLevels[user.trustLevel || 'bronze'];
  
  // Check if MFA is required for this trust level
  if (trustConfig.mfaRequired && !req.session?.mfaVerified) {
    return res.status(403).json({
      error: 'MFA Required',
      message: 'Multi-factor authentication required for this access level',
      mfaRequired: true
    });
  }
  
  next();
};

// Device trust verification
/**
 * Verify device trust.
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
const verifyDeviceTrust = (req, res, next) => {
  const user = req.user;
  const deviceFingerprint = generateDeviceFingerprint(req);
  
  // Check if device is trusted
  const trustedDevice = deviceTrust.get(`${user.id}:${deviceFingerprint}`);
  
  if (!trustedDevice && user.trustLevel === 'gold') {
    return res.status(403).json({
      error: 'Device Not Trusted',
      message: 'Device trust required for this access level',
      deviceTrustRequired: true
    });
  }
  
  req.device = trustedDevice || { fingerprint: deviceFingerprint, trusted: false };
  next();
};

// Generate device fingerprint
/**
 * Generate device fingerprint.
 * @param {any} req
 * @returns {any}
 */
const generateDeviceFingerprint = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  return crypto.createHash('sha256').update(`${userAgent}:${ip}`).digest('hex');
};

// Trust device
/**
 * Trust device.
 * @param {string} userId
 * @param {any} deviceFingerprint
 * @param {any} duration
 * @returns {any}
 */
const trustDevice = (userId, deviceFingerprint, duration = 30 * 24 * 60 * constants.ONE_MINUTE_MS) => {
  const key = `${userId}:${deviceFingerprint}`;
  deviceTrust.set(key, {
    trusted: true,
    trustedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + duration).toISOString()
  });
  
  // Auto-cleanup expired devices
  setTimeout(() => {
    deviceTrust.delete(key);
  }, duration);
};

// Generate MFA secret
/**
 * Generate m f a secret.
 * @param {any} user
 * @returns {any}
 */
const generateMFASecret = (user) => {
  return speakeasy.generateSecret({
    name: `Cascade AI (${user.email})`,
    issuer: 'Cascade AI Platform',
    length: 32
  });
};

// Verify MFA token
/**
 * Verify m f a token.
 * @param {any} secret
 * @param {string} token
 * @returns {any}
 */
const verifyMFAToken = (secret, token) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2
  });
};

// Hash password
/**
 * Hash password.
 * @param {string} password
 * @returns {any}
 */
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Verify password
/**
 * Verify password.
 * @param {string} password
 * @param {string} hashedPassword
 * @returns {any}
 */
const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Trust level middleware
/**
 * Require trust level.
 * @param {any} minimumLevel
 * @returns {any}
 */
const requireTrustLevel = (minimumLevel) => {
  const levelOrder = { bronze: 1, silver: 2, gold: 3 };
  const requiredLevel = levelOrder[minimumLevel] || 1;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const userLevel = levelOrder[req.user.trustLevel] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Trust level ${minimumLevel} or higher required`,
        current: req.user.trustLevel,
        required: minimumLevel
      });
    }

    next();
  };
};

// Rate limiting based on trust level
/**
 * Get trust level rate limit.
 * @param {any} trustLevel
 * @returns {any}
 */
const getTrustLevelRateLimit = (trustLevel) => {
  const baseLimit = 100; // Base requests per 15 minutes
  const multiplier = trustLevels[trustLevel]?.rateLimitMultiplier || 1;
  return baseLimit * multiplier;
};

// Progress trust level evaluation
/**
 * Evaluate trust level.
 * @param {any} user
 * @returns {any}
 */
const evaluateTrustLevel = (user) => {
  const factors = {
    accountAge: Math.min((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24 * 30), 12), // Max 12 months
    successfulAnalyses: user.successfulAnalyses || 0,
    securityIncidents: user.securityIncidents || 0,
    communityContributions: user.communityContributions || 0,
    verificationStatus: user.verificationStatus || 'none'
  };

  let score = 0;

  // Account age factor (0-30 points)
  score += Math.min(factors.accountAge * 2.5, 30);

  // Successful analyses (0-25 points)
  score += Math.min(factors.successfulAnalyses * 0.5, 25);

  // Security incidents (penalty)
  score -= Math.min(factors.securityIncidents * 10, 20);

  // Community contributions (0-15 points)
  score += Math.min(factors.communityContributions * 3, 15);

  // Verification status (0-10 points)
  const verificationBonus = {
    none: 0,
    email: 5,
    phone: 7,
    enterprise: 10
  };
  score += verificationBonus[factors.verificationStatus] || 0;

  // Determine trust level
  if (score >= 70) return 'gold';
  if (score >= 40) return 'silver';
  return 'bronze';
};

// Audit logging for authentication events
/**
 * Audit auth.
 * @param {any} action
 * @param {any} user
 * @param {any} req
 * @returns {any}
 */
const auditAuth = (action, user, req = null) => {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId: user?.id,
    email: user?.email,
    trustLevel: user?.trustLevel,
    ip: req?.ip,
    userAgent: req?.headers['user-agent'],
    requestId: req?.requestId
  };

  if (shouldWriteAuditEvents()) {
    logger.info(`[AUDIT] ${JSON.stringify(auditEntry)}`);
  }
  
  // In production, this would be stored in a secure audit database
  // For now, we'll log to console with a special marker
};

// Login endpoint handler
/**
 * Handle login.
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
const handleLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createError(400, 'Email and password required');
    }

    // Validate against demo users file (legacy fallback must still check credentials)
    const path = require('path');
    const demoPath = path.join(__dirname, '..', 'db', 'demo-users.json');
    let demoUsers = [];
    try {
      const raw = await fs.promises.readFile(demoPath, 'utf8');
      demoUsers = JSON.parse(raw);
    } catch { /* no demo file */ }

    const match = demoUsers.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (!match) {
      auditAuth('login_failed', { email }, req);
      return res.status(401).json({ error: 'Authentication failed', message: 'Invalid email or password' });
    }

    // Check password
    let valid = false;
    if (match.passwordHash) {
      valid = await bcrypt.compare(password, match.passwordHash);
    } else if (match.password) {
      valid = match.password === password;
    }
    if (!valid) {
      auditAuth('login_failed', { email }, req);
      return res.status(401).json({ error: 'Authentication failed', message: 'Invalid email or password' });
    }

    const adminEmails = (process.env.SIMPLEBEACON_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    const isAdmin = adminEmails.length > 0 ? adminEmails.includes(email) : false;
    const trustLevel = isAdmin ? 'gold' : (match.trustLevel || 'bronze');

    const user = {
      id: match.id || (isAdmin ? 'admin-' + Date.now() : 'demo-user-' + Date.now()),
      email: match.email,
      name: match.name || email.split('@')[0],
      trustLevel,
      createdAt: match.createdAt || new Date(Date.now() - 30 * 24 * 60 * constants.ONE_MINUTE_MS).toISOString(),
      successfulAnalyses: match.successfulAnalyses || (isAdmin ? 100 : 5),
      securityIncidents: match.securityIncidents || 0,
      communityContributions: match.communityContributions || (isAdmin ? 50 : 0),
      verificationStatus: match.verificationStatus || (isAdmin ? 'verified' : 'email')
    };

    const token = generateToken(user);
    auditAuth('login_success', user, req);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        trustLevel: user.trustLevel,
        permissions: trustLevels[user.trustLevel].permissions
      }
    });
  } catch (error) {
    auditAuth('login_failed', { email: req.body?.email }, req);
    next(error);
  }
};

// Token refresh endpoint handler
/**
 * Handle token refresh.
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
const handleTokenRefresh = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Valid token required for refresh'
      });
    }
    const newToken = generateToken(req.user);

    auditAuth('token_refresh', req.user, req);

    res.json({
      message: 'Token refreshed successfully',
      token: newToken
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuthenticate,
  recordTokenFirstUse,
  isTokenExpiredByFirstUse,
  invalidateToken,
  authorize,
  requireTrustLevel,
  getTrustLevelRateLimit,
  evaluateTrustLevel,
  auditAuth,
  handleLogin,
  handleTokenRefresh,
  verifyMFA,
  verifyDeviceTrust,
  generateDeviceFingerprint,
  trustDevice,
  generateMFASecret,
  verifyMFAToken,
  hashPassword,
  verifyPassword,
  trustLevels,
  jwtConfig,
  isSandboxToken,
  recordSandboxRequest,
  getSandboxLimitHeaders
};
