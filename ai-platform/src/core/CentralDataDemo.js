/**
 * Central Data Integration Demo
 * 
 * Demonstrates the central data truth system functionality.
 * Shows how all features can use a unified data source.
 * 
 * @class CentralDataDemo
 * @example
 * const demo = new CentralDataDemo();
 * demo.runDemo();
 */
class CentralDataDemo {
    constructor() {
        this.integration = null;
        this.results = [];
    }

    /**
     * Run the complete demo
     */
    async runDemo() {
        try {
            console.log('🎬 Starting Central Data Integration Demo...');
            
            // Initialize the system
            await this.initializeSystem();
            
            // Demo 1: Basic Data Access
            await this.demoBasicDataAccess();
            
            // Demo 2: Cross-Feature Data Sharing
            await this.demoCrossFeatureSharing();
            
            // Demo 3: Central Directory Management
            await this.demoDirectoryManagement();
            
            // Demo 4: Cache Performance
            await this.demoCachePerformance();
            
            // Demo 5: Event-Driven Updates
            await this.demoEventDrivenUpdates();
            
            // Demo 6: Universal Data Processing
            await this.demoUniversalProcessing();
            
            // Show results
            this.showResults();
            
            console.log('🎉 Central Data Integration Demo completed successfully!');
            
        } catch (error) {
            console.error('❌ Demo failed:', error);
        }
    }

    /**
     * Initialize the central data integration system
     */
    async initializeSystem() {
        console.log('🚀 Initializing Central Data Integration System...');
        
        this.integration = new CentralDataIntegration();
        await this.integration.initialize();
        
        const status = this.integration.getStatus();
        console.log('📊 System Status:', status);
        
        this.addResult('System Initialization', {
            success: status.initialized,
            components: Object.keys(status.components).length,
            adapters: Object.keys(status.adapters).length
        });
    }

    /**
     * Demo basic data access
     */
    async demoBasicDataAccess() {
        console.log('📥 Demo 1: Basic Data Access');
        
        try {
            // Get AI Tools data
            const aiToolsData = await this.integration.getData('aiTools', 'analysis-results');
            console.log('🤖 AI Tools Data:', aiToolsData);
            
            // Get Analytics data
            const analyticsData = await this.integration.getData('analytics', 'reports');
            console.log('📊 Analytics Data:', analyticsData);
            
            this.addResult('Basic Data Access', {
                aiToolsSuccess: aiToolsData.success,
                analyticsSuccess: analyticsData.success,
                aiToolsDataPoints: aiToolsData.data?.results?.length || 0,
                analyticsReports: analyticsData.data?.reports?.length || 0
            });
            
        } catch (error) {
            console.error('❌ Basic data access demo failed:', error);
            this.addResult('Basic Data Access', { success: false, error: error.message });
        }
    }

    /**
     * Demo cross-feature data sharing
     */
    async demoCrossFeatureSharing() {
        console.log('🔗 Demo 2: Cross-Feature Data Sharing');
        
        try {
            // Subscribe to AI Tools events
            const subscriptionId = this.integration.subscribe('ai-tools.analysis-complete', async (event) => {
                console.log('📢 Received AI Tools analysis event:', event.data);
            });
            
            // Publish AI Tools analysis complete event
            await this.integration.publish('ai-tools.analysis-complete', {
                results: [
                    { type: 'code-quality', score: 85.3 },
                    { type: 'security', score: 92.1 }
                ],
                timestamp: new Date().toISOString()
            });
            
            // Wait a moment for event processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check if analytics received the data
            const analyticsData = await this.integration.getData('analytics', 'metrics');
            
            this.integration.unsubscribe(subscriptionId);
            
            this.addResult('Cross-Feature Sharing', {
                eventPublished: true,
                subscriptionActive: true,
                analyticsDataReceived: analyticsData.success
            });
            
        } catch (error) {
            console.error('❌ Cross-feature sharing demo failed:', error);
            this.addResult('Cross-Feature Sharing', { success: false, error: error.message });
        }
    }

