/**
 * Data Bus - Cross-Feature Communication System
 * 
 * Provides event-driven data sharing between all AI platform features.
 * Enables real-time synchronization and cross-feature data flow.
 * 
 * @class DataBus
 * @example
 * const dataBus = new DataBus();
 * dataBus.subscribe('ai-tools.analysis-complete', callback);
 * dataBus.publish('ai-tools.analysis-complete', data);
 */
class DataBus {
    constructor() {
        this.events = new Map();
        this.subscribers = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 1000;
        this.initialized = false;
        
        this.initialize();
    }

    /**
     * Initialize the data bus
     */
    initialize() {
        try {
            // Setup core event types
            this.setupCoreEvents();
            
            this.initialized = true;
            console.log('✅ Data Bus initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Data Bus:', error);
            throw error;
        }
    }

    /**
     * Setup core event types
     */
    setupCoreEvents() {
        const coreEvents = [
            // AI Tools events
            'ai-tools.analysis-complete',
            'ai-tools.code-generated',
            'ai-tools.mock-data-created',
            
            // Analytics events
            'analytics.report-generated',
            'analytics.metrics-updated',
            'analytics.performance-measured',
            
            // Development events
            'development.config-changed',
            'development.schema-updated',
            'development.api-updated',
            
            // Roadmap events
            'roadmap.milestone-added',
            'roadmap.timeline-updated',
            'roadmap.backlog-changed',
            
            // Technical Debt events
            'technical-debt.calculated',
            'technical-debt.plan-created',
            'technical-debt.analytics-updated',
            
            // Project Resources events
            'project-resources.asset-added',
            'project-resources.template-created',
            'project-resources.coverage-updated',
            
            // System events
            'system.data-saved',
            'system.cache-cleared',
            'system.config-updated',
            'system.error-occurred'
        ];

        coreEvents.forEach(eventType => {
            this.events.set(eventType, {
                type: eventType,
                subscribers: new Set(),
                publishCount: 0,
                lastPublished: null
            });
        });
    }

    /**
     * Subscribe to an event
     * @param {string} eventType - Event type to subscribe to
     * @param {Function} callback - Callback function
     * @param {Object} options - Subscription options
     * @returns {string} Subscription ID
     */
    subscribe(eventType, callback, options = {}) {
        if (!this.events.has(eventType)) {
            this.events.set(eventType, {
                type: eventType,
                subscribers: new Set(),
                publishCount: 0,
                lastPublished: null
            });
        }

        const subscriptionId = this.generateSubscriptionId();
        const subscription = {
            id: subscriptionId,
            callback,
            options,
            createdAt: new Date().toISOString(),
            callCount: 0
        };

        this.subscribers.set(subscriptionId, subscription);
        this.events.get(eventType).subscribers.add(subscriptionId);

        console.log(`👁️ Subscribed to ${eventType} (ID: ${subscriptionId})`);
        return subscriptionId;
    }

    /**
     * Unsubscribe from an event
     * @param {string} subscriptionId - Subscription ID
     */
    unsubscribe(subscriptionId) {
        const subscription = this.subscribers.get(subscriptionId);
        if (!subscription) {
            console.warn(`⚠️ Subscription not found: ${subscriptionId}`);
            return;
        }

        // Find and remove from event subscribers
        for (const [eventType, event] of this.events.entries()) {
            if (event.subscribers.has(subscriptionId)) {
                event.subscribers.delete(subscriptionId);
                break;
            }
        }

        this.subscribers.delete(subscriptionId);
        console.log(`👋 Unsubscribed (ID: ${subscriptionId})`);
    }

