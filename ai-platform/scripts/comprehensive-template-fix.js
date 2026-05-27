const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Running comprehensive template literal fix...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Fix all broken template literal patterns
const patterns = [
    // Fix missing closing braces before percentage signs
    { pattern: /\$\{([^}]*)\}%/g, replacement: '${$1}%' },
    { pattern: /\$\{([^}]*)\)/g, replacement: '${$1}' },
    
    // Fix broken template literals with missing closing brace
    { pattern: /\$\{([^}]*)\}/g, replacement: '${$1}' },
    
    // Fix template literals with incorrect syntax
    { pattern: /\$\{([^}]*)\}([)%])/g, replacement: '${$1}$2' },
    
    // Fix malformed template literals
    { pattern: /\$\{[^}]*\}([)%])/g, replacement: '$1' },
];

let totalFixes = 0;
patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
        const count = matches.length;
        content = content.replace(pattern, replacement);
        totalFixes += count;
        console.log(`✅ Fixed ${count} template literal instances`);
    }
});

if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎉 Successfully fixed ${totalFixes} template literal issues!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No template literal issues found.');
}