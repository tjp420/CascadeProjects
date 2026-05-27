/**
 * Enhanced Test Utilities
 * 
 * Comprehensive testing utilities for improved test coverage and quality
 */

// Mock data generators
export const mockDataGenerators = {
    generateProjectData: (overrides = {}) => ({
        total_files: 150,
        total_directories: 25,
        lines_of_code: 15678,
        code_quality: 82,
        test_coverage: 65,
        security_score: 85,
        performance_score: 75,
        languages: ['JavaScript', 'Python', 'HTML', 'CSS'],
        frameworks: ['Node.js', 'Express'],
        ...overrides
    }),

    generateAnalysisData: (overrides = {}) => ({
        overview: {
            totalFiles: 150,
            totalDirectories: 25,
            totalLines: 15678
        },
        codeQuality: {
            overallScore: 82,
            maintainabilityIndex: 75,
            complexityScore: 25
        },
        security: {
            overallScore: 85,
            vulnerabilities: []
        },
        performance: {
            overallScore: 75,
            loadTime: 1200
        },
        testing: {
            overallScore: 65,
            codeCoverage: 65,
            testCount: 150
        },
        ...overrides
    }),

    generateMetrics: (overrides = {}) => ({
        timestamp: new Date().toISOString(),
        codeQuality: 82,
        testCoverage: 65,
        securityScore: 85,
        performanceScore: 75,
        technicalDebt: 30,
        ...overrides
    }),

    generateRecommendations: (count = 5) => {
        const categories = ['code-quality', 'security', 'performance', 'testing', 'documentation'];
        const priorities = ['high', 'medium', 'low'];
        const recommendations = [];

        for (let i = 0; i < count; i++) {
            recommendations.push({
                category: categories[i % categories.length],
                priority: priorities[i % priorities.length],
                title: `Recommendation ${i + 1}`,
                description: `This is recommendation ${i + 1}`,
                actions: [`Action ${i + 1}.1`, `Action ${i + 1}.2`],
                estimatedEffort: '1-2 weeks',
                impact: 'high'
            });
        }

        return recommendations;
    }
};

// Test helpers
export const testHelpers = {
    waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    waitForCondition: async (condition, timeout = 5000, interval = 100) => {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (await condition()) {
                return true;
            }
            await testHelpers.waitFor(interval);
        }
        
        throw new Error(`Condition not met within ${timeout}ms`);
    },

    mockFetch: (data, options = {}) => {
        const mockResponse = {
            ok: true,
            status: 200,
            json: async () => data,
            ...options
        };
        
        global.fetch = jest.fn(() => Promise.resolve(mockResponse));
        return mockResponse;
    },

    mockFetchError: (error = 'Network error') => {
        global.fetch = jest.fn(() => Promise.reject(new Error(error)));
    },

    createMockElement: (tagName = 'div', attributes = {}) => {
        const element = document.createElement(tagName);
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        return element;
    },

    createMockEvent: (type, properties = {}) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.assign(event, properties);
        return event;
    },

    spyOnMethod: (object, method, implementation) => {
        const spy = jest.spyOn(object, method);
        if (implementation) {
            spy.mockImplementation(implementation);
        }
        return spy;
    },

    restoreAllSpies: () => {
        jest.restoreAllMocks();
    }
};

// Assertion helpers
export const assertionHelpers = {
    assertInstanceOf: (value, constructor, message) => {
        expect(value).toBeInstanceOf(constructor);
    },

    assertDeepEqual: (actual, expected, message) => {
        expect(actual).toEqual(expected);
    },

    assertThrows: async (fn, errorType, message) => {
        await expect(fn).rejects.toThrow(errorType);
    },

    assertLength: (array, expectedLength, message) => {
        expect(array).toHaveLength(expectedLength);
    },

    assertProperty: (object, property, message) => {
        expect(object).toHaveProperty(property);
    },

    assertInRange: (value, min, max, message) => {
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThanOrEqual(max);
    },

    assertOneOf: (value, options, message) => {
        expect(options).toContain(value);
    }
};

