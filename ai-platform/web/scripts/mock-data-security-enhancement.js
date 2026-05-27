/**
 * Mock Data Security Enhancement System
 * Implements clearly identifiable test data and security isolation
 * 
 * Features:
 * - Test data watermarking and identification
 * - Security isolation between test and production data
 * - Data sanitization and anonymization
 * - Access control and permissions
 * - Audit logging and monitoring
 * - Data validation and integrity checks
 */

class MockDataSecurityEnhancement {
    constructor() {
        this.isInitialized = false;
        this.securityConfig = {
            watermarkEnabled: true,
            isolationEnabled: true,
            sanitizationEnabled: true,
            auditLoggingEnabled: true,
            encryptionEnabled: true
        };
        
        this.watermarkPrefix = '[MOCK_DATA]';
        this.isolationTags = new Map();
        this.auditLog = [];
        this.accessPermissions = new Map();
        this.encryptionKey = this.generateEncryptionKey();
        
        // Security levels
        this.securityLevels = {
            PUBLIC: 'public',
            INTERNAL: 'internal', 
            CONFIDENTIAL: 'confidential',
            RESTRICTED: 'restricted'
        };
        
        // Initialize security system
        this.init();
    }

    /**
     * Initialize the security enhancement system
     */
    async init() {
        console.log('🔒 Initializing Mock Data Security Enhancement...');
        
        try {
            // Load security configuration
            await this.loadSecurityConfig();
            
            // Initialize access controls
            this.initializeAccessControls();
            
            // Setup audit logging
            this.setupAuditLogging();
            
            // Initialize data isolation
            this.initializeDataIsolation();
            
            this.isInitialized = true;
            console.log('✅ Mock Data Security Enhancement initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Mock Data Security Enhancement:', error);
        }
    }

    /**
     * Load security configuration
     */
    async loadSecurityConfig() {
        // Load from localStorage or use defaults
        const stored = localStorage.getItem('mockDataSecurityConfig');
        if (stored) {
            this.securityConfig = { ...this.securityConfig, ...JSON.parse(stored) };
        }
    }

    /**
     * Initialize access controls
     */
    initializeAccessControls() {
        // Define default permissions
        this.accessPermissions.set('admin', ['read', 'write', 'delete', 'manage']);
        this.accessPermissions.set('developer', ['read', 'write']);
        this.accessPermissions.set('analyst', ['read']);
        this.accessPermissions.set('viewer', ['read']);
    }

    /**
     * Setup audit logging
     */
    setupAuditLogging() {
        // Log all data access and modifications
        this.logAuditEvent('SYSTEM', 'SECURITY_SYSTEM_INITIALIZED', {
            timestamp: new Date().toISOString(),
            config: this.securityConfig
        });
    }

    /**
     * Initialize data isolation
     */
    initializeDataIsolation() {
        // Create isolation zones for different data types
        this.isolationTags.set('test_data', {
            zone: 'test',
            securityLevel: this.securityLevels.INTERNAL,
            restrictions: ['no_production_use', 'watermarked']
        });
        
        this.isolationTags.set('mock_data', {
            zone: 'mock', 
            securityLevel: this.securityLevels.PUBLIC,
            restrictions: ['clearly_identifiable', 'anonymized']
        });
        
        this.isolationTags.set('sensitive_mock', {
            zone: 'sensitive_mock',
            securityLevel: this.securityLevels.CONFIDENTIAL,
            restrictions: ['encrypted', 'access_controlled']
        });
    }

