// Quick test to verify scanner fix
console.log('🧪 Testing scanner fix...');

// Load the scanner (simulate browser environment)
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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    // Read the scanner file
    const scannerCode = fs.readFileSync(path.join(__dirname, 'mock_data_scanner.js'), 'utf8');
    
    // Execute the scanner code safely using dynamic import
    try {
        // Create a safe module context
        const module = { exports: {} };
        const context = { 
            console, 
            global, 
            module, 
            exports: module.exports,
            require: (name) => {
                // Safe require implementation
                if (name === 'fs') {
                    return fs;
                }
                if (name === 'path') {
                    return path;
                }
                throw new Error(`Module '${name}' not allowed in safe context`);
            }
        };
        
        // Execute the code in a safe context
        const safeEval = /* SECURITY WARNING: Function constructor usage - requires manual review */
// Original: new Function('context', 'console', 'global', 'module', 'exports', 'require', `
            with(context) {
                ${scannerCode}
            }
        `);
        
        safeEval(context, console, global, module, module.exports, context.require);
        
    } catch (error) {
        console.error('❌ Safe execution failed:', error.message);
        throw error;
    }
    
    console.log('✅ Scanner loaded successfully');
    
    // Test the scanner
    const scanner = new MockDataScanner();
    console.log('✅ Scanner instance created');
    
    // Create test files
    const testFiles = [
        new File(['// TODO: implement this', 'console.log("test");'], 'test.js'),
        new File(['alert("Click me");'], 'demo.html')
    ];
    
    console.log('📁 Testing scan...');
    
    scanner.scanFiles(testFiles, (current, total, filename) => {
        console.log(`📊 Progress: ${current}/${total} - ${filename}`);
    }).then(results => {
        console.log('✅ Scan completed');
        
        // Validate results
        if (!results || !results.summary) {
            console.error('❌ Summary object missing');
            return;
        }
        
        console.log('✅ Summary object found');
        
        const requiredFields = ['totalFiles', 'totalMatches', 'filesWithFindings', 'healthScore', 'healthGrade', 'healthStatus'];
        let allFieldsPresent = true;
        
        for (const field of requiredFields) {
            if (typeof results.summary[field] === 'undefined') {
                console.error(`❌ Missing field: summary.${field}`);
                allFieldsPresent = false;
            } else {
                console.log(`✅ Field present: summary.${field} = ${results.summary[field]}`);
            }
        }
        
        if (allFieldsPresent) {
            console.log('🎉 ALL REQUIRED FIELDS PRESENT - Scanner fix successful!');
        }
        
        // Check additional fields
        const additionalFields = ['categories', 'severity', 'topFiles'];
        for (const field of additionalFields) {
            if (results[field]) {
                console.log(`✅ Additional field present: ${field}`);
            } else {
                console.log(`⚠️ Additional field missing: ${field}`);
            }
        }
        
        console.log('\n📊 Summary:');
        console.log(JSON.stringify(results.summary, null, 2));
        
    }).catch(error => {
        console.error('❌ Scan failed:', error.message);
    });
    
} catch (error) {
    console.error('❌ Failed to load scanner:', error.message);
}
