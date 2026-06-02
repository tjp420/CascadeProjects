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

// Security configuration
const securityConfig = {
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 100, // limit each IP to 100 requests per windowMs
  rateLimitSkipSuccessfulRequests: false,
  rateLimitSkipFailedRequests: false,
  maxRequestSize: '10mb',
  trustedProxies: ['127.0.0.1', '::1']
};

// Rate limiting middleware
const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || securityConfig.rateLimitWindowMs,
    max: options.max || securityConfig.rateLimitMax,
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(securityConfig.rateLimitWindowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || securityConfig.rateLimitSkipSuccessfulRequests,
    skipFailedRequests: options.skipFailedRequests || securityConfig.rateLimitSkipFailedRequests,
    keyGenerator: (req) => {
      return req.ip + ':' + (req.headers['user-agent'] || '');
    }
  });
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
  })
};

// Input validation middleware
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

// Security headers middleware
const securityHeaders = helmet({
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
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
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

function shouldSkipBodySuspiciousScan(req) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return false;
  const routePath = String(req.path || req.originalUrl || '').split('?')[0];
  return BODY_SUSPICIOUS_SCAN_SKIP_PREFIXES.some((prefix) => routePath.startsWith(prefix));
}

// IP-based protection
const ipProtection = (req, res, next) => {
  const clientIP = req.ip;
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\b(?:sql|union|select|insert|update|delete|drop|create|alter)\b/i, // SQL injection patterns
    /\b(?:javascript|script|onload|onerror|onclick)\b/i, // XSS patterns
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /\.\.\//g, // Directory traversal
  ];
  
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
