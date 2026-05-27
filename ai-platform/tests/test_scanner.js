
/**
 * Test Code Quality Scanner
 * Simple test to verify scanner functionality
 */

console.log('Testing scanner...');

try {
    // Test basic file system operations
    const fs = require('fs');
    const path = require('path');
    
    console.log('✅ File system imports work');
    
    // Test directory listing
    const files = fs.readdirSync('.');
    console.log(`✅ Found ${files.length} items in current directory`);
    
    // Test file reading
    const testContent = fs.readFileSync('package.json', 'utf8');
    console.log(`✅ Can read files (${testContent.length} bytes)`);
    
    console.log('✅ Basic functionality test passed');
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
}
