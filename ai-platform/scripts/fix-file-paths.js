const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Fixing file path references in index.html...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Fix CSS file paths
const cssFixes = [
    { from: 'href="dashboard_components/dashboard-ui-enhancements.css"', to: 'href="web/dashboard_components/dashboard-ui-enhancements.css"' },
    { from: 'href="dashboard_components/core/EventManagerEnhanced-standalone.css"', to: 'href="web/dashboard_components/core/EventManagerEnhanced-standalone.css"' },
];

// Fix JavaScript file paths
const jsFixes = [
    { from: 'src="dashboard_components/api-client.js"', to: 'src="web/dashboard_components/api-client.js"' },
    { from: 'src="dashboard_components/core/EventManagerEnhanced-standalone.js"', to: 'src="web/dashboard_components/core/EventManagerEnhanced-standalone.js"' },
];

const allFixes = [...cssFixes, ...jsFixes];

let totalFixes = 0;
allFixes.forEach(({ from, to }) => {
    if (content.includes(from)) {
        const count = (content.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
        totalFixes += count;
        console.log(`✅ Fixed ${count} references: ${from}`);
    }
});

if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎉 Successfully fixed ${totalFixes} file path references!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No file path issues found.');
}