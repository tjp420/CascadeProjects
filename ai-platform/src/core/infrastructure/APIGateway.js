/**
 * API Gateway - Core Infrastructure Component
 * Handles API routing, authentication, rate limiting, and request management
 */

class APIGateway {
    constructor() {
        this.routes = new Map();
        this.middleware = new Map();
        this.rateLimiters = new Map();
        this.authProviders = new Map();
        this.metrics = {
            requests: 0,
            responses: 0,
            errors: 0,
            blocked: 0,
            avgResponseTime: 0,
            endpoints: new Map()
        };
        this.isRunning = false;
    }

    /**
     * Initialize the API Gateway
     */
    async initialize() {
        console.log('🚀 Initializing API Gateway...');
        
        // Setup authentication providers
        await this.setupAuthProviders();
        
        // Setup middleware
        await this.setupMiddleware();
        
        // Setup rate limiters
        await this.setupRateLimiters();
        
        // Setup default routes
        await this.setupDefaultRoutes();
        
        console.log('✅ API Gateway initialized successfully');
    }

    /**
     * Setup authentication providers
     */
    async setupAuthProviders() {
        // JWT Provider
        this.authProviders.set('jwt', {
            type: 'jwt',
            authenticate: async (token) => {
                // Mock JWT validation
                try {
                    const payload = this.decodeJWT(token);
                    return {
                        valid: true,
                        user: payload,
                        permissions: payload.permissions || []
                    };
                } catch (error) {
                    return { valid: false, error: 'Invalid token' };
                }
            }
        });

        // API Key Provider
        this.authProviders.set('apikey', {
            type: 'apikey',
            authenticate: async (apiKey) => {
                // Mock API key validation
                const validKeys = new Set([
                    'sk-test-1234567890',
                    'sk-prod-0987654321',
                    'sk-demo-1111111111'
                ]);
                
                if (validKeys.has(apiKey)) {
                    return {
                        valid: true,
                        user: { id: apiKey.split('-')[1], tier: apiKey.split('-')[0] },
                        permissions: ['read', 'write']
                    };
                }
                
                return { valid: false, error: 'Invalid API key' };
            }
        });

        console.log(`🔐 Setup ${this.authProviders.size} authentication providers`);
    }

    /**
     * Setup middleware
     */
    async setupMiddleware() {
        // CORS Middleware
        this.middleware.set('cors', {
            execute: async (req, res) => {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                
                if (req.method === 'OPTIONS') {
                    res.statusCode = 200;
                    res.end();
                    return true; // Skip further processing
                }
                return false;
            }
        });

        // Logging Middleware
        this.middleware.set('logging', {
            execute: async (req, res) => {
                const timestamp = new Date().toISOString();
                console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
                
                // Store request info for metrics
                req.requestTime = Date.now();
                req.requestId = this.generateRequestId();
            }
        });

        // Request Validation Middleware
        this.middleware.set('validation', {
            execute: async (req, res) => {
                // Basic request validation
                if (!req.path || !req.method) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Invalid request' }));
                    return true; // Skip further processing
                }
                return false;
            }
        });

