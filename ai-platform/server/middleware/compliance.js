/**
 * Compliance Middleware
 * 
 * Implements GDPR, SOC 2, and industry compliance requirements
 * including data encryption, retention policies, and audit trails
 */

const logger = require('../lib/app-logger');

const crypto = require('crypto');
const path = require('path');

// Compliance configuration
const complianceConfig = {
  gdpr: {
    enabled: true,
    dataRetentionDays: 365,
    consentRequired: true,
    rightToDeletion: true,
    dataPortability: true,
    encryptionRequired: true,
    auditRetentionDays: 2555 // 7 years
  },
  soc2: {
    enabled: true,
    auditFrequency: 'quarterly',
    accessControls: true,
    encryptionRequired: true,
    monitoringRequired: true,
    incidentResponse: true,
    riskAssessment: true
  },
  hipaa: {
    enabled: false, // Enable if handling healthcare data
    auditControls: true,
    encryptionRequired: true,
    accessLogs: true,
    businessAssociateAgreements: true
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    keyRotationDays: 90
  }
};

// Data encryption utilities
class ComplianceEncryption {
  constructor() {
    this.algorithm = complianceConfig.encryption.algorithm;
    this.keyLength = complianceConfig.encryption.keyLength;
    this.ivLength = complianceConfig.encryption.ivLength;
    this.tagLength = complianceConfig.encryption.tagLength;
    this.masterKey = this.getOrCreateMasterKey();
  }

  getOrCreateMasterKey() {
    const keyPath = path.join(__dirname, '../config/encryption.key');
    
    try {
      const key = require('fs').readFileSync(keyPath, 'hex');
      return Buffer.from(key, 'hex');
    } catch (error) {
      // Generate new master key
      const newKey = crypto.randomBytes(this.keyLength);
      require('fs').writeFileSync(keyPath, newKey.toString('hex'));
      return newKey;
    }
  }

  encrypt(data) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, this.masterKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: this.algorithm,
      timestamp: new Date().toISOString()
    };
  }

  decrypt(encryptedData) {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipher(this.algorithm, this.masterKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  rotateKey() {
    // Implement key rotation logic
    const newKey = crypto.randomBytes(this.keyLength);
    const keyPath = path.join(__dirname, '../config/encryption.key');
    
    // Backup old key
    const backupPath = `${keyPath}.backup.${Date.now()}`;
    require('fs').copyFileSync(keyPath, backupPath);
    
    // Write new key
    require('fs').writeFileSync(keyPath, newKey.toString('hex'));
    this.masterKey = newKey;
    
    return {
      rotated: true,
      timestamp: new Date().toISOString(),
      backupPath
    };
  }
}

// Data retention manager
class DataRetentionManager {
  constructor() {
    this.retentionDays = complianceConfig.gdpr.dataRetentionDays;
    this.auditRetentionDays = complianceConfig.gdpr.auditRetentionDays;
  }

  async cleanupExpiredData() {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (this.retentionDays * 24 * 60 * 60 * 1000));
    const auditCutoffDate = new Date(now.getTime() - (this.auditRetentionDays * 24 * 60 * 60 * 1000));

    const cleanupResults = {
      userData: await this.cleanupUserData(cutoffDate),
      auditData: await this.cleanupAuditData(auditCutoffDate),
      tempData: await this.cleanupTempData(cutoffDate),
      timestamp: now.toISOString()
    };

    return cleanupResults;
  }

  async cleanupUserData(cutoffDate) {
    // Implementation for cleaning up user data older than cutoff date
    const deletedCount = 0; // Placeholder - implement actual cleanup logic
    return {
      deletedRecords: deletedCount,
      cutoffDate: cutoffDate.toISOString()
    };
  }

  async cleanupAuditData(cutoffDate) {
    // Implementation for cleaning up audit data older than cutoff date
    const deletedCount = 0; // Placeholder - implement actual cleanup logic
    return {
      deletedRecords: deletedCount,
      cutoffDate: cutoffDate.toISOString()
    };
  }

  async cleanupTempData(cutoffDate) {
    // Implementation for cleaning up temporary data
    const deletedCount = 0; // Placeholder - implement actual cleanup logic
    return {
      deletedRecords: deletedCount,
      cutoffDate: cutoffDate.toISOString()
    };
  }
}

// Consent management
class ConsentManager {
  constructor() {
    this.consents = new Map();
    this.loadConsents();
  }

