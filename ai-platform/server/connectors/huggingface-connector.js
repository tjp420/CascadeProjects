/**
 * Hugging Face Connector
 * 
 * Connects to Hugging Face API for:
 * - Model information and metadata
 * - Dataset access and downloads
 * - Model performance metrics
 * - Usage statistics
 */

const logger = require('../lib/app-logger');

const BaseConnector = require('./base-connector');

class HuggingFaceConnector extends BaseConnector {
    constructor(config = {}) {
        super({
            id: 'huggingface',
            name: 'Hugging Face',
            type: 'ai',
            version: '1.0.0',
            baseUrl: 'https://huggingface.co/api',
            ...config
        });
        
        this.apiToken = config.apiToken || process.env.HUGGINGFACE_API_TOKEN;
        this.organization = config.organization;
    }
    
    async onInitialize() {
        if (!this.apiToken) {
            logger.warn('[HuggingFace] No API token provided, limited access available');
        }
    }
    
    async onConnect() {
        // Test API connection
        await this.test();
    }
    
    async onTest() {
        try {
            const _response = await this.request('GET', '/models', null, {
                params: { limit: 1 }
            });
            return { status: 'ok', apiAccessible: true };
        } catch (error) {
            throw new Error(`API connection failed: ${error.message}`);
        }
    }
    
    addAuthentication(config) {
        if (this.apiToken) {
            config.headers = {
                ...config.headers,
                'Authorization': `Bearer ${this.apiToken}`
            };
        }
    }
    
    /**
     * Get model information
     */
    async getModel(modelId) {
        return await this.request('GET', `/models/${modelId}`);
    }
    
    /**
     * List models with filters
     */
    async listModels(options = {}) {
        const params = {
            limit: options.limit || 50,
            sort: options.sort || 'downloads',
            direction: options.direction || -1,
            ...options.filters
        };
        
        return await this.request('GET', '/models', null, { params });
    }
    
    /**
     * Get model metrics
     */
    async getModelMetrics(modelId) {
        const [model, downloads, likes] = await Promise.all([
            this.getModel(modelId),
            this.getModelDownloads(modelId),
            this.getModelLikes(modelId)
        ]);
        
        return {
            modelId,
            name: model.modelId,
            downloads: downloads,
            likes: likes,
            tags: model.tags,
            pipeline_type: model.pipeline_tag,
            library_name: model.library_name,
            created_at: model.created_at,
            last_modified: model.last_modified,
            metrics: {
                downloads_per_day: this.calculateDownloadsPerDay(downloads, model.created_at),
                like_ratio: likes > 0 ? (likes / downloads * 100).toFixed(2) : 0,
                popularity_score: this.calculatePopularityScore(downloads, likes)
            }
        };
    }
    
    /**
     * Get model downloads count
     */
    async getModelDownloads(modelId) {
        try {
            const response = await this.request('GET', `/models/${modelId}/downloads`);
            return response.downloads || 0;
        } catch (error) {
            logger.warn(`[HuggingFace] Could not get downloads for ${modelId}:`, error.message);
            return 0;
        }
    }
    
    /**
     * Get model likes count
     */
    async getModelLikes(modelId) {
        try {
            const response = await this.request('GET', `/models/${modelId}/likes`);
            return response.likes || 0;
        } catch (error) {
            logger.warn(`[HuggingFace] Could not get likes for ${modelId}:`, error.message);
            return 0;
        }
    }
    
    /**
     * Search models
     */
    async searchModels(query, options = {}) {
        const params = {
            search: query,
            limit: options.limit || 50,
            sort: options.sort || 'downloads',
            direction: options.direction || -1
        };
        
        return await this.request('GET', '/models', null, { params });
    }
    
    /**
     * Get dataset information
     */
    async getDataset(datasetId) {
        return await this.request('GET', `/datasets/${datasetId}`);
    }
    
    /**
     * List datasets
     */
    async listDatasets(options = {}) {
        const params = {
            limit: options.limit || 50,
            sort: options.sort || 'downloads',
            direction: options.direction || -1,
            ...options.filters
        };
        
        return await this.request('GET', '/datasets', null, { params });
    }
    
