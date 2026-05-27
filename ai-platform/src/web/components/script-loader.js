/**
 * Script Loader - Dynamic component loading with dependency management
 * Implements parameter object pattern and reduces coupling
 */

class ScriptLoader {
    constructor() {
        this.loadedScripts = new Set();
        this.loadingPromises = new Map();
        this.scriptRegistry = new Map();
        this.defaultConfig = {
            timeout: 10000,
            retryAttempts: 3,
            cache: true
        };
    }

    /**
     * Register script with metadata
     */
    registerScript(name, config) {
        this.scriptRegistry.set(name, {
            url: config.url,
            dependencies: config.dependencies || [],
            version: config.version || '1.0.0',
            timeout: config.timeout || this.defaultConfig.timeout,
            retryAttempts: config.retryAttempts || this.defaultConfig.retryAttempts,
            globalName: config.globalName,
            onLoad: config.onLoad,
            onError: config.onError
        });
    }

    /**
     * Load script with dependencies
     */
    async loadScript(name, options = {}) {
        const config = { ...this.defaultConfig, ...options };
        
        if (this.loadedScripts.has(name)) {
            return this.getScriptGlobal(name);
        }

        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }

        const scriptInfo = this.scriptRegistry.get(name);
        if (!scriptInfo) {
            throw new Error(`Script '${name}' not found in registry`);
        }

        const promise = this.loadScriptWithDependencies(name, scriptInfo, config);
        this.loadingPromises.set(name, promise);
        
        try {
            const result = await promise;
            this.loadedScripts.add(name);
            return result;
        } finally {
            this.loadingPromises.delete(name);
        }
    }

    /**
     * Load script and its dependencies
     */
    async loadScriptWithDependencies(name, scriptInfo, config) {
        try {
            // Load dependencies first
            await this.loadDependencies(scriptInfo.dependencies, config);
            
            // Load the script itself
            return await this.loadSingleScript(name, scriptInfo, config);
            
        } catch (error) {
            console.error(`Failed to load script '${name}':`, error);
            throw error;
        }
    }

    /**
     * Load dependencies recursively
     */
    async loadDependencies(dependencies, config) {
        for (const depName of dependencies) {
            await this.loadScript(depName, config);
        }
    }

    /**
     * Load single script file
     */
    async loadSingleScript(name, scriptInfo, config) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptInfo.url;
            script.async = true;
            
            // Set timeout
            const timeoutId = setTimeout(() => {
                reject(new Error(`Script '${name}' loading timeout`));
            }, scriptInfo.timeout);

            // Handle successful load
            script.onload = () => {
                clearTimeout(timeoutId);
                
                try {
                    const globalObject = this.getScriptGlobal(name);
                    
                    // Call onLoad callback if provided
                    if (scriptInfo.onLoad) {
                        scriptInfo.onLoad(globalObject);
                    }
                    
                    resolve(globalObject);
                } catch (error) {
                    reject(error);
                }
            };

            // Handle loading error
            script.onerror = () => {
                clearTimeout(timeoutId);
                
                const error = new Error(`Failed to load script '${name}'`);
                
                // Call onError callback if provided
                if (scriptInfo.onError) {
                    scriptInfo.onError(error);
                }
                
                reject(error);
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Get script's global object
     */
    getScriptGlobal(name) {
        const scriptInfo = this.scriptRegistry.get(name);
        if (!scriptInfo || !scriptInfo.globalName) {
            return null;
        }

        const globalPath = scriptInfo.globalName.split('.');
        let globalObject = window;

        for (const part of globalPath) {
            globalObject = globalObject[part];
            if (!globalObject) {
                return null;
            }
        }

        return globalObject;
    }

    /**
     * Load multiple scripts
     */
    async loadScripts(names, options = {}) {
        const results = {};
        
        for (const name of names) {
            try {
                results[name] = await this.loadScript(name, options);
            } catch (error) {
                results[name] = { error: error.message };
            }
        }
        
        return results;
    }

    /**
     * Unload script
     */
    unloadScript(name) {
        const scriptInfo = this.scriptRegistry.get(name);
        if (!scriptInfo) {
            return false;
        }

        // Remove from loaded set
        this.loadedScripts.delete(name);

        // Remove script element
        const scripts = document.querySelectorAll(`script[src="${scriptInfo.url}"]`);
        scripts.forEach(script => script.remove());

        // Clean up global object if specified
        if (scriptInfo.globalName) {
            this.cleanupGlobalObject(scriptInfo.globalName);
        }

        return true;
    }

    /**
     * Clean up global object
     */
    cleanupGlobalObject(globalPath) {
        const path = globalPath.split('.');
        let current = window;

        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
            if (!current) {
                return;
            }
        }

        delete current[path[path.length - 1]];
    }

    /**
     * Check if script is loaded
     */
    isScriptLoaded(name) {
        return this.loadedScripts.has(name);
    }

    /**
     * Get loading status
     */
    getLoadingStatus(name) {
        if (this.loadedScripts.has(name)) {
            return 'loaded';
        }
        
        if (this.loadingPromises.has(name)) {
            return 'loading';
        }
        
        return 'not-loaded';
    }

    /**
     * Register default scripts
     */
    registerDefaultScripts() {
        // File management components
        this.registerScript('FileManager', {
            url: './dashboard_components/file-manager.js',
            globalName: 'FileManager',
            dependencies: []
        });

        this.registerScript('FileRenderer', {
            url: './dashboard_components/file-renderer.js',
            globalName: 'FileRenderer',
            dependencies: []
        });

        this.registerScript('FileEventHandler', {
            url: './dashboard_components/file-event-handler.js',
            globalName: 'FileEventHandler',
            dependencies: ['FileManager', 'FileRenderer']
        });

        this.registerScript('FileBrowserRefactored', {
            url: './dashboard_components/file-browser-refactored.js',
            globalName: 'FileBrowser',
            dependencies: ['FileManager', 'FileRenderer', 'FileEventHandler']
        });

        // Authentication components
        this.registerScript('AuthManager', {
            url: './auth/auth_manager.js',
            globalName: 'AuthManager',
            dependencies: []
        });

        // Integration components
        this.registerScript('GitHubIntegration', {
            url: './integrations/github_integration.js',
            globalName: 'GitHubIntegration',
            dependencies: []
        });

        // Storage components
        this.registerScript('DataManager', {
            url: './storage/data_manager.js',
            globalName: 'DataManager',
            dependencies: []
        });
    }

    /**
     * Initialize with default scripts
     */
    async init() {
        this.registerDefaultScripts();
        console.log('ScriptLoader initialized with default scripts');
    }

    /**
     * Destroy and clean up
     */
    destroy() {
        // Clear all loaded scripts
        this.loadedScripts.clear();
        this.loadingPromises.clear();
        this.scriptRegistry.clear();
        
        console.log('ScriptLoader destroyed');
    }
}

