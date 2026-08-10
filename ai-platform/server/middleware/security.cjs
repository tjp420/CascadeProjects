/**
 * Enhanced Security Middleware
 * 
 * Provides comprehensive security protection including:
 * - Rate limiting
 * - Input validation and sanitization
 * - Security headers
 * - Request logging and monitoring
 * - IP-based protection
 */

const logger = require('../lib/app-logger.cjs');

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const Joi = require('joi');

const constants = require('../config/constants.cjs');
const { getRedisStore } = require('../lib/redis-rate-limit-store.cjs');
// Security configuration
const securityConfig = {
  rateLimitWindowMs: constants.RATE_LIMIT_WINDOW_MS, // 15 minutes
  rateLimitMax: 100, // limit each IP to 100 requests per windowMs
  rateLimitSkipSuccessfulRequests: false,
  rateLimitSkipFailedRequests: false,
  maxRequestSize: '10mb',
  trustedProxies: ['127.0.0.1', '::1']
};

// Rate limiting middleware
/**
 * Create rate limiter.
 *
 * When Redis is available (REDIS_URL set and ENABLE_REDIS_RATE_LIMIT != 'false'),
 * rate limit state is shared across all processes connecting to the same Redis
 * instance. When Redis is unavailable, falls back to the default in-memory store.
 *
 * @param {Object} options
 * @returns {any}
 */
const createRateLimiter = (options = {}) => {
  const config = {
    windowMs: options.windowMs || securityConfig.rateLimitWindowMs,
    max: options.max || securityConfig.rateLimitMax,
    skip: (req) => {
      // Bypass rate limiting for localhost in development
      if (process.env.NODE_ENV !== 'production') {
        const ip = req.ip || req.connection?.remoteAddress || '';
        return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('::ffff:127.');
      }
      return false;
    },
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(securityConfig.rateLimitWindowMs / constants.MS_PER_SECOND)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || securityConfig.rateLimitSkipSuccessfulRequests,
    skipFailedRequests: options.skipFailedRequests || securityConfig.rateLimitSkipFailedRequests
  };

  // Use Redis-backed store for distributed rate limiting when available
  const redisStore = options.store || getRedisStore();
  if (redisStore) {
    config.store = redisStore;
  }

  return rateLimit(config);
};

// Input validation schemas
const validationSchemas = {
  // Project analysis request
  projectAnalysis: Joi.object({
    targetDirectory: Joi.string().optional(),
    mode: Joi.string().valid('security', 'performance', 'quality', 'comprehensive', 'deep', 'quick').default('comprehensive'),
    options: Joi.object({
      includeTests: Joi.boolean().default(true),
      includeDocs: Joi.boolean().default(true),
      maxDepth: Joi.number().integer().min(1).max(10).default(5),
      excludePatterns: Joi.array().items(Joi.string()).default([])
    }).optional()
  }),

  // Mock data analysis request
  mockDataAnalysis: Joi.object({
    targetDirectory: Joi.string().optional(),
    mode: Joi.string().valid('analysis', 'conversion', 'validation', 'generation', 'cleaning', 'export').default('analysis'),
    options: Joi.object({
      includePatterns: Joi.array().items(Joi.string()).default(['mock', 'sample', 'demo', 'test']),
      excludePatterns: Joi.array().items(Joi.string()).default([]),
      qualityThreshold: Joi.number().min(0).max(100).default(70)
    }).optional()
  }),

  // User registration/update
  user: Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().min(2).max(100).required(),
    preferences: Joi.object({
      trustLevel: Joi.string().valid('bronze', 'silver', 'gold').default('bronze'),
      notifications: Joi.boolean().default(true),
      dataSharing: Joi.boolean().default(false)
    }).optional()
  }),

  // Login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).required()
  }),

  // HSM vault handshake
  vaultHandshake: Joi.object({
    provider: Joi.string().max(50).optional(),
    keyId: Joi.string().max(100).optional(),
    region: Joi.string().max(50).optional()
  }),

  // HSM vault decrypt
  vaultDecrypt: Joi.object({
    ciphertext: Joi.string().required(),
    orgId: Joi.string().max(100).optional()
  }),

  // HSM vault rekey
  vaultRekey: Joi.object({
    newKeyId: Joi.string().max(100).optional(),
    newRegion: Joi.string().max(50).optional()
  })
};

// Input validation middleware
/**
 * Validate input.
 * @param {string} schemaName
 * @returns {any}
 */
