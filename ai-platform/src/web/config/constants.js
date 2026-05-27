/**
 * Centralized Configuration Constants
 * Replaces hardcoded values throughout the application
 */

// Performance and Timing Constants
const TIMING = {
    CACHE_TIMEOUT: 5 * 60 * 1000, // 5 minutes
    RETRY_DELAY: 1000, // 1 second
    BATCH_SIZE: 3, // Max concurrent requests
    MAX_RETRIES: 3,
    DEBOUNCE_DELAY: 300,
    ANIMATION_DURATION: 300,
    TOAST_DISPLAY_TIME: 5000
};

// Percentage Thresholds and Targets
const PERCENTAGES = {
    SECURITY_TARGET: 85,
    QUALITY_TARGET: 80,
    PERFORMANCE_TARGET: 79,
    COVERAGE_TARGET: 80,
    ACHIEVEMENT_THRESHOLD: 100,
    EXCELLENCE_THRESHOLD: 110,
    CRITICAL_THRESHOLD: 70
};

// API Configuration
const API = {
    BASE_URL: (typeof window !== 'undefined' && window.location) 
        ? window.location.origin 
        : 'http://localhost:54369',
    ENDPOINTS: {
        ANALYSIS: '/api/analysis',
        AUTH: '/api/auth',
        REFRESH: '/api/auth/refresh',
        METRICS: '/api/metrics',
        HEALTH: '/api/health'
    },
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3
};

// UI Configuration
const UI = {
    CHART_COLORS: {
        PRIMARY: '#3498db',
        SUCCESS: '#2ecc71',
        WARNING: '#f39c12',
        DANGER: '#e74c3c',
        INFO: '#9b59b6'
    },
    BREAKPOINTS: {
        MOBILE: 768,
        TABLET: 1024,
        DESKTOP: 1200
    },
    Z_INDEX: {
        MODAL: 9999,
        TOAST: 10000,
        LOADING: 9998
    }
};

// Validation Rules
const VALIDATION = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_FORMATS: ['.js', '.html', '.css', '.py', '.md'],
    MIN_PASSWORD_LENGTH: 8,
    MAX_USERNAME_LENGTH: 50
};

// Business Logic Constants
const BUSINESS = {
    DEFAULT_PAGE_SIZE: 25,
    MAX_RESULTS_PER_PAGE: 100,
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    INACTIVITY_TIMEOUT: 15 * 60 * 1000, // 15 minutes
    AUTO_SAVE_INTERVAL: 30 * 1000 // 30 seconds
};

// Error Messages
const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
    AUTH_ERROR: 'Authentication failed. Please log in again.',
    TIMEOUT_ERROR: 'Request timed out. Please try again.',
    SERVER_ERROR: 'Server error occurred. Please try again later.',
    VALIDATION_ERROR: 'Invalid input provided. Please check your data.'
};

// Success Messages
const SUCCESS_MESSAGES = {
    DATA_LOADED: 'Data loaded successfully',
    CHANGES_SAVED: 'Changes saved successfully',
    OPERATION_COMPLETE: 'Operation completed successfully',
    AUTH_SUCCESS: 'Authentication successful'
};

// Export as ES6 modules
export { TIMING, PERCENTAGES, API, UI, VALIDATION, BUSINESS, ERROR_MESSAGES, SUCCESS_MESSAGES };

// Make constants globally available
if (typeof window !== 'undefined') {
    window.TIMING = TIMING;
    window.PERCENTAGES = PERCENTAGES;
    window.API = API;
    window.UI = UI;
    window.VALIDATION = VALIDATION;
    window.BUSINESS = BUSINESS;
    window.ERROR_MESSAGES = ERROR_MESSAGES;
    window.SUCCESS_MESSAGES = SUCCESS_MESSAGES;
}
