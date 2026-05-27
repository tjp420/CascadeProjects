/**
 * Authentication Strategies - Implement strategy pattern for different auth methods
 * Reduces complex conditional logic and improves maintainability
 */

// Base authentication strategy interface
class AuthenticationStrategy {
    constructor(config = {}) {
        this.config = config;
        this.type = this.constructor.name;
    }

    /**
     * Authenticate user - must be implemented by subclasses
     */
    async authenticate(credentials) {
        throw new Error('authenticate method must be implemented by subclass');
    }

    /**
     * Validate credentials format
     */
    validateCredentials(credentials) {
        if (!credentials || typeof credentials !== 'object') {
            throw new Error('Credentials must be an object');
        }
        return true;
    }

    /**
     * Get strategy name
     */
    getName() {
        return this.type;
    }

    /**
     * Get strategy configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Check if strategy is available
     */
    isAvailable() {
        return true;
    }
}

// Local authentication strategy
class LocalAuthStrategy extends AuthenticationStrategy {
    constructor(config = {}) {
        super(config);
        this.userStore = config.userStore || new LocalUserStore();
        this.tokenManager = config.tokenManager || new TokenManager();
    }

    async authenticate(credentials) {
        this.validateCredentials(credentials);
        
        const { email, password } = credentials;
        
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        // Find user by email
        const user = await this.userStore.getUserByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }

        // Verify password
        const isValidPassword = await this.userStore.verifyPassword(user, password);
        if (!isValidPassword) {
            throw new Error('Invalid password');
        }

        // Generate token
        const token = await this.tokenManager.generateToken(user);
        
