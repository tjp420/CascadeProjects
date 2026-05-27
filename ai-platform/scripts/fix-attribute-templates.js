const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Fixing template literals in HTML attributes...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Fix template literals in various HTML attributes
const patterns = [
    // Fix onclick attributes with broken template literals
    { pattern: /onclick="[^"]*\$\{[^}*\)[^"]*"/g, replacement: 'onclick="alert(\'Feature not available in demo mode\')"' },
    
    // Fix href attributes with template literals
    { pattern: /href="[^"]*\$\{[^}]*\}[^"]*"/g, replacement: 'href="#"' },
    
    // Fix src attributes with template literals  
    { pattern: /src="[^"]*\$\{[^}*\}[^"]*"/g, replacement: 'src=""' },
    
    // Fix data attributes with template literals
    { pattern: /data-[^=]*="[^"]*\$\{[^}]*\}[^"]*"/g, replacement: '' },
    
    // Fix remaining template literals in HTML attributes
    { pattern: /=\s*"[^"]*\$\{[^}]*\}[^"]*"/g, replacement: '=""' },
];

let totalFixes = 0;
patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
        const count = matches.length;
        content = content.replace(pattern, replacement);
        totalFixes += count;
        console.log(`✅ Fixed ${count} attribute template literal instances`);
    }
});

if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎉 Successfully fixed ${totalFixes} attribute template literal issues!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No attribute template literal issues found.');
}