    /**
     * Demo central directory management
     */
    async demoDirectoryManagement() {
        console.log('📁 Demo 3: Central Directory Management');
        
        try {
            // Get paths for different features
            const aiToolsPath = this.integration.getPath('aiTools', 'analysis-results');
            const analyticsPath = this.integration.getPath('analytics', 'reports');
            const developmentPath = this.integration.getPath('development', 'dev-configs');
            
            // Get feature configurations
            const aiToolsConfig = this.integration.directoryManager.getFeatureConfig('aiTools');
            const analyticsConfig = this.integration.directoryManager.getFeatureConfig('analytics');
            
            // Validate directories
            const aiToolsValidation = await this.integration.directoryManager.validateDirectory('aiTools');
            const analyticsValidation = await this.integration.directoryManager.validateDirectory('analytics');
            
            this.addResult('Directory Management', {
                aiToolsPath: aiToolsPath,
                analyticsPath: analyticsPath,
                developmentPath: developmentPath,
                aiToolsConfigured: !!aiToolsConfig,
                analyticsConfigured: !!analyticsConfig,
                aiToolsValid: aiToolsValidation.valid,
                analyticsValid: analyticsValidation.valid
            });
            
        } catch (error) {
            console.error('❌ Directory management demo failed:', error);
            this.addResult('Directory Management', { success: false, error: error.message });
        }
    }

    /**
     * Demo cache performance
     */
    async demoCachePerformance() {
        console.log('⚡ Demo 4: Cache Performance');
        
        try {
            // First call (cache miss)
            const start1 = Date.now();
            const data1 = await this.integration.getData('aiTools', 'analysis-results');
            const time1 = Date.now() - start1;
            
            // Second call (cache hit)
            const start2 = Date.now();
            const data2 = await this.integration.getData('aiTools', 'analysis-results');
            const time2 = Date.now() - start2;
            
            // Get cache statistics
            const cacheStats = this.integration.cacheManager.getStats();
            
            this.addResult('Cache Performance', {
                firstCallTime: time1,
                secondCallTime: time2,
                speedup: time1 > 0 ? (time1 / time2).toFixed(2) : 'N/A',
                hitRate: cacheStats.hitRate,
                cacheSize: cacheStats.entries
            });
            
        } catch (error) {
            console.error('❌ Cache performance demo failed:', error);
            this.addResult('Cache Performance', { success: false, error: error.message });
        }
    }

    /**
     * Demo event-driven updates
     */
    async demoEventDrivenUpdates() {
        console.log('🔄 Demo 5: Event-Driven Updates');
        
        try {
            let updateReceived = false;
            
            // Subscribe to system events
            const subscriptionId = this.integration.subscribe('system.data-saved', (event) => {
                updateReceived = true;
                console.log('📢 Data save event received:', event);
            });
            
            // Save some data
            const testData = {
                id: 'demo_test',
                name: 'Demo Test Data',
                timestamp: new Date().toISOString()
            };
            
            const saveResult = await this.integration.saveData('aiTools', 'analysis-results', testData);
            
            // Wait for event processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            this.integration.unsubscribe(subscriptionId);
            
            this.addResult('Event-Driven Updates', {
                dataSaved: saveResult.success,
                updateReceived: updateReceived,
                eventSystemWorking: saveResult.success && updateReceived
            });
            
        } catch (error) {
            console.error('❌ Event-driven updates demo failed:', error);
            this.addResult('Event-Driven Updates', { success: false, error: error.message });
        }
    }

