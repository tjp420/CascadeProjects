/**
 * Optimized DataEngine - Performance Enhanced Version
 * Implements parallel API calls, memoization, and better caching
 */

class OptimizedDataEngine {
    constructor() {
        this.cache = new Map();
        this.subscribers = new Map();
        this.data = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.currentDirectory = './';
        this.requestCache = new Map(); // For memoization
        this.pendingRequests = new Map(); // Prevent duplicate requests
    }

    setDirectory(directory) {
        if (this.currentDirectory !== directory) {
            this.currentDirectory = directory;
            this.cache.clear();
            this.requestCache.clear();
        }
    }

    // Memoized API request function
    async memoizedFetch(url, cacheKey = null) {
        const key = cacheKey || url;
        
        // Check if we have a cached response
        if (this.requestCache.has(key)) {
            const cached = this.requestCache.get(key);
            if (Date.now() - cached.timestamp < 30000) { // 30 seconds cache
                console.log(`📋 Using memoized response for: ${key}`);
                return cached.data;
            }
        }

        // Check if request is already pending
        if (this.pendingRequests.has(key)) {
            console.log(`⏳ Waiting for pending request: ${key}`);
            return await this.pendingRequests.get(key);
        }

        // Make the request
        const requestPromise = this.makeRequest(url);
        this.pendingRequests.set(key, requestPromise);

        try {
            const data = await requestPromise;
            
            // Cache the response
            this.requestCache.set(key, {
                data,
                timestamp: Date.now()
            });
            
            return data;
        } finally {
            this.pendingRequests.delete(key);
        }
    }

    async makeRequest(url) {
        const startTime = performance.now();
        console.log(`🚀 Fetching: ${url}`);
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            const endTime = performance.now();
            console.log(`✅ Request completed in ${(endTime - startTime).toFixed(2)}ms: ${url}`);
            
            return data;
        } catch (error) {
            const endTime = performance.now();
            console.error(`❌ Request failed after ${(endTime - startTime).toFixed(2)}ms: ${url}`, error);
            throw error;
        }
    }

    // Parallel API data fetching
    async loadOptimizedData() {
        const cacheKey = `dashboard_data_${this.currentDirectory}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📋 Using cached data');
                this.data = cached.data;
                this.notifySubscribers('data_loaded', this.data);
                return this.data;
            }
        }

        console.log('🔄 Loading optimized data with parallel API calls...');
        
        try {
            // Make parallel API calls
            const [projectData, coverageData] = await Promise.allSettled([
                this.memoizedFetch(`http://localhost:8081/api/project/overview?directory=${encodeURIComponent(this.currentDirectory)}`),
                this.memoizedFetch('http://localhost:8081/api/test-coverage')
            ]);

            let finalData = null;

            // Process project data
            if (projectData.status === 'fulfilled') {
                finalData = this.transformApiData(projectData.value);
                console.log('✅ Project data loaded successfully');
            } else {
                console.error('❌ Project data failed');
                throw new Error('Failed to load project data - no fallback available');
            }

            // Add coverage data if available
            if (coverageData.status === 'fulfilled') {
                finalData.testCoverage = coverageData.value;
                console.log('✅ Coverage data loaded successfully');
            }

            // Cache the results
            this.data = finalData;
            this.cache.set(cacheKey, {
                data: finalData,
                timestamp: Date.now()
            });

            this.notifySubscribers('data_loaded', this.data);
            console.log('🎉 Optimized data loading completed');
            
            return this.data;

        } catch (error) {
            console.error('❌ Optimized data loading failed:', error);
            throw new Error(`Optimized data loading failed: ${error.message}`);
        }
    }

    transformApiData(apiData) {
        return {
            total_files: apiData.totalFiles || 0,
            total_directories: apiData.totalDirectories || 0,
            project_depth: apiData.projectDepth || 0,
            lines_of_code: apiData.linesOfCode || 0,
            code_quality: apiData.codeQuality || 75,
            test_coverage: apiData.testCoverage || 0,
            technical_debt: apiData.technicalDebt || 'Medium',
            maintainability: apiData.maintainability || 'Good',
            health_score: apiData.healthScore || 75,
            development_velocity: apiData.developmentVelocity || 'Medium',
            team_productivity: apiData.teamProductivity || 75,
            project_complexity: apiData.projectComplexity || 'Medium',
            languages: apiData.languages || [],
            frameworks: apiData.frameworks || [],
            source: 'api_optimized',
            timestamp: new Date().toISOString()
        };
    }

    // Optimized subscription management
    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        this.subscribers.get(event).add(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(event);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    notifySubscribers(event, data) {
        const callbacks = this.subscribers.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in subscriber callback for ${event}:`, error);
                }
            });
        }
    }

    clearCache() {
        this.cache.clear();
        this.requestCache.clear();
        console.log('🧹 All caches cleared');
    }

    // Performance monitoring
    getCacheStats() {
        return {
            dataCacheSize: this.cache.size,
            requestCacheSize: this.requestCache.size,
            pendingRequests: this.pendingRequests.size,
            cacheHitRatio: this.calculateCacheHitRatio()
        };
    }

    calculateCacheHitRatio() {
        // This would be calculated based on actual usage
        return 0.75; // Placeholder
    }
}

// Export for use in dashboard
if (typeof window !== 'undefined') {
    window.OptimizedDataEngine = OptimizedDataEngine;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizedDataEngine;
}
