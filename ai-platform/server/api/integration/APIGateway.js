/**
 * API Gateway System
 * 
 * Central API gateway with unified access patterns,
 * request routing, load balancing, middleware management,
 * and comprehensive API integration capabilities
 */

const GATEWAY_DEBUG = process.env.API_GATEWAY_DEBUG === 'true';

const logger = require('../../lib/app-logger');

function gatewayLog(...args) {
  if (GATEWAY_DEBUG) logger.debug(...args);
}

class APIGateway {
  constructor(options = {}) {
    this.options = options;
    this.routes = new Map();
    this.middleware = new Map();
    this.rateLimiters = new Map();
    this.loadBalancer = null;
    this.requestStats = new Map();
    this.errorHandler = null;
    this.isInitialized = false;
    this.requestQueue = [];
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.requestTimeout = options.requestTimeout || 30000; // 30 seconds
    
    gatewayLog('[API_GATEWAY] API gateway initialized');
  }

  // Initialize gateway
  async initialize() {
    if (this.isInitialized) {
      gatewayLog('[API_GATEWAY] API gateway already initialized');
      return;
    }

    try {
      // Initialize load balancer
      this.initializeLoadBalancer();
      
      // Initialize rate limiters
      this.initializeRateLimiters();
      
      // Initialize middleware chain
      this.initializeMiddleware();
      
      // Initialize error handling
      this.initializeErrorHandling();
      
      // Initialize routing
      this.initializeRouting();
      
      // Start request processing
      this.startRequestProcessing();
      
      this.isInitialized = true;
      gatewayLog('[API_GATEWAY] API gateway initialized successfully');
      
    } catch (error) {
      console.error('[API_GATEWAY] Failed to initialize API gateway:', error.message);
      throw error;
    }
  }

  // Initialize load balancer
  initializeLoadBalancer() {
    // Simple round-robin load balancer
    this.loadBalancer = {
      algorithm: 'round-robin',
      servers: [],
      currentIndex: 0,
      healthChecks: new Map(),
      responseTime: [],
      lastHealthCheck: null,
      totalRequests: 0,
      failedRequests: 0
    };

    gatewayLog('[API_GATEWAY] Load balancer initialized with round-robin algorithm');
  }

  // Initialize rate limiters
  initializeRateLimiters() {
    // Global rate limiter
    this.rateLimiters.set('global', {
      windowMs: 100, // 100 requests per minute
      maxRequests: 1000, // Maximum requests per minute
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      statusCode: 429,
      message: 'Rate limit exceeded'
    });

    // API-specific rate limiters
    this.rateLimiters.set('api', {
      windowMs: 50, // 50 requests per minute
      maxRequests: 500, // Maximum requests per minute
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      statusCode: 429,
      message: 'API rate limit exceeded'
    });

    // Security rate limiter
    this.rateLimiters.set('security', {
      windowMs: 20, // 20 requests per minute
      maxRequests: 100, // Maximum requests per minute
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      statusCode: 429,
      message: 'Security rate limit exceeded'
    });

    gatewayLog(`[API_GATEWAY] Initialized ${this.rateLimiters.size} rate limiters`);
  }

  // Initialize middleware chain
  initializeMiddleware() {
    // Request logging middleware
    this.addMiddleware('request_logging', {
      execute: (req, res, next) => {
        const start = Date.now();
        
        const _logEntry = {
          timestamp: start,
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent'],
          ip: req.ip || 'unknown',
          response_time: null,
          status: 'pending'
        };

        gatewayLog(`[API_GATEWAY] ${req.method} ${req.url} - Request logged`);
        
        next();
      }
    });

    // Rate limiting middleware
    this.addMiddleware('rate_limiting', {
      execute: (req, res, next) => {
        const rateLimiter = this.rateLimiters.get('global');
        
        if (!rateLimiter.passes(req)) {
          return res.status(429).json({
            error: 'Too Many Requests',
            message: rateLimiter.message
          });
        }
        
        next();
      }
    });

    // Security middleware
    this.addMiddleware('security', {
      execute: (req, res, next) => {
        // Add security headers
        res.setHeader('X-Content-Type', 'application/json');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Content-Security', 'no-cache');
        res.setHeader('X-Frame-Options', 'DENY');
        
        // Add security headers
        if (!req.headers['authorization']) {
          res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
        }
        
        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        next();
      }
    });

    // Input validation middleware
    this.addMiddleware('input_validation', {
      execute: (req, res, next) => {
        // Validate content-type headers
        const contentType = req.headers['content-type'];
        if (contentType && !this.isValidContentType(contentType)) {
          return res.status(415).json({
            error: 'Unsupported Media Type',
            message: `Unsupported content-type: ${contentType}`
          });
        }
        
        // Validate content length
        const contentLength = req.headers['content-length'];
        if (contentLength && contentLength > 1000000) {
          return res.status(413).json({
            error: 'Content Too Large',
            message: 'Content length exceeds 1MB limit'
          });
        }
        
        next();
      }
    });

    // Error handling middleware
    this.addMiddleware('error_handling', {
      execute: (req, res, next) => {
        if (!res.headers.sent) {
          res.end();
        }
        
        // Log error
        console.error(`[API_GATEWAY] ${req.method} ${req.url} - ${res.status}`);
        
        next();
      }
    });

    gatewayLog(`[API_GATEWAY] Initialized ${this.middleware.size} middleware layers`);
  }

