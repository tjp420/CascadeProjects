/**
 * Technical Debt Export Module
 * Provides functionality to export technical debt reports in various formats
 */

class DebtExport {
    constructor() {
        // Use window.location.origin for dynamic port support
        this.apiBaseUrl = process.env.API_BASE_URL || window.API_BASE_URL || (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:54369');
        this.data = null;
    }

    /**
     * Fetch technical debt data from API
     * @returns {Promise<Object>} Technical debt data
     */
    async fetchDebtData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/analysis/technical-debt`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.data = await response.json();
            return this.data;
        } catch (error) {
            console.error('Error fetching technical debt data:', error);
            throw new Error('Failed to fetch technical debt data from API');
        }
    }

    /**
     * Export technical debt report as JSON
     * @returns {Promise<Blob>} JSON blob
     */
    async exportJSON() {
        if (!this.data) {
            await this.fetchDebtData();
        }
        
        const dataStr = JSON.stringify(this.data, null, 2);
        return new Blob([dataStr], { type: 'application/json' });
    }

    /**
     * Export technical debt report as CSV
     * @returns {Promise<Blob>} CSV blob
     */
    async exportCSV() {
        if (!this.data) {
            await this.fetchDebtData();
        }
        
        const csv = this.convertToCSV(this.data);
        return new Blob([csv], { type: 'text/csv' });
    }

    /**
     * Export technical debt report as HTML
     * @returns {Promise<Blob>} HTML blob
     */
    async exportHTML() {
        if (!this.data) {
            await this.fetchDebtData();
        }
        
        const html = this.generateHTMLReport(this.data);
        return new Blob([html], { type: 'text/html' });
    }

    /**
     * Convert data to CSV format
     * @param {Object} data - Technical debt data
     * @returns {string} CSV string
     */
    convertToCSV(data) {
        const headers = ['Category', 'Score', 'Severity', 'Description'];
        const rows = Object.entries(data.categories).map(([key, category]) => [
            this.formatCategoryName(key),
            category.score,
            category.severity,
            this.getCategoryDescription(key, category)
        ]);
        
        // Add metrics
        rows.push(['Metrics', '', '', '']);
        Object.entries(data.metrics).forEach(([key, value]) => {
            rows.push([key, value, '', '']);
        });
        
        // Add recommendations
        rows.push(['Recommendations', '', '', '']);
        data.recommendations.forEach((rec, index) => {
            rows.push([`Recommendation ${index + 1}`, rec.priority, rec.action, rec.description]);
        });
        
        return [headers, ...rows].map(row => 
            row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    /**
     * Generate HTML report
     * @param {Object} data - Technical debt data
     * @returns {string} HTML string
     */
    generateHTMLReport(data) {
        return `<!DOCTYPE html>
<html>
<head>
    <title>Technical Debt Report</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            background: #f5f5f5; 
            color: #333;
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            padding: 40px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { 
            color: #2c3e50; 
            border-bottom: 2px solid #3498db; 
            padding-bottom: 20px; 
        }
        .metric { 
            margin: 20px 0; 
            padding: 20px; 
            border-left: 4px solid #3498db; 
            background: #f8f9fa;
        }
        .metric h3 { 
            margin: 0 0 10px 0; 
            color: #2c3e50; 
        }
        .score { 
            font-size: 24px; 
            font-weight: bold; 
            color: ${this.getScoreColor(data.overall.score)}; 
        }
        .grade { 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-weight: bold; 
            color: white; 
            ${this.getGradeStyle(data.overall.grade)}
        }
        .recommendation { 
            margin: 20px 0; 
            padding: 20px; 
            border-left: 4px solid #3498db; 
            background: #f8f9fa;
        }
        .recommendation h4 { 
            margin: 0 0 10px 0; 
            color: #2c3e50; 
        }
        .priority { 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px; 
            font-weight: bold; 
            color: white; 
            ${this.getPriorityStyle('high')}
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Technical Debt Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
        
        <div class="metric">
            <h3>Overall Assessment</h3>
            <div class="score">${data.overall.score}</div>
            <div class="grade ${this.getGradeStyle(data.overall.grade)}">${data.overall.grade}</div>
            <p><strong>Risk Level:</strong> ${data.overall.riskLevel}</p>
            <p><strong>Estimated Effort:</strong> ${data.overall.estimatedEffort} hours</p>
        </div>

        <h2>Categories</h2>
        ${Object.entries(data.categories).map(([key, category]) => `
            <div class="metric">
                <h3>${this.formatCategoryName(key)}</h3>
                <div class="score">${category.score}</div>
                <div class="severity-indicator">${category.severity}</div>
                <p>${this.getCategoryDescription(key, category)}</p>
            </div>
        `).join('')}

        <h2>Recommendations</h2>
        ${data.recommendations.map((rec, index) => `
            <div class="recommendation">
                <h4>${rec.action}</h4>
                <div class="priority">${rec.priority.toUpperCase()}</div>
                <p>${rec.description}</p>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    }

    /**
     * Format category name for display
     * @param {string} key - Category key
     * @returns {string} Formatted name
     */
    formatCategoryName(key) {
        return key.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    /**
     * Get category description
     * @param {string} key - Category key
     * @param {Object} category - Category data
     * @returns {string} Description
     */
    getCategoryDescription(key, category) {
        const descriptions = {
            complexity: 'Code complexity measures how complex and difficult the code is to understand and maintain.',
            documentation: 'Documentation quality assesses how well the code is documented.',
            testing: 'Testing coverage evaluates how much of the code is covered by automated tests.',
            duplication: 'Code duplication measures the amount of repeated code patterns.'
        };
        return descriptions[key] || 'Category description not available.';
    }

    /**
     * Get color for score
     * @param {number} score - Score value
     * @returns {string} Color hex code
     */
    getScoreColor(score) {
        if (score >= 80) {
            return '#10b981';
        }
        if (score >= 60) {
            return '#f59e0b';
        }
        if (score >= 40) {
            return '#6366f1';
        }
        return '#ef4444';
    }

    /**
     * Get CSS style for grade
     * @param {string} grade - Grade letter
     * @returns {string} CSS style
     */
    getGradeStyle(grade) {
        const styles = {
            'A': 'background: #10b981; color: white;',
            'B': 'background: #3b82f6; color: white;',
            'C': 'background: #f59e0b; color: white;',
            'D': 'background: #ef4444; color: white;',
            'F': 'background: #ef4444; color: white;'
        };
        return styles[grade.toUpperCase()] || styles['F'];
    }

    /**
     * Get CSS style for priority
     * @param {string} priority - Priority level
     * @returns {string} CSS style
     */
    getPriorityStyle(priority) {
        const styles = {
            'low': 'background: #10b981; color: white;',
            'medium': 'background: #f59e0b; color: white;',
            'high': 'background: #ef4444; color: white;'
        };
        return styles[priority.toLowerCase()] || styles['medium'];
    }

    /**
     * Download file
     * @param {Blob} blob - File blob
     * @param {string} filename - File name
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export report in specified format
     * @param {string} format - Export format ('json', 'csv', 'html')
     * @returns {Promise<void>}
     */
    async exportReport(format = 'json') {
        try {
            let blob;
            let filename;
            
            switch (format.toLowerCase()) {
            case 'json':
                blob = await this.exportJSON();
                filename = 'technical-debt-report.json';
                break;
            case 'csv':
                blob = await this.exportCSV();
                filename = 'technical-debt-report.csv';
                break;
            case 'html':
                blob = await this.exportHTML();
                filename = 'technical-debt-report.html';
                break;
            default:
                throw new Error('Unsupported export format: ' + format);
            }
            
            this.downloadFile(blob, filename);
            return filename;
        } catch (error) {
            console.error('Error exporting report:', error);
            throw error;
        }
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebtExport;
} else if (typeof window !== 'undefined') {
    window.DebtExport = DebtExport;
}
