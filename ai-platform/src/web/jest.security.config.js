/**
 * Jest Configuration for Security Tests
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // Test files
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],
    
    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'web/**/*.js',
        'web/**/*.ts',
        '!web/node_modules/**',
        '!web/coverage/**',
        '!web/tests/**'
    ],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        },
        './web/security/': {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90
        }
    },
    
    // Security-specific settings
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    verbose: true,
    
    // Transform configuration
    transform: {
        '^.+\\.(js|jsx)$': 'babel-jest'
    },
    
    // Module configuration
    moduleFileExtensions: ['js', 'jsx', 'json', 'ts', 'tsx'],
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/web/$1'
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Security test reporter
    reporters: [
        'default',
        [
            'jest-junit',
            {
                outputDirectory: 'test-results',
                outputName: 'security-test-results.xml',
                classNameTemplate: '{classname}',
                titleTemplate: '{title}',
                ancestorSeparator: ' > ',
                usePathForSuiteName: true
            }
        ]
    ]
};
