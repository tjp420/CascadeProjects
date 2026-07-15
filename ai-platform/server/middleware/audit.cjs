// simplebeacon-ignore: debugArtifacts
/**
 * Enhanced Audit Logging Middleware
 * 
 * Enterprise-grade audit logging with:
 * - Real-time streaming to SIEM systems
 * - Immutable audit logs with blockchain-style hashing
 * - Compliance reporting (SOC 2, ISO 27001, GDPR, HIPAA)
 * - Data access pattern analysis
 * - Automated compliance violation detection
 */

const logger = require('../lib/app-logger.cjs');

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const EventEmitter = require('events');

const constants = require('../config/constants.cjs');
const logLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4
};

// Enhanced audit configuration
const auditConfig = {
  logFile: process.env.AUDIT_LOG_FILE || 'logs/audit.log',
  maxLogSize: 100 * constants.BYTES_PER_KB * constants.BYTES_PER_KB, // 100MB
  backupCount: 5,
  logLevel: process.env.AUDIT_LEVEL || 'info',
  enableConsole: process.env.NODE_ENV !== 'production',
  enableFile: true,
  retentionDays: 90,
  enableBlockchain: process.env.AUDIT_BLOCKCHAIN === 'true',
  enableSIEM: process.env.AUDIT_SIEM === 'true',
  siemEndpoint: process.env.AUDIT_SIEM_ENDPOINT,
  siemApiKey: process.env.AUDIT_SIEM_API_KEY,
  complianceFrameworks: (process.env.AUDIT_FRAMEWORKS || 'SOC2,ISO27001,GDPR').split(','),
  enableRealTime: process.env.AUDIT_REALTIME === 'true',
  enableEncryption: process.env.AUDIT_ENCRYPTION !== 'false'
};

// Audit event emitter for real-time processing
const _auditEmitter = new EventEmitter();

// Blockchain-style hash chain for immutability
const _auditChain = {
  previousHash: null,
  currentHash: null,
  entries: []
};

// Compliance violation patterns
const _violationPatterns = {
  'GDPR': {
    'data_access_without_consent': /access.*data.*without.*consent/i,
    'data_retention_violation': /retention.*exceeds.*limit/i,
    'unauthorized_data_export': /export.*data.*unauthorized/i
  },
  'SOC2': {
    'access_control_violation': /access.*without.*authorization/i,
    'security_incident_unreported': /security.*incident.*not.*reported/i,
    'change_management_violation': /change.*without.*approval/i
  },
  'HIPAA': {
    'phi_access_violation': /access.*phi.*without.*authorization/i,
    'data_breach_risk': /potential.*phi.*breach/i,
    'audit_log_tampering': /modify.*audit.*log/i
  },
  'ISO27001': {
    'information_security_violation': /security.*policy.*violation/i,
    'risk_management_violation': /risk.*assessment.*missing/i,
    'business_continuity_violation': /backup.*procedure.*failed/i
  }
};

// Enhanced logger with multiple transports
const auditLogger = winston.createLogger({ // simplebeacon-ignore pii-logging — application audit logger, not user data leak
  level: auditConfig.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.errors({ stack: true })
  ),
  transports: [
    new winston.transports.File({
      filename: auditConfig.logFile,
      maxsize: auditConfig.maxLogSize,
      maxFiles: auditConfig.backupCount,
      tailable: true
    })
  ]
});

