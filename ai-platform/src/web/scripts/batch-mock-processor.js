/**
 * Batch Mock Data Processor - Dashboard Integration
 * Enhanced version for batch processing capabilities
 */

class BatchMockProcessor {
    constructor() {
        this.apiBase = 'http://localhost:3002/api';
        this.isProcessing = false;
        this.currentTask = null;
        this.batchResults = null;
    }

    /**
     * Initialize the batch processor
     */
    async initialize() {
        console.log('🔧 Batch Mock Processor initializing...');
        
        // Add UI controls to dashboard
        this.addBatchUIControls();
        
        // Set up event listeners
        this.setupBatchEventListeners();
        
        console.log('✅ Batch Mock Processor ready');
    }

    /**
     * Add batch processing UI controls to dashboard
     */
    addBatchUIControls() {
        const batchControlsHTML = `
            <div id="batch-mock-processor" class="batch-mock-processor">
                <h3>🔄 Batch Mock Data Processing</h3>
                
                <div class="batch-controls">
                    <div class="control-group">
                        <h4>File Selection</h4>
                        <div class="file-selection">
                            <div class="selection-method">
                                <label>
                                    <input type="radio" name="selectionMethod" value="files" checked>
                                    Select Files
                                </label>
                                <label>
                                    <input type="radio" name="selectionMethod" value="directory">
                                    Directory Scan
                                </label>
                                <label>
                                    <input type="radio" name="selectionMethod" value="pattern">
                                    Pattern Match
                                </label>
                            </div>
                            
                            <div class="files-input" id="files-input">
                                <textarea id="file-list" placeholder="Enter file paths (one per line)" rows="5"></textarea>
                                <button id="browse-files" class="btn btn-secondary">📁 Browse Files</button>
                            </div>
                            
                            <div class="directory-input" id="directory-input" style="display: none;">
                                <input type="text" id="directory-path" placeholder="Enter directory path" class="form-control">
                                <button id="browse-directory" class="btn btn-secondary">📁 Browse Directory</button>
                            </div>
                            
                            <div class="pattern-input" id="pattern-input" style="display: none;">
                                <input type="text" id="pattern" placeholder="Enter pattern (e.g., **/*.json)" class="form-control">
                                <small class="form-text">Use * as wildcard, ** for recursive</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <h4>Cleaning Rules</h4>
                        <div class="cleaning-rules">
                            <label>
                                <input type="checkbox" name="cleaningRules" value="remove_nulls" checked>
                                Remove null/undefined values
                            </label>
                            <label>
                                <input type="checkbox" name="cleaningRules" value="remove_empty" checked>
                                Remove empty objects
                            </label>
                            <label>
                                <input type="checkbox" name="cleaningRules" value="standardize_keys" checked>
                                Standardize key names
                            </label>
                            <label>
                                <input type="checkbox" name="cleaningRules" value="remove_duplicates">
                                Remove duplicates
                            </label>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <h4>Processing Options</h4>
                        <div class="processing-options">
                            <label>
                                Max Concurrency:
                                <input type="number" id="max-concurrency" value="10" min="1" max="20" class="form-control">
                            </label>
                            <label>
                                <input type="checkbox" id="create-backups">
                                Create backup copies
                            </label>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <h4>Actions</h4>
                        <div class="batch-actions">
                            <button id="start-batch-cleaning" class="btn btn-primary">
                                🚀 Start Batch Cleaning
                            </button>
                            <button id="stop-batch-cleaning" class="btn btn-danger" disabled>
                                ⏹️ Stop Processing
                            </button>
                            <button id="clear-results" class="btn btn-secondary">
                                🗑️ Clear Results
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="batch-status">
                    <div id="batch-processing-status" class="status-indicator">
                        <span class="status-idle">🔵 Ready for batch processing</span>
                    </div>
                    <div id="batch-progress" class="progress-bar" style="display: none;">
                        <div class="progress-fill"></div>
                        <span class="progress-text">0%</span>
                    </div>
                </div>
                
                <div id="batch-results" class="batch-results">
                    <h4>Batch Results</h4>
                    <div id="batch-results-content" class="results-content">
                        <p>No batch processing results yet. Start by selecting files and clicking "Start Batch Cleaning".</p>
                    </div>
                </div>
            </div>
        `;

        // Insert controls into dashboard
        const dashboard = document.querySelector('.dashboard-content');
        if (dashboard) {
            dashboard.insertAdjacentHTML('beforeend', batchControlsHTML);
        }
    }

