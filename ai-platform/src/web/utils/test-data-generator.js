/**
 * Test Data Generator Utility
 * Provides centralized utilities for generating test data instead of using hardcoded values
 */

/**
 * Generate test email addresses
 * @param {string} prefix - Email prefix (default: 'test')
 * @param {string} domain - Domain name (default: 'example.com')
 * @returns {string} Generated email address
 */
export function generateTestEmail(prefix = 'test', domain = 'example.com') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}.${timestamp}.${random}@${domain}`;
}

/**
 * Generate test phone numbers
 * @param {string} pattern - Phone pattern (default: '555')
 * @returns {string} Generated phone number
 */
export function generateTestPhone(pattern = '555') {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const exchange = Math.floor(Math.random() * 900) + 100;
    const number = Math.floor(Math.random() * 9000) + 1000;
    return `${pattern}-${areaCode}-${exchange}-${number}`;
}

/**
 * Generate test dates
 * @param {string} type - Date type ('past', 'future', 'specific')
 * @param {Date} baseDate - Base date for calculations
 * @returns {string} Generated date in ISO format
 */
export function generateTestDate(type = 'past', baseDate = new Date()) {
    const date = new Date(baseDate);
    
    switch (type) {
    case 'past':
        date.setDate(date.getDate() - Math.floor(Math.random() * 365));
        break;
    case 'future':
        date.setDate(date.getDate() + Math.floor(Math.random() * 365));
        break;
    case 'specific':
        // Return a consistent test date
        return '2024-01-01T00:00:00.000Z';
    default:
        return date.toISOString();
    }
    
    return date.toISOString();
}

/**
 * Generate test IDs
 * @param {string} prefix - ID prefix
 * @param {string} type - ID type ('uuid', 'numeric', 'sequential')
 * @param {number} counter - Sequential counter
 * @returns {string} Generated ID
 */
export function generateTestId(prefix = 'test', type = 'uuid', counter = 1) {
    switch (type) {
    case 'uuid':
        return `${prefix}-${crypto.randomUUID()}`;
    case 'numeric':
        return String(counter);
    case 'sequential':
        return `${prefix}_${String(counter).padStart(8, '0')}`;
    default:
        return crypto.randomUUID();
    }
}

/**
 * Generate test URLs
 * @param {string} type - URL type ('api', 'webhook', 'local')
 * @param {string} path - URL path
 * @returns {string} Generated URL
 */
export function generateTestUrl(type = 'api', path = '') {
    const baseUrl = type === 'local' ? 'http://localhost:3000' : 'https://api.example.com';
    return `${baseUrl}${path}`;
}

/**
 * Generate test database names
 * @param {string} environment - Environment ('test', 'dev', 'staging')
 * @returns {string} Generated database name
 */
export function generateTestDbName(environment = 'test') {
    const timestamp = Date.now();
    return `${environment}_db_${timestamp}`;
}

/**
 * Generate test user data
 * @param {Object} overrides - Override properties
 * @returns {Object} Generated user object
 */
export function generateTestUser(overrides = {}) {
    const timestamp = Date.now();
    const defaultUser = {
        id: generateTestId('user', 'numeric', timestamp),
        email: generateTestEmail('user'),
        phone: generateTestPhone(),
        firstName: 'Test',
        lastName: 'User',
        username: `testuser_${timestamp}`,
        createdAt: generateTestDate('past'),
        updatedAt: generateTestDate()
    };
    
    return { ...defaultUser, ...overrides };
}

/**
 * Generate test API response data
 * @param {string} endpoint - API endpoint identifier
 * @param {Object} data - Response data
 * @returns {Object} Generated API response
 */
export function generateTestApiResponse(endpoint, data = {}) {
    return {
        success: true,
        data: data,
        message: `Test response for ${endpoint}`,
        timestamp: generateTestDate(),
        requestId: generateTestId('request')
    };
}

/**
 * Environment-specific configuration getter
 * @param {string} key - Configuration key
 * @param {string} environment - Current environment
 * @returns {*} Configuration value
 */
export function getTestConfig(key, environment = 'test') {
    const configs = {
        test: {
            database: {
                url: ':memory:',
                name: generateTestDbName('test')
            },
            api: {
                baseUrl: 'http://localhost:3000',
                timeout: 5000
            },
            auth: {
                token: 'test_token_' + Date.now(),
                expiresIn: 3600
            }
        },
        development: {
            database: {
                url: 'mongodb://localhost:27017/dev',
                name: generateTestDbName('dev')
            },
            api: {
                baseUrl: 'http://localhost:3000',
                timeout: 10000
            },
            auth: {
                token: 'dev_token_' + Date.now(),
                expiresIn: 7200
            }
        }
    };
    
    const keys = key.split('.');
    let value = configs[environment];
    
    for (const k of keys) {
        value = value?.[k];
    }
    
    return value;
}

export default {
    generateTestEmail,
    generateTestPhone,
    generateTestDate,
    generateTestId,
    generateTestUrl,
    generateTestDbName,
    generateTestUser,
    generateTestApiResponse,
    getTestConfig
};
