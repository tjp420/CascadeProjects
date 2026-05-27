/**
 * Security Configuration
 * 
 * Centralized security settings for the Cascade AI Platform
 * including encryption, compliance, and trust parameters
 */

const logger = require('../lib/app-logger');

const crypto = require('crypto');
const { resolveSecret } = require('../lib/secret-config');

// Security configuration
const securityConfig = {
  // JWT Configuration
  jwt: {
    secret: resolveSecret('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    algorithm: 'HS256',
    issuer: 'cascade-ai-platform',
    audience: 'cascade-ai-users',
    refreshExpiresIn: '7d'
  },

  // Rate Limiting Configuration
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    trustLevelMultipliers: {
      bronze: 1,
      silver: 2,
      gold: 5
    },
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // Encryption Configuration
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    key: resolveSecret('ENCRYPTION_KEY', { minLength: 64 })
  },

  // Security Headers Configuration
  headers: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        childSrc: ["'none'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  },

  // Input Validation Configuration
  validation: {
    maxRequestSize: '10mb',
    maxFieldSize: 1024 * 1024, // 1MB
    allowedMimeTypes: [
      'application/json',
      'text/plain',
      'application/x-www-form-urlencoded',
      'multipart/form-data'
    ],
    sanitization: {
      enabled: true,
      stripHtml: true,
      normalizeUnicode: true,
      removeNullBytes: true
    }
  },

  // Audit Configuration
  audit: {
    enabled: true,
    logLevel: process.env.AUDIT_LEVEL || 'info',
    logFile: process.env.AUDIT_LOG_FILE || 'logs/audit.log',
    maxLogSize: 100 * 1024 * 1024, // 100MB
    backupCount: 5,
    retentionDays: 90,
    enableConsole: process.env.NODE_ENV !== 'production',
    enableFile: true
  },

  // Trust Configuration
  trust: {
    levels: {
      bronze: {
        level: 1,
        permissions: ['read:own', 'write:own', 'analyze:public'],
        rateLimitMultiplier: 1,
        features: ['basic_analysis', 'mock_data_basic'],
        confidenceThreshold: 0.7
      },
      silver: {
        level: 2,
        permissions: ['read:own', 'write:own', 'read:shared', 'analyze:public', 'analyze:private'],
        rateLimitMultiplier: 2,
        features: ['advanced_analysis', 'mock_data_advanced', 'collaboration'],
        confidenceThreshold: 0.8
      },
      gold: {
        level: 3,
        permissions: ['read:own', 'write:own', 'read:shared', 'write:shared', 'analyze:public', 'analyze:private', 'admin:basic'],
        rateLimitMultiplier: 5,
        features: ['enterprise_features', 'api_access', 'advanced_security'],
        confidenceThreshold: 0.9
      }
    },
    evaluation: {
      accountAgeWeight: 0.25,
      successRateWeight: 0.25,
      securityWeight: 0.2,
      communityWeight: 0.15,
      verificationWeight: 0.15
    }
  },

  // Compliance Configuration
  compliance: {
    gdpr: {
      enabled: true,
      dataRetentionDays: 365,
      consentRequired: true,
      rightToDeletion: true,
      dataPortability: true
    },
    soc2: {
      enabled: true,
      auditFrequency: 'quarterly',
      accessControls: true,
      encryptionRequired: true,
      monitoringRequired: true
    },
    hipaa: {
      enabled: false, // Enable if handling healthcare data
      auditControls: true,
      encryptionRequired: true,
      accessLogs: true
    }
  },

  // Security Scanning Configuration
  scanning: {
    enabled: true,
    frequency: 'daily',
    scanTypes: [
      'dependency-vulnerabilities',
      'code-security',
      'secrets-detection',
      'business-logic',
      'performance-issues'
    ],
    severityThresholds: {
      critical: 9.0,
      high: 7.0,
      medium: 4.0,
      low: 0.1
    }
  },

  // IP Protection Configuration
  ipProtection: {
    enabled: true,
    trustedProxies: ['127.0.0.1', '::1'],
    blacklistedIPs: [],
    rateLimitByIP: true,
    geoBlocking: {
      enabled: false,
      allowedCountries: [],
      blockedCountries: []
    }
  },

  // Session Configuration
  session: {
    secret: resolveSecret('SESSION_SECRET'),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    }
  },

  // Password Configuration
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    saltRounds: 12
  },

  // API Security Configuration
  api: {
    versioning: {
      enabled: true,
      defaultVersion: 'v1',
      supportedVersions: ['v1']
    },
    documentation: {
      enabled: true,
      public: false,
      authenticationRequired: true
    },
    monitoring: {
      enabled: true,
      logRequests: true,
      logResponses: false,
      logErrors: true
    }
  }
};

