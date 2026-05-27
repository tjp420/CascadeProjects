/**
 * Test script to verify generateMockDataReport function accessibility
 */

console.log('Testing function accessibility...');

// Test if we can access the function from the global scope
setTimeout(() => {
    if (typeof generateMockDataReport === 'function') {
        console.log('✅ generateMockDataReport is accessible');
        
        // Test calling the function (it should not throw an error)
        try {
            generateMockDataReport();
            console.log('✅ Function executed successfully');
        } catch (error) {
            console.error('❌ Function execution failed:', error.message);
        }
    } else {
        console.error('❌ generateMockDataReport is not accessible');
        console.log('Available functions:', Object.keys(window).filter(key => typeof window[key] === 'function'));
    }
}, 1000);
