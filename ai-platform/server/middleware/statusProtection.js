/**
 * Status Protection Middleware
 * 
 * Automatically detects and corrects outdated roadmap data in incoming requests
 * Integrates StatusProtectionSystem into Express.js middleware pipeline
 */

const logger = require('../lib/app-logger');

const StatusProtectionSystem = require('../../src/core/StatusProtectionSystem');

/**
 * Create status protection middleware
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware function
 */
function createStatusProtectionMiddleware(options = {}) {
  const {
    enabled = true,
    logCorrections = true,
    applyToRoutes = ['/api/roadmap', '/api/development-roadmap'],
    contentType = 'application/json'
  } = options;

  const protectionSystem = new StatusProtectionSystem();

  return async function statusProtectionMiddleware(req, res, next) {
    // Skip if protection is disabled
    if (!enabled) {
      return next();
    }

    // Only process relevant routes and content types
    const isRelevantRoute = applyToRoutes.some(route => req.path.startsWith(route));
    const isJsonContent = req.headers['content-type']?.includes(contentType);

    if (!isRelevantRoute || !isJsonContent || req.method !== 'POST') {
      return next();
    }

    try {
      // Check if this is roadmap data
      const isRoadmapData = req.body && (
        req.body.type === 'development-roadmap-report' ||
        req.body.title === 'Development Roadmap Report' ||
        (req.body.timeline && Array.isArray(req.body.timeline))
      );

      if (!isRoadmapData) {
        return next();
      }

      // Apply status protection
      const originalData = JSON.parse(JSON.stringify(req.body));
      const correctedData = await protectionSystem.validateAndCorrectData(req.body);

      // Check if corrections were made
      const correctionsMade = JSON.stringify(originalData) !== JSON.stringify(correctedData);

      if (correctionsMade) {
        // Log the correction
        if (logCorrections) {
          logger.debug('🔒 Status Protection Middleware: Applied corrections to roadmap data');
          logger.debug(`   Path: ${req.path}`);
          logger.debug(`   Method: ${req.method}`);
          logger.debug(`   Corrections: Detected and applied automatically`);
        }

        // Update request body with corrected data
        req.body = correctedData;

        // Add correction header for transparency
        res.setHeader('X-Status-Protection-Applied', 'true');
        res.setHeader('X-Status-Protection-Timestamp', new Date().toISOString());
      }

      next();

    } catch (error) {
      console.error('Status Protection Middleware Error:', error.message);
      
      // Don't block the request, just log the error
      if (logCorrections) {
        logger.debug('🔒 Status Protection Middleware: Error processing request, continuing without correction');
      }
      
      next();
    }
  };
}

/**
 * Status protection middleware factory
 */
module.exports = {
  createStatusProtectionMiddleware,
  
  // Pre-configured middleware for common use cases
  roadmapProtection: createStatusProtectionMiddleware({
    applyToRoutes: ['/api/roadmap', '/api/development-roadmap', '/roadmap'],
    logCorrections: true
  }),
  
  // Strict protection for all JSON endpoints
  strictProtection: createStatusProtectionMiddleware({
    applyToRoutes: ['/api/'],
    logCorrections: true
  }),
  
  // Silent protection (no logging)
  silentProtection: createStatusProtectionMiddleware({
    applyToRoutes: ['/api/roadmap', '/api/development-roadmap'],
    logCorrections: false
  })
};
