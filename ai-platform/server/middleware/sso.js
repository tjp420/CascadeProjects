/**
 * Single Sign-On (SSO) Middleware
 * 
 * Provides enterprise SSO integration with multiple providers:
 * - Microsoft Azure AD (OAuth 2.0/OpenID Connect)
 * - Google Workspace (SAML/OAuth)
 * - Okta (SAML/OAuth)
 * - LDAP/Active Directory
 * - Custom SAML 2.0 providers
 */

const logger = require('../lib/app-logger');

const passport = require('passport');
const passportJWT = require('passport-jwt');
const passportGoogle = require('passport-google-oauth20');
const passportSaml = require('@node-saml/passport-saml');
const LDAP = require('ldapjs');
const jwt = require('jsonwebtoken');

class SSOMiddleware {
    constructor() {
        this.providers = new Map();
        this.initializeProviders();
        this.setupStrategies();
    }

    /**
     * Initialize SSO providers from configuration
     */
    initializeProviders() {
        // Azure AD Configuration
        if (process.env.AZURE_AD_ENABLED === 'true') {
            this.providers.set('azure', {
                name: 'Azure AD',
                type: 'oauth2',
                config: {
                    clientID: process.env.AZURE_AD_CLIENT_ID,
                    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
                    tenantID: process.env.AZURE_AD_TENANT_ID,
                    resource: process.env.AZURE_AD_RESOURCE || 'https://graph.microsoft.com'
                }
            });
        }

        // Google Workspace Configuration
        if (process.env.GOOGLE_SSO_ENABLED === 'true') {
            this.providers.set('google', {
                name: 'Google Workspace',
                type: 'oauth2',
                config: {
                    clientID: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    domain: process.env.GOOGLE_DOMAIN || null
                }
            });
        }

        // Okta Configuration
        if (process.env.OKTA_ENABLED === 'true') {
            this.providers.set('okta', {
                name: 'Okta',
                type: 'saml',
                config: {
                    issuer: process.env.OKTA_ISSUER,
                    clientID: process.env.OKTA_CLIENT_ID,
                    clientSecret: process.env.OKTA_CLIENT_SECRET,
                    callbackURL: process.env.OKTA_CALLBACK_URL,
                    entryPoint: process.env.OKTA_ENTRY_POINT
                }
            });
        }

        // LDAP Configuration
        if (process.env.LDAP_ENABLED === 'true') {
            this.providers.set('ldap', {
                name: 'LDAP/Active Directory',
                type: 'ldap',
                config: {
                    url: process.env.LDAP_URL,
                    bindDN: process.env.LDAP_BIND_DN,
                    bindCredentials: process.env.LDAP_BIND_CREDENTIALS,
                    searchBase: process.env.LDAP_SEARCH_BASE,
                    searchFilter: process.env.LDAP_SEARCH_FILTER || '(uid={{username}})'
                }
            });
        }

        logger.debug(`[SSO] Initialized ${this.providers.size} SSO providers`);
    }

    /**
     * Setup passport strategies for each provider
     */
    setupStrategies() {
        // Azure AD Strategy
        if (this.providers.has('azure')) {
            const azureConfig = this.providers.get('azure').config;
            passport.use(new passportJWT.Strategy({
                jwtFromRequest: passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
                secretOrKey: process.env.JWT_SECRET,
                issuer: `https://sts.windows.net/${azureConfig.tenantID}/`,
                audience: azureConfig.clientID
            }, this.verifyAzureToken.bind(this)));
        }

        // Google OAuth Strategy
        if (this.providers.has('google')) {
            const googleConfig = this.providers.get('google').config;
            passport.use(new passportGoogle.Strategy({
                clientID: googleConfig.clientID,
                clientSecret: googleConfig.clientSecret,
                callbackURL: '/auth/google/callback',
                scope: ['profile', 'email']
            }, this.verifyGoogleToken.bind(this)));
        }

        // Okta SAML Strategy
        if (this.providers.has('okta')) {
            const oktaConfig = this.providers.get('okta').config;
            passport.use(new passportSaml.Strategy({
                issuer: oktaConfig.issuer,
                entryPoint: oktaConfig.entryPoint,
                callbackURL: oktaConfig.callbackURL,
                cert: oktaConfig.cert
            }, this.verifyOktaToken.bind(this)));
        }
    }

    /**
     * Verify Azure AD token
     */
    async verifyAzureToken(payload, done) {
        try {
            const user = {
                id: payload.oid,
                email: payload.upn,
                name: payload.name,
                provider: 'azure',
                groups: payload.groups || [],
                trustLevel: this.calculateTrustLevel(payload),
                permissions: this.getPermissions(payload.groups)
            };

            // Log SSO authentication
            logger.debug(`[SSO] Azure AD user authenticated: ${user.email}`);
            return done(null, user);
        } catch (error) {
            console.error('[SSO] Azure token verification failed:', error);
            return done(error, null);
        }
    }

    /**
     * Verify Google OAuth token
     */
    async verifyGoogleToken(accessToken, refreshToken, profile, done) {
        try {
            const domain = this.providers.get('google').config.domain;
            
            // Verify domain if specified
            if (domain && !profile.emails[0].value.endsWith(`@${domain}`)) {
                return done(new Error('Email domain not authorized'), null);
            }

            const user = {
                id: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                provider: 'google',
                groups: this.getGoogleGroups(profile),
                trustLevel: this.calculateTrustLevel(profile),
                permissions: this.getPermissions(this.getGoogleGroups(profile))
            };

            logger.debug(`[SSO] Google user authenticated: ${user.email}`);
            return done(null, user);
        } catch (error) {
            console.error('[SSO] Google token verification failed:', error);
            return done(error, null);
        }
    }

