/**
 * Mock Factory Utility
 * Provides standardized mock creation and management patterns
 */

/**
 * Mock Factory for common testing scenarios
 */
export class MockFactory {
    /**
     * Create a standardized mock function
     * @param {string} name - Mock function name
     * @param {*} returnValue - Default return value
     * @param {Object} options - Mock options
     * @returns {Object} Mock function with tracking
     */
    static createMockFunction(name = 'mockFunction', returnValue = null, options = {}) {
        const mockFn = {
            name,
            calls: [],
            returnValue,
            implementation: options.implementation || null,
            
            // Mock function implementation
            mock: (...args) => {
                mockFn.calls.push({
                    args,
                    timestamp: new Date().toISOString(),
                    result: mockFn.implementation ? mockFn.implementation(...args) : returnValue
                });
                return mockFn.implementation ? mockFn.implementation(...args) : returnValue;
            },
            
            // Helper methods
            reset: () => {
                mockFn.calls = [];
            },
            
            getCallCount: () => mockFn.calls.length,
            
            getLastCall: () => mockFn.calls[mockFn.calls.length - 1] || null,
            
            wasCalled: () => mockFn.calls.length > 0,
            
            wasCalledWith: (...expectedArgs) => {
                return mockFn.calls.some(call => 
                    JSON.stringify(call.args) === JSON.stringify(expectedArgs)
                );
            }
        };
        
        return mockFn.mock;
    }
    
    /**
     * Create a mock HTTP client
     * @param {Object} responses - predefined responses
     * @returns {Object} Mock HTTP client
     */
    static createMockHttpClient(responses = {}) {
        const client = {
            requests: [],
            responses: responses,
            
            get: async (url, options = {}) => {
                client.requests.push({ method: 'GET', url, options });
                return client.responses[url] || { data: null, status: 404 };
            },
            
            post: async (url, data, options = {}) => {
                client.requests.push({ method: 'POST', url, data, options });
                return client.responses[url] || { data: null, status: 404 };
            },
            
            put: async (url, data, options = {}) => {
                client.requests.push({ method: 'PUT', url, data, options });
                return client.responses[url] || { data: null, status: 404 };
            },
            
            delete: async (url, options = {}) => {
                client.requests.push({ method: 'DELETE', url, options });
                return client.responses[url] || { data: null, status: 404 };
            },
            
            reset: () => {
                client.requests = [];
            },
            
            getRequestCount: () => client.requests.length,
            
            getLastRequest: () => client.requests[client.requests.length - 1] || null,
            
            wasCalled: (method, url) => {
                return client.requests.some(req => req.method === method && req === url);
            }
        };
        
        return client;
    }
    
    /**
     * Create a mock database connection
     * @param {Object} data - Initial data
     * @returns {Object} Mock database
     */
    static createMockDatabase(data = {}) {
        const db = {
            data: { ...data },
            operations: [],
            
            find: async (collection, query) => {
                db.operations.push({ type: 'find', collection, query });
                const items = db.data[collection] || [];
                return items.filter(item => 
                    Object.keys(query).every(key => item[key] === query[key])
                );
            },
            
            insert: async (collection, document) => {
                db.operations.push({ type: 'insert', collection, document });
                if (!db.data[collection]) {
                    db.data[collection] = [];
                }
                const docWithId = { ...document, id: Date.now().toString() };
                db.data[collection].push(docWithId);
                return docWithId;
            },
            
            update: async (collection, query, update) => {
                db.operations.push({ type: 'update', collection, query, update });
                const items = db.data[collection] || [];
                const index = items.findIndex(item => 
                    Object.keys(query).every(key => item[key] === query[key])
                );
                if (index !== -1) {
                    items[index] = { ...items[index], ...update };
                    return items[index];
                }
                return null;
            },
            
            delete: async (collection, query) => {
                db.operations.push({ type: 'delete', collection, query });
                const items = db.data[collection] || [];
                const index = items.findIndex(item => 
                    Object.keys(query).every(key => item[key] === query[key])
                );
                if (index !== -1) {
                    const deleted = items.splice(index, 1)[0];
                    return deleted;
                }
                return null;
            },
            
            reset: () => {
                db.operations = [];
                db.data = {};
            },
            
            getOperationCount: () => db.operations.length,
            
            getLastOperation: () => db.operations[db.operations.length - 1] || null
        };
        
        return db;
    }
    
    /**
     * Create a mock event emitter
     * @returns {Object} Mock event emitter
     */
    static createMockEventEmitter() {
        const emitter = {
            listeners: {},
            events: [],
            
            on: (event, listener) => {
                if (!emitter.listeners[event]) {
                    emitter.listeners[event] = [];
                }
                emitter.listeners[event].push(listener);
            },
            
            emit: (event, ...args) => {
                emitter.events.push({ event, args, timestamp: new Date().toISOString() });
                if (emitter.listeners[event]) {
                    emitter.listeners[event].forEach(listener => listener(...args));
                }
            },
            
            off: (event, listener) => {
                if (emitter.listeners[event]) {
                    emitter.listeners[event] = emitter.listeners[event].filter(l => l !== listener);
                }
            },
            
            reset: () => {
                emitter.listeners = {};
                emitter.events = [];
            },
            
            getEventCount: () => emitter.events.length,
            
            getLastEvent: () => emitter.events[emitter.events.length - 1] || null,
            
            wasEventEmitted: (event) => {
                return emitter.events.some(e => e.event === event);
            }
        };
        
        return emitter;
    }
    
    /**
     * Create a mock file system
     * @param {Object} files - Initial file structure
     * @returns {Object} Mock file system
     */
    static createMockFileSystem(files = {}) {
        const fs = {
            files: { ...files },
            operations: [],
            
            readFile: async (path, encoding = 'utf8') => {
                fs.operations.push({ type: 'readFile', path, encoding });
                return fs.files[path] || null;
            },
            
            writeFile: async (path, content, encoding = 'utf8') => {
                fs.operations.push({ type: 'writeFile', path, content, encoding });
                fs.files[path] = content;
                return true;
            },
            
            exists: async (path) => {
                fs.operations.push({ type: 'exists', path });
                return fs.files.hasOwnProperty(path);
            },
            
            deleteFile: async (path) => {
                fs.operations.push({ type: 'deleteFile', path });
                delete fs.files[path];
                return true;
            },
            
            reset: () => {
                fs.operations = [];
                fs.files = {};
            },
            
            getOperationCount: () => fs.operations.length,
            
            getLastOperation: () => fs.operations[fs.operations.length - 1] || null
        };
        
        return fs;
    }
}

/**
 * Mock cleanup utility
 */
export class MockCleanup {
    constructor() {
        this.mocks = [];
    }
    
    /**
     * Register a mock for cleanup
     * @param {Object} mock - Mock object to cleanup
     */
    register(mock) {
        this.mocks.push(mock);
    }
    
    /**
     * Cleanup all registered mocks
     */
    cleanup() {
        this.mocks.forEach(mock => {
            if (mock.reset) {
                mock.reset();
            }
            if (mock.restore) {
                mock.restore();
            }
            if (mock.clearAllMocks) {
                mock.clearAllMocks();
            }
        });
        this.mocks = [];
    }
    
    /**
     * Get cleanup statistics
     */
    getStats() {
        return {
            registeredMocks: this.mocks.length,
            cleanupMethods: this.mocks.filter(m => m.reset || m.restore || m.clearAllMocks).length
        };
    }
}

export default {
    MockFactory,
    MockCleanup
};
