/**
 * Simple Jest configuration for ES modules
 */

export default {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testMatch: [
        '**/tests/**/*.test.js'
    ],
    collectCoverageFrom: [
        'dashboard_components/**/*.js'
    ],
    coverageDirectory: 'coverage',
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    verbose: true,
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    transform: {},
    preset: 'ts-jest'
};
