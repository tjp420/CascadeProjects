const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../web/index.html');

console.log('🔧 Running simple template literal fix...');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Simple string replacements for common broken patterns
const replacements = [
    // Fix missing closing braces before percentage
    { from: 'metrics.codeQuality%', to: 'metrics.codeQuality}%' },
    { from: 'metrics.testCoverage%', to: 'metrics.testCoverage}%' },
    { from: 'metrics.duplication%', to: 'metrics.duplication}%' },
    { from: 'metrics.errorRate%', to: 'metrics.errorRate}%' },
    { from: 'metrics.maintainability%', to: 'metrics.maintainability}%' },
    
    // Fix missing closing braces in common patterns
    { from: '.toLocaleString()', to: '.toLocaleString()}' },
    { from: '.toISOString()', to: '.toISOString()}' },
    { from: '.length\\n', to: '.length}\\n' },
    { from: '.length\n', to: '.length}\n' },
    { from: ".join('\\n')", to: ".join('\\n')}" },
    
    // Fix specific broken patterns found in the file
    { from: 'margin.left,${margin.top)', to: 'margin.left},${margin.top}' },
    { from: 'width - 150, 10)', to: 'width - 150, 10}' },
    { from: 'arc.centroid(d))', to: 'arc.centroid(d)}' },
    { from: 'arc.centroid(d)`;)', to: 'arc.centroid(d)});' },
    { from: 'd.data.value%', to: 'd.data.value}%' },
    { from: 'width/2 - 100, ${height - 30)', to: 'width/2 - 100, ${height - 30}' },
    { from: 'i * 40, 0)', to: 'i * 40, 0}' },
    { from: 'testCoverage% to', to: 'testCoverage}% to' },
    { from: 'mode-${mode', to: 'mode-${mode}' },
    
    // Fix filter and map function patterns
    { from: "filter(i => i.priority === 'high').length\\n", to: "filter(i => i.priority === 'high').length}\\n" },
    { from: "filter(i => i.priority === 'medium').length\\n", to: "filter(i => i.priority === 'medium').length}\\n" },
    { from: "filter(i => i.priority === 'low').length\\n\\n", to: "filter(i => i.priority === 'low').length}\\n\\n" },
    
    // Fix complex template literals in alerts and confirms
    { from: 'issue.id\\n\\nTitle: ${issue.title\\nDescription:', to: 'issue.id}\\n\\nTitle: ${issue.title}\\nDescription:' },
    { from: 'issue.description || \'No description\'\\nStatus:', to: 'issue.description || \'No description\'}\\nStatus:' },
    { from: 'issue.status\\nSeverity:', to: 'issue.status}\\nSeverity:' },
    { from: 'issue.severity\\nType:', to: 'issue.severity}\\nType:' },
    { from: 'issue.issue_type\\nCreated:', to: 'issue.issue_type}\\nCreated:' },
    { from: 'issue.labels ? issue.labels.join(\', \') : \'None\'`', to: 'issue.labels ? issue.labels.join(\', \') : \'None\'}\`' },
    
    // Fix progress text patterns
    { from: 'progress% - Step ${step/4', to: 'progress}% - Step ${step/4}' },
    { from: 'step-${i', to: 'step-${i}' },
    
    // Fix confirm dialog patterns
    { from: 'issueId: ${issue.title?`))', to: 'issueId}: ${issue.title}?`))' },
    { from: 'issueId: ${issue.title? This action cannot be undone.`))', to: 'issueId}: ${issue.title}? This action cannot be undone.`))' },
    
    // Fix download filename patterns
    { from: 'toISOString()}.split', to: 'toISOString()}.split' },
    { from: 'toISOString()}.split(\'T\')[0]', to: 'toISOString()}.split(\'T\')[0]' },
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
    console.log(`\n🎉 Successfully fixed ${totalFixes} template literal issues!`);
    console.log(`📝 File updated: ${filePath}`);
} else {
    console.log('ℹ️  No template literal issues found.');
}