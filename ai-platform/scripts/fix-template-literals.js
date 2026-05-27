const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../web/index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Fix template literals that are missing closing braces
const fixes = [
    // Fix onclick handlers with missing closing braces
    { pattern: /\$\{issue\.id\}/g, replacement: '${issue.id}' },
    { pattern: /\$\{issue\.priority\}/g, replacement: '${issue.priority}' },
    { pattern: /\$\{issue\.type\}/g, replacement: '${issue.type}' },
    { pattern: /\$\{issue\.created\}/g, replacement: '${issue.created}' },
    // Fix other common template literals
    { pattern: /\$\{data\.metrics\.codeQuality%/g, replacement: '${data.metrics.codeQuality}%' },
    { pattern: /\$\{data\.metrics\.testCoverage%/g, replacement: '${data.metrics.testCoverage}%' },
    { pattern: /\$\{data\.metrics\.maintainability%/g, replacement: '${data.metrics.maintainability}%' },
    { pattern: /\$\{Math\.max\(0, 100 - \(data\.metrics\.complexity \/ 100\) \* 100\)%/g, replacement: '${Math.max(0, 100 - (data.metrics.complexity / 100) * 100)}%' },
    { pattern: /\$\{Math\.max\(0, 100 - data\.metrics\.duplication \* 10\)%/g, replacement: '${Math.max(0, 100 - data.metrics.duplication * 10)}%' },
    { pattern: /\$\{message\}/g, replacement: '${message}' },
    { pattern: /\$\{reportType\}/g, replacement: '${reportType}' },
    { pattern: /\$\{fileName\}/g, replacement: '${fileName}' },
    { pattern: /\$\{cell\}/g, replacement: '${cell}' },
    { pattern: /\$\{csvString\}/g, replacement: '${csvString}' },
    { pattern: /\$\{scheduleType\}/g, replacement: '${scheduleType}' },
    { pattern: /\$\{duration\}/g, replacement: '${duration}' },
    { pattern: /\$\{id\}/g, replacement: '${id}' },
    { pattern: /\$\{securityScore\}/g, replacement: '${securityScore}' },
    { pattern: /\$\{criticalVulns\}/g, replacement: '${criticalVulns}' },
    { pattern: /\$\{highVulns\}/g, replacement: '${highVulns}' },
    { pattern: /\$\{mediumVulns\}/g, replacement: '${mediumVulns}' },
    { pattern: /\$\{lowVulns\}/g, replacement: '${lowVulns}' },
    { pattern: /\$\{vuln\.title\}/g, replacement: '${vuln.title}' },
    { pattern: /\$\{vuln\.severity\}/g, replacement: '${vuln.severity}' },
    { pattern: /\$\{vuln\.description\}/g, replacement: '${vuln.description}' },
    { pattern: /\$\{vuln\.file\}/g, replacement: '${vuln.file}' },
    { pattern: /\$\{vuln\.line\}/g, replacement: '${vuln.line}' },
    { pattern: /\$\{vuln\.recommendation\}/g, replacement: '${vuln.recommendation}' },
    { pattern: /\$\{overallScore\}/g, replacement: '${overallScore}' },
];

let fixesApplied = 0;
fixes.forEach(({ pattern, replacement }) => {
    const matches = htmlContent.match(pattern);
    if (matches) {
        htmlContent = htmlContent.replace(pattern, replacement);
        fixesApplied += matches.length;
        console.log(`✓ Fixed pattern: ${pattern}`);
    }
});

if (fixesApplied > 0) {
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log(`✓ Applied ${fixesApplied} template literal fixes`);
} else {
    console.log('No matching patterns found');
}