/**
 * Enhanced Event Manager with Memory Leak Prevention (Standalone)
 * 
 * This improved event manager automatically tracks and cleans up event listeners
 * to prevent memory leaks in the dashboard application.
 */

(function() {
    'use strict';

    class EventManagerEnhanced {
        constructor() {
            this.listeners = new Map();
            this.globalListeners = new Map();
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

        addListener(target, event, handler, options) {
            const listenerId = this.generateListenerId(target, event);
            
            target.addEventListener(event, handler, options);
            
            const listenerData = {
                target: target,
                event: event,
                handler: handler,
                options: options,
                added: new Date(),
                isGlobal: target === document || target === window
            };

            this.listeners.set(listenerId, listenerData);
            
            if (listenerData.isGlobal) {
                this.globalListeners.set(listenerId, listenerData);
            }

            console.log(`📡 Event listener added: ${event} on ${target.constructor.name}`);

            return () => this.removeListener(listenerId);
        }

        removeListener(listenerId) {
            const listenerData = this.listeners.get(listenerId);
            if (listenerData) {
                listenerData.target.removeEventListener(listenerData.event, listenerData.handler, listenerData.options);
                this.listeners.delete(listenerId);
                this.globalListeners.delete(listenerId);
                console.log(`🗑️ Event listener removed: ${listenerId}`);
            }
        }

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

        cleanupAll() {
            const count = this.listeners.size;
            this.listeners.forEach((data, id) => {
                data.target.removeEventListener(data.event, data.handler, data.options);
            });
            this.listeners.clear();
            this.globalListeners.clear();
            console.log(`🧹 Cleaned up ${count} event listeners`);
        }

        cleanupGlobalListeners() {
            const count = this.globalListeners.size;
            this.globalListeners.forEach((data, id) => {
                data.target.removeEventListener(data.event, data.handler, data.options);
                this.listeners.delete(id);
            });
            this.globalListeners.clear();
            console.log(`🧹 Cleaned up ${count} global event listeners`);
        }

        scheduleCleanup() {
            if (!this.cleanupScheduled) {
                this.cleanupScheduled = true;
                setTimeout(() => {
                    this.cleanupOldListeners();
                    this.cleanupScheduled = false;
                }, 5000);
            }
        }

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

        generateListenerId(target, event) {
            const targetName = target.constructor.name;
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 9);
            return `${targetName}_${event}_${timestamp}_${random}`;
        }

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
                const eventName = data.event;
                stats.byEvent[eventName] = (stats.byEvent[eventName] || 0) + 1;
                
                const targetName = data.target.constructor.name;
                stats.byTarget[targetName] = (stats.byTarget[targetName] || 0) + 1;
                
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

        debounce(handler, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => handler.apply(this, args), delay);
            };
        }

        throttle(handler, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    handler.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        addOnceListener(target, event, handler, options) {
            const onceHandler = (...args) => {
                handler.apply(this, args);
                this.removeListener(this.generateListenerId(target, event));
            };
            
            return this.addListener(target, event, onceHandler, options);
        }
    }

    // Export for global use
    window.EventManagerEnhanced = EventManagerEnhanced;
    
    // Create global instance
    if (typeof window !== 'undefined') {
        window.eventManager = new EventManagerEnhanced();
        console.log('✅ Enhanced Event Manager initialized');
    }
})();