    /**
     * Verify Okta SAML token
     */
    async verifyOktaToken(profile, done) {
        try {
            const user = {
                id: profile.nameID,
                email: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
                name: profile.displayName,
                provider: 'okta',
                groups: profile['http://schemas.xmlsoap.org/claims/Group'] || [],
                trustLevel: this.calculateTrustLevel(profile),
                permissions: this.getPermissions(profile['http://schemas.xmlsoap.org/claims/Group'] || [])
            };

            logger.debug(`[SSO] Okta user authenticated: ${user.email}`);
            return done(null, user);
        } catch (error) {
            console.error('[SSO] Okta token verification failed:', error);
            return done(error, null);
        }
    }

    /**
     * LDAP Authentication
     */
    async authenticateLDAP(username, password) {
        return new Promise((resolve, reject) => {
            const config = this.providers.get('ldap').config;
            const client = LDAP.createClient({
                url: config.url,
                bindDN: config.bindDN,
                bindCredentials: config.bindCredentials
            });

            client.bind(config.bindDN, config.bindCredentials, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Search for user
                const searchOptions = {
                    filter: config.searchFilter.replace('{{username}}', username),
                    scope: 'sub',
                    attributes: ['uid', 'cn', 'mail', 'memberOf']
                };

                client.search(config.searchBase, searchOptions, (err, search) => {
                    if (err) {
                        client.unbind();
                        reject(err);
                        return;
                    }

                    let userFound = false;
                    search.on('searchEntry', (entry) => {
                        userFound = true;
                        const userDN = entry.objectName;
                        
                        // Authenticate user
                        const authClient = LDAP.createClient({ url: config.url });
                        authClient.bind(userDN, password, (authErr) => {
                            authClient.unbind();
                            client.unbind();
                            
                            if (authErr) {
                                reject(new Error('Invalid credentials'));
                            } else {
                                const user = {
                                    id: entry.object.uid,
                                    email: entry.object.mail,
                                    name: entry.object.cn,
                                    provider: 'ldap',
                                    groups: entry.object.memberOf || [],
                                    trustLevel: this.calculateTrustLevel(entry.object),
                                    permissions: this.getPermissions(entry.object.memberOf || [])
                                };
                                logger.debug(`[SSO] LDAP user authenticated: ${user.email}`);
                                resolve(user);
                            }
                        });
                    });

                    search.on('end', () => {
                        if (!userFound) {
                            client.unbind();
                            reject(new Error('User not found'));
                        }
                    });

                    search.on('error', (searchErr) => {
                        client.unbind();
                        reject(searchErr);
                    });
                });
            });
        });
    }

    /**
     * Calculate trust level based on provider and user attributes
     */
    calculateTrustLevel(profile) {
        // Base trust level by provider
        const providerTrust = {
            'azure': 'silver',
            'google': 'bronze',
            'okta': 'silver',
            'ldap': 'bronze'
        };

        let trustLevel = providerTrust[profile.provider] || 'bronze';

        // Upgrade to gold for certain conditions
        if (profile.groups && profile.groups.some(group => 
            group.includes('admin') || group.includes('executive') || group.includes('senior')
        )) {
            trustLevel = 'gold';
        }

        return trustLevel;
    }

    /**
     * Get permissions based on groups
     */
    getPermissions(groups) {
        const permissions = new Set(['read:own', 'write:own']);

        // Add permissions based on group membership
        groups.forEach(group => {
            if (group.includes('admin')) {
                permissions.add('admin:basic');
                permissions.add('write:shared');
            }
            if (group.includes('developer') || group.includes('engineer')) {
                permissions.add('analyze:private');
                permissions.add('read:shared');
            }
            if (group.includes('analyst') || group.includes('data')) {
                permissions.add('analyze:public');
                permissions.add('analyze:private');
            }
        });

        return Array.from(permissions);
    }

    /**
     * Get Google groups from profile
     */
    getGoogleGroups(_profile) {
        // Google doesn't provide groups in basic OAuth
        // This would require Google Admin SDK integration
        return [];
    }

    /**
     * Middleware to protect routes with SSO
     */
    requireSSO(_providers = []) {
        return (req, res, next) => {
            // Check if user is authenticated via JWT
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({
                    error: 'Authentication required',
                    providers: Array.from(this.providers.keys()),
                    loginUrls: this.getLoginUrls()
                });
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = decoded;
                next();
            } catch (error) {
                return res.status(401).json({
                    error: 'Invalid or expired token',
                    providers: Array.from(this.providers.keys()),
                    loginUrls: this.getLoginUrls()
                });
            }
        };
    }

    /**
     * Get login URLs for all configured providers
     */
    getLoginUrls() {
        const urls = {};
        
        if (this.providers.has('azure')) {
            urls.azure = '/auth/azure';
        }
        if (this.providers.has('google')) {
            urls.google = '/auth/google';
        }
        if (this.providers.has('okta')) {
            urls.okta = '/auth/okta';
        }
        if (this.providers.has('ldap')) {
            urls.ldap = '/auth/ldap';
        }

        return urls;
    }

    /**
     * Generate JWT token for authenticated user
     */
    generateToken(user) {
        return jwt.sign({
            sub: user.id,
            email: user.email,
            name: user.name,
            provider: user.provider,
            trustLevel: user.trustLevel,
            permissions: user.permissions
        }, process.env.JWT_SECRET, { expiresIn: '24h' });
    }
}

module.exports = SSOMiddleware;
