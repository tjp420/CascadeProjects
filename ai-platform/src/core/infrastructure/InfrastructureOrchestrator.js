/**
 * Infrastructure Orchestrator - Core Infrastructure Component
 * Coordinates and manages all infrastructure components
 */

const DataPipelineManager = require('./DataPipelineManager');
const ModelServer = require('./ModelServer');
const APIGateway = require('./APIGateway');

class InfrastructureOrchestrator {
    constructor() {
        this.components = new Map();
        this.status = {
            initialized: false,
            running: false,
            health: 'unknown',
            lastHealthCheck: null
        };
        this.metrics = {
            uptime: 0,
            startTime: null,
            componentStatus: new Map(),
            systemLoad: {
                cpu: 0,
                memory: 0,
                disk: 0
            }
        };
    }

    /**
     * Initialize all infrastructure components
     */
    async initialize() {
        console.log('🚀 Initializing Infrastructure Orchestrator...');
        
        try {
            // Initialize Data Pipeline Manager
            const dataPipelineManager = new DataPipelineManager();
            await dataPipelineManager.initialize();
            this.components.set('dataPipeline', dataPipelineManager);

            // Initialize Model Server
            const modelServer = new ModelServer();
            await modelServer.initialize();
            this.components.set('modelServer', modelServer);

            // Initialize API Gateway
            const apiGateway = new APIGateway();
            await apiGateway.initialize();
            this.components.set('apiGateway', apiGateway);

            // Setup component communication
            await this.setupComponentCommunication();

            // Start health monitoring
            this.startHealthMonitoring();

            // Update status
            this.status.initialized = true;
            this.status.health = 'healthy';
            this.status.lastHealthCheck = new Date().toISOString();

            console.log('✅ Infrastructure Orchestrator initialized successfully');
            
        } catch (error) {
            console.error('❌ Infrastructure initialization failed:', error);
            this.status.health = 'unhealthy';
            throw error;
        }
    }

