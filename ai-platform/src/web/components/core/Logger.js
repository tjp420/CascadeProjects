/**
 * Logger class for structured logging with levels and formatting
 * 
 * @class Logger
 * @example
 * const logger = new Logger();
 * logger.setLevel('DEBUG');
 * logger.info('Application started');
 */
export class Logger {
    constructor() {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };
        this.currentLevel = this.levels.INFO;
        this.logs = [];
        this.maxLogs = 1000;
    }

    /**
     * Sets the current logging level
     * 
     * @param {string} level - The logging level (ERROR, WARN, INFO, DEBUG)
     * @returns {void}
     */
    setLevel(level) {
        if (this.levels[level] !== undefined) {
            this.currentLevel = this.levels[level];
        }
    }

    formatMessage(level, message, context = {}) {
        const timestamp = new Date().toISOString();
        return {
            timestamp,
            level,
            message,
            context
        };
    }

    log(level, message, context = {}) {
        const logEntry = this.formatMessage(level, message, context);
        
        if (this.levels[level] <= this.currentLevel) {
            this.logs.push(logEntry);
            
            // Keep only the last maxLogs entries
            if (this.logs.length > this.maxLogs) {
                this.logs.shift();
            }
            
            // Output to console with formatting
            const emoji = this.getEmoji(level);
            console.log(`${emoji} [${level}] ${message}`, context);
        }
        
        return logEntry;
    }

    getEmoji(level) {
        const emojis = {
            ERROR: '🔴',
            WARN: '⚠️',
            INFO: 'ℹ️',
            DEBUG: '🔍'
        };
        return emojis[level] || '📝';
    }

    error(message, context = {}) {
        return this.log('ERROR', message, context);
    }

    warn(message, context = {}) {
        return this.log('WARN', message, context);
    }

    info(message, context = {}) {
        return this.log('INFO', message, context);
    }

    debug(message, context = {}) {
        return this.log('DEBUG', message, context);
    }

    getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return this.logs;
    }

    clearLogs() {
        this.logs = [];
    }

    exportLogs(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.logs, null, 2);
        } else if (format === 'csv') {
            const headers = ['timestamp', 'level', 'message', 'context'];
            const rows = this.logs.map(log => [
                log.timestamp,
                log.level,
                log.message,
                JSON.stringify(log.context)
            ]);
            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }
        return this.logs;
    }
}

// Create global logger instance
window.logger = new Logger();
window.Logger = Logger;