  loadConsents() {
    try {
      const consentPath = path.join(__dirname, '../data/consents.json');
      const data = require('fs').readFileSync(consentPath, 'utf8');
      const consents = JSON.parse(data);
      this.consents = new Map(Object.entries(consents));
    } catch (error) {
      // File doesn't exist yet, start with empty consents
      this.consents = new Map();
    }
  }

  saveConsents() {
    const consentPath = path.join(__dirname, '../data/consents.json');
    const data = JSON.stringify(Object.fromEntries(this.consents), null, 2);
    require('fs').writeFileSync(consentPath, data);
  }

  recordConsent(userId, consentType, consentGiven, ipAddress, userAgent) {
    const consent = {
      userId,
      consentType,
      consentGiven,
      timestamp: new Date().toISOString(),
      ipAddress,
      userAgent,
      version: '1.0'
    };

    if (!this.consents.has(userId)) {
      this.consents.set(userId, {});
    }
    
    this.consents.get(userId)[consentType] = consent;
    this.saveConsents();

    return consent;
  }

  hasConsent(userId, consentType) {
    const userConsents = this.consents.get(userId);
    if (!userConsents) return false;

    const consent = userConsents[consentType];
    return consent && consent.consentGiven;
  }

  withdrawConsent(userId, consentType) {
    const userConsents = this.consents.get(userId);
    if (userConsents && userConsents[consentType]) {
      userConsents[consentType].consentGiven = false;
      userConsents[consentType].withdrawnAt = new Date().toISOString();
      this.saveConsents();
      return true;
    }
    return false;
  }

  exportUserData(userId) {
    // Implementation for GDPR data portability
    const userData = {
      userId,
      consents: this.consents.get(userId) || {},
      exportDate: new Date().toISOString(),
      format: 'json'
    };

    return userData;
  }

  deleteUserData(userId) {
    // Implementation for GDPR right to deletion
    this.consents.delete(userId);
    this.saveConsents();
    
    // Trigger deletion of all user data
    return {
      userId,
      deleted: true,
      timestamp: new Date().toISOString()
    };
  }
}

// Audit compliance
class ComplianceAuditor {
  constructor() {
    this.auditLog = [];
    this.auditPath = path.join(__dirname, '../logs/compliance.json');
    this.loadAuditLog();
  }

  loadAuditLog() {
    try {
      const data = require('fs').readFileSync(this.auditPath, 'utf8');
      this.auditLog = JSON.parse(data);
    } catch (error) {
      this.auditLog = [];
    }
  }

  saveAuditLog() {
    const data = JSON.stringify(this.auditLog, null, 2);
    require('fs').writeFileSync(this.auditPath, data);
  }

  logAccess(userId, resource, action, ipAddress, userAgent) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      userId,
      resource,
      action,
      ipAddress,
      userAgent,
      type: 'access',
      compliance: ['gdpr', 'soc2']
    };

    this.auditLog.push(auditEntry);
    this.saveAuditLog();

    return auditEntry;
  }

  logDataProcessing(userId, dataType, purpose, legalBasis) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      userId,
      dataType,
      purpose,
      legalBasis,
      type: 'data_processing',
      compliance: ['gdpr']
    };

    this.auditLog.push(auditEntry);
    this.saveAuditLog();

    return auditEntry;
  }

  logSecurityIncident(severity, description, affectedSystems, actions) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      severity,
      description,
      affectedSystems,
      actions,
      type: 'security_incident',
      compliance: ['soc2']
    };

    this.auditLog.push(auditEntry);
    this.saveAuditLog();

    return auditEntry;
  }

  generateComplianceReport(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const filteredLogs = this.auditLog.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= start && entryDate <= end;
    });

    const report = {
      period: {
        start: startDate,
        end: endDate
      },
      summary: {
        totalEntries: filteredLogs.length,
        accessLogs: filteredLogs.filter(e => e.type === 'access').length,
        dataProcessingLogs: filteredLogs.filter(e => e.type === 'data_processing').length,
        securityIncidents: filteredLogs.filter(e => e.type === 'security_incident').length
      },
      gdprCompliance: {
        consentRecords: filteredLogs.filter(e => e.compliance.includes('gdpr')).length,
        dataProcessingActivities: filteredLogs.filter(e => e.type === 'data_processing').length
      },
      soc2Compliance: {
        accessControls: filteredLogs.filter(e => e.compliance.includes('soc2')).length,
        securityEvents: filteredLogs.filter(e => e.type === 'security_incident').length
      },
      generatedAt: new Date().toISOString()
    };

    return report;
  }
}

