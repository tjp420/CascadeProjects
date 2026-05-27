/**
 * Memory Leak Detection and Prevention System
 * Identifies and helps fix memory leaks in JavaScript code
 */

class MemoryLeakDetector {
    constructor() {
        this.eventListeners = new Map();
        this.timers = new Map();
        this.observers = new Map();
        this.intervals = new Map();
        this.detectionEnabled = true;
        this.leakThresholds = {
            maxEventListeners: 100,
            maxTimers: 50,
            maxObservers: 20,
            maxIntervals: 10
        };
    }

    /**
     * Track event listener addition
     */
    trackEventListener(element, eventType, handler, options = {}) {
        if (!this.detectionEnabled) {
            return;
        }
        
        const key = `${element.constructor.name}-${eventType}`;
        const listeners = this.eventListeners.get(key) || [];
        
        // Check for potential leak
        if (listeners.length > this.leakThresholds.maxEventListeners) {
            console.warn(`⚠️ Potential memory leak detected: ${listeners.length} event listeners for ${key}`);
            this.suggestCleanup(key, 'eventListeners');
        }
        
        // Store listener reference
        listeners.push({
            element,
            eventType,
            handler,
            options,
            timestamp: Date.now(),
            stackTrace: new Error().stack
        });
        
        this.eventListeners.set(key, listeners);
        
        // Add cleanup metadata to element
        if (!element._memoryLeakTracked) {
            element._memoryLeakTracked = true;
            element._memoryLeakCleanup = () => this.cleanupElement(element);
        }
    }

    /**
     * Track timer creation
     */
    trackTimer(timerId, delay, callback, type = 'setTimeout') {
        if (!this.detectionEnabled) {
            return timerId;
        }
        
        const key = `${type}-${timerId}`;
        const timers = this.timers.get(key) || [];
        
        // Check for potential leak
        if (timers.length > this.leakThresholds.maxTimers) {
            console.warn(`⚠️ Potential memory leak detected: ${timers.length} ${type} timers`);
            this.suggestCleanup(key, 'timers');
        }
        
        // Store timer reference
        timers.push({
            timerId,
            delay,
            callback,
            type,
            timestamp: Date.now(),
            stackTrace: new Error().stack
        });
        
        this.timers.set(key, timers);
        return timerId;
    }

    /**
     * Track observer creation
     */
    trackObserver(observer, type, target) {
        if (!this.detectionEnabled) {
            return observer;
        }
        
        const key = `${type}-${target.constructor.name}`;
        const observers = this.observers.get(key) || [];
        
        // Check for potential leak
        if (observers.length > this.leakThresholds.maxObservers) {
            console.warn(`⚠️ Potential memory leak detected: ${observers.length} ${type} observers`);
            this.suggestCleanup(key, 'observers');
        }
        
        // Store observer reference
        observers.push({
            observer,
            type,
            target,
            timestamp: Date.now(),
            stackTrace: new Error().stack
        });
        
        this.observers.set(key, observers);
        
        // Add cleanup method
        observer._memoryLeakCleanup = () => this.cleanupObserver(observer);
        
        return observer;
    }

    /**
     * Track interval creation
     */
    trackInterval(intervalId, delay, callback) {
        if (!this.detectionEnabled) {
            return intervalId;
        }
        
        const key = `setInterval-${intervalId}`;
        const intervals = this.intervals.get(key) || [];
        
        // Check for potential leak
        if (intervals.length > this.leakThresholds.maxIntervals) {
            console.warn(`⚠️ Potential memory leak detected: ${intervals.length} intervals`);
            this.suggestCleanup(key, 'intervals');
        }
        
        // Store interval reference
        intervals.push({
            intervalId,
            delay,
            callback,
            timestamp: Date.now(),
            stackTrace: new Error().stack
        });
        
        this.intervals.set(key, intervals);
        return intervalId;
    }

    /**
     * Safe event listener addition with automatic cleanup
     */
    addEventListener(element, eventType, handler, options = {}) {
        // Track the listener
        this.trackEventListener(element, eventType, handler, options);
        
        // Add the listener
        element.addEventListener(eventType, handler, options);
        
        // Return cleanup function
        return () => {
            element.removeEventListener(eventType, handler, options);
            this.untrackEventListener(element, eventType, handler);
        };
    }

