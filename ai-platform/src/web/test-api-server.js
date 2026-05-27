/**
 * Test API Server Connection
 * Tests if the API server is responding correctly
 */

async function testAPIServer() {
    console.log('🔍 Testing API Server Connection...');
    
    try {
        // Test the specific endpoint that's failing
        const response = await fetch('http://localhost:8081/api/project/overview?directory=./', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API Server Response:', data);
            return { success: true, data };
        } else {
            console.log('❌ API Server Error:', response.status, response.statusText);
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
    } catch (error) {
        console.error('❌ Connection Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Test the connection
testAPIServer().then(result => {
    if (result.success) {
        console.log('🎉 API Server is working correctly!');
        console.log('📊 Response Data:', result.data);
    } else {
        console.log('❌ API Server connection failed:', result.error);
    }
});
