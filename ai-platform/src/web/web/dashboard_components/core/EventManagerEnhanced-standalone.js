/**
 * Enhanced Event Manager - Standalone Version
 * Handles event management for the dashboard
 */

class EventManagerEnhanced {
    constructor() {
        this.listeners = new Map();
        this.once = new Map();
    }

    // Add event listener
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return this;
    }

    // Add one-time event listener
    one(event, callback) {
        if (!this.once.has(event)) {
            this.once.set(event, []);
        }
        this.once.get(event).push(callback);
        return this;
    }

    // Remove event listener
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
        return this;
    }

    // Trigger event
    emit(event, data) {
        // Trigger regular listeners
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Event listener error:', error);
                }
            });
        }

        // Trigger one-time listeners
        if (this.once.has(event)) {
            this.once.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Event listener error:', error);
                }
            });
            this.once.delete(event);
        }

        return this;
    }

    // Clear all listeners
    clear() {
        this.listeners.clear();
        this.once.clear();
        return this;
    }

    // Get listener count
    listenerCount(event) {
        const regular = this.listeners.has(event) ? this.listeners.get(event).length : 0;
        const once = this.once.has(event) ? this.once.get(event).length : 0;
        return regular + once;
    }
}

// Global event manager instance
window.eventManager = new EventManagerEnhanced();
window.EventManagerEnhanced = EventManagerEnhanced;

console.log('✅ Enhanced Event Manager initialized');
