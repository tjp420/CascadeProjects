/**
 * Project Resources Data Adapter
 * 
 * Provides standardized data access for Project Resources features.
 * Integrates with central data processor and directory manager.
 * 
 * @class ProjectResourcesDataAdapter
 * @example
 * const adapter = new ProjectResourcesDataAdapter(centralManager, dataProcessor);
 * const billingData = await adapter.getBillingData();
 */
function __resolveAppLogger() {
    try { return require('../lib/app-logger'); } catch (e) {
        return { error: (...a) => console.error(...a), warn: () => {}, info: () => {}, debug: () => {} };
    }
}
const logger = __resolveAppLogger();

class ProjectResourcesDataAdapter {
    constructor(centralManager, dataProcessor) {
        this.centralManager = centralManager;
        this.dataProcessor = dataProcessor;
        this.featureConfig = centralManager.getFeatureConfig('projectResources');
        this.paths = centralManager.getFeaturePaths('projectResources');
        this.cache = new Map();
        this.initialized = false;
        
        this.initialize();
    }

    /**
     * Initialize the adapter
     */
    async initialize() {
        try {
            // Subscribe to directory changes
            this.centralManager.subscribe('projectResources', this.handleDirectoryChange.bind(this));
            
            // Validate directories
            await this.validateDirectories();
            
            this.initialized = true;
            logger.debug('✅ Project Resources Data Adapter initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize Project Resources Data Adapter:', error);
            throw error;
        }
    }

    /**
     * Validate required directories
     */
    async validateDirectories() {
        const validation = await this.centralManager.validateDirectory('projectResources');
        if (!validation.valid) {
            logger.warn('⚠️ Project Resources directory validation failed:', validation.error);
        }
    }

    /**
     * Handle directory changes
     * @param {Object} change - Change information
     */
    handleDirectoryChange(change) {
        logger.debug('🔄 Project Resources directory changed:', change);
        this.clearCache();
    }