// Security utility functions
const securityUtils = {
  // Generate secure random string
  generateSecureRandom: (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
  },

  // Hash password
  hashPassword: async (password, saltRounds = securityConfig.password.saltRounds) => {
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, saltRounds);
  },

  // Verify password
  verifyPassword: async (password, hash) => {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
  },

  // Encrypt data
  encrypt: (data) => {
    const algorithm = securityConfig.encryption.algorithm;
    const key = Buffer.from(securityConfig.encryption.key, 'hex');
    const iv = crypto.randomBytes(securityConfig.encryption.ivLength);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  },

  // Decrypt data
  decrypt: (encryptedData) => {
    const algorithm = securityConfig.encryption.algorithm;
    const key = Buffer.from(securityConfig.encryption.key, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  },

  // Generate JWT token
  generateToken: (payload) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, securityConfig.jwt.secret, {
      expiresIn: securityConfig.jwt.expiresIn,
      algorithm: securityConfig.jwt.algorithm,
      issuer: securityConfig.jwt.issuer,
      audience: securityConfig.jwt.audience
    });
  },

  // Verify JWT token
  verifyToken: (token) => {
    const jwt = require('jsonwebtoken');
    return jwt.verify(token, securityConfig.jwt.secret, {
      algorithms: [securityConfig.jwt.algorithm],
      issuer: securityConfig.jwt.issuer,
      audience: securityConfig.jwt.audience
    });
  },

  // Validate trust level
  validateTrustLevel: (userTrustLevel, requiredLevel) => {
    const levels = { bronze: 1, silver: 2, gold: 3 };
    return levels[userTrustLevel] >= levels[requiredLevel];
  },

  // Calculate trust score
  calculateTrustScore: (user) => {
    const weights = securityConfig.trust.evaluation;
    let score = 0;

    // Account age factor
    const accountAge = Math.min((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24 * 30), 12);
    score += Math.min(accountAge * weights.accountAgeWeight * 10, weights.accountAgeWeight * 100);

    // Success rate factor
    const successRate = user.successRate || 0.8;
    score += successRate * weights.successRateWeight * 100;

    // Security factor
    const securityScore = Math.max(0, 100 - (user.securityIncidents || 0) * 10);
    score += securityScore * weights.securityWeight;

    // Community factor
    const communityScore = Math.min((user.communityContributions || 0) * 5, weights.communityWeight * 100);
    score += communityScore;

    // Verification factor
    const verificationBonus = {
      none: 0,
      email: 50,
      phone: 70,
      enterprise: 100
    };
    score += (verificationBonus[user.verificationStatus] || 0) * weights.verificationWeight;

    return Math.min(100, Math.max(0, score));
  },

  // Get rate limit for trust level
  getRateLimit: (trustLevel) => {
    const baseLimit = securityConfig.rateLimiting.maxRequests;
    const multiplier = securityConfig.rateLimiting.trustLevelMultipliers[trustLevel] || 1;
    return baseLimit * multiplier;
  },

  // Check if IP is trusted
  isTrustedIP: (ip) => {
    return securityConfig.ipProtection.trustedProxies.includes(ip);
  },

  // Check if IP is blacklisted
  isBlacklistedIP: (ip) => {
    return securityConfig.ipProtection.blacklistedIPs.includes(ip);
  },

  // Validate security headers
  validateSecurityHeaders: (headers) => {
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ];

    const missingHeaders = requiredHeaders.filter(header => !headers[header]);
    return missingHeaders.length === 0;
  },

  // Generate secure session ID
  generateSessionId: () => {
    return crypto.randomBytes(32).toString('hex');
  },

  // Sanitize input
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Normalize Unicode
    sanitized = sanitized.normalize('NFC');

    // Strip HTML tags if enabled
    if (securityConfig.validation.sanitization.stripHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    return sanitized;
  },

  // Validate file upload
  validateFileUpload: (file) => {
    const maxSize = 1024 * 1024; // 1MB
    const allowedTypes = securityConfig.validation.allowedMimeTypes;

    if (file.size > maxSize) {
      return { valid: false, error: 'File too large' };
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return { valid: false, error: 'File type not allowed' };
    }

    return { valid: true };
  },

  // Generate audit entry
  generateAuditEntry: (eventType, details, user = null) => {
    return {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      details,
      userId: user?.id,
      trustLevel: user?.trustLevel,
      ip: details.ip,
      userAgent: details.userAgent,
      requestId: details.requestId
    };
  }
};

// Security middleware factory
const createSecurityMiddleware = (options = {}) => {
  const config = { ...securityConfig, ...options };

  return {
    config,
    utils: securityUtils,
    validate: (_data, _schema) => {
      // Input validation logic
      return { valid: true, errors: [] };
    },
    audit: (entry) => {
      // Audit logging logic
      logger.debug('[AUDIT]', entry);
    }
  };
};

module.exports = {
  securityConfig,
  securityUtils,
  createSecurityMiddleware
};