    /**
     * Publish an event
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     * @param {Object} options - Publish options
     * @returns {Promise<Object>} Publish result
     */
    async publish(eventType, data, options = {}) {
        try {
            const startTime = Date.now();
            
            if (!this.events.has(eventType)) {
                this.events.set(eventType, {
                    type: eventType,
                    subscribers: new Set(),
                    publishCount: 0,
                    lastPublished: null
                });
            }

            const event = this.events.get(eventType);
            const eventData = {
                id: this.generateEventId(),
                type: eventType,
                data: data,
                timestamp: new Date().toISOString(),
                options: options,
                processingTime: 0
            };

            // Add to history
            this.addToHistory(eventData);

            // Notify subscribers
            const subscriberIds = Array.from(event.subscribers);
            const results = [];

            for (const subscriptionId of subscriberIds) {
                const subscription = this.subscribers.get(subscriptionId);
                if (!subscription) continue;

                try {
                    const result = await this.notifySubscriber(subscription, eventData);
                    results.push({
                        subscriptionId,
                        success: true,
                        result
                    });
                    
                    // Update call count
                    subscription.callCount++;
                } catch (error) {
                    console.error(`❌ Error notifying subscriber ${subscriptionId}:`, error);
                    results.push({
                        subscriptionId,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Update event metadata
            event.publishCount++;
            event.lastPublished = eventData.timestamp;
            eventData.processingTime = Date.now() - startTime;

            console.log(`📢 Published ${eventType} to ${subscriberIds.length} subscribers (${Date.now() - startTime}ms)`);

            return {
                success: true,
                eventId: eventData.id,
                subscriberCount: subscriberIds.length,
                processingTime: eventData.processingTime,
                results
            };

        } catch (error) {
            console.error(`❌ Failed to publish ${eventType}:`, error);
            return {
                success: false,
                error: error.message,
                eventId: null
            };
        }
    }

    /**
     * Notify a single subscriber
     * @param {Object} subscription - Subscription object
     * @param {Object} eventData - Event data
     * @returns {Promise<*>} Callback result
     */
    async notifySubscriber(subscription, eventData) {
        const { callback, options } = subscription;
        
        // Check if subscriber should be notified based on options
        if (options.filter && !options.filter(eventData)) {
            return { skipped: true };
        }

        // Call the callback
        if (options.async !== false) {
            return await callback(eventData);
        } else {
            return callback(eventData);
        }
    }

    /**
     * Add event to history
     * @param {Object} eventData - Event data
     */
    addToHistory(eventData) {
        this.eventHistory.push(eventData);
        
        // Limit history size
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }

    /**
     * Get event history
     * @param {Object} options - Query options
     * @returns {Array} Event history
     */
    getHistory(options = {}) {
        let history = [...this.eventHistory];

        // Filter by event type
        if (options.eventType) {
            history = history.filter(event => event.type === options.eventType);
        }

        // Filter by time range
        if (options.since) {
            const since = new Date(options.since);
            history = history.filter(event => new Date(event.timestamp) >= since);
        }

        if (options.until) {
            const until = new Date(options.until);
            history = history.filter(event => new Date(event.timestamp) <= until);
        }

        // Limit results
        if (options.limit) {
            history = history.slice(0, options.limit);
        }

        return history;
    }

    /**
     * Get event statistics
     * @returns {Object} Event statistics
     */
    getStats() {
        const stats = {
            totalEvents: this.eventHistory.length,
            totalSubscriptions: this.subscribers.size,
            eventTypes: {},
            topEvents: []
        };

        // Count events by type
        for (const event of this.eventHistory) {
            stats.eventTypes[event.type] = (stats.eventTypes[event.type] || 0) + 1;
        }

        // Get top events
        stats.topEvents = Object.entries(stats.eventTypes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([type, count]) => ({ type, count }));

        // Add event metadata
        for (const [eventType, event] of this.events.entries()) {
            stats.eventTypes[eventType] = {
                ...stats.eventTypes[eventType],
                subscriberCount: event.subscribers.size,
                publishCount: event.publishCount,
                lastPublished: event.lastPublished
            };
        }

        return stats;
    }

    /**
     * Clear event history
     * @param {Object} options - Clear options
     */
    clearHistory(options = {}) {
        if (options.eventType) {
            // Clear specific event type
            this.eventHistory = this.eventHistory.filter(event => event.type !== options.eventType);
        } else {
            // Clear all history
            this.eventHistory = [];
        }
        
        console.log(`🗑️ Event history cleared`);
    }

    /**
     * Create cross-feature data sync
     * @param {string} sourceFeature - Source feature
     * @param {string} targetFeature - Target feature
     * @param {string} eventType - Event type to sync
     * @param {Function} transformer - Data transformation function
     * @returns {string} Subscription ID
     */
    createSync(sourceFeature, targetFeature, eventType, transformer) {
        const subscriptionId = this.subscribe(eventType, async (eventData) => {
            try {
                // Transform data if needed
                const transformedData = transformer ? transformer(eventData.data) : eventData.data;
                
                // Publish to target feature
                const targetEventType = `${targetFeature}.data-updated`;
                await this.publish(targetEventType, transformedData, {
                    source: sourceFeature,
                    originalEvent: eventType
                });
                
                console.log(`🔄 Synced data from ${sourceFeature} to ${targetFeature}`);
            } catch (error) {
                console.error(`❌ Failed to sync data from ${sourceFeature} to ${targetFeature}:`, error);
            }
        });

        console.log(`🔗 Created sync: ${sourceFeature} -> ${targetFeature} (${eventType})`);
        return subscriptionId;
    }

    /**
     * Remove sync
     * @param {string} subscriptionId - Subscription ID
     */
    removeSync(subscriptionId) {
        this.unsubscribe(subscriptionId);
        console.log(`🔗 Sync removed (ID: ${subscriptionId})`);
    }

    /**
     * Generate unique subscription ID
     * @returns {string} Unique ID
     */
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique event ID
     * @returns {string} Unique ID
     */
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get system status
     * @returns {Object} System status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            totalEvents: this.eventHistory.length,
            totalSubscriptions: this.subscribers.size,
            eventTypesCount: this.events.size,
            lastEvent: this.eventHistory.length > 0 ? this.eventHistory[this.eventHistory.length - 1].timestamp : null,
            lastUpdate: new Date().toISOString()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataBus;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.DataBus = DataBus;
    
    // Create global instance
    window.dataBus = new DataBus();
}
