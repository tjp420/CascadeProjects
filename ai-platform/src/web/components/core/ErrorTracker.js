/**
 * Error tracking system for monitoring and alerting
 * 
 * @class ErrorTracker
 * @example
 * const tracker = new ErrorTracker();
 * tracker.initialize();
 * tracker.captureError({ message: 'Test error' });
 */
export class ErrorTracker {
    constructor() {
        this.errors = [];
        this.maxErrors = 500;
        this.alertThreshold = 5; // Alert after 5 errors in 5 minutes
        this.errorCount = 0;
        this.resetInterval = null;
        this.initialized = false;
    }

    /**
     * Initializes the error tracker with global event listeners
     * 
     * @returns {void}
     */
    initialize() {
        if (this.initialized) {
            return;
        }
        
        // Set up global error handler
        window.addEventListener('error', (event) => {
            this.captureError({
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        // Set up unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.captureError({
                message: event.reason?.message || 'Unhandled Promise Rejection',
                stack: event.reason?.stack
            });
        });

        // Reset error count every 5 minutes
        this.resetInterval = setInterval(() => {
            this.errorCount = 0;
        }, 5 * 60 * 1000);

        this.initialized = true;
    }

    captureError(error) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            message: error.message || 'Unknown error',
            stack: error.stack || '',
            context: {
                url: window.location.href,
                userAgent: navigator.userAgent,
                filename: error.filename,
                lineno: error.lineno,
                colno: error.colno
            }
        };

        this.errors.push(errorEntry);
        this.errorCount++;

        // Keep only the last maxErrors entries
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // Log the error
        console.error('🔴 Error captured:', errorEntry);

        // Check if alert threshold is reached
        if (this.errorCount >= this.alertThreshold) {
            this.triggerAlert(errorEntry);
        }

        return errorEntry;
    }

    triggerAlert(error) {
        // In a real implementation, this would send alerts to a monitoring service
        console.warn('⚠️ Error threshold reached! Multiple errors detected.');
        console.warn('Latest error:', error);
        
        // You could integrate with services like Sentry, Rollbar, etc.
        // Example: Sentry.captureException(error);
    }

    getErrors(limit = null) {
        if (limit) {
            return this.errors.slice(-limit);
        }
        return this.errors;
    }

    getErrorCount() {
        return this.errorCount;
    }

    clearErrors() {
        this.errors = [];
        this.errorCount = 0;
    }

    exportErrors(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.errors, null, 2);
        } else if (format === 'csv') {
            const headers = ['timestamp', 'message', 'url', 'filename', 'lineno'];
            const rows = this.errors.map(err => [
                err.timestamp,
                err.message,
                err.context.url,
                err.context.filename || '',
                err.context.lineno || ''
            ]);
            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }
        return this.errors;
    }

    getErrorSummary() {
        const summary = {
            total: this.errors.length,
            recent: this.errorCount,
            byMessage: {}
        };

        this.errors.forEach(err => {
            const key = err.message;
            summary.byMessage[key] = (summary.byMessage[key] || 0) + 1;
        });

        return summary;
    }
}

// Create global error tracker instance
window.errorTracker = new ErrorTracker();
window.ErrorTracker = ErrorTracker;
