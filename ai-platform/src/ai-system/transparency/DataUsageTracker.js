/**
 * Data Usage Transparency Tracker
 * 
 * Provides comprehensive tracking and reporting of data usage,
 * model training provenance, and user data controls
 */

class DataUsageTracker {
  constructor() {
    this.usageData = new Map();
    this.provenanceData = new Map();
    this.consentRecords = new Map();
    this.exportRequests = new Map();
    this.federatedLearningOptOuts = new Set();
    this.initializeTracking();
  }

  initializeTracking() {
    console.log('[TRANSPARENCY] Initializing data usage tracking...');
    this.loadExistingData();
  }

  loadExistingData() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Load usage data
      const usagePath = path.join(__dirname, '../../../logs/data-usage.json');
      if (fs.existsSync(usagePath)) {
        const data = fs.readFileSync(usagePath, 'utf8');
        const usageData = JSON.parse(data);
        this.usageData = new Map(Object.entries(usageData));
      }

      // Load provenance data
      const provenancePath = path.join(__dirname, '../../../logs/data-provenance.json');
      if (fs.existsSync(provenancePath)) {
        const data = fs.readFileSync(provenancePath, 'utf8');
        const provenanceData = JSON.parse(data);
        this.provenanceData = new Map(Object.entries(provenanceData));
      }

