const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../web/index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Fix the API client fallback methods by adding missing closing braces and catch blocks
const methodFixes = [
    {
        pattern: /async getQualityMetrics\(\) \{\s+try \{\s+const response = await fetch\(`\$\{this\.baseUrl\}\/api\/analysis\/quality`\);\s+if \(!response\.ok\) throw new Error\('API call failed'\);\s+return response\.json\(\);/g,
        replacement: `async getQualityMetrics() {
                    try {
                        const response = await fetch(\`\${this.baseUrl}/api/analysis/quality\`);
                        if (!response.ok) throw new Error('API call failed');
                        return response.json();
                    } catch (error) {
                        console.error('Quality metrics error:', error);
                        return null;
                    }
                },`
    },
    {
        pattern: /async getTechnicalDebt\(\) \{\s+try \{\s+const response = await fetch\(`\$\{this\.baseUrl\}\/api\/analysis\/technical-debt`\);\s+if \(!response\.ok\) throw new Error\('API call failed'\);\s+return response\.json\(\);/g,
        replacement: `async getTechnicalDebt() {
                    try {
                        const response = await fetch(\`\${this.baseUrl}/api/analysis/technical-debt\`);
                        if (!response.ok) throw new Error('API call failed');
                        return response.json();
                    } catch (error) {
                        console.error('Technical debt error:', error);
                        return null;
                    }
                },`
    },
    {
        pattern: /async getPerformanceMetrics\(\) \{\s+try \{\s+const response = await fetch\(`\$\{this\.baseUrl\}\/api\/analysis\/performance`\);\s+if \(!response\.ok\) throw new Error\('API call failed'\);\s+return response\.json\(\);/g,
        replacement: `async getPerformanceMetrics() {
                    try {
                        const response = await fetch(\`\${this.baseUrl}/api/analysis/performance\`);
                        if (!response.ok) throw new Error('API call failed');
                        return response.json();
                    } catch (error) {
                        console.error('Performance metrics error:', error);
                        return null;
                    }
                },`
    },
    {
        pattern: /async getSecurityAnalysis\(\) \{\s+try \{\s+const response = await fetch\(`\$\{this\.baseUrl\}\/api\/analysis\/security`\);\s+if \(!response\.ok\) throw new Error\('API call failed'\);\s+return response\.json\(\);/g,
        replacement: `async getSecurityAnalysis() {
                    try {
                        const response = await fetch(\`\${this.baseUrl}/api/analysis/security\`);
                        if (!response.ok) throw new Error('API call failed');
                        return response.json();
                    } catch (error) {
                        console.error('Security analysis error:', error);
                        return null;
                    }
                },`
    },
    {
        pattern: /async getCodeStructure\(\) \{\s+try \{\s+const response = await fetch\(`\$\{this\.baseUrl\}\/api\/analysis\/code-structure`\);\s+if \(!response\.ok\) throw new Error\('API call failed'\);\s+return response\.json\(\);/g,
        replacement: `async getCodeStructure() {
                    try {
                        const response = await fetch(\`\${this.baseUrl}/api/analysis/code-structure\`);
                        if (!response.ok) throw new Error('API call failed');
                        return response.json();
                    } catch (error) {
                        console.error('Code structure error:', error);
                        return null;
                    }
                },`
    }
];

let fixesApplied = 0;
methodFixes.forEach(({ pattern, replacement }) => {
    const matches = htmlContent.match(pattern);
    if (matches) {
        htmlContent = htmlContent.replace(pattern, replacement);
        fixesApplied++;
        console.log(`✓ Fixed method pattern`);
    }
});

if (fixesApplied > 0) {
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log(`✓ Applied ${fixesApplied} fixes to API client fallback`);
} else {
    console.log('No matching patterns found to fix');
}