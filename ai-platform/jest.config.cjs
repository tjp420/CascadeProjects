// SPDX-License-Identifier: MIT
/**
 * Platform Jest config — CLI package tests use node:test (see packages/simplebeacon-cli).
 *
 * @license MIT
 */

// Avoid requiring the full constants facade at Jest config time to prevent
// potential circular require issues during test runner startup.
const TEST_TIMEOUT_MS = 30 * 1000; // 30s

module.exports = {
  testEnvironment: 'node',
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js',
    '<rootDir>/server/**/__tests__/**/*.test.cjs',
    '<rootDir>/src/**/__tests__/**/*.test.cjs',
    '<rootDir>/monitoring/**/__tests__/**/*.test.cjs'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/github-cache/',
    '/.github-sync/',
    '/packages/simplebeacon-cli/tests/',
    '/packages/simplebeacon-intelligence/tests/',
    '/tests/integration/',
    'services/__tests__/prompt-service\\.test\\.cjs$',
    'services/__tests__/ollama-client\\.test\\.cjs$',
    'services/__tests__/model-inference-service\\.test\\.cjs$',
    'services/__tests__/enhanced-model-manager\\.test\\.cjs$',
    'services/__tests__/local-model-service\\.test\\.cjs$',
    'services/__tests__/cloud-inference-service\\.test\\.cjs$',
    'middleware/__tests__/upload-security\\.test\\.cjs$',
    'middleware/__tests__/simplebeacon-subscription\\.test\\.cjs$',
    'middleware/__tests__/audit\\.test\\.cjs$',
    'bootstrap/__tests__/phase2-integration\\.test\\.cjs$',
    'server/bootstrap/__tests__/dashboard-auth\\.test\\.cjs$',
    'server/lib/__tests__/agentic-orchestration\\.test\\.cjs$',
    'server/lib/storage/__tests__/reassembler\\.test\\.cjs$',
    'server/lib/storage/__tests__/repair-worker\\.test\\.cjs$',
    'server/lib/crypto/ratchet/__tests__/secret-scanner\\.test\\.cjs$',
    'server/lib/hsm-adapter/__tests__/track113/hardening-primitives\\.test\\.cjs$',
    'server/lib/hsm-adapter/__tests__/pq-lattice-fuzz-matrix\\.test\\.cjs$',
    'server/lib/hsm-adapter/__tests__/pq-mutation-fuzz\\.test\\.cjs$',
    'server/lib/hsm-adapter/__tests__/openapi-contract\\.test\\.cjs$',
    'server/lib/__tests__/ci-telemetry-store\\.test\\.cjs$',
    'server/lib/hsm-adapter/__tests__/zkp-identity\\.test\\.cjs$'
  ],
  moduleFileExtensions: ['js', 'cjs', 'json', 'jsx', 'ts', 'tsx', 'node'],
  moduleNameMapper: {
    '\\.\\./shared-utils/index\\.cjs$': '<rootDir>/shared-utils/index.cjs',
    '^node:test$': '<rootDir>/tests/shims/node-test-shim.cjs',
    '^node:assert/strict$': '<rootDir>/tests/shims/node-assert-shim.cjs',
    '^node:assert$': '<rootDir>/tests/shims/node-assert-shim.cjs'
  },
  passWithNoTests: true,
  forceExit: true,
  setupFilesAfterEnv: process.env.CI ? [] : ['<rootDir>/tests/setup.js'],
  testTimeout: TEST_TIMEOUT_MS,
  globals: {
    'NODE_ENV': 'test'
  }
};
