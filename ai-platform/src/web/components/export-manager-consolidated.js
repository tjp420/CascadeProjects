/**
 * Consolidated Export Manager - Merges export-manager.js and export-scheduler.js
 * Single responsibility: Handle all export functionality with strategy pattern for formats
 */

class ExportManager {
    constructor() {
        this.exportHistory = [];
        this.exportTemplates = new Map();
        this.currentData = null;
        this.scheduledExports = new Map();
        this.exportQueue = [];
        this.isProcessing = false;
        this.exportJobs = new Map(); // Track individual export jobs with status
        
        // Configuration
        this.config = {
            defaultFormat: 'json',
            maxConcurrentExports: 3,
            retryAttempts: 3,
            retryDelay: 5000
        };
        
        // Strategy pattern for different export formats
        this.exportStrategies = new Map();
        this.supportedFormats = ['json', 'csv', 'pdf', 'xlsx', 'html'];
        this.exportCategories = [
            'quality_analysis',
            'code_metrics', 
            'trend_analysis',
            'benchmarks',
            'visualizations',
            'executive_summary',
            'comprehensive_report'
        ];
        
        this.init();
    }

    init() {
        console.log('Initializing export manager...');
        this.initializeExportStrategies();
        this.initializeExportTemplates();
        this.loadExportHistory();
        this.loadExportJobs();
        this.setupExportEventListeners();
        this.startScheduler();
        console.log('Export manager initialized successfully');
    }