    /**
     * Setup communication between components
     */
    async setupComponentCommunication() {
        // Connect API Gateway to Model Server
        const apiGateway = this.components.get('apiGateway');
        const modelServer = this.components.get('modelServer');
        const dataPipeline = this.components.get('dataPipeline');

        // Register model endpoints in API Gateway
        apiGateway.registerRoute('POST', '/api/models/:modelId/generate', {
            handler: async (req, res, params) => {
                try {
                    const requestBody = JSON.parse(req.body || '{}');
                    const result = await modelServer.processRequest(params.modelId, requestBody);
                    
                    res.statusCode = result.success ? 200 : 500;
                    res.end(JSON.stringify(result));
                } catch (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: error.message }));
                }
            },
            auth: true,
            rateLimit: 'premium'
        });

        // Register data pipeline endpoints in API Gateway
        apiGateway.registerRoute('POST', '/api/data/process', {
            handler: async (req, res) => {
                try {
                    const requestBody = JSON.parse(req.body || '{}');
                    const result = await dataPipeline.processData(
                        requestBody.pipeline || 'default', 
                        requestBody.data
                    );
                    
                    res.statusCode = result.success ? 200 : 500;
                    res.end(JSON.stringify(result));
                } catch (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: error.message }));
                }
            },
            auth: true,
            rateLimit: 'default'
        });

        // Register data pipeline creation endpoint
        apiGateway.registerRoute('POST', '/api/data/pipelines', {
            handler: async (req, res) => {
                try {
                    const requestBody = JSON.parse(req.body || '{}');
                    const pipeline = dataPipeline.createPipeline(requestBody.name, requestBody.config);
                    
                    res.statusCode = 201;
                    res.end(JSON.stringify(pipeline));
                } catch (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: error.message }));
                }
            },
            auth: true,
            rateLimit: 'default'
        });

        // Register model scaling endpoint
        apiGateway.registerRoute('POST', '/api/models/:modelId/scale', {
            handler: async (req, res, params) => {
                try {
                    const requestBody = JSON.parse(req.body || '{}');
                    const result = await modelServer.scaleModel(params.modelId, requestBody.instances);
                    
                    res.statusCode = 200;
                    res.end(JSON.stringify(result));
                } catch (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: error.message }));
                }
            },
            auth: true,
            rateLimit: 'default'
        });

        console.log('🔗 Component communication setup complete');
    }

    /**
     * Start all infrastructure components
     */
    async start() {
        if (!this.status.initialized) {
            throw new Error('Infrastructure not initialized');
        }

        console.log('🚀 Starting Infrastructure Orchestrator...');
        
        try {
            // Start all components
            for (const [name, component] of this.components) {
                await component.start();
                this.metrics.componentStatus.set(name, 'running');
                console.log(`✅ Started component: ${name}`);
            }

            // Update status
            this.status.running = true;
            this.metrics.startTime = Date.now();

            console.log('✅ Infrastructure Orchestrator started successfully');
            
        } catch (error) {
            console.error('❌ Infrastructure startup failed:', error);
            throw error;
        }
    }

    /**
     * Stop all infrastructure components
     */
    async stop() {
        console.log('🛑 Stopping Infrastructure Orchestrator...');
        
        try {
            // Stop all components
            for (const [name, component] of this.components) {
                await component.stop();
                this.metrics.componentStatus.set(name, 'stopped');
                console.log(`🛑 Stopped component: ${name}`);
            }

            // Update status
            this.status.running = false;

            console.log('✅ Infrastructure Orchestrator stopped successfully');
            
        } catch (error) {
            console.error('❌ Infrastructure shutdown failed:', error);
            throw error;
        }
    }

    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        setInterval(async () => {
            await this.performHealthCheck();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const healthResults = new Map();
        let overallHealth = 'healthy';

        // Check each component
        for (const [name, component] of this.components) {
            try {
                const componentHealth = await this.checkComponentHealth(name, component);
                healthResults.set(name, componentHealth);
                
                if (componentHealth.status !== 'healthy') {
                    overallHealth = 'degraded';
                }
            } catch (error) {
                healthResults.set(name, {
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
                overallHealth = 'unhealthy';
            }
        }

        // Check system resources
        const systemHealth = await this.checkSystemHealth();
        healthResults.set('system', systemHealth);

        // Update overall status
        this.status.health = overallHealth;
        this.status.lastHealthCheck = new Date().toISOString();
        this.metrics.uptime = this.status.running ? Date.now() - this.metrics.startTime : 0;

        // Log health status
        if (overallHealth !== 'healthy') {
            console.warn(`⚠️ Infrastructure health: ${overallHealth}`);
        }

        return {
            overall: overallHealth,
            components: Object.fromEntries(healthResults),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Check individual component health
     */
    async checkComponentHealth(name, component) {
        const health = {
            status: 'healthy',
            metrics: {},
            timestamp: new Date().toISOString()
        };

        try {
            // Get component metrics if available
            if (typeof component.getMetrics === 'function') {
                health.metrics = component.getMetrics();
            }

            // Check specific component health indicators
            if (name === 'modelServer') {
                const metrics = health.metrics;
                if (metrics.errors > metrics.requests * 0.1) {
                    health.status = 'degraded';
                    health.warning = 'High error rate';
                }
            }

            if (name === 'dataPipeline') {
                const metrics = health.metrics;
                if (metrics.failed > metrics.processed * 0.1) {
                    health.status = 'degraded';
                    health.warning = 'High failure rate';
                }
            }

            if (name === 'apiGateway') {
                const metrics = health.metrics;
                if (metrics.errors > metrics.requests * 0.05) {
                    health.status = 'degraded';
                    health.warning = 'High error rate';
                }
            }

        } catch (error) {
            health.status = 'unhealthy';
            health.error = error.message;
        }

        return health;
    }

    /**
     * Check system health
     */
    async checkSystemHealth() {
        const health = {
            status: 'healthy',
            resources: {},
            timestamp: new Date().toISOString()
        };

        try {
            // Mock system resource checks (replace with actual system monitoring)
            const cpuUsage = Math.random() * 100;
            const memoryUsage = Math.random() * 100;
            const diskUsage = Math.random() * 100;

            health.resources = {
                cpu: cpuUsage,
                memory: memoryUsage,
                disk: diskUsage
            };

            this.metrics.systemLoad = {
                cpu: cpuUsage,
                memory: memoryUsage,
                disk: diskUsage
            };

            // Determine health based on resource usage
            if (cpuUsage > 90 || memoryUsage > 90 || diskUsage > 90) {
                health.status = 'critical';
                health.warning = 'High resource usage';
            } else if (cpuUsage > 70 || memoryUsage > 70 || diskUsage > 70) {
                health.status = 'degraded';
                health.warning = 'Moderate resource usage';
            }

        } catch (error) {
            health.status = 'unhealthy';
            health.error = error.message;
        }

        return health;
    }

    /**
     * Get comprehensive metrics
     */
    getMetrics() {
        const componentMetrics = {};
        
        for (const [name, component] of this.components) {
            if (typeof component.getMetrics === 'function') {
                componentMetrics[name] = component.getMetrics();
            }
        }

        return {
            status: this.status,
            metrics: this.metrics,
            components: componentMetrics,
            componentCount: this.components.size,
            uptime: this.metrics.uptime
        };
    }

    /**
     * Scale infrastructure components
     */
    async scaleComponent(componentName, scalingConfig) {
        const component = this.components.get(componentName);
        if (!component) {
            throw new Error(`Component ${componentName} not found`);
        }

        try {
            let result;
            
            if (componentName === 'modelServer' && scalingConfig.modelId) {
                result = await component.scaleModel(scalingConfig.modelId, scalingConfig.instances);
            } else {
                throw new Error(`Scaling not supported for component ${componentName}`);
            }

            console.log(`📈 Scaled ${componentName}:`, result);
            return result;

        } catch (error) {
            console.error(`❌ Failed to scale ${componentName}:`, error);
            throw error;
        }
    }

    /**
     * Restart a component
     */
    async restartComponent(componentName) {
        const component = this.components.get(componentName);
        if (!component) {
            throw new Error(`Component ${componentName} not found`);
        }

        try {
            console.log(`🔄 Restarting component: ${componentName}`);
            
            await component.stop();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            await component.start();
            
            this.metrics.componentStatus.set(componentName, 'running');
            console.log(`✅ Restarted component: ${componentName}`);

        } catch (error) {
            this.metrics.componentStatus.set(componentName, 'error');
            console.error(`❌ Failed to restart ${componentName}:`, error);
            throw error;
        }
    }

    /**
     * Get infrastructure status
     */
    getStatus() {
        return {
            ...this.status,
            components: Array.from(this.components.keys()),
            uptime: this.metrics.uptime,
            systemLoad: this.metrics.systemLoad
        };
    }
}

module.exports = InfrastructureOrchestrator;
