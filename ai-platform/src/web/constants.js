/**
 * Application Constants
 * Centralized constants for magic numbers, percentages, and configuration values
 */

// Percentage thresholds
export const PERCENTAGE_THRESHOLDS = {
    MIN_PROGRESS: 0,
    MAX_PROGRESS: 100,
    LOW_THRESHOLD: 25,
    MEDIUM_THRESHOLD: 50,
    HIGH_THRESHOLD: 75,
    EXCELLENT_THRESHOLD: 90
};

// Quality score thresholds
export const QUALITY_SCORES = {
    POOR: 0,
    FAIR: 50,
    GOOD: 70,
    EXCELLENT: 85,
    PERFECT: 100
};

// Security score thresholds
export const SECURITY_SCORES = {
    CRITICAL: 0,
    LOW: 50,
    MEDIUM: 70,
    HIGH: 85,
    SECURE: 95
};

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
    FAST_RESPONSE_MS: 100,
    ACCEPTABLE_RESPONSE_MS: 300,
    SLOW_RESPONSE_MS: 500,
    TIMEOUT_MS: 5000
};

// Memory usage thresholds (in MB)
export const MEMORY_THRESHOLDS = {
    LOW: 100,
    MEDIUM: 500,
    HIGH: 1000,
    CRITICAL: 2000
};

// CPU usage thresholds (in percentage)
export const CPU_THRESHOLDS = {
    IDLE: 10,
    LOW: 30,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 90
};

// Test coverage thresholds
export const COVERAGE_THRESHOLDS = {
    MINIMUM: 50,
    GOOD: 70,
    EXCELLENT: 80,
    PERFECT: 95
};

// Technical debt thresholds
export const TECHNICAL_DEBT_THRESHOLDS = {
    LOW_DAYS: 1,
    MEDIUM_DAYS: 3,
    HIGH_DAYS: 7,
    CRITICAL_DAYS: 14
};

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
    SMALL: 1024,           // 1KB
    MEDIUM: 102400,         // 100KB
    LARGE: 1048576,         // 1MB
    VERY_LARGE: 10485760    // 10MB
};

// Function complexity thresholds
export const COMPLEXITY_THRESHOLDS = {
    SIMPLE: 5,
    MODERATE: 10,
    COMPLEX: 20,
    VERY_COMPLEX: 50
};

// Duplication thresholds
export const DUPLICATION_THRESHOLDS = {
    MINIMAL: 1,
    LOW: 3,
    MEDIUM: 5,
    HIGH: 10,
    CRITICAL: 20
};

// API configuration
export const API_CONFIG = {
    TIMEOUT_MS: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000
};

// Dashboard refresh intervals (in milliseconds)
export const REFRESH_INTERVALS = {
    FAST: 5000,      // 5 seconds
    NORMAL: 30000,   // 30 seconds
    SLOW: 60000,     // 1 minute
    VERY_SLOW: 300000 // 5 minutes
};

// Pagination
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MIN_PAGE_SIZE: 5
};

// Chart configuration
export const CHART_CONFIG = {
    DEFAULT_WIDTH: 400,
    DEFAULT_HEIGHT: 250,
    MAX_DATA_POINTS: 50
};

// Animation durations (in milliseconds)
export const ANIMATION_DURATIONS = {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
    VERY_SLOW: 1000
};

// Z-index layers
export const Z_INDEX = {
    BASE: 1,
    DROPDOWN: 1000,
    MODAL: 2000,
    TOAST: 3000,
    LOADING: 4000
};

// Default values
export const DEFAULTS = {
    USERNAME: 'User',
    PROJECT_NAME: 'Project',
    DATE_FORMAT: 'YYYY-MM-DD',
    TIME_FORMAT: 'HH:mm:ss'
};
