/**
 * SSO Service Layer
 * 
 * Orchestrates SSO authentication, user provisioning,
 * and enterprise identity management
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const logger = require('../lib/app-logger');

class SSOService {
    constructor() {
        this.userCache = new Map();
        this.sessionCache = new Map();
        this.tokenBlacklist = new Set();
    }

    isDebugEnabled() {
        return process.env.LOG_AUTH === 'true' || process.env.AUTH_DEBUG === 'true';
    }

    debugLog(message) {
        if (this.isDebugEnabled()) {
            logger.info(message);
        }
    }

    /**
     * Authenticate user via SSO provider
     */
    async authenticate(provider, profile, _accessToken = null) {
        try {
            // Validate profile
            const validatedProfile = await this.validateProfile(provider, profile);
            
            // Get or create user
            const user = await this.getOrCreateUser(validatedProfile);
            
            // Update user profile
            await this.updateUserProfile(user.id, validatedProfile);
            
            // Sync groups and permissions
            await this.syncUserGroups(user.id, validatedProfile.groups || []);
            
            // Calculate trust level and permissions
            const trustLevel = this.calculateTrustLevel(provider, validatedProfile);
            const permissions = await this.calculatePermissions(user.id, validatedProfile.groups || []);
            
            // Generate session
            const session = await this.createSession(user, trustLevel, permissions, provider);
            
            // Log authentication
            await this.logAuthentication(user.id, provider, 'success');
            
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    provider: provider,
                    trustLevel,
                    permissions
                },
                session
            };
        } catch (error) {
            console.error(`[SSO Service] Authentication failed for ${provider}:`, error);
            await this.logAuthentication(null, provider, 'failed', error.message);
            throw error;
        }
    }

    /**
     * Validate and normalize profile from different providers
     */
    async validateProfile(provider, profile) {
        const normalized = {
            providerId: null,
            email: null,
            name: null,
            firstName: null,
            lastName: null,
            groups: [],
            attributes: {}
        };

        switch (provider) {
            case 'azure':
                normalized.providerId = profile.oid || profile.sub;
                normalized.email = profile.upn || profile.email;
                normalized.name = profile.name;
                normalized.firstName = profile.given_name;
                normalized.lastName = profile.family_name;
                normalized.groups = profile.groups || [];
                normalized.attributes = {
                    jobTitle: profile.jobTitle,
                    department: profile.department,
                    officeLocation: profile.officeLocation
                };
                break;

            case 'google':
                normalized.providerId = profile.id;
                normalized.email = profile.emails?.[0]?.value;
                normalized.name = profile.displayName;
                normalized.firstName = profile.name?.givenName;
                normalized.lastName = profile.name?.familyName;
                normalized.groups = await this.getGoogleGroups(profile);
                normalized.attributes = {
                    picture: profile.photos?.[0]?.value,
                    verified: profile.verified
                };
                break;

            case 'okta':
                normalized.providerId = profile.nameID;
                normalized.email = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
                normalized.name = profile.displayName;
                normalized.firstName = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'];
                normalized.lastName = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'];
                normalized.groups = profile['http://schemas.xmlsoap.org/claims/Group'] || [];
                break;

            case 'ldap':
                normalized.providerId = profile.uid;
                normalized.email = profile.mail;
                normalized.name = profile.cn;
                normalized.firstName = profile.givenName || profile.cn?.split(' ')[0];
                normalized.lastName = profile.sn || profile.cn?.split(' ').slice(1).join(' ');
                normalized.groups = profile.memberOf || [];
                normalized.attributes = {
                    title: profile.title,
                    department: profile.department,
                    manager: profile.manager
                };
                break;
        }

        // Validate required fields
        if (!normalized.email) {
            throw new Error('Email address is required');
        }

        if (!normalized.providerId) {
            throw new Error('Provider ID is required');
        }

        return normalized;
    }

    /**
     * Get Google groups (requires Admin SDK)
     */
    async getGoogleGroups(_profile) {
        // This would require Google Admin SDK integration.
        // For now, return empty array.
        return [];
    }

    /**
     * Get or create user from database
     */
    async getOrCreateUser(profile) {
        // Check cache first
        const cacheKey = `${profile.provider}:${profile.providerId}`;
        if (this.userCache.has(cacheKey)) {
            return this.userCache.get(cacheKey);
        }

        // Database-backed lookup is not configured in this fallback implementation.
        // For now, create an in-memory user.
        const user = {
            id: crypto.randomUUID(),
            providerId: profile.providerId,
            provider: profile.provider,
            email: profile.email,
            name: profile.name,
            firstName: profile.firstName,
            lastName: profile.lastName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true,
            attributes: profile.attributes
        };

        // Cache user
        this.userCache.set(cacheKey, user);
        
        return user;
    }

    /**
     * Update user profile
     */
    async updateUserProfile(userId, _profile) {
        // Database-backed profile updates are intentionally deferred in this fallback path.
        this.debugLog(`[SSO Service] Updated profile for user ${userId}`);
    }

    /**
     * Sync user groups and permissions
     */
    async syncUserGroups(userId, groups) {
        // Group synchronization persistence is intentionally deferred in this fallback path.
        this.debugLog(`[SSO Service] Synced ${groups.length} groups for user ${userId}`);
    }

    /**
     * Calculate trust level based on provider and user attributes
     */
    calculateTrustLevel(provider, profile) {
        const providerTrust = {
            'azure': 'silver',
            'google': 'bronze',
            'okta': 'silver',
            'ldap': 'bronze'
        };

        let trustLevel = providerTrust[provider] || 'bronze';

        // Upgrade based on groups
        const groups = Array.isArray(profile?.groups) ? profile.groups : [];
        const adminGroups = ['admin', 'administrator', 'executive', 'senior', 'lead'];
        const hasAdminGroup = groups.some(group => 
            adminGroups.some(admin => group.toLowerCase().includes(admin))
        );

        if (hasAdminGroup) {
            trustLevel = 'gold';
        }

        // Upgrade based on email domain
        const premiumDomains = ['@company.com', '@enterprise.com', '@corp.com'];
        if (premiumDomains.some(domain => profile.email.endsWith(domain))) {
            trustLevel = 'gold';
        }

        return trustLevel;
    }

    /**
     * Calculate permissions based on groups and trust level
     */
    async calculatePermissions(userId, groups) {
        const permissions = new Set(['read:own', 'write:own']);

        // Add permissions based on groups
        groups.forEach(group => {
            const groupLower = group.toLowerCase();
            
            if (groupLower.includes('admin')) {
                permissions.add('admin:basic');
                permissions.add('write:shared');
                permissions.add('read:shared');
            }
            
            if (groupLower.includes('developer') || groupLower.includes('engineer')) {
                permissions.add('analyze:private');
                permissions.add('read:shared');
                permissions.add('write:shared');
            }
            
            if (groupLower.includes('analyst') || groupLower.includes('data')) {
                permissions.add('analyze:public');
                permissions.add('analyze:private');
                permissions.add('read:shared');
            }
            
            if (groupLower.includes('manager') || groupLower.includes('lead')) {
                permissions.add('team:manage');
                permissions.add('reports:view');
            }
        });

        return Array.from(permissions);
    }

    /**
     * Create user session
     */
    async createSession(user, trustLevel, permissions, provider) {
        const sessionId = crypto.randomUUID();
        const session = {
            id: sessionId,
            userId: user.id,
            trustLevel,
            permissions,
            provider,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            ipAddress: null, // Will be set by middleware
            userAgent: null, // Will be set by middleware
            isActive: true
        };

        // Cache session
        this.sessionCache.set(sessionId, session);

        return session;
    }

    /**
     * Validate session
     */
    async validateSession(sessionId) {
        const session = this.sessionCache.get(sessionId);
        
        if (!session) {
            return null;
        }

        // Check expiration
        if (new Date() > new Date(session.expiresAt)) {
            this.sessionCache.delete(sessionId);
            return null;
        }

        return session;
    }

    /**
     * Refresh session
     */
    async refreshSession(sessionId) {
        const session = await this.validateSession(sessionId);
        
        if (!session) {
            throw new Error('Invalid or expired session');
        }

        // Update expiration
        session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        
        return session;
    }

    /**
     * Invalidate session
     */
    async invalidateSession(sessionId) {
        this.sessionCache.delete(sessionId);
        this.debugLog(`[SSO Service] Session ${sessionId} invalidated`);
    }

    /**
     * Invalidate all user sessions
     */
    async invalidateAllUserSessions(userId) {
        for (const [sessionId, session] of this.sessionCache) {
            if (session.userId === userId) {
                this.sessionCache.delete(sessionId);
            }
        }
        this.debugLog(`[SSO Service] All sessions for user ${userId} invalidated`);
    }

    /**
     * Get user sessions
     */
    async getUserSessions(userId) {
        const sessions = [];
        
        for (const [_sessionId, session] of this.sessionCache) {
            if (session.userId === userId && new Date() <= new Date(session.expiresAt)) {
                sessions.push({
                    id: session.id,
                    createdAt: session.createdAt,
                    expiresAt: session.expiresAt,
                    ipAddress: session.ipAddress,
                    userAgent: session.userAgent,
                    provider: session.provider
                });
            }
        }

        return sessions;
    }

    /**
     * Check if token is blacklisted
     */
    isTokenBlacklisted(token) {
        return this.tokenBlacklist.has(token);
    }

    /**
     * Blacklist token
     */
    blacklistToken(token) {
        this.tokenBlacklist.add(token);
        
        // Remove from blacklist after token expires (24 hours)
        setTimeout(() => {
            this.tokenBlacklist.delete(token);
        }, 24 * 60 * 60 * 1000);
    }

    /**
     * Generate JWT token
     */
    generateToken(user, session) {
        const payload = {
            sub: user.id,
            email: user.email,
            name: user.name,
            trustLevel: session.trustLevel,
            permissions: session.permissions,
            sessionId: session.id,
            provider: session.provider
        };

        return jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '24h',
            issuer: 'cascade-ai-platform',
            audience: 'cascade-ai-users'
        });
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            // Check blacklist
            if (this.isTokenBlacklisted(token)) {
                throw new Error('Token is blacklisted');
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET, {
                issuer: 'cascade-ai-platform',
                audience: 'cascade-ai-users'
            });

            return decoded;
        } catch (error) {
            throw new Error(`Invalid token: ${error.message}`);
        }
    }

    /**
     * Log authentication events
     */
    async logAuthentication(userId, provider, status, error = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            userId,
            provider,
            status,
            error,
            ipAddress: null, // Will be set by middleware
            userAgent: null // Will be set by middleware
        };

        // Audit-log persistence is intentionally deferred in this fallback path.
        this.debugLog(`[SSO Service] Authentication event: ${JSON.stringify(logEntry)}`);
    }

    /**
     * Get authentication statistics
     */
    async getAuthStats() {
        return {
            totalUsers: this.userCache.size,
            activeSessions: this.sessionCache.size,
            blacklistedTokens: this.tokenBlacklist.size,
            providers: {
                azure: 0,
                google: 0,
                okta: 0,
                ldap: 0
            },
            trustLevels: {
                bronze: 0,
                silver: 0,
                gold: 0
            }
        };
    }

    /**
     * Cleanup expired sessions
     */
    cleanupExpiredSessions() {
        const now = new Date();
        let cleaned = 0;

        for (const [sessionId, session] of this.sessionCache) {
            if (now > new Date(session.expiresAt)) {
                this.sessionCache.delete(sessionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.debugLog(`[SSO Service] Cleaned up ${cleaned} expired sessions`);
        }
    }

    /**
     * Health check
     */
    async healthCheck() {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            stats: await this.getAuthStats()
        };
    }
}

// Singleton instance
const ssoService = new SSOService();

// Cleanup expired sessions every hour
setInterval(() => {
    ssoService.cleanupExpiredSessions();
}, 60 * 60 * 1000);

module.exports = ssoService;
