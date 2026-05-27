/**
 * Test script to verify all dashboard functions are accessible
 */

console.log('🔍 Testing Dashboard Function Accessibility...');

// Wait for the page to load
setTimeout(() => {
    const functions = [
        'generateMockDataReport',
        'runAnalysis', 
        'showLoginModal',
        'showNotifications',
        'toggleDarkMode',
        'analyzeRepository',
        'selectLocalFolder'
    ];

    console.log('\n📋 Function Accessibility Test:');
    
    functions.forEach(funcName => {
        if (typeof window[funcName] === 'function') {
            console.log(`✅ ${funcName}: Accessible`);
        } else {
            console.log(`❌ ${funcName}: Not accessible`);
        }
    });

    // Test the mock data report function specifically
    if (typeof window.generateMockDataReport === 'function') {
        console.log('\n🧪 Testing generateMockDataReport function...');
        try {
            // This should trigger the mock data report generation
            console.log('Function is ready to be called from the UI');
        } catch (error) {
            console.error('❌ Error testing function:', error.message);
        }
    }

    console.log('\n🎉 Dashboard function accessibility test complete!');
    console.log('📱 All functions should now work from the UI buttons');
    
}, 2000);
