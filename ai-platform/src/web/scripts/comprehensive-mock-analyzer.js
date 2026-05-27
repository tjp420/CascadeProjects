/**
 * Comprehensive Mock Data Analyzer - Dashboard Integration
 * Enhanced version for comprehensive mock data analysis capabilities
 */

class ComprehensiveMockAnalyzer {
    constructor() {
        this.apiBase = 'http://localhost:3002/api';
        this.isAnalyzing = false;
        this.currentAnalysis = null;
        this.analysisResults = null;
    }

    /**
     * Initialize the comprehensive analyzer
     */
    async initialize() {
        console.log('🔍 Comprehensive Mock Analyzer initializing...');
        
        // Add UI controls to dashboard
        this.addAnalysisUIControls();
        
        // Set up event listeners
        this.setupAnalysisEventListeners();
        
        console.log('✅ Comprehensive Mock Analyzer ready');
    }

    /**
     * Add comprehensive analysis UI controls to dashboard
     */
    addAnalysisUIControls() {
        const analysisControlsHTML = `
            <div id="comprehensive-mock-analyzer" class="comprehensive-mock-analyzer">
                <h3>🔍 Comprehensive Mock Data Analysis</h3>
                
                <div class="analysis-controls">
                    <div class="control-group">
                        <h4>Analysis Scope</h4>
                        <div class="scope-selection">
                            <div class="selection-method">
                                <label>
                                    <input type="radio" name="analysisScope" value="project" checked>
                                    Full Project Analysis
                                </label>
                                <label>
                                    <input type="radio" name="analysisScope" value="directory">
                                    Directory Analysis
                                </label>
                                <label>
                                    <input type="radio" name="analysisScope" value="pattern">
                                    Pattern-based Analysis
                                </label>
                            </div>
                            
                            <div class="project-input" id="project-input">
                                <input type="text" id="project-path" placeholder="Project root path" class="form-control" value="C:/Users/Trevor/CascadeProjects/ai-platform">
                                <button id="browse-project" class="btn btn-secondary">📁 Browse</button>
                            </div>
                            
                            <div class="directory-input" id="directory-input" style="display: none;">
                                <input type="text" id="directory-path" placeholder="Enter directory path" class="form-control">
                                <button id="browse-directory" class="btn btn-secondary">📁 Browse</button>
                            </div>
                            
                            <div class="pattern-input" id="pattern-input" style="display: none;">
                                <label>Include Patterns:</label>
                                <div class="pattern-list">
                                    <label><input type="checkbox" name="includePatterns" value="**/*.json" checked> JSON files</label>
                                    <label><input type="checkbox" name="includePatterns" value="**/*.xml"> XML files</label>
                                    <label><input type="checkbox" name="includePatterns" value="**/*.csv"> CSV files</label>
                                    <label><input type="checkbox" name="includePatterns" value="**/*.js"> JS files</label>
                                    <label><input type="checkbox" name="includePatterns" value="**/*.txt"> TXT files</label>
                                    <label><input type="checkbox" name="includePatterns" value="**/*.html"> HTML files</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <h4>Exclusion Patterns</h4>
                        <div class="exclusion-patterns">
                            <label><input type="checkbox" name="excludePatterns" value="node_modules/**" checked> node_modules</label>
                            <label><input type="checkbox" name="excludePatterns" value=".git/**" checked> .git</label>
                            <label><input type="checkbox" name="excludePatterns" value="dist/**" checked> dist</label>
                            <label><input type="checkbox" name="excludePatterns" value="build/**" checked> build</label>
                            <label><input type="checkbox" name="excludePatterns" value="coverage/**" checked> coverage</label>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <h4>Analysis Options</h4>
                        <div class="analysis-options">
                            <label>
                                <input type="checkbox" name="analysisOptions" value="deepScan" checked>
                                Deep Content Analysis
                            </label>
                            <label>
                                <input type="checkbox" name="analysisOptions" value="detectDuplicates" checked>
                                Detect Duplicate Data
                            </label>
                            <label>
                                <input type="checkbox" name="analysisOptions" value="validateSyntax" checked>
                                Validate Syntax
                            </label>
                            <label>
                                Quality Threshold:
                                <input type="number" id="quality-threshold" value="80" min="0" max="100" class="form-control">
                            </label>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <h4>Actions</h4>
                        <div class="analysis-actions">
                            <button id="start-analysis" class="btn btn-primary">
                                🔍 Start Analysis
                            </button>
                            <button id="stop-analysis" class="btn btn-danger" disabled>
                                ⏹️ Stop Analysis
                            </button>
                            <button id="export-results" class="btn btn-secondary">
                                📤 Export Results
                            </button>
                            <button id="clear-results" class="btn btn-secondary">
                                🗑️ Clear Results
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="analysis-status">
                    <div id="analysis-processing-status" class="status-indicator">
                        <span class="status-idle">🔵 Ready for analysis</span>
                    </div>
                    <div id="analysis-progress" class="progress-bar" style="display: none;">
                        <div class="progress-fill"></div>
                        <span class="progress-text">0%</span>
                    </div>
                </div>
                
                <div id="analysis-results" class="analysis-results">
                    <h4>Analysis Results</h4>
                    <div id="analysis-results-content" class="results-content">
                        <p>No analysis results yet. Configure analysis options and click "Start Analysis".</p>
                    </div>
                </div>
            </div>
        `;

        // Insert controls into dashboard
        const dashboard = document.querySelector('.dashboard-content');
        if (dashboard) {
            dashboard.insertAdjacentHTML('beforeend', analysisControlsHTML);
        }
    }

