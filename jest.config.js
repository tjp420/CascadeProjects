/** @type {import('jest').Config} */
module.exports = {
  // 1. Core Runtime Targets
  testEnvironment: 'node',
  verbose: false,
  testMatch: ['<rootDir>/simplebeacon-vscode-merged/dashboard-web/js/**/__tests__/**/*.js?(x)'],

  // 2. Strict Workspace Isolation Paths
  roots: ['<rootDir>/simplebeacon-vscode-merged/dashboard-web/js'],
  modulePathIgnorePatterns: [
    '<rootDir>/.simplebeacon/',
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
  ],

  // 3. High-Density Coverage Harvesting (Istanbul)
  collectCoverage: true,
  coverageDirectory: '<rootDir>/.simplebeacon/coverage',
  coverageReporters: ['json', 'text-summary', 'lcov'],
  collectCoverageFrom: [
    'simplebeacon-vscode-merged/dashboard-web/js/**/*.js',
    '!simplebeacon-vscode-merged/dashboard-web/js/**/*.test.js',
    '!simplebeacon-vscode-merged/dashboard-web/js/__tests__/**',
    '!simplebeacon-vscode-merged/dashboard-web/js/fixtures/**', // simplebeacon-ignore production-leak — Jest coverage exclusion, not a prod path
    '!simplebeacon-vscode-merged/dashboard-web/js/mocks/**',
  ],

  // 4. Automation Quality Gate Thresholds
  // NOTE: Raise these thresholds as the test suite grows. 80/75/80/80 is the target.
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    },
  },

  passWithNoTests: true,
};
