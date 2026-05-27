/**
 * API Rate Limiter System
 * 
 * Rate limiting and throttling capabilities with
 * configurable windows, request tracking, and
 * intelligent rate limit management
 */

class APIRateLimiter {
  constructor(options = {}) {
    this.options = options;
    this.limits = new Map();
    this.requests = new Map();
    this.stats = new Map();
    this.defaultWindowMs = options.defaultWindowMs || 60000; // 1 minute
    this.defaultMaxRequests = options.defaultMaxRequests || 100;
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
    this.isInitialized = false;
    
    console.log('[API_RATE_LIMITER] API rate limiter initialized');
  }

  // Initialize rate limiter
  async initialize() {
    if (this.isInitialized) {
      console.log('[API_RATE_LIMITER] Rate limiter already initialized');
      return;
    }

    try {
      // Initialize default limits
      this.initializeDefaultLimits();
      
      // Start cleanup process
      this.startCleanup();
      
      this.isInitialized = true;
      console.log('[API_RATE_LIMITER] Rate limiter initialized successfully');
      
    } catch (error) {
      console.error('[API_RATE_LIMITER] Failed to initialize:', error.message);
      throw error;
    }
  }

  // Initialize default rate limits
  initializeDefaultLimits() {
    // Global rate limit
    this.addLimit('global', {
      windowMs: this.defaultWindowMs,
      maxRequests: this.defaultMaxRequests,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      statusCode: 429,
      message: 'Rate limit exceeded'
    });

    // API rate limit
    this.addLimit('api', {
      windowMs: 30000, // 30 seconds
      maxRequests: 50,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      statusCode: 429,
      message: 'API rate limit exceeded'
    });

    // Security rate limit
    this.addLimit('security', {
      windowMs: 15000, // 15 seconds
      maxRequests: 20,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      statusCode: 429,
      message: 'Security rate limit exceeded'
    });

    // Authentication rate limit
    this.addLimit('auth', {
      windowMs: 60000, // 1 minute
      maxRequests: 10,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      statusCode: 429,
      message: 'Authentication rate limit exceeded'
    });

    console.log(`[API_RATE_LIMITER] Initialized ${this.limits.size} default rate limits`);
  }

  // Add rate limit
  addLimit(name, limit) {
    const limitConfig = {
      windowMs: limit.windowMs || this.defaultWindowMs,
      maxRequests: limit.maxRequests || this.defaultMaxRequests,
      skipSuccessfulRequests: limit.skipSuccessfulRequests || false,
      skipFailedRequests: limit.skipFailedRequests || false,
      statusCode: limit.statusCode || 429,
      message: limit.message || 'Rate limit exceeded',
      successCount: 0,
      failureCount: 0,
      totalRequests: 0,
      lastUsed: null
    };

    this.limits.set(name, limitConfig);
    this.requests.set(name, new Map());
    this.stats.set(name, {
      currentRate: 0,
      peakRate: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      lastReset: new Date().toISOString()
    });

    console.log(`[API_RATE_LIMITER] Added rate limit: ${name}`);
  }

  // Check if request passes rate limit
  passes(req, limitName = 'global') {
    const limit = this.limits.get(limitName);
    if (!limit) {
      console.warn(`[API_RATE_LIMITER] Rate limit not found: ${limitName}`);
      return true;
    }

    const clientKey = this.getClientKey(req);
    const requests = this.requests.get(limitName);
    const now = Date.now();
    const windowStart = now - limit.windowMs;

    // Clean up old requests
    this.cleanupOldRequests(requests, windowStart);

    // Get current request count
    const currentRequests = requests.get(clientKey) || [];
    
    // Check if request should be counted
    let shouldCount = true;
    if (limit.skipSuccessfulRequests && req.success) {
      shouldCount = false;
    }
    if (limit.skipFailedRequests && req.error) {
      shouldCount = false;
    }

    if (shouldCount) {
      currentRequests.push(now);
      requests.set(clientKey, currentRequests);
    }

    // Update stats
    this.updateStats(limitName, currentRequests.length, limit.maxRequests);

    // Check if rate limit exceeded
    if (currentRequests.length > limit.maxRequests) {
      limit.totalRequests++;
      limit.lastUsed = now;
      return false;
    }

    limit.totalRequests++;
    limit.lastUsed = now;
    return true;
  }

