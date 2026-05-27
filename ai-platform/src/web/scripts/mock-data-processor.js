/**
 * Mock Data Processor - Dashboard Integration
 * Integrates with the enhanced mock data processing APIs
 */

class MockDataProcessor {
    constructor() {
        this.apiBase = 'http://localhost:3002/api';
        this.isProcessing = false;
        this.currentTask = null;
        this.results = {};
    }

    /**
     * Initialize the processor
     */
    async initialize() {
        console.log('🔧 Mock Data Processor initializing...');
        
        // Add UI controls to dashboard
        this.addUIControls();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('✅ Mock Data Processor ready');
    }

    /**
     * Add UI controls to the dashboard
     */
    addUIControls() {
        const controlsHTML = `
            <div id="mock-data-processor" class="mock-data-processor">
                <h3>🔧 Mock Data Processing Pipeline</h3>
                
                <div class="processor-controls">
                    <div class="control-group">
                        <h4>Project Analysis</h4>
                        <button id="analyze-structure" class="btn btn-primary">
                            📊 Analyze Structure
                        </button>
                        <button id="detect-backlog" class="btn btn-info">
                            📋 Detect Backlog
                        </button>
                    </div>
                    
                    <div class="control-group">
                        <h4>Mock Data Analysis</h4>
                        <button id="analyze-mock" class="btn btn-warning">
                            🔍 Analyze Mock Data
                        </button>
                        <button id="validate-data" class="btn btn-success">
                            ✅ Validate Data
                        </button>
                    </div>
                    
                    <div class="control-group">
                        <h4>Data Processing</h4>
                        <button id="convert-data" class="btn btn-secondary">
                            🔄 Convert Data
                        </button>
                        <button id="clean-data" class="btn btn-secondary">
                            🧹 Clean Data
                        </button>
                        <button id="generate-data" class="btn btn-info">
                            🎲 Generate Data
                        </button>
                    </div>
                    
                    <div class="control-group">
                        <h4>Export Options</h4>
                        <select id="export-format" class="form-select">
                            <option value="json">JSON</option>
                            <option value="csv">CSV</option>
                            <option value="xml">XML</option>
                            <option value="sql">SQL</option>
                        </select>
                        <button id="export-data" class="btn btn-primary">
                            📤 Export Data
                        </button>
                    </div>
                </div>
                
                <div class="processor-status">
                    <div id="processing-status" class="status-indicator">
                        <span class="status-idle">🔵 Ready</span>
                    </div>
                    <div id="processing-progress" class="progress-bar" style="display: none;">
                        <div class="progress-fill"></div>
                    </div>
                </div>
                
                <div id="processor-results" class="processor-results">
                    <h4>Results</h4>
                    <div id="results-content" class="results-content">
                        <p>No processing results yet. Start by analyzing the project structure.</p>
                    </div>
                </div>
            </div>
        `;

        // Insert controls into dashboard
        const dashboard = document.querySelector('.dashboard-content');
        if (dashboard) {
            dashboard.insertAdjacentHTML('beforeend', controlsHTML);
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Project Analysis
        document.getElementById('analyze-structure')?.addEventListener('click', () => {
            this.analyzeProjectStructure();
        });
        
        document.getElementById('detect-backlog')?.addEventListener('click', () => {
            this.detectBacklogItems();
        });
        
        // Mock Data Analysis
        document.getElementById('analyze-mock')?.addEventListener('click', () => {
            this.analyzeMockData();
        });
        
        document.getElementById('validate-data')?.addEventListener('click', () => {
            this.validateData();
        });
        
        // Data Processing
        document.getElementById('convert-data')?.addEventListener('click', () => {
            this.convertData();
        });
        
        document.getElementById('clean-data')?.addEventListener('click', () => {
            this.cleanData();
        });
        
        document.getElementById('generate-data')?.addEventListener('click', () => {
            this.generateData();
        });
        
        // Export
        document.getElementById('export-data')?.addEventListener('click', () => {
            this.exportData();
        });
    }

    /**
     * Update status indicator
     */
    updateStatus(status, message = '') {
        const statusElement = document.getElementById('processing-status');
        if (statusElement) {
            const statusHTML = {
                'idle': '<span class="status-idle">🔵 Ready</span>',
                'processing': '<span class="status-processing">🟡 Processing...</span>',
                'success': '<span class="status-success">🟢 Complete</span>',
                'error': '<span class="status-error">🔴 Error</span>'
            };
            
            statusElement.textContent = statusHTML[status] || statusHTML['idle'] /* Replaced innerHTML with textContent for safety */
            
            if (message) {
                statusElement.innerHTML += ` <small>${message}</small>`;
            }
        }
    }

    /**
     * Show progress bar
     */
    showProgress(show = true) {
        const progressElement = document.getElementById('processing-progress');
        if (progressElement) {
            progressElement.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Update progress
     */
    updateProgress(percentage) {
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
    }

    /**
     * Display results
     */
    displayResults(title, data) {
        const resultsElement = document.getElementById('results-content');
        if (resultsElement) {
            const formattedData = this.formatResults(data);
            resultsElement.textContent = `
                <div class="result-section">
                    <h5>${title}</h5>
                    <div class="result-data">
                        <pre>${formattedData}</pre>
                    </div>
                </div>
            ` /* Replaced innerHTML with textContent for safety */
        }
    }

    /**
     * Format results for display
     */
    formatResults(data) {
        if (typeof data === 'object') {
            return JSON.stringify(data, null, 2);
        }
        return String(data);
    }

    /**
     * Analyze project structure
     */
    async analyzeProjectStructure() {
        this.updateStatus('processing', 'Analyzing project structure...');
        this.showProgress(true);
        this.updateProgress(0);

        try {
            const response = await fetch(`${this.apiBase}/project-structure`);
            this.updateProgress(50);
            
            const result = await response.json();
            this.updateProgress(100);
            
            if (result.success) {
                this.updateStatus('success', 'Structure analysis complete');
                this.displayResults('Project Structure', result.data);
                this.results.structure = result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.updateStatus('error', 'Analysis failed');
            this.displayResults('Error', error.message);
        } finally {
            this.showProgress(false);
        }
    }

    /**
     * Detect backlog items
     */
    async detectBacklogItems() {
        this.updateStatus('processing', 'Detecting backlog items...');
        this.showProgress(true);
        this.updateProgress(0);

        try {
            const response = await fetch(`${this.apiBase}/backlog`);
            this.updateProgress(50);
            
            const result = await response.json();
            this.updateProgress(100);
            
            if (result.success) {
                this.updateStatus('success', 'Backlog detection complete');
                this.displayResults('Backlog Items', result.data);
                this.results.backlog = result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.updateStatus('error', 'Backlog detection failed');
            this.displayResults('Error', error.message);
        } finally {
            this.showProgress(false);
        }
    }

    /**
     * Analyze mock data
     */
    async analyzeMockData() {
        this.updateStatus('processing', 'Analyzing mock data...');
        this.showProgress(true);
        this.updateProgress(0);

        try {
            const response = await fetch(`${this.apiBase}/mock-analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    scanPath: null,
                    patterns: [],
                    options: {}
                })
            });
            
            this.updateProgress(50);
            
            const result = await response.json();
            this.updateProgress(100);
            
            if (result.success) {
                this.updateStatus('success', 'Mock analysis complete');
                this.displayResults('Mock Data Analysis', result.data);
                this.results.analysis = result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.updateStatus('error', 'Mock analysis failed');
            this.displayResults('Error', error.message);
        } finally {
            this.showProgress(false);
        }
    }

    /**
     * Validate data
     */
    async validateData() {
        this.updateStatus('processing', 'Validating data...');
        this.showProgress(true);
        this.updateProgress(0);

        try {
            const testData = this.results.analysis?.mockDataInstances || [];
            
            const response = await fetch(`${this.apiBase}/mock-validation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: testData,
                    schema: null,
                    options: {}
                })
            });
            
            this.updateProgress(50);
            
            const result = await response.json();
            this.updateProgress(100);
            
            if (result.success) {
                this.updateStatus('success', 'Data validation complete');
                this.displayResults('Data Validation', result.data);
                this.results.validation = result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.updateStatus('error', 'Data validation failed');
            this.displayResults('Error', error.message);
        } finally {
            this.showProgress(false);
        }
    }

    /**
     * Convert data
     */
    async convertData() {
        this.updateStatus('processing', 'Converting data...');
        this.showProgress(true);
        this.updateProgress(0);

        try {
            const format = document.getElementById('export-format')?.value || 'json';
            const testData = this.results.analysis?.patterns || [];
            
            const response = await fetch(`${this.apiBase}/mock-conversion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mockData: testData,
                    targetFormat: format,
                    options: {}
                })
            });
            
            this.updateProgress(50);
            
            const result = await response.json();
            this.updateProgress(100);
            
            if (result.success) {
                this.updateStatus('success', 'Data conversion complete');
                this.displayResults('Data Conversion', result.data);
                this.results.converted = result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.updateStatus('error', 'Data conversion failed');
            this.displayResults('Error', error.message);
        } finally {
            this.showProgress(false);
        }
    }

    /**
     * Clean data
     */
    async cleanData() {
        this.updateStatus('processing', 'Cleaning data...');
        this.showProgress(true);
        this.updateProgress(0);

        try {
            const testData = this.results.analysis?.patterns || [];
            const cleaningRules = ['remove_nulls', 'remove_empty', 'standardize_keys'];
            
            const response = await fetch(`${this.apiBase}/mock-cleaning`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: testData,
                    cleaningRules,
                    options: {}
                })
            });
            
            this.updateProgress(50);
            
            const result = await response.json();
            this.updateProgress(100);
            
            if (result.success) {
                this.updateStatus('success', 'Data cleaning complete');
                this.displayResults('Data Cleaning', result.data);
                this.results.cleaned = result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.updateStatus('error', 'Data cleaning failed');
            this.displayResults('Error', error.message);
        } finally {
            this.showProgress(false);
        }
    }

    /**
     * Generate data
     */
    async generateData() {
        this.updateStatus('processing', 'Generating data...');
        this.showProgress(true);
        this.updateProgress(0);

        try {
            const response = await fetch(`${this.apiBase}/mock-generation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pattern: 'user',
                    count: 10,
                    options: {}
                })
            });
            
            this.updateProgress(50);
            
            const result = await response.json();
            this.updateProgress(100);
            
            if (result.success) {
                this.updateStatus('success', 'Data generation complete');
                this.displayResults('Data Generation', result.data);
                this.results.generated = result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.updateStatus('error', 'Data generation failed');
            this.displayResults('Error', error.message);
        } finally {
            this.showProgress(false);
        }
    }

    /**
     * Export data
     */
    async exportData() {
        this.updateStatus('processing', 'Exporting data...');
        this.showProgress(true);
        this.updateProgress(0);

        try {
            const format = document.getElementById('export-format')?.value || 'json';
            const data = this.results.generated?.data || this.results.converted?.data || [];
            
            const response = await fetch(`${this.apiBase}/mock-export?format=${format}&data=${encodeURIComponent(JSON.stringify(data))}&filename=mock-data.${format}`);
            
            this.updateProgress(50);
            
            if (format === 'csv' || format === 'xml') {
                // Handle file download
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mock-data.${format}`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                // Handle JSON response
                const result = await response.json();
                this.displayResults('Export Result', result);
            }
            
            this.updateProgress(100);
            this.updateStatus('success', 'Data export complete');
        } catch (error) {
            this.updateStatus('error', 'Data export failed');
            this.displayResults('Error', error.message);
        } finally {
            this.showProgress(false);
        }
    }
}

// Initialize the processor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const processor = new MockDataProcessor();
    processor.initialize();
});

// Export for use in other modules
window.MockDataProcessor = MockDataProcessor;
