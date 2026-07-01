'use strict';

const logger = require('../app-logger.cjs');

function isAuthDebugEnabled() {
  return process.env.LOG_AUTH === 'true' || process.env.AUTH_DEBUG === 'true';
}

function authLog(message) {
  if (isAuthDebugEnabled()) {
    logger.info(message);
  }
}

function authWarn(message) {
  if (isAuthDebugEnabled()) {
    logger.warn(message);
  }
}

function shouldWriteAuditEvents() {
  return process.env.AUDIT_AUTH_LOGS !== 'false';
}

// Audit logging for authentication events
function auditAuth(action, user, req = null) {
  if (typeof action !== 'string') return;
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId: user?.id,
    email: user?.email,
    trustLevel: user?.trustLevel,
    ip: req?.ip,
    userAgent: req?.headers?.['user-agent'],
    requestId: req?.requestId
  };

  if (shouldWriteAuditEvents()) {
    logger.info(`[AUDIT] ${JSON.stringify(auditEntry)}`);
  }
}

module.exports = { isAuthDebugEnabled, authLog, authWarn, shouldWriteAuditEvents, auditAuth };
