/**
 * GGUF Analysis Panel Component
 * Main dashboard component for displaying GGUF AI analysis data
 */

class GGUFAnalysisPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.data = null;
        this.loading = false;
        this.error = null;
        this.refreshInterval = null;
        
        this.init();
    }

    init() {
        this.render();
        this.loadAnalysisData();
        this.startAutoRefresh();
    }

    render() {
        this.container.textContent = `
            <div class="gguf-analysis-panel">
                <div class="panel-header">
                    <div class="header-content">
                        <h2 class="panel-title">
                            <i class="fas fa-brain"></i>
                            GGUF AI Analysis
                        </h2>
                        <div class="header-actions">
                            <button class="btn btn-sm btn-outline-primary refresh-btn" onclick="ggufAnalysisPanel.refreshData()">
                                <i class="fas fa-sync-alt"></i>
                                Refresh
                            </button>
                            <button class="btn btn-sm btn-outline-secondary settings-btn" onclick="ggufAnalysisPanel.showSettings()">
                                <i class="fas fa-cog"></i>
                            </button>
                        </div>
                    </div>
                    <div class="data-freshness" id="dataFreshness">
                        <span class="freshness-indicator"></span>
                        <span class="freshness-text"></span>
                    </div>
                </div>

                <div class="panel-content">
                    <!-- Loading State -->
                    <div class="loading-state" id="loadingState">
                        <div class="spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                        <p>Analyzing mock data with GGUF AI...</p>
                    </div>

                    <!-- Error State -->
                    <div class="error-state" id="errorState" style="display: none /* Replaced innerHTML with textContent for safety */">
                        <div class="error-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3>Analysis Error</h3>
                        <p id="errorMessage">Failed to load GGUF analysis data</p>
                        <button class="btn btn-primary" onclick="ggufAnalysisPanel.refreshData()">
                            Try Again
                        </button>
                    </div>

                    <!-- Main Analysis Content -->
                    <div class="analysis-content" id="analysisContent" style="display: none;">
                        <!-- AI Model Info Card -->
                        <div class="model-info-card">
                            <div class="model-header">
                                <div class="model-avatar">
                                    <i class="fas fa-robot"></i>
                                </div>
                                <div class="model-details">
                                    <h3 id="modelName">GGUF AI Model</h3>
                                    <p class="model-type" id="modelType">Loading...</p>
                                </div>
                                <div class="confidence-badge">
                                    <div class="confidence-circle" id="confidenceCircle">
                                        <span class="confidence-value" id="confidenceValue">-</span>
                                        <span class="confidence-label">Confidence</span>
                                    </div>
                                </div>
                            </div>
                            <div class="model-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Size</span>
                                    <span class="stat-value" id="modelSize">-</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Status</span>
                                    <span class="stat-value status-active" id="modelStatus">-</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Hash</span>
                                    <span class="stat-value hash-value" id="modelHash">-</span>
                                </div>
                            </div>
                        </div>

                        <!-- Analysis Overview Stats -->
                        <div class="overview-stats">
                            <div class="stat-card primary">
                                <div class="stat-icon">
                                    <i class="fas fa-file-alt"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="totalFiles">-</div>
                                    <div class="stat-label">Mock Files</div>
                                </div>
                            </div>
                            
                            <div class="stat-card success">
                                <div class="stat-icon">
                                    <i class="fas fa-chart-line"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="qualityScore">-</div>
                                    <div class="stat-label">Quality Score</div>
                                </div>
                            </div>
                            
                            <div class="stat-card warning">
                                <div class="stat-icon">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="issuesCount">-</div>
                                    <div class="stat-label">Issues Found</div>
                                </div>
                            </div>
                            
                            <div class="stat-card info">
                                <div class="stat-icon">
                                    <i class="fas fa-database"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="dataSize">-</div>
                                    <div class="stat-label">Total Size</div>
                                </div>
                            </div>
                        </div>

                        <!-- Performance Metrics -->
                        <div class="performance-metrics">
                            <h3>Performance Metrics</h3>
                            <div class="metrics-grid">
                                <div class="metric-item">
                                    <div class="metric-icon">
                                        <i class="fas fa-tachometer-alt"></i>
                                    </div>
                                    <div class="metric-content">
                                        <div class="metric-value" id="analysisSpeed">-</div>
                                        <div class="metric-label">Analysis Speed</div>
                                    </div>
                                </div>
                                
                                <div class="metric-item">
                                    <div class="metric-icon">
                                        <i class="fas fa-memory"></i>
                                    </div>
                                    <div class="metric-content">
                                        <div class="metric-value" id="memoryUsage">-</div>
                                        <div class="metric-label">Memory Usage</div>
                                    </div>
                                </div>
                                
                                <div class="metric-item">
                                    <div class="metric-icon">
                                        <i class="fas fa-microchip"></i>
                                    </div>
                                    <div class="metric-content">
                                        <div class="metric-value" id="cpuUsage">-</div>
                                        <div class="metric-label">CPU Usage</div>
                                    </div>
                                </div>
                                
                                <div class="metric-item">
                                    <div class="metric-icon">
                                        <i class="fas fa-clock"></i>
                                    </div>
                                    <div class="metric-content">
                                        <div class="metric-value" id="analysisDuration">-</div>
                                        <div class="metric-label">Duration</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Data Categories -->
                        <div class="data-categories">
                            <h3>Mock Data Categories</h3>
                            <div class="categories-grid" id="categoriesGrid">
                                <!-- Categories will be rendered here -->
                            </div>
                        </div>

                        <!-- Quality Metrics Breakdown -->
                        <div class="quality-breakdown">
                            <h3>Quality Metrics Breakdown</h3>
                            <div class="quality-chart-container">
                                <canvas id="qualityChart" width="400" height="200"></canvas>
                            </div>
                            <div class="quality-legend" id="qualityLegend">
                                <!-- Legend items will be rendered here -->
                            </div>
                        </div>

                        <!-- Privacy & Security -->
                        <div class="privacy-security">
                            <h3>Privacy & Security</h3>
                            <div class="security-grid">
                                <div class="security-item">
                                    <i class="fas fa-shield-alt text-success"></i>
                                    <span>Local Processing</span>
                                </div>
                                <div class="security-item">
                                    <i class="fas fa-lock text-success"></i>
                                    <span>Complete Privacy</span>
                                </div>
                                <div class="security-item">
                                    <i class="fas fa-user-shield text-success"></i>
                                    <span>No External Risks</span>
                                </div>
                                <div class="security-item">
                                    <i class="fas fa-wifi-slash text-success"></i>
                                    <span>Offline Capable</span>
                                </div>
                                <div class="security-item">
                                    <i class="fas fa-dollar-sign text-success"></i>
                                    <span>No API Costs</span>
                                </div>
                                <div class="security-item">
                                    <i class="fas fa-infinity text-success"></i>
                                    <span>Unlimited Usage</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadAnalysisData() {
        this.setLoading(true);
        this.error = null;
        
        try {
            // Load data using the GGUF data service
            if (window.ggufDataService) {
                await window.ggufDataService.loadAnalysisReport();
                this.data = window.ggufDataService.getAnalysisOverview();
            } else {
                // Fallback to direct API call
                const response = await fetch('/api/gguf/analysis');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                this.data = await response.json();
            }
            
            this.renderAnalysisData();
            this.setLoading(false);
            this.updateDataFreshness();
            
        } catch (error) {
            console.error('Error loading GGUF analysis data:', error);
            this.error = error.message;
            this.setError(true);
            this.setLoading(false);
        }
    }

    renderAnalysisData() {
        if (!this.data) return;
        
        // Hide loading/error states
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('errorState').style.display = 'none';
        document.getElementById('analysisContent').style.display = 'block';
        
        // Update model info
        this.updateModelInfo();
        
        // Update overview stats
        this.updateOverviewStats();
        
        // Update performance metrics
        this.updatePerformanceMetrics();
        
        // Update data categories
        this.updateDataCategories();
        
        // Update quality metrics
        this.updateQualityMetrics();
        
        // Update privacy/security info
        this.updatePrivacySecurity();
    }

    updateModelInfo() {
        const modelInfo = this.data.modelInfo || {};
        
        document.getElementById('modelName').textContent = modelInfo.name || 'GGUF AI Model';
        document.getElementById('modelType').textContent = modelInfo.type || 'GGUF';
        document.getElementById('confidenceValue').textContent = modelInfo.confidence || '-';
        document.getElementById('modelSize').textContent = modelInfo.size || '-';
        document.getElementById('modelStatus').textContent = modelInfo.status || 'Unknown';
        document.getElementById('modelHash').textContent = this.truncateHash(modelInfo.hash) || '-';
        
        // Update confidence circle
        const confidence = modelInfo.confidence || 0;
        const confidenceCircle = document.getElementById('confidenceCircle');
        confidenceCircle.style.setProperty('--confidence', `${confidence}%`);
    }

    updateOverviewStats() {
        const overview = this.data.analysisOverview || {};
        
        document.getElementById('totalFiles').textContent = overview.totalMockFiles || '-';
        document.getElementById('qualityScore').textContent = `${overview.dataQualityScore || 0}%`;
        document.getElementById('issuesCount').textContent = overview.issuesDetected || '-';
        document.getElementById('dataSize').textContent = overview.totalMockDataSize || '-';
    }

    updatePerformanceMetrics() {
        const performance = this.data.performanceMetrics || {};
        const overview = this.data.analysisOverview || {};
        
        document.getElementById('analysisSpeed').textContent = overview.analysisSpeed || '-';
        document.getElementById('memoryUsage').textContent = overview.memoryUsage || '-';
        document.getElementById('cpuUsage').textContent = overview.cpuUsage || '-';
        document.getElementById('analysisDuration').textContent = performance.analysisDuration || '-';
    }

    updateDataCategories() {
        const categories = this.data.mockDataCategories || [];
        const container = document.getElementById('categoriesGrid');
        
        container.textContent = categories.map(category => `
            <div class="category-card">
                <div class="category-header">
                    <h4>${category.category}</h4>
                    <div class="category-score">${category.qualityScore}%</div>
                </div>
                <div class="category-stats">
                    <div class="category-stat">
                        <span class="stat-label">Files</span>
                        <span class="stat-value">${category.fileCount}</span>
                    </div>
                    <div class="category-stat">
                        <span class="stat-label">Size</span>
                        <span class="stat-value">${category.totalSize}</span>
                    </div>
                    <div class="category-stat">
                        <span class="stat-label">Issues</span>
                        <span class="stat-value">${category.issues}</span>
                    </div>
                </div>
                <div class="category-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${category.qualityScore}%"></div>
                    </div>
                </div>
                <p class="category-description">${category.description}</p>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    updateQualityMetrics() {
        const metrics = this.data.qualityMetrics || {};
        
        // Create quality chart
        this.createQualityChart(metrics);
        
        // Create legend
        const legendContainer = document.getElementById('qualityLegend');
        const metricItems = [
            { label: 'Data Integrity', value: metrics.dataIntegrity, color: '#10b981' },
            { label: 'Schema Compliance', value: metrics.schemaCompliance, color: '#3b82f6' },
            { label: 'Consistency', value: metrics.consistencyScore, color: '#f59e0b' },
            { label: 'Completeness', value: metrics.completenessScore, color: '#8b5cf6' },
            { label: 'Accuracy', value: metrics.accuracyScore, color: '#ef4444' }
        ];
        
        legendContainer.textContent = metricItems.map(item => `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${item.color}"></div>
                <div class="legend-content">
                    <span class="legend-label">${item.label}</span>
                    <span class="legend-value">${item.value}%</span>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    createQualityChart(metrics) {
        const canvas = document.getElementById('qualityChart');
        const ctx = canvas.getContext('2d');
        
        const data = [
            metrics.dataIntegrity || 0,
            metrics.schemaCompliance || 0,
            metrics.consistencyScore || 0,
            metrics.completenessScore || 0,
            metrics.accuracyScore || 0
        ];
        
        const labels = ['Integrity', 'Compliance', 'Consistency', 'Completeness', 'Accuracy'];
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw radar chart
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 40;
        const angleStep = (Math.PI * 2) / data.length;
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        for (let i = 1; i <= 5; i++) {
            ctx.beginPath();
            for (let j = 0; j < data.length; j++) {
                const angle = j * angleStep - Math.PI / 2;
                const x = centerX + Math.cos(angle) * (radius * i / 5);
                const y = centerY + Math.sin(angle) * (radius * i / 5);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }
        
        // Draw data
        ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const value = data[i] / 100;
            const x = centerX + Math.cos(angle) * (radius * value);
            const y = centerY + Math.sin(angle) * (radius * value);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw labels
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        
        for (let i = 0; i < labels.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = centerX + Math.cos(angle) * (radius + 20);
            const y = centerY + Math.sin(angle) * (radius + 20);
            ctx.fillText(labels[i], x, y);
        }
    }

    updatePrivacySecurity() {
        const privacy = this.data.privacyAndSecurity || {};
        // Privacy info is static in the template, but could be made dynamic if needed
    }

    truncateHash(hash) {
        if (!hash) return '-';
        return hash.length > 12 ? `${hash.substring(0, 6)}...${hash.substring(hash.length - 6)}` : hash;
    }

    setLoading(loading) {
        this.loading = loading;
        const loadingState = document.getElementById('loadingState');
        const analysisContent = document.getElementById('analysisContent');
        
        if (loading) {
            loadingState.style.display = 'block';
            analysisContent.style.display = 'none';
        } else {
            loadingState.style.display = 'none';
        }
    }

    setError(error) {
        this.error = error;
        const errorState = document.getElementById('errorState');
        const analysisContent = document.getElementById('analysisContent');
        
        if (error) {
            errorState.style.display = 'block';
            analysisContent.style.display = 'none';
            document.getElementById('errorMessage').textContent = this.error;
        } else {
            errorState.style.display = 'none';
        }
    }

    updateDataFreshness() {
        const freshnessElement = document.getElementById('dataFreshness');
        const indicator = freshnessElement.querySelector('.freshness-indicator');
        const text = freshnessElement.querySelector('.freshness-text');
        
        if (!this.lastUpdate) {
            indicator.className = 'freshness-indicator stale';
            text.textContent = 'Never updated';
            return;
        }
        
        const now = new Date();
        const diff = now - this.lastUpdate;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 5) {
            indicator.className = 'freshness-indicator fresh';
            text.textContent = 'Updated just now';
        } else if (minutes < 30) {
            indicator.className = 'freshness-indicator recent';
            text.textContent = `Updated ${minutes} min ago`;
        } else if (minutes < 120) {
            indicator.className = 'freshness-indicator stale';
            text.textContent = `Updated ${Math.floor(minutes / 60)}h ago`;
        } else {
            indicator.className = 'freshness-indicator outdated';
            text.textContent = 'Updated long ago';
        }
    }

    async refreshData() {
        const refreshBtn = document.querySelector('.refresh-btn i');
        refreshBtn.classList.add('fa-spin');
        
        await this.loadAnalysisData();
        
        refreshBtn.classList.remove('fa-spin');
    }

    showSettings() {
        // Show settings modal or panel
        console.log('Settings clicked');
    }

    startAutoRefresh() {
        // Auto-refresh every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.refreshData();
        }, 5 * 60 * 1000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    destroy() {
        this.stopAutoRefresh();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GGUFAnalysisPanel;
} else {
    window.GGUFAnalysisPanel = GGUFAnalysisPanel;
}
