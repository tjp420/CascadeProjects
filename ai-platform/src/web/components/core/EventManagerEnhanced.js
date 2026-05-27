/**
 * Enhanced Event Manager with Memory Leak Prevention
 * 
 * This improved event manager automatically tracks and cleans up event listeners
 * to prevent memory leaks in the dashboard application.
 */

export class EventManagerEnhanced {
    constructor() {
        this.listeners = new Map(); // Track all event listeners
        this.globalListeners = new Map(); // Track global (document/window) listeners
        this.cleanupScheduled = false;
        this.init();
    }

    init() {
        // Set up automatic cleanup on page unload
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => this.cleanupAll());
            
            // Also cleanup on visibility change (for SPA navigation)
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.scheduleCleanup();
                }
            });
        }
    }

    /**
     * Add an event listener with automatic tracking
     * @param {EventTarget} target - The target (element, document, window)
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event listener options
     * @returns {Function} Cleanup function
     */
    addListener(target, event, handler, options = {}) {
        const listenerId = this.generateListenerId(target, event);
        
        target.addEventListener(event, handler, options);
        
        const listenerData = {
            target,
            event,
            handler,
            options,
            added: new Date(),
            isGlobal: target === document || target === window
        };

        this.listeners.set(listenerId, listenerData);
        
        if (listenerData.isGlobal) {
            this.globalListeners.set(listenerId, listenerData);
        }

        console.log(`📡 Event listener added: ${event} on ${target.constructor.name}`);

        // Return cleanup function
        return () => this.removeListener(listenerId);
    }

    /**
     * Remove a specific event listener
     * @param {string} listenerId - The listener ID
     */
    removeListener(listenerId) {
        const listenerData = this.listeners.get(listenerId);
        if (listenerData) {
            listenerData.target.removeEventListener(
                listenerData.event,
                listenerData.handler,
                listenerData.options
            );
            this.listeners.delete(listenerId);
            this.globalListeners.delete(listenerId);
            console.log(`🗑️ Event listener removed: ${listenerId}`);
        }
    }

    /**
     * Remove all listeners for a specific target
     * @param {EventTarget} target - The target to clean up
     */
    removeListenersForTarget(target) {
        const toRemove = [];
        
        this.listeners.forEach((data, id) => {
            if (data.target === target) {
                toRemove.push(id);
            }
        });

        toRemove.forEach(id => this.removeListener(id));
        console.log(`🗑️ Removed ${toRemove.length} listeners for target`);
    }

    /**
     * Remove all listeners for a specific event type
     * @param {string} event - Event type
     */
    removeListenersForEvent(event) {
        const toRemove = [];
        
        this.listeners.forEach((data, id) => {
            if (data.event === event) {
                toRemove.push(id);
            }
        });

        toRemove.forEach(id => this.removeListener(id));
        console.log(`🗑️ Removed ${toRemove.length} listeners for event: ${event}`);
    }

    /**
     * Clean up all event listeners
     */
    cleanupAll() {
        const count = this.listeners.size;
        this.listeners.forEach((data, id) => {
            data.target.removeEventListener(data.event, data.handler, data.options);
        });
        this.listeners.clear();
        this.globalListeners.clear();
        console.log(`🧹 Cleaned up ${count} event listeners`);
    }

    /**
     * Clean up only global listeners (document/window)
     */
    cleanupGlobalListeners() {
        const count = this.globalListeners.size;
        this.globalListeners.forEach((data, id) => {
            data.target.removeEventListener(data.event, data.handler, data.options);
            this.listeners.delete(id);
        });
        this.globalListeners.clear();
        console.log(`🧹 Cleaned up ${count} global event listeners`);
    }

    /**
     * Schedule cleanup for delayed execution
     */
    scheduleCleanup() {
        if (!this.cleanupScheduled) {
            this.cleanupScheduled = true;
            setTimeout(() => {
                this.cleanupOldListeners();
                this.cleanupScheduled = false;
            }, 5000); // 5 second delay
        }
    }

    /**
     * Clean up old listeners (older than 1 hour)
     */
    cleanupOldListeners() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const toRemove = [];

        this.listeners.forEach((data, id) => {
            if (data.added < oneHourAgo) {
                toRemove.push(id);
            }
        });

        toRemove.forEach(id => this.removeListener(id));
        console.log(`🧹 Cleaned up ${toRemove.length} old event listeners`);
    }

    /**
     * Generate a unique listener ID
     * @param {EventTarget} target - The event target
     * @param {string} event - Event type
     * @returns {string} Unique ID
     */
    generateListenerId(target, event) {
        const targetName = target.constructor.name;
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${targetName}_${event}_${timestamp}_${random}`;
    }

    /**
     * Get statistics about current listeners
     * @returns {Object} Listener statistics
     */
    getStats() {
        const stats = {
            total: this.listeners.size,
            global: this.globalListeners.size,
            byEvent: {},
            byTarget: {},
            oldest: null,
            newest: null
        };

        let oldest = null;
        let newest = null;

        this.listeners.forEach((data) => {
            // Count by event
            stats.byEvent[data.event] = (stats.byEvent[data.event] || 0) + 1;
            
            // Count by target
            const targetName = data.target.constructor.name;
            stats.byTarget[targetName] = (stats.byTarget[targetName] || 0) + 1;
            
            // Track oldest/newest
            if (!oldest || data.added < oldest) {
                oldest = data.added;
            }
            if (!newest || data.added > newest) {
                newest = data.added;
            }
        });

        stats.oldest = oldest;
        stats.newest = newest;

        return stats;
    }

    /**
     * Log current listener statistics
     */
    logStats() {
        const stats = this.getStats();
        console.log('📊 Event Listener Statistics:', {
            total: stats.total,
            global: stats.global,
            events: stats.byEvent,
            targets: stats.byTarget,
            oldest: stats.oldest?.toISOString(),
            newest: stats.newest?.toISOString()
        });
    }

    /**
     * Create a debounced event handler
     * @param {Function} handler - Original handler
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced handler
     */
    debounce(handler, delay = 300) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => handler.apply(this, args), delay);
        };
    }

    /**
     * Create a throttled event handler
     * @param {Function} handler - Original handler
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled handler
     */
    throttle(handler, limit = 300) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                handler.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Add a one-time event listener
     * @param {EventTarget} target - The target
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event listener options
     */
    addOnceListener(target, event, handler, options = {}) {
        const onceHandler = (...args) => {
            handler.apply(this, args);
            this.removeListener(this.generateListenerId(target, event));
        };
        
        return this.addListener(target, event, onceHandler, options);
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.eventManager = new EventManagerEnhanced();
}

// Export for use in modules
export default EventManagerEnhanced;