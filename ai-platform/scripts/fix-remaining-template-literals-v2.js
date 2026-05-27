const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Fixing remaining template literal errors...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Fix specific patterns that are causing lint errors
const patterns = [
    // Fix broken percentage patterns
    { pattern: /\$\{([^}]*\+ 15)%/g, replacement: '${$1 + 15)%' },
    { pattern: /\$\{([^}]*percentage)%/g, replacement: '${$1percentage}%' },
    
    // Fix broken variable names with misplaced characters
    { pattern: /\$\{([^}]*\.value)%`\);/g, replacement: '${$1.value}%`);' },
    { pattern: /\$\{([^}]*\.value)%`/g, replacement: '${$1.value}%`' },
    
    // Fix broken template literals in general
    { pattern: /\$\{([^}]*)%`\);/g, replacement: '${$1}%`);' },
    { pattern: /\$\{([^}]*)%`/g, replacement: '${$1}%`' },
    
    // Fix broken patterns with missing closing braces
    { pattern: /\$\{([^}]*)\}%/g, replacement: '${$1}%' },
];

let totalFixes = 0;
patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
        const count = matches.length;
        content = content.replace(pattern, replacement);
        totalFixes += count;
        console.log(`✅ Fixed ${count} instances of pattern`);
    }
});

if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎉 Successfully fixed ${totalFixes} template literal errors!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No template literal errors found.');
}