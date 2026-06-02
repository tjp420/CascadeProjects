/**
 * Authentication and Authorization Middleware
 * 
 * Provides JWT-based authentication and role-based authorization
 * with progressive trust levels and audit logging
 */

const logger = require('../lib/app-logger.cjs');

const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const bcrypt = require('bcryptjs');
const { resolveSecret } = require('../lib/secret-config.cjs');
const { toClientError } = require('../lib/client-error.cjs');
const { isVaultAuthenticated } = require('../lib/dashboard-vault-auth.cjs');

// JWT Configuration
const jwtConfig = {
  secret: resolveSecret('JWT_SECRET'),
  expiresIn: '24h',
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

function applyVaultOperatorUser(req) {
  req.user = {
    id: 'vault-operator',
    email: process.env.SIMPLEBEACON_BYPASS_EMAIL || 'dev@simplebeacon.ai',
    name: 'Vault Operator',
    trustLevel: 'gold',
    permissions: trustLevels.gold.permissions,
    vaultSession: true
  };
}

function vaultOperatorSessionActive(req) {
  return (
    process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true'
    && isVaultAuthenticated(req, {
      internalDashboard: true,
      vaultPassword: process.env.DASHBOARD_VAULT_PASSWORD
    })
  );
}

// Device tracking
const deviceTrust = new Map();
const _mfaSessions = new Map();

function isAuthDebugEnabled() {
  return process.env.LOG_AUTH === 'true' || process.env.AUTH_DEBUG === 'true';
}

function authLog(message) {
  if (isAuthDebugEnabled()) {
    logger.info(message);
  }
}

function authWarn(message) {
  if (isAuthDebugEnabled()) {
    logger.warn(message);
  }
}

function shouldWriteAuditEvents() {
  return process.env.AUDIT_AUTH_LOGS !== 'false';
}

// Generate JWT token
const generateToken = (user) => {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    trustLevel: user.trustLevel || 'bronze',
    permissions: trustLevels[user.trustLevel || 'bronze'].permissions,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomUUID()
  };

  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
    algorithm: jwtConfig.algorithm,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience
  });
};

// Verify JWT token
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
    
    // Token revocation is handled by the auth service/session layer.
    
    // Attach user info to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      trustLevel: decoded.trustLevel,
      permissions: decoded.permissions,
      tokenId: decoded.jti,
      sessionId: decoded.sessionId
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
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;
    if (!token) return next();

    const decoded = verifyToken(token);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      trustLevel: decoded.trustLevel,
      permissions: decoded.permissions,
      tokenId: decoded.jti,
      sessionId: decoded.sessionId
    };
  } catch {
    /* public route — ignore invalid tokens */
  }
  return next();
};

// Authorization middleware factory
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
const verifyMFA = (req, res, next) => {
  const user = req.user;
  const trustConfig = trustLevels[user.trustLevel || 'bronze'];
  
  // Check if MFA is required for this trust level
  if (trustConfig.mfaRequired && !req.session.mfaVerified) {
    return res.status(403).json({
      error: 'MFA Required',
      message: 'Multi-factor authentication required for this access level',
      mfaRequired: true
    });
  }
  
  next();
};

// Device trust verification
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
const generateDeviceFingerprint = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  return crypto.createHash('sha256').update(`${userAgent}:${ip}`).digest('hex');
};

// Trust device
const trustDevice = (userId, deviceFingerprint, duration = 30 * 24 * 60 * 60 * 1000) => {
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
const generateMFASecret = (user) => {
  return speakeasy.generateSecret({
    name: `Cascade AI (${user.email})`,
    issuer: 'Cascade AI Platform',
    length: 32
  });
};

// Verify MFA token
const verifyMFAToken = (secret, token) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2
  });
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Verify password
const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Trust level middleware
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
const getTrustLevelRateLimit = (trustLevel) => {
  const baseLimit = 100; // Base requests per 15 minutes
  const multiplier = trustLevels[trustLevel]?.rateLimitMultiplier || 1;
  return baseLimit * multiplier;
};

// Progress trust level evaluation
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
const handleLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input (this would be handled by validation middleware)
    if (!email || !password) {
      throw createError(400, 'Email and password required');
    }

    // Authenticate user (this would connect to your user database)
    // For now, we'll create a mock user for demonstration
    const user = {
      id: 'demo-user-' + Date.now(),
      email: email,
      name: email.split('@')[0],
      trustLevel: 'bronze',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      successfulAnalyses: 5,
      securityIncidents: 0,
      communityContributions: 0,
      verificationStatus: 'email'
    };

    // Generate token
    const token = generateToken(user);

    // Audit successful login
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
    auditAuth('login_failed', { email: req.body.email }, req);
    next(error);
  }
};

// Token refresh endpoint handler
const handleTokenRefresh = (req, res, next) => {
  try {
    const user = req.user;
    const newToken = generateToken(user);

    auditAuth('token_refresh', user, req);

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
  jwtConfig
};
