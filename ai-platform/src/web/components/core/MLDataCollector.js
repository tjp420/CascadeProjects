/**
 * ML Data Collector Component
 * Collects user interaction data and features for ML model training
 */

export class MLDataCollector {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.userId = this.getUserId();
        this.events = [];
        this.features = new Map();
        this.storageKey = 'ml_features_data';
        this.eventStorageKey = 'ml_event_data';
        this.maxEvents = 10000; // Limit events to prevent storage overflow
        this.maxFeatures = 5000;
        
        this.loadStoredData();
        this.startSessionTracking();
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get or generate user ID
     */
    getUserId() {
        let userId = localStorage.getItem('ml_user_id');
        if (!userId) {
            userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('ml_user_id', userId);
        }
        return userId;
    }

    /**
     * Load stored data from localStorage
     */
    loadStoredData() {
        try {
            const storedEvents = localStorage.getItem(this.eventStorageKey);
            if (storedEvents) {
                this.events = JSON.parse(storedEvents);
            }

            const storedFeatures = localStorage.getItem(this.storageKey);
            if (storedFeatures) {
                const featuresObj = JSON.parse(storedFeatures);
                this.features = new Map(Object.entries(featuresObj));
            }
        } catch (error) {
            console.error('Error loading stored ML data:', error);
            this.events = [];
            this.features = new Map();
        }
    }

    /**
     * Save data to localStorage
     */
    saveData() {
        try {
            // Save events
            if (this.events.length > this.maxEvents) {
                this.events = this.events.slice(-this.maxEvents);
            }
            localStorage.setItem(this.eventStorageKey, JSON.stringify(this.events));

            // Save features
            if (this.features.size > this.maxFeatures) {
                const entries = Array.from(this.features.entries());
                const toKeep = entries.slice(-this.maxFeatures);
                this.features = new Map(toKeep);
            }
            localStorage.setItem(this.storageKey, JSON.stringify(Object.fromEntries(this.features)));
        } catch (error) {
            console.error('Error saving ML data:', error);
        }
    }

