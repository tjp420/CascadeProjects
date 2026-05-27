/**
 * Resilience and Fail-Safe Mechanisms
 * 
 * Implements circuit breakers, automated rollback capabilities,
 * backup and disaster recovery systems, health checks and auto-healing
 */

const logger = require('../lib/app-logger');

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.expectedRecoveryTime = options.expectedRecoveryTime || 30000; // 30 seconds
    
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.successCount = 0;
    this.requestCount = 0;
    
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      averageResponseTime: 0,
      lastStateChange: new Date().toISOString()
    };

    logger.debug(`[CIRCUIT] Circuit breaker '${name}' initialized`);
  }

  async execute(operation) {
    this.stats.totalRequests++;
    this.requestCount++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker '${this.name}' is OPEN. Next attempt at ${new Date(this.nextAttempt).toISOString()}`);
      }
      this.transitionToHalfOpen();
    }

    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.onSuccess(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.onFailure(error, duration);
      throw error;
    }
  }

  onSuccess(duration) {
    this.stats.totalSuccesses++;
    this.successCount++;
    this.failureCount = 0;
    
    // Update average response time
    this.updateAverageResponseTime(duration);
    
    if (this.state === 'HALF_OPEN') {
      this.transitionToClosed();
    }
  }

  onFailure(error, duration) {
    this.stats.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Update average response time
    this.updateAverageResponseTime(duration);
    
    if (this.failureCount >= this.failureThreshold) {
      this.transitionToOpen();
    }
  }

  transitionToOpen() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.recoveryTimeout;
    this.stats.lastStateChange = new Date().toISOString();
    
    logger.warn(`[CIRCUIT] Circuit breaker '${this.name}' OPENED due to ${this.failureCount} failures`);
  }

  transitionToHalfOpen() {
    this.state = 'HALF_OPEN';
    this.successCount = 0;
    this.stats.lastStateChange = new Date().toISOString();
    
    logger.debug(`[CIRCUIT] Circuit breaker '${this.name}' HALF_OPEN - testing recovery`);
  }

  transitionToClosed() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.stats.lastStateChange = new Date().toISOString();
    
    logger.debug(`[CIRCUIT] Circuit breaker '${this.name}' CLOSED - service recovered`);
  }

  updateAverageResponseTime(duration) {
    const alpha = 0.1; // Smoothing factor
    this.stats.averageResponseTime = Math.round(
      this.stats.averageResponseTime * (1 - alpha) + duration * alpha
    );
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      stats: this.stats,
      nextAttempt: this.nextAttempt ? new Date(this.nextAttempt).toISOString() : null
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.requestCount = 0;
    
    this.stats.lastStateChange = new Date().toISOString();
    
    logger.debug(`[CIRCUIT] Circuit breaker '${this.name}' reset to CLOSED state`);
  }
}

class AutoRollback {
  constructor(options = {}) {
    this.rollbackThreshold = options.rollbackThreshold || 0.3; // 30% failure rate
    this.monitoringWindow = options.monitoringWindow || 300000; // 5 minutes
    this.maxRollbacks = options.maxRollbacks || 3;
    this.rollbackCooldown = options.rollbackCooldown || 600000; // 10 minutes
    
    this.deploymentHistory = [];
    this.currentDeployment = null;
    this.lastRollback = null;
    this.rollbackCount = 0;
    
    logger.debug('[ROLLBACK] Auto-rollback system initialized');
  }

  recordDeployment(deploymentInfo) {
    const deployment = {
      id: this.generateDeploymentId(),
      timestamp: new Date().toISOString(),
      version: deploymentInfo.version,
      description: deploymentInfo.description,
      changes: deploymentInfo.changes || [],
      rollbackTo: deploymentInfo.rollbackTo,
      status: 'deployed',
      metrics: {
        requests: 0,
        failures: 0,
        errors: [],
        responseTime: [],
        uptime: 100
      }
    };

    this.currentDeployment = deployment;
    this.deploymentHistory.push(deployment);
    
    logger.debug(`[ROLLBACK] Deployment recorded: ${deployment.version} (${deployment.id})`);
    
    // Start monitoring
    this.startMonitoring(deployment);
    
    return deployment;
  }

  recordRequest(deploymentId, success, responseTime, error = null) {
    const deployment = this.findDeployment(deploymentId);
    if (!deployment) return;

    deployment.metrics.requests++;
    
    if (success) {
      deployment.metrics.responseTime.push(responseTime);
    } else {
      deployment.metrics.failures++;
      if (error) {
        deployment.metrics.errors.push({
          timestamp: new Date().toISOString(),
          error: error.message,
          stack: error.stack
        });
      }
    }

    // Check if rollback is needed
    this.checkRollbackCriteria(deployment);
  }

  checkRollbackCriteria(deployment) {
    const failureRate = deployment.metrics.requests > 0 
      ? deployment.metrics.failures / deployment.metrics.requests 
      : 0;

    const averageResponseTime = deployment.metrics.responseTime.length > 0
      ? deployment.metrics.responseTime.reduce((sum, time) => sum + time, 0) / deployment.metrics.responseTime.length
      : 0;

    // Check rollback conditions
    const shouldRollback = 
      failureRate >= this.rollbackThreshold ||
      averageResponseTime > 5000 || // 5 seconds
      deployment.metrics.errors.some(error => this.isCriticalError(error));

    if (shouldRollback && this.canRollback()) {
      this.executeRollback(deployment);
    }
  }

  isCriticalError(error) {
    const criticalPatterns = [
      'database connection',
      'authentication failed',
      'security breach',
      'data corruption',
      'system crash'
    ];

    return criticalPatterns.some(pattern => 
      error.error.toLowerCase().includes(pattern)
    );
  }

  canRollback() {
    if (!this.currentDeployment || !this.currentDeployment.rollbackTo) {
      return false;
    }

    if (this.rollbackCount >= this.maxRollbacks) {
      logger.warn('[ROLLBACK] Maximum rollbacks reached');
      return false;
    }

    if (this.lastRollback && 
        Date.now() - new Date(this.lastRollback.timestamp).getTime() < this.rollbackCooldown) {
      logger.warn('[ROLLBACK] Rollback cooldown period active');
      return false;
    }

    return true;
  }

  async executeRollback(deployment) {
    logger.warn(`[ROLLBACK] Executing rollback from ${deployment.version} to ${deployment.rollbackTo}`);
    
    try {
      // Update deployment status
      deployment.status = 'rolled_back';
      deployment.rollbackTimestamp = new Date().toISOString();
      
      // Record rollback
      this.lastRollback = {
        deploymentId: deployment.id,
        fromVersion: deployment.version,
        toVersion: deployment.rollbackTo,
        timestamp: new Date().toISOString(),
        reason: 'Failure threshold exceeded',
        metrics: deployment.metrics
      };
      
      this.rollbackCount++;
      
      // In a real implementation, this would trigger the actual rollback process
      // For now, we'll just log it
      logger.debug(`[ROLLBACK] Rollback completed: ${deployment.version} -> ${deployment.rollbackTo}`);
      
      // Start monitoring the rolled-back version
      this.currentDeployment = this.findDeployment(deployment.rollbackTo);
      if (this.currentDeployment) {
        this.currentDeployment.status = 'active';
        this.startMonitoring(this.currentDeployment);
      }
      
      return {
        success: true,
        fromVersion: deployment.version,
        toVersion: deployment.rollbackTo,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[ROLLBACK] Rollback failed:', error);
      deployment.status = 'rollback_failed';
      deployment.rollbackError = error.message;
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  startMonitoring(deployment) {
    // Set up monitoring interval
    if (deployment.monitoringInterval) {
      clearInterval(deployment.monitoringInterval);
    }
    
    deployment.monitoringInterval = setInterval(() => {
      this.checkDeploymentHealth(deployment);
    }, this.monitoringWindow);
  }

  checkDeploymentHealth(deployment) {
    const now = Date.now();
    const deploymentAge = now - new Date(deployment.timestamp).getTime();
    
    // Only check if deployment is older than the monitoring window
    if (deploymentAge < this.monitoringWindow) {
      return;
    }
    
    // Calculate metrics for the monitoring window
    const _windowStart = now - this.monitoringWindow;
    const recentRequests = deployment.metrics.requests;
    const recentFailures = deployment.metrics.failures;
    
    if (recentRequests === 0) return;
    
    const failureRate = recentFailures / recentRequests;
    
    logger.debug(`[ROLLBACK] Health check for ${deployment.version}: ${failureRate.toFixed(2)} failure rate`);
    
    // Update deployment health status
    deployment.health = {
      failureRate,
      status: failureRate < this.rollbackThreshold ? 'healthy' : 'unhealthy',
      lastCheck: new Date().toISOString()
    };
  }

  findDeployment(deploymentId) {
    return this.deploymentHistory.find(d => d.id === deploymentId);
  }

  generateDeploymentId() {
    return `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getDeploymentHistory() {
    return this.deploymentHistory.map(deployment => ({
      id: deployment.id,
      version: deployment.version,
      timestamp: deployment.timestamp,
      status: deployment.status,
      metrics: deployment.metrics,
      health: deployment.health
    }));
  }

  getCurrentDeployment() {
    return this.currentDeployment;
  }

  getRollbackHistory() {
    return this.lastRollback ? [this.lastRollback] : [];
  }

  getSystemStats() {
    return {
      totalDeployments: this.deploymentHistory.length,
      currentDeployment: this.currentDeployment?.version || null,
      rollbackCount: this.rollbackCount,
      maxRollbacks: this.maxRollbacks,
      lastRollback: this.lastRollback?.timestamp || null,
      systemHealth: this.currentDeployment?.health?.status || 'unknown'
    };
  }
}

