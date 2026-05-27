/**
 * Event Manager - Centralized event coordination and component loading
 */

export class EventManager {
    constructor() {
        this.eventListeners = new Map();
        this.componentLoader = new ComponentLoader();
        this.currentTab = 'overview';
        this.exportHistory = [];
        this.selectedFormat = 'json';
    }

    initialize() {
        console.log('Initializing event manager...');
        this.setupEventListeners();
        this.loadExportHistory();
    }

    setupEventListeners() {
        // Broad event delegation for all dashboard interactions
        document.addEventListener('click', (e) => {
            // Handle Navigation Tabs
            const tab = e.target.closest('.nav-tab');
            if (tab && tab.dataset.tab) {
                this.switchTab(tab.dataset.tab);
                return;
            }

            // Handle Export Buttons (even in dynamic tabs)
            const exportBtn = e.target.closest('[id^="export-"]');
            if (exportBtn) {
                const id = exportBtn.id;
                if (id === 'export-json-btn') {
                    this.emit('export_requested', { type: 'features', format: 'json' });
                }
                if (id === 'export-csv-btn') {
                    this.emit('export_requested', { type: 'metrics', format: 'csv' });
                }
                if (id === 'export-pdf-btn') {
                    this.emit('export_requested', { type: 'quality-report', format: 'pdf' });
                }
                if (id === 'export-clear-btn') {
                    this.emit('export_clear_requested');
                }
                return;
            }

            // Handle AI Analysis buttons
            const aiBtn = e.target.closest('.ai-controls .btn-primary');
            if (aiBtn) {
                this.emit('ai_analysis_requested');
                return;
            }
        });

        // Format selector (delegation)
        document.addEventListener('change', (e) => {
            if (e.target.id === 'format-select') {
                this.selectedFormat = e.target.value;
                this.emit('format_changed', { format: e.target.value });
            }
        });
    }

    switchTab(tabName) {
        console.log(`EventManager: Switching to tab: ${tabName}`);

        // Update currentTab immediately
        this.currentTab = tabName;

        // Update UI state
        this.updateTabUI(tabName);

        // Notify other modules
        this.emit('tab_changed', { tab: tabName });
    }

    updateTabUI(tabName) {
        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content visibility
        let containerFound = false;
        document.querySelectorAll('.tab-content').forEach(content => {
            const isMatch = content.id === `${tabName}-content`;
            content.classList.toggle('active', isMatch);
            if (isMatch) {
                containerFound = true;
                // Force visibility for the active tab
                content.style.display = 'block';
            } else {
                content.style.display = 'none';
            }
        });

        if (!containerFound) {
            console.warn(`EventManager: No content container found for tab: ${tabName}`);
        }
    }

    async loadComponent(componentName, containerId) {
        try {
            const result = await this.componentLoader.loadComponent(componentName, containerId);
            this.emit('component_loaded', { name: componentName, success: result });
            return result;
        } catch (error) {
            console.error(`Failed to load component ${componentName}:`, error);
            this.emit('component_load_error', { name: componentName, error });
            return false;
        }
    }

    async loadCSS(filename) {
        try {
            const result = await this.componentLoader.loadCSS(filename);
            this.emit('css_loaded', { filename, success: result });
            return result;
        } catch (error) {
            console.error(`Failed to load CSS ${filename}:`, error);
            this.emit('css_load_error', { filename, error });
            return false;
        }
    }

    // Event system methods
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }

    emit(event, data = {}) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // Export management
    loadExportHistory() {
        try {
            const saved = localStorage.getItem('dashboard_export_history');
            if (saved) {
                this.exportHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load export history:', error);
            this.exportHistory = [];
        }
    }

    saveExportHistory() {
        try {
            localStorage.setItem('dashboard_export_history', JSON.stringify(this.exportHistory));
        } catch (error) {
            console.error('Failed to save export history:', error);
        }
    }

    trackExport(type, format, filename) {
        const exportRecord = {
            type,
            format,
            filename,
            timestamp: new Date().toISOString()
        };

        this.exportHistory.unshift(exportRecord);

        // Keep only last 10 exports
        if (this.exportHistory.length > 10) {
            this.exportHistory = this.exportHistory.slice(0, 10);
        }

        this.saveExportHistory();
        this.emit('export_tracked', exportRecord);
    }

    getExportHistory() {
        return this.exportHistory;
    }

    clearExportHistory() {
        this.exportHistory = [];
        this.saveExportHistory();
        this.emit('export_history_cleared');
    }

    // Status updates
    updateStatus(message, type = 'info') {
        const statusDiv = document.getElementById('export-status');
        if (statusDiv) {
            statusDiv.textContent = `<p class="status-${type}">${message}</p>` /* Replaced innerHTML with textContent for safety */
        }
        this.emit('status_updated', { message, type });
    }

    // Utility methods
    getCurrentTab() {
        return this.currentTab;
    }

    getSelectedFormat() {
        return this.selectedFormat;
    }

    setSelectedFormat(format) {
        this.selectedFormat = format;
        this.emit('format_changed', { format });
    }
}

// Component Loader (extracted from original dashboard-core.js)
class ComponentLoader {
    constructor() {
        this.components = new Map();
        this.loadedComponents = new Set();
        this.pendingRequests = new Map();
    }

    async loadComponent(componentName, containerId) {
        if (this.pendingRequests.has(componentName)) {
            console.log(`Component ${componentName} already loading, waiting...`);
            return this.pendingRequests.get(componentName);
        }

        if (this.loadedComponents.has(componentName)) {
            console.log(`Component ${componentName} already loaded, skipping...`);
            return Promise.resolve(true);
        }

        const loadingPromise = this._loadComponentInternal(componentName, containerId);
        this.pendingRequests.set(componentName, loadingPromise);

        try {
            const result = await loadingPromise;
            this.loadedComponents.add(componentName);
            return result;
        } finally {
            this.pendingRequests.delete(componentName);
        }
    }

    async _loadComponentInternal(componentName, containerId) {
        try {
            console.log(`Loading component: ${componentName}`);
            const response = await fetch(`dashboard_components/${componentName}.html`);

            if (!response.ok) {
                console.warn(`Component ${componentName} not found (HTTP ${response.status}), using fallback`);
                this.createFallbackComponent(componentName, containerId);
                return true;
            }

            const html = await response.text();
            const container = document.getElementById(containerId);
            if (container) {
                container.textContent = html /* Replaced innerHTML with textContent for safety */
            }
            console.log(`Component ${componentName} loaded successfully`);
            return true;
        } catch (error) {
            console.error(`Failed to load component ${componentName}:`, error);
            this.createFallbackComponent(componentName, containerId);
            return false;
        }
    }

    createFallbackComponent(componentName, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        const fallbackContent = this.getErrorContent(componentName);
        container.textContent = fallbackContent /* Replaced innerHTML with textContent for safety */
        console.log(`Created error component for ${componentName}`);
    }

    getErrorContent(componentName) {
        return `
            <div class="component-error">
                <h4>⚠️ Component Error</h4>
                <p>Failed to load ${componentName} component</p>
                <p>Please refresh the page or check the console for details</p>
            </div>
        `;
    }

    async loadCSS(filename) {
        try {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `dashboard_components/${filename}`;
            document.head.appendChild(link);
            return true;
        } catch (error) {
            console.error(`Failed to load CSS ${filename}:`, error);
            return false;
        }
    }
}
