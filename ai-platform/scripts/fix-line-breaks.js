const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Fixing unescaped line breaks in string literals...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Fix common patterns that cause unescaped line breaks
const patterns = [
    // Fix template literals with unescaped line breaks
    { pattern: /`[^`]*\n[^`]*`/g, replacement: (match) => match.replace(/\n/g, '\\n') },
    
    // Fix string literals with unescaped line breaks  
    { pattern: /'[^']*\n[^']*'/g, replacement: (match) => match.replace(/\n/g, '\\n') },
    
    // Fix double-quoted string literals with unescaped line breaks
    { pattern: /"[^"]*\n[^"]*"/g, replacement: (match) => match.replace(/\n/g, '\\n') },
];

let totalFixes = 0;
patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
        const count = matches.length;
        content = content.replace(pattern, replacement);
        totalFixes += count;
        console.log(`✅ Fixed ${count} string literals with unescaped line breaks`);
    }
});

if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎉 Successfully fixed ${totalFixes} string literal issues!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No string literal issues found.');
}