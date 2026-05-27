// Simple CommonJS test for scanner fix
console.log('🧪 Testing scanner fix...');

// Load the scanner (simulate browser environment)
global.window = global;
global.File = class File {
    constructor(content, name) {
        this.content = content;
        this.name = name;
        this.size = content.length;
    }
};

global.FileReader = class FileReader {
    constructor() {
        this.onload = null;
        this.onerror = null;
    }
    
    readAsText(file) {
        setTimeout(() => {
            if (this.onload) {
                this.onload({ target: { result: file.content } });
            }
        }, 0);
    }
};

// Import and test the scanner
const path = require('path');

try {
    const MockDataScanner = require('./mock_data_scanner.js');
    const scanner = new MockDataScanner();
    console.log('✅ Scanner instance created');
    
    // Test the aggregateResults method directly
    console.log('📊 Testing aggregateResults method...');
    
    // Simulate some results
    scanner.results = [
        {
            filename: 'test.js',
            findings: {
                'TODO Comments': { count: 2, examples: ['// TODO: implement'], severity: 'medium' }
            },
            totalFindings: 2,
            error: null
        }
    ];
    
    const aggregated = scanner.aggregateResults();
    
    console.log('✅ aggregateResults completed');
    
    // Validate results
    if (!aggregated || !aggregated.summary) {
        console.error('❌ Summary object missing');
        process.exit(1);
    }
    
    console.log('✅ Summary object found');
    
    const requiredFields = ['totalFiles', 'totalMatches', 'filesWithFindings', 'healthScore', 'healthGrade', 'healthStatus'];
    let allFieldsPresent = true;
    
    for (const field of requiredFields) {
        if (typeof aggregated.summary[field] === 'undefined') {
            console.error(`❌ Missing field: summary.${field}`);
            allFieldsPresent = false;
        } else {
            console.log(`✅ Field present: summary.${field} = ${aggregated.summary[field]}`);
        }
    }
    
    if (allFieldsPresent) {
        console.log('🎉 ALL REQUIRED FIELDS PRESENT - Scanner fix successful!');
    }
    
    // Check additional fields
    const additionalFields = ['categories', 'severity', 'topFiles'];
    for (const field of additionalFields) {
        if (aggregated[field]) {
            console.log(`✅ Additional field present: ${field}`);
        } else {
            console.log(`⚠️ Additional field missing: ${field}`);
        }
    }
    
    console.log('\n📊 Summary:');
    console.log(JSON.stringify(aggregated.summary, null, 2));
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
}
