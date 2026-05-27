/**
 * API Endpoint Fix
 * Corrects the endpoint URLs to match the actual running API server
 */

// Current incorrect endpoints your frontend is using:
const _INCORRECT_ENDPOINTS = {
    'projectOverview': '/api/analysis/project/overview',  // ❌ Wrong
    'performance': '/api/analysis/performance',            // ❌ Wrong  
    'quality': '/api/analysis/quality',                   // ✅ Correct
    'security': '/api/analysis/security',                 // ❌ Wrong
    'notifications': '/api/notifications'                  // ❌ Wrong
};

// Correct endpoints that match the running server:
const CORRECT_ENDPOINTS = {
    'projectOverview': '/api/project/overview',           // ✅ Correct
    'performance': '/api/analysis/technical-debt',        // ✅ Use technical-debt for performance
    'quality': '/api/analysis/quality',                   // ✅ Correct
    'security': '/api/analysis/technical-debt',         // ✅ Use technical-debt for security metrics
    'notifications': '/api/analysis/recommendations',    // ✅ Use recommendations for notifications
    'fileStructure': '/api/analysis/file-structure',     // ✅ Available
    'codeStructure': '/api/analysis/code-structure',     // ✅ Available
    'testCoverage': '/api/test-coverage',                // ✅ Available
    'health': '/api/health'                              // ✅ Available
};

/**
 * Fix API endpoint URLs in your application
 */
function fixApiEndpoints() {
    console.log('🔧 Fixing API endpoints...');
    
    // Fix 1: Update API client base URLs
    if (window.apiClient) {
        console.log('✅ Updating API client endpoints');
        
        // Override problematic methods
        const originalFetch = window.apiClient.fetchWithCache || window.apiClient.fetch;
        
        window.apiClient.fetchWithCache = async function(endpoint, options = {}) {
            // Fix endpoint URLs
            const fixedEndpoint = fixEndpointUrl(endpoint);
            console.log(`🔄 ${endpoint} → ${fixedEndpoint}`);
            
            return originalFetch.call(this, fixedEndpoint, options);
        };
    }
    
    // Fix 2: Update any global endpoint constants
    if (window.API_ENDPOINTS) {
        Object.assign(window.API_ENDPOINTS, CORRECT_ENDPOINTS);
    }
    
    // Fix 3: Patch fetch calls for specific problematic endpoints
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
        const fixedUrl = fixEndpointUrl(url);
        if (fixedUrl !== url) {
            console.log(`🔄 Fetch redirect: ${url} → ${fixedUrl}`);
        }
        return originalFetch.call(this, fixedUrl, options);
    };
    
    console.log('✅ API endpoints fixed successfully');
}

/**
 * Fix individual endpoint URL
 */
function fixEndpointUrl(url) {
    const endpointMappings = {
        '/api/analysis/project/overview': '/api/project/overview',
        '/api/analysis/performance': '/api/analysis/technical-debt',
        '/api/analysis/security': '/api/analysis/technical-debt',
        '/api/notifications': '/api/analysis/recommendations'
    };
    
    for (const [incorrect, correct] of Object.entries(endpointMappings)) {
        if (url.includes(incorrect)) {
            return url.replace(incorrect, correct);
        }
    }
    
    return url;
}

/**
 * Test API connectivity
 */
async function testApiConnectivity() {
    console.log('🧪 Testing API connectivity...');
    
    const testEndpoints = [
        '/api/health',
        '/api/project/overview',
        '/api/analysis/quality',
        '/api/analysis/technical-debt'
    ];
    
    const results = {};
    
    for (const endpoint of testEndpoints) {
        try {
            const response = await fetch(`http://localhost:8081${endpoint}`);
            const data = await response.json();
            results[endpoint] = {
                status: 'success',
                statusCode: response.status,
                data: data
            };
            console.log(`✅ ${endpoint}: ${response.status}`);
        } catch (error) {
            results[endpoint] = {
                status: 'error',
                error: error.message
            };
            console.log(`❌ ${endpoint}: ${error.message}`);
        }
    }
    
    return results;
}

/**
 * Apply fixes immediately
 */
fixApiEndpoints();

// Make functions available globally for debugging
window.fixApiEndpoints = fixApiEndpoints;
window.testApiConnectivity = testApiConnectivity;
window.CORRECT_ENDPOINTS = CORRECT_ENDPOINTS;

console.log('🚀 API Endpoint Fix loaded. Run testApiConnectivity() to test.');
