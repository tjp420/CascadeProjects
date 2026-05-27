/**
 * Memory Leak Fix for AI Coding Dashboard
 * Fixes event listener memory leaks and provides cleanup utilities
 */

class MemoryLeakFixer {
    constructor() {
        this.eventListeners = new Map();
        this.timers = new Set();
        this.intervals = new Set();
        this.isInitialized = false;
    }

    /**
     * Initialize memory leak fixes
     */
    init() {
        if (this.isInitialized) {
            return;
        }
        
        // Fix existing memory leaks
        this.fixResizeHandler();
        this.fixPeriodicUpdates();
        this.setupCleanupHandlers();
        
        this.isInitialized = true;
        console.log('Memory leak fixes initialized');
    }

    /**
     * Fix the resize handler memory leak
     */
    fixResizeHandler() {
        // Remove the existing leaky resize listener
        const existingResizeHandler = this.resizeHandler;
        if (existingResizeHandler) {
            window.removeEventListener('resize', existingResizeHandler);
        }

        // Create proper resize handler with cleanup
        this.resizeHandler = () => {
            if (window.innerWidth > 768) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.remove('active');
                }
            }
        };

        window.addEventListener('resize', this.resizeHandler);
        this.eventListeners.set('resize', this.resizeHandler);
    }

    /**
     * Fix periodic update memory leaks
     */
    fixPeriodicUpdates() {
        // Clear any existing intervals that might be leaking
        this.clearAllIntervals();
        
        // Set up proper activity feed updates with cleanup
        this.setupActivityFeedUpdates();
    }

    /**
     * Setup activity feed updates with proper cleanup
     */
    setupActivityFeedUpdates() {
        // Clear existing activity feed interval if any
        const existingInterval = this.activityFeedInterval;
        if (existingInterval) {
            clearInterval(existingInterval);
        }

        // Set up new interval with tracking
        this.activityFeedInterval = setInterval(() => {
            this.updateActivityFeed();
        }, 30000); // Update every 30 seconds
        
        this.intervals.add(this.activityFeedInterval);
    }

    /**
     * Update activity feed (moved from global scope)
     */
    async updateActivityFeed() {
        try {
            if (!window.apiClient) {
                console.warn('API client not available for activity feed');
                return;
            }
            
            const notifications = await window.apiClient.listNotifications();
            const activityFeed = document.querySelector('.activity-feed');
            
            if (!activityFeed || !notifications.notifications) {
                return;
            }
            
            // Clear existing activity items
            const existingItems = activityFeed.querySelectorAll('.activity-item');
            existingItems.forEach(item => item.remove());
            
            // Add real notification items
            notifications.notifications.slice(0, 4).forEach(notification => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                
                // Determine icon type based on notification type
                let iconClass = 'info';
                let icon = 'fas fa-info-circle';
                
                switch(notification.type) {
                case 'security':
                    iconClass = 'warning';
                    icon = 'fas fa-exclamation-triangle';
                    break;
                case 'analysis':
                    iconClass = 'success';
                    icon = 'fas fa-check';
                    break;
                case 'performance':
                    iconClass = 'success';
                    icon = 'fas fa-rocket';
                    break;
                case 'code_quality':
                    iconClass = 'info';
                    icon = 'fas fa-code';
                    break;
                }
                
                activityItem.textContent = `
                    <div class="activity-icon ${iconClass}">
                        <i class="${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${notification.type.charAt(0).toUpperCase() + notification.type.slice(1).replace('_', ' ')}</div>
                        <div class="activity-description">${notification.message}</div>
                        <div class="activity-time">${new Date(notification.created_at).toLocaleString()}</div>
                    </div>
                ` /* Replaced innerHTML with textContent for safety */
                
                activityFeed.appendChild(activityItem);
            });
            
        } catch (error) {
            console.error('Error updating activity feed:', error);
        }
    }

    /**
     * Setup cleanup handlers for page unload
     */
    setupCleanupHandlers() {
        // Cleanup on page unload
        this.unloadHandler = () => {
            this.cleanup();
        };

        window.addEventListener('beforeunload', this.unloadHandler);
        this.eventListeners.set('beforeunload', this.unloadHandler);

        // Cleanup on visibility change (when user switches tabs)
        this.visibilityHandler = () => {
            if (document.hidden) {
                this.pauseIntervals();
            } else {
                this.resumeIntervals();
            }
        };

        document.addEventListener('visibilitychange', this.visibilityHandler);
        this.eventListeners.set('visibilitychange', this.visibilityHandler);
    }

    /**
     * Pause intervals when page is not visible
     */
    pauseIntervals() {
        this.intervals.forEach(interval => clearInterval(interval));
    }

    /**
     * Resume intervals when page becomes visible
     */
    resumeIntervals() {
        this.setupActivityFeedUpdates();
    }

    /**
     * Add a tracked event listener
     */
    addTrackedListener(element, event, handler) {
        element.addEventListener(event, handler);
        
        const key = `${element.constructor.name}-${event}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, new Set());
        }
        this.eventListeners.get(key).add({element, handler});
    }

    /**
     * Add a tracked timer
     */
    addTrackedTimer(callback, delay) {
        const timer = setTimeout(callback, delay);
        this.timers.add(timer);
        return timer;
    }

    /**
     * Add a tracked interval
     */
    addTrackedInterval(callback, interval) {
        const intervalId = setInterval(callback, interval);
        this.intervals.add(intervalId);
        return intervalId;
    }

    /**
     * Clear all timers
     */
    clearAllTimers() {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
    }

    /**
     * Clear all intervals
     */
    clearAllIntervals() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals.clear();
    }

    /**
     * Remove all tracked event listeners
     */
    removeAllListeners() {
        this.eventListeners.forEach((listeners, key) => {
            if (typeof listeners === 'function') {
                // Single listener case (like resize)
                const element = key.includes('resize') ? window : document;
                element.removeEventListener(key.replace(/^[^-]+-/, ''), listeners);
            } else if (listeners instanceof Set) {
                // Multiple listeners case
                listeners.forEach(({element, handler}) => {
                    element.removeEventListener(key.replace(/^[^-]+-/, ''), handler);
                });
            }
        });
        this.eventListeners.clear();
    }

    /**
     * Clean up all resources
     */
    cleanup() {
        console.log('Cleaning up memory leak fixes...');
        
        this.clearAllTimers();
        this.clearAllIntervals();
        this.removeAllListeners();
        
        this.isInitialized = false;
        console.log('Memory leak cleanup complete');
    }

    /**
     * Get memory usage statistics
     */
    getMemoryStats() {
        return {
            eventListeners: this.eventListeners.size,
            timers: this.timers.size,
            intervals: this.intervals.size,
            isInitialized: this.isInitialized
        };
    }
}

// Global instance
window.memoryLeakFixer = new MemoryLeakFixer();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.memoryLeakFixer.init();
    });
} else {
    window.memoryLeakFixer.init();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemoryLeakFixer;
}
