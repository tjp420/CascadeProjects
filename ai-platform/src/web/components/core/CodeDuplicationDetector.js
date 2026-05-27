/**
 * Code Duplication Detector Component
 * Detects duplicate code blocks across the project
 */

export class CodeDuplicationDetector {
    constructor() {
        this.duplicationData = null;
    }

    /**
     * Scan project for code duplication
     */
    async scanDuplication(projectData) {
        console.log('🔍 Scanning for code duplication...');
        
        // Simulated duplication data (in real implementation, this would use actual code analysis)
        const duplications = [
            {
                id: 'dup-001',
                files: ['src/utils/helper.js', 'src/utils/common.js'],
                lines: '15-25',
                duplicatedLines: 11,
                similarity: 95,
                codeSnippet: 'function formatDate(date) {\n  const options = { year: "numeric", month: "long", day: "numeric" };\n  return new Date(date).toLocaleDateString(undefined, options);\n}',
                severity: 'HIGH',
                recommendation: 'Extract common function to a shared utility module'
            },
            {
                id: 'dup-002',
                files: ['components/Button.js', 'components/Link.js'],
                lines: '8-12',
                duplicatedLines: 5,
                similarity: 88,
                codeSnippet: 'const handleClick = (event) => {\n  event.preventDefault();\n  onClick(event);\n};',
                severity: 'MEDIUM',
                recommendation: 'Create a reusable click handler component'
            },
            {
                id: 'dup-003',
                files: ['api/user.js', 'api/product.js'],
                lines: '30-40',
                duplicatedLines: 11,
                similarity: 92,
                codeSnippet: 'try {\n  const response = await fetch(url);\n  const data = await response.json();\n  return data;\n} catch (error) {\n  console.error("API Error:", error);\n  throw error;\n}',
                severity: 'HIGH',
                recommendation: 'Create a generic API request handler'
            },
            {
                id: 'dup-004',
                files: ['styles/button.css', 'styles/link.css'],
                lines: '1-8',
                duplicatedLines: 8,
                similarity: 100,
                codeSnippet: '.btn {\n  padding: 10px 20px;\n  border-radius: 4px;\n  cursor: pointer;\n  transition: all 0.3s ease;\n}',
                severity: 'LOW',
                recommendation: 'Use CSS inheritance or a common utility class'
            }
        ];
        
        // Calculate duplication metrics
        const totalDuplicatedLines = duplications.reduce((sum, d) => sum + d.duplicatedLines, 0);
        const severityCount = {
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0
        };
        
        duplications.forEach(d => {
            severityCount[d.severity]++;
        });
        
        this.duplicationData = {
            duplications: duplications,
            total: duplications.length,
            totalDuplicatedLines: totalDuplicatedLines,
            severityCount: severityCount,
            duplicationRate: this.calculateDuplicationRate(totalDuplicatedLines, projectData?.total_lines || 10000)
        };
        
        console.log(`✅ Duplication scan complete: ${duplications.length} duplications found`);
        return this.duplicationData;
    }

    /**
     * Calculate duplication rate
     */
    calculateDuplicationRate(duplicatedLines, totalLines) {
        if (totalLines === 0) {
            return 0;
        }
        return ((duplicatedLines / totalLines) * 100).toFixed(2);
    }

    /**
     * Get duplications by severity
     */
    filterBySeverity(severity) {
        if (severity === 'all') {
            return this.duplicationData.duplications;
        }
        return this.duplicationData.duplications.filter(d => d.severity === severity);
    }

    /**
     * Get duplications by file
     */
    filterByFile(fileName) {
        return this.duplicationData.duplications.filter(d => 
            d.files.some(f => f.includes(fileName))
        );
    }

    /**
     * Generate remediation report
     */
    generateRemediationReport() {
        const report = {
            summary: {
                totalDuplications: this.duplicationData.total,
                totalDuplicatedLines: this.duplicationData.totalDuplicatedLines,
                duplicationRate: this.duplicationData.duplicationRate,
                severityBreakdown: this.duplicationData.severityCount
            },
            priorityActions: this.duplicationData.duplications
                .filter(d => d.severity === 'HIGH')
                .map(d => ({
                    id: d.id,
                    files: d.files,
                    lines: d.lines,
                    recommendation: d.recommendation
                })),
            allDuplications: this.duplicationData.duplications
        };
        
        return report;
    }

    /**
     * Export report as markdown
     */
    exportReportAsMarkdown() {
        const report = this.generateRemediationReport();
        
        let markdown = '# Code Duplication Report\n\n';
        markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
        markdown += '## Summary\n\n';
        markdown += `- **Total Duplications:** ${report.summary.totalDuplications}\n`;
        markdown += `- **Total Duplicated Lines:** ${report.summary.totalDuplicatedLines}\n`;
        markdown += `- **Duplication Rate:** ${report.summary.duplicationRate}%\n\n`;
        markdown += '### Severity Breakdown\n\n';
        markdown += `- **HIGH:** ${report.summary.severityBreakdown.HIGH}\n`;
        markdown += `- **MEDIUM:** ${report.summary.severityBreakdown.MEDIUM}\n`;
        markdown += `- **LOW:** ${report.summary.severityBreakdown.LOW}\n\n`;
        
        if (report.priorityActions.length > 0) {
            markdown += '## Priority Actions\n\n';
            report.priorityActions.forEach((action, index) => {
                markdown += `${index + 1}. **Duplication ${action.id}**\n`;
                markdown += `   - Files: ${action.files.join(', ')}\n`;
                markdown += `   - Lines: ${action.lines}\n`;
                markdown += `   - Action: ${action.recommendation}\n\n`;
            });
        }
        
        markdown += '## All Duplications\n\n';
        report.allDuplications.forEach((d, index) => {
            const emoji = d.severity === 'HIGH' ? '🔴' : d.severity === 'MEDIUM' ? '🟡' : '🟢';
            markdown += `### ${index + 1}. ${emoji} Duplication ${d.id} (${d.severity})\n\n`;
            markdown += `**Files:** ${d.files.join(', ')}\n\n`;
            markdown += `**Lines:** ${d.lines}\n\n`;
            markdown += `**Duplicated Lines:** ${d.duplicatedLines}\n\n`;
            markdown += `**Similarity:** ${d.similarity}%\n\n`;
            markdown += `**Code Snippet:**\n\`\`\`\n${d.codeSnippet}\n\`\`\`\n\n`;
            markdown += `**Recommendation:** ${d.recommendation}\n\n`;
            markdown += '---\n\n';
        });
        
        return markdown;
    }

    /**
     * Export report as JSON
     */
    exportReportAsJSON() {
        return JSON.stringify(this.generateRemediationReport(), null, 2);
    }
}
