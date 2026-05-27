/**
 * Test Fixtures
 * Provides centralized test data fixtures to replace hardcoded values
 */

import { generateTestUser, generateTestEmail, generateTestPhone, generateTestDate } from './test-data-generator.js';

/**
 * User test fixtures
 */
export const UserFixtures = {
    validUser: generateTestUser({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
    }),
    
    adminUser: generateTestUser({
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        permissions: ['read', 'write', 'delete']
    }),
    
    guestUser: generateTestUser({
        firstName: 'Guest',
        lastName: 'User',
        role: 'guest',
        permissions: ['read']
    }),
    
    inactiveUser: generateTestUser({
        isActive: false,
        deactivatedAt: generateTestDate('past')
    }),
    
    newUser: generateTestUser({
        isNewUser: true,
        lastLogin: null
    })
};

/**
 * API response fixtures
 */
export const ApiFixtures = {
    successResponse: (data) => ({
        success: true,
        data: data,
        message: 'Operation successful',
        timestamp: new Date().toISOString()
    }),
    
    errorResponse: (message, code = 400) => ({
        success: false,
        error: {
            code,
            message,
            timestamp: new Date().toISOString()
        }
    }),
    
    paginatedResponse: (data, page = 1, limit = 10, total = 100) => ({
        success: true,
        data: data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1
        },
        timestamp: new Date().toISOString()
    }),
    
    validationErrorResponse: (errors) => ({
        success: false,
        error: {
            code: 422,
            message: 'Validation failed',
            errors: errors,
            timestamp: new Date().toISOString()
        }
    })
};

/**
 * Database fixtures
 */
export const DatabaseFixtures = {
    users: [
        UserFixtures.validUser,
        UserFixtures.adminUser,
        UserFixtures.guestUser
    ],
    
    posts: [
        {
            id: '1',
            title: 'Test Post 1',
            content: 'This is a test post content',
            authorId: UserFixtures.validUser.id,
            createdAt: generateTestDate('past'),
            updatedAt: generateTestDate()
        },
        {
            id: '2',
            title: 'Test Post 2',
            content: 'Another test post content',
            authorId: UserFixtures.adminUser.id,
            createdAt: generateTestDate('past'),
            updatedAt: generateTestDate()
        }
    ],
    
    comments: [
        {
            id: '1',
            content: 'Great post!',
            authorId: UserFixtures.guestUser.id,
            postId: '1',
            createdAt: generateTestDate('past')
        },
        {
            id: '2',
            content: 'Thanks for sharing',
            authorId: UserFixtures.validUser.id,
            postId: '2',
            createdAt: generateTestDate('past')
        }
    ]
};

/**
 * Email fixtures
 */
export const EmailFixtures = {
    validEmails: [
        'test@example.com',
        'user@test.org',
        'admin@demo.net'
    ],
    
    invalidEmails: [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com'
    ],
    
    testEmail: () => generateTestEmail(),
    
    businessEmail: () => generateTestEmail('business', 'company.com'),
    
    personalEmail: () => generateTestEmail('personal', 'mail.com')
};

/**
 * Phone number fixtures
 */
export const PhoneFixtures = {
    validPhones: [
        '+1-555-123-4567',
        '+1-555-987-6543',
        '+44-20-1234-5678'
    ],
    
    invalidPhones: [
        '123',
        '555-',
        'phone-number',
        '+1-555-ABCD'
    ],
    
    testPhone: () => generateTestPhone(),
    
    businessPhone: () => generateTestPhone('800'),
    
    personalPhone: () => generateTestPhone('555')
};

/**
 * Date fixtures
 */
export const DateFixtures = {
    pastDate: () => generateTestDate('past'),
    futureDate: () => generateTestDate('future'),
    specificDate: () => generateTestDate('specific'),
    today: () => new Date().toISOString(),
    yesterday: () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date.toISOString();
    },
    tomorrow: () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        return date.toISOString();
    }
};

/**
 * URL fixtures
 */
export const UrlFixtures = {
    localUrls: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:8080'
    ],
    
    apiUrls: [
        'https://api.example.com/users',
        'https://api.example.com/posts',
        'https://api.example.com/comments'
    ],
    
    testUrls: [
        'https://test.example.com',
        'https://demo.example.com',
        'https://staging.example.com'
    ],
    
    webhookUrls: [
        'https://webhook.example.com/events',
        'https://webhook.example.com/notifications',
        'https://webhook.example.com/callbacks'
    ]
};

/**
 * Authentication fixtures
 */
export const AuthFixtures = {
    validTokens: [
        'jwt.test.token',
        'Bearer fixture-placeholder-token'
    ],
    
    invalidTokens: [
        'invalid-token',
        '',
        null,
        'expired.token'
    ],
    
    userCredentials: {
        valid: {
            email: UserFixtures.validUser.email,
            password: 'ValidPassword123!'
        },
        invalid: {
            email: 'invalid@example.com',
            password: 'WrongPassword123!'
        }
    },
    
    permissions: {
        admin: ['read', 'write', 'delete', 'manage'],
        user: ['read', 'write'],
        guest: ['read'],
        none: []
    }
};

/**
 * Environment configuration fixtures
 */
export const ConfigFixtures = {
    test: {
        database: {
            url: ':memory:',
            name: 'test_db',
            timeout: 5000
        },
        api: {
            baseUrl: 'http://localhost:3000',
            timeout: 5000,
            retries: 3
        },
        auth: {
            secret: 'fixture-auth-placeholder',
            expiresIn: '1h'
        }
    },
    
    development: {
        database: {
            url: 'mongodb://localhost:27017/dev',
            name: 'dev_db',
            timeout: 10000
        },
        api: {
            baseUrl: 'http://localhost:3000',
            timeout: 10000,
            retries: 5
        },
        auth: {
            secret: 'fixture-auth-dev-placeholder',
            expiresIn: '24h'
        }
    },
    
    production: {
        database: {
            url: process.env.DATABASE_URL,
            name: process.env.DB_NAME,
            timeout: 30000
        },
        api: {
            baseUrl: process.env.API_BASE_URL,
            timeout: 30000,
            retries: 10
        },
        auth: {
            secret: process.env.AUTH_SECRET,
            expiresIn: '1h'
        }
    }
};

/**
 * Error fixtures
 */
export const ErrorFixtures = {
    networkError: {
        name: 'NetworkError',
        message: 'Network request failed',
        code: 'NETWORK_ERROR'
    },
    
    validationError: {
        name: 'ValidationError',
        message: 'Invalid input data',
        code: 'VALIDATION_ERROR',
        details: {
            field: 'email',
            message: 'Invalid email format'
        }
    },
    
    authenticationError: {
        name: 'AuthenticationError',
        message: 'Invalid or expired token',
        code: 'AUTH_ERROR'
    },
    
    authorizationError: {
        name: 'AuthorizationError',
        message: 'Insufficient permissions',
        code: 'AUTHZ_ERROR'
    },
    
    databaseError: {
        name: 'DatabaseError',
        message: 'Database connection failed',
        code: 'DB_ERROR'
    }
};

export default {
    UserFixtures,
    ApiFixtures,
    DatabaseFixtures,
    EmailFixtures,
    PhoneFixtures,
    DateFixtures,
    UrlFixtures,
    AuthFixtures,
    ConfigFixtures,
    ErrorFixtures
};
