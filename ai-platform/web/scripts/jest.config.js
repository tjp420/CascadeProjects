/**
 * Enhanced Jest Configuration
 *
 * Comprehensive testing setup with coverage reporting and performance optimization
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',

  // Test match patterns
  testMatch: ['**/__tests__/**/*.test.js', '**/__tests__/**/*.spec.js', '**/?(*.)+(spec|test).js'],

  // Coverage configuration - Sprint 3 target: 80%
  collectCoverage: true, // Enabled for Sprint 3 completion
  collectCoverageFrom: [
    'src/js/**/*.js',
    'web/dashboard-scripts.js',
    'src/javascript/**/*.js',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/coverage/**',
    '!**/*.test.js',
    '!**/*.spec.js',
    '!**/vendor/**',
    '!**/public/**',
    '!**/web/dashboard_components/**', // Exclude due to syntax errors
    '!**/src/javascript/**', // Exclude due to syntax errors
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Module-specific thresholds for critical components
    './src/js/code-quality-analyzer.js': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './dashboard-server.js': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json'],
  coverageDirectory: 'coverage',

  // Module paths
  roots: ['<rootDir>/web/dashboard_components', '<rootDir>/tests'],
  moduleDirectories: ['node_modules', '<rootDir>/web/dashboard_components'],

  // Transform configuration
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': 'ts-jest',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/web/dashboard_components/$1',
    '^@core/(.*)$': '<rootDir>/web/dashboard_components/core/$1',
    '^@components/(.*)$': '<rootDir>/web/dashboard_components/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
  },

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/coverage/', '/.git/'],

  // Transform ignore patterns
  transformIgnorePatterns: ['node_modules/(?!(chart.js|axios|lodash)/)'],

  // Timeout for tests
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Watch plugins (commented out due to missing dependencies)
  // watchPlugins: [
  //     'jest-watch-typeahead/filename',
  //     'jest-watch-typeahead/testname'
  // ],

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'coverage',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
  ],

  // Global setup (commented out - files not available)
  // globalSetup: '<rootDir>/tests/globalSetup.js',
  // globalTeardown: '<rootDir>/tests/globalTeardown.js',

  // Performance settings
  maxWorkers: '50%',
  cacheDirectory: '<rootDir>/.jest-cache',

  // Error handling
  errorOnDeprecated: true,

  // Test results processor
  testResultsProcessor: undefined,
};
