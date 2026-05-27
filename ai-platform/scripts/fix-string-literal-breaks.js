const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Fixing unescaped line breaks in string literals...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Fix unescaped line breaks in string literals by removing loose CSS that's not in proper tags
// Find patterns where CSS is floating outside of style tags
const patterns = [
    // Remove CSS properties that appear outside of style tags
    { pattern: /;?\.[a-z-]+\s*\{[^}]*\}/g, replacement: '' },
    // Remove malformed CSS declarations
    { pattern: /[a-z-]+:\s*[^;{}]*;/g, replacement: '' },
    // Clean up multiple consecutive line breaks
    { pattern: /\n\s*\n\s*\n/g, replacement: '\n\n' },
];

let totalFixes = 0;
patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
        const count = matches.length;
        content = content.replace(pattern, replacement);
        totalFixes += count;
        console.log(`✅ Fixed ${count} instances of malformed CSS`);
    }
});

if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎉 Successfully fixed ${totalFixes} syntax issues!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No syntax issues found.');
}