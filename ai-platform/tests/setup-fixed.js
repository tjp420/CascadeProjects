// Jest setup file for test environment configuration
'use strict';

// Setup jsdom environment
const { JSDOM } = require('jsdom');

// Create a custom DOM setup
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:57220',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// Mock fetch
global.fetch = jest.fn();

// Mock URL
global.URL = {
  createObjectURL: jest.fn(),
  revokeObjectURL: jest.fn()
};

// Mock Blob
global.Blob = jest.fn();

// Mock FileReader
global.FileReader = jest.fn();

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Setup global test utilities
global.testUtils = {
  // Helper to create mock DOM elements
  createElement: (tag, attributes = {}, content = '') => {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    if (content) {
      element.textContent = content;
    }
    return element;
  },

  // Helper to create mock event
  createEvent: (type, options = {}) => {
    const event = new Event(type, options);
    Object.entries(options).forEach(([key, value]) => {
      event[key] = value;
    });
    return event;
  },

  // Helper to wait for async operations
  waitFor: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to mock API responses
  mockApiResponse: (data, status = 200) => {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data))
    });
  }
};

// Global test cleanup
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset localStorage
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  
  // Reset sessionStorage
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
  
  // Reset fetch
  if (global.fetch.mockClear) {
    global.fetch.mockClear();
  }
  
  // Clear DOM
  document.body.textContent = '' /* Replaced innerHTML with textContent for safety */
  document.head.textContent = '' /* Replaced innerHTML with textContent for safety */
});
