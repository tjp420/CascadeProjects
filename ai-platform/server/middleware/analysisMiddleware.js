/**
 * Analysis Middleware
 * 
 * Custom middleware for analysis API endpoints
 * with logging, validation, and error handling
 */

const logger = require('../lib/app-logger');

const AnalysisController = require('../api/analysis/AnalysisController');

class AnalysisMiddleware {
  constructor() {
    this.controller = new AnalysisController();
  }

  // Request validation middleware
  validateAnalysisRequest(req, res, next) {
    try {
      const { data, analyzer, options } = req.body;
      
      // Validate data
      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Data is required',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Validate analyzer
      const validAnalyzers = ['pattern_detector', 'issue_detector', 'quality_analyzer', 'structure_analyzer', 'content_analyzer', 'performance_analyzer'];
      if (analyzer && !validAnalyzers.includes(analyzer)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid analyzer',
          validAnalyzers,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Validate options
      if (options && typeof options !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Options must be an object',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Check data size
      const dataSize = JSON.stringify(data).length;
      const maxDataSize = 10 * 1024 * 1024; // 10MB
      
      if (dataSize > maxDataSize) {
        return res.status(400).json({
          success: false,
          error: 'Data size exceeds maximum limit',
          maxSize: maxDataSize,
          actualSize: dataSize,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Add validation metadata to request
      req.analysisMetadata = {
        validatedAt: new Date().toISOString(),
        dataSize,
        analyzer: analyzer || 'pattern_detector'
      };
      
      next();
      
    } catch (error) {
      console.error('[ANALYSIS_MIDDLEWARE] Validation error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Validation failed',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Job ID validation middleware
  validateJobId(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Validate job ID format
      if (typeof id !== 'string' || !id.match(/^job_\d+_[a-z0-9]+$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid job ID format',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      next();
      
    } catch (error) {
      console.error('[ANALYSIS_MIDDLEWARE] Job ID validation error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Job ID validation failed',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Results query validation middleware
  validateResultsQuery(req, res, next) {
    try {
      const { format, include } = req.query;
      
      // Validate format
      if (format && !['json', 'summary', 'csv', 'xml'].includes(format)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid format',
          validFormats: ['json', 'summary', 'csv', 'xml'],
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Validate include
      if (include && typeof include === 'string') {
        const validIncludes = ['patterns', 'issues', 'quality', 'metadata'];
        const includes = include.split(',');
        
        for (const inc of includes) {
          if (!validIncludes.includes(inc.trim())) {
            return res.status(400).json({
              success: false,
              error: 'Invalid include parameter',
              validIncludes,
              metadata: {
                timestamp: new Date().toISOString(),
                requestId: req.id
              }
            });
          }
        }
      }
      
      next();
      
    } catch (error) {
      console.error('[ANALYSIS_MIDDLEWARE] Results query validation error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Results query validation failed',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Patterns query validation middleware
  validatePatternsQuery(req, res, next) {
    try {
      const { confidence, category, limit } = req.query;
      
      // Validate confidence
      if (confidence) {
        const conf = parseFloat(confidence);
        if (isNaN(conf) || conf < 0 || conf > 1) {
          return res.status(400).json({
            success: false,
            error: 'Invalid confidence value',
            validRange: '0.0 - 1.0',
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      // Validate category
      if (category) {
        const validCategories = ['structure', 'content', 'behavioral', 'quality'];
        if (!validCategories.includes(category)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid category',
            validCategories,
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      // Validate limit
      if (limit) {
        const lim = parseInt(limit);
        if (isNaN(lim) || lim < 1 || lim > 1000) {
          return res.status(400).json({
            success: false,
            error: 'Invalid limit value',
            validRange: '1 - 1000',
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      next();
      
    } catch (error) {
      console.error('[ANALYSIS_MIDDLEWARE] Patterns query validation error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Patterns query validation failed',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Issues query validation middleware
  validateIssuesQuery(req, res, next) {
    try {
      const { severity, category, resolved, limit } = req.query;
      
      // Validate severity
      if (severity) {
        const validSeverities = ['critical', 'high', 'medium', 'low'];
        if (!validSeverities.includes(severity)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid severity',
            validSeverities,
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      // Validate category
      if (category) {
        const validCategories = ['structure', 'content', 'format', 'quality', 'security', 'performance'];
        if (!validCategories.includes(category)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid category',
            validCategories,
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      // Validate resolved
      if (resolved && !['true', 'false'].includes(resolved)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid resolved value',
          validValues: ['true', 'false'],
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Validate limit
      if (limit) {
        const lim = parseInt(limit);
        if (isNaN(lim) || lim < 1 || lim > 1000) {
          return res.status(400).json({
            success: false,
            error: 'Invalid limit value',
            validRange: '1 - 1000',
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      next();
      
    } catch (error) {
      console.error('[ANALYSIS_MIDDLEWARE] Issues query validation error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Issues query validation failed',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // List query validation middleware
  validateListQuery(req, res, next) {
    try {
      const { status, limit, offset } = req.query;
      
      // Validate status
      if (status) {
        const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid status',
            validStatuses,
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      // Validate limit
      if (limit) {
        const lim = parseInt(limit);
        if (isNaN(lim) || lim < 1 || lim > 100) {
          return res.status(400).json({
            success: false,
            error: 'Invalid limit value',
            validRange: '1 - 100',
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      // Validate offset
      if (offset) {
        const off = parseInt(offset);
        if (isNaN(off) || off < 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid offset value',
            validRange: '0+',
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      next();
      
    } catch (error) {
      console.error('[ANALYSIS_MIDDLEWARE] List query validation error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'List query validation failed',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Batch request validation middleware
  validateBatchRequest(req, res, next) {
    try {
      const { data, analyzer, options } = req.body;
      
      // Validate data array
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Data array is required and must not be empty',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Validate array size
      if (data.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Batch size exceeds maximum limit',
          maxBatchSize: 100,
          actualBatchSize: data.length,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Validate individual data items
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item || typeof item !== 'object') {
          return res.status(400).json({
            success: false,
            error: `Invalid data item at index ${i}`,
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      // Validate analyzer
      const validAnalyzers = ['pattern_detector', 'issue_detector', 'quality_analyzer'];
      if (analyzer && !validAnalyzers.includes(analyzer)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid analyzer for batch analysis',
          validAnalyzers,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Validate options
      if (options && typeof options !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Options must be an object',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Validate batch size option
      if (options.batchSize && (options.batchSize < 1 || options.batchSize > 10)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid batch size',
          validRange: '1 - 10',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      // Add batch metadata to request
      req.batchMetadata = {
        validatedAt: new Date().toISOString(),
        batchSize: data.length,
        analyzer: analyzer || 'pattern_detector'
      };
      
      next();
      
    } catch (error) {
      console.error('[ANALYSIS_MIDDLEWARE] Batch request validation error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Batch request validation failed',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Statistics query validation middleware
  validateStatsQuery(req, res, next) {
    try {
      const { period } = req.query;
      
      // Validate period
      if (period) {
        const validPeriods = ['1h', '24h', '7d', '30d'];
        if (!validPeriods.includes(period)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid period',
            validPeriods,
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.id
            }
          });
        }
      }
      
      next();
      
    } catch (error) {
      console.error('[ANALYSIS_MIDDLEWARE] Statistics query validation error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Statistics query validation failed',
        details: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
  }

  // Response formatting middleware
  formatResponse(req, res, next) {
    // Override res.json to add standard metadata
    const originalJson = res.json;
    
    res.json = function(data) {
      const formattedData = {
        ...data,
        metadata: {
          ...data.metadata,
          timestamp: new Date().toISOString(),
          requestId: req.id,
          version: '1.0.0'
        }
      };
      
      return originalJson.call(this, formattedData);
    };
    
    next();
  }

  // Request logging middleware
  logRequest(req, res, next) {
    const startTime = Date.now();
    
    // Log request start
    logger.debug(`[ANALYSIS_MIDDLEWARE] ${req.method} ${req.path} - Request started`, {
      requestId: req.id,
      user: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(data) {
      const processingTime = Date.now() - startTime;
      
      // Log response
      logger.debug(`[ANALYSIS_MIDDLEWARE] ${req.method} ${req.path} - Request completed`, {
        requestId: req.id,
        user: req.user?.id,
        success: data.success,
        processingTime,
        timestamp: new Date().toISOString()
      });
      
      return originalJson.call(this, data);
    };
    
    // Log errors
    res.on('error', (error) => {
      const processingTime = Date.now() - startTime;
      
      console.error(`[ANALYSIS_MIDDLEWARE] ${req.method} ${req.path} - Request failed`, {
        requestId: req.id,
        user: req.user?.id,
        error: error.message,
        processingTime,
        timestamp: new Date().toISOString()
      });
    });
    
    next();
  }

  // Error handling middleware
  errorHandler(error, req, res, _next) {
    console.error('[ANALYSIS_MIDDLEWARE] Error:', error);
    
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
  notFoundHandler(req, res) {
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

module.exports = AnalysisMiddleware;
