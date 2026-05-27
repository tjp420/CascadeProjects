/**
 * Analysis API Routes
 * 
 * Complete API routes for mock data analysis functionality
 * with middleware integration and error handling
 */

const express = require('express');
const AnalysisController = require('./AnalysisController');
const authMiddleware = require('../../middleware/auth');
const rateLimitMiddleware = require('../../middleware/rateLimit');
const validationMiddleware = require('../../middleware/validation');
const loggingMiddleware = require('../../middleware/logging');

class AnalysisRoutes {
  constructor() {
    this.router = express.Router();
    this.controller = new AnalysisController();
    this.initializeRoutes();
  }

  // Initialize all routes
  initializeRoutes() {
    // Apply global middleware
    this.router.use(loggingMiddleware);
    this.router.use(authMiddleware.authenticate);
    
    // Analysis job management routes
    this.setupJobRoutes();
    
    // Analysis result routes
    this.setupResultRoutes();
    
    // Analysis management routes
    this.setupManagementRoutes();
    
    // Statistics and monitoring routes
    this.setupMonitoringRoutes();
  }

  // Setup job management routes
  setupJobRoutes() {
    // Create analysis job
    this.router.post('/analysis', 
      rateLimitMiddleware.analysis.create,
      validationMiddleware.validateAnalysisRequest,
      this.controller.createAnalysisJob.bind(this.controller)
    );

    // Get analysis job status
    this.router.get('/analysis/:id',
      rateLimitMiddleware.analysis.read,
      validationMiddleware.validateJobId,
      this.controller.getAnalysisJob.bind(this.controller)
    );

    // Cancel analysis job
    this.router.delete('/analysis/:id',
      rateLimitMiddleware.analysis.delete,
      validationMiddleware.validateJobId,
      this.controller.cancelAnalysisJob.bind(this.controller)
    );

    // List analysis jobs
    this.router.get('/analysis',
      rateLimitMiddleware.analysis.list,
      validationMiddleware.validateListQuery,
      this.controller.listAnalysisJobs.bind(this.controller)
    );

    // Batch analysis
    this.router.post('/analysis/batch',
      rateLimitMiddleware.analysis.batch,
      validationMiddleware.validateBatchRequest,
      this.controller.batchAnalysis.bind(this.controller)
    );
  }

  // Setup result retrieval routes
  setupResultRoutes() {
    // Get analysis results
    this.router.get('/analysis/:id/results',
      rateLimitMiddleware.analysis.read,
      validationMiddleware.validateJobId,
      validationMiddleware.validateResultsQuery,
      this.controller.getAnalysisResults.bind(this.controller)
    );

    // Get analysis patterns
    this.router.get('/analysis/:id/patterns',
      rateLimitMiddleware.analysis.read,
      validationMiddleware.validateJobId,
      validationMiddleware.validatePatternsQuery,
      this.controller.getAnalysisPatterns.bind(this.controller)
    );

    // Get analysis issues
    this.router.get('/analysis/:id/issues',
      rateLimitMiddleware.analysis.read,
      validationMiddleware.validateJobId,
      validationMiddleware.validateIssuesQuery,
      this.controller.getAnalysisIssues.bind(this.controller)
    );

    // Get analysis quality
    this.router.get('/analysis/:id/quality',
      rateLimitMiddleware.analysis.read,
      validationMiddleware.validateJobId,
      this.controller.getAnalysisQuality.bind(this.controller)
    );
  }

  // Setup management routes
  setupManagementRoutes() {
    // Health check (no auth required)
    this.router.get('/analysis/health',
      this.controller.healthCheck.bind(this.controller)
    );

    // System status (admin only)
    this.router.get('/analysis/status',
      authMiddleware.requireRole('admin'),
      rateLimitMiddleware.analysis.read,
      this.controller.getSystemStatus.bind(this.controller)
    );

    // Clear cache (admin only)
    this.router.delete('/analysis/cache',
      authMiddleware.requireRole('admin'),
      rateLimitMiddleware.analysis.delete,
      this.controller.clearCache.bind(this.controller)
    );

    // Restart services (admin only)
    this.router.post('/analysis/restart',
      authMiddleware.requireRole('admin'),
      rateLimitMiddleware.analysis.admin,
      this.controller.restartServices.bind(this.controller)
    );
  }

  // Setup monitoring and statistics routes
  setupMonitoringRoutes() {
    // Get analysis statistics
    this.router.get('/analysis/statistics',
      rateLimitMiddleware.analysis.read,
      validationMiddleware.validateStatsQuery,
      this.controller.getAnalysisStatistics.bind(this.controller)
    );

    // Get performance metrics
    this.router.get('/analysis/metrics',
      rateLimitMiddleware.analysis.read,
      authMiddleware.requireRole('admin'),
      this.controller.getPerformanceMetrics.bind(this.controller)
    );

    // Get error logs (admin only)
    this.router.get('/analysis/logs',
      authMiddleware.requireRole('admin'),
      rateLimitMiddleware.analysis.read,
      validationMiddleware.validateLogsQuery,
      this.controller.getErrorLogs.bind(this.controller)
    );

    // Get usage analytics
    this.router.get('/analysis/analytics',
      rateLimitMiddleware.analysis.read,
      authMiddleware.requireRole('admin'),
      this.controller.getUsageAnalytics.bind(this.controller)
    );
  }

  // Get router instance
  getRouter() {
    return this.router;
  }

  // Error handling middleware
  static errorHandler(error, req, res, _next) {
    console.error('[ANALYSIS_ROUTES] Error:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }

    if (error.name === 'AuthenticationError') {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }

    if (error.name === 'AuthorizationError') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }

    if (error.name === 'RateLimitError') {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id,
          retryAfter: error.retryAfter
        }
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.id
      }
    });
  }

  // 404 handler
  static notFoundHandler(req, res) {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.id,
        path: req.path,
        method: req.method
      }
    });
  }
}

module.exports = AnalysisRoutes;
