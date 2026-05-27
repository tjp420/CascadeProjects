/**
 * Roadmap Export System
 * Multi-format export capabilities for roadmap data
 * Supports PDF, Excel, CSV, and JSON export formats
 */

class RoadmapExportSystem {
    constructor(options = {}) {
        this.options = {
            includeTimestamp: true,
            includeMetadata: true,
            formatDates: true,
            theme: 'dark',
            ...options
        };
    }

    /**
     * Ensure downloaded files use the correct extension.
     */
    ensureFilename(filename, fileExtension) {
        if (!filename) {
            const timestamp = new Date().toISOString().split('T')[0];
            return `roadmap-export-${timestamp}.${fileExtension}`;
        }
        const base = String(filename).replace(/\.[^.]+$/, '');
        return `${base}.${fileExtension}`;
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Export roadmap data to different formats
     */
    async export(roadmapData, format, filename = null) {
        try {
            const normalizedFormat = format.toLowerCase();

            if (normalizedFormat === 'pdf') {
                const resolvedFilename = this.ensureFilename(filename, 'pdf');
                const result = await this.exportToPDF(roadmapData, resolvedFilename);
                if (typeof window !== 'undefined' && window.showNotification) {
                    const message = result.mode === 'print'
                        ? 'Print dialog opened — choose Save as PDF'
                        : `Downloaded ${result.filename} — open it and use Print > Save as PDF`;
                    window.showNotification(message, 'info');
                }
                return { success: true, filename: result.filename || resolvedFilename, format: 'pdf', mode: result.mode };
            }

            let content;
            let mimeType;
            let fileExtension;

            switch (normalizedFormat) {
                case 'json':
                    content = this.exportToJSON(roadmapData);
                    mimeType = 'application/json';
                    fileExtension = 'json';
                    break;

                case 'csv':
                    content = this.exportToCSV(roadmapData);
                    mimeType = 'text/csv';
                    fileExtension = 'csv';
                    break;

                case 'excel':
                    content = await this.exportToExcel(roadmapData);
                    mimeType = 'text/csv';
                    fileExtension = 'csv';
                    break;

                case 'markdown':
                    content = this.exportToMarkdown(roadmapData);
                    mimeType = 'text/markdown';
                    fileExtension = 'md';
                    break;

                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            const resolvedFilename = this.ensureFilename(filename, fileExtension);
            this.downloadFile(content, resolvedFilename, mimeType);

            return { success: true, filename: resolvedFilename, format: normalizedFormat };
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }

    /**
     * Export to JSON format
     */
    exportToJSON(roadmapData) {
        const exportData = { ...roadmapData };
        
        if (this.options.includeTimestamp) {
            exportData.exportedAt = new Date().toISOString();
            exportData.exportedBy = 'Roadmap Export System';
        }

        if (this.options.includeMetadata) {
            exportData.exportMetadata = {
                version: '1.0',
                format: 'json',
                theme: this.options.theme,
                totalPhases: roadmapData.developmentPhases?.length || 0,
                totalMilestones: roadmapData.keyMilestones?.length || 0,
                totalFeatures: roadmapData.projectOverview?.totalFeatures || 0
            };
        }

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Export to CSV format
     */
    exportToCSV(roadmapData) {
        const rows = [];
        
        // Add header
        rows.push(['Type', 'Title', 'Status', 'Date', 'Description', 'Completion', 'Team Size', 'Duration']);

        // Add development phases
        if (roadmapData.developmentPhases) {
            roadmapData.developmentPhases.forEach(phase => {
                rows.push([
                    'Phase',
                    phase.title,
                    phase.status,
                    phase.date,
                    phase.description,
                    phase.metrics?.completion || '',
                    phase.metrics?.teamSize || '',
                    phase.metrics?.duration || ''
                ]);
            });
        }

        // Add milestones
        if (roadmapData.keyMilestones) {
            roadmapData.keyMilestones.forEach(milestone => {
                rows.push([
                    'Milestone',
                    milestone.milestone,
                    milestone.status,
                    milestone.date,
                    milestone.description,
                    '',
                    '',
                    ''
                ]);
            });
        }

        // Add feature categories
        if (roadmapData.featureCategories) {
            roadmapData.featureCategories.forEach(category => {
                rows.push([
                    'Category',
                    category.category,
                    '',
                    '',
                    category.description,
                    category.completionRate,
                    '',
                    ''
                ]);
            });
        }

        // Convert to CSV string
        return rows.map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    /**
     * Export to Markdown format
     */
    exportToMarkdown(roadmapData) {
        const overview = roadmapData.projectOverview || {};
        const total = overview.totalFeatures ?? '—';
        const completed = overview.completedFeatures ?? '—';
        const inProgress = overview.inProgressFeatures ?? overview.plannedFeatures ?? '—';
        const completionRate = overview.completionRate != null
            ? `${overview.completionRate}%`
            : (overview.overallProgress || '—');
        const generatedAt = roadmapData.generatedAt
            ? new Date(roadmapData.generatedAt).toLocaleString()
            : new Date().toLocaleString();
        const title = roadmapData.title || overview.projectName || 'Development Roadmap Report';

        const phases = roadmapData.developmentPhases || [];
        const timeline = phases.map((phase, index) => {
            const name = phase.phase || phase.title || `Phase ${index + 1}`;
            const status = phase.status || 'unknown';
            const date = phase.endDate || phase.startDate || phase.date || '—';
            const description = phase.description || '';
            const progress = phase.progress != null ? `${phase.progress}%` : '';
            return `
### ${index + 1}. ${name}
- **Status:** ${status}${progress ? ` (${progress})` : ''}
- **Date:** ${date}
- **Description:** ${description}
${Array.isArray(phase.features) && phase.features.length
    ? `- **Features:** ${phase.features.join('; ')}`
    : ''}`.trim();
        }).join('\n\n');

        const recommendations = roadmapData.recommendations
            || roadmapData.aiRecommendations
            || roadmapData.strategicRecommendations
            || [];
        const recBlock = Array.isArray(recommendations) && recommendations.length
            ? recommendations.map((rec, index) => {
                const action = rec.action || rec.title || rec.name || `Recommendation ${index + 1}`;
                const priority = rec.priority ? ` (${rec.priority} priority)` : '';
                const desc = rec.description || rec.detail || '';
                return `${index + 1}. **${action}**${priority}${desc ? `\n   ${desc}` : ''}`;
            }).join('\n\n')
            : 'No recommendations available';

        const insights = roadmapData.ggufAnalysis?.roadmap?.summary
            || roadmapData.aiInsights
            || null;
        const insightsBlock = insights ? `
- **Project Health:** ${insights.projectHealth || overview.projectHealth || '—'}
- **Development Velocity:** ${insights.developmentVelocity || overview.developmentVelocity || '—'}
- **Technical Debt:** ${insights.technicalDebt || '—'}
- **Risk Level:** ${insights.riskLevel || '—'}
`.trim() : `
- **Project Health:** ${overview.projectHealth || '—'}
- **Development Velocity:** ${overview.developmentVelocity || '—'}
`.trim();

        return `# 🗺️ ${title}

*Generated: ${generatedAt}*
*Source: ${roadmapData.dataSource || roadmapData.generatedBy || 'roadmap export'}*

## 📊 Summary Statistics

| Metric | Value |
|--------|-------|
| Total Features | ${total} |
| Completed Features | ${completed} |
| In Progress | ${inProgress} |
| Completion Rate | ${completionRate} |

## 📅 Development Timeline

${timeline || '_No phases recorded_'}

## 🤖 Insights

${insightsBlock}

## 💡 Recommendations

${recBlock}

---
*Report generated by Roadmap Export System*
`.trim();
    }

    /**
     * Export to Excel format
     */
    async exportToExcel(roadmapData) {
        // Create a simple Excel-like format using CSV with special formatting
        // In a real implementation, you would use a library like xlsx or exceljs
        
        const workbook = this.createExcelWorkbook(roadmapData);
        return this.convertWorkbookToBinary(workbook);
    }

    /**
     * Create Excel workbook structure
     */
    createExcelWorkbook(roadmapData) {
        const workbook = {
            sheets: []
        };

        // Overview sheet
        workbook.sheets.push({
            name: 'Overview',
            data: this.createOverviewSheet(roadmapData)
        });

        // Phases sheet
        workbook.sheets.push({
            name: 'Development Phases',
            data: this.createPhasesSheet(roadmapData)
        });

        // Milestones sheet
        workbook.sheets.push({
            name: 'Milestones',
            data: this.createMilestonesSheet(roadmapData)
        });

        // Features sheet
        workbook.sheets.push({
            name: 'Feature Categories',
            data: this.createFeaturesSheet(roadmapData)
        });

        return workbook;
    }

    /**
     * Create overview sheet data
     */
    createOverviewSheet(roadmapData) {
        const overview = roadmapData.projectOverview || {};
        
        return [
            ['Project Overview', '', '', ''],
            ['Project Name', overview.projectName || '', '', ''],
            ['Project Type', overview.projectType || '', '', ''],
            ['Total Features', overview.totalFeatures || 0, '', ''],
            ['Completed Features', overview.completedFeatures || 0, '', ''],
            ['In Progress Features', overview.inProgressFeatures || 0, '', ''],
            ['Completion Rate', overview.completionRate || '0%', '', ''],
            ['Overall Progress', overview.overallProgress || '', '', ''],
            ['Project Health', overview.projectHealth || '', '', ''],
            ['Development Velocity', overview.developmentVelocity || '', '', ''],
            ['Team Productivity', overview.teamProductivity || '', '', ''],
            ['', '', '', ''],
            ['Generated At', roadmapData.generatedAt || '', '', ''],
            ['Generated By', roadmapData.generatedBy || '', '', '']
        ];
    }

    /**
     * Create phases sheet data
     */
    createPhasesSheet(roadmapData) {
        const data = [
            ['Phase', 'Title', 'Status', 'Date', 'Description', 'Completion', 'Quality', 'Duration', 'Team Size', 'Milestones', 'AI Confidence', 'GGUF Insights']
        ];

        if (roadmapData.developmentPhases) {
            roadmapData.developmentPhases.forEach(phase => {
                data.push([
                    phase.phase || '',
                    phase.title || '',
                    phase.status || '',
                    phase.date || '',
                    phase.description || '',
                    phase.metrics?.completion || '',
                    phase.metrics?.quality || '',
                    phase.metrics?.duration || '',
                    phase.metrics?.teamSize || '',
                    phase.metrics?.milestones || '',
                    phase.aiConfidence || '',
                    phase.ggufInsights || ''
                ]);
            });
        }

        return data;
    }

    /**
     * Create milestones sheet data
     */
    createMilestonesSheet(roadmapData) {
        const data = [
            ['Milestone', 'Date', 'Status', 'Description', 'Achievement']
        ];

        if (roadmapData.keyMilestones) {
            roadmapData.keyMilestones.forEach(milestone => {
                data.push([
                    milestone.milestone || '',
                    milestone.date || '',
                    milestone.status || '',
                    milestone.description || '',
                    milestone.achievement || ''
                ]);
            });
        }

        return data;
    }

    /**
     * Create features sheet data
     */
    createFeaturesSheet(roadmapData) {
        const data = [
            ['Category', 'Total Features', 'Completed Features', 'Completion Rate', 'Confidence', 'Description']
        ];

        if (roadmapData.featureCategories) {
            roadmapData.featureCategories.forEach(category => {
                data.push([
                    category.category || '',
                    category.totalFeatures || 0,
                    category.completedFeatures || 0,
                    category.completionRate || '',
                    category.confidence || '',
                    category.description || ''
                ]);
            });
        }

        return data;
    }

    /**
     * Convert workbook to binary format (simplified)
     */
    convertWorkbookToBinary(workbook) {
        // This is a simplified implementation
        // In production, you would use a proper Excel library
        let csvContent = '';
        
        workbook.sheets.forEach(sheet => {
            csvContent += `Sheet: ${sheet.name}\n`;
            sheet.data.forEach(row => {
                csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
            });
            csvContent += '\n';
        });

        return csvContent;
    }

    /**
     * Export to PDF format via browser print (Save as PDF).
     * Falls back to downloadable HTML when popups are blocked.
     */
    async exportToPDF(roadmapData, filename = null) {
        const htmlContent = this.createPDFContent(roadmapData);
        const htmlFilename = this.ensureFilename(
            filename ? String(filename).replace(/\.pdf$/i, '') : null,
            'html'
        );

        if (typeof window !== 'undefined') {
            const printWindow = window.open('', '_blank', 'noopener,noreferrer');
            if (printWindow) {
                printWindow.document.open();
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                printWindow.focus();
                const triggerPrint = () => {
                    try {
                        printWindow.print();
                    } catch (error) {
                        console.warn('Print dialog failed:', error.message);
                    }
                };
                if (printWindow.document.readyState === 'complete') {
                    triggerPrint();
                } else {
                    printWindow.onload = triggerPrint;
                }
                return { mode: 'print', filename: htmlFilename.replace(/\.html$/i, '.pdf') };
            }
        }

        this.downloadFile(htmlContent, htmlFilename, 'text/html');
        return { mode: 'html-download', filename: htmlFilename };
    }

    /**
     * Create PDF content as HTML
     */
    createPDFContent(roadmapData) {
        const overview = roadmapData.projectOverview || {};
        const title = this.escapeHtml(roadmapData.title || 'Development Roadmap');
        const generatedAt = this.escapeHtml(roadmapData.generatedAt || new Date().toISOString());
        const generatedBy = this.escapeHtml(roadmapData.generatedBy || 'Roadmap System');
        const dataSource = roadmapData.dataSource
            ? `<p><strong>Data Source:</strong> ${this.escapeHtml(roadmapData.dataSource)}</p>`
            : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
        h1 { color: #111827; border-bottom: 2px solid #111827; padding-bottom: 8px; }
        h2 { color: #374151; margin-top: 28px; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
        th { background-color: #f3f4f6; }
        .completed { color: #166534; }
        .in-progress { color: #b45309; }
        .planned, .upcoming { color: #4b5563; }
        .meta { color: #4b5563; font-size: 14px; }
        @media print {
            body { margin: 12mm; }
            h1, h2 { page-break-after: avoid; }
            table { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <p class="meta"><strong>Generated:</strong> ${generatedAt}</p>
    <p class="meta"><strong>Generated By:</strong> ${generatedBy}</p>
    ${dataSource}

    <h2>Project Overview</h2>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Project Name</td><td>${this.escapeHtml(overview.projectName || 'N/A')}</td></tr>
        <tr><td>Total Features</td><td>${this.escapeHtml(overview.totalFeatures ?? 0)}</td></tr>
        <tr><td>Completed Features</td><td>${this.escapeHtml(overview.completedFeatures ?? 0)}</td></tr>
        <tr><td>Completion Rate</td><td>${this.escapeHtml(overview.completionRate ?? '0%')}</td></tr>
        <tr><td>Project Health</td><td>${this.escapeHtml(overview.projectHealth || 'N/A')}</td></tr>
    </table>

    <h2>Development Phases</h2>
    <table>
        <tr><th>Phase</th><th>Status</th><th>Progress</th><th>Description</th></tr>
        ${this.createPhasesTableRows(roadmapData.developmentPhases || [])}
    </table>

    <h2>Key Milestones</h2>
    <table>
        <tr><th>Milestone</th><th>Date</th><th>Status</th><th>Description</th></tr>
        ${this.createMilestonesTableRows(roadmapData.keyMilestones || [])}
    </table>
</body>
</html>`;
    }

    /**
     * Create phases table rows for PDF
     */
    createPhasesTableRows(phases) {
        return phases.map((phase) => {
            const label = phase.phase || phase.title || phase.name || '';
            const progress = phase.progress != null
                ? `${phase.progress}%`
                : (phase.metrics?.completion || '—');
            return `
            <tr>
                <td>${this.escapeHtml(label)}</td>
                <td class="${this.escapeHtml(phase.status || '')}">${this.escapeHtml(this.formatStatus(phase.status))}</td>
                <td>${this.escapeHtml(progress)}</td>
                <td>${this.escapeHtml(phase.description || '')}</td>
            </tr>`;
        }).join('');
    }

    /**
     * Create milestones table rows for PDF
     */
    createMilestonesTableRows(milestones) {
        return milestones.map((milestone) => `
            <tr>
                <td>${this.escapeHtml(milestone.milestone || milestone.title || milestone.name || '')}</td>
                <td>${this.escapeHtml(milestone.date || '')}</td>
                <td class="${this.escapeHtml(milestone.status || '')}">${this.escapeHtml(this.formatStatus(milestone.status))}</td>
                <td>${this.escapeHtml(milestone.description || '')}</td>
            </tr>
        `).join('');
    }

    /**
     * Create text-based PDF (simplified)
     */
    createTextPDF(roadmapData) {
        const overview = roadmapData.projectOverview || {};
        
        let content = `${roadmapData.title || 'Development Roadmap'}\n`;
        content += `Generated: ${roadmapData.generatedAt || new Date().toISOString()}\n`;
        content += `Generated By: ${roadmapData.generatedBy || 'Roadmap System'}\n\n`;
        
        content += `PROJECT OVERVIEW\n`;
        content += `================\n`;
        content += `Project Name: ${overview.projectName || 'N/A'}\n`;
        content += `Total Features: ${overview.totalFeatures || 0}\n`;
        content += `Completed Features: ${overview.completedFeatures || 0}\n`;
        content += `Completion Rate: ${overview.completionRate || '0%'}\n`;
        content += `Project Health: ${overview.projectHealth || 'N/A'}\n\n`;
        
        content += `DEVELOPMENT PHASES\n`;
        content += `==================\n`;
        if (roadmapData.developmentPhases) {
            roadmapData.developmentPhases.forEach(phase => {
                content += `Phase ${phase.phase}: ${phase.title}\n`;
                content += `Status: ${this.formatStatus(phase.status)}\n`;
                content += `Date: ${phase.date}\n`;
                content += `Completion: ${phase.metrics?.completion || 'N/A'}\n`;
                content += `Team Size: ${phase.metrics?.teamSize || 'N/A'}\n`;
                content += `Description: ${phase.description}\n\n`;
            });
        }
        
        content += `KEY MILESTONES\n`;
        content += `===============\n`;
        if (roadmapData.keyMilestones) {
            roadmapData.keyMilestones.forEach(milestone => {
                content += `${milestone.milestone}\n`;
                content += `Status: ${this.formatStatus(milestone.status)}\n`;
                content += `Date: ${milestone.date}\n`;
                content += `Description: ${milestone.description}\n\n`;
            });
        }
        
        return content;
    }

    /**
     * Format status for display
     */
    formatStatus(status) {
        return status ? status.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ') : 'Unknown';
    }

    /**
     * Download file to user's computer
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
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
     * Export multiple formats at once
     */
    async exportMultiple(roadmapData, formats, baseFilename = null) {
        const results = [];

        for (const format of formats) {
            try {
                const filename = baseFilename
                    ? this.ensureFilename(baseFilename, format === 'excel' ? 'csv' : format)
                    : null;
                const result = await this.export(roadmapData, format, filename);
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    format,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Resolve the roadmap payload used for export actions.
     */
    resolveRoadmapData(roadmapData) {
        const candidate = roadmapData
            || this.activeRoadmapData
            || (typeof window !== 'undefined' ? window.currentRoadmapData : null)
            || (typeof window !== 'undefined' ? window.__roadmapExportData : null);
        if (!candidate || typeof candidate !== 'object') return null;
        if (!candidate.projectOverview
            && !(candidate.developmentPhases || []).length
            && !(candidate.keyMilestones || []).length
            && !candidate.title) {
            return null;
        }
        return candidate;
    }

    ensureExportStyles() {
        if (typeof document === 'undefined' || document.getElementById('roadmap-export-menu-styles')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'roadmap-export-menu-styles';
        style.textContent = `
            .export-menu {
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                border: 1px solid rgba(148, 163, 184, 0.2);
                border-radius: 12px;
                padding: 2rem;
                margin: 1rem 0;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }
            .export-menu h3 {
                color: #f8fafc;
                margin-bottom: 1.5rem;
                text-align: center;
            }
            .export-options {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
            }
            .export-btn {
                background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: center;
            }
            .export-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
            }
            .export-btn:disabled {
                opacity: 0.65;
                cursor: wait;
            }
            .json-btn { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
            .csv-btn { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
            .excel-btn { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
            .pdf-btn { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
            .all-btn { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        `;
        document.head.appendChild(style);
    }

    async handleExportClick(format, roadmapData) {
        const data = this.resolveRoadmapData(roadmapData);
        if (!data) {
            if (typeof window !== 'undefined' && window.showNotification) {
                window.showNotification('Load or generate a roadmap before exporting', 'error');
            }
            return;
        }

        try {
            if (format === 'all') {
                await this.exportAll(data);
                return;
            }
            const result = await this.export(data, format);
            if (typeof window !== 'undefined' && window.showNotification && format !== 'pdf') {
                window.showNotification(`✅ Exported ${result.filename}`, 'success');
            }
        } catch (error) {
            console.error('Roadmap export failed:', error);
            if (typeof window !== 'undefined' && window.showNotification) {
                window.showNotification(`❌ Export failed: ${error.message}`, 'error');
            }
        }
    }

    bindExportButton(button, format, roadmapData) {
        button.addEventListener('click', async () => {
            if (button.disabled) return;
            button.disabled = true;
            try {
                await this.handleExportClick(format, roadmapData);
            } finally {
                button.disabled = false;
            }
        });
    }
    /**
     * Create export menu UI
     */
    createExportMenu(roadmapData, container) {
        this.activeRoadmapData = roadmapData;
        if (typeof window !== 'undefined') {
            window.__roadmapExportData = roadmapData;
        }
        this.ensureExportStyles();

        const menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.innerHTML = `
            <h3>Export Roadmap Data</h3>
            <div class="export-options"></div>
        `;

        const options = menu.querySelector('.export-options');
        const buttons = [
            { format: 'json', label: '📄 Export as JSON', className: 'json-btn' },
            { format: 'csv', label: '📊 Export as CSV', className: 'csv-btn' },
            { format: 'excel', label: '📈 Export as Excel', className: 'excel-btn' },
            { format: 'markdown', label: '📝 Export as Markdown', className: 'markdown-btn' },
            { format: 'pdf', label: '📋 Print / Save as PDF', className: 'pdf-btn' },
            { format: 'all', label: '📦 Export All Formats', className: 'all-btn' }
        ];

        buttons.forEach(({ format, label, className }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `export-btn ${className}`;
            button.textContent = label;
            this.bindExportButton(button, format, roadmapData);
            options.appendChild(button);
        });

        if (container) {
            container.appendChild(menu);
        }

        return menu;
    }

    /**
     * Export all formats
     */
    async exportAll(roadmapData) {
        const formats = ['json', 'csv', 'excel', 'markdown', 'pdf'];
        const timestamp = new Date().toISOString().split('T')[0];
        const baseFilename = `roadmap-complete-${timestamp}`;
        
        try {
            const results = await this.exportMultiple(roadmapData, formats, baseFilename);
            
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            if (failed > 0) {
                console.warn(`${failed} exports failed:`, results.filter(r => !r.success));
            }
            
            // Show notification
            if (typeof window !== 'undefined' && window.showNotification) {
                window.showNotification(`✅ Exported ${successful} format${successful > 1 ? 's' : ''} successfully`, 'success');
            }
            
            return results;
        } catch (error) {
            console.error('Bulk export failed:', error);
            throw error;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoadmapExportSystem;
} else if (typeof window !== 'undefined') {
    window.RoadmapExportSystem = RoadmapExportSystem;
    // Create global instance for easy access
    window.roadmapExport = new RoadmapExportSystem();
}
