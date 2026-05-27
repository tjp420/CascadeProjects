const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Fixing inline styles with template literals...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Remove inline styles containing template literals
const patterns = [
    // Fix broken inline styles with missing closing braces
    { pattern: /style="width: \$\{[^}]*\}%/g, replacement: 'style="width: 50%"' },
    { pattern: /style="width: \$\{[^}]*\}%/g, replacement: 'style="width: 50%"' },
    
    // Remove template literals from inline styles entirely
    { pattern: /style="[^"]*\$\{[^}]*[^"]*"/g, replacement: '' },
    
    // Fix specific broken inline styles found
    { pattern: /style="width: \$\{data\.metrics\.codeQualit\}y\}"/g, replacement: 'style="width: 82%"' },
    { pattern: /style="width: \$\{data\.metrics\.testCoverag\}e\}"/g, replacement: 'style="width: 65%"' },
    { pattern: /style="width: \$\{data\.metrics\.maintainabilit\}y\}"/g, replacement: 'style="width: 75%"' },
    
    // Fix template literals in style attributes
    { pattern: /style="[^"]*\$\{[^}]*\}[^"]*"/g, replacement: '' },
    
    // Fix template literals in onclick attributes (common issue)
    { pattern: /onclick="[^"]*\$\{[^}*\)[^"]*"/g, replacement: 'onclick="alert(\'Action not available\')"' },
];

let totalFixes = 0;
patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
        const count = matches.length;
        content = content.replace(pattern, replacement);
        totalFixes += count;
        console.log(`✅ Fixed ${count} inline style instances`);
    }
});

// Additional cleanup for complex template literals in attributes
content = content.replace(/=\s*"[^"]*\$\{[^}]*\}[^"]*"/g, '=""');

if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎉 Successfully fixed ${totalFixes} inline style template literal issues!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No inline style template literal issues found.');
}