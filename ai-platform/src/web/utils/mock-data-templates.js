/**
 * Mock Data Templates
 * 
 * This module provides reusable templates for common mock data structures
 * to ensure consistency across the codebase and reduce duplication.
 * 
 * @version 1.1.0
 * @created 2026-05-20
 * @updated 2026-05-20 - Added report templates

// ============================================================================
// USER TEMPLATES
// ============================================================================

/**
 * Standard user template
 * @param {object} overrides - Properties to override in the template
 * @returns {object} User object
 */
function createUserTemplate(overrides = {}) {
    return {
        id: overrides.id || 'user_001',
        name: overrides.name || 'Test User',
        email: overrides.email || 'test.user@mock-data.local',
        role: overrides.role || 'Developer',
        status: overrides.status || 'active',
        department: overrides.department || 'Engineering',
        joinDate: overrides.joinDate || '2024-01-01',
        avatar: overrides.avatar || generateInitials(overrides.name || 'Test User'),
        permissions: overrides.permissions || ['read', 'write'],
        lastActive: overrides.lastActive || new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Admin user template
 * @param {object} overrides - Properties to override in the template
 * @returns {object} Admin user object
 */
function createAdminUserTemplate(overrides = {}) {
    return createUserTemplate({
        id: 'admin_001',
        name: 'Admin User',
        email: 'admin@mock-data.local',
        role: 'Administrator',
        permissions: ['read', 'write', 'delete', 'admin'],
        department: 'Management',
        ...overrides,
    });
}

/**
 * Guest user template
 * @param {object} overrides - Properties to override in the template
 * @returns {object} Guest user object
 */
function createGuestUserTemplate(overrides = {}) {
    return createUserTemplate({
        id: 'guest_001',
        name: 'Guest User',
        email: 'guest@mock-data.local',
        role: 'Guest',
        permissions: ['read'],
        status: 'guest',
        department: 'External',
        ...overrides,
    });
}

// ============================================================================
// API RESPONSE TEMPLATES
// ============================================================================

/**
 * Success API response template
 * @param {object} data - Response data
 * @param {object} metadata - Additional metadata
 * @returns {object} API response object
 */
function createSuccessResponseTemplate(data, metadata = {}) {
    return {
        success: true,
        status: 200,
        message: 'Success',
        data: data,
        timestamp: new Date().toISOString(),
        metadata: {
            requestId: generateRequestId(),
            processingTime: Math.floor(Math.random() * 100) + 10,
            ...metadata,
        },
    };
}

/**
 * Error API response template
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {object} details - Additional error details
 * @returns {object} API error response object
 */
function createErrorResponseTemplate(message, status = 400, details = {}) {
    return {
        success: false,
        status: status,
        message: message,
        error: {
            code: status,
            message: message,
            details: details,
        },
        timestamp: new Date().toISOString(),
        metadata: {
            requestId: generateRequestId(),
            processingTime: Math.floor(Math.random() * 50) + 5,
        },
    };
}

/**
 * Paginated API response template
 * @param {Array} items - Array of items
 * @param {object} pagination - Pagination metadata
 * @returns {object} Paginated API response object
 */
function createPaginatedResponseTemplate(items, pagination = {}) {
    const defaultPagination = {
        page: 1,
        pageSize: 10,
        totalItems: items.length,
        totalPages: Math.ceil(items.length / 10),
        hasNext: false,
        hasPrevious: false,
    };

    return {
        success: true,
        status: 200,
        message: 'Success',
        data: {
            items: items,
            pagination: { ...defaultPagination, ...pagination },
        },
        timestamp: new Date().toISOString(),
        metadata: {
            requestId: generateRequestId(),
            processingTime: Math.floor(Math.random() * 100) + 20,
        },
    };
}

// ============================================================================
// DATABASE RECORD TEMPLATES
// ============================================================================

/**
 * Standard database record template
 * @param {string} tableName - Table name
 * @param {object} data - Record data
 * @param {object} overrides - Properties to override
 * @returns {object} Database record object
 */
function createDbRecordTemplate(tableName, data, overrides = {}) {
    return {
        id: overrides.id || generateDbId(tableName),
        tableName: tableName,
        data: data,
        createdAt: overrides.createdAt || new Date().toISOString(),
        updatedAt: overrides.updatedAt || new Date().toISOString(),
        version: overrides.version || 1,
        ...overrides,
    };
}

/**
 * User database record template
 * @param {object} userData - User data
 * @param {object} overrides - Properties to override
 * @returns {object} User database record
 */
function createUserDbRecordTemplate(userData, overrides = {}) {
    return createDbRecordTemplate('users', userData, overrides);
}

/**
 * Post database record template
 * @param {object} postData - Post data
 * @param {object} overrides - Properties to override
 * @returns {object} Post database record
 */
function createPostDbRecordTemplate(postData, overrides = {}) {
    const defaultPostData = {
        title: 'Test Post',
        content: 'This is a test post content',
        authorId: 'user_001',
        status: 'published',
        tags: ['test', 'mock-data'],
    };

    return createDbRecordTemplate('posts', { ...defaultPostData, ...postData }, overrides);
}

// ============================================================================
// FILE SYSTEM TEMPLATES
// ============================================================================

/**
 * File template
 * @param {object} overrides - Properties to override
 * @returns {object} File object
 */
function createFileTemplate(overrides = {}) {
    const fileTypes = ['js', 'py', 'ts', 'java', 'json', 'md', 'css', 'html'];
    const fileType = overrides.type || fileTypes[Math.floor(Math.random() * fileTypes.length)];

    return {
        name: overrides.name || `mock_file.${fileType}`,
        path: overrides.path || `/mock/path/mock_file.${fileType}`,
        type: fileType,
        size: overrides.size || Math.floor(Math.random() * 100000) + 1000,
        createdAt: overrides.createdAt || new Date().toISOString(),
        modifiedAt: overrides.modifiedAt || new Date().toISOString(),
        permissions: overrides.permissions || 'rw-r--r--',
        owner: overrides.owner || 'test.user',
        ...overrides,
    };
}

/**
 * Directory template
 * @param {object} overrides - Properties to override
 * @returns {object} Directory object
 */
function createDirectoryTemplate(overrides = {}) {
    return {
        name: overrides.name || 'mock_directory',
        path: overrides.path || '/mock/path/mock_directory',
        type: 'directory',
        createdAt: overrides.createdAt || new Date().toISOString(),
        modifiedAt: overrides.modifiedAt || new Date().toISOString(),
        permissions: overrides.permissions || 'rwxr-xr-x',
        owner: overrides.owner || 'test.user',
        fileCount: overrides.fileCount || Math.floor(Math.random() * 50) + 10,
        ...overrides,
    };
}

// ============================================================================
// PROJECT MANAGEMENT TEMPLATES
// ============================================================================

/**
 * Project template
 * @param {object} overrides - Properties to override
 * @returns {object} Project object
 */
function createProjectTemplate(overrides = {}) {
    return {
        id: overrides.id || 'proj_001',
        name: overrides.name || 'Mock Project',
        description: overrides.description || 'This is a mock project for testing',
        status: overrides.status || 'active',
        priority: overrides.priority || 'medium',
        startDate: overrides.startDate || '2024-01-01',
        endDate: overrides.endDate || '2024-12-31',
        team: overrides.team || [createUserTemplate().id],
        progress: overrides.progress || Math.floor(Math.random() * 100),
        tags: overrides.tags || ['mock', 'test'],
        createdAt: overrides.createdAt || new Date().toISOString(),
        updatedAt: overrides.updatedAt || new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Task template
 * @param {object} overrides - Properties to override
 * @returns {object} Task object
 */
function createTaskTemplate(overrides = {}) {
    return {
        id: overrides.id || 'task_001',
        title: overrides.title || 'Mock Task',
        description: overrides.description || 'This is a mock task for testing',
        status: overrides.status || 'pending',
        priority: overrides.priority || 'medium',
        assigneeId: overrides.assigneeId || createUserTemplate().id,
        projectId: overrides.projectId || createProjectTemplate().id,
        dueDate: overrides.dueDate || '2024-12-31',
        estimatedHours: overrides.estimatedHours || 8,
        actualHours: overrides.actualHours || 0,
        tags: overrides.tags || ['mock', 'test'],
        createdAt: overrides.createdAt || new Date().toISOString(),
        updatedAt: overrides.updatedAt || new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Sprint template
 * @param {object} overrides - Properties to override
 * @returns {object} Sprint object
 */
function createSprintTemplate(overrides = {}) {
    const taskCount = overrides.taskCount || Math.floor(Math.random() * 20) + 5;
    const tasks = Array.from({ length: taskCount }, (_, i) =>
        createTaskTemplate({ id: `task_${i + 1}` })
    );

    return {
        id: overrides.id || 'sprint_001',
        name: overrides.name || 'Mock Sprint',
        description: overrides.description || 'This is a mock sprint for testing',
        status: overrides.status || 'active',
        startDate: overrides.startDate || '2024-01-01',
        endDate: overrides.endDate || '2024-01-14',
        tasks: tasks,
        progress: overrides.progress || Math.floor(Math.random() * 100),
        projectId: overrides.projectId || createProjectTemplate().id,
        createdAt: overrides.createdAt || new Date().toISOString(),
        updatedAt: overrides.updatedAt || new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================================
// ANALYTICS TEMPLATES
// ============================================================================

/**
 * Metric template
 * @param {string} name - Metric name
 * @param {number} value - Metric value
 * @param {object} overrides - Properties to override
 * @returns {object} Metric object
 */
function createMetricTemplate(name, value, overrides = {}) {
    return {
        name: name,
        value: value,
        unit: overrides.unit || 'count',
        trend: overrides.trend || 'stable',
        change: overrides.change || 0,
        timestamp: overrides.timestamp || new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Analytics report template
 * @param {object} overrides - Properties to override
 * @returns {object} Analytics report object
 */
function createAnalyticsReportTemplate(overrides = {}) {
    return {
        id: overrides.id || generateReportId(),
        title: overrides.title || 'Mock Analytics Report',
        description: overrides.description || 'This is a mock analytics report',
        reportType: overrides.reportType || 'summary',
        period: overrides.period || 'daily',
        metrics: overrides.metrics || [
            createMetricTemplate('page_views', Math.floor(Math.random() * 10000) + 1000),
            createMetricTemplate('unique_visitors', Math.floor(Math.random() * 5000) + 500),
            createMetricTemplate('bounce_rate', Math.random() * 50 + 20),
        ],
        generatedAt: overrides.generatedAt || new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================================
// REPORT TEMPLATES
// ============================================================================

/**
 * Report metadata template
 * @param {object} overrides - Properties to override
 * @returns {object} Report metadata object
 */
function createReportMetadataTemplate(overrides = {}) {
    return {
        id: overrides.id || generateReportId(),
        size: overrides.size || Math.floor(Math.random() * 5000000) + 100000,
        schedule: overrides.schedule || 'daily',
        lastGenerated: overrides.lastGenerated || new Date().toISOString(),
        version: overrides.version || '1.0.0',
        validationStatus: overrides.validationStatus || 'valid',
        templateSource: overrides.templateSource || 'standard',
        ...overrides,
    };
}

/**
 * Resource utilization report template
 * @param {object} overrides - Properties to override
 * @returns {object} Resource utilization report object
 */
function createResourceUtilizationReportTemplate(overrides = {}) {
    return {
        reportInfo: {
            name: overrides.name || 'Resource Utilization',
            description: overrides.description || 'System resource usage and capacity planning',
            type: overrides.type || 'resources',
            category: overrides.category || 'operations',
            format: overrides.format || 'json',
            generated: overrides.generated || new Date().toISOString(),
            status: overrides.status || 'ready',
            version: overrides.version || '1.0.0',
        },
        metadata: createReportMetadataTemplate({
            id: 'report_004',
            size: 512000,
            schedule: 'daily',
            ...overrides.metadata,
        }),
        data: {
            summary: {
                totalMetrics: overrides.totalMetrics || 45,
                passed: overrides.passed || 38,
                failed: overrides.failed || 7,
                score: overrides.score || 84.4,
            },
            metrics: overrides.metrics || [
                { name: 'Performance', value: 85, status: 'good', trend: 'up' },
                { name: 'Quality', value: 92, status: 'excellent', trend: 'stable' },
                { name: 'Security', value: 78, status: 'fair', trend: 'down' },
                { name: 'Resources', value: 65, status: 'optimal', trend: 'up' },
            ],
            recommendations: overrides.recommendations || [
                'Improve security measures to address declining trend',
                'Maintain current quality standards',
                'Continue performance optimization efforts',
            ],
        },
        ...overrides,
    };
}

/**
 * Performance report template
 * @param {object} overrides - Properties to override
 * @returns {object} Performance report object
 */
function createPerformanceReportTemplate(overrides = {}) {
    return {
        reportInfo: {
            name: overrides.name || 'Project Performance Report',
            description: overrides.description || 'Comprehensive analysis of project performance metrics',
            type: overrides.type || 'performance',
            category: overrides.category || 'analytics',
            format: overrides.format || 'pdf',
            generated: overrides.generated || new Date().toISOString(),
            status: overrides.status || 'ready',
            version: overrides.version || '1.0.0',
        },
        metadata: createReportMetadataTemplate({
            id: 'report_001',
            size: 2457600,
            schedule: 'weekly',
            ...overrides.metadata,
        }),
        data: {
            summary: {
                totalProjects: overrides.totalProjects || 12,
                activeProjects: overrides.activeProjects || 8,
                completedProjects: overrides.completedProjects || 4,
                overallPerformance: overrides.overallPerformance || 87.5,
            },
            metrics: overrides.metrics || [
                { name: 'On-Time Delivery', value: 92, status: 'excellent', trend: 'up' },
                { name: 'Budget Adherence', value: 88, status: 'good', trend: 'stable' },
                { name: 'Quality Score', value: 94, status: 'excellent', trend: 'up' },
                { name: 'Team Efficiency', value: 85, status: 'good', trend: 'stable' },
            ],
            recommendations: overrides.recommendations || [
                'Continue current project management practices',
                'Focus on improving budget tracking',
                'Maintain quality standards',
            ],
        },
        ...overrides,
    };
}

/**
 * Code quality report template
 * @param {object} overrides - Properties to override
 * @returns {object} Code quality report object
 */
function createCodeQualityReportTemplate(overrides = {}) {
    return {
        reportInfo: {
            name: overrides.name || 'Code Quality Analysis',
            description: overrides.description || 'Detailed code quality metrics and recommendations',
            type: overrides.type || 'quality',
            category: overrides.category || 'development',
            format: overrides.format || 'excel',
            generated: overrides.generated || new Date().toISOString(),
            status: overrides.status || 'ready',
            version: overrides.version || '1.0.0',
        },
        metadata: createReportMetadataTemplate({
            id: 'report_002',
            size: 1024000,
            schedule: 'monthly',
            ...overrides.metadata,
        }),
        data: {
            summary: {
                totalFiles: overrides.totalFiles || 450,
                totalLines: overrides.totalLines || 125000,
                codeCoverage: overrides.codeCoverage || 78.5,
                technicalDebt: overrides.technicalDebt || 15,
            },
            metrics: overrides.metrics || [
                { name: 'Code Coverage', value: 78.5, status: 'good', trend: 'up' },
                { name: 'Code Complexity', value: 12, status: 'optimal', trend: 'down' },
                { name: 'Bug Density', value: 2.3, status: 'good', trend: 'down' },
                { name: 'Documentation', value: 85, status: 'excellent', trend: 'stable' },
            ],
            recommendations: overrides.recommendations || [
                'Increase test coverage for critical paths',
                'Reduce complexity in legacy modules',
                'Improve documentation coverage',
            ],
        },
        ...overrides,
    };
}

/**
 * Security audit report template
 * @param {object} overrides - Properties to override
 * @returns {object} Security audit report object
 */
function createSecurityAuditReportTemplate(overrides = {}) {
    return {
        reportInfo: {
            name: overrides.name || 'Security Audit Report',
            description: overrides.description || 'Security vulnerabilities and compliance analysis',
            type: overrides.type || 'security',
            category: overrides.category || 'compliance',
            format: overrides.format || 'pdf',
            generated: overrides.generated || new Date().toISOString(),
            status: overrides.status || 'processing',
            version: overrides.version || '1.0.0',
        },
        metadata: createReportMetadataTemplate({
            id: 'report_003',
            size: 3145728,
            schedule: 'monthly',
            ...overrides.metadata,
        }),
        data: {
            summary: {
                totalVulnerabilities: overrides.totalVulnerabilities || 23,
                critical: overrides.critical || 2,
                high: overrides.high || 5,
                medium: overrides.medium || 10,
                low: overrides.low || 6,
                complianceScore: overrides.complianceScore || 78,
            },
            metrics: overrides.metrics || [
                { name: 'Security Score', value: 78, status: 'fair', trend: 'down' },
                { name: 'Compliance', value: 82, status: 'good', trend: 'stable' },
                { name: 'Vulnerability Response', value: 65, status: 'fair', trend: 'down' },
                { name: 'Security Training', value: 88, status: 'good', trend: 'up' },
            ],
            recommendations: overrides.recommendations || [
                'Address critical vulnerabilities immediately',
                'Improve vulnerability response time',
                'Increase security training frequency',
            ],
        },
        ...overrides,
    };
}

/**
 * Report template for reports system
 * @param {object} overrides - Properties to override
 * @returns {object} Report template object
 */
function createReportTemplate(overrides = {}) {
    return {
        id: overrides.id || 'template_001',
        name: overrides.name || 'Custom Report Template',
        description: overrides.description || 'Custom report template definition',
        category: overrides.category || 'custom',
        sections: overrides.sections || ['overview', 'metrics', 'recommendations'],
        format: overrides.format || 'pdf',
        version: overrides.version || '1.0.0',
        ...overrides,
    };
}

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

/**
 * Notification template
 * @param {string} type - Notification type
 * @param {string} message - Notification message
 * @param {object} overrides - Properties to override
 * @returns {object} Notification object
 */
function createNotificationTemplate(type, message, overrides = {}) {
    return {
        id: overrides.id || generateNotificationId(),
        type: type, // 'info', 'success', 'warning', 'error'
        message: message,
        title: overrides.title || type.charAt(0).toUpperCase() + type.slice(1),
        userId: overrides.userId || createUserTemplate().id,
        read: overrides.read !== undefined ? overrides.read : false,
        createdAt: overrides.createdAt || new Date().toISOString(),
        expiresAt: overrides.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: overrides.metadata || {},
        ...overrides,
    };
}

// ============================================================================
// CONFIGURATION TEMPLATES
// ============================================================================

/**
 * Application configuration template
 * @param {object} overrides - Properties to override
 * @returns {object} Configuration object
 */
function createConfigTemplate(overrides = {}) {
    return {
        environment: overrides.environment || 'development',
        version: overrides.version || '1.0.0',
        debug: overrides.debug !== undefined ? overrides.debug : true,
        features: overrides.features || {
            darkMode: true,
            notifications: true,
            analytics: true,
            betaFeatures: false,
        },
        api: overrides.api || {
            baseUrl: 'https://api.mock-data.local',
            timeout: 30000,
            retries: 3,
        },
        storage: overrides.storage || {
            type: 'local',
            maxSize: '10MB',
            encryption: false,
        },
        ...overrides,
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate initials from name
 * @param {string} name - Full name
 * @returns {string} Initials
 */
function generateInitials(name) {
    return name
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
}

/**
 * Generate request ID
 * @returns {string} Request ID
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate database record ID
 * @param {string} tableName - Table name
 * @returns {string} Database ID
 */
function generateDbId(tableName) {
    return `${tableName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate report ID
 * @returns {string} Report ID
 */
function generateReportId() {
    return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate notification ID
 * @returns {string} Notification ID
 */
function generateNotificationId() {
    return `ntf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// TEMPLATE COLLECTION
// ============================================================================

/**
 * Get all available templates
 * @returns {object} Object containing all template functions
 */
function getAllTemplates() {
    return {
    // User templates
        createUserTemplate,
        createAdminUserTemplate,
        createGuestUserTemplate,

        // API response templates
        createSuccessResponseTemplate,
        createErrorResponseTemplate,
        createPaginatedResponseTemplate,

        // Database record templates
        createDbRecordTemplate,
        createUserDbRecordTemplate,
        createPostDbRecordTemplate,

        // File system templates
        createFileTemplate,
        createDirectoryTemplate,

        // Project management templates
        createProjectTemplate,
        createTaskTemplate,
        createSprintTemplate,

        // Analytics templates
        createMetricTemplate,
        createAnalyticsReportTemplate,

        // Report templates
        createReportMetadataTemplate,
        createResourceUtilizationReportTemplate,
        createPerformanceReportTemplate,
        createCodeQualityReportTemplate,
        createSecurityAuditReportTemplate,
        createReportTemplate,

        // Notification templates
        createNotificationTemplate,

        // Configuration templates
        createConfigTemplate,

        // Helper functions
        generateInitials,
        generateRequestId,
        generateDbId,
        generateReportId,
        generateNotificationId,
    };
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
    // User templates
        createUserTemplate,
        createAdminUserTemplate,
        createGuestUserTemplate,

        // API response templates
        createSuccessResponseTemplate,
        createErrorResponseTemplate,
        createPaginatedResponseTemplate,

        // Database record templates
        createDbRecordTemplate,
        createUserDbRecordTemplate,
        createPostDbRecordTemplate,

        // File system templates
        createFileTemplate,
        createDirectoryTemplate,

        // Project management templates
        createProjectTemplate,
        createTaskTemplate,
        createSprintTemplate,

        // Analytics templates
        createMetricTemplate,
        createAnalyticsReportTemplate,

        // Report templates
        createReportMetadataTemplate,
        createResourceUtilizationReportTemplate,
        createPerformanceReportTemplate,
        createCodeQualityReportTemplate,
        createSecurityAuditReportTemplate,
        createReportTemplate,

        // Notification templates
        createNotificationTemplate,

        // Configuration templates
        createConfigTemplate,

        // Helper functions
        generateInitials,
        generateRequestId,
        generateDbId,
        generateReportId,
        generateNotificationId,

        // Template collection
        getAllTemplates,
    };
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.MockDataTemplates = {
    // User templates
        createUserTemplate,
        createAdminUserTemplate,
        createGuestUserTemplate,

        // API response templates
        createSuccessResponseTemplate,
        createErrorResponseTemplate,
        createPaginatedResponseTemplate,

        // Database record templates
        createDbRecordTemplate,
        createUserDbRecordTemplate,
        createPostDbRecordTemplate,

        // File system templates
        createFileTemplate,
        createDirectoryTemplate,

        // Project management templates
        createProjectTemplate,
        createTaskTemplate,
        createSprintTemplate,

        // Analytics templates
        createMetricTemplate,
        createAnalyticsReportTemplate,

        // Report templates
        createReportMetadataTemplate,
        createResourceUtilizationReportTemplate,
        createPerformanceReportTemplate,
        createCodeQualityReportTemplate,
        createSecurityAuditReportTemplate,
        createReportTemplate,

        // Notification templates
        createNotificationTemplate,

        // Configuration templates
        createConfigTemplate,

        // Helper functions
        generateInitials,
        generateRequestId,
        generateDbId,
        generateReportId,
        generateNotificationId,

        // Template collection
        getAllTemplates,
    };
}
