/**
 * Application Configuration and Constants
 * Centralized configuration to reduce duplication and improve maintainability
 */

// API Configuration
export const API_CONFIG = {
    BASE_URL: process.env.API_BASE_URL || window.API_BASE_URL || 'http://localhost:8081',
    ENDPOINTS: {
        HEALTH: '/api/health',
        PROJECT_OVERVIEW: '/api/project/overview',
        ANALYSIS: {
            TECHNICAL_DEBT: '/api/analysis/technical-debt',
            CODE_STRUCTURE: '/api/analysis/code-structure',
            FILE_STRUCTURE: '/api/analysis/file-structure',
            QUALITY: '/api/analysis/quality',
            RECOMMENDATIONS: '/api/analysis/recommendations',
            RUN: '/api/analysis/run'
        },
        AUTH: {
            LOGIN: '/api/auth/login',
            ME: '/api/auth/me'
        },
        TEST_COVERAGE: '/api/test-coverage',
        PROJECTS: '/api/projects',
        NOTIFICATIONS: '/api/notifications'
    },
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3
};

// UI Configuration
export const UI_CONFIG = {
    CHARTS: {
        DEFAULT_HEIGHT: 200,
        MARGINS: {
            top: 20,
            right: 30,
            bottom: 40,
            left: 50
        },
        COLORS: [
            '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
            '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
        ],
        ANIMATION_DURATION: 300
    },
    NOTIFICATIONS: {
        DURATION: 3000,
        TYPES: {
            SUCCESS: 'success',
            ERROR: 'error',
            WARNING: 'warning',
            INFO: 'info'
        }
    },
    LOADING: {
        DEBOUNCE_DELAY: 300,
        MIN_LOADING_TIME: 500
    }
};

// Application Constants
export const APP_CONSTANTS = {
    VERSION: '2.0.0',
    NAME: 'AI Coding Intelligence Dashboard',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    SESSION_DURATION: 60 * 60 * 1000, // 1 hour
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_FILE_TYPES: ['.js', '.ts', '.py', '.html', '.css', '.json', '.md']
};

// Quality Metrics Thresholds
export const QUALITY_THRESHOLDS = {
    EXCELLENT: 90,
    GOOD: 75,
    FAIR: 60,
    POOR: 0
};

// Technical Debt Levels
export const TECHNICAL_DEBT_LEVELS = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical'
};

// Error Messages
export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
    API_ERROR: 'Failed to fetch data from the server. Please try again later.',
    AUTH_ERROR: 'Authentication failed. Please log in again.',
    VALIDATION_ERROR: 'Invalid input data provided.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
    DATA_LOADED: 'Data loaded successfully.',
    CHANGES_SAVED: 'Changes saved successfully.',
    ANALYSIS_COMPLETED: 'Analysis completed successfully.',
    DELETED: 'Item deleted successfully.'
};

// Default Values
export const DEFAULT_VALUES = {
    PROJECT_NAME: 'Untitled Project',
    TOTAL_FILES: 0,
    CODE_QUALITY: 0,
    TEST_COVERAGE: 0,
    TECHNICAL_DEBT: TECHNICAL_DEBT_LEVELS.LOW
};

// Export all configurations as a single object for convenience
export const CONFIG = {
    API: API_CONFIG,
    UI: UI_CONFIG,
    APP: APP_CONSTANTS,
    QUALITY: QUALITY_THRESHOLDS,
    DEBT: TECHNICAL_DEBT_LEVELS,
    MESSAGES: {
        ERROR: ERROR_MESSAGES,
        SUCCESS: SUCCESS_MESSAGES
    },
    DEFAULTS: DEFAULT_VALUES
};

// Make available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.AppConfig = CONFIG;
}
