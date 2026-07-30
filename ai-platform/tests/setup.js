// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Jest Test Setup
 * 
 * This file sets up the test environment for all Jest tests.
 */

// Set test environment
// Provide a safe, minimal override for a few heavy constants, but keep the
// real constants facade available for tests that depend on its helpers.
// Merge real constants with a small override so tests still see all helpers.
// Use a factory that calls `jest.requireActual` inside so Jest's hoisting rules are satisfied.
jest.mock('../server/config/constants.cjs', () => {
  try {
    const realConstants = jest.requireActual('../server/config/constants.cjs');
    return Object.freeze(Object.assign({}, realConstants, {
      TIMEOUT_30S: 30000,
      TIMEOUT_8S: 8000,
      TIMEOUT_12S: 12000,
      TIMEOUT_1M: 60000,
      MAX_RATE_LIMIT: 1000
    }));
  } catch (e) {
    return {
      TIMEOUT_30S: 30000,
      TIMEOUT_8S: 8000,
      TIMEOUT_12S: 12000,
      TIMEOUT_1M: 60000,
      MAX_RATE_LIMIT: 1000
    };
  }
});
const constants = require('../server/config/constants.cjs');

// Normalize `minimatch` shape for Jest runtime: some installed versions export
// an object with named exports while other code expects a callable function.
try {
  jest.mock('minimatch', () => {
    // Defer to the real package and wrap it if needed
    // eslint-disable-next-line global-require
    const real = require('minimatch');
    if (typeof real === 'function') return real;
    // v9+ exports named functions; expose a callable signature compatible with older code
    const fn = function (pattern, str, opts) {
      if (typeof real === 'function') return real(pattern, str, opts);
      if (real && typeof real.minimatch === 'function') return real.minimatch(str, pattern, opts);
      if (real && typeof real.match === 'function') return real.match(str, pattern, opts);
      throw new Error('minimatch shim: underlying minimatch shape unsupported');
    };
    // copy properties
    Object.assign(fn, real);
    return fn;
  });
} catch (e) {
  // best-effort; don't fail tests if mocking fails
}
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in test output. Set KEEP_CONSOLE=1 to passthrough real console.
const originalConsole = global.console;
let __consoleMocked = false;

if (!process.env.KEEP_CONSOLE) {
  beforeAll(() => {
    __consoleMocked = true;
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
    if (__consoleMocked) global.console = originalConsole;
  });
} else {
  // No-op hooks when console passthrough is requested
  beforeAll(() => {});
  afterAll(() => {});
}

// Mock environment variables that might be missing in test environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-32chars-minimum';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-key-for-testing-32chars';
process.env.REQUIRE_AUTH = process.env.REQUIRE_AUTH || 'true';
process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = process.env.SIMPLEBEACON_INTERNAL_DASHBOARD || 'true';
// Provide a test license secret so license verification branches run during unit tests
process.env.SIMPLEBEACON_LICENSE_SECRET = process.env.SIMPLEBEACON_LICENSE_SECRET || 'test-license-secret';

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
