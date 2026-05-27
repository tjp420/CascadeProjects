/**
 * Jest configuration for the AI Coding Intelligence Dashboard
 * CommonJS version to avoid ES module issues
 */

module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(jsx?|js)$': ['babel-jest', { presets: ['@babel/preset-env'] }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|lodash|chart\\.js)/)'
  ],
    coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'dashboard_components/core/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/*.test.js',
    '!**/*.spec.js'
  ],
  testMatch: [
    '**/*.test.js',
    '**/__tests__/**/*.test.js'
  ],
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx'],
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },
  coverageThreshold: {
    global: {
      lines: 70,
      statements: 70,
      branches: 60,
      functions: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.simple.js']
};
