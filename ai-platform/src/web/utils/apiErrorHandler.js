/**
 * API Error Handler Utility
 * Provides standardized error handling for API calls
 */

/**
 * Wraps an API call with error handling and retry logic
 * 
 * @param {Function} apiCall - The API function to call
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
 * @param {Function} options.onRetry - Callback called on each retry
 * @returns {Promise} Promise that resolves with API response or rejects with error
 */
export async function withErrorHandling(apiCall, options = {}) {
    const {
        maxRetries = 3,
        retryDelay = 1000,
        onRetry = null
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await apiCall();
            return result;
        } catch (error) {
            lastError = error;
            
            // Don't retry on client errors (4xx)
            if (error.response && error.response.status >= 400 && error.response.status < 500) {
                throw error;
            }

            // Don't retry on last attempt
            if (attempt === maxRetries) {
                throw error;
            }

            // Call retry callback if provided
            if (onRetry) {
                onRetry(attempt + 1, error);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    throw lastError;
}

/**
 * Creates a standardized error object from API errors
 * 
 * @param {Error} error - The error object
 * @param {string} context - Context information about the error
 * @returns {Object} Standardized error object
 */
export function createApiError(error, context = '') {
    return {
        message: error.message || 'An unknown error occurred',
        status: error.response?.status || null,
        statusText: error.response?.statusText || '',
        context,
        timestamp: new Date().toISOString(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
}

/**
 * Logs API errors in a standardized format
 * 
 * @param {Error} error - The error object
 * @param {string} context - Context information
 * @param {Object} metadata - Additional metadata to log
 */
export function logApiError(error, context = '', metadata = {}) {
    const errorObj = createApiError(error, context);
    
    console.error('API Error:', {
        ...errorObj,
        ...metadata
    });

    // In production, you might want to send this to an error tracking service
    if (typeof window !== 'undefined' && window.logger) {
        window.logger.error(errorObj.message, errorObj);
    }
}

/**
 * Fetches data from an API with error handling
 * 
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options
 * @param {Object} errorHandlingOptions - Error handling options
 * @returns {Promise<Object>} The response data
 */
export async function fetchWithErrorHandling(url, options = {}, errorHandlingOptions = {}) {
    return withErrorHandling(async () => {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.response = response;
            throw error;
        }

        return response.json();
    }, errorHandlingOptions);
}
