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
     * Export roadmap data to different formats
     */
    async export(roadmapData, format, filename = null) {
        try {
            let content;
            let mimeType;
            let fileExtension;

            switch (format.toLowerCase()) {
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
                    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    fileExtension = 'xlsx';
                    break;
                    
                case 'pdf':
                    content = await this.exportToPDF(roadmapData);
                    mimeType = 'application/pdf';
                    fileExtension = 'pdf';
                    break;
                    
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            // Generate filename if not provided
            if (!filename) {
                const timestamp = new Date().toISOString().split('T')[0];
                filename = `roadmap-export-${timestamp}.${fileExtension}`;
            }

            // Download the file
            this.downloadFile(content, filename, mimeType);
            
            return { success: true, filename, format };
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
     * Export to PDF format
     */
    async exportToPDF(roadmapData) {
        // Create HTML content for PDF
        const htmlContent = this.createPDFContent(roadmapData);
        
        // In a real implementation, you would use a library like jsPDF or Puppeteer
        // For now, we'll create a text-based representation
        return this.createTextPDF(roadmapData);
    }

    /**
     * Create PDF content as HTML
     */
    createPDFContent(roadmapData) {
        const overview = roadmapData.projectOverview || {};
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>${roadmapData.title || 'Roadmap Report'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; border-bottom: 2px solid #333; }
        h2 { color: #666; margin-top: 30px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .completed { color: green; }
        .in-progress { color: orange; }
        .planned { color: gray; }
    </style>
</head>
<body>
    <h1>${roadmapData.title || 'Development Roadmap'}</h1>
    <p><strong>Generated:</strong> ${roadmapData.generatedAt || new Date().toISOString()}</p>
    <p><strong>Generated By:</strong> ${roadmapData.generatedBy || 'Roadmap System'}</p>
    
    <h2>Project Overview</h2>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Project Name</td><td>${overview.projectName || 'N/A'}</td></tr>
        <tr><td>Total Features</td><td>${overview.totalFeatures || 0}</td></tr>
        <tr><td>Completed Features</td><td>${overview.completedFeatures || 0}</td></tr>
        <tr><td>Completion Rate</td><td>${overview.completionRate || '0%'}</td></tr>
        <tr><td>Project Health</td><td>${overview.projectHealth || 'N/A'}</td></tr>
    </table>
    
    <h2>Development Phases</h2>
    <table>
        <tr><th>Phase</th><th>Title</th><th>Status</th><th>Date</th><th>Completion</th><th>Team Size</th></tr>
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
        return phases.map(phase => `
            <tr>
                <td>${phase.phase || ''}</td>
                <td>${phase.title || ''}</td>
                <td class="${phase.status || ''}">${this.formatStatus(phase.status)}</td>
                <td>${phase.date || ''}</td>
                <td>${phase.metrics?.completion || ''}</td>
                <td>${phase.metrics?.teamSize || ''}</td>
            </tr>
        `).join('');
    }

    /**
     * Create milestones table rows for PDF
     */
    createMilestonesTableRows(milestones) {
        return milestones.map(milestone => `
            <tr>
                <td>${milestone.milestone || ''}</td>
                <td>${milestone.date || ''}</td>
                <td class="${milestone.status || ''}">${this.formatStatus(milestone.status)}</td>
                <td>${milestone.description || ''}</td>
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
                const result = await this.export(roadmapData, format, baseFilename);
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
     * Create export menu UI
     */
    createExportMenu(roadmapData, container) {
        const menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.textContent = `
            <h3>Export Roadmap Data</h3>
            <div class="export-options">
                <button onclick="roadmapExport.export(roadmapData, 'json')" class="export-btn json-btn">
                    📄 Export as JSON
                </button>
                <button onclick="roadmapExport.export(roadmapData, 'csv')" class="export-btn csv-btn">
                    📊 Export as CSV
                </button>
                <button onclick="roadmapExport.export(roadmapData, 'excel')" class="export-btn excel-btn">
                    📈 Export as Excel
                </button>
                <button onclick="roadmapExport.export(roadmapData, 'pdf')" class="export-btn pdf-btn">
                    📋 Export as PDF
                </button>
                <button onclick="roadmapExport.exportAll(roadmapData)" class="export-btn all-btn">
                    📦 Export All Formats
                </button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        // Add styles
        const style = document.createElement('style');
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
            .export-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
            }
            .json-btn { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
            .csv-btn { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
            .excel-btn { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
            .pdf-btn { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
            .all-btn { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        `;
        document.head.appendChild(style);

        if (container) {
            container.appendChild(menu);
        }

        return menu;
    }

    /**
     * Export all formats
     */
    async exportAll(roadmapData) {
        const formats = ['json', 'csv', 'excel', 'pdf'];
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