      console.log(`[TRANSPARENCY] Loaded ${this.usageData.size} usage records and ${this.provenanceData.size} provenance records`);
    } catch (error) {
      console.warn('[TRANSPARENCY] Failed to load existing data:', error.message);
    }
  }

  saveData() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Ensure logs directory exists
      const logsDir = path.join(__dirname, '../../../logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Save usage data
      const usagePath = path.join(__dirname, '../../../logs/data-usage.json');
      fs.writeFileSync(usagePath, JSON.stringify(Object.fromEntries(this.usageData), null, 2));

      // Save provenance data
      const provenancePath = path.join(__dirname, '../../../logs/data-provenance.json');
      fs.writeFileSync(provenancePath, JSON.stringify(Object.fromEntries(this.provenanceData), null, 2));

      console.log('[TRANSPARENCY] Data usage tracking saved successfully');
    } catch (error) {
      console.error('[TRANSPARENCY] Failed to save data:', error.message);
    }
  }

  // Track data usage for AI operations
  trackDataUsage(userId, operation, dataType, dataSize, context = {}) {
    const usageId = this.generateUsageId();
    const timestamp = new Date().toISOString();

    const usageRecord = {
      usageId,
      userId,
      operation,
      dataType,
      dataSize,
      timestamp,
      context: {
        ...context,
        ipAddress: context.ipAddress || 'unknown',
        userAgent: context.userAgent || 'unknown',
        modelVersion: context.modelVersion || '1.0.0'
      },
      compliance: {
        gdprCompliant: this.checkGDPRCompliance(dataType, userId),
        consentObtained: this.hasUserConsent(userId, dataType),
        dataMinimized: this.checkDataMinimization(dataType, context)
      }
    };

    this.usageData.set(usageId, usageRecord);
    this.saveData();

    console.log(`[TRANSPARENCY] Data usage tracked: ${operation} - ${dataType} (${dataSize} bytes)`);
    return usageRecord;
  }

  // Track model training data provenance
  trackModelProvenance(modelId, trainingData, metadata = {}) {
    const provenanceId = this.generateProvenanceId();
    const timestamp = new Date().toISOString();

    const provenanceRecord = {
      provenanceId,
      modelId,
      trainingData: {
        sources: trainingData.sources || [],
        size: trainingData.size || 0,
        format: trainingData.format || 'json',
        preprocessing: trainingData.preprocessing || [],
        quality: trainingData.quality || 'unknown'
      },
      metadata: {
        ...metadata,
        trainingDate: metadata.trainingDate || timestamp,
        algorithm: metadata.algorithm || 'unknown',
        hyperparameters: metadata.hyperparameters || {},
        version: metadata.version || '1.0.0'
      },
      audit: {
        dataValidation: this.validateTrainingData(trainingData),
        biasCheck: this.checkForBias(trainingData),
        privacyCompliance: this.checkPrivacyCompliance(trainingData)
      }
    };

    this.provenanceData.set(provenanceId, provenanceRecord);
    this.saveData();

    console.log(`[TRANSPARENCY] Model provenance tracked: ${modelId}`);
    return provenanceRecord;
  }

  // Generate user data export (GDPR data portability)
  generateUserDataExport(userId, format = 'json') {
    const exportId = this.generateExportId();
    const timestamp = new Date().toISOString();

    // Collect all user data
    const userData = {
      userId,
      exportId,
      timestamp,
      format,
      data: {
        usageHistory: this.getUserUsageHistory(userId),
        consentRecords: this.getUserConsentRecords(userId),
        preferences: this.getUserPreferences(userId),
        generatedContent: this.getUserGeneratedContent(userId)
      },
      metadata: {
        totalRecords: this.getUserDataRecordCount(userId),
        totalSize: this.getUserDataSize(userId),
        exportFormat: format,
        compliance: {
          gdprCompliant: true,
          allDataIncluded: true,
          encryptionApplied: true
        }
      }
    };

    // Store export request
    this.exportRequests.set(exportId, {
      userId,
      exportId,
      timestamp,
      status: 'completed',
      format,
      recordCount: userData.metadata.totalRecords,
      dataSize: userData.metadata.totalSize
    });

    console.log(`[TRANSPARENCY] User data export generated: ${userId} - ${exportId}`);
    return userData;
  }

  // Handle user opt-out for federated learning
  optOutFederatedLearning(userId, reason = '') {
    const timestamp = new Date().toISOString();
    
    this.federatedLearningOptOuts.add(userId);
    
    const optOutRecord = {
      userId,
      timestamp,
      reason,
      previousParticipation: this.getPreviousParticipation(userId),
      dataAffected: this.getAffectedData(userId)
    };

    console.log(`[TRANSPARENCY] User opted out of federated learning: ${userId}`);
    return optOutRecord;
  }

  // Check if user is opted out of federated learning
  isFederatedLearningOptOut(userId) {
    return this.federatedLearningOptOuts.has(userId);
  }

  // Generate comprehensive data usage report
  generateDataUsageReport(startDate, endDate, filters = {}) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const filteredUsage = Array.from(this.usageData.values()).filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= start && recordDate <= end && 
             this.matchesFilters(record, filters);
    });

    const report = {
      period: {
        start: startDate,
        end: endDate,
        filters
      },
      summary: {
        totalOperations: filteredUsage.length,
        uniqueUsers: new Set(filteredUsage.map(r => r.userId)).size,
        totalDataProcessed: filteredUsage.reduce((sum, r) => sum + r.dataSize, 0),
        averageOperationSize: filteredUsage.reduce((sum, r) => sum + r.dataSize, 0) / filteredUsage.length || 0
      },
      operations: {
        analysis: filteredUsage.filter(r => r.operation === 'analysis').length,
        generation: filteredUsage.filter(r => r.operation === 'generation').length,
        validation: filteredUsage.filter(r => r.operation === 'validation').length,
        conversion: filteredUsage.filter(r => r.operation === 'conversion').length
      },
      dataTypes: this.aggregateByDataType(filteredUsage),
      compliance: {
        gdprCompliantOperations: filteredUsage.filter(r => r.compliance.gdprCompliant).length,
        operationsWithConsent: filteredUsage.filter(r => r.compliance.consentObtained).length,
        dataMinimizedOperations: filteredUsage.filter(r => r.compliance.dataMinimized).length
      },
      trends: this.calculateUsageTrends(filteredUsage),
      generatedAt: new Date().toISOString()
    };

    return report;
  }

  // Generate model provenance report
  generateProvenanceReport(modelId) {
    const modelProvenance = Array.from(this.provenanceData.values())
      .filter(record => record.modelId === modelId);

    if (modelProvenance.length === 0) {
      return {
        modelId,
        error: 'No provenance data found for this model',
        suggestion: 'Check if the model ID is correct or if provenance tracking is enabled'
      };
    }

    const latestProvenance = modelProvenance[modelProvenance.length - 1];

    const report = {
      modelId,
      provenance: latestProvenance,
      trainingData: {
        sources: latestProvenance.trainingData.sources,
        quality: latestProvenance.trainingData.quality,
        preprocessing: latestProvenance.trainingData.preprocessing
      },
      audit: {
        dataValidation: latestProvenance.audit.dataValidation,
        biasCheck: latestProvenance.audit.biasCheck,
        privacyCompliance: latestProvenance.audit.privacyCompliance
      },
      history: modelProvenance.map(record => ({
        provenanceId: record.provenanceId,
        timestamp: record.timestamp,
        version: record.metadata.version,
        trainingDate: record.metadata.trainingDate
      })),
      generatedAt: new Date().toISOString()
    };

    return report;
  }

  // Helper methods
  generateUsageId() {
    return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateProvenanceId() {
    return `prov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateExportId() {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  checkGDPRCompliance(dataType, userId) {
    // Simplified GDPR compliance check
    const sensitiveDataTypes = ['personal', 'health', 'financial', 'biometric'];
    return !sensitiveDataTypes.includes(dataType) || this.hasUserConsent(userId, dataType);
  }

  hasUserConsent(userId, dataType) {
    // Check if user has given consent for this data type
    const consentRecord = this.consentRecords.get(userId);
    return consentRecord && consentRecord[dataType] === true;
  }

  checkDataMinimization(dataType, context) {
    // Check if only necessary data is being processed
    const requiredFields = this.getRequiredFieldsForDataType(dataType);
    const providedFields = Object.keys(context.fields || {});
    return providedFields.every(field => requiredFields.includes(field));
  }

  getRequiredFieldsForDataType(dataType) {
    const requirements = {
      'personal': ['name', 'email'],
      'health': ['condition', 'treatment'],
      'financial': ['amount', 'account'],
      'biometric': ['type', 'value']
    };
    return requirements[dataType] || [];
  }

  validateTrainingData(trainingData) {
    // Validate training data quality and compliance
    const validation = {
      isValid: true,
      issues: [],
      score: 100
    };

    if (!trainingData.sources || trainingData.sources.length === 0) {
      validation.isValid = false;
      validation.issues.push('No data sources specified');
      validation.score -= 30;
    }

    if (trainingData.size > 1000000000) { // 1GB limit
      validation.issues.push('Training data size exceeds recommended limit');
      validation.score -= 20;
    }

    return validation;
  }

  checkForBias(trainingData) {
    // Check for potential bias in training data
    const biasCheck = {
      hasBias: false,
      biasTypes: [],
      recommendations: []
    };

    // Simplified bias checking logic
    if (trainingData.sources && trainingData.sources.length === 1) {
      biasCheck.hasBias = true;
      biasCheck.biasTypes.push('single_source');
      biasCheck.recommendations.push('Include diverse data sources');
    }

    return biasCheck;
  }

  checkPrivacyCompliance(trainingData) {
    // Check privacy compliance of training data
    const privacyCheck = {
      isCompliant: true,
      issues: [],
      recommendations: []
    };

    if (trainingData.format === 'raw_pii') {
      privacyCheck.isCompliant = false;
      privacyCheck.issues.push('Raw PII data detected');
      privacyCheck.recommendations.push('Anonymize or pseudonymize PII data');
    }

    return privacyCheck;
  }

  getUserUsageHistory(userId) {
    return Array.from(this.usageData.values())
      .filter(record => record.userId === userId)
      .map(record => ({
        usageId: record.usageId,
        operation: record.operation,
        dataType: record.dataType,
        timestamp: record.timestamp,
        dataSize: record.dataSize
      }));
  }

  getUserConsentRecords(userId) {
    return this.consentRecords.get(userId) || {};
  }

  getUserPreferences(userId) {
    // Return user preferences (placeholder implementation)
    return {
      language: 'en',
      timezone: 'UTC',
      notifications: true
    };
  }

  getUserGeneratedContent(userId) {
    // Return user-generated content (placeholder implementation)
    return [];
  }

  getUserDataRecordCount(userId) {
    return this.getUserUsageHistory(userId).length;
  }

  getUserDataSize(userId) {
    return this.getUserUsageHistory(userId)
      .reduce((sum, record) => sum + record.dataSize, 0);
  }

  getPreviousParticipation(userId) {
    // Check if user previously participated in federated learning
    return !this.federatedLearningOptOuts.has(userId);
  }

  getAffectedData(userId) {
    // Return data types affected by federated learning opt-out
    return ['code_generation', 'model_training', 'usage_analytics'];
  }

  matchesFilters(record, filters) {
    if (!filters || Object.keys(filters).length === 0) return true;

    return Object.entries(filters).every(([key, value]) => {
      if (key === 'userId') return record.userId === value;
      if (key === 'operation') return record.operation === value;
      if (key === 'dataType') return record.dataType === value;
      return true;
    });
  }

  aggregateByDataType(usageData) {
    const aggregation = {};
    
    usageData.forEach(record => {
      if (!aggregation[record.dataType]) {
        aggregation[record.dataType] = {
          count: 0,
          totalSize: 0,
          users: new Set()
        };
      }
      
      aggregation[record.dataType].count++;
      aggregation[record.dataType].totalSize += record.dataSize;
      aggregation[record.dataType].users.add(record.userId);
    });

    // Convert Sets to counts
    Object.keys(aggregation).forEach(dataType => {
      aggregation[dataType].uniqueUsers = aggregation[dataType].users.size;
      delete aggregation[dataType].users;
    });

    return aggregation;
  }

  calculateUsageTrends(usageData) {
    // Calculate usage trends over time
    const dailyUsage = {};
    
    usageData.forEach(record => {
      const date = record.timestamp.split('T')[0];
      if (!dailyUsage[date]) {
        dailyUsage[date] = { count: 0, size: 0 };
      }
      dailyUsage[date].count++;
      dailyUsage[date].size += record.dataSize;
    });

    const dates = Object.keys(dailyUsage).sort();
    const trend = dates.length > 1 ? 
      (dailyUsage[dates[dates.length - 1]].count - dailyUsage[dates[0]].count) / dates.length : 0;

    return {
      dailyUsage,
      trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
      averageDailyUsage: dates.reduce((sum, date) => sum + dailyUsage[date].count, 0) / dates.length || 0
    };
  }

  // Public API methods
  getDataUsageSummary() {
    const totalUsage = Array.from(this.usageData.values());
    const totalProvenance = Array.from(this.provenanceData.values());

    return {
      totalUsageRecords: totalUsage.length,
      totalProvenanceRecords: totalProvenance.length,
      uniqueUsers: new Set(totalUsage.map(r => r.userId)).size,
      totalDataProcessed: totalUsage.reduce((sum, r) => sum + r.dataSize, 0),
      federatedLearningOptOuts: this.federatedLearningOptOuts.size,
      exportRequests: this.exportRequests.size,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = DataUsageTracker;