        console.log(`🔧 Setup ${this.middleware.size} middleware components`);
    }

    /**
     * Setup rate limiters
     */
    async setupRateLimiters() {
        // Default rate limiter
        this.rateLimiters.set('default', {
            windowMs: 60000, // 1 minute
            maxRequests: 100,
            currentRequests: new Map(),
            check: async (clientId) => {
                const limiter = this.rateLimiters.get('default');
                const now = Date.now();
                const windowStart = now - limiter.windowMs;
                
                // Clean old requests
                if (limiter.currentRequests.has(clientId)) {
                    limiter.currentRequests.set(
                        clientId, 
                        limiter.currentRequests.get(clientId).filter(time => time > windowStart)
                    );
                } else {
                    limiter.currentRequests.set(clientId, []);
                }
                
                const requests = limiter.currentRequests.get(clientId);
                
                if (requests.length >= limiter.maxRequests) {
                    return { allowed: false, resetTime: requests[0] + limiter.windowMs };
                }
                
                requests.push(now);
                return { allowed: true };
            }
        });

        // Premium rate limiter
        this.rateLimiters.set('premium', {
            windowMs: 60000,
            maxRequests: 1000,
            currentRequests: new Map(),
            check: async (clientId) => {
                const limiter = this.rateLimiters.get('premium');
                const now = Date.now();
                const windowStart = now - limiter.windowMs;
                
                if (limiter.currentRequests.has(clientId)) {
                    limiter.currentRequests.set(
                        clientId, 
                        limiter.currentRequests.get(clientId).filter(time => time > windowStart)
                    );
                } else {
                    limiter.currentRequests.set(clientId, []);
                }
                
                const requests = limiter.currentRequests.get(clientId);
                
                if (requests.length >= limiter.maxRequests) {
                    return { allowed: false, resetTime: requests[0] + limiter.windowMs };
                }
                
                requests.push(now);
                return { allowed: true };
            }
        });

        console.log(`⏱️ Setup ${this.rateLimiters.size} rate limiters`);
    }

    /**
     * Setup default routes
     */
    async setupDefaultRoutes() {
        // Health check
        this.registerRoute('GET', '/health', {
            handler: async (req, res) => {
                res.statusCode = 200;
                res.end(JSON.stringify({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    version: '1.0.0'
                }));
            },
            auth: false,
            rateLimit: 'default'
        });

        // API info
        this.registerRoute('GET', '/api/info', {
            handler: async (req, res) => {
                res.statusCode = 200;
                res.end(JSON.stringify({
                    name: 'Cascade AI Platform API',
                    version: '1.0.0',
                    endpoints: Array.from(this.routes.keys()),
                    timestamp: new Date().toISOString()
                }));
            },
            auth: false,
            rateLimit: 'default'
        });

        // Model endpoints
        this.registerRoute('POST', '/api/models/:modelId/generate', {
            handler: async (req, res, params) => {
                // This would integrate with the ModelServer
                const modelId = params.modelId;
                const requestBody = JSON.parse(req.body || '{}');
                
                res.statusCode = 200;
                res.end(JSON.stringify({
                    modelId,
                    response: `Mock response from ${modelId}`,
                    timestamp: new Date().toISOString()
                }));
            },
            auth: true,
            rateLimit: 'premium'
        });

        // Data pipeline endpoints
        this.registerRoute('POST', '/api/data/process', {
            handler: async (req, res) => {
                // This would integrate with the DataPipelineManager
                const requestBody = JSON.parse(req.body || '{}');
                
                res.statusCode = 200;
                res.end(JSON.stringify({
                    processed: true,
                    dataId: this.generateRequestId(),
                    timestamp: new Date().toISOString()
                }));
            },
            auth: true,
            rateLimit: 'default'
        });

        console.log(`🛣️ Setup ${this.routes.size} default routes`);
    }

    /**
     * Register a new route
     */
    registerRoute(method, path, config) {
        const routeKey = `${method} ${path}`;
        this.routes.set(routeKey, {
            method,
            path,
            handler: config.handler,
            auth: config.auth !== false,
            authProvider: config.authProvider || 'jwt',
            rateLimit: config.rateLimit || 'default',
            middleware: config.middleware || [],
            createdAt: new Date().toISOString()
        });

        // Initialize endpoint metrics
        if (!this.metrics.endpoints.has(routeKey)) {
            this.metrics.endpoints.set(routeKey, {
                requests: 0,
                errors: 0,
                avgResponseTime: 0
            });
        }

        console.log(`📍 Registered route: ${routeKey}`);
    }

    /**
     * Process an incoming request
     */
    async processRequest(req, res) {
        const startTime = Date.now();
        const routeKey = `${req.method} ${req.path}`;
        const route = this.routes.get(routeKey);

        try {
            // Check if route exists
            if (!route) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Route not found' }));
                this.metrics.errors++;
                return;
            }

            // Execute global middleware
            for (const [name, middleware] of this.middleware) {
                const shouldSkip = await middleware.execute(req, res);
                if (shouldSkip) return;
            }

            // Authentication
            if (route.auth) {
                const authResult = await this.authenticateRequest(req, route.authProvider);
                if (!authResult.valid) {
                    res.statusCode = 401;
                    res.end(JSON.stringify({ error: authResult.error || 'Unauthorized' }));
                    this.metrics.errors++;
                    return;
                }
                req.user = authResult.user;
            }

            // Rate limiting
            const clientId = req.user?.id || req.ip;
            const rateLimitResult = await this.checkRateLimit(clientId, route.rateLimit);
            if (!rateLimitResult.allowed) {
                res.statusCode = 429;
                res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
                res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
                this.metrics.blocked++;
                return;
            }

            // Execute route handler
            await route.handler(req, res, this.parsePathParams(req.path, route.path));

            // Update metrics
            const responseTime = Date.now() - startTime;
            this.updateMetrics(routeKey, responseTime, false);

        } catch (error) {
            console.error(`Request processing error:`, error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal server error' }));
            
            const responseTime = Date.now() - startTime;
            this.updateMetrics(routeKey, responseTime, true);
        }
    }

    /**
     * Authenticate a request
     */
    async authenticateRequest(req, providerName) {
        const provider = this.authProviders.get(providerName);
        if (!provider) {
            return { valid: false, error: 'Auth provider not found' };
        }

        const token = this.extractAuthToken(req);
        if (!token) {
            return { valid: false, error: 'No authentication token provided' };
        }

        return await provider.authenticate(token);
    }

    /**
     * Extract authentication token from request
     */
    extractAuthToken(req) {
        const authHeader = req.headers.authorization;
        if (!authHeader) return null;

        if (authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        if (authHeader.startsWith('ApiKey ')) {
            return authHeader.substring(7);
        }

        return authHeader;
    }

    /**
     * Check rate limit for client
     */
    async checkRateLimit(clientId, limiterName) {
        const limiter = this.rateLimiters.get(limiterName);
        if (!limiter) {
            return { allowed: true };
        }

        return await limiter.check(clientId);
    }

    /**
     * Parse path parameters
     */
    parsePathParams(requestPath, routePath) {
        const params = {};
        const requestParts = requestPath.split('/').filter(Boolean);
        const routeParts = routePath.split('/').filter(Boolean);

        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                const paramName = routeParts[i].substring(1);
                if (requestParts[i]) {
                    params[paramName] = requestParts[i];
                }
            }
        }

        return params;
    }

    /**
     * Update request metrics
     */
    updateMetrics(routeKey, responseTime, isError) {
        this.metrics.requests++;
        
        if (isError) {
            this.metrics.errors++;
        } else {
            this.metrics.responses++;
        }

        // Update average response time
        this.metrics.avgResponseTime = this.calculateAverageResponseTime(responseTime);

        // Update endpoint metrics
        const endpointMetrics = this.metrics.endpoints.get(routeKey);
        if (endpointMetrics) {
            endpointMetrics.requests++;
            if (isError) {
                endpointMetrics.errors++;
            }
            endpointMetrics.avgResponseTime = this.calculateEndpointAverageResponseTime(
                endpointMetrics.avgResponseTime, 
                responseTime, 
                endpointMetrics.requests
            );
        }
    }

    /**
     * Calculate average response time
     */
    calculateAverageResponseTime(newTime) {
        const currentAvg = this.metrics.avgResponseTime;
        const totalRequests = this.metrics.responses;
        
        return (currentAvg * (totalRequests - 1) + newTime) / totalRequests;
    }

    /**
     * Calculate endpoint average response time
     */
    calculateEndpointAverageResponseTime(currentAvg, newTime, requestCount) {
        return (currentAvg * (requestCount - 1) + newTime) / requestCount;
    }

    /**
     * Mock JWT decoding (replace with real implementation)
     */
    decodeJWT(token) {
        // Mock JWT payload
        return {
            sub: 'user123',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
            permissions: ['read', 'write']
        };
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get gateway metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            routes: Array.from(this.routes.values()).map(route => ({
                method: route.method,
                path: route.path,
                auth: route.auth,
                rateLimit: route.rateLimit
            })),
            middleware: Array.from(this.middleware.keys()),
            authProviders: Array.from(this.authProviders.keys()),
            rateLimiters: Array.from(this.rateLimiters.keys())
        };
    }

    /**
     * Start the API Gateway
     */
    async start() {
        this.isRunning = true;
        console.log('🚀 API Gateway started');
    }

    /**
     * Stop the API Gateway
     */
    async stop() {
        this.isRunning = false;
        console.log('🛑 API Gateway stopped');
    }
}

module.exports = APIGateway;