const validateInput = (schemaName) => {
  return (req, res, next) => {
    const schema = validationSchemas[schemaName];
    if (!schema) {
      return next(new Error(`Validation schema '${schemaName}' not found`));
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        error: 'Validation failed',
        message: 'Request validation failed',
        details: errorDetails
      });
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Build connectSrc dynamically from env — avoid hardcoding localhost in production
const buildConnectSrc = () => {
  const base = ["'self'", "ws:", "wss:", "https://cloudflareinsights.com"];
  const isProd = process.env.NODE_ENV === 'production';
  const publicUrl = process.env.PUBLIC_APP_URL || process.env.SIMPLEBEACON_APP_URL;
  const dashUrl = process.env.OPERATOR_DASHBOARD_BASE_URL || process.env.DASHBOARD_BASE_URL;
  if (publicUrl) base.push(publicUrl);
  if (dashUrl) base.push(dashUrl);
  // Render services and local dev origins. Use wildcard ports so the dashboard's
  // background port-scanning probes (which try many ports to auto-detect the local
  // API server) are not blocked by CSP.
  base.push('https://*.onrender.com', 'http://127.0.0.1:*', 'http://localhost:*', 'https://localhost:*'); // simplebeacon-ignore hardcoded-url — Render/local origins for dashboard API and bridge probes
  if (!isProd) {
    const apiPort = process.env.PORT || 3000;
    const dashPort = process.env.DASHBOARD_PORT || 3002;
    const bridgePort = process.env.SCANNER_BRIDGE_PORT || 3456; // simplebeacon-ignore hardcoded-url — fallback port for local dev, override via env
    base.push(`http://127.0.0.1:${apiPort}`, `http://localhost:${apiPort}`); // simplebeacon-ignore hardcoded-url — dev-only CSP connect-src
    if (dashPort !== apiPort) {
      base.push(`http://127.0.0.1:${dashPort}`, `http://localhost:${dashPort}`); // simplebeacon-ignore hardcoded-url — dev-only CSP connect-src
    }
    base.push(`http://127.0.0.1:${bridgePort}`, `http://localhost:${bridgePort}`); // simplebeacon-ignore hardcoded-url — dev-only CSP connect-src
  }
  return base;
};

// Security headers middleware
const isDev = process.env.NODE_ENV !== 'production';
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://static.cloudflareinsights.com"],
      scriptSrcAttr: null,
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: buildConnectSrc(),
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
      childSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: [],
      frameAncestors: isDev ? null : ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: isDev ? false : { action: 'sameorigin' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
});

// Request logging and monitoring
/**
 * Request logger.
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Add request ID to request object for tracking
  req.requestId = requestId;
  
  // Log request details
  logger.debug(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Request ID: ${requestId} - IP: ${req.ip}`);
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    logger.debug(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Request ID: ${requestId} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    
    // Log security events
    if (res.statusCode >= 400) {
      logger.warn(`[SECURITY] Request ID: ${requestId} - Error response: ${res.statusCode} - IP: ${req.ip} - User-Agent: ${req.headers['user-agent']}`);
    }
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/** Scan/export POST bodies legitimately contain code paths, SQL keywords, and HTML — skip naive pattern scan. */
const BODY_SUSPICIOUS_SCAN_SKIP_PREFIXES = [
  '/api/analyze/',
  '/api/simplebeacon/scan',
  '/api/simplebeacon/assess',
  '/api/simplebeacon/npm-audit',
  '/api/ai-validation/scan',
  '/api/ai-validation/audit'
];

/**
 * Should skip body suspicious scan.
 * @param {any} req
 * @returns {any}
 */
function shouldSkipBodySuspiciousScan(req) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return false;
  const routePath = String(req.path || req.originalUrl || '').split('?')[0];
  return BODY_SUSPICIOUS_SCAN_SKIP_PREFIXES.some((prefix) => routePath.startsWith(prefix));
}

// IP-based protection
/**
 * Ip protection.
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
const ipProtection = (req, res, next) => {
  const clientIP = req.ip;
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\b(?:sql|union|select|insert|update|delete|drop|create|alter)\b/i, // SQL injection patterns
    /\b(?:javascript|script|onload|onerror|onclick)\b/i, // XSS patterns
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /\.\.\//g, // Directory traversal
  ];
  
/**
 * Check suspicious content.
 * @param {any} obj
 * @returns {any}
 */
  const checkSuspiciousContent = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(obj[key])) {
            logger.warn(`[SECURITY] Suspicious content detected - IP: ${clientIP} - Field: ${key} - Pattern: ${pattern}`);
            return true;
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkSuspiciousContent(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };
  
  // Check request body and query parameters
  if (!shouldSkipBodySuspiciousScan(req) && req.body && checkSuspiciousContent(req.body)) {
    return res.status(400).json({
      error: 'Security violation',
      message: 'Suspicious content detected in request'
    });
  }
  
  if (req.query && checkSuspiciousContent(req.query)) {
    return res.status(400).json({
      error: 'Security violation',
      message: 'Suspicious content detected in request parameters'
    });
  }
  
  next();
};

// Error handling for security violations
/**
 * Security error handler.
 * @param {any} err
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
const securityErrorHandler = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      requestId: req.requestId
    });
  }
  
  if (err.name === 'ForbiddenError') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied',
      requestId: req.requestId
    });
  }
  
  if (err.name === 'TooManyRequestsError') {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded',
      retryAfter: err.retryAfter || 60,
      requestId: req.requestId
    });
  }
  
  next(err);
};

module.exports = {
  createRateLimiter,
  validateInput,
  securityHeaders,
  requestLogger,
  ipProtection,
  securityErrorHandler,
  validationSchemas,
  securityConfig
};
