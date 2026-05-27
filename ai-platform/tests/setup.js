// Test setup file
import { jest } from '@jest/globals';

jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn()
};

// Mock window for browser environment tests
global.window = {
    localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
    },
    sessionStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
    }
};

// Mock fetch
global.fetch = jest.fn();

// Setup for each test
beforeEach(() => {
    jest.clearAllMocks();
});
