const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Fixing double closing braces in template literals...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Fix double closing braces that were incorrectly added
const replacements = [
    { from: '}}%', to: '}%' },
    { from: '}}\\n', to: '}\\n' },
    { from: '}}\n', to: '}\n' },
    { from: '}}`', to: '`' },
    { from: '}};', to: '};' },
    { from: '.}}', to: '}' },
    { from: '}}.split', to: '}.split' },
    { from: '}}.', to: '}.' },
];

let totalFixes = 0;
replacements.forEach(({ from, to }) => {
    const count = (content.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count > 0) {
        content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
        totalFixes += count;
        console.log(`✅ Fixed ${count} instances of "${from}"`);
    }
});

if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n🎉 Successfully fixed ${totalFixes} double brace issues!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No double brace issues found.');
}