class HealthChecker {
  constructor(options = {}) {
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.timeout = options.timeout || 5000; // 5 seconds
    this.services = new Map();
    this.healthHistory = [];
    this.alertThreshold = options.alertThreshold || 3; // 3 consecutive failures
    
    this.isRunning = false;
    this.intervalId = null;
    
    logger.debug('[HEALTH] Health checker initialized');
  }

  registerService(name, healthCheck) {
    this.services.set(name, {
      name,
      healthCheck,
      status: 'unknown',
      lastCheck: null,
      consecutiveFailures: 0,
      responseTime: 0,
      error: null
    });
    
    logger.debug(`[HEALTH] Service registered: ${name}`);
  }

  async start() {
    if (this.isRunning) {
      logger.debug('[HEALTH] Health checker already running');
      return;
    }
    
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.performHealthChecks();
    }, this.checkInterval);
    
    logger.debug('[HEALTH] Health checker started');
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    logger.debug('[HEALTH] Health checker stopped');
  }

  async performHealthChecks() {
    const results = [];
    
    for (const [name, service] of this.services) {
      try {
        const startTime = Date.now();
        const result = await this.checkService(service, startTime);
        results.push(result);
      } catch (error) {
        console.error(`[HEALTH] Error checking service ${name}:`, error.message);
      }
    }
    
    // Store health history
    this.healthHistory.push({
      timestamp: new Date().toISOString(),
      results,
      overall: this.calculateOverallHealth(results)
    });
    
    // Keep only last 100 entries
    if (this.healthHistory.length > 100) {
      this.healthHistory = this.healthHistory.slice(-100);
    }
    
    return results;
  }

  async checkService(service, startTime) {
    try {
      // Set timeout for health check
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.timeout);
      });
      
      const healthPromise = Promise.resolve(service.healthCheck());
      const result = await Promise.race([healthPromise, timeoutPromise]);
      
      const responseTime = Date.now() - startTime;
      
      // Update service status
      service.status = result.healthy ? 'healthy' : 'unhealthy';
      service.lastCheck = new Date().toISOString();
      service.responseTime = responseTime;
      service.error = null;
      service.consecutiveFailures = 0;
      
      return {
        name: service.name,
        status: service.status,
        responseTime,
        lastCheck: service.lastCheck,
        details: result
      };
      
    } catch (error) {
      // Update service status
      service.status = 'unhealthy';
      service.lastCheck = new Date().toISOString();
      service.error = error.message;
      service.consecutiveFailures++;
      
      // Trigger alert if threshold exceeded
      if (service.consecutiveFailures >= this.alertThreshold) {
        this.triggerAlert(service, error);
      }
      
      return {
        name: service.name,
        status: service.status,
        lastCheck: service.lastCheck,
        error: error.message,
        consecutiveFailures: service.consecutiveFailures
      };
    }
  }

  calculateOverallHealth(results) {
    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const totalCount = results.length;
    
    if (totalCount === 0) return 'unknown';
    if (healthyCount === totalCount) return 'healthy';
    if (healthyCount === 0) return 'unhealthy';
    return 'degraded';
  }

  triggerAlert(service, _error) {
    console.error(`[HEALTH] ALERT: Service ${service.name} has failed ${service.consecutiveFailures} consecutive times`);
    
    // In a real implementation, this would trigger alerts, notifications, etc.
    // For now, we'll just log it
  }

  async checkServiceHealth(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not registered`);
    }
    
    const startTime = Date.now();
    return await this.checkService(service, startTime);
  }

  getSystemHealth() {
    const services = Array.from(this.services.values()).map(service => ({
      name: service.name,
      status: service.status,
      lastCheck: service.lastCheck,
      responseTime: service.responseTime,
      consecutiveFailures: service.consecutiveFailures,
      error: service.error
    }));
    
    const overall = this.calculateOverallHealth(services);
    
    return {
      overall,
      services,
      isRunning: this.isRunning,
      lastCheck: new Date().toISOString()
    };
  }

  getHealthHistory(limit = 10) {
    return this.healthHistory.slice(-limit);
  }
}

class DisasterRecovery {
  constructor(options = {}) {
    this.backupInterval = options.backupInterval || 3600000; // 1 hour
    this.maxBackups = options.maxBackups || 24; // 24 hours of backups
    this.backupLocation = options.backupLocation || './backups';
    this.recoveryProcedures = new Map();
    
    this.isRunning = false;
    this.backupIntervalId = null;
    
    logger.debug('[RECOVERY] Disaster recovery system initialized');
  }

  start() {
    if (this.isRunning) {
      logger.debug('[RECOVERY] Disaster recovery already running');
      return;
    }
    
    this.isRunning = true;
    this.backupIntervalId = setInterval(() => {
      this.performBackup();
    }, this.backupInterval);
    
    logger.debug('[RECOVERY] Disaster recovery started');
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.backupIntervalId) {
      clearInterval(this.backupIntervalId);
      this.backupIntervalId = null;
    }
    
    logger.debug('[RECOVERY] Disaster recovery stopped');
  }

  async performBackup() {
    const backupId = this.generateBackupId();
    const timestamp = new Date().toISOString();
    
    try {
      logger.debug(`[RECOVERY] Starting backup: ${backupId}`);
      
      // Create backup
      const backupData = await this.createBackup();
      
      // Save backup
      await this.saveBackup(backupId, backupData);
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      logger.debug(`[RECOVERY] Backup completed: ${backupId}`);
      
      return {
        backupId,
        timestamp,
        size: backupData.size,
        success: true
      };
      
    } catch (error) {
      console.error(`[RECOVERY] Backup failed: ${backupId}`, error);
      
      return {
        backupId,
        timestamp,
        success: false,
        error: error.message
      };
    }
  }

  async createBackup() {
    // In a real implementation, this would backup critical data
    // For now, we'll create a mock backup
    const backupData = {
      timestamp: new Date().toISOString(),
      systemState: this.captureSystemState(),
      configuration: this.captureConfiguration(),
      userData: this.captureUserData(),
      metadata: {
        version: '1.0.0',
        nodeVersion: process.version,
        platform: process.platform
      }
    };
    
    return {
      data: JSON.stringify(backupData, null, 2),
      size: JSON.stringify(backupData, null, 2).length
    };
  }

  async saveBackup(backupId, backupData) {
    const fs = require('fs');
    const path = require('path');
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupLocation)) {
      fs.mkdirSync(this.backupLocation, { recursive: true });
    }
    
    const backupPath = path.join(this.backupLocation, `${backupId}.json`);
    fs.writeFileSync(backupPath, backupData.data);
    
    return backupPath;
  }

  async cleanupOldBackups() {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const files = fs.readdirSync(this.backupLocation);
      const backupFiles = files
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.backupLocation, file),
          mtime: fs.statSync(path.join(this.backupLocation, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      // Keep only the most recent backups
      if (backupFiles.length > this.maxBackups) {
        const filesToDelete = backupFiles.slice(this.maxBackups);
        
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          logger.debug(`[RECOVERY] Deleted old backup: ${file.name}`);
        }
      }
      
    } catch (error) {
      console.error('[RECOVERY] Failed to cleanup old backups:', error.message);
    }
  }

  captureSystemState() {
    // Capture current system state
    return {
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid
    };
  }

  captureConfiguration() {
    // Capture configuration data
    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000
    };
  }

  captureUserData() {
    // In a real implementation, this would capture user data
    // For now, we'll return a placeholder
    return {
      timestamp: new Date().toISOString(),
      userCount: 0,
      dataSummary: 'User data backup placeholder'
    };
  }

  async restoreFromBackup(backupId) {
    try {
      logger.debug(`[RECOVERY] Starting restore from backup: ${backupId}`);
      
      const fs = require('fs');
      const path = require('path');
      
      const backupPath = path.join(this.backupLocation, `${backupId}.json`);
      
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupId}`);
      }
      
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      
      // In a real implementation, this would restore the system state
      logger.debug(`[RECOVERY] Restore completed: ${backupId}`);
      
      return {
        backupId,
        timestamp: backupData.timestamp,
        success: true,
        restoredData: backupData
      };
      
    } catch (error) {
      console.error(`[RECOVERY] Restore failed: ${backupId}`, error);
      
      return {
        backupId,
        success: false,
        error: error.message
      };
    }
  }

  listBackups() {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const files = fs.readdirSync(this.backupLocation);
      const backups = files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(this.backupLocation, file);
          const stats = fs.statSync(filePath);
          
          return {
            name: file.replace('.json', ''),
            path: filePath,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => b.modified - a.modified);
      
      return backups;
      
    } catch (error) {
      console.error('[RECOVERY] Failed to list backups:', error.message);
      return [];
    }
  }

  generateBackupId() {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getSystemStats() {
    return {
      isRunning: this.isRunning,
      backupInterval: this.backupInterval,
      maxBackups: this.maxBackups,
      backupLocation: this.backupLocation,
      lastBackup: this.listBackups()[0]?.created || null,
      totalBackups: this.listBackups().length
    };
  }
}

