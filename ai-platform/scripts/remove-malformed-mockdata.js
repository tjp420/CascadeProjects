const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../web/index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Remove the malformed MockDataScanner content between the new simple version and the next script
const malformedSection = /console\.log\('✅ Simple MockDataScanner fallback created'\);[\s\S]*?console\.log\('🔧 Creating immediate MockDataScanner fallback\.\.\.'\);[\s\S]*?console\.log\('✅ Immediate MockDataScanner fallback created'\);/g;

if (malformedSection.test(htmlContent)) {
    htmlContent = htmlContent.replace(malformedSection, "console.log('✅ Simple MockDataScanner fallback created');");
    console.log('✓ Removed malformed MockDataScanner section');
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
} else {
    console.log('Pattern not found');
}