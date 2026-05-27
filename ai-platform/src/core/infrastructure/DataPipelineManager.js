/**
 * Data Pipeline Manager - Core Infrastructure Component
 * Handles data flow, processing, and storage for the AI platform
 */

class DataPipelineManager {
    constructor() {
        this.pipelines = new Map();
        this.processors = new Map();
        this.storage = new Map();
        this.metrics = {
            processed: 0,
            failed: 0,
            throughput: 0,
            latency: []
        };
        this.isRunning = false;
    }

    /**
     * Initialize the data pipeline system
     */
    async initialize() {
        console.log('🚀 Initializing Data Pipeline Manager...');
        
        // Setup core processors
        await this.setupProcessors();
        
        // Setup storage connections
        await this.setupStorage();
        
        // Initialize metrics collection
        this.startMetricsCollection();
        
        console.log('✅ Data Pipeline Manager initialized successfully');
    }

    /**
     * Setup data processors for different data types
     */
    async setupProcessors() {
        // Text data processor
        this.processors.set('text', {
            process: async (data) => {
                return {
                    processed: true,
                    content: data.content,
                    metadata: {
                        length: data.content.length,
                        processedAt: new Date().toISOString(),
                        type: 'text'
                    }
                };
            },
            validate: (data) => data && typeof data.content === 'string'
        });

        // JSON data processor
        this.processors.set('json', {
            process: async (data) => {
                try {
                    const parsed = JSON.parse(data.content);
                    return {
                        processed: true,
                        content: parsed,
                        metadata: {
                            keys: Object.keys(parsed),
                            processedAt: new Date().toISOString(),
                            type: 'json'
                        }
                    };
                } catch (error) {
                    throw new Error(`JSON processing failed: ${error.message}`);
                }
            },
            validate: (data) => data && typeof data.content === 'string'
        });

        // Binary data processor
        this.processors.set('binary', {
            process: async (data) => {
                return {
                    processed: true,
                    content: data.content,
                    metadata: {
                        size: data.content.length,
                        checksum: this.calculateChecksum(data.content),
                        processedAt: new Date().toISOString(),
                        type: 'binary'
                    }
                };
            },
            validate: (data) => data && Buffer.isBuffer(data.content)
        });

        console.log(`📊 Setup ${this.processors.size} data processors`);
    }

    /**
     * Setup storage connections
     */
    async setupStorage() {
        // In-memory storage for demonstration
        this.storage.set('memory', {
            type: 'memory',
            store: new Map(),
            save: async (key, data) => {
                this.storage.get('memory').store.set(key, data);
                return true;
            },
            retrieve: async (key) => {
                return this.storage.get('memory').store.get(key);
            },
            delete: async (key) => {
                return this.storage.get('memory').store.delete(key);
            }
        });

        // File-based storage
        this.storage.set('file', {
            type: 'file',
            basePath: './data/storage',
            save: async (key, data) => {
                const fs = require('fs').promises;
                const path = require('path');
                const filePath = path.join(this.storage.get('file').basePath, `${key}.json`);
                await fs.writeFile(filePath, JSON.stringify(data, null, 2));
                return true;
            },
            retrieve: async (key) => {
                const fs = require('fs').promises;
                const path = require('path');
                const filePath = path.join(this.storage.get('file').basePath, `${key}.json`);
                const content = await fs.readFile(filePath, 'utf8');
                return JSON.parse(content);
            },
            delete: async (key) => {
                const fs = require('fs').promises;
                const path = require('path');
                const filePath = path.join(this.storage.get('file').basePath, `${key}.json`);
                await fs.unlink(filePath);
                return true;
            }
        });

        console.log(`💾 Setup ${this.storage.size} storage systems`);
    }

    /**
     * Create a new data pipeline
     */
    createPipeline(name, config) {
        const pipeline = {
            id: this.generateId(),
            name,
            config,
            status: 'created',
            createdAt: new Date().toISOString(),
            processed: 0,
            failed: 0
        };

        this.pipelines.set(name, pipeline);
        console.log(`🔧 Created pipeline: ${name}`);
        return pipeline;
    }

    /**
     * Process data through a pipeline
     */
    async processData(pipelineName, data, storageType = 'memory') {
        const pipeline = this.pipelines.get(pipelineName);
        if (!pipeline) {
            throw new Error(`Pipeline ${pipelineName} not found`);
        }

        const startTime = Date.now();
        
        try {
            // Validate data
            const processor = this.processors.get(data.type);
            if (!processor) {
                throw new Error(`No processor found for data type: ${data.type}`);
            }

            if (!processor.validate(data)) {
                throw new Error(`Data validation failed for type: ${data.type}`);
            }

            // Process data
            const processed = await processor.process(data);

            // Store processed data
            const storage = this.storage.get(storageType);
            const storageKey = `${pipelineName}_${this.generateId()}`;
            await storage.save(storageKey, processed);

            // Update metrics
            this.metrics.processed++;
            pipeline.processed++;
            const latency = Date.now() - startTime;
            this.metrics.latency.push(latency);

            console.log(`✅ Processed data through ${pipelineName} in ${latency}ms`);
            
            return {
                success: true,
                data: processed,
                storageKey,
                processingTime: latency
            };

        } catch (error) {
            this.metrics.failed++;
            pipeline.failed++;
            console.error(`❌ Processing failed in ${pipelineName}:`, error.message);
            
            return {
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Start metrics collection
     */
    startMetricsCollection() {
        setInterval(() => {
            const recentLatency = this.metrics.latency.slice(-100);
            const avgLatency = recentLatency.length > 0 
                ? recentLatency.reduce((a, b) => a + b, 0) / recentLatency.length 
                : 0;

            this.metrics.throughput = this.metrics.processed / (Date.now() / 1000);
            this.metrics.avgLatency = avgLatency;

            // Keep only recent latency data
            if (this.metrics.latency.length > 1000) {
                this.metrics.latency = this.metrics.latency.slice(-100);
            }
        }, 5000);
    }

    /**
     * Get pipeline metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            pipelines: Array.from(this.pipelines.values()).map(p => ({
                name: p.name,
                status: p.status,
                processed: p.processed,
                failed: p.failed,
                successRate: p.processed > 0 ? (p.processed / (p.processed + p.failed)) * 100 : 0
            })),
            processors: Array.from(this.processors.keys()),
            storage: Array.from(this.storage.keys())
        };
    }

    /**
     * Calculate checksum for binary data
     */
    calculateChecksum(data) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(data).digest('hex');
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    /**
     * Start all pipelines
     */
    async start() {
        this.isRunning = true;
        console.log('🚀 Data Pipeline Manager started');
        
        // Start pipeline monitoring
        this.startPipelineMonitoring();
    }

    /**
     * Stop all pipelines
     */
    async stop() {
        this.isRunning = false;
        console.log('🛑 Data Pipeline Manager stopped');
    }

    /**
     * Monitor pipeline health
     */
    startPipelineMonitoring() {
        setInterval(() => {
            if (!this.isRunning) return;

            this.pipelines.forEach((pipeline, name) => {
                const successRate = pipeline.processed > 0 
                    ? (pipeline.processed / (pipeline.processed + pipeline.failed)) * 100 
                    : 0;

                if (successRate < 90 && pipeline.processed > 10) {
                    console.warn(`⚠️ Pipeline ${name} has low success rate: ${successRate.toFixed(2)}%`);
                }
            });
        }, 30000);
    }
}

module.exports = DataPipelineManager;
