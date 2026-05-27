/**
 * API Server Performance Optimizations
 * 
 * This file contains performance optimization utilities and middleware
 * for the dashboard API server.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('./lib/app-logger');

const OPT_DEBUG = process.env.API_OPT_DEBUG === 'true';

function optLog(...args) {
  if (OPT_DEBUG) logger.debug(...args);
}

function optWarn(...args) {
  if (OPT_DEBUG) logger.warn(...args);
}

// Response caching middleware
const CacheManager = {
  cache: new Map(),
  ttl: 5 * 60 * 1000, // 5 minutes default TTL
  
  middleware(ttl = this.ttl) {
    return (req, res, next) => {
      const key = req.originalUrl;
      const cached = this.cache.get(key);
      
      if (cached && Date.now() - cached.timestamp < ttl) {
        optLog('✅ Cache hit for:', key);
        return res.json(cached.data);
      }
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache responses
      res.json = function(data) {
        CacheManager.cache.set(key, {
          data: data,
          timestamp: Date.now()
        });
        return originalJson.call(this, data);
      };
      
      next();
    };
  },
  
  clear() {
    this.cache.clear();
    optLog('🗑️ Cache cleared');
  },
  
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
};

// File system optimization
const FileOptimizer = {
  // Cache file existence checks
  fileCache: new Map(),
  cacheTimeout: 60 * 1000, // 1 minute
  
  fileExists(filePath) {
    const cached = this.fileCache.get(filePath);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.cacheTimeout) {
      return cached.exists;
    }
    
    const exists = fs.existsSync(filePath);
    this.fileCache.set(filePath, {
      exists: exists,
      timestamp: now
    });
    
    return exists;
  },
  
  clearCache() {
    this.fileCache.clear();
  },
  
  // Optimized file reading with caching
  readFile(filePath, encoding = 'utf8') {
    try {
      return fs.readFileSync(filePath, encoding);
    } catch (error) {
      console.error('Error reading file:', filePath, error);
      return null;
    }
  }
};

// Compression optimization
const CompressionOptimizer = {
  // Enable compression for all environments (not just production)
  setup(app) {
    const compression = require('compression');
    
    // Configure compression with optimal settings
    app.use(compression({
      filter: (req, res) => {
        // Compress all responses
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024, // Only compress responses larger than 1KB
      level: 6, // Compression level (1-9, 6 is good balance)
      chunkSize: 16 * 1024, // 16KB chunks
    }));
    
    optLog('🚀 Compression enabled for all responses');
  }
};

// Static file optimization
const StaticFileOptimizer = {
  consolidateStaticRoutes(app) {
    const staticDirs = [
      { route: '/src/pages', dir: 'src/pages' },
      { route: '/src/web', dir: 'src/web' },
      { route: '/web', dir: 'web' },
      { route: '/src/components', dir: 'src/components' },
      { route: '/components', dir: 'src/components' },
      { route: '/src/js', dir: 'src/js' },
      { route: '/src/css', dir: 'src/css' },
      { route: '/analysis-data', dir: 'analysis-data' }
    ];
    
    // Remove individual static middleware calls
    // and replace with consolidated approach
    staticDirs.forEach(({ route, dir }) => {
      const fullPath = path.join(__dirname, dir);
      if (FileOptimizer.fileExists(fullPath)) {
        app.use(route, express.static(fullPath, {
          maxAge: process.env.NODE_ENV === 'production' ? 86400000 : 0,
          etag: true,
          lastModified: true,
          setHeaders: (res, filePath) => {
            // Add cache control for different file types
            if (filePath.endsWith('.js')) {
              res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
            } else if (filePath.endsWith('.css')) {
              res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
            } else if (filePath.match(/\.(png|jpg|jpeg|gif|svg)$/)) {
              res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
            }
          }
        }));
      }
    });
    
    optLog('📁 Consolidated static file routes');
  }
};

// API response optimization
const ApiResponseOptimizer = {
  // Add standard headers to API responses
  apiHeaders(req, res, next) {
    res.setHeader('X-Response-Time', Date.now().toString());
    res.setHeader('X-API-Version', '1.0.0');
    
    // Add CORS headers if needed
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    next();
  },
  
  // Optimize JSON responses
  optimizeJsonResponse(req, res, next) {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Remove circular references
      const cleanedData = JSON.parse(JSON.stringify(data));
      
      // Minify response in production
      if (process.env.NODE_ENV === 'production') {
        return originalJson.call(this, cleanedData);
      }
      
      // Pretty print in development
      return originalJson.call(this, cleanedData, null, 2);
    };
    
    next();
  }
};

// Performance monitoring
const PerformanceMonitor = {
  metrics: {
    requests: 0,
    responseTimes: [],
    errors: 0
  },
  
  middleware(req, res, next) {
    const startTime = Date.now();
    
    // Track request count
    this.metrics.requests++;
    
    // Track response time
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      this.metrics.responseTimes.push(responseTime);
      
      // Keep only last 100 response times
      if (this.metrics.responseTimes.length > 100) {
        this.metrics.responseTimes.shift();
      }
      
      // Log slow requests
      if (responseTime > 1000) {
        optWarn(`⚠️ Slow request: ${req.method} ${req.path} took ${responseTime}ms`);
      }
      
      // Track errors
      if (res.statusCode >= 400) {
        this.metrics.errors++;
      }
    });
    
    next();
  },
  
  getStats() {
    const responseTimes = this.metrics.responseTimes;
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    
    return {
      totalRequests: this.metrics.requests,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: this.metrics.requests > 0
        ? ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)
        : 0,
      recentResponseTimes: responseTimes.slice(-10)
    };
  },
  
  reset() {
    this.metrics = {
      requests: 0,
      responseTimes: [],
      errors: 0
    };
  }
};

// Initialize optimizations
function initializeOptimizations(app) {
  optLog('🚀 Initializing API server optimizations...');
  
  // Apply compression
  CompressionOptimizer.setup(app);
  
  // Apply performance monitoring
  app.use(PerformanceMonitor.middleware.bind(PerformanceMonitor));
  
  // Apply API response optimization
  app.use('/api/', ApiResponseOptimizer.apiHeaders);
  app.use('/api/', ApiResponseOptimizer.optimizeJsonResponse);
  
  // Apply caching for GET requests
  app.use('/api/', CacheManager.middleware(5 * 60 * 1000)); // 5 minutes
  
  optLog('✅ API server optimizations initialized');
  
  // Return optimization utilities for external use
  return {
    cache: CacheManager,
    files: FileOptimizer,
    performance: PerformanceMonitor
  };
}

// Export for use in server
module.exports = {
  CacheManager,
  FileOptimizer,
  CompressionOptimizer,
  StaticFileOptimizer,
  ApiResponseOptimizer,
  PerformanceMonitor,
  initializeOptimizations
};