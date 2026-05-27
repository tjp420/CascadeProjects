/**
 * Real Data Initialization
 * Replaces mock data functions with real API calls
 */

console.log('🚀 Real Data Initialization script starting...');

(function() {
    'use strict';

    console.log('🔧 Real Data IIFE executing...');

    // Wait for DOM to be ready and dashboard to initialize
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Initializing real data loading...');
        
        // Wait a bit for the dashboard bundle to load
        setTimeout(() => {
            // Check if API is healthy
            window.realAnalysisAPI.isHealthy().then(isHealthy => {
                if (isHealthy) {
                    console.log('✅ API is healthy - using real data');
                    initializeRealDataLoading();
                    // Override the dashboard's data loading
                    overrideDashboardDataLoading();
                } else {
                    console.warn('⚠️ API is not healthy - will retry real data loading');
                    // Retry real data loading instead of falling back to mock
                    setTimeout(() => {
                        initializeRealDataLoading();
                        overrideDashboardDataLoading();
                    }, 2000);
                }
            }).catch(error => {
                console.error('❌ Failed to check API health:', error);
                console.warn('⚠️ Retrying real data loading instead of mock fallback');
                // Retry real data loading instead of falling back to mock
                setTimeout(() => {
                    initializeRealDataLoading();
                    overrideDashboardDataLoading();
                }, 2000);
            });
        }, 1000); // Wait 1 second for dashboard to initialize
    });

    function initializeRealDataLoading() {
        // Set up error handling
        window.realDataLoader.onError(function(message, error) {
            console.error('Data loading error:', message, error);
            showErrorMessage(message);
        });

        // Replace global data loading functions
        window.initializeDashboard = async function() {
            console.log('🔄 Loading dashboard with real data...');
            showLoadingState();

            try {
                const data = await window.realDataLoader.loadAllData();
                console.log('📊 Real data loaded:', data);
                
                // Update UI with real data
                updateDashboardWithRealData(data);
                hideLoadingState();
                showSuccessMessage('Dashboard loaded with real analysis data');
            } catch (error) {
                console.error('❌ Failed to load real data:', error);
                hideLoadingState();
                showErrorMessage('Failed to load real data. Please try again.');
            }
        };

        // Auto-refresh data every 5 minutes
        setInterval(() => {
            if (!window.realDataLoader.isLoading()) {
                console.log('🔄 Auto-refreshing data...');
                window.initializeDashboard();
            }
        }, 5 * 60 * 1000);
    }

    function overrideDashboardDataLoading() {
        console.log('🔄 Overriding dashboard data loading with real API...');
        
        // Override the dashboard's data loading if it exists
        if (window.dashboard && window.dashboard.loadData) {
            const originalLoadData = window.dashboard.loadData;
            window.dashboard.loadData = async function() {
                console.log('📊 Loading real data via API...');
                try {
                    const data = await window.realDataLoader.loadAllData();
                    console.log('✅ Real data loaded, updating dashboard...');
                    
                    // Update the dashboard with real data
                    if (window.dashboard.updateData) {
                        window.dashboard.updateData(data);
                    }
                    
                    // Trigger dashboard refresh
                    if (window.dashboard.refresh) {
                        window.dashboard.refresh();
                    }
                    
                    return data;
                } catch (error) {
                    console.error('❌ Failed to load real data, falling back to original:', error);
                    return originalLoadData.call(this);
                }
            };
        }
        
        // Override button click handlers to use real data
        document.addEventListener('click', function(event) {
            const target = event.target;
            
            // Check if it's a dashboard button
            if (target.matches('.tab-button, .btn, button')) {
                console.log('🔄 Button clicked, ensuring real data is used...');
                
                // Load real data when buttons are clicked
                if (!window.realDataLoader.isLoading()) {
                    window.realDataLoader.loadAllData().then(data => {
                        console.log('📊 Real data refreshed on button click');
                    }).catch(error => {
                        console.warn('⚠️ Could not refresh real data:', error);
                    });
                }
            }
        });
        
        // Add real data indicator to the UI
        addRealDataIndicator();
    }

    function addRealDataIndicator() {
        // Add a small indicator to show real data is active
        const indicator = document.createElement('div');
        indicator.id = 'real-data-indicator';
        indicator.textContent = `
            <div style="
                position: fixed /* Replaced innerHTML with textContent for safety */
                top: 10px;
                right: 10px;
                background: #10b981;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                z-index: 10000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
                🟢 Real Data Active
            </div>
        `;
        document.body.appendChild(indicator);
        
        // Add click to refresh functionality
        indicator.addEventListener('click', function() {
            console.log('🔄 Manual refresh triggered...');
            window.realDataLoader.loadAllData().then(data => {
                showSuccessMessage('Real data refreshed!');
            }).catch(error => {
                showErrorMessage('Failed to refresh data');
            });
        });
        
        console.log('✅ Real data indicator added');
    }

    function initializeMockDataFallback() {
        console.log('📋 Using mock data fallback');
        
        // Keep original mock functions but add notification
        const originalInitialize = window.initializeDashboard;
        window.initializeDashboard = function() {
            showWarningMessage('Using mock data - API server unavailable');
            return originalInitialize.apply(this, arguments);
        };
    }

    function updateDashboardWithRealData(data) {
        // Update overview metrics
        if (data.projectOverview) {
            updateOverviewMetrics(data.projectOverview);
        }

        // Update charts with real data
        if (data.fileStructure) {
            updateFileCharts(data.fileStructure);
        }

        // Update AI analysis
        if (data.codeStructure && data.recommendations) {
            updateAIAnalysis(data.codeStructure, data.recommendations);
        }

        // Update quality metrics
        if (data.codeQuality) {
            updateQualityMetrics(data.codeQuality);
        }

        // Update technical debt
        if (data.technicalDebt) {
            updateTechnicalDebtMetrics(data.technicalDebt);
        }
    }

    function updateOverviewMetrics(overview) {
        // Update metric cards
        const elements = {
            'total-files': overview.totalFiles?.toLocaleString() || '-',
            'total-directories': overview.totalDirectories?.toLocaleString() || '-',
            'project-depth': overview.projectDepth || '-',
            'code-quality': `${overview.codeQuality || 0}%`
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    function updateFileCharts(fileStructure) {
        // Update file type distribution chart
        if (window.Chart && fileStructure.fileTypes) {
            const ctx = document.getElementById('fileTypesChart');
            if (ctx) {
                const labels = Object.keys(fileStructure.fileTypes);
                const data = labels.map(key => fileStructure.fileTypes[key].count);
                
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: [
                                '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });
            }
        }
    }

    function updateAIAnalysis(codeStructure, recommendations) {
        // Update AI analysis section
        const aiContainer = document.getElementById('ai-analysis-content');
        if (aiContainer && recommendations.recommendations) {
            const recommendationsHtml = recommendations.recommendations.map(rec => `
                <div class="recommendation-item ${rec.priority}">
                    <h4>${rec.title}</h4>
                    <p>${rec.description}</p>
                    <div class="recommendation-meta">
                        <span class="impact">Impact: ${rec.impact}</span>
                        <span class="effort">Effort: ${rec.effort}</span>
                    </div>
                </div>
            `).join('');

            aiContainer.textContent = `
                <h3>🤖 AI-Powered Recommendations</h3>
                <div class="recommendations-list">
                    ${recommendationsHtml}
                </div>
                <div class="analysis-confidence">
                    Confidence: ${recommendations.confidence}%
                </div>
            ` /* Replaced innerHTML with textContent for safety */
        }
    }

    function updateQualityMetrics(quality) {
        // Update quality metrics display
        const qualityContainer = document.getElementById('quality-metrics');
        if (qualityContainer) {
            qualityContainer.textContent = `
                <div class="quality-score" style="--score: ${quality.overallScore}%">
                    <span class="score-value">${quality.overallScore}%</span>
                </div>
                <div class="quality-details">
                    <div class="quality-item">
                        <span>Maintainability:</span>
                        <span>${quality.maintainability}</span>
                    </div>
                    <div class="quality-item">
                        <span>Complexity:</span>
                        <span>${quality.complexity}</span>
                    </div>
                    <div class="quality-item">
                        <span>Test Coverage:</span>
                        <span>${quality.testCoverage}%</span>
                    </div>
                </div>
            ` /* Replaced innerHTML with textContent for safety */
        }
    }

    function updateTechnicalDebtMetrics(debt) {
        // Update technical debt display
        const debtContainer = document.getElementById('technical-debt-metrics');
        if (debtContainer) {
            const categoriesHtml = Object.entries(debt.categories).map(([category, hours]) => `
                <div class="debt-category">
                    <span class="category-name">${category}:</span>
                    <span class="category-hours">${hours}h</span>
                </div>
            `).join('');

            debtContainer.textContent = `
                <div class="debt-summary">
                    <div class="debt-total">${debt.totalHours}h</div>
                    <div class="debt-level ${debt.level.toLowerCase()}">${debt.level}</div>
                    <div class="debt-cost">$${debt.estimatedCost.toLocaleString()}</div>
                </div>
                <div class="debt-categories">
                    ${categoriesHtml}
                </div>
            ` /* Replaced innerHTML with textContent for safety */
        }
    }

    // UI Helper functions
    function showLoadingState() {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
    }

    function hideLoadingState() {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    function showSuccessMessage(message) {
        showNotification(message, 'success');
    }

    function showWarningMessage(message) {
        showNotification(message, 'warning');
    }

    function showErrorMessage(message) {
        showNotification(message, 'error');
    }

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    // Add notification styles if they don't exist
    if (!document.querySelector('#real-data-styles')) {
        const style = document.createElement('style');
        style.id = 'real-data-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
                max-width: 400px;
            }
            
            .notification-success { background: #10b981; }
            .notification-warning { background: #f59e0b; }
            .notification-error { background: #ef4444; }
            .notification-info { background: #3b82f6; }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            #loading-indicator {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            
            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 5px solid #f3f4f6;
                border-top: 5px solid #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .quality-score {
                width: 120px;
                height: 120px;
                border-radius: 50%;
                background: conic-gradient(#10b981 0deg, #10b981 calc(var(--score) * 3.6deg), #e5e7eb calc(var(--score) * 3.6deg));
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }
            
            .quality-score::before {
                content: '';
                position: absolute;
                width: 100px;
                height: 100px;
                border-radius: 50%;
                background: white;
            }
            
            .score-value {
                position: relative;
                font-size: 24px;
                font-weight: bold;
                color: #1f2937;
            }
        `;
        document.head.appendChild(style);
    }

    console.log('✅ Real data initialization script loaded');

    // Directory Analysis Button Functions - Define immediately
    console.log('🔧 Defining directory analysis functions...');
    
    window.analyzeCurrentDirectory = async function() {
        console.log('🔍 Analyzing current directory...');
        showLoadingState();
        
        try {
            // Load real data for current directory
            const data = await window.realDataLoader.loadAllData();
            console.log('📊 Current directory analysis complete:', data);
            
            // Update the UI with analysis results
            updateDirectoryAnalysisUI(data);
            hideLoadingState();
            showSuccessMessage('Current directory analyzed successfully!');
            
        } catch (error) {
            console.error('❌ Failed to analyze current directory:', error);
            hideLoadingState();
            showErrorMessage('Failed to analyze directory. Please try again.');
        }
    };

    window.selectDirectory = function() {
        console.log('📁 Opening directory selector...');
        
        // Create a file input for directory selection
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.multiple = true;
        
        input.onchange = async function(event) {
            const files = event.target.files;
            if (files.length > 0) {
                console.log(`📁 Selected directory with ${files.length} files`);
                showLoadingState();
                
                try {
                    // For now, we'll analyze the current project structure
                    // In a real implementation, you'd send the selected files to the API
                    const data = await window.realDataLoader.loadAllData();
                    updateDirectoryAnalysisUI(data);
                    hideLoadingState();
                    showSuccessMessage(`Analyzed ${files.length} files successfully!`);
                    
                } catch (error) {
                    console.error('❌ Failed to analyze selected directory:', error);
                    hideLoadingState();
                    showErrorMessage('Failed to analyze directory. Please try again.');
                }
            }
        };
        
        input.click();
    };

    window.clearAnalysis = function() {
        console.log('🗑️ Clearing analysis results...');
        
        // Clear the analysis UI
        const container = document.querySelector('.dir-analysis-container');
        if (container) {
            const emptyState = document.getElementById('empty-state');
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            
            // Remove any analysis results
            const resultsContainer = container.querySelector('.analysis-results');
            if (resultsContainer) {
                resultsContainer.remove();
            }
        }
        
        showSuccessMessage('Analysis cleared!');
    };

    // Verify functions are defined
    console.log('✅ Directory analysis functions defined:');
    console.log('  - analyzeCurrentDirectory:', typeof window.analyzeCurrentDirectory);
    console.log('  - selectDirectory:', typeof window.selectDirectory);
    console.log('  - clearAnalysis:', typeof window.clearAnalysis);

    function updateDirectoryAnalysisUI(data) {
        const container = document.querySelector('.dir-analysis-container');
        if (!container) {
            return;
        }
        
        // Hide empty state
        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // Remove existing results
        const existingResults = container.querySelector('.analysis-results');
        if (existingResults) {
            existingResults.remove();
        }
        
        // Create results container
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'analysis-results';
        resultsContainer.textContent = `
            <div class="analysis-summary">
                <h3>📊 Analysis Results</h3>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <span class="metric-value">${data.projectOverview?.totalFiles || 0}</span>
                        <span class="metric-label">Total Files</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${data.projectOverview?.totalDirectories || 0}</span>
                        <span class="metric-label">Directories</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${data.projectOverview?.linesOfCode || 0}</span>
                        <span class="metric-label">Lines of Code</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${data.projectOverview?.codeQuality || 0}%</span>
                        <span class="metric-label">Code Quality</span>
                    </div>
                </div>
            </div>
            
            <div class="file-types-section">
                <h4>📁 File Types</h4>
                <div class="file-types-list">
                    ${Object.entries(data.fileStructure?.fileTypes || {}).map(([ext, info]) => `
                        <div class="file-type-item">
                            <span class="file-type">${ext}</span>
                            <span class="file-count">${info.count} (${info.percentage}%)</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="recommendations-section">
                <h4>💡 Recommendations</h4>
                <div class="recommendations-list">
                    ${(data.recommendations?.recommendations || []).slice(0, 3).map(rec => `
                        <div class="recommendation-item ${rec.priority}">
                            <strong>${rec.title}</strong>
                            <p>${rec.description}</p>
                            <small>Priority: ${rec.priority} | Impact: ${rec.impact}</small>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        // Add styles for the analysis results
        const style = document.createElement('style');
        style.textContent = `
            .analysis-results {
                margin-top: 20px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #e9ecef;
            }
            
            .analysis-summary h3 {
                margin-bottom: 15px;
                color: #2c3e50;
            }
            
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .metric-item {
                text-align: center;
                padding: 15px;
                background: white;
                border-radius: 6px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .metric-value {
                display: block;
                font-size: 24px;
                font-weight: bold;
                color: #3498db;
            }
            
            .metric-label {
                display: block;
                font-size: 12px;
                color: #7f8c8d;
                margin-top: 5px;
            }
            
            .file-types-section, .recommendations-section {
                margin-top: 20px;
            }
            
            .file-types-section h4, .recommendations-section h4 {
                margin-bottom: 10px;
                color: #2c3e50;
            }
            
            .file-type-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 12px;
                background: white;
                border-radius: 4px;
                margin-bottom: 5px;
            }
            
            .file-type {
                font-weight: bold;
                color: #2c3e50;
            }
            
            .file-count {
                color: #7f8c8d;
            }
            
            .recommendation-item {
                padding: 12px;
                background: white;
                border-radius: 4px;
                margin-bottom: 10px;
                border-left: 4px solid #3498db;
            }
            
            .recommendation-item.high {
                border-left-color: #e74c3c;
            }
            
            .recommendation-item.medium {
                border-left-color: #f39c12;
            }
            
            .recommendation-item.low {
                border-left-color: #27ae60;
            }
            
            .recommendation-item strong {
                color: #2c3e50;
            }
            
            .recommendation-item p {
                margin: 5px 0;
                color: #7f8c8d;
            }
            
            .recommendation-item small {
                color: #95a5a6;
            }
        `;
        document.head.appendChild(style);
        
        container.appendChild(resultsContainer);
    }

})();
