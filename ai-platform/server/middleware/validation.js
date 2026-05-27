/**
 * Validation Middleware
 * 
 * Comprehensive validation middleware for API requests
 * with schema validation and error handling
 */

const logger = require('../lib/app-logger');

const Joi = require('joi');

class ValidationMiddleware {
  constructor() {
    this.schemas = new Map();
    this.initializeSchemas();
  }

  // Initialize validation schemas
  initializeSchemas() {
    // Analysis request schema
    this.schemas.set('analysisRequest', Joi.object({
      data: Joi.any().required(),
      analyzer: Joi.string().valid('pattern_detector', 'issue_detector', 'quality_analyzer', 'structure_analyzer', 'content_analyzer', 'performance_analyzer').optional(),
      options: Joi.object().optional()
    }));

    // Batch request schema
    this.schemas.set('batchRequest', Joi.object({
      data: Joi.array().items(Joi.any()).min(1).max(100).required(),
      analyzer: Joi.string().valid('pattern_detector', 'issue_detector', 'quality_analyzer').optional(),
      options: Joi.object({
        batchSize: Joi.number().integer().min(1).max(10).optional()
      }).optional()
    }));

    // List query schema
    this.schemas.set('listQuery', Joi.object({
      status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'cancelled').optional(),
      limit: Joi.number().integer().min(1).max(100).optional(),
      offset: Joi.number().integer().min(0).optional()
    }));

    // Results query schema
    this.schemas.set('resultsQuery', Joi.object({
      format: Joi.string().valid('json', 'summary', 'csv', 'xml').optional(),
      include: Joi.string().optional()
    }));

    // Patterns query schema
    this.schemas.set('patternsQuery', Joi.object({
      confidence: Joi.number().min(0).max(1).optional(),
      category: Joi.string().valid('structure', 'content', 'behavioral', 'quality').optional(),
      limit: Joi.number().integer().min(1).max(1000).optional()
    }));

    // Issues query schema
    this.schemas.set('issuesQuery', Joi.object({
      severity: Joi.string().valid('critical', 'high', 'medium', 'low').optional(),
      category: Joi.string().valid('structure', 'content', 'format', 'quality', 'security', 'performance').optional(),
      resolved: Joi.string().valid('true', 'false').optional(),
      limit: Joi.number().integer().min(1).max(1000).optional()
    }));

    // Statistics query schema
    this.schemas.set('statsQuery', Joi.object({
      period: Joi.string().valid('1h', '24h', '7d', '30d').optional()
    }));

    // Job ID schema
    this.schemas.set('jobId', Joi.string().pattern(/^job_\d+_[a-z0-9]+$/).required());

    logger.debug('[VALIDATION_MIDDLEWARE] Validation schemas initialized');
  }

  // Validate analysis request
  validateAnalysisRequest(req, res, next) {
    const schema = this.schemas.get('analysisRequest');
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
    
    next();
  }

  // Validate batch request
  validateBatchRequest(req, res, next) {
    const schema = this.schemas.get('batchRequest');
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
    
    next();
  }

  // Validate list query
  validateListQuery(req, res, next) {
    const schema = this.schemas.get('listQuery');
    const { error } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
    
    next();
  }

  // Validate results query
  validateResultsQuery(req, res, next) {
    const schema = this.schemas.get('resultsQuery');
    const { error } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
    
    next();
  }

  // Validate patterns query
  validatePatternsQuery(req, res, next) {
    const schema = this.schemas.get('patternsQuery');
    const { error } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
    
    next();
  }

  // Validate issues query
  validateIssuesQuery(req, res, next) {
    const schema = this.schemas.get('issuesQuery');
    const { error } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
    
    next();
  }

  // Validate statistics query
  validateStatsQuery(req, res, next) {
    const schema = this.schemas.get('statsQuery');
    const { error } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
    
    next();
  }

  // Validate job ID
  validateJobId(req, res, next) {
    const schema = this.schemas.get('jobId');
    const { error } = schema.validate(req.params.id);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    }
    
    next();
  }

  // Generic validation middleware
  validate(schemaName) {
    return (req, res, next) => {
      const schema = this.schemas.get(schemaName);
      if (!schema) {
        return res.status(500).json({
          success: false,
          error: 'Validation schema not found',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }

      const { error } = schema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          })),
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      next();
    };
  }

  // Query validation middleware
  validateQuery(schemaName) {
    return (req, res, next) => {
      const schema = this.schemas.get(schemaName);
      if (!schema) {
        return res.status(500).json({
          success: false,
          error: 'Validation schema not found',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }

      const { error } = schema.validate(req.query);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          })),
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      next();
    };
  }

  // Parameter validation middleware
  validateParams(schemaName) {
    return (req, res, next) => {
      const schema = this.schemas.get(schemaName);
      if (!schema) {
        return res.status(500).json({
          success: false,
          error: 'Validation schema not found',
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }

      const { error } = schema.validate(req.params);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          })),
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.id
          }
        });
      }
      
      next();
    };
  }
}

module.exports = ValidationMiddleware;
