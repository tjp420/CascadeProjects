const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../web/index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Find and remove the malformed API client content between the comment and the next RoadmapBuilder fallback
const malformedSection = /<!-- RoadmapBuilder fallback \(create early to prevent timing issues\) -->[\s\S]*?async login\(username, password\) \{[\s\S]*?isAuthenticated: true;;/g;

if (malformedSection.test(htmlContent)) {
    htmlContent = htmlContent.replace(malformedSection, '');
    console.log('✓ Removed malformed API client section');
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
} else {
    console.log('Pattern not found');
}