    /**
     * Set up event listeners for analysis
     */
    setupAnalysisEventListeners() {
        // Analysis scope change
        document.querySelectorAll('input[name="analysisScope"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleAnalysisScopeChange(e.target.value);
            });
        });

        // Browse buttons
        document.getElementById('browse-project')?.addEventListener('click', () => {
            this.browseProject();
        });

        document.getElementById('browse-directory')?.addEventListener('click', () => {
            this.browseDirectory();
        });

        // Analysis actions
        document.getElementById('start-analysis')?.addEventListener('click', () => {
            this.startAnalysis();
        });

        document.getElementById('stop-analysis')?.addEventListener('click', () => {
            this.stopAnalysis();
        });

        document.getElementById('export-results')?.addEventListener('click', () => {
            this.exportResults();
        });

        document.getElementById('clear-results')?.addEventListener('click', () => {
            this.clearResults();
        });
    }

    /**
     * Handle analysis scope change
     */
    handleAnalysisScopeChange(scope) {
        // Hide all input sections
        document.getElementById('project-input').style.display = 'none';
        document.getElementById('directory-input').style.display = 'none';
        document.getElementById('pattern-input').style.display = 'none';

        // Show the selected input section
        document.getElementById(`${scope}-input`).style.display = 'block';
    }

    /**
     * Browse for project directory
     */
    browseProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        
        input.addEventListener('change', (e) => {
            const directory = e.target.files[0];
            if (directory) {
                document.getElementById('project-path').value = directory.path;
            }
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
     * Start comprehensive analysis
     */
    async startAnalysis() {
        if (this.isAnalyzing) {
            return;
        }

        this.isAnalyzing = true;
        this.updateAnalysisStatus('processing', 'Initializing comprehensive analysis...');
        this.showAnalysisProgress(true);

        try {
            const requestData = this.buildAnalysisRequest();
            
            // Show progress tracking
            this.startProgressTracking();
            
            const response = await fetch(`${this.apiBase}/mock-data-analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (result.success) {
                this.updateAnalysisStatus('success', 'Analysis completed!');
                this.displayAnalysisResults(result.data);
                this.analysisResults = result.data;
            } else {
                throw new Error(result.error || 'Analysis failed');
            }
        } catch (error) {
            this.updateAnalysisStatus('error', `Analysis failed: ${error.message}`);
            this.displayAnalysisResults({ error: error.message });
        } finally {
            this.isAnalyzing = false;
            this.showAnalysisProgress(false);
            this.updateAnalysisControls(true);
        }
    }

    /**
     * Stop analysis process
     */
    stopAnalysis() {
        if (!this.isAnalyzing) {
            return;
        }

        this.isAnalyzing = false;
        this.updateAnalysisStatus('stopped', 'Analysis stopped by user');
        this.showAnalysisProgress(false);
        this.updateAnalysisControls(true);
    }

    /**
     * Clear results
     */
    clearResults() {
        this.analysisResults = null;
        const resultsContent = document.getElementById('analysis-results-content');
        if (resultsContent) {
            resultsContent.textContent = '<p>No analysis results yet. Configure analysis options and click "Start Analysis".</p>' /* Replaced innerHTML with textContent for safety */
        }
    }

    /**
     * Export results
     */
    exportResults() {
        if (!this.analysisResults) {
            alert('No analysis results to export');
            return;
        }

        const dataStr = JSON.stringify(this.analysisResults, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `mock-data-analysis-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        window.URL.revokeObjectURL(url);
    }

    /**
     * Build analysis request data
     */
    buildAnalysisRequest() {
        const analysisScope = document.querySelector('input[name="analysisScope"]:checked')?.value || 'project';
        const analysisOptions = {
            deepScan: document.querySelector('input[name="analysisOptions"][value="deepScan"]')?.checked || false,
            detectDuplicates: document.querySelector('input[name="analysisOptions"][value="detectDuplicates"]')?.checked || false,
            validateSyntax: document.querySelector('input[name="analysisOptions"][value="validateSyntax"]?.checked || false,
            qualityThreshold: parseInt(document.getElementById('quality-threshold')?.value) || 80
        };

        const requestData = {
            analysisOptions
        };

        // Add scan path based on scope
        if (analysisScope === 'project') {
            requestData.scanPath = document.getElementById('project-path')?.value;
        } else if (analysisScope === 'directory') {
            requestData.scanPath = document.getElementById('directory-path')?.value;
        } else if (analysisScope === 'pattern') {
            requestData.scanPath = document.getElementById('project-path')?.value;
            requestData.includePatterns = Array.from(document.querySelectorAll('input[name="includePatterns"]:checked'))
                .map(checkbox => checkbox.value);
        }

        // Add exclude patterns
        requestData.excludePatterns = Array.from(document.querySelectorAll('input[name="excludePatterns"]:checked'))
            .map(checkbox => checkbox.value);

        return requestData;
    }

    /**
     * Start progress tracking
     */
    startProgressTracking() {
        let progress = 0;
        const progressInterval = setInterval(() => {
            if (!this.isAnalyzing) {
                clearInterval(progressInterval);
                return;
            }
            
            progress = Math.min(progress + 5, 95);
            this.updateAnalysisProgress(progress);
        }, 500);
    }

    /**
     * Update analysis status indicator
     */
    updateAnalysisStatus(status, message = '') {
        const statusElement = document.getElementById('analysis-processing-status');
        if (statusElement) {
            const statusHTML = {
                'idle': '<span class="status-idle">🔵 Ready for analysis</span>',
                'processing': '<span class="status-processing">🟡 Analyzing...</span>',
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
     * Show/hide analysis progress bar
     */
    showAnalysisProgress(show = true) {
        const progressElement = document.getElementById('analysis-progress');
        if (progressElement) {
            progressElement.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Update analysis progress
     */
    updateAnalysisProgress(percentage) {
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
     * Update analysis control buttons
     */
    updateAnalysisControls(enabled) {
        const startBtn = document.getElementById('start-analysis');
        const stopBtn = document.getElementById('stop-analysis');
        
        if (startBtn) {
            startBtn.disabled = !enabled;
        }
        
        if (stopBtn) {
            stopBtn.disabled = enabled;
        }
    }

    /**
     * Display analysis results
     */
    displayAnalysisResults(data) {
        const resultsElement = document.getElementById('analysis-results-content');
        if (resultsElement) {
            if (data.error) {
                resultsElement.textContent = `
                    <div class="alert alert-error">
                        <h5>❌ Error</h5>
                        <p>${data.error}</p>
                    </div>
                ` /* Replaced innerHTML with textContent for safety */
            } else {
                const formattedResults = this.formatAnalysisResults(data);
                resultsElement.textContent = formattedResults /* Replaced innerHTML with textContent for safety */
            }
        }
    }

    /**
     * Format analysis results for display
     */
    formatAnalysisResults(data) {
        const summary = data.summary || {};
        const files = data.files || [];
        const issues = data.issues || [];
        const recommendations = data.recommendations || [];

        return `
            <div class="analysis-summary">
                <h5>📊 Analysis Summary</h5>
                <div class="summary-stats">
                    <div class="stat-item">
                        <span class="stat-label">Files Found:</span>
                        <span class="stat-value">${summary.filesFound || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Data Quality Score:</span>
                        <span class="stat-value">${summary.dataQualityScore || '0%'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Issues Detected:</span>
                        <span class="stat-value">${summary.issuesDetected || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Patterns Identified:</span>
                        <span class="stat-value">${summary.patternsIdentified || 0}</span>
                    </div>
                </div>
            </div>
            
            <div class="files-analysis">
                <h5>📁 Files Analysis (${files.length})</h5>
                <div class="files-filter">
                    <input type="text" id="files-filter" placeholder="Filter files..." class="form-control">
                    <select id="status-filter" class="form-control">
                        <option value="">All Status</option>
                        <option value="clean">Clean</option>
                        <option value="issues">Issues</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                    </select>
                    <select id="type-filter" class="form-control">
                        <option value="">All Types</option>
                        <option value="json">JSON</option>
                        <option value="xml">XML</option>
                        <option value="csv">CSV</option>
                        <option value="js">JavaScript</option>
                        <option value="txt">Text</option>
                        <option value="html">HTML</option>
                    </select>
                </div>
                <div class="files-list" id="files-list">
                    ${files.map((file, index) => `
                        <div class="file-item" data-status="${file.status}" data-type="${file.type}">
                            <div class="file-header">
                                <span class="file-name">${file.name}</span>
                                <span class="file-path">${file.path}</span>
                            </div>
                            <div class="file-stats">
                                <span class="file-size">${this.formatFileSize(file.size)}</span>
                                <span class="file-type">${file.type}</span>
                                <span class="file-status status-${file.status}">${file.status}</span>
                                <span class="file-quality">Quality: ${file.quality}</span>
                            </div>
                            ${file.issues && file.issues.length > 0 ? `
                                <div class="file-issues">
                                    <h6>Issues (${file.issues.length}):</h6>
                                    <ul>
                                        ${file.issues.map(issue => `
                                            <li><strong>${issue.type}:</strong> ${issue.error}</li>`
                                        `).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="issues-analysis">
                <h5>⚠️ Issues Analysis (${issues.length})</h5>
                <div class="issues-filter">
                    <select id="issue-type-filter" class="form-control">
                        <option value="">All Types</option>
                        <option value="duplicate_data">Duplicate Data</option>
                        <option value="null_values">Null Values</option>
                        <option value="syntax_error">Syntax Error</option>
                        <option value="empty_object">Empty Object</option>
                        <option value="placeholder_text">Placeholder Text</option>
                        <option value="invalid_format">Invalid Format</option>
                        <option value="missing_field">Missing Field</option>
                    </select>
                </div>
                <div class="issues-list" id="issues-list">
                    ${issues.map((issue, index) => `
                        <div class="issue-item" data-type="${issue.type}">
                            <div class="issue-header">
                                <span class="issue-file">${issue.file}</span>
                                <span class="issue-type type-${issue.type}">${issue.type}</span>
                            </div>
                            <div class="issue-details">
                                <p>${issue.error}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="recommendations">
                <h5>💡 Recommendations (${recommendations.length})</h5>
                <div class="recommendations-list">
                    ${recommendations.map((rec, index) => `
                        <div class="recommendation-item priority-${rec.priority}">
                            <div class="rec-header">
                                <span class="rec-priority">[${rec.priority.toUpperCase()}]</span>
                                <span class="rec-action">${rec.action}</span>
                            </div>
                            <div class="rec-details">
                                <p>${rec.description}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the comprehensive analyzer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new ComprehensiveMockAnalyzer();
    analyzer.initialize();
});

// Export for use in other modules
window.ComprehensiveMockAnalyzer = ComprehensiveMockAnalyzer;
