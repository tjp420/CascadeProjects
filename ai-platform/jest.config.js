/** Platform Jest config — CLI package tests use node:test (see packages/simplebeacon-cli). */
export default {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 8,
      lines: 10,
      statements: 10
    }
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/github-cache/',
    '/.github-sync/',
    '/packages/simplebeacon-cli/tests/',
    '/packages/simplebeacon-intelligence/tests/',
    '/tests/integration/'
  ],
  passWithNoTests: true,
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  testTimeout: 30000,
  globals: {
    'NODE_ENV': 'test'
  }
};
