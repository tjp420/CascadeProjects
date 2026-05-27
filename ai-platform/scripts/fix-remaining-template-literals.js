const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Fixing remaining template literal syntax errors...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Fix complex template literal patterns
const fixes = [
    // Fix Math expressions ending with %
    { pattern: /\$\{Math\.max\(0, 100 - \(data\.metrics\.complexity \/ 100\) \* 100\)%/g, replacement: '${Math.max(0, 100 - (data.metrics.complexity / 100) * 100)}%' },
    { pattern: /\$\{Math\.max\(0, 100 - data\.metrics\.duplication \* 10\)%/g, replacement: '${Math.max(0, 100 - data.metrics.duplication * 10)}%' },
    { pattern: /\$\{Math\.max\(80, data\.metrics\.testCoverage \+ 15\)%/g, replacement: '${Math.max(80, data.metrics.testCoverage + 15)}%' },
    { pattern: /\$\{Math\.round\(percentage\)%/g, replacement: '${Math.round(percentage)}%' },
    
    // Fix array join patterns ending with %
    { pattern: /\$\{data\.trends\.codeQuality\.join\(' → '\)%/g, replacement: '${data.trends.codeQuality.join(\' → \')}%' },
    { pattern: /\$\{data\.trends\.testCoverage\.join\(' → '\)%/g, replacement: '${data.trends.testCoverage.join(\' → \')}%' },
    
    // Fix direction pattern
    { pattern: /\$\{directio}n\}/g, replacement: '${direction}' },
    
    // Fix general pattern of ${expression}% where expression contains operators
    { pattern: /\$\{([^}]*[+\-*/][^}]*)\}%/g, replacement: '${$1}%' },
];

let totalFixes = 0;
fixes.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
        const count = matches.length;
        content = content.replace(pattern, replacement);
        totalFixes += count;
        console.log(`✅ Fixed ${count} instances of complex pattern`);
    }
});

if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎉 Successfully fixed ${totalFixes} additional template literal syntax errors!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No additional template literal syntax errors found.');
}