    /**
     * Set up event listeners for batch processing
     */
    setupBatchEventListeners() {
        // Selection method change
        document.querySelectorAll('input[name="selectionMethod"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleSelectionMethodChange(e.target.value);
            });
        });

        // File selection
        document.getElementById('browse-files')?.addEventListener('click', () => {
            this.browseFiles();
        });

        document.getElementById('browse-directory')?.addEventListener('click', () => {
            this.browseDirectory();
        });

        // Batch actions
        document.getElementById('start-batch-cleaning')?.addEventListener('click', () => {
            this.startBatchCleaning();
        });

        document.getElementById('stop-batch-cleaning')?.addEventListener('click', () => {
            this.stopBatchCleaning();
        });

        document.getElementById('clear-results')?.addEventListener('click', () => {
            this.clearResults();
        });
    }

    /**
     * Handle selection method change
     */
    handleSelectionMethodChange(method) {
        // Hide all input sections
        document.getElementById('files-input').style.display = 'none';
        document.getElementById('directory-input').style.display = 'none';
        document.getElementById('pattern-input').style.display = 'none';

        // Show the selected input section
        document.getElementById(`${method}-input`).style.display = 'block';
    }

    /**
     * Browse for files
     */
    browseFiles() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.json';
        
        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            const filePaths = files.map(file => file.path);
            document.getElementById('file-list').value = filePaths.join('\n');
        });
        
        input.click();
    }

    /**
     * Browse for directory
     */
    browseDirectory() {
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        
        input.addEventListener('change', (e) => {
            const directory = e.target.files[0];
            if (directory) {
                document.getElementById('directory-path').value = directory.path;
            }
        });
        
        input.click();
    }

    /**
     * Start batch cleaning process
     */
    async startBatchCleaning() {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.updateBatchStatus('processing', 'Initializing batch cleaning...');
        this.showBatchProgress(true);

        try {
            const requestData = this.buildBatchRequest();
            
            // Show progress tracking
            this.startProgressTracking();
            
            const response = await fetch(`${this.apiBase}/mock-cleaning-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (result.success) {
                this.updateBatchStatus('success', 'Batch cleaning completed!');
                this.displayBatchResults(result.data);
                this.batchResults = result.data;
            } else {
                throw new Error(result.error || 'Batch cleaning failed');
            }
        } catch (error) {
            this.updateBatchStatus('error', `Batch cleaning failed: ${error.message}`);
            this.displayBatchResults({ error: error.message });
        } finally {
            this.isProcessing = false;
            this.showBatchProgress(false);
            this.updateBatchControls(true);
        }
    }

    /**
     * Stop batch cleaning process
     */
    stopBatchCleaning() {
        if (!this.isProcessing) {
            return;
        }

        this.isProcessing = false;
        this.updateBatchStatus('stopped', 'Batch cleaning stopped by user');
        this.showBatchProgress(false);
        this.updateBatchControls(true);
    }

    /**
     * Clear results
     */
    clearResults() {
        this.batchResults = null;
        const resultsContent = document.getElementById('batch-results-content');
        if (resultsContent) {
            resultsContent.textContent = '<p>No batch processing results yet. Start by selecting files and clicking "Start Batch Cleaning".</p>' /* Replaced innerHTML with textContent for safety */
        }
    }

    /**
     * Build batch request data
     */
    buildBatchRequest() {
        const selectionMethod = document.querySelector('input[name="selectionMethod"]:checked')?.value || 'files';
        const cleaningRules = Array.from(document.querySelectorAll('input[name="cleaningRules"]:checked'))
            .map(checkbox => checkbox.value);
        const maxConcurrency = parseInt(document.getElementById('max-concurrency')?.value) || 10;
        const createBackups = document.getElementById('create-backups')?.checked || false;

        const requestData = {
            cleaningRules,
            options: {
                maxConcurrency,
                createBackups
            }
        };

        // Add files based on selection method
        if (selectionMethod === 'files') {
            const fileText = document.getElementById('file-list')?.value || '';
            requestData.files = fileText.split('\n').filter(path => path.trim()).map(path => path.trim());
        } else if (selectionMethod === 'directory') {
            requestData.directory = document.getElementById('directory-path')?.value;
        } else if (selectionMethod === 'pattern') {
            requestData.pattern = document.getElementById('pattern')?.value;
        }

        return requestData;
    }

    /**
     * Start progress tracking
     */
    startProgressTracking() {
        let progress = 0;
        const progressInterval = setInterval(() => {
            if (!this.isProcessing) {
                clearInterval(progressInterval);
                return;
            }
            
            progress = Math.min(progress + 5, 95);
            this.updateBatchProgress(progress);
        }, 500);
    }

    /**
     * Update batch status indicator
     */
    updateBatchStatus(status, message = '') {
        const statusElement = document.getElementById('batch-processing-status');
        if (statusElement) {
            const statusHTML = {
                'idle': '<span class="status-idle">🔵 Ready for batch processing</span>',
                'processing': '<span class="status-processing">🟡 Processing...</span>',
                'success': '<span class="status-success">🟢 Complete</span>',
                'error': '<span class="status-error">🔴 Error</span>',
                'stopped': '<span class="status-stopped">⏹️ Stopped</span>'
            };
            
            statusElement.textContent = statusHTML[status] || statusHTML['idle'] /* Replaced innerHTML with textContent for safety */
            
            if (message) {
                statusElement.innerHTML += ` <small>${message}</small>`;
            }
        }
    }

    /**
     * Show/hide batch progress bar
     */
    showBatchProgress(show = true) {
        const progressElement = document.getElementById('batch-progress');
        if (progressElement) {
            progressElement.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Update batch progress
     */
    updateBatchProgress(percentage) {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${percentage}%`;
        }
    }

    /**
     * Update batch control buttons
     */
    updateBatchControls(enabled) {
        const startBtn = document.getElementById('start-batch-cleaning');
        const stopBtn = document.getElementById('stop-batch-cleaning');
        
        if (startBtn) {
            startBtn.disabled = !enabled;
        }
        
        if (stopBtn) {
            stopBtn.disabled = enabled;
        }
    }

    /**
     * Display batch results
     */
    displayBatchResults(data) {
        const resultsElement = document.getElementById('batch-results-content');
        if (resultsElement) {
            if (data.error) {
                resultsElement.textContent = `
                    <div class="alert alert-error">
                        <h5>❌ Error</h5>
                        <p>${data.error}</p>
                    </div>
                ` /* Replaced innerHTML with textContent for safety */
            } else {
                const formattedResults = this.formatBatchResults(data);
                resultsElement.textContent = formattedResults /* Replaced innerHTML with textContent for safety */
            }
        }
    }

    /**
     * Format batch results for display
     */
    formatBatchResults(data) {
        const summary = data.summary || {};
        const cleanedFiles = data.cleanedFiles || [];
        const statistics = data.statistics || {};

        return `
            <div class="batch-summary">
                <h5>📊 Summary</h5>
                <div class="summary-stats">
                    <div class="stat-item">
                        <span class="stat-label">Files Cleaned:</span>
                        <span class="stat-value">${summary.filesCleaned || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Issues Resolved:</span>
                        <span class="stat-value">${summary.issuesResolved || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Data Optimization:</span>
                        <span class="stat-value">${summary.dataOptimization || '0%'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Duplicates Removed:</span>
                        <span class="stat-value">${summary.duplicatesRemoved || 0}</span>
                    </div>
                </div>
            </div>
            
            <div class="cleaned-files">
                <h5>📁 Cleaned Files (${cleanedFiles.length})</h5>
                <div class="files-list">
                    ${cleanedFiles.map((file, index) => `
                        <div class="file-item">
                            <div class="file-info">
                                <span class="file-name">${file.originalFile}</span>
                                <span class="file-arrow">→</span>
                                <span class="file-name">${file.cleanedFile}</span>
                            </div>
                            <div class="file-stats">
                                <span class="issues-fixed">Issues: ${file.issuesFixed}</span>
                                <span class="optimization">Optimization: ${file.optimization || '0%'}</span>
                                ${file.duplicates ? `<span class="duplicates">Duplicates: ${file.duplicates}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="statistics">
                <h5>📈 Statistics</h5>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Total Optimization:</span>
                        <span class="stat-value">${statistics.totalOptimization || '0%'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Duplicate Reduction:</span>
                        <span class="stat-value">${statistics.duplicateReduction || 0}</span>
                    </div>
                </div>
            </div>
            
            <div class="batch-actions">
                <button id="export-results" class="btn btn-primary">
                    📤 Export Results
                </button>
                <button id="download-cleaned-files" class="btn btn-success">
                    💾 Download Cleaned Files
                </button>
            </div>
        `;
    }
}

// Initialize the batch processor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const batchProcessor = new BatchMockProcessor();
    batchProcessor.initialize();
});

// Export for use in other modules
window.BatchMockProcessor = BatchMockProcessor;
