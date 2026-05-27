/**
 * Utility Functions - Common helper functions
 * Extracted from index.html for code reuse and maintainability
 * 
 * @fileoverview Provides common utility functions for formatting data,
 * calculating metrics, and handling UI interactions throughout the dashboard.
 * @author AI Coding Intelligence Dashboard Team
 * @version 2.0.0
 * @since 2024-01-01
 */

/**
 * Formats bytes into human-readable string with appropriate unit
 * 
 * Converts a number of bytes to the most suitable unit (KB, MB, GB, etc.)
 * and formats it with the specified number of decimal places.
 * 
 * @param {number} bytes - The number of bytes to format
 * @param {number} [decimals=2] - Number of decimal places to display (0-10)
 * @returns {string} Formatted string with unit (e.g., "1.5 MB")
 * 
 * @example
 * formatBytes(1024); // "1 KB"
 * formatBytes(1048576); // "1 MB"
 * formatBytes(1536, 1); // "1.5 KB"
 * 
 * @throws {RangeError} When decimals is not between 0 and 10
 * @throws {TypeError} When bytes is not a number
 */
function formatBytes(bytes, decimals = 2) {
    // Input validation
    if (typeof bytes !== 'number' || isNaN(bytes)) {
        throw new TypeError('Bytes must be a valid number');
    }
    
    if (bytes === 0) {
        return '0 Bytes';
    }
    
    const k = 1024; // Binary prefix (1024 bytes = 1 KB)
    const dm = Math.max(0, Math.min(10, decimals)); // Clamp decimals between 0-10
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formats a date string or Date object into a readable localized format
 * 
 * Converts date input to a standardized format showing date and time
 * in the user's locale (en-US by default).
 * 
 * @param {string|Date} dateString - Date string or Date object to format
 * @param {Object} [options] - Formatting options
 * @param {string} [options.locale='en-US'] - Locale for formatting
 * @param {Object} [options.format] - Date format options
 * @returns {string} Formatted date string
 * 
 * @example
 * formatDate('2024-01-15T10:30:00Z'); // "Jan 15, 2024, 10:30 AM"
 * formatDate(new Date()); // Current date/time
 * formatDate('2024-01-15', { locale: 'fr-FR' }); // French format
 * 
 * @throws {TypeError} When dateString is not a valid date
 */
function formatDate(dateString, options = {}) {
    const { locale = 'en-US', format = {} } = options;
    
    let date;
    if (dateString instanceof Date) {
        date = dateString;
    } else {
        date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
        throw new TypeError('Invalid date string provided');
    }
    
    // Default format options
    const defaultFormat = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...format
    };
    
    return date.toLocaleDateString(locale, defaultFormat);
}

/**
 * Calculates percentage change between two values
 * 
 * Computes the percentage increase or decrease from an old value to a new value.
 * Handles edge cases like division by zero and returns appropriate results.
 * 
 * @param {number} oldValue - Original value (baseline)
 * @param {number} newValue - New value to compare against
 * @returns {number} Percentage change as a number (e.g., 25.5 for 25.5% increase)
 * 
 * @example
 * calculatePercentageChange(100, 150); // 50.0 (50% increase)
 * calculatePercentageChange(100, 75); // -25.0 (25% decrease)
 * calculatePercentageChange(0, 50); // 100 (100% increase from zero)
 * calculatePercentageChange(100, 100); // 0.0 (no change)
 * 
 * @throws {TypeError} When values are not numbers
 */
function calculatePercentageChange(oldValue, newValue) {
    if (typeof oldValue !== 'number' || typeof newValue !== 'number') {
        throw new TypeError('Both values must be numbers');
    }
    
    if (oldValue === 0) {
        return newValue > 0 ? 100 : 0; // 100% increase from zero, or no change
    }
    
    return parseFloat(((newValue - oldValue) / oldValue * 100).toFixed(1));
}