  // Get client key from request
  getClientKey(req) {
    // Use IP address as client key
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  // Clean up old requests
  cleanupOldRequests(requests, windowStart) {
    for (const [clientKey, clientRequests] of requests.entries()) {
      const validRequests = clientRequests.filter(timestamp => timestamp > windowStart);
      
      if (validRequests.length === 0) {
        requests.delete(clientKey);
      } else {
        requests.set(clientKey, validRequests);
      }
    }
  }

  // Update statistics
  updateStats(limitName, currentCount, maxRequests) {
    const stats = this.stats.get(limitName);
    if (!stats) return;

    stats.currentRate = currentCount;
    stats.peakRate = Math.max(stats.peakRate, currentCount);
    
    if (currentCount >= maxRequests) {
      stats.blockedRequests++;
    } else {
      stats.allowedRequests++;
    }
  }

  // Get rate limit statistics
  getStats(limitName) {
    const limit = this.limits.get(limitName);
    const requests = this.requests.get(limitName);
    const stats = this.stats.get(limitName);

    if (!limit || !stats) {
      return null;
    }

    const now = Date.now();
    const windowStart = now - limit.windowMs;
    
    // Clean up old requests for accurate stats
    this.cleanupOldRequests(requests, windowStart);

    const totalRequests = Array.from(requests.values()).reduce((sum, clientRequests) => sum + clientRequests.length, 0);
    const uniqueClients = requests.size;

    return {
      name: limitName,
      windowMs: limit.windowMs,
      maxRequests: limit.maxRequests,
      currentRate: totalRequests,
      peakRate: stats.peakRate,
      blockedRequests: stats.blockedRequests,
      allowedRequests: stats.allowedRequests,
      totalRequests: limit.totalRequests,
      uniqueClients,
      utilization: (totalRequests / limit.maxRequests) * 100,
      lastUsed: limit.lastUsed ? new Date(limit.lastUsed).toISOString() : null,
      lastReset: stats.lastReset,
      statusCode: limit.statusCode,
      message: limit.message
    };
  }

  // Get all rate limit statistics
  getAllStats() {
    const allStats = {};
    
    this.limits.forEach((limit, name) => {
      allStats[name] = this.getStats(name);
    });

    return allStats;
  }

  // Reset rate limit
  resetLimit(limitName) {
    const requests = this.requests.get(limitName);
    if (requests) {
      requests.clear();
    }

    const stats = this.stats.get(limitName);
    if (stats) {
      stats.currentRate = 0;
      stats.blockedRequests = 0;
      stats.allowedRequests = 0;
      stats.lastReset = new Date().toISOString();
    }

    console.log(`[API_RATE_LIMITER] Reset rate limit: ${limitName}`);
  }

  // Reset all rate limits
  resetAllLimits() {
    this.requests.forEach((requests, name) => {
      requests.clear();
    });

    this.stats.forEach((stats, name) => {
      stats.currentRate = 0;
      stats.blockedRequests = 0;
      stats.allowedRequests = 0;
      stats.lastReset = new Date().toISOString();
    });

    console.log('[API_RATE_LIMITER] Reset all rate limits');
  }

  // Start cleanup process
  startCleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }

    this.cleanupIntervalId = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);

    console.log(`[API_RATE_LIMITER] Cleanup process started (${this.cleanupInterval}ms interval)`);
  }

  // Stop cleanup process
  stopCleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    console.log('[API_RATE_LIMITER] Cleanup process stopped');
  }

  // Perform cleanup
  performCleanup() {
    const now = Date.now();
    const defaultWindowStart = now - this.defaultWindowMs;

    this.requests.forEach((requests, limitName) => {
      const limit = this.limits.get(limitName);
      const windowStart = now - (limit ? limit.windowMs : this.defaultWindowMs);
      
      this.cleanupOldRequests(requests, windowStart);
    });

    console.log(`[API_RATE_LIMITER] Cleanup completed`);
  }

  // Get rate limit middleware
  getMiddleware(limitName = 'global') {
    return (req, res, next) => {
      if (!this.passes(req, limitName)) {
        const limit = this.limits.get(limitName);
        return res.status(limit.statusCode).json({
          error: 'Too Many Requests',
          message: limit.message,
          limit: {
            windowMs: limit.windowMs,
            maxRequests: limit.maxRequests,
            retryAfter: Math.ceil(limit.windowMs / 1000)
          }
        });
      }

      next();
    };
  }

  // Get rate limit for client
  getClientRateLimit(req, limitName = 'global') {
    const limit = this.limits.get(limitName);
    const requests = this.requests.get(limitName);
    
    if (!limit || !requests) {
      return null;
    }

    const clientKey = this.getClientKey(req);
    const clientRequests = requests.get(clientKey) || [];
    const now = Date.now();
    const windowStart = now - limit.windowMs;

    const validRequests = clientRequests.filter(timestamp => timestamp > windowStart);

    return {
      name: limitName,
      windowMs: limit.windowMs,
      maxRequests: limit.maxRequests,
      currentRequests: validRequests.length,
      remainingRequests: Math.max(0, limit.maxRequests - validRequests.length),
      resetTime: new Date(Math.max(...validRequests) + limit.windowMs).toISOString(),
      utilization: (validRequests.length / limit.maxRequests) * 100,
      blocked: validRequests.length >= limit.maxRequests
    };
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      options: this.options,
      limits: Array.from(this.limits.entries()).map(([name, limit]) => ({
        name,
        ...limit
      })),
      requests: Array.from(this.requests.entries()).map(([name, requests]) => ({
        name,
        clientCount: requests.size,
        totalRequests: Array.from(requests.values()).reduce((sum, clientRequests) => sum + clientRequests.length, 0)
      })),
      stats: this.getAllStats(),
      defaultWindowMs: this.defaultWindowMs,
      defaultMaxRequests: this.defaultMaxRequests,
      cleanupInterval: this.cleanupInterval
    };
  }

  // Destroy rate limiter
  destroy() {
    this.stopCleanup();
    
    this.limits.clear();
    this.requests.clear();
    this.stats.clear();
    
    this.isInitialized = false;
    console.log('[API_RATE_LIMITER] Rate limiter destroyed');
  }
}

// Global instance
let apiRateLimiter = null;

// Initialize rate limiter when DOM is ready
function initializeAPIRateLimiter() {
  if (!apiRateLimiter) {
    apiRateLimiter = new APIRateLimiter();
  }
  return apiRateLimiter.initialize();
}

// Export for global access
window.apiRateLimiter = apiRateLimiter;

module.exports = {
  APIRateLimiter,
  initializeAPIRateLimiter
};
