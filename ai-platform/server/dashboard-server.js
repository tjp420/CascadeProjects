/**
 * AI Coding Intelligence Dashboard - Main Server Application
 *
 * This Express server provides the backend infrastructure for the AI Coding Intelligence
 * Dashboard, serving static files, API endpoints, and handling real-time code analysis
 * requests. The server implements security best practices, rate limiting, and performance
 * optimizations for production environments.
 *
 * @fileoverview Main server application for AI Coding Intelligence Dashboard
 * @author Technical Debt Analysis Team
 * @since 1.0.0
 * @version 2.0.0
 *
 * @example
 * // Start the server
 * node dashboard-server.js
 * // Server will start on port 56742
 *
 * @example
 * // Start with custom port
 * PORT=8080 node dashboard-server.js
 *
 * @example
 * // Start in production mode
 * NODE_ENV=production node dashboard-server.js
 */

const logger = require('./lib/app-logger');

const path = require('path');
const fs = require('fs');

const webRoot = path.join(__dirname, '..', 'web');

function resolveDashboardIndex() {
  const candidates = [
    path.join(webRoot, 'simplebeacon-dashboard', 'index.html'),
    path.join(webRoot, 'dashboard-new.html'),
    path.join(webRoot, 'dashboard.html')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function sendDashboardIndex(res) {
  const indexPath = resolveDashboardIndex();
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send(`Dashboard not found at: ${indexPath}`);
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.sendFile(indexPath);
}

const compression = require('compression');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const mime = require('mime-types');
const { resolveCorsOptions } = require('./lib/cors-config');
const { toClientError } = require('./lib/client-error');

// Import performance optimization tools
const {
  initializeOptimizations,
  CacheManager,
  PerformanceMonitor,
} = require('./api-server-optimizations');

/**
 * Express application instance
 * @type {Express}
 */
const app = express();

/**
 * Server port configuration
 * @type {number}
 * @default 56742
 */
const PORT = process.env.PORT || 56742;

/**
 * Node environment configuration
 * @type {string}
 * @default 'development'
 */
const NODE_ENV = process.env.NODE_ENV || 'development';
const shouldLogRuntimeInfo = process.env.LOG_RUNTIME_INFO === 'true' || NODE_ENV !== 'production';

/**
 * Enable Cross-Origin Resource Sharing (CORS) for all routes
 *
 * This middleware allows cross-origin requests from any domain, which is
 * necessary for the dashboard to communicate with API endpoints from
 * different origins during development and production.
 *
 * @middleware
 * @see https://expressjs.com/en/resources/middleware/cors.html
 */
app.use(cors(resolveCorsOptions({
  devFallbackOrigin: `http://localhost:${PORT}`
})));

/**
 * Body parsing middleware for JSON and URL-encoded data
 *
 * These middleware functions parse incoming request bodies before
 * handling them, making the parsed data available on req.body.
 *
 * @middleware
 * @see https://expressjs.com/en/api.html#express.json
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * MIME type correction middleware
 *
 * Automatically sets appropriate Content-Type headers based on file extensions
 * to ensure proper content delivery and browser compatibility.
 *
 * @middleware
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
app.use((req, res, next) => {
  const ext = path.extname(req.path);
  const contentType = mime.contentType(ext);

  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }

  next();
});

/**
 * Initialize performance optimizations
 *
 * Applies performance monitoring, caching, and optimization middleware
 * to improve API response times and overall server performance.
 */
const _optimizationTools = initializeOptimizations(app);
if (shouldLogRuntimeInfo) {
  logger.debug('🚀 Performance optimizations initialized');
}

/**
 * Production optimizations and security enhancements
 *
 * Applies production-specific middleware including compression, security headers,
 * and static asset caching. These optimizations are only enabled in production
 * environment to improve performance and security.
 *
 * @condition NODE_ENV === 'production'
 */
if (NODE_ENV === 'production') {
  /**
   * Enable gzip compression for all responses
   *
   * Reduces response size and improves transfer speeds for clients
   * that support gzip compression.
   *
   * @middleware
   * @see https://github.com/expressjs/compression
   */
  app.use(compression());

  /**
   * Security headers middleware
   *
   * Sets various HTTP security headers to protect against common web
   * vulnerabilities including XSS, clickjacking, and content type sniffing.
   *
   * @middleware
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {Function} next - Express next function
   * @see https://owasp.org/www-project-secure-headers/
   */
  app.use((req, res, next) => {
    // Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Enable XSS protection in browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Enforce HTTPS for one year
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  /**
   * Cache configuration for static assets
   *
   * Duration in milliseconds for caching static assets
   * @type {number}
   * @default 86400000 (24 hours)
   */
  const cacheDuration = 86400000; // 24 hours

  /**
   * Static file serving with caching
   *
   * Serves static files from the canonical web directory with aggressive caching
   * headers, ETags, and last-modified timestamps for optimal performance.
   *
   * @middleware
   * @param {string} webRoot - Static files directory
   * @param {Object} options - Caching options
   * @param {number} options.maxAge - Cache duration in milliseconds
   * @param {boolean} options.etag - Enable ETag generation
   * @param {boolean} options.lastModified - Enable Last-Modified headers
   */
  app.use(
    express.static(webRoot, {
      maxAge: cacheDuration,
      etag: true,
      lastModified: true,
    })
  );
}

// Don't use static file middleware - we'll serve specific routes only

/**
 * Rate limiting configuration for API endpoints
 *
 * Implements rate limiting to prevent abuse and ensure fair usage of API resources.
 * Limits each IP address to 100 requests per 15-minute window.
 *
 * @const {RateLimit} apiLimiter - Express rate limiter instance
 * @see https://github.com/nfriedly/express-rate-limit
 */

/**
 * API rate limiter configuration
 *
 * Limits requests to prevent abuse while ensuring legitimate usage.
 *
 * @type {RateLimit}
 * @property {number} windowMs - Time window in milliseconds (15 minutes)
 * @property {number} max - Maximum requests per window per IP
 * @property {Object} message - Response message when limit exceeded
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
});

/**
 * Apply rate limiting to all API endpoints
 *
 * @middleware
 * @param {string} '/api/' - Route pattern for API endpoints
 */
app.use('/api/', apiLimiter);

// Serve canonical web directory
app.use('/web', express.static(webRoot));

// Serve web directory (canonical frontend)
app.use('/web', express.static(path.join(__dirname, 'web')));

// Serve components directory for CSS files
app.use('/src/components', express.static(path.join(__dirname, 'src/components')));

// Serve components directory from root path
app.use('/components', express.static(path.join(__dirname, 'src/components')));
// Serve src/js directory for analytics scripts
app.use('/src/js', express.static(path.join(__dirname, 'src/js')));

// Serve src/css directory for analytics styles
app.use('/src/css', express.static(path.join(__dirname, 'src/css')));

// Serve root directory for integration scripts
app.use(express.static(path.join(__dirname)));

// Serve central analysis data directory
app.use('/analysis-data', express.static(path.join(__dirname, 'analysis-data')));

// Serve src/core directory for central data integration
app.use('/src/core', express.static(path.join(__dirname, 'src/core')));

// Serve src/adapters directory for feature adapters
app.use('/src/adapters', express.static(path.join(__dirname, 'src/adapters')));

// Serve data-central directory for central data access
app.use('/data-central', express.static(path.join(__dirname, 'data-central')));

// Serve root directory with index.html (SPA routing)
app.use(
  express.static(webRoot, {
    index: 'index.html',
  })
);

// Explicit route for JSON files
app.get('/real_mock_analysis_results.json', (req, res) => {
  const jsonPath = path.join(__dirname, 'real_mock_analysis_results.json');
  res.sendFile(jsonPath, err => {
    if (err) {
      console.error('Error serving JSON file:', err);
      res.status(404).json({ error: 'JSON file not found' });
    }
  });
});

// Main dashboard route - now serves consolidated version
app.get('/', (_req, res) => sendDashboardIndex(res));

// Explicit index.html route
app.get('/index.html', (_req, res) => sendDashboardIndex(res));

// Performance Metrics Endpoint
app.get('/api/performance-metrics', (req, res) => {
  try {
    const metrics = PerformanceMonitor.getStats();
    const cacheStats = CacheManager.getStats();

    res.json({
      performance: metrics,
      cache: cacheStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

// GGUF Analysis API Endpoints
const ggufAnalysisAPI = require('./lib/gguf-analysis');

// GET /api/gguf/analysis
app.get('/api/gguf/analysis', ggufAnalysisAPI.getAnalysis);

// GET /api/gguf/issues
app.get('/api/gguf/issues', ggufAnalysisAPI.getIssues);

// PATCH /api/gguf/issues/:id/status
app.patch('/api/gguf/issues/:id/status', ggufAnalysisAPI.updateIssueStatus);

// GET /api/gguf/recommendations
app.get('/api/gguf/recommendations', ggufAnalysisAPI.getRecommendations);

// PATCH /api/gguf/recommendations/:id/progress
app.patch('/api/gguf/recommendations/:id/progress', ggufAnalysisAPI.updateRecommendationProgress);

// Cache Management Endpoint
app.post('/api/cache/clear', (req, res) => {
  try {
    CacheManager.clear();
    res.json({ message: 'Cache cleared successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Mock Data Analysis Endpoint
app.post('/api/analyze-mock-data', async (req, res) => {
  try {
    const { _targetDirectory, mode } = req.body;

    // Import the MockDataScanner
    const scannerPath = path.join(__dirname, 'web/mock_data_scanner.js');
    if (require('fs').existsSync(scannerPath)) {
      // For now, return a simulated response since the scanner needs file system access
      // In a real implementation, you'd need to adapt the scanner for server-side use
      const mockResults = {
        filesScanned: Math.floor(Math.random() * 500) + 100,
        patternsFound: Math.floor(Math.random() * 50) + 10,
        potentialIssues: Math.floor(Math.random() * 20) + 5,
        avgConfidence: (Math.random() * 30 + 70).toFixed(1),
        findings: generateMockFindings(mode),
        scanDuration: Math.floor(Math.random() * 5000) + 1000,
        timestamp: new Date().toISOString(),
      };

      res.json(mockResults);
    } else {
      res.status(404).json({ error: 'MockDataScanner not found' });
    }
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', message: toClientError(error, 'Analysis failed') });
  }
});

/**
 * Generate mock findings for analysis
 *
 * Creates mock analysis findings based on the specified mode, generating
 * realistic security, performance, and quality issues with appropriate
 * metadata including file paths, line numbers, and confidence scores.
 *
 * @param {string} mode - Analysis mode (security, performance, quality, comprehensive, deep, quick)
 * @returns {Array} Array of mock finding objects
 * @since 1.0.0
 * @author Technical Debt Analysis Team
 */
function generateMockFindings(mode) {
  const findingConfig = getFindingConfiguration(mode);
  const findingTypes = getFindingTypesByMode(mode, findingConfig);
  const count = findingConfig.count;

  return generateFindingsList(findingTypes, count);
}

/**
 * Get finding configuration by mode
 *
 * @private
 * @param {string} mode - Analysis mode
 * @returns {Object} Configuration object with count and settings
 */
function getFindingConfiguration(mode) {
  const configurations = {
    security: { count: 12 },
    performance: { count: 10 },
    quality: { count: 10 },
    comprehensive: { count: 20 },
    deep: { count: 15 },
    quick: { count: 8 },
  };

  return configurations[mode] || configurations.quick;
}

/**
 * Get finding types by analysis mode
 *
 * @private
 * @param {string} mode - Analysis mode
 * @param {Object} config - Finding configuration
 * @returns {Array} Array of finding types
 */
function getFindingTypesByMode(mode, _config) {
  const securityFindings = this.getSecurityFindings();
  const performanceFindings = this.getPerformanceFindings();
  const qualityFindings = this.getQualityFindings();

  switch (mode) {
    case 'security':
      return securityFindings;
    case 'performance':
      return performanceFindings;
    case 'quality':
      return qualityFindings;
    case 'comprehensive':
      return [...securityFindings, ...performanceFindings, ...qualityFindings];
    case 'deep':
      return [...securityFindings, ...performanceFindings, ...qualityFindings];
    default: // quick
      return [
        ...securityFindings.slice(0, 3),
        ...performanceFindings.slice(0, 2),
        ...qualityFindings.slice(0, 3),
      ];
  }
}

/**
 * Get security findings definitions
 *
 * @private
 * @returns {Array} Array of security finding types
 */
function _getSecurityFindings() {
  return [
    { type: 'Hardcoded API Key', severity: 'critical', icon: 'fa-key', category: 'security' },
    {
      type: 'SQL Injection Pattern',
      severity: 'critical',
      icon: 'fa-database',
      category: 'security',
    },
    { type: 'Insecure Random', severity: 'high', icon: 'fa-random', category: 'security' },
    { type: 'Eval Usage', severity: 'critical', icon: 'fa-code', category: 'security' },
    { type: 'Command Injection', severity: 'critical', icon: 'fa-terminal', category: 'security' },
    { type: 'Weak Encryption', severity: 'high', icon: 'fa-lock', category: 'security' },
    {
      type: 'Placeholder Credit Card',
      severity: 'high',
      icon: 'fa-credit-card',
      category: 'security',
    },
    { type: 'Sample SSN Pattern', severity: 'critical', icon: 'fa-id-card', category: 'security' },
  ];
}

/**
 * Get performance findings definitions
 *
 * @private
 * @returns {Array} Array of performance finding types
 */
function _getPerformanceFindings() {
  return [
    { type: 'Nested Loops', severity: 'medium', icon: 'fa-sync', category: 'performance' },
    {
      type: 'Large Object Allocation',
      severity: 'medium',
      icon: 'fa-cube',
      category: 'performance',
    },
    {
      type: 'Inefficient DOM Operations',
      severity: 'high',
      icon: 'fa-sitemap',
      category: 'performance',
    },
    { type: 'Memory Leak Pattern', severity: 'high', icon: 'fa-memory', category: 'performance' },
    {
      type: 'Synchronous File Operations',
      severity: 'medium',
      icon: 'fa-file',
      category: 'performance',
    },
    { type: 'Missing Caching', severity: 'low', icon: 'fa-bolt', category: 'performance' },
    { type: 'Unoptimized Queries', severity: 'high', icon: 'fa-database', category: 'performance' },
  ];
}

/**
 * Get quality findings definitions
 *
 * @private
 * @returns {Array} Array of quality finding types
 */
function _getQualityFindings() {
  return [
    { type: 'TODO Comments', severity: 'low', icon: 'fa-tasks', category: 'quality' },
    { type: 'Code Duplication', severity: 'medium', icon: 'fa-copy', category: 'quality' },
    { type: 'Long Functions', severity: 'medium', icon: 'fa-arrows-alt-h', category: 'quality' },
    { type: 'Magic Numbers', severity: 'low', icon: 'fa-hashtag', category: 'quality' },
    {
      type: 'Missing Error Handling',
      severity: 'high',
      icon: 'fa-exclamation-triangle',
      category: 'quality',
    },
    { type: 'Inconsistent Naming', severity: 'low', icon: 'fa-font', category: 'quality' },
    { type: 'Dead Code', severity: 'medium', icon: 'fa-trash', category: 'quality' },
    { type: 'Mock Email Pattern', severity: 'low', icon: 'fa-envelope', category: 'quality' },
    { type: 'Mock Address Data', severity: 'low', icon: 'fa-map-marker-alt', category: 'quality' },
  ];
}

/**
 * Generate findings list with metadata
 *
 * @private
 * @param {Array} findingTypes - Array of finding types
 * @param {number} count - Number of findings to generate
 * @returns {Array} Array of complete finding objects
 */
function generateFindingsList(findingTypes, count) {
  const findings = [];
  const directories = ['dashboard', 'shared', 'settings', 'api', 'utils', 'services'];
  const files = ['file', 'data', 'mock', 'test', 'auth', 'api', 'component', 'service'];

  for (let i = 0; i < count; i++) {
    const finding = findingTypes[Math.floor(Math.random() * findingTypes.length)];
    findings.push({
      ...finding,
      file: this.generateMockFilePath(directories, files),
      line: this.generateMockLineNumber(),
      confidence: this.generateMockConfidence(),
    });
  }

  return findings;
}

/**
 * Generate mock file path
 *
 * @private
 * @param {Array} directories - Array of directory names
 * @param {Array} files - Array of file names
 * @returns {string} Mock file path
 */
function _generateMockFilePath(directories, files) {
  const directory = directories[Math.floor(Math.random() * directories.length)];
  const file = files[Math.floor(Math.random() * files.length)];
  return `src/components/${directory}/${file}.js`;
}

/**
 * Generate mock line number
 *
 * @private
 * @returns {number} Mock line number (1-500)
 */
function _generateMockLineNumber() {
  return Math.floor(Math.random() * 500) + 1;
}

/**
 * Generate mock confidence score
 *
 * @private
 * @returns {string} Mock confidence score (70-100)
 */
function _generateMockConfidence() {
  return (Math.random() * 30 + 70).toFixed(1);
}

// Fallback for SPA routing (HTML files only)
app.get('*', (req, res) => {
  // Only serve index.html for HTML requests or requests without file extension
  const { url } = req;
  const ext = path.extname(url);

  // If it's a request for a file with an extension, let it 404
  if (ext && ext !== '.html') {
    return res.status(404).send('File not found');
  }

  // Serve index.html for SPA routing
  sendDashboardIndex(res);
});

const server = app.listen(PORT, () => {
  logger.debug(`🚀 Dashboard server running on http://localhost:${PORT}`);
  logger.debug(`📁 Serving files from: ${webRoot}`);
  logger.debug(`🌐 Dashboard available at: http://localhost:${PORT}`);
  logger.debug(`🔧 Environment: ${NODE_ENV}`);
  logger.debug(`⚡ Compression: ${NODE_ENV === 'production' ? 'enabled' : 'disabled'}`);
  logger.debug(`🛡️ Rate limiting: enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.debug('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.debug('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.debug('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.debug('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  if (NODE_ENV === 'production') {
    // In production, you might want to send this to a monitoring service
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (NODE_ENV === 'production') {
    // In production, you might want to send this to a monitoring service
  }
});
