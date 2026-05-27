/**
 * Test script to verify server functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing AI Coding Intelligence Dashboard Server Setup...\n');

// Check if required files exist
const requiredFiles = [
    'index.html',
    'documentation_portal.html',
    'server.js',
    'simple_server.py',
    'start_server.bat'
];

console.log('📁 Checking required files:');
let allFilesExist = true;

requiredFiles.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, file));
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) {
        allFilesExist = false;
    }
});

if (!allFilesExist) {
    console.log('\n❌ Some required files are missing');
    process.exit(1);
}

console.log('\n✅ All required files present');

// Check Node.js version
const nodeVersion = process.version;
console.log(`\n🟢 Node.js version: ${nodeVersion}`);

// Check if dashboard components exist
console.log('\n📊 Checking dashboard components:');
const componentsDir = path.join(__dirname, 'dashboard_components', 'core');
if (fs.existsSync(componentsDir)) {
    const components = fs.readdirSync(componentsDir);
    console.log(`  ✅ Found ${components.length} core components`);
    components.slice(0, 5).forEach(comp => console.log(`    - ${comp}`));
    if (components.length > 5) {
        console.log(`    ... and ${components.length - 5} more`);
    }
} else {
    console.log('  ❌ Dashboard components directory not found');
}

// Check documentation files
console.log('\n📚 Checking documentation files:');
const docFiles = [
    'API_DOCUMENTATION.md',
    'CODE_DOCUMENTATION.md',
    'DEVELOPER_GUIDE.md'
];

docFiles.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, file));
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

console.log('\n🎯 Server Setup Instructions:');
console.log('1. Run start_server.bat and choose option 1 (Python) or 2 (Node.js)');
console.log('2. Open http://localhost:8000 in your browser');
console.log('3. Access the dashboard at http://localhost:8000/index.html');
console.log('4. Access documentation at http://localhost:8000/documentation_portal.html');

console.log('\n✅ Server setup test completed successfully!');
console.log('\n🚀 Ready to start the dashboard server!');