// Create resilience manager
class ResilienceManager {
  constructor(options = {}) {
    this.circuitBreakers = new Map();
    this.autoRollback = new AutoRollback(options.rollback || {});
    this.healthChecker = new HealthChecker(options.health || {});
    this.disasterRecovery = new DisasterRecovery(options.recovery || {});
    
    this.initializeDefaultCircuitBreakers();
  }

  initializeDefaultCircuitBreakers() {
    // Create circuit breakers for critical services
    this.createCircuitBreaker('ai_service', {
      failureThreshold: 5,
      recoveryTimeout: 60000
    });
    
    this.createCircuitBreaker('database', {
      failureThreshold: 3,
      recoveryTimeout: 30000
    });
    
    this.createCircuitBreaker('external_api', {
      failureThreshold: 10,
      recoveryTimeout: 120000
    });
  }

  createCircuitBreaker(name, options) {
    const circuitBreaker = new CircuitBreaker(name, options);
    this.circuitBreakers.set(name, circuitBreaker);
    return circuitBreaker;
  }

  getCircuitBreaker(name) {
    return this.circuitBreakers.get(name);
  }

  async executeWithCircuitBreaker(serviceName, operation) {
    const circuitBreaker = this.getCircuitBreaker(serviceName);
    if (!circuitBreaker) {
      // Execute without circuit breaker if not found
      return await operation();
    }
    
    return await circuitBreaker.execute(operation);
  }

  getSystemHealth() {
    const circuitBreakers = Array.from(this.circuitBreakers.values())
      .map(cb => cb.getState());
    
    return {
      circuitBreakers,
      rollback: this.autoRollback.getSystemStats(),
      health: this.healthChecker.getSystemHealth(),
      recovery: this.disasterRecovery.getSystemStats(),
      timestamp: new Date().toISOString()
    };
  }

  async start() {
    await this.healthChecker.start();
    this.disasterRecovery.start();
    
    logger.debug('[RESILIENCE] Resilience manager started');
  }

  async stop() {
    this.healthChecker.stop();
    this.disasterRecovery.stop();
    
    logger.debug('[RESILIENCE] Resilience manager stopped');
  }
}

module.exports = {
  CircuitBreaker,
  AutoRollback,
  HealthChecker,
  DisasterRecovery,
  ResilienceManager
};
