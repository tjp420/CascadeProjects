// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Jest Test Setup
 * 
 * This file sets up the test environment for all Jest tests.
 */

// Set test environment
const constants = require('../server/config/constants.cjs');
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in test output
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    // Keep error and warn for debugging
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: originalConsole.error,
    warn: originalConsole.warn,
  };
});

afterAll(() => {
  global.console = originalConsole;
});

// Mock environment variables that might be missing in test environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-32chars-minimum';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-key-for-testing-32chars';
process.env.REQUIRE_AUTH = process.env.REQUIRE_AUTH || 'true';
process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = process.env.SIMPLEBEACON_INTERNAL_DASHBOARD || 'true';

// Increase timeout for async operations
jest.setTimeout(constants.TIMEOUT_30S);

// Global test utilities
global.testUtils = {
  // Helper to create mock request objects
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  }),
  
  // Helper to create mock response objects
  mockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis()
    };
    return res;
  },
  
  // Helper to create mock next function
  mockNext: () => jest.fn(),
  
  // Helper to wait for async operations
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to generate test JWT tokens
  generateTestToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    const defaultPayload = {
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };
    return jwt.sign({ ...defaultPayload, ...payload }, process.env.JWT_SECRET);
  },
  
  // Helper to create test database connection
  createTestDb: async () => {
    // This would be implemented when database is available
    return null;
  },
  
  // Helper to clean up test data
  cleanupTestData: async () => {
    // This would be implemented to clean up test data
    return Promise.resolve();
  }
};

// Setup and teardown hooks
beforeEach(async () => {
  // Restore all mocks and spies before each test
  jest.restoreAllMocks();

  // Clean up any test data
  await global.testUtils.cleanupTestData();
});

afterEach(async () => {
  // Clean up any test data after each test
  await global.testUtils.cleanupTestData();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Mock external services that might not be available in test environment
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(true),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    quit: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock PostgreSQL client
jest.mock('pg', () => ({
  Client: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(true),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(true)
  })),
  Pool: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue(true)
  }))
}));

// Export setup for use in other files
module.exports = {
  testUtils: global.testUtils
};