    /**
     * Get organization models
     */
    async getOrganizationModels(organization = this.organization) {
        if (!organization) {
            throw new Error('Organization name is required');
        }
        
        return await this.request('GET', `/models`, null, {
            params: { author: organization }
        });
    }
    
    /**
     * Get model files
     */
    async getModelFiles(modelId, revision = 'main') {
        return await this.request('GET', `/models/${modelId}/tree/${revision}`);
    }
    
    /**
     * Get model README
     */
    async getModelReadme(modelId, revision = 'main') {
        return await this.request('GET', `/models/${modelId}/raw/${revision}/README.md`);
    }
    
    /**
     * Get model usage statistics
     */
    async getModelUsageStats(modelId, timeRange = '30d') {
        // Hugging Face doesn't provide detailed usage stats via API
        // This would require web scraping or their analytics API
        const model = await this.getModel(modelId);
        
        return {
            modelId,
            timeRange,
            downloads: model.downloads || 0,
            estimated_daily_usage: this.estimateDailyUsage(model.downloads, model.created_at),
            popularity_trend: 'stable' // Would need historical data
        };
    }
    
    /**
     * Get trending models
     */
    async getTrendingModels(_timeRange = 'day', limit = 10) {
        // Hugging Face doesn't have a dedicated trending endpoint
        // We'll use recent models with high download counts
        const params = {
            sort: 'downloads',
            direction: -1,
            limit: limit * 2, // Get more to filter
            filter: 'downloads>1000'
        };
        
        const models = await this.request('GET', '/models', null, { params });
        
        // Filter for recent models (created within last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentModels = models.filter(model => 
            new Date(model.created_at) > thirtyDaysAgo
        );
        
        return recentModels.slice(0, limit);
    }
    
    /**
     * Get models by pipeline type
     */
    async getModelsByPipeline(pipelineType, limit = 50) {
        return await this.request('GET', '/models', null, {
            params: { 
                pipeline_tag: pipelineType,
                limit,
                sort: 'downloads',
                direction: -1
            }
        });
    }
    
    /**
     * Get model performance metrics (if available)
     */
    async getModelPerformance(modelId) {
        try {
            // Try to get model card with performance data
            const readme = await this.getModelReadme(modelId);
            
            // Extract performance metrics from README
            const performance = this.extractPerformanceFromReadme(readme);
            
            return {
                modelId,
                performance,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            return {
                modelId,
                performance: null,
                error: 'Performance data not available'
            };
        }
    }
    
    /**
     * Transform response data
     */
    async transformResponse(data) {
        // Add connector metadata
        if (Array.isArray(data)) {
            return data.map(item => ({
                ...item,
                _connector: {
                    id: this.id,
                    name: this.name,
                    timestamp: new Date().toISOString()
                }
            }));
        }
        
        return {
            ...data,
            _connector: {
                id: this.id,
                name: this.name,
                timestamp: new Date().toISOString()
            }
        };
    }
    
    // Helper methods
    
    calculateDownloadsPerDay(downloads, createdAt) {
        const created = new Date(createdAt);
        const now = new Date();
        const days = Math.max(1, Math.ceil((now - created) / (1000 * 60 * 60 * 24)));
        return Math.round(downloads / days);
    }
    
    calculatePopularityScore(downloads, likes) {
        // Simple popularity score calculation
        const downloadScore = Math.log10(downloads + 1) * 10;
        const likeScore = likes * 2;
        return Math.round(downloadScore + likeScore);
    }
    
    estimateDailyUsage(totalDownloads, createdAt) {
        const dailyDownloads = this.calculateDownloadsPerDay(totalDownloads, createdAt);
        return Math.round(dailyDownloads * 1.5); // Assume usage is higher than downloads
    }
    
    extractPerformanceFromReadme(readme) {
        // Simple regex-based extraction of performance metrics
        const performance = {};
        
        // Look for common performance metrics
        const metrics = ['accuracy', 'f1', 'precision', 'recall', 'bleu', 'rouge'];
        
        for (const metric of metrics) {
            const regex = new RegExp(`${metric}\\s*[:=]\\s*([0-9.]+)`, 'i');
            const match = readme.match(regex);
            if (match) {
                performance[metric] = parseFloat(match[1]);
            }
        }
        
        return Object.keys(performance).length > 0 ? performance : null;
    }
}

module.exports = HuggingFaceConnector;