    /**
     * Apply security enhancements to mock data
     */
    async secureMockData(data, dataType = 'mock_data') {
        if (!this.isInitialized) {
            console.warn('⚠️ Security system not initialized');
            return data;
        }

        console.log('🔒 Applying security enhancements to mock data...');

        try {
            let securedData = { ...data };

            // Apply watermarking
            if (this.securityConfig.watermarkEnabled) {
                securedData = this.applyWatermark(securedData, dataType);
            }

            // Apply sanitization
            if (this.securityConfig.sanitizationEnabled) {
                securedData = this.sanitizeData(securedData);
            }

            // Apply encryption for sensitive data
            if (this.securityConfig.encryptionEnabled && this.isSensitiveData(dataType)) {
                securedData = this.encryptSensitiveFields(securedData);
            }

            // Apply isolation tags
            securedData = this.applyIsolationTags(securedData, dataType);

            // Log the security operation
            this.logAuditEvent('DATA_SECURITY', 'MOCK_DATA_SECURED', {
                dataType,
                timestamp: new Date().toISOString(),
                operations: ['watermarking', 'sanitization', 'isolation']
            });

            return securedData;

        } catch (error) {
            console.error('❌ Failed to secure mock data:', error);
            this.logAuditEvent('ERROR', 'SECURITY_OPERATION_FAILED', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
            return data;
        }
    }

    /**
     * Apply watermark to mock data
     */
    applyWatermark(data, dataType) {
        const watermark = {
            _security: {
                watermark: this.watermarkPrefix,
                timestamp: new Date().toISOString(),
                dataType,
                version: '1.0',
                environment: 'development'
            }
        };

        // Add watermark to root level
        const watermarkedData = { watermark, ...data };

        // Add watermark to nested objects
        this.addNestedWatermarks(watermarkedData);

        return watermarkedData;
    }

    /**
     * Add watermarks to nested objects
     */
    addNestedWatermarks(obj, path = '') {
        if (typeof obj !== 'object' || obj === null) {
            return;
        }

        // Add watermark to arrays
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                if (typeof item === 'object' && item !== null) {
                    if (!item._watermark) {
                        item._watermark = `${this.watermarkPrefix}[${path}[${index}]]`;
                    }
                    this.addNestedWatermarks(item, `${path}[${index}]`);
                }
            });
        } else {
            // Add watermark to objects
            Object.keys(obj).forEach(key => {
                if (key === '_watermark' || key === '_security') return;
                
                const value = obj[key];
                if (typeof value === 'object' && value !== null) {
                    if (!value._watermark) {
                        value._watermark = `${this.watermarkPrefix}[${path}.${key}]`;
                    }
                    this.addNestedWatermarks(value, `${path}.${key}`);
                }
            });
        }
    }

    /**
     * Sanitize data to remove sensitive information
     */
    sanitizeData(data) {
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential', 'auth'];
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;

        return this.deepSanitize(data, sensitiveFields, [emailPattern, phonePattern]);
    }

    /**
     * Deep sanitize data recursively
     */
    deepSanitize(obj, sensitiveFields, patterns) {
        if (typeof obj !== 'object' || obj === null) {
            return this.sanitizeValue(obj, patterns);
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepSanitize(item, sensitiveFields, patterns));
        }

        const sanitized = {};
        Object.keys(obj).forEach(key => {
            if (key === '_watermark' || key === '_security') {
                sanitized[key] = obj[key];
                return;
            }

            const lowerKey = key.toLowerCase();
            if (sensitiveFields.some(field => lowerKey.includes(field))) {
                sanitized[key] = this.maskSensitiveValue(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitized[key] = this.deepSanitize(obj[key], sensitiveFields, patterns);
            } else {
                sanitized[key] = this.sanitizeValue(obj[key], patterns);
            }
        });

        return sanitized;
    }

    /**
     * Sanitize individual values
     */
    sanitizeValue(value, patterns) {
        if (typeof value !== 'string') {
            return value;
        }

        let sanitized = value;
        patterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, (match) => {
                return this.maskSensitiveValue(match);
            });
        });

        return sanitized;
    }

    /**
     * Mask sensitive values
     */
    maskSensitiveValue(value) {
        if (typeof value !== 'string') {
            return '[REDACTED]';
        }

        if (value.length <= 4) {
            return '[REDACTED]';
        }

        return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    }

    /**
     * Check if data type is sensitive
     */
    isSensitiveData(dataType) {
        return dataType === 'sensitive_mock' || dataType.includes('sensitive');
    }

    /**
     * Encrypt sensitive fields
     */
    encryptSensitiveFields(data) {
        const sensitiveFields = ['ssn', 'credit_card', 'bank_account', 'personal_id'];
        
        return this.deepEncrypt(data, sensitiveFields);
    }

    /**
     * Deep encrypt sensitive fields
     */
    deepEncrypt(obj, sensitiveFields) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepEncrypt(item, sensitiveFields));
        }

        const encrypted = {};
        Object.keys(obj).forEach(key => {
            if (key === '_watermark' || key === '_security') {
                encrypted[key] = obj[key];
                return;
            }

            const lowerKey = key.toLowerCase();
            if (sensitiveFields.some(field => lowerKey.includes(field))) {
                encrypted[key] = this.encryptValue(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                encrypted[key] = this.deepEncrypt(obj[key], sensitiveFields);
            } else {
                encrypted[key] = obj[key];
            }
        });

        return encrypted;
    }

    /**
     * Encrypt a value
     */
    encryptValue(value) {
        if (typeof value !== 'string') {
            return value;
        }

        // Simple XOR encryption for demonstration
        // In production, use proper encryption libraries
        let encrypted = '';
        for (let i = 0; i < value.length; i++) {
            encrypted += String.fromCharCode(
                value.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length)
            );
        }
        
        return btoa(encrypted); // Base64 encode
    }

    /**
     * Apply isolation tags
     */
    applyIsolationTags(data, dataType) {
        const isolation = this.isolationTags.get(dataType);
        if (!isolation) {
            return data;
        }

        return {
            _isolation: {
                zone: isolation.zone,
                securityLevel: isolation.securityLevel,
                restrictions: isolation.restrictions,
                timestamp: new Date().toISOString()
            },
            ...data
        };
    }

    /**
     * Verify data integrity
     */
    async verifyDataIntegrity(data) {
        const verification = {
            isValid: true,
            issues: [],
            securityLevel: 'unknown',
            hasWatermark: false,
            isIsolated: false
        };

        try {
            // Check for watermark
            if (data._security && data._security.watermark) {
                verification.hasWatermark = true;
                verification.securityLevel = data._isolation?.securityLevel || 'mock';
            } else {
                verification.issues.push('Missing security watermark');
                verification.isValid = false;
            }

            // Check for isolation tags
            if (data._isolation) {
                verification.isIsolated = true;
            } else {
                verification.issues.push('Missing isolation tags');
                verification.isValid = false;
            }

            // Check for sensitive data exposure
            const sensitiveCheck = this.checkSensitiveDataExposure(data);
            if (sensitiveCheck.exposed) {
                verification.issues.push(...sensitiveCheck.issues);
                verification.isValid = false;
            }

        } catch (error) {
            verification.issues.push(`Verification error: ${error.message}`);
            verification.isValid = false;
        }

        return verification;
    }

    /**
     * Check for sensitive data exposure
     */
    checkSensitiveDataExposure(data) {
        const result = {
            exposed: false,
            issues: []
        };

        const sensitivePatterns = [
            /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
            /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, // Credit card pattern
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g // Email pattern
        ];

        const dataString = JSON.stringify(data);
        
        sensitivePatterns.forEach((pattern, index) => {
            const matches = dataString.match(pattern);
            if (matches && matches.length > 0) {
                result.exposed = true;
                result.issues.push(`Sensitive data pattern ${index + 1} detected: ${matches.length} occurrences`);
            }
        });

        return result;
    }

    /**
     * Check access permissions
     */
    checkAccess(userRole, operation) {
        const permissions = this.accessPermissions.get(userRole) || [];
        const hasAccess = permissions.includes(operation);
        
        this.logAuditEvent('ACCESS_CONTROL', 'PERMISSION_CHECK', {
            userRole,
            operation,
            granted: hasAccess,
            timestamp: new Date().toISOString()
        });

        return hasAccess;
    }

    /**
     * Generate security report
     */
    async generateSecurityReport() {
        const report = {
            timestamp: new Date().toISOString(),
            securityConfig: this.securityConfig,
            isolationZones: Array.from(this.isolationTags.entries()),
            accessPermissions: Array.from(this.accessPermissions.entries()),
            auditSummary: this.generateAuditSummary(),
            recommendations: this.generateSecurityRecommendations()
        };

        this.logAuditEvent('SECURITY_REPORT', 'REPORT_GENERATED', {
            timestamp: report.timestamp
        });

        return report;
    }

    /**
     * Generate audit summary
     */
    generateAuditSummary() {
        const summary = {
            totalEvents: this.auditLog.length,
            eventsByType: {},
            recentEvents: this.auditLog.slice(-10),
            securityEvents: this.auditLog.filter(event => 
                event.type === 'SECURITY_VIOLATION' || 
                event.type === 'ACCESS_DENIED' ||
                event.type === 'SECURITY_OPERATION_FAILED'
            ).length
        };

        this.auditLog.forEach(event => {
            summary.eventsByType[event.type] = (summary.eventsByType[event.type] || 0) + 1;
        });

        return summary;
    }

    /**
     * Generate security recommendations
     */
    generateSecurityRecommendations() {
        const recommendations = [];

        if (!this.securityConfig.encryptionEnabled) {
            recommendations.push({
                priority: 'high',
                title: 'Enable Encryption',
                description: 'Enable encryption for sensitive mock data to enhance security'
            });
        }

        if (!this.securityConfig.auditLoggingEnabled) {
            recommendations.push({
                priority: 'medium',
                title: 'Enable Audit Logging',
                description: 'Enable comprehensive audit logging for better security monitoring'
            });
        }

        const securityEvents = this.auditLog.filter(event => 
            event.type === 'SECURITY_VIOLATION' || 
            event.type === 'ACCESS_DENIED'
        );

        if (securityEvents.length > 5) {
            recommendations.push({
                priority: 'high',
                title: 'Review Access Controls',
                description: 'High number of security violations detected. Review and strengthen access controls'
            });
        }

        return recommendations;
    }

    /**
     * Log audit event
     */
    logAuditEvent(type, action, details = {}) {
        if (!this.securityConfig.auditLoggingEnabled) {
            return;
        }

        const event = {
            id: Date.now().toString(),
            type,
            action,
            details,
            timestamp: new Date().toISOString(),
            user: this.getCurrentUser()
        };

        this.auditLog.push(event);

        // Keep only last 1000 events to prevent memory issues
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(-1000);
        }
    }

    /**
     * Get current user (mock implementation)
     */
    getCurrentUser() {
        return localStorage.getItem('currentUser') || 'anonymous';
    }

    /**
     * Generate encryption key
     */
    generateEncryptionKey() {
        // Generate a simple key for demonstration
        // In production, use proper key generation
        return 'MockDataSecurityKey2024';
    }

    /**
     * Update security configuration
     */
    updateSecurityConfig(newConfig) {
        this.securityConfig = { ...this.securityConfig, ...newConfig };
        localStorage.setItem('mockDataSecurityConfig', JSON.stringify(this.securityConfig));
        
        this.logAuditEvent('CONFIG', 'SECURITY_CONFIG_UPDATED', {
            newConfig,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get security status
     */
    getSecurityStatus() {
        return {
            isInitialized: this.isInitialized,
            config: this.securityConfig,
            auditLogSize: this.auditLog.length,
            isolationZones: this.isolationTags.size,
            lastAuditEvent: this.auditLog.length > 0 ? this.auditLog[this.auditLog.length - 1].timestamp : null
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.auditLog = [];
        this.isolationTags.clear();
        this.accessPermissions.clear();
        this.isInitialized = false;
        
        console.log('🔒 Mock Data Security Enhancement cleaned up');
    }
}

// Global instance
window.mockDataSecurity = new MockDataSecurityEnhancement();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MockDataSecurityEnhancement;
}
