// SPDX-License-Identifier: MIT
/**
 * Platform Jest config — CLI package tests use node:test (see packages/simplebeacon-cli).
 *
 * @license MIT
 */

const constants = require('./server/config/constants.cjs');
const TEST_TIMEOUT_MS = constants.TIMEOUT_30S;

module.exports = {
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
  testTimeout: TEST_TIMEOUT_MS,
  globals: {
    'NODE_ENV': 'test'
  }
};