    /**
     * Start session tracking
     */
    startSessionTracking() {
        this.trackEvent('session_start', {
            sessionId: this.sessionId,
            userId: this.userId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`
        });
    }

    /**
     * Track user event
     */
    trackEvent(eventType, context = {}) {
        const event = {
            id: this.generateEventId(),
            type: eventType,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            userId: this.userId,
            context: context,
            metadata: {
                url: window.location.href,
                tabId: this.getCurrentTab()
            }
        };

        this.events.push(event);
        this.saveData();

        console.log(`📊 ML Event: ${eventType}`, event);
    }

    /**
     * Generate unique event ID
     */
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get current tab from URL hash
     */
    getCurrentTab() {
        const hash = window.location.hash;
        if (hash) {
            return hash.replace('#', '');
        }
        return 'overview';
    }

    /**
     * Track tab switch
     */
    trackTabSwitch(fromTab, toTab) {
        this.trackEvent('tab_switch', {
            fromTab,
            toTab,
            timeOnTab: this.getTimeOnCurrentTab()
        });
    }

    /**
     * Track analysis request
     */
    trackAnalysisRequest(directory, analysisType) {
        this.trackEvent('analysis_request', {
            directory,
            analysisType,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Track analysis completion
     */
    trackAnalysisComplete(analysisData, duration) {
        const features = this.extractFeaturesFromAnalysis(analysisData);
        this.storeFeatures(`analysis_${Date.now()}`, features);

        this.trackEvent('analysis_complete', {
            duration,
            fileCount: analysisData.data?.total_files || 0,
            directoryCount: analysisData.data?.total_directories || 0,
            codeQuality: analysisData.analysis?.overview?.codeQuality || 0,
            testCoverage: analysisData.analysis?.overview?.testCoverage || 0
        });
    }

    /**
     * Track recommendation view
     */
    trackRecommendationView(recommendationId, recommendationType) {
        this.trackEvent('recommendation_view', {
            recommendationId,
            recommendationType,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Track recommendation action
     */
    trackRecommendationAction(recommendationId, action, context = {}) {
        this.trackEvent('recommendation_action', {
            recommendationId,
            action, // 'accepted', 'dismissed', 'snoozed'
            context
        });
    }

    /**
     * Track visualization view
     */
    trackVisualizationView(visualizationType) {
        this.trackEvent('visualization_view', {
            visualizationType,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Track export action
     */
    trackExportAction(exportType, data) {
        this.trackEvent('export_action', {
            exportType,
            dataSize: JSON.stringify(data).length,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Extract features from analysis data
     */
    extractFeaturesFromAnalysis(analysisData) {
        const data = analysisData.data || {};
        const analysis = analysisData.analysis || {};

        return {
            totalFiles: data.total_files || 0,
            totalDirectories: data.total_directories || 0,
            depth: data.depth || 0,
            fileTypes: data.file_types || {},
            codeQuality: analysis.overview?.codeQuality || 0,
            testCoverage: analysis.overview?.testCoverage || 0,
            technicalDebt: analysis.overview?.technicalDebt || 'Unknown',
            maintainability: analysis.overview?.maintainability || 'Unknown',
            healthScore: analysis.overview?.healthScore || 0,
            developmentVelocity: analysis.overview?.developmentVelocity || 'Unknown',
            insightsCount: analysis.insights?.length || 0,
            recommendationsCount: analysis.recommendations?.length || 0,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Store features for ML training
     */
    storeFeatures(featureId, features) {
        this.features.set(featureId, features);
        this.saveData();
    }

    /**
     * Get time on current tab (simplified)
     */
    getTimeOnCurrentTab() {
        // This is a simplified version
        // In production, you'd track actual time spent
        return 0;
    }

    /**
     * Export collected data for training
     */
    exportData(format = 'json') {
        const data = {
            userId: this.userId,
            sessionId: this.sessionId,
            exportTimestamp: new Date().toISOString(),
            events: this.events,
            features: Object.fromEntries(this.features),
            summary: {
                totalEvents: this.events.length,
                totalFeatures: this.features.size,
                eventTypes: this.getEventTypeDistribution(),
                dateRange: {
                    start: this.events[0]?.timestamp,
                    end: this.events[this.events.length - 1]?.timestamp
                }
            }
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(data);
        }

        return data;
    }

    /**
     * Get event type distribution
     */
    getEventTypeDistribution() {
        const distribution = {};
        this.events.forEach(event => {
            distribution[event.type] = (distribution[event.type] || 0) + 1;
        });
        return distribution;
    }

    /**
     * Convert data to CSV format
     */
    convertToCSV(data) {
        // Convert events to CSV
        const eventHeaders = ['id', 'type', 'timestamp', 'userId', 'sessionId', 'context'];
        const eventRows = data.events.map(event => {
            return eventHeaders.map(header => {
                const value = event[header];
                if (typeof value === 'object') {
                    return JSON.stringify(value);
                }
                return value;
            }).join(',');
        });

        const eventCSV = [
            eventHeaders.join(','),
            ...eventRows
        ].join('\n');

        // Convert features to CSV
        const featureHeaders = ['id', 'totalFiles', 'totalDirectories', 'codeQuality', 'testCoverage', 'timestamp'];
        const featureRows = Object.entries(data.features).map(([id, features]) => {
            return featureHeaders.map(header => {
                const value = features[header];
                if (typeof value === 'object') {
                    return JSON.stringify(value);
                }
                return value;
            }).join(',');
        });

        const featureCSV = [
            featureHeaders.join(','),
            ...featureRows
        ].join('\n');

        return `EVENTS\n${eventCSV}\n\nFEATURES\n${featureCSV}`;
    }

    /**
     * Clear all collected data
     */
    clearData() {
        this.events = [];
        this.features.clear();
        localStorage.removeItem(this.eventStorageKey);
        localStorage.removeItem(this.storageKey);
        console.log('🧹 ML data cleared');
    }

    /**
     * Get statistics about collected data
     */
    getStatistics() {
        return {
            totalEvents: this.events.length,
            totalFeatures: this.features.size,
            eventTypes: this.getEventTypeDistribution(),
            dateRange: {
                start: this.events[0]?.timestamp,
                end: this.events[this.events.length - 1]?.timestamp
            },
            storageSize: {
                events: JSON.stringify(this.events).length,
                features: JSON.stringify(Object.fromEntries(this.features)).length
            }
        };
    }
}