// Parameter object pattern implementation
class ParameterObject {
    /**
     * Create parameter object with validation
     */
    static create(params, schema = {}) {
        const result = {};
        
        // Validate and set parameters
        for (const [key, config] of Object.entries(schema)) {
            const value = params[key];
            
            if (config.required && (value === undefined || value === null)) {
                throw new Error(`Required parameter '${key}' is missing`);
            }
            
            if (value !== undefined) {
                result[key] = this.validateParameter(value, config);
            } else if (config.default !== undefined) {
                result[key] = config.default;
            }
        }
        
        return result;
    }

    /**
     * Validate individual parameter
     */
    static validateParameter(value, config) {
        // Type validation
        if (config.type && typeof value !== config.type) {
            throw new Error(`Parameter '${config.name || 'unknown'}' must be of type ${config.type}`);
        }
        
        // Custom validation
        if (config.validator && !config.validator(value)) {
            throw new Error(`Parameter '${config.name || 'unknown'}' failed validation`);
        }
        
        // Transform value if transformer provided
        if (config.transformer) {
            return config.transformer(value);
        }
        
        return value;
    }

    /**
     * Common parameter schemas
     */
    static getCommonSchemas() {
        return {
            fileManager: {
                config: { type: 'object', required: false },
                errorHandler: { type: 'function', required: false }
            },
            fileRenderer: {
                containerId: { type: 'string', required: false, default: 'file-tree' }
            },
            eventHandler: {
                fileManager: { type: 'object', required: false },
                fileRenderer: { type: 'object', required: false }
            },
            fileBrowser: {
                fileManager: { type: 'object', required: false },
                fileRenderer: { type: 'object', required: false },
                eventHandler: { type: 'object', required: false },
                config: { type: 'object', required: false }
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScriptLoader, ParameterObject };
}

// Global assignment for browser compatibility
window.ScriptLoader = window.ScriptLoader || ScriptLoader;
window.ParameterObject = window.ParameterObject || ParameterObject;
