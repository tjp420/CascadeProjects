const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Fixing template literal syntax errors in index.html...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Fix template literal syntax errors where closing brace is missing before special characters
const fixes = [
    // Fix ${data.metrics.codeQuality%} -> ${data.metrics.codeQuality}%
    { pattern: /\$\{data\.metrics\.codeQuality%/g, replacement: '${data.metrics.codeQuality}%' },
    { pattern: /\$\{data\.metrics\.testCoverage%/g, replacement: '${data.metrics.testCoverage}%' },
    { pattern: /\$\{data\.metrics\.securityScore%/g, replacement: '${data.metrics.securityScore}%' },
    { pattern: /\$\{data\.metrics\.performance%/g, replacement: '${data.metrics.performance}%' },
    { pattern: /\$\{data\.metrics\.technicalDebt%/g, replacement: '${data.metrics.technicalDebt}%' },
    { pattern: /\$\{data\.metrics\.complexity%/g, replacement: '${data.metrics.complexity}%' },
    { pattern: /\$\{data\.metrics\.maintainability%/g, replacement: '${data.metrics.maintainability}%' },
    { pattern: /\$\{data\.metrics\.duplication%/g, replacement: '${data.metrics.duplication}%' },
    { pattern: /\$\{data\.metrics\.healthScore%/g, replacement: '${data.metrics.healthScore}%' },
    { pattern: /\$\{data\.metrics\.linesOfCode%/g, replacement: '${data.metrics.linesOfCode}%' },
    { pattern: /\$\{data\.metrics\.totalFiles%/g, replacement: '${data.metrics.totalFiles}%' },
    { pattern: /\$\{data\.metrics\.issues%/g, replacement: '${data.metrics.issues}%' },
    { pattern: /\$\{data\.metrics\.coverage%/g, replacement: '${data.metrics.coverage}%' },
    
    // Fix ${issue.id) -> ${issue.id}
    { pattern: /\$\{issue\.id\)/g, replacement: '${issue.id}' },
    { pattern: /\$\{issue\.title\)/g, replacement: '${issue.title}' },
    { pattern: /\$\{issue\.priority\)/g, replacement: '${issue.priority}' },
    { pattern: /\$\{issue\.type\)/g, replacement: '${issue.type}' },
    { pattern: /\$\{issue\.status\)/g, replacement: '${issue.status}' },
    { pattern: /\$\{issue\.severity\)/g, replacement: '${issue.severity}' },
    
    // Fix ${vuln.id) -> ${vuln.id}
    { pattern: /\$\{vuln\.id\)/g, replacement: '${vuln.id}' },
    { pattern: /\$\{vuln\.title\)/g, replacement: '${vuln.title}' },
    { pattern: /\$\{vuln\.severity\)/g, replacement: '${vuln.severity}' },
    { pattern: /\$\{vuln\.type\)/g, replacement: '${vuln.type}' },
    
    // Fix ${rec.id) -> ${rec.id}
    { pattern: /\$\{rec\.id\)/g, replacement: '${rec.id}' },
    { pattern: /\$\{rec\.priority\)/g, replacement: '${rec.priority}' },
    { pattern: /\$\{rec\.action\)/g, replacement: '${rec.action}' },
    
    // Fix ${result.title) -> ${result.title}
    { pattern: /\$\{result\.title\)/g, replacement: '${result.title}' },
    { pattern: /\$\{result\.changes\)/g, replacement: '${result.changes}' },
    
    // Fix general patterns with missing closing braces
    { pattern: /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\)/g, replacement: '${$1}' },
    { pattern: /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, replacement: '${$1}' },
    
    // Fix specific patterns from the user's code
    { pattern: /\$\{data\.metrics\.totalFiles- /g, replacement: '${data.metrics.totalFiles} - ' },
    { pattern: /\$\{data\.metrics\.codeQuality% \*\*/g, replacement: '${data.metrics.codeQuality}% **' },
    { pattern: /\$\{data\.metrics\.testCoverage% \*\*/g, replacement: '${data.metrics.testCoverage}% **' },
];

let totalFixes = 0;
fixes.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
        const count = matches.length;
        content = content.replace(pattern, replacement);
        totalFixes += count;
        console.log(`✅ Fixed ${count} instances of pattern: ${pattern}`);
    }
});

// Additional fix for complex template literal issues
content = content.replace(/\$\{([^}]*)([^}])\}/g, '${$1}$2}');

if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎉 Successfully fixed ${totalFixes} template literal syntax errors!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No template literal syntax errors found to fix.');
}