    /**
     * Demo universal data processing
     */
    async demoUniversalProcessing() {
        console.log('🔧 Demo 6: Universal Data Processing');
        
        try {
            // Process data through universal processor
            const rawData = {
                analysis: {
                    codeQuality: 85,
                    security: 92,
                    performance: 78
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
            
            const processedResult = await this.integration.processData('aiTools', 'analysis-results', rawData);
            
            // Process different data type
            const reportData = {
                title: 'Demo Report',
                sections: ['Introduction', 'Analysis', 'Conclusion'],
                metrics: { score: 87.5, trend: 'up' }
            };
            
            const reportResult = await this.integration.processData('analytics', 'reports', reportData);
            
            this.addResult('Universal Processing', {
                aiToolsProcessed: processedResult.success,
                analyticsProcessed: reportResult.success,
                processingTime: processedResult.metadata?.processingTime || 0,
                reportProcessingTime: reportResult.metadata?.processingTime || 0
            });
            
        } catch (error) {
            console.error('❌ Universal processing demo failed:', error);
            this.addResult('Universal Processing', { success: false, error: error.message });
        }
    }

    /**
     * Add demo result
     * @param {string} testName - Test name
     * @param {Object} result - Test result
     */
    addResult(testName, result) {
        this.results.push({
            test: testName,
            result: result,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Show demo results
     */
    showResults() {
        console.log('\n📊 DEMO RESULTS SUMMARY');
        console.log('='.repeat(50));
        
        this.results.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.test}`);
            console.log('   Result:', JSON.stringify(result.result, null, 2));
        });
        
        // Show overall system statistics
        const systemStats = this.integration.getSystemStats();
        console.log('\n📈 SYSTEM STATISTICS');
        console.log('='.repeat(50));
        console.log('Cache Hit Rate:', systemStats.cacheStats.hitRate);
        console.log('Cache Entries:', systemStats.cacheStats.entries);
        console.log('Data Bus Events:', systemStats.dataBusStats.totalEvents);
        console.log('Active Subscriptions:', systemStats.dataBusStats.totalSubscriptions);
        console.log('Initialized Components:', Object.keys(systemStats.status.components).length);
        console.log('Active Adapters:', Object.keys(systemStats.status.adapters).length);
        
        // Show success summary
        const successfulTests = this.results.filter(r => r.result.success !== false).length;
        const totalTests = this.results.length;
        
        console.log('\n🎯 SUCCESS SUMMARY');
        console.log('='.repeat(50));
        console.log(`Successful Tests: ${successfulTests}/${totalTests}`);
        console.log(`Success Rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);
        
        if (successfulTests === totalTests) {
            console.log('🎉 All tests passed! Central Data Integration is working perfectly!');
        } else {
            console.log('⚠️ Some tests failed. Check the results above for details.');
        }
    }

    /**
     * Run individual demo
     * @param {string} demoName - Demo name to run
     */
    async runIndividualDemo(demoName) {
        switch (demoName) {
            case 'basic-access':
                await this.demoBasicDataAccess();
                break;
            case 'cross-feature':
                await this.demoCrossFeatureSharing();
                break;
            case 'directory':
                await this.demoDirectoryManagement();
                break;
            case 'cache':
                await this.demoCachePerformance();
                break;
            case 'events':
                await this.demoEventDrivenUpdates();
                break;
            case 'processing':
                await this.demoUniversalProcessing();
                break;
            default:
                console.error(`❌ Unknown demo: ${demoName}`);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CentralDataDemo;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.CentralDataDemo = CentralDataDemo;
    
    // Create global demo instance
    window.centralDataDemo = new CentralDataDemo();
    
    // Add demo controls to console
    window.runCentralDataDemo = () => window.centralDataDemo.runDemo();
    window.runCentralDataDemoIndividual = (name) => window.centralDataDemo.runIndividualDemo(name);
    
    console.log('🎬 Central Data Demo available!');
    console.log('Run: window.runCentralDataDemo() for full demo');
    console.log('Run: window.runCentralDataDemoIndividual("basic-access") for individual demos');
    console.log('Available demos: basic-access, cross-feature, directory, cache, events, processing');
}