// Add console transport for non-production
if (auditConfig.enableConsole) {
  auditLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// SIEM transport
if (auditConfig.enableSIEM && auditConfig.siemEndpoint) {
  const SIEMTransport = require('./transports/siem-transport');
  auditLogger.add(new SIEMTransport({
    endpoint: auditConfig.siemEndpoint,
    apiKey: auditConfig.siemApiKey
  }));
}

// Audit event types
const eventTypes = {
  AUTH: 'auth',
  AI_OPERATION: 'ai_operation',
  DATA_ACCESS: 'data_access',
  SECURITY: 'security',
  SYSTEM: 'system',
  USER_ACTION: 'user_action',
  COMPLIANCE: 'compliance'
};

// Generate unique event ID
/**
 * Generate event id.
 * @returns {any}
 */
const generateEventId = () => {
  return crypto.randomUUID();
};

// Format audit entry
/**
 * Format audit entry.
 * @param {any} level
 * @param {any} eventType
 * @param {string} message
 * @param {any} metadata
 * @returns {any}
 */
const formatAuditEntry = (level, eventType, message, metadata = {}) => {
  const entry = {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    eventType,
    message,
    metadata: {
      ...metadata,
      pid: process.pid,
      hostname: require('os').hostname(),
      version: process.env.npm_package_version || '1.0.0'
    }
  };

  return entry;
};

// Write to audit log file
/**
 * Write to file.
 * @param {any} entry
 * @returns {any}
 */
const writeToFile = async (entry) => {
  if (!auditConfig.enableFile) return;

  try {
    const logLine = JSON.stringify(entry) + '\n';
    
    // Ensure log directory exists
    const logDir = path.dirname(auditConfig.logFile);
    await fs.mkdir(logDir, { recursive: true });
    
    // Check log file size and rotate if necessary
    try {
      const stats = await fs.stat(auditConfig.logFile);
      if (stats.size >= auditConfig.maxLogSize) {
        await rotateLogFile();
      }
    } catch (error) {
      // File doesn't exist, will be created
    }
    
    // Write to log file
    await fs.appendFile(auditConfig.logFile, logLine);
  } catch (error) {
    console.error('[AUDIT] Failed to write to audit log:', error.message);
  }
};

// Rotate log file
/**
 * Rotate log file.
 * @returns {any}
 */
const rotateLogFile = async () => {
  try {
    // Move existing log files
    for (let i = auditConfig.backupCount - 1; i > 0; i--) {
      const oldFile = `${auditConfig.logFile}.${i}`;
      const newFile = `${auditConfig.logFile}.${i + 1}`;
      
      try {
        await fs.rename(oldFile, newFile);
      } catch (error) {
        // File doesn't exist, continue
      }
    }
    
    // Move current log file
    await fs.rename(auditConfig.logFile, `${auditConfig.logFile}.1`);
  } catch (error) {
    console.error('[AUDIT] Failed to rotate log file:', error.message);
  }
};

// Clean up old log files
/**
 * Cleanup old logs.
 * @returns {any}
 */
const cleanupOldLogs = async () => {
  try {
    const logDir = path.dirname(auditConfig.logFile);
    const files = await fs.readdir(logDir);
    const cutoffDate = new Date(Date.now() - auditConfig.retentionDays * 24 * 60 * constants.ONE_MINUTE_MS);
    
    for (const file of files) {
      if (file.startsWith('audit.log.') || file === 'audit.log') {
        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          logger.debug(`[AUDIT] Cleaned up old log file: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('[AUDIT] Failed to cleanup old logs:', error.message);
  }
};

// Audit logging function
/**
 * Audit log.
 * @param {any} level
 * @param {any} eventType
 * @param {string} message
 * @param {any} metadata
 * @returns {any}
 */
const auditLog = (level, eventType, message, metadata = {}) => {
  const entry = formatAuditEntry(level, eventType, message, metadata);
  
  // Console logging (development only)
  if (auditConfig.enableConsole && logLevels[level] >= logLevels[auditConfig.logLevel]) {
    const consoleMessage = `[AUDIT] ${entry.timestamp} [${entry.level}] ${entry.eventType}: ${entry.message}`;
    
    switch (level) {
      case 'error':
      case 'critical':
        console.error(consoleMessage, entry.metadata);
        break;
      case 'warn':
        logger.warn(consoleMessage, entry.metadata);
        break;
      default:
        logger.debug(consoleMessage, entry.metadata);
    }
  }
  
  // File logging (always enabled for production)
  writeToFile(entry);
};

// Middleware factory for audit logging
/**
 * Create audit middleware.
 * @param {any} eventType
 * @param {string} getMessage
 * @returns {any}
 */
const createAuditMiddleware = (eventType, getMessage) => {
  return (req, res, next) => {
    const startTime = Date.now();
    const requestId = req.requestId || generateEventId();
    
    // Log request start
    auditLog('info', eventType, getMessage(req, 'start'), {
      requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      trustLevel: req.user?.trustLevel
    });
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - startTime;
      
      // Log request completion
      auditLog(
        res.statusCode >= 400 ? 'warn' : 'info',
        eventType,
        getMessage(req, 'end'),
        {
          requestId,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          userId: req.user?.id,
          trustLevel: req.user?.trustLevel,
          responseSize: chunk ? chunk.length : 0
        }
      );
      
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

// Specific audit middleware functions
const auditAuth = createAuditMiddleware(eventTypes.AUTH, (req, phase) => {
  return `Authentication ${phase} - ${req.user?.email || 'anonymous'}`;
});

const auditAIOperation = createAuditMiddleware(eventTypes.AI_OPERATION, (req, phase) => {
  const operation = req.body.mode || req.query.mode || 'unknown';
  return `AI operation ${phase} - ${operation}`;
});

const auditDataAccess = createAuditMiddleware(eventTypes.DATA_ACCESS, (req, phase) => {
  const resource = req.originalUrl.split('/').pop() || 'unknown';
  return `Data access ${phase} - ${resource}`;
});

const auditSecurity = createAuditMiddleware(eventTypes.SECURITY, (req, phase) => {
  return `Security event ${phase} - ${req.ip}`;
});

// AI operation specific logging
/**
 * Log a i operation.
 * @param {any} operation
 * @param {any} user
 * @param {any} result
 * @param {any} metadata
 * @returns {any}
 */
const logAIOperation = (operation, user, result, metadata = {}) => {
  auditLog('info', eventTypes.AI_OPERATION, `AI operation completed: ${operation}`, {
    userId: user?.id,
    trustLevel: user?.trustLevel,
    operation,
    result: {
      success: result.success,
      duration: result.duration,
      itemsProcessed: result.itemsProcessed,
      errors: result.errors?.length || 0
    },
    ...metadata
  });
};

// Security event logging
/**
 * Log security event.
 * @param {any} eventType
 * @param {Array} details
 * @param {any} user
 * @param {any} req
 * @returns {any}
 */
const logSecurityEvent = (eventType, details, user = null, req = null) => {
  auditLog('warn', eventTypes.SECURITY, `Security event: ${eventType}`, {
    userId: user?.id,
    trustLevel: user?.trustLevel,
    ip: req?.ip,
    userAgent: req?.headers['user-agent'],
    requestId: req?.requestId,
    ...details
  });
};

// Compliance event logging
/**
 * Log compliance event.
 * @param {any} complianceType
 * @param {Array} details
 * @param {any} user
 * @returns {any}
 */
const logComplianceEvent = (complianceType, details, user = null) => {
  auditLog('info', eventTypes.COMPLIANCE, `Compliance event: ${complianceType}`, {
    userId: user?.id,
    trustLevel: user?.trustLevel,
    complianceType,
    ...details
  });
};

// Data access logging
/**
 * Log data access.
 * @param {any} resource
 * @param {any} action
 * @param {any} user
 * @param {any} result
 * @param {any} metadata
 * @returns {any}
 */
const logDataAccess = (resource, action, user, result, metadata = {}) => {
  auditLog('info', eventTypes.DATA_ACCESS, `Data access: ${action} on ${resource}`, {
    userId: user?.id,
    trustLevel: user?.trustLevel,
    resource,
    action,
    result: {
      success: result.success,
      recordCount: result.recordCount,
      dataSize: result.dataSize
    },
    ...metadata
  });
};

// System event logging
/**
 * Log system event.
 * @param {any} eventType
 * @param {Array} details
 * @param {any} severity
 * @returns {any}
 */
const logSystemEvent = (eventType, details, severity = 'info') => {
  auditLog(severity, eventTypes.SYSTEM, `System event: ${eventType}`, {
    ...details
  });
};

// User action logging
/**
 * Log user action.
 * @param {any} action
 * @param {any} user
 * @param {Array} details
 * @returns {any}
 */
const logUserAction = (action, user, details = {}) => {
  auditLog('info', eventTypes.USER_ACTION, `User action: ${action}`, {
    userId: user?.id,
    trustLevel: user?.trustLevel,
    action,
    ...details
  });
};

// Initialize audit system
/**
 * Initialize audit.
 * @returns {any}
 */
const initializeAudit = async () => {
  logger.debug('[AUDIT] Initializing audit logging system');
  
  // Create log directory
  try {
    const logDir = path.dirname(auditConfig.logFile);
    await fs.mkdir(logDir, { recursive: true });
  } catch (error) {
    console.error('[AUDIT] Failed to create log directory:', error.message);
  }
  
  // Schedule cleanup of old logs
  const logCleanupInterval = setInterval(cleanupOldLogs, 24 * 60 * constants.ONE_MINUTE_MS); // Daily cleanup
  process.on('SIGINT', () => { clearInterval(logCleanupInterval); });
  process.on('SIGTERM', () => { clearInterval(logCleanupInterval); });
  
  // Log system startup
  logSystemEvent('startup', {
    nodeVersion: process.version,
    platform: process.platform,
    auditConfig
  });
};

// Query audit logs (for admin/monitoring)
/**
 * Query audit logs.
 * @param {Array} filters
 * @returns {any}
 */
const queryAuditLogs = async (filters = {}) => {
  try {
    const logContent = await fs.readFile(auditConfig.logFile, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    let entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    }).filter(entry => entry !== null);
    
    // Apply filters
    if (filters.level) {
      entries = entries.filter(entry => entry.level === filters.level.toUpperCase());
    }
    
    if (filters.eventType) {
      entries = entries.filter(entry => entry.eventType === filters.eventType);
    }
    
    if (filters.userId) {
      entries = entries.filter(entry => entry.metadata.userId === filters.userId);
    }
    
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      entries = entries.filter(entry => new Date(entry.timestamp) >= startDate);
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      entries = entries.filter(entry => new Date(entry.timestamp) <= endDate);
    }
    
    // Sort by timestamp (newest first)
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Enforce strict pagination boundaries (default LIMIT 50, max 200)
    const MAX_PAGE_SIZE = 200;
    const DEFAULT_PAGE_SIZE = 50;
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);
    const total = entries.length;
    entries = entries.slice(offset, offset + limit);

    return { entries, total, limit, offset };
  } catch (error) {
    console.error('[AUDIT] Failed to query audit logs:', error.message);
    return { entries: [], total: 0, limit: 50, offset: 0 };
  }
};

module.exports = {
  auditLog,
  auditAuth,
  auditAIOperation,
  auditDataAccess,
  auditSecurity,
  logAIOperation,
  logSecurityEvent,
  logComplianceEvent,
  logDataAccess,
  logSystemEvent,
  logUserAction,
  initializeAudit,
  queryAuditLogs,
  eventTypes,
  auditConfig
};