        return {
            user: this.sanitizeUser(user),
            token,
            expiresIn: this.tokenManager.getExpirationTime()
        };
    }

    sanitizeUser(user) {
        const { passwordHash, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    validateCredentials(credentials) {
        super.validateCredentials(credentials);
        
        const { email, password } = credentials;
        
        if (!email || typeof email !== 'string') {
            throw new Error('Valid email is required');
        }
        
        if (!password || typeof password !== 'string') {
            throw new Error('Valid password is required');
        }
        
        if (!this.isValidEmail(email)) {
            throw new Error('Invalid email format');
        }
        
        return true;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

// OAuth authentication strategy
class OAuthStrategy extends AuthenticationStrategy {
    constructor(config = {}) {
        super(config);
        this.provider = config.provider || 'github';
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
        this.scope = config.scope || 'user repo';
    }

    async authenticate(credentials) {
        this.validateCredentials(credentials);
        
        const { code, state } = credentials;
        
        if (!code) {
            throw new Error('Authorization code is required');
        }

        // Exchange code for access token
        const tokenData = await this.exchangeCodeForToken(code);
        
        // Get user info from provider
        const userInfo = await this.getUserInfo(tokenData.access_token);
        
        // Create or update user in local store
        const user = await this.createOrUpdateUser(userInfo, tokenData);
        
        // Generate local token
        const localToken = await this.generateLocalToken(user);
        
        return {
            user: this.sanitizeUser(user),
            token: localToken,
            expiresIn: 3600,
            provider: this.provider,
            providerToken: tokenData.access_token
        };
    }

    async exchangeCodeForToken(code) {
        // This would make actual HTTP request to OAuth provider
        // For now, return mock data
        return {
            access_token: 'mock_oauth_token',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'mock_refresh_token'
        };
    }

    async getUserInfo(accessToken) {
        // This would make actual HTTP request to OAuth provider
        // For now, return mock data
        return {
            id: 'oauth_user_cascade_2024',
            login: 'oauthuser',
            name: 'OAuth User',
            email: 'oauthuser@cascade-projects.com',
            avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4'
        };
    }

    async createOrUpdateUser(userInfo, tokenData) {
        // Create or update user in local store
        const userStore = this.config.userStore || new LocalUserStore();
        
        const user = {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            login: userInfo.login,
            avatar: userInfo.avatar_url,
            provider: this.provider,
            providerToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };

        return await userStore.saveUser(user);
    }

    async generateLocalToken(user) {
        const tokenManager = this.config.tokenManager || new TokenManager();
        return await tokenManager.generateToken(user);
    }

    sanitizeUser(user) {
        const { providerToken, refreshToken, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    validateCredentials(credentials) {
        super.validateCredentials(credentials);
        
        const { code, state } = credentials;
        
        if (!code || typeof code !== 'string') {
            throw new Error('Authorization code is required');
        }
        
        return true;
    }

    isAvailable() {
        return !!(this.clientId && this.clientSecret && this.redirectUri);
    }
}

// JWT authentication strategy
class JWTStrategy extends AuthenticationStrategy {
    constructor(config = {}) {
        super(config);
        const envJwtSecret = typeof process !== 'undefined' && process?.env
            ? process.env.JWT_SECRET
            : null;
        this.secretKey = config.secretKey || envJwtSecret || 'jwt-local-dev-placeholder';
        this.algorithm = config.algorithm || 'HS256';
    }

    async authenticate(credentials) {
        this.validateCredentials(credentials);
        
        const { token } = credentials;
        
        if (!token) {
            throw new Error('JWT token is required');
        }

        // Verify JWT token
        const decoded = await this.verifyToken(token);
        
        return {
            user: decoded.user,
            token,
            expiresIn: this.getTokenExpiration(decoded)
        };
    }

    async verifyToken(token) {
        try {
            // This would use actual JWT library
            // For now, return mock decoded data
            return {
                user: {
                    id: 'jwt_user_cascade_2024',
                    email: 'jwtuser@cascade-projects.com',
                    name: 'JWT User',
                    role: 'user'
                },
                exp: Math.floor(Date.now() / 1000) + 3600,
                iat: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            throw new Error('Invalid JWT token');
        }
    }

    getTokenExpiration(decoded) {
        const now = Math.floor(Date.now() / 1000);
        return Math.max(0, decoded.exp - now);
    }

    validateCredentials(credentials) {
        super.validateCredentials(credentials);
        
        const { token } = credentials;
        
        if (!token || typeof token !== 'string') {
            throw new Error('JWT token is required');
        }
        
        return true;
    }
}

// API Key authentication strategy
class APIKeyStrategy extends AuthenticationStrategy {
    constructor(config = {}) {
        super(config);
        this.apiKeyStore = config.apiKeyStore || new APIKeyStore();
    }

    async authenticate(credentials) {
        this.validateCredentials(credentials);
        
        const { apiKey } = credentials;
        
        if (!apiKey) {
            throw new Error('API key is required');
        }

        // Validate API key
        const keyData = await this.apiKeyStore.validateKey(apiKey);
        if (!keyData) {
            throw new Error('Invalid API key');
        }

        // Get user associated with API key
        const user = await this.apiKeyStore.getUserByKey(apiKey);
        if (!user) {
            throw new Error('API key not associated with any user');
        }

        // Generate session token
        const token = await this.generateSessionToken(user);

        return {
            user: this.sanitizeUser(user),
            token,
            expiresIn: 3600,
            keyId: keyData.id,
            keyName: keyData.name
        };
    }

    async generateSessionToken(user) {
        const tokenManager = this.config.tokenManager || new TokenManager();
        return await tokenManager.generateToken(user);
    }

    sanitizeUser(user) {
        const { apiKeys, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    validateCredentials(credentials) {
        super.validateCredentials(credentials);
        
        const { apiKey } = credentials;
        
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('API key is required');
        }
        
        if (!this.isValidAPIKeyFormat(apiKey)) {
            throw new Error('Invalid API key format');
        }
        
        return true;
    }

    isValidAPIKeyFormat(apiKey) {
        // Basic validation - adjust based on your API key format
        return apiKey.length >= 20 && /^[A-Za-z0-9]+$/.test(apiKey);
    }
}

// Authentication Context - manages strategy selection
class AuthenticationContext {
    constructor() {
        this.strategies = new Map();
        this.defaultStrategy = 'local';
        this.setupDefaultStrategies();
    }

    /**
     * Setup default authentication strategies
     */
    setupDefaultStrategies() {
        this.addStrategy('local', LocalAuthStrategy);
        this.addStrategy('oauth', OAuthStrategy);
        this.addStrategy('jwt', JWTStrategy);
        this.addStrategy('apikey', APIKeyStrategy);
    }

    /**
     * Add authentication strategy
     */
    addStrategy(name, StrategyClass, config = {}) {
        try {
            const strategy = new StrategyClass(config);
            this.strategies.set(name, strategy);
            console.log(`Added authentication strategy: ${name}`);
        } catch (error) {
            console.error(`Failed to add strategy '${name}':`, error);
        }
    }

    /**
     * Remove authentication strategy
     */
    removeStrategy(name) {
        return this.strategies.delete(name);
    }

    /**
     * Get authentication strategy
     */
    getStrategy(name) {
        return this.strategies.get(name);
    }

    /**
     * Get available strategies
     */
    getAvailableStrategies() {
        const available = {};
        
        for (const [name, strategy] of this.strategies) {
            if (strategy.isAvailable()) {
                available[name] = {
                    name: strategy.getName(),
                    available: true
                };
            }
        }
        
        return available;
    }

    /**
     * Authenticate using specified strategy
     */
    async authenticate(strategyName, credentials) {
        const strategy = this.getStrategy(strategyName);
        
        if (!strategy) {
            throw new Error(`Authentication strategy '${strategyName}' not found`);
        }

        if (!strategy.isAvailable()) {
            throw new Error(`Authentication strategy '${strategyName}' is not available`);
        }

        try {
            const result = await strategy.authenticate(credentials);
            
            // Add strategy info to result
            result.strategy = {
                name: strategyName,
                type: strategy.getName()
            };

            return result;
        } catch (error) {
            throw new Error(`Authentication failed with strategy '${strategyName}': ${error.message}`);
        }
    }

    /**
     * Auto-detect and authenticate using appropriate strategy
     */
    async autoAuthenticate(credentials) {
        const detectedStrategy = this.detectStrategy(credentials);
        
        if (!detectedStrategy) {
            throw new Error('Could not detect appropriate authentication strategy');
        }

        return await this.authenticate(detectedStrategy, credentials);
    }

    /**
     * Detect authentication strategy based on credentials
     */
    detectStrategy(credentials) {
        // JWT token detection
        if (credentials.token && typeof credentials.token === 'string') {
            return 'jwt';
        }

        // OAuth code detection
        if (credentials.code && credentials.state) {
            return 'oauth';
        }

        // API key detection
        if (credentials.apiKey && typeof credentials.apiKey === 'string') {
            return 'apikey';
        }

        // Default to local authentication
        return this.defaultStrategy;
    }

    /**
     * Set default strategy
     */
    setDefaultStrategy(strategyName) {
        if (!this.strategies.has(strategyName)) {
            throw new Error(`Strategy '${strategyName}' not found`);
        }
        
        this.defaultStrategy = strategyName;
    }

    /**
     * Get default strategy
     */
    getDefaultStrategy() {
        return this.defaultStrategy;
    }

    /**
     * Get all strategies
     */
    getAllStrategies() {
        const strategies = {};
        
        for (const [name, strategy] of this.strategies) {
            strategies[name] = {
                name: strategy.getName(),
                type: strategy.constructor.name,
                available: strategy.isAvailable(),
                config: strategy.getConfig()
            };
        }
        
        return strategies;
    }
}

// Supporting classes (simplified implementations)
class LocalUserStore {
    async getUserByEmail(email) {
        // Mock implementation
        return {
            id: 'user_cascade_2024',
            email: email,
            name: 'Trevor',
            passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYjXqBqLq2e'
        };
    }

    async verifyPassword(user, password) {
        // Mock implementation
        return password === 'CascadeSecure2024!';
    }

    async saveUser(user) {
        // Mock implementation
        return user;
    }
}

class TokenManager {
    async generateToken(user) {
        // Mock implementation
        return 'mock_jwt_token';
    }

    getExpirationTime() {
        return 3600; // 1 hour
    }
}

class APIKeyStore {
    async validateKey(apiKey) {
        // Mock implementation
        return { id: 'cascade_key_2024', name: 'Cascade API Key' };
    }

    async getUserByKey(apiKey) {
        // Mock implementation
        return {
            id: 'user_cascade_2024',
            email: 'apiuser@cascade-projects.com',
            name: 'API User',
            apiKeys: ['cascade_api_key_2024']
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AuthenticationStrategy,
        LocalAuthStrategy,
        OAuthStrategy,
        JWTStrategy,
        APIKeyStrategy,
        AuthenticationContext
    };
}

// Global assignment for browser compatibility
window.AuthenticationContext = window.AuthenticationContext || AuthenticationContext;
window.LocalAuthStrategy = window.LocalAuthStrategy || LocalAuthStrategy;
window.OAuthStrategy = window.OAuthStrategy || OAuthStrategy;
window.JWTStrategy = window.JWTStrategy || JWTStrategy;
window.APIKeyStrategy = window.APIKeyStrategy || APIKeyStrategy;
