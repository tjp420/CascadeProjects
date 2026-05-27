/**
 * Simple Error Tracking System
 * Captures and logs errors for monitoring and debugging
 */

class ErrorTracker {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.enabled = true;
    }

    /**
   * Capture an error
   * @param {Error} error - The error object
   * @param {Object} context - Additional context information
   */
    capture(error, context = {}) {
        if (!this.enabled) {
            return;
        }

        const errorEntry = {
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            context: {
                url: window.location.href,
                userAgent: navigator.userAgent,
                ...context
            }
        };

        this.errors.push(errorEntry);

        // Keep only the most recent errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        console.error('🔴 Error captured:', errorEntry);
    }

    /**
   * Get all captured errors
   */
    getErrors() {
        return this.errors;
    }

    /**
   * Clear all captured errors
   */
    clearErrors() {
        this.errors = [];
        console.log('🧹 Error tracker cleared');
    }

    /**
   * Enable error tracking
   */
    enable() {
        this.enabled = true;
        console.log('✅ Error tracking enabled');
    }

    /**
   * Disable error tracking
   */
    disable() {
        this.enabled = false;
        console.log('⏸️ Error tracking disabled');
    }

    /**
   * Export errors as JSON
   */
    exportErrors() {
        return JSON.stringify(this.errors, null, 2);
    }

    /**
   * Get error statistics
   */
    getStats() {
        const stats = {
            total: this.errors.length,
            byType: {},
            byContext: {}
        };

        this.errors.forEach(error => {
            // Count by error type/message
            const type = error.message.split(':')[0] || 'Unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;

            // Count by context (URL)
            const url = new URL(error.context.url).pathname;
            stats.byContext[url] = (stats.byContext[url] || 0) + 1;
        });

        return stats;
    }
}

// Initialize global error tracker
window.errorTracker = new ErrorTracker();

// Global error handler
window.addEventListener('error', (event) => {
    window.errorTracker.capture(event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    window.errorTracker.capture(event.reason, {
        type: 'unhandledrejection'
    });
});

console.log('✅ Error tracking system initialized');
