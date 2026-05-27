/**
 * Fix Frontend Scanner Integration
 * Updates the frontend to use the browser-compatible MockDataScanner
 */

// Fix the MockDataScanner import to use browser-compatible version
function fixMockDataScanner() {
    // Remove the problematic Node.js import
    const scriptTags = document.querySelectorAll('script[type="module"]');
    
    scriptTags.forEach(script => {
        if (script.src && script.src.includes('mock-data-scanner.js')) {
            // Replace with browser-compatible version
            script.src = 'browser-mock-scanner.js';
            console.log('✅ Updated mock-data-scanner.js import to browser version');
        }
    });
    
    // Also update the global MockDataScanner if it exists
    if (window.MockDataScanner && window.MockDataScanner.MockDataScanner) {
        // Replace with browser version
        window.MockDataScanner = window.BrowserMockScanner;
        console.log('✅ Updated global MockDataScanner to browser version');
    }
    
    // Create a simple scanSelectedFiles function if it doesn't exist
    if (typeof window.scanSelectedFiles === 'undefined') {
        window.scanSelectedFiles = async function(files, progressCallback) {
            console.log('🔍 Using browser-compatible scanSelectedFiles function');
            
            if (!window.BrowserMockScanner) {
                console.error('❌ BrowserMockScanner not available');
                throw new Error('MockDataScanner is not defined');
            }
            
            const scanner = new window.BrowserMockScanner();
            return await scanner.scanFiles(files, progressCallback);
        };
        console.log('✅ Created browser-compatible scanSelectedFiles function');
    }
}

// Auto-fix when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixMockDataScanner);
} else {
    fixMockDataScanner();
}

// Export for use
if (typeof window !== 'undefined') {
    window.fixMockDataScanner = fixMockDataScanner;
}

// Also export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = fixMockDataScanner;
}
