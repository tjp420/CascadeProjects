/**
 * SSO Provider Configurations
 * 
 * Centralized configuration for all SSO providers
 * with environment-specific settings and validation
 */

const logger = require('../lib/app-logger');


class SSOProviderConfig {
    constructor() {
        this.configs = new Map();
        this.loadConfigurations();
        this.validateConfigs();
    }

    /**
     * Load SSO provider configurations from environment variables
     */
    loadConfigurations() {
        // Azure AD Configuration
        this.configs.set('azure', {
            enabled: process.env.AZURE_AD_ENABLED === 'true',
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            tenantId: process.env.AZURE_AD_TENANT_ID,
            resource: process.env.AZURE_AD_RESOURCE || 'https://graph.microsoft.com',
            redirectUri: process.env.AZURE_AD_REDIRECT_URI || `${process.env.BASE_URL}/auth/azure/callback`,
            scopes: ['openid', 'profile', 'email', 'User.Read', 'GroupMember.Read.All'],
            metadataUrl: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/.well-known/openid-configuration`,
            logoutUrl: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/logout`
        });

        // Google Workspace Configuration
        this.configs.set('google', {
            enabled: process.env.GOOGLE_SSO_ENABLED === 'true',
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            domain: process.env.GOOGLE_DOMAIN,
            redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL}/auth/google/callback`,
            scopes: ['profile', 'email', 'https://www.googleapis.com/auth/admin.directory.group.readonly'],
            hostedDomain: process.env.GOOGLE_HOSTED_DOMAIN,
            accessType: 'offline',
            prompt: 'consent'
        });

        // Okta Configuration
        this.configs.set('okta', {
            enabled: process.env.OKTA_ENABLED === 'true',
            clientId: process.env.OKTA_CLIENT_ID,
            clientSecret: process.env.OKTA_CLIENT_SECRET,
            issuer: process.env.OKTA_ISSUER,
            orgUrl: process.env.OKTA_ORG_URL,
            redirectUri: process.env.OKTA_CALLBACK_URL || `${process.env.BASE_URL}/auth/okta/callback`,
            entryPoint: process.env.OKTA_ENTRY_POINT,
            cert: process.env.OKTA_CERTIFICATE,
            audience: process.env.OKTA_AUDIENCE,
            attributeMapping: {
                email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
                name: 'displayName',
                groups: 'http://schemas.xmlsoap.org/claims/Group'
            }
        });

        // LDAP Configuration
        this.configs.set('ldap', {
            enabled: process.env.LDAP_ENABLED === 'true',
            url: process.env.LDAP_URL,
            bindDN: process.env.LDAP_BIND_DN,
            bindCredentials: process.env.LDAP_BIND_CREDENTIALS,
            searchBase: process.env.LDAP_SEARCH_BASE,
            searchFilter: process.env.LDAP_SEARCH_FILTER || '(uid={{username}})',
            searchAttributes: ['uid', 'cn', 'mail', 'memberOf', 'title', 'department'],
            groupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE,
            groupSearchFilter: process.env.LDAP_GROUP_SEARCH_FILTER || '(member={{userdn}})',
            timeout: process.env.LDAP_TIMEOUT || 5000,
            connectTimeout: process.env.LDAP_CONNECT_TIMEOUT || 10000,
            tlsOptions: {
                rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false'
            }
        });

        // SAML 2.0 Generic Configuration
        this.configs.set('saml', {
            enabled: process.env.SAML_ENABLED === 'true',
            entryPoint: process.env.SAML_ENTRY_POINT,
            issuer: process.env.SAML_ISSUER || process.env.BASE_URL,
            callbackUrl: process.env.SAML_CALLBACK_URL || `${process.env.BASE_URL}/auth/saml/callback`,
            cert: process.env.SAML_CERTIFICATE,
            privateKey: process.env.SAML_PRIVATE_KEY,
            signatureAlgorithm: process.env.SAML_SIGNATURE_ALGORITHM || 'sha256',
            digestAlgorithm: process.env.SAML_DIGEST_ALGORITHM || 'sha256',
            attributeMapping: {
                email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
                name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
                firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
                lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
                groups: 'http://schemas.xmlsoap.org/claims/Group'
            }
        });
    }

    /**
     * Validate all SSO configurations
     */
    validateConfigs() {
        const errors = [];

        this.configs.forEach((config, provider) => {
            if (config.enabled) {
                const validation = this.validateProviderConfig(provider, config);
                if (!validation.valid) {
                    errors.push(...validation.errors);
                }
            }
        });

        if (errors.length > 0) {
            console.error('[SSO Config] Configuration validation failed:');
            errors.forEach(error => console.error(`  - ${error}`));
            
            if (process.env.NODE_ENV === 'production') {
                throw new Error('SSO configuration validation failed');
            }
        } else {
            logger.debug('[SSO Config] All enabled provider configurations are valid');
        }
    }

    /**
     * Validate individual provider configuration
     */
    validateProviderConfig(provider, config) {
        const errors = [];

        switch (provider) {
            case 'azure':
                if (!config.clientId) errors.push('Azure AD: Client ID is required');
                if (!config.clientSecret) errors.push('Azure AD: Client Secret is required');
                if (!config.tenantId) errors.push('Azure AD: Tenant ID is required');
                break;

            case 'google':
                if (!config.clientId) errors.push('Google: Client ID is required');
                if (!config.clientSecret) errors.push('Google: Client Secret is required');
                break;

            case 'okta':
                if (!config.clientId) errors.push('Okta: Client ID is required');
                if (!config.clientSecret) errors.push('Okta: Client Secret is required');
                if (!config.issuer) errors.push('Okta: Issuer is required');
                if (!config.orgUrl) errors.push('Okta: Org URL is required');
                break;

            case 'ldap':
                if (!config.url) errors.push('LDAP: URL is required');
                if (!config.bindDN) errors.push('LDAP: Bind DN is required');
                if (!config.bindCredentials) errors.push('LDAP: Bind Credentials is required');
                if (!config.searchBase) errors.push('LDAP: Search Base is required');
                break;

            case 'saml':
                if (!config.entryPoint) errors.push('SAML: Entry Point is required');
                if (!config.issuer) errors.push('SAML: Issuer is required');
                if (!config.cert) errors.push('SAML: Certificate is required');
                break;
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get configuration for a specific provider
     */
    getConfig(provider) {
        return this.configs.get(provider);
    }

    /**
     * Get all enabled providers
     */
    getEnabledProviders() {
        const enabled = [];
        this.configs.forEach((config, provider) => {
            if (config.enabled) {
                enabled.push({
                    name: provider,
                    displayName: this.getProviderDisplayName(provider),
                    type: this.getProviderType(provider),
                    config: this.sanitizeConfig(config)
                });
            }
        });
        return enabled;
    }

    /**
     * Get display name for provider
     */
    getProviderDisplayName(provider) {
        const displayNames = {
            'azure': 'Microsoft Azure AD',
            'google': 'Google Workspace',
            'okta': 'Okta',
            'ldap': 'LDAP/Active Directory',
            'saml': 'SAML 2.0'
        };
        return displayNames[provider] || provider;
    }

    /**
     * Get provider type (oauth2, saml, ldap)
     */
    getProviderType(provider) {
        const types = {
            'azure': 'oauth2',
            'google': 'oauth2',
            'okta': 'saml',
            'ldap': 'ldap',
            'saml': 'saml'
        };
        return types[provider] || 'unknown';
    }

    /**
     * Sanitize configuration for API responses (remove secrets)
     */
    sanitizeConfig(config) {
        const sanitized = { ...config };
        delete sanitized.clientSecret;
        delete sanitized.bindCredentials;
        delete sanitized.privateKey;
        delete sanitized.cert;
        return sanitized;
    }

    /**
     * Generate environment template
     */
    generateEnvironmentTemplate() {
        let template = '# SSO Provider Configuration\n\n';

        template += '# Azure AD Configuration\n';
        template += 'AZURE_AD_ENABLED=false\n';
        template += 'AZURE_AD_CLIENT_ID=your_azure_client_id\n';
        template += 'AZURE_AD_CLIENT_SECRET=your_azure_client_secret\n';
        template += 'AZURE_AD_TENANT_ID=your_azure_tenant_id\n';
        template += 'AZURE_AD_RESOURCE=https://graph.microsoft.com\n';
        template += 'AZURE_AD_REDIRECT_URI=http://localhost:3000/auth/azure/callback\n\n';

        template += '# Google Workspace Configuration\n';
        template += 'GOOGLE_SSO_ENABLED=false\n';
        template += 'GOOGLE_CLIENT_ID=your_google_client_id\n';
        template += 'GOOGLE_CLIENT_SECRET=your_google_client_secret\n';
        template += 'GOOGLE_DOMAIN=your_company.com\n';
        template += 'GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback\n\n';

        template += '# Okta Configuration\n';
        template += 'OKTA_ENABLED=false\n';
        template += 'OKTA_CLIENT_ID=your_okta_client_id\n';
        template += 'OKTA_CLIENT_SECRET=your_okta_client_secret\n';
        template += 'OKTA_ISSUER=https://your_company.okta.com/oauth2/default\n';
        template += 'OKTA_ORG_URL=https://your_company.okta.com\n';
        template += 'OKTA_CALLBACK_URI=http://localhost:3000/auth/okta/callback\n';
        template += 'OKTA_CERTIFICATE=your_okta_certificate\n\n';

        template += '# LDAP Configuration\n';
        template += 'LDAP_ENABLED=false\n';
        template += 'LDAP_URL=ldap://ldap.your_company.com:389\n';
        template += 'LDAP_BIND_DN=cn=admin,dc=your_company,dc=com\n';
        template += 'LDAP_BIND_CREDENTIALS=your_ldap_password\n';
        template += 'LDAP_SEARCH_BASE=ou=users,dc=your_company,dc=com\n';
        template += 'LDAP_SEARCH_FILTER=(uid={{username}})\n';
        template += 'LDAP_GROUP_SEARCH_BASE=ou=groups,dc=your_company,dc=com\n\n';

        template += '# Generic SAML Configuration\n';
        template += 'SAML_ENABLED=false\n';
        template += 'SAML_ENTRY_POINT=https://your_idp.com/saml\n';
        template += 'SAML_ISSUER=http://localhost:3000\n';
        template += 'SAML_CALLBACK_URL=http://localhost:3000/auth/saml/callback\n';
        template += 'SAML_CERTIFICATE=your_saml_certificate\n';
        template += 'SAML_PRIVATE_KEY=your_saml_private_key\n\n';

        template += '# Base Configuration\n';
        template += 'BASE_URL=http://localhost:3000\n';
        template += 'JWT_SECRET=your_jwt_secret_key_here\n';

        return template;
    }

    /**
     * Get provider-specific metadata
     */
    getProviderMetadata(provider) {
        const config = this.configs.get(provider);
        if (!config || !config.enabled) {
            return null;
        }

        switch (provider) {
            case 'azure':
                return {
                    endpoints: {
                        authorization: `https://login.microsoftonline.com/${config.tenantId}/oauth2/authorize`,
                        token: `https://login.microsoftonline.com/${config.tenantId}/oauth2/token`,
                        userInfo: `https://graph.microsoft.com/v1.0/me`,
                        logout: config.logoutUrl
                    },
                    scopes: config.scopes
                };

            case 'google':
                return {
                    endpoints: {
                        authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
                        token: 'https://oauth2.googleapis.com/token',
                        userInfo: 'https://www.googleapis.com/oauth2/v2/userinfo',
                        admin: 'https://www.googleapis.com/admin/directory/v1/groups'
                    },
                    scopes: config.scopes
                };

            case 'okta':
                return {
                    endpoints: {
                        sso: config.entryPoint,
                        logout: `${config.orgUrl}/oauth2/v1/logout?id_token_hint={{id_token}}`
                    },
                    attributeMapping: config.attributeMapping
                };

            default:
                return {};
        }
    }
}

module.exports = SSOProviderConfig;