// Mock implementations
export const mockImplementations = {
    mockLocalStorage: () => {
        const store = {};
        
        return {
            getItem: (key) => store[key] || null,
            setItem: (key, value) => {
 store[key] = String(value); 
},
            removeItem: (key) => {
 delete store[key]; 
},
            clear: () => {
 Object.keys(store).forEach(key => delete store[key]); 
},
            get length() {
 return Object.keys(store).length; 
},
            key: (index) => Object.keys(store)[index] || null
        };
    },

    mockSessionStorage: () => mockImplementations.mockLocalStorage(),

    mockIntersectionObserver: () => {
        const mockIntersectionObserver = jest.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            unobserve: () => null,
            disconnect: () => null
        });
        global.IntersectionObserver = mockIntersectionObserver;
        return mockIntersectionObserver;
    },

    mockResizeObserver: () => {
        const mockResizeObserver = jest.fn();
        mockResizeObserver.mockReturnValue({
            observe: () => null,
            unobserve: () => null,
            disconnect: () => null
        });
        global.ResizeObserver = mockResizeObserver;
        return mockResizeObserver;
    },

    mockMutationObserver: () => {
        const mockMutationObserver = jest.fn();
        mockMutationObserver.mockReturnValue({
            observe: () => null,
            disconnect: () => null,
            takeRecords: () => []
        });
        global.MutationObserver = mockMutationObserver;
        return mockMutationObserver;
    },

    mockRequestAnimationFrame: () => {
        global.requestAnimationFrame = (callback) => setTimeout(callback, 16);
        global.cancelAnimationFrame = (id) => clearTimeout(id);
    },

    mockCancelAnimationFrame: () => {
        global.cancelAnimationFrame = jest.fn();
    }
};

// Test setup and teardown
export const testSetup = {
    setupDOM: () => {
        document.body.textContent = '' /* Replaced innerHTML with textContent for safety */
        const div = document.createElement('div');
        div.id = 'test-root';
        document.body.appendChild(div);
        return div;
    },

    teardownDOM: () => {
        document.body.textContent = '' /* Replaced innerHTML with textContent for safety */
    },

    setupGlobalMocks: () => {
        global.localStorage = mockImplementations.mockLocalStorage();
        global.sessionStorage = mockImplementations.mockSessionStorage();
        mockImplementations.mockIntersectionObserver();
        mockImplementations.mockResizeObserver();
        mockImplementations.mockMutationObserver();
        mockImplementations.mockRequestAnimationFrame();
    },

    teardownGlobalMocks: () => {
        testHelpers.restoreAllSpies();
        delete global.localStorage;
        delete global.sessionStorage;
        delete global.IntersectionObserver;
        delete global.ResizeObserver;
        delete global.MutationObserver;
        delete global.requestAnimationFrame;
        delete global.cancelAnimationFrame;
    }
};

// Coverage helpers
export const coverageHelpers = {
    trackCoverage: (component, functionName) => {
        const originalFunction = component[functionName];
        let callCount = 0;

        component[functionName] = function(...args) {
            callCount++;
            return originalFunction.apply(this, args);
        };

        return {
            getCallCount: () => callCount,
            reset: () => {
 callCount = 0; 
}
        };
    },

    assertFunctionCalled: (spy, times = 1) => {
        expect(spy).toHaveBeenCalledTimes(times);
    },

    assertFunctionNotCalled: (spy) => {
        expect(spy).not.toHaveBeenCalled();
    },

    assertFunctionCalledWith: (spy, ...args) => {
        expect(spy).toHaveBeenCalledWith(...args);
    }
};

// Performance test helpers
export const performanceTestHelpers = {
    measureExecutionTime: async (fn) => {
        const start = performance.now();
        await fn();
        const end = performance.now();
        return end - start;
    },

    assertPerformance: async (fn, maxTime) => {
        const executionTime = await performanceTestHelpers.measureExecutionTime(fn);
        expect(executionTime).toBeLessThan(maxTime);
    },

    measureMemoryUsage: () => {
        if (global.performance && global.performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
};

// Integration test helpers
export const integrationTestHelpers = {
    setupIntegrationTest: async () => {
        testSetup.setupGlobalMocks();
        testSetup.setupDOM();
        
        // Wait for DOM to be ready
        await testHelpers.waitFor(100);
    },

    teardownIntegrationTest: () => {
        testSetup.teardownDOM();
        testSetup.teardownGlobalMocks();
    },

    waitForElement: async (selector, timeout = 5000) => {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
            await testHelpers.waitFor(50);
        }
        
        throw new Error(`Element ${selector} not found within ${timeout}ms`);
    },

    waitForElementToDisappear: async (selector, timeout = 5000) => {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (!element) {
                return true;
            }
            await testHelpers.waitFor(50);
        }
        
        throw new Error(`Element ${selector} still present after ${timeout}ms`);
    }
};

// Test data builders
export class TestDataBuilder {
    constructor() {
        this.data = {};
    }

    withProjectData(overrides = {}) {
        this.data.project = mockDataGenerators.generateProjectData(overrides);
        return this;
    }

    withAnalysisData(overrides = {}) {
        this.data.analysis = mockDataGenerators.generateAnalysisData(overrides);
        return this;
    }

    withRecommendations(count = 5) {
        this.data.recommendations = mockDataGenerators.generateRecommendations(count);
        return this;
    }

    withCustomData(key, value) {
        this.data[key] = value;
        return this;
    }

    build() {
        return { ...this.data };
    }
}

// Export all utilities
export default {
    mockDataGenerators,
    testHelpers,
    assertionHelpers,
    mockImplementations,
    testSetup,
    coverageHelpers,
    performanceTestHelpers,
    integrationTestHelpers,
    TestDataBuilder
};