// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Jest Test Setup
 * 
 * This file sets up the test environment for all Jest tests.
 */

// Set test environment
// Optionally mock heavy config constants to avoid loading the full constants
// facade in tests. Set MOCK_CONSTANTS=1 to enable the mock; otherwise the
// real `constants.cjs` is used so most tests run against production-like values.
if (process.env.MOCK_CONSTANTS === '1') {
  jest.mock('../server/config/constants.cjs', () => ({
    TIMEOUT_30S: 30000,
    TIMEOUT_8S: 8000,
    TIMEOUT_12S: 12000,
    TIMEOUT_1M: 60000,
    MAX_RATE_LIMIT: 1000,
    safeJsonLimit: () => '1mb'
  }));
}
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
// Disable Redis usage in admin-throttle during Jest tests to avoid background
// connection attempts and noisy logging when Redis is not available in CI.
process.env.ADMIN_THROTTLE_DISABLE_REDIS = process.env.ADMIN_THROTTLE_DISABLE_REDIS || '1';

// Mock app-logger early so background services (SIEM exporter, telemetry, etc.)
// do not attempt to write to console after Jest has torn down. This prevents
// 'Cannot log after tests are done' failures caused by background retries.
try {
  jest.mock('../server/lib/app-logger.cjs', () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), child: () => logger, write: () => {} };
    return logger;
  });
} catch (e) {}

// Track intervals created during tests so we can forcibly clear them in teardown.
// This is defensive: some modules start background schedulers on require
// which tests may not explicitly stop. We wrap only in the test environment.
const _origSetInterval = global.setInterval;
const _origClearInterval = global.clearInterval;
const __jestIntervals = new Set();
global.setInterval = function (fn, ms, ...args) {
  const id = _origSetInterval(fn, ms, ...args);
  try { __jestIntervals.add(id); } catch (e) {}
  return id;
};
global.clearInterval = function (id) {
  try { __jestIntervals.delete(id); } catch (e) {}
  return _origClearInterval(id);
};

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

// Isolate token-registry.json from test runs: point token-db.cjs at a temp file
// so tests that indirectly write session tokens (e.g. session-token-replicator.test.cjs)
// don't pollute the production database file in server/db/token-registry.json.
if (!process.env.SIMPLEBEACON_TOKEN_DB_PATH) {
  const os = require('os');
  const path = require('path');
  const fs = require('fs');
  const _testDbDir = path.join(os.tmpdir(), 'sb-jest-token-db');
  try { fs.mkdirSync(_testDbDir, { recursive: true }); } catch (e) {}
  process.env.SIMPLEBEACON_TOKEN_DB_PATH = path.join(_testDbDir, 'token-registry.json');
}

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
    // Lightweight test DB using the jest-mocked 'pg' Pool from above.
    // Returns a Pool-like object with a mocked `query` method that resolves
    // to `{ rows: [] }` by default. Tests can override `pool.query` behavior
    // via `pool.query.mockResolvedValue({ rows: [...] })` when needed.
    try {
      const { Pool } = require('pg');
      const pool = new Pool();

      // Ensure `query` exists and is a jest.fn
      if (!pool.query || typeof pool.query !== 'function') {
        pool.query = jest.fn().mockResolvedValue({ rows: [] });
      }

      // Add query logging: capture SQL and params for debugging
      const origQuery = pool.query;
      pool.__queries = [];
      pool.query = jest.fn((text, params) => {
        try {
          pool.__queries.push({ text, params });
        } catch (e) {
          // ignore logging errors
        }
        if (process.env.TEST_DB_QUERY_LOG === '1') {
          // Print to console to aid debugging in CI logs when enabled
          // eslint-disable-next-line no-console
          console.log('[TEST-DB-QUERY]', text, params);
        }
        return origQuery(text, params);
      });

      // Convenience helper to set a predictable result
      pool.__setQueryResult = (rows) => {
        pool.query.mockResolvedValue({ rows });
      };

      // Track global handle for cleanup
      global.__testDbPool = pool;
      return pool;
    } catch (e) {
      // If pg is not available for any reason, return a minimal stub
      const pool = { query: jest.fn().mockResolvedValue({ rows: [] }), end: jest.fn().mockResolvedValue(true) };
      pool.__queries = [];
      const origQueryStub = pool.query;
      pool.query = jest.fn((text, params) => {
        pool.__queries.push({ text, params });
        if (process.env.TEST_DB_QUERY_LOG === '1') {
          // eslint-disable-next-line no-console
          console.log('[TEST-DB-QUERY]', text, params);
        }
        return origQueryStub(text, params);
      });
      global.__testDbPool = pool;
      return pool;
    }
  },

  // Helper to clean up test data
  cleanupTestData: async () => {
    // Close and remove any tracked test DB pool
    if (global.__testDbPool) {
      try {
        if (typeof global.__testDbPool.end === 'function') await global.__testDbPool.end();
      } catch (e) {
        // ignore cleanup errors
      }
      try { delete global.__testDbPool; } catch (e) {}
    }

    // Reset jest mocks and spies to avoid cross-test leakage
    try { jest.clearAllMocks(); } catch (e) {}

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
}), { virtual: true });

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
}), { virtual: true });

// Export setup for use in other files
// Attempt to gracefully shutdown modules that may open background handles
// during normal operation. This is best-effort and avoids noisy logs like
// "Cannot log after tests are done" when Jest exits.
afterAll(async () => {
  const targets = [
    '../server/lib/admin-throttle.cjs',
    '../server/lib/siem-exporter.cjs',
    '../server/lib/cluster-keyring-sync.cjs'
  ];
  // Clear tracked intervals created during tests
  try {
    for (const id of Array.from(__jestIntervals)) {
      try { _origClearInterval(id); } catch (e) {}
      try { __jestIntervals.delete(id); } catch (e) {}
    }
  } catch (e) {}
  // Restore global interval functions
  try { global.setInterval = _origSetInterval; } catch (e) {}
  try { global.clearInterval = _origClearInterval; } catch (e) {}
  // Also ensure report scheduler is stopped if started by any module
  try {
    // eslint-disable-next-line global-require
    const reportScheduler = require('../server/lib/report-scheduler.cjs');
    if (reportScheduler && typeof reportScheduler.stopScheduler === 'function') {
      try { reportScheduler.stopScheduler(); } catch (e) {}
    }
  } catch (e) {
    // ignore
  }
  for (const rel of targets) {
    try {
      // eslint-disable-next-line global-require
      const mod = require(rel);
      if (mod && typeof mod.shutdown === 'function') {
        try {
          // Use a cancellable timeout so the timer is cleared when shutdown completes.
          await new Promise(async (resolve) => {
            const timer = setTimeout(() => resolve(), 5000);
            try {
              await mod.shutdown();
            } catch (e) {
              // ignore individual shutdown errors
            }
            clearTimeout(timer);
            resolve();
          });
        } catch (e) {
          // ignore individual shutdown errors
        }
      } else if (mod && typeof mod.close === 'function') {
        try {
          await new Promise(async (resolve) => {
            const timer = setTimeout(() => resolve(), 5000);
            try {
              await mod.close();
            } catch (e) {
              // ignore individual close errors
            }
            clearTimeout(timer);
            resolve();
          });
        } catch (e) {}
      }
    } catch (e) {
      // module not present or failed to load; ignore
    }
  }
});

module.exports = {
  testUtils: global.testUtils
};
