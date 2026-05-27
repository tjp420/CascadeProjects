// Debug API Client
console.log('🔍 Debug: API Client Debug Script Loaded');

// Check if apiClient is defined
if (typeof apiClient === 'undefined') {
    console.error('❌ Debug: apiClient is undefined');
} else {
    console.log('✅ Debug: apiClient is defined');
    console.log('🔍 Debug: apiClient.baseUrl:', apiClient.baseUrl);
    console.log('🔍 Debug: apiClient constructor:', apiClient.constructor.name);
    
    // Test basic API connectivity
    (async () => {
        try {
            console.log('🔄 Debug: Testing API connection...');
            const response = await apiClient.getHealth();
            console.log('✅ Debug: API health check successful:', response);
        } catch (error) {
            console.error('❌ Debug: API health check failed:', error);
        }
    })();
}

// Check if window.apiClient exists
if (typeof window.apiClient === 'undefined') {
    console.error('❌ Debug: window.apiClient is undefined');
} else {
    console.log('✅ Debug: window.apiClient is defined');
    console.log('🔍 Debug: window.apiClient.baseUrl:', window.apiClient.baseUrl);
}

// Check for any authentication errors
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('fetch')) {
        console.error('❌ Debug: Network error detected:', event.message);
    }
});

// Log all fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
    console.log('🔍 Debug: Fetch request to:', args[0]);
    return originalFetch.apply(this, args).catch(error => {
        console.error('❌ Debug: Fetch failed:', error);
        throw error;
    });
};

console.log('🔍 Debug: Debug script setup complete');