  // Add middleware to chain
  addMiddleware(name, middleware) {
    this.middleware.set(name, middleware);
    gatewayLog(`[API_GATEWAY] Added middleware: ${name}`);
  }

  // Initialize error handling
  initializeErrorHandling() {
    this.errorHandler = {
      handle: (error, req, res, next) => {
        console.error(`[API_GATEWAY] Error: ${error.message}`);
        
        if (!res.headers.sent) {
          res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
          });
        }
        
        next();
      }
    };
  }

  // Initialize routing
  initializeRouting() {
    // API routes
    this.addRoute('/api/health', 'GET', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        gateway: 'API Gateway',
        services: this.getServiceHealth(),
        rateLimiters: this.getRateLimitersStats(),
        middleware: this.getMiddlewareStats()
      });
    });

    // Mock data API routes
    this.addRoute('/api/mock-data', 'GET', (req, res) => {
      res.json({
        status: 'success',
        data: this.generateMockData(req.query),
        timestamp: new Date().toISOString(),
        gateway: 'API Gateway',
        services: this.getServiceHealth(),
        rateLimiters: this.getRateLimitersStats(),
        middleware: this.getMiddlewareStats()
      });
    });

    // Technical debt API routes
    this.addRoute('/api/technical-debt', 'GET', (req, res) => {
      res.json({
        status: 'success',
        data: this.generateTechnicalDebtData(req.query),
        timestamp: new Date().toISOString(),
        gateway: 'API Gateway',
        services: this.getServiceHealth(),
        rateLimiters: this.getRateLimitersStats(),
        middleware: this.getMiddlewareStats()
      });
    });

    // Performance monitoring API routes
    this.addRoute('/api/performance', 'GET', (req, res) => {
      res.json({
        status: 'success',
        data: this.generatePerformanceData(req.query),
        timestamp: new Date().toISOString(),
        gateway: 'API Gateway',
        services: this.getServiceHealth(),
        rateLimiters: this.getRateLimitersStats(),
        middleware: this.getMiddlewareStats()
      });
    });

    gatewayLog(`[API_GATEWAY] Initialized ${this.routes.size} API routes`);
  }

  // Add route
  addRoute(path, method, handler) {
    this.routes.set(path, {
      method,
      handler,
      usage: 0,
      lastUsed: null
    });
    
    gatewayLog(`[API_GATEWAY] Added route: ${method} ${path}`);
  }

  // Generate mock technical debt data
  generateTechnicalDebtData(_query) {
    const now = new Date();
    
    return {
      timestamp: now.toISOString(),
      summary: {
        totalScore: 42 + Math.random() * 30,
        grade: this.getQualityGrade(42 + Math.random() * 30),
        criticalIssues: Math.floor(Math.random() * 5),
        highIssues: Math.floor(Math.random() * 10),
        mediumIssues: Math.floor(Math.random() * 15),
        lowIssues: Math.floor(Math.random() * 5),
        totalIssues: Math.floor(Math.random() * 20)
      },
      categories: {
        complexity: {
          score: 65 + Math.random() * 30,
          grade: this.getQualityGrade(65 + Math.random() * 30),
          trend: this.calculateTrend(this.generateScoreHistory(30)),
          factors: {
            cyclomatic_complexity: 65 + Math.random() * 30,
            maintainability_index: 45 + Math.random() * 30,
            code_duplication: 35 + Math.random() * 25
          }
        },
        quality: {
          score: 35 + Math.random() * 30,
          grade: this.getQualityGrade(35 + Math.random() * 30),
          trend: this.calculateTrend(this.generateScoreHistory(30)),
          factors: {
            test_coverage: 25 + Math.random() * 25,
            documentation_coverage: 15 + Math.random() * 15,
            standards_compliance: 30 + Math.random() * 20,
            error_handling: 20 + Math.random() * 10
          }
        },
        security: {
          score: 25 + Math.random() * 25,
          grade: this.getQualityGrade(25 + Math.random() * 25),
          trend: this.calculateTrend(this.generateScoreHistory(30)),
          factors: {
            vulnerabilities: 35 + Math.random() * 20,
            security_tests: 15 + Math.random() * 10,
            compliance_gaps: 20 + Math.random() * 15,
            encryption_issues: 10 + Math.random() * 5
          }
        },
        performance: {
          score: 55 + Math.random() * 25,
          grade: this.getQualityGrade(55 + Math.random() * 25),
          trend: this.calculateTrend(this.generateScoreHistory(30)),
          factors: {
            response_time: 45 + Math.random() * 20,
            memory_usage: 60 + Math.random() * 20,
            scalability_issues: 25 + Math.random() * 15,
            resource_leaks: 15 + Math.random() * 10
          }
        },
        architecture: {
          score: 70 + Math.random() * 20,
          grade: this.getQualityGrade(70 + Math.random() * 20),
          trend: this.calculateTrend(this.generateScoreHistory(30)),
          factors: {
            design_patterns: 75 + Math.random() * 15,
            modularity: 65 + Math.random() * 15,
            coupling: 40 + Math.random() * 10,
            documentation: 30 + Math.random() * 10
          }
        }
      }
    };
  }

  // Generate performance data
  generatePerformanceData(_query) {
    const now = new Date();
    
    return {
      timestamp: now.toISOString(),
      response_time: 45 + Math.random() * 100,
      memory_usage: 60 + Math.random() * 40,
      scalability_issues: 25 + Math.random() * 15,
      resource_leaks: 15 + Math.random() * 10,
      throughput: Math.floor(Math.random() * 1000 + 500),
      errors: Math.floor(Math.random() * 10),
      uptime: 99.5 + Math.random() * 0.4
    };
  }

  // Generate score history for trend calculation
  generateScoreHistory(count) {
    const history = [];
    
    for (let i = 0; i < count; i++) {
      const score = 40 + Math.random() * 40;
      history.push(score);
    }
    
    return history;
  }

  // Calculate trend from history
  calculateTrend(history) {
    if (history.length < 2) return 'stable';
    
    const firstHalf = history.slice(0, Math.floor(history.length / 2));
    const secondHalf = history.slice(Math.floor(history.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    const change = secondAvg - firstAvg;
    
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  }

  // Get quality grade
  getQualityGrade(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'acceptable';
    if (score >= 20) return 'poor';
    return 'critical';
  }

  // Get rate limiter statistics
  getRateLimitersStats() {
    const stats = {};
    
    this.rateLimiters.forEach((name, limiter) => {
      stats[name] = {
        currentRate: limiter.currentRate || 0,
        maxRequests: limiter.maxRequests,
        usage: limiter.usage || 0,
        lastUsed: limiter.lastUsed ? new Date(limiter.lastUsed).toISOString() : null,
        successRate: limiter.successCount / (limiter.usage || 1),
        failureRate: limiter.failureCount / (limiter.usage || 1),
        statusCode: limiter.statusCode || '200 OK',
        message: limiter.message || 'OK'
      };
    });
    
    return stats;
  }

  // Get middleware stats
  getMiddlewareStats() {
    const stats = {};
    
    this.middleware.forEach((name, middleware) => {
      stats[name] = {
        usage: middleware.usage || 0,
        lastUsed: middleware.lastUsed ? new Date(middleware.lastUsed).toISOString() : null
      };
    });
    
    return stats;
  }

  // Get service health
  getServiceHealth() {
    const health = {
      timestamp: new Date().toISOString(),
      services: {},
      uptime: 99.9,
      response_time: 45,
      memory_usage: 60,
      errors: 2,
      requests_per_second: 25
    };

    // Check individual service health
    this.loadBalancer.healthChecks.forEach((service, health) => {
      const lastCheck = health.lastHealth;
      const timeSinceCheck = lastCheck ? Date.now() - new Date(lastCheck) : Infinity;
      health.isHealthy = timeSinceCheck < 60000; // 10 minutes
      
      health.isHealthy = health.isHealthy && health.errors === 0;
    });

    return health;
  }

  // Get service health checks
  getServiceHealthChecks() {
    const checks = {};
    
    this.loadBalancer.healthChecks.forEach((service, health) => {
      checks[service] = {
        lastCheck: health.lastHealth || null,
        isHealthy: health.isHealthy,
        errors: health.errors || 0,
        response_time: health.response_time || 0,
        uptime: health.uptime || 0
      };
    });

    return checks;
  }

  // Destroy gateway
  destroy() {
    this.stopRequestProcessing();
    this.destroyLoadBalancer();
    this.destroyMiddleware();
    this.destroyErrorHandling();
    this.destroyRouting();
    
    this.isInitialized = false;
    gatewayLog('[API_GATEWAY] API gateway destroyed');
  }
}

// Global instance
let apiGateway = null;

// Initialize gateway when DOM is ready
function initializeAPIGateway() {
  if (!apiGateway) {
    apiGateway = new APIGateway();
  }
  return apiGateway.initialize();
}

// Export for global access in browser bundles; no-op in Node.
if (typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined') {
  globalThis.window.apiGateway = apiGateway;
}

module.exports = {
  APIGateway,
  initializeAPIGateway
};