// Initialize compliance components
const encryption = new ComplianceEncryption();
const retentionManager = new DataRetentionManager();
const consentManager = new ConsentManager();
const auditor = new ComplianceAuditor();

// Middleware functions
const complianceMiddleware = {
  // GDPR consent check
  requireConsent: (consentType) => {
    return (req, res, next) => {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User must be authenticated'
        });
      }

      if (!consentManager.hasConsent(userId, consentType)) {
        return res.status(403).json({
          error: 'Consent required',
          message: `User consent for ${consentType} is required`,
          consentType
        });
      }

      // Log access for compliance
      auditor.logAccess(userId, req.path, req.method, req.ip, req.headers['user-agent']);
      next();
    };
  },

  // Data encryption middleware
  encryptSensitiveData: (req, res, next) => {
    if (req.body && req.body.sensitive) {
      try {
        req.body.encrypted = encryption.encrypt(req.body.sensitive);
        delete req.body.sensitive;
      } catch (error) {
        return res.status(500).json({
          error: 'Encryption failed',
          message: 'Failed to encrypt sensitive data'
        });
      }
    }
    next();
  },

  // Data processing audit
  auditDataProcessing: (dataType, purpose, legalBasis) => {
    return (req, res, next) => {
      const userId = req.user?.id;
      if (userId) {
        auditor.logDataProcessing(userId, dataType, purpose, legalBasis);
      }
      next();
    };
  },

  // Security incident logging
  logSecurityIncident: (severity, description, affectedSystems, actions) => {
    auditor.logSecurityIncident(severity, description, affectedSystems, actions);
  }
};

// Compliance utilities
const complianceUtils = {
  // Check if data processing is lawful
  isLawfulProcessing: (userId, _dataType, _purpose) => {
    // Implement lawful processing checks
    return consentManager.hasConsent(userId, 'data_processing');
  },

  // Generate data processing impact assessment
  generateDPIA: (dataType, purpose, recipients, retentionPeriod) => {
    return {
      dataType,
      purpose,
      recipients,
      retentionPeriod,
      riskAssessment: 'medium',
      mitigationMeasures: [
        'Encryption at rest and in transit',
        'Access controls and authentication',
        'Regular security audits',
        'Data minimization principles'
      ],
      generatedAt: new Date().toISOString()
    };
  },

  // Validate data retention compliance
  validateRetention: (dataDate, _dataType) => {
    const retentionDays = complianceConfig.gdpr.dataRetentionDays;
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
    return new Date(dataDate) > cutoffDate;
  },

  // Check for cross-border data transfer compliance
  validateCrossBorderTransfer: (destinationCountry, _dataType) => {
    // Implement cross-border transfer validation
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
    
    return {
      allowed: euCountries.includes(destinationCountry) || destinationCountry === 'US',
      requiresAdequacyDecision: !euCountries.includes(destinationCountry),
      recommendedSafeguards: destinationCountry === 'US' ? ['SCCs', 'BCRs'] : []
    };
  }
};

// Scheduled tasks
const scheduleComplianceTasks = () => {
  // Schedule data cleanup (daily)
  setInterval(async () => {
    try {
      const results = await retentionManager.cleanupExpiredData();
      logger.debug('[COMPLIANCE] Data cleanup completed:', results);
    } catch (error) {
      console.error('[COMPLIANCE] Data cleanup failed:', error);
    }
  }, 24 * 60 * 60 * 1000); // Daily

  // Schedule key rotation (every 90 days)
  setInterval(async () => {
    try {
      const results = encryption.rotateKey();
      logger.debug('[COMPLIANCE] Key rotation completed:', results);
    } catch (error) {
      console.error('[COMPLIANCE] Key rotation failed:', error);
    }
  }, 90 * 24 * 60 * 60 * 1000); // 90 days

  // Schedule compliance reporting (quarterly)
  setInterval(async () => {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (90 * 24 * 60 * 60 * 1000));
      const report = auditor.generateComplianceReport(startDate.toISOString(), endDate.toISOString());
      logger.debug('[COMPLIANCE] Quarterly report generated:', report);
    } catch (error) {
      console.error('[COMPLIANCE] Report generation failed:', error);
    }
  }, 90 * 24 * 60 * 60 * 1000); // Quarterly
};

// Initialize scheduled tasks
scheduleComplianceTasks();

module.exports = {
  complianceConfig,
  complianceMiddleware,
  complianceUtils,
  encryption,
  retentionManager,
  consentManager,
  auditor
};