    /**
     * Safe setTimeout with automatic cleanup
     */
    setTimeout(callback, delay, ...args) {
        const timerId = window.setTimeout(() => {
            callback(...args);
            this.untrackTimer(timerId, 'setTimeout');
        }, delay);
        
        this.trackTimer(timerId, delay, callback, 'setTimeout');
        return timerId;
    }

    /**
     * Safe setInterval with automatic cleanup
     */
    setInterval(callback, delay, ...args) {
        const intervalId = window.setInterval(() => {
            callback(...args);
        }, delay);
        
        this.trackInterval(intervalId, delay, callback);
        return intervalId;
    }

    /**
     * Safe observer creation with automatic cleanup
     */
    createObserver(type, callback, options = {}) {
        const observer = new Observer(callback, options);
        this.trackObserver(observer, type, options);
        return observer;
    }

    /**
     * Cleanup event listener
     */
    untrackEventListener(element, eventType, handler) {
        const key = `${element.constructor.name}-${eventType}`;
        const listeners = this.eventListeners.get(key) || [];
        
        const index = listeners.findIndex(l => 
            l.element === element && 
            l.eventType === eventType && 
            l.handler === handler
        );
        
        if (index !== -1) {
            listeners.splice(index, 1);
            if (listeners.length === 0) {
                this.eventListeners.delete(key);
            } else {
                this.eventListeners.set(key, listeners);
            }
        }
    }

    /**
     * Cleanup timer
     */
    untrackTimer(timerId, type) {
        const key = `${type}-${timerId}`;
        const timers = this.timers.get(key) || [];
        
        const index = timers.findIndex(t => t.timerId === timerId);
        
        if (index !== -1) {
            timers.splice(index, 1);
            if (timers.length === 0) {
                this.timers.delete(key);
            } else {
                this.timers.set(key, timers);
            }
        }
    }

    /**
     * Cleanup observer
     */
    cleanupObserver(observer) {
        for (const [key, observers] of this.observers.entries()) {
            const index = observers.findIndex(o => o.observer === observer);
            
            if (index !== -1) {
                observers.splice(index, 1);
                if (observers.length === 0) {
                    this.observers.delete(key);
                } else {
                    this.observers.set(key, observers);
                }
                break;
            }
        }
    }

    /**
     * Cleanup interval
     */
    untrackInterval(intervalId) {
        const key = `setInterval-${intervalId}`;
        const intervals = this.intervals.get(key) || [];
        
        const index = intervals.findIndex(i => i.intervalId === intervalId);
        
        if (index !== -1) {
            intervals.splice(index, 1);
            if (intervals.length === 0) {
                this.intervals.delete(key);
            } else {
                this.intervals.set(key, intervals);
            }
        }
    }

    /**
     * Cleanup element
     */
    cleanupElement(element) {
        const elementKey = element.constructor.name;
        
        // Find and remove all listeners for this element
        for (const [key, listeners] of this.eventListeners.entries()) {
            if (key.includes(elementKey)) {
                listeners.forEach(listener => {
                    try {
                        listener.element.removeEventListener(
                            listener.eventType, 
                            listener.handler, 
                            listener.options
                        );
                    } catch (error) {
                        console.warn(`Failed to remove event listener: ${error.message}`);
                    }
                });
                this.eventListeners.delete(key);
            }
        }
        
        element._memoryLeakTracked = false;
        delete element._memoryLeakCleanup;
    }

    /**
     * Suggest cleanup actions
     */
    suggestCleanup(key, type) {
        console.log(`💡 Suggested cleanup for ${key}:`);
        
        switch (type) {
        case 'eventListeners':
            console.log('   - Ensure removeEventListener() is called for all listeners');
            console.log('   - Use event delegation when possible');
            console.log('   - Consider using WeakMap for temporary references');
            break;
        case 'timers':
            console.log('   - Ensure clearTimeout() is called for all timers');
            console.log('   - Use timer cleanup patterns');
            break;
        case 'observers':
            console.log('   - Ensure observer.disconnect() is called');
            console.log('   - Use WeakMap for observer references');
            break;
        case 'intervals':
            console.log('   - Ensure clearInterval() is called');
            console.log('   - Use interval cleanup patterns');
            break;
        }
    }

