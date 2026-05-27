/**
 * Jest Setup Configuration
 * Global test setup and mocking
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');

// Set up DOM for all tests
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

// Make DOM available globally
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock fetch for API tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    headers: new Map([
      ['Access-Control-Allow-Origin', '*'],
      ['Access-Control-Allow-Methods', 'GET, POST, OPTIONS'],
      ['Content-Type', 'application/json']
    ])
  })
);

// Mock other browser APIs
global.performance = {
  now: jest.fn(() => Date.now()),
  getEntriesByType: jest.fn(() => []),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000
  }
};

global.performanceObserver = jest.fn();

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Mock Chart.js
global.Chart = jest.fn(() => ({
  update: jest.fn(),
  destroy: jest.fn(),
  render: jest.fn(),
  resize: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
  toBase64Image: jest.fn(() => 'data:image/png;base64,mock'),
}));

// Mock D3.js
global.d3 = {
  select: jest.fn(() => ({
    append: jest.fn(() => ({
      attr: jest.fn(() => ({
        style: jest.fn(() => ({
          text: jest.fn(),
          html: jest.fn(),
        })),
      })),
    })),
    selectAll: jest.fn(() => ({
      data: jest.fn(() => ({
        enter: jest.fn(() => ({
          append: jest.fn(() => ({
            attr: jest.fn(() => ({
              style: jest.fn(() => ({
                text: jest.fn(),
                html: jest.fn(),
              })),
            })),
          })),
        })),
      })),
    })),
    style: jest.fn(),
    attr: jest.fn(),
    text: jest.fn(),
    html: jest.fn(),
  },
};

// Mock Blob
global.Blob = jest.fn((content, options) => ({
  size: content ? content.length : 0,
  type: options ? options.type : '',
  slice: jest.fn(),
  stream: jest.fn(),
  text: jest.fn(() => Promise.resolve('')),
  arrayBuffer: jest.fn(() => Promise.resolve(new ArrayBuffer(0))),
}));

// Mock URL
global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn(),
};

// Mock File
global.File = jest.fn((content, name, options) => ({
  name,
  size: content ? content.length : 0,
  type: options ? options.type : '',
  lastModified: Date.now(),
}));

// Mock FileReader
global.FileReader = jest.fn(() => ({
  readAsText: jest.fn(),
  readAsDataURL: jest.fn(),
  readAsArrayBuffer: jest.fn(),
  result: '',
  onload: null,
  onerror: null,
}));

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
};

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
  return setTimeout(callback, 16);
});

// Mock cancelAnimationFrame
global.cancelAnimationFrame = jest.fn((id) => {
  clearTimeout(id);
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock MutationObserver
global.MutationObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => []),
}));

// Mock console methods for testing
const originalConsole = { ...console };
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  console.log.mockRestore();
  console.warn.mockRestore();
  console.error.mockRestore();
});

// Global test utilities
global.testUtils = {
  // Create mock DOM element
  createElement: (tag, attributes = {}, children = []) => {
    const element = document.createElement(tag);
    
    Object.keys(attributes).forEach(key => {
      if (key === 'style') {
        Object.assign(element.style, attributes[key]);
      } else {
        element.setAttribute(key, attributes[key]);
      }
    });
    
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    });
    
    return element;
  },
  
  // Create mock event
  createEvent: (type, properties = {}) => {
    const event = new Event(type);
    Object.assign(event, properties);
    return event;
  },
  
  // Wait for next tick
  nextTick: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  // Create mock dashboard object
  createMockDashboard: () => ({
    dataEngine: {
      setCurrentDirectory: jest.fn(),
      analyzeDirectory: jest.fn(() => Promise.resolve({})),
      getCurrentDirectory: jest.fn(() => './'),
    },
    projectFileAnalyzer: {
      analyzeDirectory: jest.fn(() => Promise.resolve({})),
      generateReport: jest.fn(() => '# Test Report'),
    },
    technicalDebtAnalyzer: {
      analyzeTechnicalDebt: jest.fn(() => Promise.resolve({})),
      generateReport: jest.fn(() => '# Technical Debt Report'),
    },
    ai: {
      analyzeCode: jest.fn(() => Promise.resolve({})),
      generateInsights: jest.fn(() => Promise.resolve([])),
    },
  }),
  
  // Mock API responses
  mockApiResponse: (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }),
  
  // Mock file data
  createMockFile: (name, content = '', type = 'text/plain') => {
    const blob = new Blob([content], { type });
    return new File([blob], name, { type });
  },
};

// Global cleanup
afterEach(() => {
  // Clear DOM
  document.body.textContent = '' /* Replaced innerHTML with textContent for safety */
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset localStorage and sessionStorage
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// Add custom matchers
expect.extend({
  toBeInTheDocument(received) {
    const pass = received && document.body.contains(received);
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be in the document`,
      pass,
    };
  },
  
  toHaveClass(received, className) {
    const pass = received && received.classList && received.classList.contains(className);
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to have class "${className}"`,
      pass,
    };
  },
  
  toHaveStyle(received, style) {
    const pass = received && received.style;
    if (!pass) {
      return {
        message: () => `expected ${received} to have style`,
        pass: false,
      };
    }
    
    const styleObj = typeof style === 'string' ? 
      style.split(';').reduce((acc, rule) => {
        const [prop, value] = rule.split(':').map(s => s.trim());
        if (prop && value) acc[prop] = value;
        return acc;
      }, {}) : style;
    
    const allMatch = Object.entries(styleObj).every(([prop, value]) => {
      return received.style[prop] === value;
    });
    
    return {
      message: () =>
        `expected ${received} ${allMatch ? 'not ' : ''}to have style ${JSON.stringify(styleObj)}`,
      pass: allMatch,
    };
  },
});

// Export for use in tests
module.exports = {
  dom,
  localStorageMock,
  sessionStorageMock,
};