/**
 * Generates a random color from predefined palette
 * 
 * Selects a random color from a curated palette of dashboard-friendly colors
 * that provide good contrast and visual appeal.
 * 
 * @returns {string} Hex color code (e.g., "#3b82f6")
 * 
 * @example
 * generateColor(); // "#ef4444" (random from palette)
 * 
 * @see {@link https://tailwindcss.com/docs/customizing-colors} Color palette reference
 */
function generateColor() {
    /**
     * Curated color palette for dashboard components
     * Colors chosen for accessibility and visual harmony
     */
    const colors = [
        '#3b82f6', // Blue 500
        '#ef4444', // Red 500
        '#10b981', // Emerald 500
        '#f59e0b', // Amber 500
        '#8b5cf6', // Violet 500
        '#ec4899', // Pink 500
        '#06b6d4', // Cyan 500
        '#84cc16', // Lime 500
        '#f97316', // Orange 500
        '#6366f1', // Indigo 500
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Creates a debounced function that delays execution
 * 
 * Debouncing ensures that a function is only called after a specified delay
 * has elapsed since the last time it was invoked. Useful for limiting API calls,
 * search queries, and other performance-critical operations.
 * 
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 * 
 * @example
 * const debouncedSearch = debounce((query) => {
 *     searchAPI(query);
 * }, 300);
 * 
 * debouncedSearch('hello');
 * debouncedSearch('hello world'); // Only this one executes after 300ms
 * 
 * @throws {TypeError} When func is not a function
 * @throws {RangeError} When wait is negative
 */
function debounce(func, wait) {
    if (typeof func !== 'function') {
        throw new TypeError('First argument must be a function');
    }
    
    if (wait < 0) {
        throw new RangeError('Wait time cannot be negative');
    }
    
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Displays a temporary notification message to the user
 * 
 * Creates a non-intrusive notification that appears and automatically
 * disappears after 3 seconds. Supports different notification types.
 * 
 * @param {string} message - Message to display
 * @param {string} [type='info'] - Notification type ('success', 'error', 'warning', 'info')
 * @returns {HTMLElement} The notification element for potential manual removal
 * 
 * @example
 * showNotification('Data saved successfully!', 'success');
 * showNotification('An error occurred', 'error');
 * showNotification('Loading...', 'info');
 * 
 * @throws {TypeError} When message is not a string
 */
function showNotification(message, type = 'info') {
    if (typeof message !== 'string') {
        throw new TypeError('Message must be a string');
    }
    
    const validTypes = ['success', 'error', 'warning', 'info'];
    if (!validTypes.includes(type)) {
        console.warn(`Invalid notification type: ${type}. Using 'info' instead.`);
        type = 'info';
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add inline styles for positioning and appearance
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    const timeoutId = setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
    
    // Return element for manual control
    notification.timeoutId = timeoutId;
    return notification;
}

/**
 * Sets or removes loading state on an interactive element
 * 
 * Manages visual loading indicators by disabling elements and adding
 * loading classes. Useful for buttons, forms, and other interactive components.
 * 
 * @param {HTMLElement} element - DOM element to modify
 * @param {boolean} [loading=true] - Whether to set loading state
 * @returns {void}
 * 
 * @example
 * const button = document.getElementById('submit-btn');
 * setLoading(button, true); // Disable and add loading class
 * setLoading(button, false); // Re-enable and remove loading class
 * 
 * @throws {TypeError} When element is not a valid HTMLElement
 */
function setLoading(element, loading = true) {
    if (!(element instanceof HTMLElement)) {
        throw new TypeError('Element must be a valid HTMLElement');
    }
    
    if (loading) {
        element.disabled = true;
        element.classList.add('loading');
        element.setAttribute('aria-busy', 'true');
    } else {
        element.disabled = false;
        element.classList.remove('loading');
        element.removeAttribute('aria-busy');
    }
}

// Export utilities
window.DashboardUtils = {
    formatBytes,
    formatDate,
    calculatePercentageChange,
    generateColor,
    debounce,
    showNotification,
    setLoading
};