    /**
     * Get billing data
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Billing data
     */
    async getBillingData(options = {}) {
        try {
            const cacheKey = 'billing-data';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockBillingData();
            const result = await this.dataProcessor.processData('projectResources', 'billing-data', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get billing data:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get report templates
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Report templates
     */
    async getReportTemplates(options = {}) {
        try {
            const cacheKey = 'report-templates';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockReportTemplates();
            const result = await this.dataProcessor.processData('projectResources', 'report-templates', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get report templates:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get assets
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Assets
     */
    async getAssets(options = {}) {
        try {
            const cacheKey = 'assets';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockAssets();
            const result = await this.dataProcessor.processData('projectResources', 'assets', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get assets:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get code templates
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Code templates
     */
    async getCodeTemplates(options = {}) {
        try {
            const cacheKey = 'code-templates';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockCodeTemplates();
            const result = await this.dataProcessor.processData('projectResources', 'code-templates', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get code templates:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get coverage data
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Coverage data
     */
    async getCoverageData(options = {}) {
        try {
            const cacheKey = 'coverage-data';
            
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const mockData = this.generateMockCoverageData();
            const result = await this.dataProcessor.processData('projectResources', 'coverage-data', mockData, options);
            
            if (result.success) {
                if (options.cache !== false) {
                    this.cache.set(cacheKey, result);
                }
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            logger.error('❌ Failed to get coverage data:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Save billing data
     * @param {Object} data - Billing data to save
     * @returns {Promise<Object>} Save result
     */
    async saveBillingData(data) {
        try {
            const result = await this.dataProcessor.processData('projectResources', 'billing-data', data, { 
                action: 'save' 
            });
            
            this.clearCache('billing-data');
            
            this.centralManager.notify('projectResources', {
                type: 'data-saved',
                dataType: 'billing-data',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save billing data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save report templates
     * @param {Object} data - Report templates to save
     * @returns {Promise<Object>} Save result
     */
    async saveReportTemplates(data) {
        try {
            const result = await this.dataProcessor.processData('projectResources', 'report-templates', data, { 
                action: 'save' 
            });
            
            this.clearCache('report-templates');
            
            this.centralManager.notify('projectResources', {
                type: 'data-saved',
                dataType: 'report-templates',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save report templates:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save assets
     * @param {Object} data - Assets to save
     * @returns {Promise<Object>} Save result
     */
    async saveAssets(data) {
        try {
            const result = await this.dataProcessor.processData('projectResources', 'assets', data, { 
                action: 'save' 
            });
            
            this.clearCache('assets');
            
            this.centralManager.notify('projectResources', {
                type: 'data-saved',
                dataType: 'assets',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save assets:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save code templates
     * @param {Object} data - Code templates to save
     * @returns {Promise<Object>} Save result
     */
    async saveCodeTemplates(data) {
        try {
            const result = await this.dataProcessor.processData('projectResources', 'code-templates', data, { 
                action: 'save' 
            });
            
            this.clearCache('code-templates');
            
            this.centralManager.notify('projectResources', {
                type: 'data-saved',
                dataType: 'code-templates',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save code templates:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save coverage data
     * @param {Object} data - Coverage data to save
     * @returns {Promise<Object>} Save result
     */
    async saveCoverageData(data) {
        try {
            const result = await this.dataProcessor.processData('projectResources', 'coverage-data', data, { 
                action: 'save' 
            });
            
            this.clearCache('coverage-data');
            
            this.centralManager.notify('projectResources', {
                type: 'data-saved',
                dataType: 'coverage-data',
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Failed to save coverage data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all project resources data
     * @param {Object} options - Query options
     * @returns {Promise<Object>} All project resources data
     */
    async getAllData(options = {}) {
        try {
            const [billingData, reportTemplates, assets, codeTemplates, coverageData] = await Promise.all([
                this.getBillingData(options),
                this.getReportTemplates(options),
                this.getAssets(options),
                this.getCodeTemplates(options),
                this.getCoverageData(options)
            ]);

            return {
                success: true,
                data: {
                    billingData: billingData.data,
                    reportTemplates: reportTemplates.data,
                    assets: assets.data,
                    codeTemplates: codeTemplates.data,
                    coverageData: coverageData.data
                },
                metadata: {
                    features: this.featureConfig.features,
                    dataTypes: this.featureConfig.dataTypes,
                    retrievedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.error('❌ Failed to get all project resources data:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Validate billing data
     * @param {Object} data - Billing data to validate
     * @returns {Object} Validation result
     */
    validateBillingData(data) {
        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Check required fields
        if (!data.subscriptions || !Array.isArray(data.subscriptions)) {
            validation.valid = false;
            validation.errors.push('Subscriptions array is required');
        }

        if (!data.payments || !Array.isArray(data.payments)) {
            validation.valid = false;
            validation.errors.push('Payments array is required');
        }

        // Validate subscriptions
        if (data.subscriptions) {
            data.subscriptions.forEach((sub, index) => {
                if (!sub.plan || !sub.status) {
                    validation.valid = false;
                    validation.errors.push(`Subscription ${index + 1} must have plan and status`);
                }
            });
        }

        return validation;
    }

    /**
     * Validate asset data
     * @param {Object} data - Asset data to validate
     * @returns {Object} Validation result
     */
    validateAssetData(data) {
        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Check required fields
        if (!data.assets || !Array.isArray(data.assets)) {
            validation.valid = false;
            validation.errors.push('Assets array is required');
        }

        // Validate assets
        if (data.assets) {
            data.assets.forEach((asset, index) => {
                if (!asset.name || !asset.type) {
                    validation.valid = false;
                    validation.errors.push(`Asset ${index + 1} must have name and type`);
                }
            });
        }

        return validation;
    }

    /**
     * Generate mock billing data
     * @returns {Object} Mock billing data
     */
    generateMockBillingData() {
        return {
            timestamp: new Date().toISOString(),
            type: 'billing-data',
            subscriptions: [
                {
                    id: 'sub-001',
                    plan: 'Pro Plan',
                    status: 'active',
                    billingCycle: 'monthly',
                    amount: 99.99,
                    currency: 'USD',
                    startDate: '2026-01-01T00:00:00.000Z',
                    nextBillingDate: '2026-06-01T00:00:00.000Z',
                    features: [
                        'Unlimited projects',
                        'Advanced analytics',
                        'Priority support',
                        'Custom integrations'
                    ],
                    usage: {
                        projects: 15,
                        storage: 75.5,
                        apiCalls: 125000,
                        users: 8
                    },
                    limits: {
                        projects: 100,
                        storage: 500,
                        apiCalls: 1000000,
                        users: 50
                    }
                },
                {
                    id: 'sub-002',
                    plan: 'Storage Add-on',
                    status: 'active',
                    billingCycle: 'monthly',
                    amount: 29.99,
                    currency: 'USD',
                    startDate: '2026-02-15T00:00:00.000Z',
                    nextBillingDate: '2026-06-15T00:00:00.000Z',
                    features: [
                        'Additional 500GB storage',
                        'Backup retention',
                        'File versioning'
                    ],
                    usage: {
                        storage: 125.5
                    },
                    limits: {
                        storage: 500
                    }
                }
            ],
            payments: [
                {
                    id: 'pay-001',
                    subscriptionId: 'sub-001',
                    amount: 99.99,
                    currency: 'USD',
                    status: 'completed',
                    date: '2026-05-01T00:00:00.000Z',
                    method: 'credit_card',
                    cardType: 'Visa',
                    cardLastFour: '4242',
                    invoiceUrl: 'https://billing.example.com/invoices/pay-001'
                },
                {
                    id: 'pay-002',
                    subscriptionId: 'sub-002',
                    amount: 29.99,
                    currency: 'USD',
                    status: 'completed',
                    date: '2026-05-15T00:00:00.000Z',
                    method: 'credit_card',
                    cardType: 'Mastercard',
                    cardLastFour: '8888',
                    invoiceUrl: 'https://billing.example.com/invoices/pay-002'
                }
            ],
            billingSummary: {
                totalMonthlyCost: 129.98,
                totalAnnualCost: 1559.76,
                nextPaymentDate: '2026-06-01T00:00:00.000Z',
                totalPaidThisYear: 649.92,
                paymentMethod: {
                    type: 'credit_card',
                    cardType: 'Visa',
                    cardLastFour: '4242',
                    expiresOn: '12/2024'
                }
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate mock report templates
     * @returns {Object} Mock report templates
     */
    generateMockReportTemplates() {
        return {
            timestamp: new Date().toISOString(),
            type: 'report-templates',
            templates: [
                {
                    id: 'template-001',
                    name: 'Monthly Performance Report',
                    description: 'Comprehensive monthly performance metrics and analytics',
                    category: 'Performance',
                    format: 'pdf',
                    sections: [
                        {
                            name: 'Executive Summary',
                            type: 'text',
                            required: true
                        },
                        {
                            name: 'Key Metrics',
                            type: 'charts',
                            required: true
                        },
                        {
                            name: 'Project Overview',
                            type: 'table',
                            required: true
                        },
                        {
                            name: 'Technical Debt Analysis',
                            type: 'charts',
                            required: false
                        },
                        {
                            name: 'Recommendations',
                            type: 'text',
                            required: false
                        }
                    ],
                    schedule: {
                        enabled: true,
                        frequency: 'monthly',
                        day: 1,
                        time: '09:00',
                        timezone: 'UTC'
                    },
                    recipients: [
                        {
                            email: 'manager@example.com',
                            role: 'manager'
                        },
                        {
                            email: 'team@example.com',
                            role: 'team'
                        }
                    ],
                    lastGenerated: '2026-05-01T09:00:00.000Z',
                    nextScheduled: '2026-06-01T09:00:00.000Z'
                },
                {
                    id: 'template-002',
                    name: 'Technical Debt Report',
                    description: 'Detailed technical debt analysis and reduction recommendations',
                    category: 'Technical Debt',
                    format: 'html',
                    sections: [
                        {
                            name: 'Debt Overview',
                            type: 'summary',
                            required: true
                        },
                        {
                            name: 'Category Breakdown',
                            type: 'charts',
                            required: true
                        },
                        {
                            name: 'Reduction Progress',
                            type: 'progress',
                            required: true
                        },
                        {
                            name: 'ROI Analysis',
                            type: 'financial',
                            required: false
                        }
                    ],
                    schedule: {
                        enabled: true,
                        frequency: 'weekly',
                        day: 'friday',
                        time: '16:00',
                        timezone: 'UTC'
                    },
                    recipients: [
                        {
                            email: 'dev-team@example.com',
                            role: 'developer'
                        }
                    ],
                    lastGenerated: '2026-05-21T16:00:00.000Z',
                    nextScheduled: '2026-05-28T16:00:00.000Z'
                },
                {
                    id: 'template-003',
                    name: 'Project Status Dashboard',
                    description: 'Real-time project status and progress overview',
                    category: 'Project Management',
                    format: 'dashboard',
                    sections: [
                        {
                            name: 'Active Projects',
                            type: 'cards',
                            required: true
                        },
                        {
                            name: 'Progress Metrics',
                            type: 'gauge',
                            required: true
                        },
                        {
                            name: 'Team Performance',
                            type: 'charts',
                            required: true
                        },
                        {
                            name: 'Upcoming Milestones',
                            type: 'timeline',
                            required: false
                        }
                    ],
                    schedule: {
                        enabled: false
                    },
                    recipients: [],
                    lastGenerated: '2026-05-21T14:30:00.000Z',
                    nextScheduled: null
                }
            ],
            categories: ['Performance', 'Technical Debt', 'Project Management', 'Analytics', 'Custom'],
            formats: ['pdf', 'html', 'excel', 'dashboard'],
            summary: {
                totalTemplates: 3,
                activeSchedules: 2,
                categories: 5,
                formats: 4,
                lastUpdated: new Date().toISOString()
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate mock assets
     * @returns {Object} Mock assets
     */
    generateMockAssets() {
        return {
            timestamp: new Date().toISOString(),
            type: 'assets-library',
            assets: [
                {
                    id: 'asset-001',
                    name: 'Logo - Primary',
                    type: 'image',
                    category: 'Branding',
                    format: 'png',
                    size: 245760,
                    url: '/assets/logo-primary.png',
                    thumbnailUrl: '/assets/logo-primary-thumb.png',
                    description: 'Primary company logo for official use',
                    tags: ['logo', 'branding', 'official'],
                    metadata: {
                        dimensions: { width: 1200, height: 400 },
                        colorSpace: 'RGB',
                        dpi: 300,
                        created: '2026-01-15T10:00:00.000Z',
                        modified: '2026-03-10T14:30:00.000Z'
                    },
                    permissions: {
                        view: ['all'],
                        edit: ['admin', 'designer'],
                        download: ['all']
                    }
                },
                {
                    id: 'asset-002',
                    name: 'Brand Guidelines',
                    type: 'document',
                    category: 'Branding',
                    format: 'pdf',
                    size: 5242880,
                    url: '/assets/brand-guidelines.pdf',
                    thumbnailUrl: '/assets/brand-guidelines-thumb.png',
                    description: 'Complete brand guidelines and usage rules',
                    tags: ['branding', 'guidelines', 'documentation'],
                    metadata: {
                        pages: 24,
                        version: '2.1',
                        created: '2026-01-20T11:00:00.000Z',
                        modified: '2026-04-15T09:15:00.000Z'
                    },
                    permissions: {
                        view: ['all'],
                        edit: ['admin'],
                        download: ['all']
                    }
                },
                {
                    id: 'asset-003',
                    name: 'Hero Video',
                    type: 'video',
                    category: 'Marketing',
                    format: 'mp4',
                    size: 52428800,
                    url: '/assets/hero-video.mp4',
                    thumbnailUrl: '/assets/hero-video-thumb.jpg',
                    description: 'Hero video for landing page',
                    tags: ['video', 'marketing', 'landing-page'],
                    metadata: {
                        duration: 45,
                        resolution: { width: 1920, height: 1080 },
                        fps: 30,
                        codec: 'H.264',
                        created: '2026-02-10T13:45:00.000Z',
                        modified: '2026-05-05T16:20:00.000Z'
                    },
                    permissions: {
                        view: ['all'],
                        edit: ['admin', 'video-editor'],
                        download: ['admin', 'marketing']
                    }
                },
                {
                    id: 'asset-004',
                    name: 'Icon Set',
                    type: 'archive',
                    category: 'UI',
                    format: 'zip',
                    size: 1048576,
                    url: '/assets/icon-set.zip',
                    thumbnailUrl: '/assets/icon-set-thumb.png',
                    description: 'Complete icon set in multiple formats',
                    tags: ['icons', 'ui', 'design'],
                    metadata: {
                        files: 150,
                        formats: ['svg', 'png', 'ico'],
                        created: '2026-01-25T15:30:00.000Z',
                        modified: '2026-04-20T10:45:00.000Z'
                    },
                    permissions: {
                        view: ['all'],
                        edit: ['admin', 'designer'],
                        download: ['all']
                    }
                },
                {
                    id: 'asset-005',
                    name: 'Product Screenshots',
                    type: 'folder',
                    category: 'Product',
                    format: 'collection',
                    size: 15728640,
                    url: '/assets/screenshots/',
                    thumbnailUrl: '/assets/screenshots-thumb.jpg',
                    description: 'Product interface screenshots',
                    tags: ['screenshots', 'product', 'ui'],
                    metadata: {
                        itemCount: 25,
                        formats: ['png', 'jpg'],
                        created: '2026-03-15T12:00:00.000Z',
                        modified: '2026-05-18T14:00:00.000Z'
                    },
                    permissions: {
                        view: ['all'],
                        edit: ['admin', 'product-team'],
                        download: ['all']
                    }
                }
            ],
            categories: ['Branding', 'Marketing', 'UI', 'Product', 'Documentation'],
            formats: ['png', 'pdf', 'mp4', 'zip', 'collection'],
            summary: {
                totalAssets: 5,
                totalSize: 73400384,
                categories: 5,
                formats: 5,
                lastUpdated: new Date().toISOString()
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate mock code templates
     * @returns {Object} Mock code templates
     */
    generateMockCodeTemplates() {
        return {
            timestamp: new Date().toISOString(),
            type: 'code-templates',
            templates: [
                {
                    id: 'template-001',
                    name: 'React Component',
                    description: 'Standard React component template with hooks',
                    category: 'Frontend',
                    language: 'javascript',
                    framework: 'react',
                    template: `import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const {{componentName}} = ({ initialData, onAction }) => {
  const [data, setData] = useState(initialData || {});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Component initialization logic
  }, []);

  const handleAction = () => {
    onAction(data);
  };

  return (
    <div className="{{componentName}}">
      {/* Component JSX */}
    </div>
  );
};

{{componentName}}.propTypes = {
  initialData: PropTypes.object,
  onAction: PropTypes.func
};

{{componentName}}.defaultProps = {
  initialData: {},
  onAction: () => {}
};

export default {{componentName}};`,
                    variables: [
                        {
                            name: 'componentName',
                            type: 'string',
                            description: 'Name of the component',
                            required: true
                        }
                    ],
                    tags: ['react', 'component', 'hooks', 'frontend'],
                    usage: {
                        totalUsed: 45,
                        lastUsed: '2026-05-20T10:30:00.000Z',
                        popular: true
                    }
                },
                {
                    id: 'template-002',
                    name: 'API Endpoint',
                    description: 'Express.js API endpoint template',
                    category: 'Backend',
                    language: 'javascript',
                    framework: 'express',
                    template: `const express = require('express');
const router = express.Router();
const {{modelName}} = require('../models/{{modelName}}');

// GET /{{endpointName}}
router.get('/{{endpointName}}', async (req, res) => {
  try {
    const items = await {{modelName}}.findAll();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /{{endpointName}}
router.post('/{{endpointName}}', async (req, res) => {
  try {
    const newItem = await {{modelName}}.create(req.body);
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /{{endpointName}}/:id
router.put('/{{endpointName}}/:id', async (req, res) => {
  try {
    const [updated] = await {{modelName}}.update(req.body, {
      where: { id: req.params.id }
    });
    
    if (updated) {
      const item = await {{modelName}}.findByPk(req.params.id);
      res.json({ success: true, data: item });
    } else {
      res.status(404).json({ success: false, error: 'Not found' });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /{{endpointName}}/:id
router.delete('/{{endpointName}}/:id', async (req, res) => {
  try {
    const deleted = await {{modelName}}.destroy({
      where: { id: req.params.id }
    });
    
    if (deleted) {
      res.json({ success: true, message: 'Deleted successfully' });
    } else {
      res.status(404).json({ success: false, error: 'Not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;`,
                    variables: [
                        {
                            name: 'modelName',
                            type: 'string',
                            description: 'Name of the model',
                            required: true
                        },
                        {
                            name: 'endpointName',
                            type: 'string',
                            description: 'Name of the endpoint',
                            required: true
                        }
                    ],
                    tags: ['express', 'api', 'backend', 'rest'],
                    usage: {
                        totalUsed: 28,
                        lastUsed: '2026-05-19T15:45:00.000Z',
                        popular: false
                    }
                },
                {
                    id: 'template-003',
                    name: 'Database Migration',
                    description: 'Sequelize database migration template',
                    category: 'Database',
                    language: 'javascript',
                    framework: 'sequelize',
                    template: `'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('{{tableName}}', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      {{#each columns}}
      {{name}}: {
        type: Sequelize.{{type}},
        allowNull: {{allowNull}},
        {{#if defaultValue}}
        defaultValue: {{defaultValue}},
        {{/if}}
        {{#if unique}}
        unique: true,
        {{/if}}
      },
      {{/each}}
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('{{tableName}}');
  }
};`,
                    variables: [
                        {
                            name: 'tableName',
                            type: 'string',
                            description: 'Name of the table',
                            required: true
                        },
                        {
                            name: 'columns',
                            type: 'array',
                            description: 'Array of column definitions',
                            required: true
                        }
                    ],
                    tags: ['sequelize', 'migration', 'database', 'sql'],
                    usage: {
                        totalUsed: 15,
                        lastUsed: '2026-05-18T09:20:00.000Z',
                        popular: false
                    }
                },
                {
                    id: 'template-004',
                    name: 'Test Suite',
                    description: 'Jest test suite template',
                    category: 'Testing',
                    language: 'javascript',
                    framework: 'jest',
                    template: `const {{moduleName}} = require('../{{moduleName}}');

describe('{{moduleName}}', () => {
  describe('constructor', () => {
    it('should create an instance with valid parameters', () => {
      const instance = new {{moduleName}}({{#if constructorParams}}{{constructorParams}}{{/if}});
      expect(instance).toBeInstanceOf({{moduleName}});
    });

    it('should throw error with invalid parameters', () => {
      expect(() => new {{moduleName}}()).toThrow();
    });
  });

  describe('methods', () => {
    let instance;

    beforeEach(() => {
      instance = new {{moduleName}}({{#if constructorParams}}{{constructorParams}}{{/if}});
    });

    {{#each methods}}
    describe('{{name}}', () => {
      it('should return expected result', async () => {
        const result = await instance.{{name}}({{#if params}}{{params}}{{/if}});
        expect(result).toBeDefined();
      });

      it('should handle errors gracefully', async () => {
        // Test error handling
      });
    });
    {{/each}}
  });

  describe('edge cases', () => {
    it('should handle null/undefined inputs', () => {
      // Test edge cases
    });

    it('should handle empty arrays/objects', () => {
      // Test edge cases
    });
  });
});`,
                    variables: [
                        {
                            name: 'moduleName',
                            type: 'string',
                            description: 'Name of the module being tested',
                            required: true
                        },
                        {
                            name: 'constructorParams',
                            type: 'string',
                            description: 'Parameters for constructor',
                            required: false
                        },
                        {
                            name: 'methods',
                            type: 'array',
                            description: 'Array of methods to test',
                            required: false
                        }
                    ],
                    tags: ['jest', 'test', 'unit-test', 'testing'],
                    usage: {
                        totalUsed: 67,
                        lastUsed: '2026-05-21T11:15:00.000Z',
                        popular: true
                    }
                }
            ],
            categories: ['Frontend', 'Backend', 'Database', 'Testing', 'Utilities'],
            languages: ['javascript', 'typescript', 'python', 'java'],
            frameworks: ['react', 'express', 'sequelize', 'jest'],
            summary: {
                totalTemplates: 4,
                categories: 5,
                languages: 4,
                frameworks: 4,
                totalUsage: 155,
                lastUpdated: new Date().toISOString()
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Generate mock coverage data
     * @returns {Object} Mock coverage data
     */
    generateMockCoverageData() {
        return {
            timestamp: new Date().toISOString(),
            type: 'coverage-reports',
            reports: [
                {
                    id: 'coverage-001',
                    name: 'Frontend Coverage',
                    description: 'Test coverage for frontend components',
                    category: 'Frontend',
                    framework: 'React',
                    generated: '2026-05-21T14:30:00.000Z',
                    summary: {
                        total: 87.5,
                        lines: 89.2,
                        functions: 85.7,
                        branches: 82.3,
                        statements: 88.1
                    },
                    files: [
                        {
                            name: 'src/components/Dashboard.js',
                            lines: {
                                total: 156,
                                covered: 142,
                                percentage: 91.0
                            },
                            functions: {
                                total: 12,
                                covered: 11,
                                percentage: 91.7
                            },
                            branches: {
                                total: 34,
                                covered: 28,
                                percentage: 82.4
                            },
                            statements: {
                                total: 156,
                                covered: 142,
                                percentage: 91.0
                            }
                        },
                        {
                            name: 'src/components/Header.js',
                            lines: {
                                total: 89,
                                covered: 78,
                                percentage: 87.6
                            },
                            functions: {
                                total: 8,
                                covered: 7,
                                percentage: 87.5
                            },
                            branches: {
                                total: 22,
                                covered: 18,
                                percentage: 81.8
                            },
                            statements: {
                                total: 89,
                                covered: 78,
                                percentage: 87.6
                            }
                        },
                        {
                            name: 'src/utils/api.js',
                            lines: {
                                total: 124,
                                covered: 118,
                                percentage: 95.2
                            },
                            functions: {
                                total: 15,
                                covered: 14,
                                percentage: 93.3
                            },
                            branches: {
                                total: 28,
                                covered: 25,
                                percentage: 89.3
                            },
                            statements: {
                                total: 124,
                                covered: 118,
                                percentage: 95.2
                            }
                        }
                    ],
                    thresholds: {
                        global: {
                            lines: 80,
                            functions: 80,
                            branches: 80,
                            statements: 80
                        },
                        individual: {
                            lines: 70,
                            functions: 70,
                            branches: 70,
                            statements: 70
                        }
                    },
                    status: 'pass'
                },
                {
                    id: 'coverage-002',
                    name: 'Backend Coverage',
                    description: 'Test coverage for backend API endpoints',
                    category: 'Backend',
                    framework: 'Express',
                    generated: '2026-05-21T14:25:00.000Z',
                    summary: {
                        total: 82.1,
                        lines: 84.5,
                        functions: 79.8,
                        branches: 76.2,
                        statements: 85.3
                    },
                    files: [
                        {
                            name: 'src/controllers/user.js',
                            lines: {
                                total: 198,
                                covered: 175,
                                percentage: 88.4
                            },
                            functions: {
                                total: 18,
                                covered: 16,
                                percentage: 88.9
                            },
                            branches: {
                                total: 42,
                                covered: 35,
                                percentage: 83.3
                            },
                            statements: {
                                total: 198,
                                covered: 175,
                                percentage: 88.4
                            }
                        },
                        {
                            name: 'src/controllers/project.js',
                            lines: {
                                total: 167,
                                covered: 142,
                                percentage: 85.0
                            },
                            functions: {
                                total: 14,
                                covered: 11,
                                percentage: 78.6
                            },
                            branches: {
                                total: 38,
                                covered: 28,
                                percentage: 73.7
                            },
                            statements: {
                                total: 167,
                                covered: 142,
                                percentage: 85.0
                            }
                        },
                        {
                            name: 'src/middleware/auth.js',
                            lines: {
                                total: 89,
                                covered: 76,
                                percentage: 85.4
                            },
                            functions: {
                                total: 9,
                                covered: 7,
                                percentage: 77.8
                            },
                            branches: {
                                total: 24,
                                covered: 18,
                                percentage: 75.0
                            },
                            statements: {
                                total: 89,
                                covered: 76,
                                percentage: 85.4
                            }
                        }
                    ],
                    thresholds: {
                        global: {
                            lines: 80,
                            functions: 80,
                            branches: 75,
                            statements: 80
                        },
                        individual: {
                            lines: 70,
                            functions: 70,
                            branches: 65,
                            statements: 70
                        }
                    },
                    status: 'pass'
                },
                {
                    id: 'coverage-003',
                    name: 'Integration Coverage',
                    description: 'End-to-end integration test coverage',
                    category: 'Integration',
                    framework: 'Cypress',
                    generated: '2026-05-21T13:45:00.000Z',
                    summary: {
                        total: 78.9,
                        lines: 81.2,
                        functions: 75.6,
                        branches: 72.1,
                        statements: 80.3
                    },
                    files: [
                        {
                            name: 'tests/integration/user-flow.js',
                            lines: {
                                total: 145,
                                covered: 118,
                                percentage: 81.4
                            },
                            functions: {
                                total: 12,
                                covered: 9,
                                percentage: 75.0
                            },
                            branches: {
                                total: 32,
                                covered: 22,
                                percentage: 68.8
                            },
                            statements: {
                                total: 145,
                                covered: 118,
                                percentage: 81.4
                            }
                        },
                        {
                            name: 'tests/integration/api-tests.js',
                            lines: {
                                total: 178,
                                covered: 145,
                                percentage: 81.5
                            },
                            functions: {
                                total: 16,
                                covered: 13,
                                percentage: 81.3
                            },
                            branches: {
                                total: 40,
                                covered: 30,
                                percentage: 75.0
                            },
                            statements: {
                                total: 178,
                                covered: 145,
                                percentage: 81.5
                            }
                        }
                    ],
                    thresholds: {
                        global: {
                            lines: 75,
                            functions: 75,
                            branches: 70,
                            statements: 75
                        },
                        individual: {
                            lines: 65,
                            functions: 65,
                            branches: 60,
                            statements: 65
                        }
                    },
                    status: 'pass'
                }
            ],
            trends: {
                frontend: [
                    { date: '2026-05-01', coverage: 85.2 },
                    { date: '2026-05-08', coverage: 86.1 },
                    { date: '2026-05-15', coverage: 86.8 },
                    { date: '2026-05-21', coverage: 87.5 }
                ],
                backend: [
                    { date: '2026-05-01', coverage: 79.5 },
                    { date: '2026-05-08', coverage: 80.3 },
                    { date: '2026-05-15', coverage: 81.2 },
                    { date: '2026-05-21', coverage: 82.1 }
                ],
                integration: [
                    { date: '2026-05-01', coverage: 76.8 },
                    { date: '2026-05-08', coverage: 77.5 },
                    { date: '2026-05-15', coverage: 78.2 },
                    { date: '2026-05-21', coverage: 78.9 }
                ]
            },
            summary: {
                totalReports: 3,
                averageCoverage: 82.8,
                categories: ['Frontend', 'Backend', 'Integration'],
                lastUpdated: new Date().toISOString()
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Clear cache entries
     * @param {string} key - Specific cache key to clear (optional)
     */
    clearCache(key = null) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Get adapter status
     * @returns {Object} Adapter status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            cacheSize: this.cache.size,
            paths: this.paths,
            featureConfig: this.featureConfig,
            lastUpdate: new Date().toISOString()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectResourcesDataAdapter;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.ProjectResourcesDataAdapter = ProjectResourcesDataAdapter;
}
