/** Platform Jest config — CLI package tests use node:test (see packages/simplebeacon-cli). */
export default {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/github-cache/',
    '/.github-sync/',
    '/packages/simplebeacon-cli/tests/',
    '/packages/simplebeacon-intelligence/tests/'
  ],
  passWithNoTests: true
};
