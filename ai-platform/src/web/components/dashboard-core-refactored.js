/**
 * Dashboard Core - Refactored Lightweight Manager
 * Now serves as orchestrator for focused modules
 */

import { AiBridge } from './core/AiBridge.js';
import { ChartController } from './core/ChartController.js';
import { DataEngine } from './core/DataEngine.js';
import { EventManager } from './core/EventManager.js';
import { ThemeManager } from './theme-manager-consolidated.js';

class DashboardManager {
    constructor() {
        this.initialized = false;
        
        // Core modules - each with single responsibility
        this.data = new DataEngine();
        this.charts = new ChartController(this.data);
        this.ai = new AiBridge(this.data);
        this.events = new EventManager();
        this.theme = new ThemeManager();
        
        // Setup module communication
        this.setupModuleCommunication();
    }

    setupModuleCommunication() {
        // Data engine events
        this.data.subscribe('data_loaded', (data) => {
            this.charts.updateCharts();
            this.updateUI(data);
            this.events.emit('dashboard_data_loaded', data);
        });

        // AI bridge events
        this.data.subscribe('ai_analysis_complete', (analysis) => {
            this.updateAiUI(analysis);
            this.events.emit('ai_analysis_ready', analysis);
        });

        // Event manager coordination
        this.events.on('export_requested', (request) => {
            this.handleExportRequest(request);
        });

        this.events.on('tab_changed', (data) => {
            this.handleTabChange(data);
        });
    }

    updateUI(data) {
        if (!data) {
            return;
        }

        // Project Statistics
        this.updateElementText('total-files', data.total_files.toLocaleString());
        this.updateElementText('total-directories', data.total_directories.toLocaleString());
        this.updateElementText('project-depth', data.depth);
        this.updateElementText('total-size', this.formatSize(data.total_size));

        // Quality Metrics
        if (data.metrics) {
            this.updateElementText('avg-quality', `${data.metrics.Quality}%`);
            this.updateElementText('avg-file-quality', `${data.metrics.Quality}%`);
        }
    }

    updateAiUI(analysis) {
        if (!analysis) {
            return;
        }

        // Update AI insights in the UI
        const techDebtElement = document.getElementById('tech-debt');
        if (techDebtElement) {
            techDebtElement.textContent = analysis.quality_assessment.technical_debt;
            techDebtElement.className = `metric-value debt-${analysis.quality_assessment.technical_debt.toLowerCase()}`;
        }

        const maintenanceElement = document.getElementById('maintenance-score');
        if (maintenanceElement) {
            maintenanceElement.textContent = analysis.quality_assessment.overall_score;
        }
    }

    updateElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    formatSize(bytes) {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async initialize() {
        if (this.initialized) {
            return;
        }
        
        console.log('Initializing dashboard...');
        
        try {
            // Initialize theme first
            this.theme.init();
            
            // Setup shortcuts button (delegation handled by switchTab if needed)
            const shortcutsBtn = document.getElementById('shortcuts-btn');
            if (shortcutsBtn) {
                shortcutsBtn.addEventListener('click', () => this.showShortcuts());
            }

            // Initialize event system
            this.events.initialize();
            
            // Load CSS
            await this.events.loadCSS('dashboard-styles.css');
            await this.events.loadCSS('../css/components.css');
            
            // Load all components in parallel for speed
            await this.loadInitialComponents();
            
            // Force initial tab display first
            this.events.switchTab('overview');

            // Load dashboard data
            await this.data.loadData();
            
            // Activate AI analysis
            await this.ai.activate();
            
            // Initialize charts (now that canvases are visible)
            this.charts.initializeCharts();
            
            this.initialized = true;
            console.log('Dashboard initialized successfully');
            
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.events.updateStatus('Dashboard initialization failed', 'error');
        }
    }

    async loadInitialComponents() {
        const components = [
            { name: 'dashboard-navigation', container: 'nav-container' },
            { name: 'overview-tab', container: 'overview-content' },
            { name: 'analysis-tab', container: 'analysis-content' },
            { name: 'directory-tab', container: 'directory-content' },
            { name: 'exports-tab', container: 'exports-content' },
            { name: 'ai-analysis-tab', container: 'ai-analysis-content' },
            { name: 'analytics-dashboard', container: 'analytics-content' },
            { name: 'predictions-dashboard', container: 'predictions-content' },
            { name: 'realtime-tab', container: 'realtime-content' },
            { name: 'export-scheduling-tab', container: 'scheduling-content' },
            { name: 'dir-analysis-tab', container: 'dir-analysis-content' },
            { name: 'ai-code-analysis-tab', container: 'ai-code-analysis-content' },
            { name: 'executive-summary-tab', container: 'executive-summary-content' }
        ];

        // Parallel loading
        await Promise.all(components.map(comp => 
            this.events.loadComponent(comp.name, comp.container)
        ));
    }

    handleExportRequest(request) {
        console.log(`Export requested: ${request.type} in ${request.format}`);
        
        const data = this.data.getData();
        if (!data) {
            this.events.updateStatus('No data available for export', 'error');
            return;
        }

        let exportData;
        
        switch(request.type) {
        case 'features':
            exportData = this.createFeaturesExport(data);
            break;
        case 'metrics':
            exportData = this.createMetricsExport(data);
            break;
        case 'quality-report':
            exportData = this.createQualityReportExport(data);
            break;
        default:
            exportData = { error: 'Unknown export type' };
        }

        this.downloadExport(exportData, request.type, request.format);
        this.events.trackExport(request.type, request.format, `${request.type}_export_${Date.now()}.${request.format}`);
        this.events.updateStatus(`${request.type} exported successfully`, 'success');
    }

    createFeaturesExport(data) {
        return {
            timestamp: new Date().toISOString(),
            export_type: 'features',
            data: {
                total_files: data.total_files,
                file_types: data.file_types,
                largest_files: data.largest_files,
                technology_stack: this.ai.identifyTechnologyStack(data)
            }
        };
    }

    createMetricsExport(data) {
        return {
            timestamp: new Date().toISOString(),
            export_type: 'metrics',
            data: {
                total_files: data.total_files,
                total_directories: data.total_directories,
                project_depth: data.depth,
                file_type_distribution: this.ai.analyzeFileDistribution(data)
            }
        };
    }

    createQualityReportExport(data) {
        const analysis = this.ai.getLatestAnalysis();
        return {
            timestamp: new Date().toISOString(),
            export_type: 'quality-report',
            data: {
                overall_score: analysis?.quality_assessment?.overall_score || 0,
                technical_debt: analysis?.quality_assessment?.technical_debt || 'Unknown',
                recommendations: analysis?.recommendations || []
            }
        };
    }

    downloadExport(exportData, type, format) {
        let blob, filename, contentType;
        
        if (format === 'csv') {
            const csvContent = this.generateCSV(exportData);
            blob = new Blob([csvContent], { type: 'text/csv' });
            contentType = 'CSV';
        } else {
            blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            contentType = 'JSON';
        }
        
        filename = `${type}_export_${Date.now()}.${format}`;
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    generateCSV(data) {
        // Simple CSV generation for basic exports
        if (data.data?.file_types) {
            let csv = 'File Type,Count\n';
            Object.entries(data.data.file_types).forEach(([ext, count]) => {
                csv += `"${ext}",${count}\n`;
            });
            return csv;
        }
        return 'No CSV data available';
    }

    handleTabChange(data) {
        console.log(`Tab changed to: ${data.tab}`);
        
        // Lazy load tab-specific components if needed
        switch(data.tab) {
        case 'analysis':
            this.charts.updateCharts();
            break;
        case 'ai-analysis':
            const analysis = this.ai.getLatestAnalysis();
            if (!analysis) {
                this.ai.generateAnalysis(this.data.getData());
            }
            break;
        }
    }

    // Public API methods
    getData() {
        return this.data.getData();
    }

    getCharts() {
        return this.charts.getAllCharts();
    }

    getAiAnalysis() {
        return this.ai.getLatestAnalysis();
    }

    getExportHistory() {
        return this.events.getExportHistory();
    }

    getCurrentTab() {
        return this.events.getCurrentTab();
    }

    async refreshData() {
        this.data.clearCache();
        return await this.data.loadData();
    }

    async switchTab(tabName) {
        this.events.switchTab(tabName);
    }

    showShortcuts() {
        const shortcuts = [
            { key: 'Ctrl + D', description: 'Toggle Dark Mode' },
            { key: 'Ctrl + ?', description: 'Show Shortcuts' },
            { key: 'Alt + 1-9', description: 'Switch Tabs' }
        ];

        const modal = document.createElement('div');
        modal.className = 'shortcuts-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>⌨️ Keyboard Shortcuts</h3>
                <div class="shortcuts-list">
                    ${shortcuts.map(s => `
                        <div class="shortcut-item">
                            <span class="key">${s.key}</span>
                            <span class="desc">${s.description}</span>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-primary close-modal">Close</button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        document.body.appendChild(modal);
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    destroy() {
        console.log('Destroying dashboard...');
        
        this.charts.destroyAllCharts();
        this.ai.deactivate();
        this.data.clearCache();
        
        this.initialized = false;
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardManager();
    window.dashboard.initialize();
});

// Export for module usage
export { DashboardManager };
