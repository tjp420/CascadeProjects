/**
 * Structured Logging System
 * Provides consistent, structured logging for the dashboard application
 */

class Logger {
    constructor(options = {}) {
        this.level = options.level || 'info';
        this.prefix = options.prefix || 'Dashboard';
        this.enableConsole = options.enableConsole !== false;
        this.enableStorage = options.enableStorage || false;
        this.maxLogs = options.maxLogs || 1000;
        this.logs = [];
        
        // Log levels in order of severity
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            fatal: 4
        };
    }

    /**
     * Create a structured log entry
     */
    createLogEntry(level, message, context = {}) {
        return {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            prefix: this.prefix,
            message: message,
            context: {
                url: window.location.href,
                userAgent: navigator.userAgent,
                ...context
            }
        };
    }

    /**
     * Check if a log level should be logged
     */
    shouldLog(level) {
        return this.levels[level] >= this.levels[this.level];
    }

    /**
     * Add log to storage
     */
    addLogToStorage(logEntry) {
        this.logs.push(logEntry);
        
        // Keep only the most recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Store in localStorage if enabled
        if (this.enableStorage) {
            try {
                localStorage.setItem('dashboard_logs', JSON.stringify(this.logs));
            } catch (e) {
                console.warn('Failed to store logs in localStorage:', e);
            }
        }
    }

    /**
     * Log a debug message
     */
    debug(message, context = {}) {
        if (!this.shouldLog('debug')) {
            return;
        }
        
        const logEntry = this.createLogEntry('debug', message, context);
        this.addLogToStorage(logEntry);
        
        if (this.enableConsole) {
            console.debug(`[${logEntry.timestamp}] [DEBUG] [${this.prefix}]`, message, context);
        }
    }

    /**
     * Log an info message
     */
    info(message, context = {}) {
        if (!this.shouldLog('info')) {
            return;
        }
        
        const logEntry = this.createLogEntry('info', message, context);
        this.addLogToStorage(logEntry);
        
        if (this.enableConsole) {
            console.info(`[${logEntry.timestamp}] [INFO] [${this.prefix}]`, message, context);
        }
    }

    /**
     * Log a warning message
     */
    warn(message, context = {}) {
        if (!this.shouldLog('warn')) {
            return;
        }
        
        const logEntry = this.createLogEntry('warn', message, context);
        this.addLogToStorage(logEntry);
        
        if (this.enableConsole) {
            console.warn(`[${logEntry.timestamp}] [WARN] [${this.prefix}]`, message, context);
        }
    }

    /**
     * Log an error message
     */
    error(message, context = {}) {
        if (!this.shouldLog('error')) {
            return;
        }
        
        const logEntry = this.createLogEntry('error', message, context);
        this.addLogToStorage(logEntry);
        
        if (this.enableConsole) {
            console.error(`[${logEntry.timestamp}] [ERROR] [${this.prefix}]`, message, context);
        }
    }

    /**
     * Log a fatal error message
     */
    fatal(message, context = {}) {
        if (!this.shouldLog('fatal')) {
            return;
        }
        
        const logEntry = this.createLogEntry('fatal', message, context);
        this.addLogToStorage(logEntry);
        
        if (this.enableConsole) {
            console.error(`[${logEntry.timestamp}] [FATAL] [${this.prefix}]`, message, context);
        }
    }

    /**
     * Get all logs
     */
    getLogs() {
        return this.logs;
    }

    /**
     * Get logs by level
     */
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level.toUpperCase());
    }

    /**
     * Clear all logs
     */
    clearLogs() {
        this.logs = [];
        if (this.enableStorage) {
            localStorage.removeItem('dashboard_logs');
        }
        this.info('Logs cleared');
    }

    /**
     * Export logs as JSON
     */
    exportLogs() {
        return JSON.stringify(this.logs, null, 2);
    }

    /**
     * Get log statistics
     */
    getStats() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            byHour: {},
            recentActivity: []
        };

        this.logs.forEach(log => {
            // Count by level
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

            // Count by hour
            const hour = new Date(log.timestamp).getHours();
            stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
        });

        // Get recent activity (last 10 logs)
        stats.recentActivity = this.logs.slice(-10);

        return stats;
    }

    /**
     * Set log level
     */
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.level = level;
            this.info(`Log level set to ${level}`);
        } else {
            this.warn(`Invalid log level: ${level}`);
        }
    }

    /**
     * Enable/disable console logging
     */
    setConsoleEnabled(enabled) {
        this.enableConsole = enabled;
        this.info(`Console logging ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Enable/disable storage logging
     */
    setStorageEnabled(enabled) {
        this.enableStorage = enabled;
        this.info(`Storage logging ${enabled ? 'enabled' : 'disabled'}`);
        
        // Load logs from storage if enabling
        if (enabled) {
            try {
                const storedLogs = localStorage.getItem('dashboard_logs');
                if (storedLogs) {
                    this.logs = JSON.parse(storedLogs);
                    this.info(`Loaded ${this.logs.length} logs from storage`);
                }
            } catch (e) {
                this.warn('Failed to load logs from storage:', e);
            }
        }
    }
}

// Create global logger instance
window.logger = new Logger({
    level: 'info',
    prefix: 'Dashboard',
    enableConsole: true,
    enableStorage: true,
    maxLogs: 1000
});

// Log initialization
window.logger.info('Logger initialized', {
    level: window.logger.level,
    prefix: window.logger.prefix,
    enableConsole: window.logger.enableConsole,
    enableStorage: window.logger.enableStorage
});

console.log('✅ Structured logging system initialized');
