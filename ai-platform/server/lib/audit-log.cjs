const fs = require('fs');
const path = require('path');

const AUDIT_LOG_PATH = process.env.AUDIT_LOG_STORE || path.join(__dirname, '../../.simplebeacon/audit.log');

function logAuditEvent(event) {
  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event: event.name,
    sessionId: event.sessionId,
    issuer: event.issuer,
    clientIp: event.clientIp,
    status: event.status || 'SUCCESS',
    details: event.details || null
  }) + '\n';

  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true });
    fs.appendFileSync(AUDIT_LOG_PATH, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to append to immutable audit log:', err);
  }
}

module.exports = { logAuditEvent, AUDIT_LOG_PATH };