    // Strategy Pattern Implementation
    initializeExportStrategies() {
        // JSON Export Strategy
        this.exportStrategies.set('json', {
            export: (data, options = {}) => {
                const json = JSON.stringify(data, null, 2);
                return new Blob([json], { type: 'application/json' });
            },
            filename: (type) => `${type}_export_${Date.now()}.json`,
            mimeType: 'application/json'
        });

        // CSV Export Strategy
        this.exportStrategies.set('csv', {
            export: (data, options = {}) => {
                const csv = this.generateCSV(data, options);
                return new Blob([csv], { type: 'text/csv' });
            },
            filename: (type) => `${type}_export_${Date.now()}.csv`,
            mimeType: 'text/csv'
        });

        // PDF Export Strategy (placeholder - would use PDF library in real implementation)
        this.exportStrategies.set('pdf', {
            export: (data, options = {}) => {
                // Placeholder for PDF generation
                const html = this.generateHTMLReport(data, options);
                return new Blob([html], { type: 'text/html' });
            },
            filename: (type) => `${type}_export_${Date.now()}.pdf`,
            mimeType: 'application/pdf'
        });

        // HTML Export Strategy
        this.exportStrategies.set('html', {
            export: (data, options = {}) => {
                const html = this.generateHTMLReport(data, options);
                return new Blob([html], { type: 'text/html' });
            },
            filename: (type) => `${type}_export_${Date.now()}.html`,
            mimeType: 'text/html'
        });

        // XLSX Export Strategy
        this.exportStrategies.set('xlsx', {
            export: (data, options = {}) => {
                const csv = this.generateCSV(data, options);
                // In a real implementation, this would use a library like xlsx or exceljs
                // For now, we'll return CSV with .xlsx extension as placeholder
                return new Blob([csv], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            },
            filename: (type) => `${type}_export_${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
    }

    // Main Export Method
    async export(type, format = 'json', options = {}) {
        console.log(`Exporting ${type} as ${format}...`);
        
        try {
            // Validate inputs
            if (!this.supportedFormats.includes(format)) {
                throw new Error(`Unsupported format: ${format}`);
            }

            // Get data
            const data = await this.getExportData(type, options);
            
            // Use strategy pattern for export
            const strategy = this.exportStrategies.get(format);
            if (!strategy) {
                throw new Error(`No export strategy found for format: ${format}`);
            }

            // Generate export
            const blob = strategy.export(data, options);
            const filename = strategy.filename(type);
            
            // Download file
            this.downloadFile(blob, filename, strategy.mimeType);
            
            // Track export
            this.trackExport(type, format, filename);
            
            // Update UI
            this.updateExportUI(type, format, filename);
            
            console.log(`Successfully exported ${type} as ${format}`);
            return { success: true, filename, format };
            
        } catch (error) {
            console.error('Export failed:', error);
            this.updateExportUI(type, format, null, error);
            return { success: false, error: error.message };
        }
    }

    // Data Collection Methods
    async getExportData(type, options = {}) {
        switch (type) {
        case 'features':
            return this.createFeaturesExport(options);
        case 'metrics':
            return this.createMetricsExport(options);
        case 'quality-report':
            return this.createQualityReportExport(options);
        case 'comprehensive':
            return this.createComprehensiveExport(options);
        default:
            throw new Error(`Unknown export type: ${type}`);
        }
    }

    createFeaturesExport(options) {
        if (!this.currentData) {
            throw new Error('No data available for export - load data first');
        }
        const data = this.currentData;
        return {
            timestamp: new Date().toISOString(),
            export_type: 'features',
            data: {
                total_files: data.total_files,
                file_types: data.file_types,
                largest_files: data.largest_files,
                technology_stack: this.identifyTechnologyStack(data)
            }
        };
    }

    createMetricsExport(options) {
        if (!this.currentData) {
            throw new Error('No data available for export - load data first');
        }
        const data = this.currentData;
        return {
            timestamp: new Date().toISOString(),
            export_type: 'metrics',
            data: {
                total_files: data.total_files,
                total_directories: data.total_directories,
                project_depth: data.project_depth,
                file_type_distribution: this.analyzeFileDistribution(data)
            }
        };
    }

    createQualityReportExport(options) {
        return {
            timestamp: new Date().toISOString(),
            export_type: 'quality-report',
            data: {
                overall_score: 92,
                technical_debt: 'Low',
                recommendations: [
                    'Add more unit tests',
                    'Improve documentation coverage',
                    'Consider code refactoring for complex functions'
                ]
            }
        };
    }

    createComprehensiveExport(options) {
        if (!this.currentData) {
            throw new Error('No data available for export - load data first');
        }
        const data = this.currentData;
        return {
            timestamp: new Date().toISOString(),
            export_type: 'comprehensive',
            features: this.createFeaturesExport(options),
            metrics: this.createMetricsExport(options),
            quality: this.createQualityReportExport(options)
        };
    }

    // Utility Methods
    generateCSV(data, options = {}) {
        if (data.data?.file_types) {
            let csv = 'File Type,Count,Percentage\n';
            Object.entries(data.data.file_types).forEach(([ext, count]) => {
                const total = Object.values(data.data.file_types).reduce((a, b) => a + b, 0);
                const percentage = ((count / total) * 100).toFixed(1);
                csv += `"${ext}",${count},${percentage}%\n`;
            });
            return csv;
        }
        return 'No data available for CSV export';
    }

    generateHTMLReport(data, options = {}) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Dashboard Export Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Dashboard Export Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
    <div class="section">
        <h2>Export Data</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
    </div>
</body>
</html>`;
    }

    downloadFile(blob, filename, mimeType) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Scheduling Methods
    scheduleExport(options) {
        const {
            id = this.generateId(),
            name = options.name || 'Scheduled Export',
            type = options.type || 'features',
            format = options.format || this.config.defaultFormat,
            schedule = options.schedule,
            enabled = options.enabled !== false,
            recurring = options.recurring || false
        } = options;

        const scheduledExport = {
            id,
            name,
            type,
            format,
            schedule,
            enabled,
            recurring,
            createdAt: new Date().toISOString(),
            lastRun: null,
            nextRun: this.calculateNextRun(schedule)
        };

        this.scheduledExports.set(id, scheduledExport);
        this.saveScheduledExports();
        
        console.log(`Scheduled export: ${name} (${id})`);
        return id;
    }

    calculateNextRun(schedule) {
        // Simple scheduling logic - in real implementation would use cron expressions
        const now = new Date();
        const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        return nextRun.toISOString();
    }

    startScheduler() {
        setInterval(() => {
            this.processScheduledExports();
        }, 60000); // Check every minute
    }

    async processScheduledExports() {
        const now = new Date();
        
        for (const [id, scheduled] of this.scheduledExports) {
            if (!scheduled.enabled) {
                continue;
            }
            
            const nextRun = new Date(scheduled.nextRun);
            if (now >= nextRun) {
                console.log(`Running scheduled export: ${scheduled.name}`);
                await this.export(scheduled.type, scheduled.format);
                
                // Update schedule
                scheduled.lastRun = new Date().toISOString();
                scheduled.nextRun = this.calculateNextRun(scheduled.schedule);
                
                this.saveScheduledExports();
            }
        }
    }

    // History and Tracking
    trackExport(type, format, filename) {
        const exportRecord = {
            type,
            format,
            filename,
            timestamp: new Date().toISOString()
        };
        
        this.exportHistory.unshift(exportRecord);
        
        // Keep only last 20 exports
        if (this.exportHistory.length > 20) {
            this.exportHistory = this.exportHistory.slice(0, 20);
        }
        
        this.saveExportHistory();
    }

    loadExportHistory() {
        try {
            const saved = localStorage.getItem('dashboard_export_history');
            if (saved) {
                this.exportHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load export history:', error);
        }
    }

    saveExportHistory() {
        try {
            localStorage.setItem('dashboard_export_history', JSON.stringify(this.exportHistory));
        } catch (error) {
            console.error('Failed to save export history:', error);
        }
    }

    loadScheduledExports() {
        try {
            const saved = localStorage.getItem('dashboard_scheduled_exports');
            if (saved) {
                const data = JSON.parse(saved);
                this.scheduledExports = new Map(Object.entries(data));
            }
        } catch (error) {
            console.error('Failed to load scheduled exports:', error);
        }
    }

    saveScheduledExports() {
        try {
            const data = Object.fromEntries(this.scheduledExports);
            localStorage.setItem('dashboard_scheduled_exports', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save scheduled exports:', error);
        }
    }

    // UI Methods
    setupExportEventListeners() {
        document.getElementById('export-json-btn')?.addEventListener('click', () => {
            this.export('features', 'json');
        });
        
        document.getElementById('export-csv-btn')?.addEventListener('click', () => {
            this.export('metrics', 'csv');
        });
        
        document.getElementById('export-pdf-btn')?.addEventListener('click', () => {
            this.export('quality-report', 'pdf');
        });
        
        document.getElementById('export-clear-btn')?.addEventListener('click', () => {
            this.clearExports();
        });
    }

    updateExportUI(type, format, filename, error = null) {
        const resultsDiv = document.getElementById('export-results');
        const statusDiv = document.getElementById('export-status');
        
        if (resultsDiv) {
            if (error) {
                resultsDiv.textContent = `
                    <div class="export-error">
                        <h4>❌ Export Failed</h4>
                        <p>${error}</p>
                    </div>
                ` /* Replaced innerHTML with textContent for safety */
            } else {
                resultsDiv.textContent = `
                    <div class="export-success">
                        <h4>✅ Export Complete</h4>
                        <p>${type} exported as ${format}</p>
                        <p><strong>File:</strong> ${filename}</p>
                    </div>
                ` /* Replaced innerHTML with textContent for safety */
            }
        }
        
        if (statusDiv) {
            const message = error ? `Export failed: ${error}` : `${type} exported successfully`;
            const type = error ? 'error' : 'success';
            statusDiv.textContent = `<p class="status-${type}">${message}</p>` /* Replaced innerHTML with textContent for safety */
        }
    }

    clearExports() {
        this.exportHistory = [];
        this.saveExportHistory();
        
        const resultsDiv = document.getElementById('export-results');
        if (resultsDiv) {
            resultsDiv.textContent = `
                <div class="export-placeholder">
                    <h3>📤 Export Options</h3>
                    <p>Choose an export format to download your analysis results</p>
                </div>
            ` /* Replaced innerHTML with textContent for safety */
        }
        
        console.log('Export history cleared');
    }

    // Utility Methods
    generateId() {
        return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    identifyTechnologyStack(data) {
        const stack = [];
        const fileTypes = data.file_types || {};
        
        if (fileTypes['.html'] || fileTypes['.css'] || fileTypes['.js']) {
            stack.push('Web Technologies');
        }
        if (fileTypes['.py']) {
            stack.push('Python');
        }
        
        return stack;
    }

    analyzeFileDistribution(data) {
        const fileTypes = data.file_types || {};
        const total = Object.values(fileTypes).reduce((a, b) => a + b, 0);
        
        return Object.entries(fileTypes).map(([ext, count]) => ({
            extension: ext,
            count,
            percentage: ((count / total) * 100).toFixed(1)
        }));
    }

    // Public API
    setData(data) {
        this.currentData = data;
    }

    getExportHistory() {
        return [...this.exportHistory];
    }

    getScheduledExports() {
        return Array.from(this.scheduledExports.values());
    }

    cancelScheduledExport(id) {
        return this.scheduledExports.delete(id);
    }

    // Export Job Management
    createExportJob(type, format, options = {}) {
        const jobId = this.generateId();
        const job = {
            id: jobId,
            type,
            format,
            options,
            status: 'pending',
            createdAt: new Date().toISOString(),
            retryCount: 0,
            maxRetries: this.config.retryAttempts,
            error: null,
            filename: null
        };
        this.exportJobs.set(jobId, job);
        return jobId;
    }

    async processExportJob(jobId) {
        const job = this.exportJobs.get(jobId);
        if (!job) {
            throw new Error(`Export job ${jobId} not found`);
        }

        job.status = 'processing';
        job.startedAt = new Date().toISOString();
        this.saveExportJobs();

        try {
            const result = await this.export(job.type, job.format, job.options);
            
            if (result.success) {
                job.status = 'completed';
                job.completedAt = new Date().toISOString();
                job.filename = result.filename;
            } else {
                job.status = 'failed';
                job.error = result.error;
            }
        } catch (error) {
            job.status = 'failed';
            job.error = error.message;
        }

        this.saveExportJobs();
        return job;
    }

    async retryExport(jobId) {
        const job = this.exportJobs.get(jobId);
        if (!job) {
            throw new Error(`Export job ${jobId} not found`);
        }

        if (job.retryCount >= job.maxRetries) {
            throw new Error(`Export job ${jobId} has exceeded maximum retry attempts`);
        }

        job.status = 'retrying';
        job.retryCount += 1;
        job.retriedAt = new Date().toISOString();
        this.saveExportJobs();

        // Add delay before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

        return await this.processExportJob(jobId);
    }

    async retryExportByName(filename) {
        // Find job by filename
        for (const [jobId, job] of this.exportJobs) {
            if (job.filename === filename) {
                return await this.retryExport(jobId);
            }
        }
        throw new Error(`No export job found with filename: ${filename}`);
    }

    getExportJob(jobId) {
        return this.exportJobs.get(jobId);
    }

    getExportJobsByStatus(status) {
        return Array.from(this.exportJobs.values()).filter(job => job.status === status);
    }

    saveExportJobs() {
        try {
            const data = Object.fromEntries(this.exportJobs);
            localStorage.setItem('dashboard_export_jobs', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save export jobs:', error);
        }
    }

    loadExportJobs() {
        try {
            const saved = localStorage.getItem('dashboard_export_jobs');
            if (saved) {
                const data = JSON.parse(saved);
                this.exportJobs = new Map(Object.entries(data));
            }
        } catch (error) {
            console.error('Failed to load export jobs:', error);
        }
    }

    destroy() {
        this.exportStrategies.clear();
        this.exportTemplates.clear();
        this.scheduledExports.clear();
        this.exportJobs.clear();
    }
}

// Initialize export manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.exportManager = new ExportManager();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportManager;
}
