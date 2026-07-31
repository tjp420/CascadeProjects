/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  verbose: false,
  modulePathIgnorePatterns: [
    '<rootDir>/.simplebeacon/',
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
    // Ignore local-agent build artifacts
    '<rootDir>/local-agent/dist/',
    // Ignore generated ES2018 bundles and duplicated utils-lib packages
    '<rootDir>/web/**/js-es2018/',
    '<rootDir>/web/**/js/**/utils-lib/',
  ],
  collectCoverage: false,
  passWithNoTests: true,
};