    /**
     * Generate memory leak report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalEventListeners: Array.from(this.eventListeners.values()).reduce((sum, arr) => sum + arr.length, 0),
                totalTimers: Array.from(this.timers.values()).reduce((sum, arr) => sum + arr.length, 0),
                totalObservers: Array.from(this.observers.values()).reduce((sum, arr) => sum + arr.length, 0),
                totalIntervals: Array.from(this.intervals.values()).reduce((sum, arr) => sum + arr.length, 0)
            },
            leaks: {
                eventListeners: this.findLeaks('eventListeners'),
                timers: this.findLeaks('timers'),
                observers: this.findLeaks('observers'),
                intervals: this.findLeaks('intervals')
            }
        };
        
        return report;
    }

    /**
     * Find potential leaks in a category
     */
    findLeaks(category) {
        const collection = this[category];
        const leaks = [];
        
        for (const [key, items] of collection.entries()) {
            if (items.length > this.leakThresholds[category === 'eventListeners' ? 'maxEventListeners' : 
                category === 'timers' ? 'maxTimers' : 
                    category === 'observers' ? 'maxObservers' : 
                        'maxIntervals']) {
                leaks.push({
                    key,
                    count: items.length,
                    threshold: this.leakThresholds[category === 'eventListeners' ? 'maxEventListeners' : 
                        category === 'timers' ? 'maxTimers' : 
                            category === 'observers' ? 'maxObservers' : 
                                'maxIntervals'],
                    items: items.map(item => ({
                        timestamp: item.timestamp,
                        stackTrace: item.stackTrace
                    }))
                });
            }
        }
        
        return leaks;
    }

    /**
     * Cleanup all tracked resources
     */
    cleanup() {
        console.log('🧹 Cleaning up all tracked resources...');
        
        // Clear timers
        for (const [_key, timers] of this.timers.entries()) {
            timers.forEach(timer => {
                if (timer.type === 'setTimeout') {
                    clearTimeout(timer.timerId);
                } else if (timer.type === 'setInterval') {
                    clearInterval(timer.timerId);
                }
            });
        }
        this.timers.clear();
        
        // Clear intervals
        for (const intervalId of this.intervals.keys()) {
            clearInterval(intervalId.replace('setInterval-', ''));
        }
        this.intervals.clear();
        
        // Clear observers
        for (const observer of this.observers.values()) {
            observer.forEach(obs => {
                try {
                    if (obs.observer.disconnect) {
                        obs.observer.disconnect();
                    }
                } catch (error) {
                    console.warn(`Failed to disconnect observer: ${error.message}`);
                }
            });
        }
        this.observers.clear();
        
        // Clear event listeners
        for (const [_key, listeners] of this.eventListeners.entries()) {
            listeners.forEach(listener => {
                try {
                    listener.element.removeEventListener(
                        listener.eventType,
                        listener.handler,
                        listener.options
                    );
                } catch (error) {
                    console.warn(`Failed to remove event listener: ${error.message}`);
                }
            });
        }
        this.eventListeners.clear();
        
        console.log('✅ Cleanup completed');
    }

    /**
     * Enable/disable detection
     */
    setDetectionEnabled(enabled) {
        this.detectionEnabled = enabled;
        console.log(`Memory leak detection ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Update thresholds
     */
    updateThresholds(thresholds) {
        this.leakThresholds = { ...this.leakThresholds, ...thresholds };
        console.log('Memory leak thresholds updated:', this.leakThresholds);
    }
}

// Observer polyfill for compatibility
if (typeof Observer === 'undefined') {
    class _Observer {
        constructor(callback) {
            this.callback = callback;
        }
        
        disconnect() {
            // Polyfill implementation
        }
    }
}

// Create global instance
window.memoryLeakDetector = new MemoryLeakDetector();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemoryLeakDetector;
}
