/**
 * Mock Data Analysis Dashboard
 * Comprehensive visualization and analysis of mock data categories, quality metrics, and issues
 */

class MockDataAnalysisDashboard {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            animateCharts: true,
            showDetails: true,
            interactiveElements: true,
            theme: 'dark',
            ...options
        };
        this.data = null;
        this.charts = [];
        
        this.init();
    }

    /**
     * Initialize the mock data analysis dashboard
     */
    init() {
        if (!this.container) {
            console.error('Mock data analysis dashboard container not found');
            return;
        }

        this.setupStyles();
        this.createDashboardStructure();
        this.bindEvents();
    }

    /**
     * Setup CSS styles for the dashboard
     */
    setupStyles() {
        const styleId = 'mock-analysis-dashboard-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .mock-analysis-dashboard {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                }

                .dashboard-header {
                    margin-bottom: 2rem;
                }

                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 2rem;
                    flex-wrap: wrap;
                }

                .header-actions {
                    display: flex;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }

                .export-btn, .refresh-btn {
                    background: rgba(59, 130, 246, 0.2);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    color: #3b82f6;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .export-btn:hover, .refresh-btn:hover {
                    background: rgba(59, 130, 246, 0.3);
                    border-color: #3b82f6;
                    transform: translateY(-1px);
                }

                .export-btn i, .refresh-btn i {
                    font-size: 0.8rem;
                }

                .dashboard-title {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .dashboard-subtitle {
                    color: #94a3b8;
                    font-size: 1.1rem;
                }

                .model-info {
                    margin-top: 1rem;
                    padding: 1rem;
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    border-radius: 8px;
                }

                .model-details {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .model-badge {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                }

                .model-name {
                    font-weight: 600;
                    color: #3b82f6;
                }

                .model-type {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    padding: 0.25rem 0.5rem;
                    border-radius: 12px;
                    font-size: 0.8rem;
                }

                .model-size {
                    color: #94a3b8;
                    font-size: 0.9rem;
                }

                .confidence-badge {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    padding: 0.25rem 0.5rem;
                    border-radius: 12px;
                    font-size: 0.8rem;
                }

                .model-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .status-indicator.active {
                    background: #10b981;
                    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
                }

                .status-text {
                    color: #94a3b8;
                    font-size: 0.9rem;
                }

                .overview-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .overview-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    text-align: center;
                    transition: all 0.3s ease;
                }

                .overview-card:hover {
                    transform: translateY(-2px);
                    border-color: #3b82f6;
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
                }

                .card-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .card-label {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                }

                .card-metric {
                    font-size: 0.8rem;
                    color: #64748b;
                    margin-top: 0.5rem;
                }

                .categories-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .category-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                }

                .category-card:hover {
                    transform: translateY(-2px);
                    border-color: #3b82f6;
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
                }

                .category-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .category-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .quality-badge {
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .quality-excellent {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .quality-good {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    border: 1px solid #3b82f6;
                }

                .quality-fair {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                    border: 1px solid #f59e0b;
                }

                .category-metrics {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .metric-item {
                    text-align: center;
                }

                .metric-value {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .metric-label {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                }

                .category-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.4;
                }

                .quality-metrics-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .quality-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .quality-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                }

                .quality-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    text-align: center;
                    transition: all 0.3s ease;
                }

                .quality-item:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
                }

                .quality-score {
                    font-size: 2rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                }

                .score-high {
                    color: #10b981;
                }

                .score-medium {
                    color: #f59e0b;
                }

                .score-low {
                    color: #ef4444;
                }

                .quality-name {
                    color: #f8fafc;
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }

                .quality-description {
                    color: #94a3b8;
                    font-size: 0.8rem;
                }

                .issues-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .issues-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .issues-title {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .issues-summary {
                    display: flex;
                    gap: 1rem;
                }

                .severity-count {
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .severity-high {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                    border: 1px solid #ef4444;
                }

                .severity-medium {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                    border: 1px solid #f59e0b;
                }

                .severity-low {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .issues-list {
                    display: grid;
                    gap: 1rem;
                }

                .issue-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    transition: all 0.3s ease;
                }

                .issue-item:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
                }

                .issue-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }

                .issue-title {
                    font-weight: 600;
                    color: #f8fafc;
                }

                .issue-count {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    padding: 0.25rem 0.5rem;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .issue-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    margin-bottom: 0.5rem;
                }

                .issue-action {
                    color: #64748b;
                    font-size: 0.8rem;
                    font-style: italic;
                }

                .insights-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .insights-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .insights-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                }

                .insight-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    transition: all 0.3s ease;
                }

                .insight-card:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
                }

                .insight-title {
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .insight-content {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.4;
                }

                .progress-bar-container {
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 8px;
                    height: 8px;
                    overflow: hidden;
                    margin: 0.5rem 0;
                }

                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%);
                    border-radius: 8px;
                    transition: width 1s ease-in-out;
                }

                .mock-analysis-dashboard .chart-container {
                    height: 300px;
                    position: relative;
                    margin: 1rem 0;
                }

                .pie-chart {
                    width: 200px;
                    height: 200px;
                    margin: 0 auto;
                    position: relative;
                }

                .bar-chart {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-around;
                    height: 250px;
                    padding: 1rem 0;
                }

                .bar {
                    width: 60px;
                    background: linear-gradient(180deg, var(--bar-color-top) 0%, var(--bar-color-bottom) 100%);
                    border-radius: 8px 8px 0 0;
                    position: relative;
                    transition: all 0.3s ease;
                    cursor: pointer;
                }

                .bar:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                }

                .bar-label {
                    position: absolute;
                    bottom: -25px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 0.8rem;
                    color: #94a3b8;
                    text-align: center;
                    width: 100%;
                }

                .bar-value {
                    position: absolute;
                    top: -25px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                @media (max-width: 768px) {
                    .mock-analysis-dashboard {
                        padding: 1rem;
                    }

                    .overview-cards {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .categories-grid {
                        grid-template-columns: 1fr;
                    }

                    .quality-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                .issue-severity {
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .severity-high {
                    background: #ef4444;
                    color: white;
                }

                .severity-medium {
                    background: #f59e0b;
                    color: white;
                }

                .severity-low {
                    background: #10b981;
                    color: white;
                }

                .insight-card.priority-high {
                    border-left: 4px solid #ef4444;
                }

                .insight-card.priority-medium {
                    border-left: 4px solid #f59e0b;
                }

                .insight-card.priority-low {
                    border-left: 4px solid #10b981;
                }

                .insight-metric,
                .insight-impact,
                .insight-priority {
                    margin-top: 0.5rem;
                    padding: 0.25rem 0.5rem;
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 4px;
                    font-size: 0.8rem;
                }

                .issue-files {
                    margin-top: 0.5rem;
                    padding: 0.5rem;
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 4px;
                    font-size: 0.8rem;
                    color: #94a3b8;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create the dashboard structure
     */
    createDashboardStructure() {
        this.container.textContent = `
            <div class="mock-analysis-dashboard">
                <div class="dashboard-header">
                    <div class="header-content">
                        <div>
                            <h2 class="dashboard-title">🤖 GGUF-Powered Mock Data Analysis</h2>
                            <p class="dashboard-subtitle">AI-powered analysis of mock data quality and optimization opportunities</p>
                            <div class="model-info" id="model-info">
                                <!-- Model info will be rendered here -->
                            </div>
                        </div>
                        <div class="header-actions">
                            <button class="export-btn" onclick="window.mockDataAnalysisDashboard.exportData()">
                                <i class="fas fa-download"></i> Export Report
                            </button>
                            <button class="refresh-btn" onclick="window.mockDataAnalysisDashboard.refreshAnalysis()">
                                <i class="fas fa-sync-alt"></i> Refresh
                            </button>
                        </div>
                    </div>
                </div>

                <div class="overview-cards" id="overview-cards">
                    <!-- Overview cards will be rendered here -->
                </div>

                <div class="categories-grid" id="categories-grid">
                    <!-- Category cards will be rendered here -->
                </div>

                <div class="quality-metrics-section">
                    <h3 class="quality-header">📈 Quality Metrics</h3>
                    <div class="quality-grid" id="quality-grid">
                        <!-- Quality metrics will be rendered here -->
                    </div>
                </div>

                <div class="issues-section">
                    <div class="issues-header">
                        <h3 class="issues-title">⚠️ Detected Issues</h3>
                        <div class="issues-summary" id="issues-summary">
                            <!-- Issue summary will be rendered here -->
                        </div>
                    </div>
                    <div class="issues-list" id="issues-list">
                        <!-- Issues will be rendered here -->
                    </div>
                </div>

                <div class="insights-section">
                    <h3 class="insights-header">🧠 GGUF AI Insights</h3>
                    <div class="insights-grid" id="insights-grid">
                        <!-- Insights will be rendered here -->
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Normalize API/file payloads into a mock analysis report object
     */
    normalizeMockAnalysisReport(payload) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Invalid mock analysis report');
        }
        if (payload.type === 'gguf-mock-data-analysis-report') {
            return payload;
        }
        if (payload.data?.type === 'gguf-mock-data-analysis-report') {
            return payload.data;
        }
        if (payload.analysisOverview && payload.mockDataCategories) {
            return payload;
        }
        throw new Error('JSON must be a gguf-mock-data-analysis-report object');
    }

    /**
     * Fetch mock analysis report from API or bundled sample
     */
    async fetchMockAnalysisReport() {
        const sources = [
            '/api/gguf/analysis',
            '/api/gguf/mock-analysis-report',
            '/data/gguf-mock-analysis-sample.json'
        ];

        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const payload = await response.json();
                return this.normalizeMockAnalysisReport(payload);
            } catch (error) {
                console.warn(`Mock analysis source failed (${url}):`, error.message);
            }
        }

        if (typeof RealDataService !== 'undefined') {
            const dataService = new RealDataService();
            return this.normalizeMockAnalysisReport(await dataService.getGGUFMockAnalysisReport());
        }

        throw new Error('No mock analysis data available');
    }

    /**
     * Load mock data analysis and render dashboard
     */
    async loadMockDataAnalysis(sourceData = null) {
        try {
            const analysisData = sourceData
                ? this.normalizeMockAnalysisReport(sourceData)
                : await this.fetchMockAnalysisReport();

            this.data = analysisData;
            window.__lastMockAnalysisReport = analysisData;
            this.renderDashboard();
        } catch (error) {
            console.error('Failed to load mock data analysis:', error);
            this.showError('Failed to load mock data analysis');
        }
    }

    /**
     * Render the dashboard with data
     */
    renderDashboard() {
        if (!this.data) return;

        this.renderModelInfo();
        this.renderOverviewCards();
        this.renderCategories();
        this.renderQualityMetrics();
        this.renderIssues();
        this.renderInsights();
        
        if (this.options.animateCharts) {
            this.animateCharts();
        }
    }

    /**
     * Render model information
     */
    renderModelInfo() {
        const container = document.getElementById('model-info');
        const modelInfo = this.data.modelInfo;
        
        container.textContent = `
            <div class="model-details">
                <div class="model-badge">
                    <span class="model-name">${modelInfo.name}</span>
                    <span class="model-type">${modelInfo.type}</span>
                    <span class="model-size">${modelInfo.size}</span>
                    <span class="confidence-badge">Confidence: ${modelInfo.confidence}%</span>
                </div>
                <div class="model-status">
                    <span class="status-indicator ${modelInfo.status}"></span>
                    <span class="status-text">${modelInfo.status}</span>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render overview cards
     */
    renderOverviewCards() {
        const container = document.getElementById('overview-cards');
        const overview = this.data.analysisOverview;
        
        container.textContent = `
            <div class="overview-card">
                <div class="card-value">${overview.totalMockFiles}</div>
                <div class="card-label">Total Files</div>
                <div class="card-metric">Mock files analyzed</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${overview.dataQualityScore}%</div>
                <div class="card-label">Quality Score</div>
                <div class="card-metric">Overall data quality</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${overview.totalMockDataSize}</div>
                <div class="card-label">Total Size</div>
                <div class="card-metric">Data volume</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${overview.issuesDetected}</div>
                <div class="card-label">Issues Found</div>
                <div class="card-metric">Detected problems</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${overview.aiConfidence}%</div>
                <div class="card-label">AI Confidence</div>
                <div class="card-metric">Analysis confidence</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${overview.analysisSpeed}</div>
                <div class="card-label">Analysis Speed</div>
                <div class="card-metric">Files per second</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render mock data categories
     */
    renderCategories() {
        const container = document.getElementById('categories-grid');
        const categories = this.data.mockDataCategories;
        
        container.textContent = categories.map(category => `
            <div class="category-card">
                <div class="category-header">
                    <h3 class="category-title">${category.category}</h3>
                    <span class="quality-badge quality-${this.getQualityClass(category.qualityScore)}">${category.qualityScore}</span>
                </div>
                <div class="category-metrics">
                    <div class="metric-item">
                        <div class="metric-value">${category.fileCount}</div>
                        <div class="metric-label">Files</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${category.totalSize}</div>
                        <div class="metric-label">Size</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${category.issues}</div>
                        <div class="metric-label">Issues</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${category.confidence}%</div>
                        <div class="metric-label">Confidence</div>
                    </div>
                </div>
                <div class="category-description">${category.description}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render quality metrics
     */
    renderQualityMetrics() {
        const container = document.getElementById('quality-grid');
        const metrics = this.data.qualityMetrics;
        
        container.textContent = Object.entries(metrics).map(([key, value]) => `
            <div class="quality-item">
                <div class="quality-score ${this.getScoreClass(value)}">${value}%</div>
                <div class="quality-name">${this.formatMetricName(key)}</div>
                <div class="quality-description">${this.getMetricDescription(key)}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render detected issues
     */
    renderIssues() {
        const summaryContainer = document.getElementById('issues-summary');
        const listContainer = document.getElementById('issues-list');
        const issues = this.data.detectedIssues;
        
        // Render summary
        const severityCounts = this.calculateSeverityCounts(issues);
        summaryContainer.textContent = `
            <span class="severity-count severity-high">High: ${severityCounts.high}</span>
            <span class="severity-count severity-medium">Medium: ${severityCounts.medium}</span>
            <span class="severity-count severity-low">Low: ${severityCounts.low}</span>
        ` /* Replaced innerHTML with textContent for safety */
        
        // Render issues list
        listContainer.textContent = issues.map(issue => `
            <div class="issue-item">
                <div class="issue-header">
                    <div class="issue-title">${issue.type}</div>
                    <span class="issue-severity severity-${issue.severity}">${issue.severity}</span>
                    <div class="issue-count">${issue.count} issues</div>
                </div>
                <div class="issue-description">${issue.description}</div>
                <div class="issue-action">Recommended: ${issue.recommendedAction}</div>
                <div class="issue-files">Affected files: ${issue.affectedFiles.join(', ')}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render GGUF AI insights
     */
    renderInsights() {
        const container = document.getElementById('insights-grid');
        const insights = this.data.ggufAIInsights;
        
        // Data patterns section
        const dataPatternsHTML = `
            <div class="insight-card">
                <div class="insight-title">🔍 Data Patterns Identified</div>
                <div class="insight-content">
                    ${insights.dataPatterns.map(pattern => `• ${pattern}`).join("<br>")}
                </div>
            </div>
        `;
        
        // Optimization recommendations section
        const optimizationHTML = insights.optimizationRecommendations.map(rec => `
            <div class="insight-card priority-${rec.priority}">
                <div class="insight-title">🚀 ${rec.action}</div>
                <div class="insight-content">
                    <p>${rec.description}</p>
                    <div class="insight-metric">Potential Savings: ${rec.potentialSavings}</div>
                    <div class="insight-impact">Impact: ${rec.impact}</div>
                    <div class="insight-priority">Priority: ${rec.priority}</div>
                </div>
            </div>
        `).join('');
        
        // Quality improvements section
        const qualityHTML = `
            <div class="insight-card">
                <div class="insight-title">📈 Quality Improvements</div>
                <div class="insight-content">
                    ${insights.qualityImprovements.map(imp => `• ${imp}`).join("<br>")}
                </div>
            </div>
        `;
        
        container.textContent = dataPatternsHTML + optimizationHTML + qualityHTML /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Get quality class based on score
     */
    getQualityClass(score) {
        if (score >= 90) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 70) return 'fair';
        return 'poor';
    }

    /**
     * Get score class based on value
     */
    getScoreClass(value) {
        if (value >= 90) return 'score-high';
        if (value >= 80) return 'score-medium';
        return 'score-low';
    }

    /**
     * Format metric name for display
     */
    formatMetricName(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    /**
     * Get metric description
     */
    getMetricDescription(key) {
        const descriptions = {
            dataIntegrity: 'Data consistency and accuracy',
            schemaCompliance: 'Adherence to defined schemas',
            consistencyScore: 'Uniformity across datasets',
            completenessScore: 'Presence of required fields',
            accuracyScore: 'Correctness of data values',
            overallQuality: 'Comprehensive quality rating'
        };
        return descriptions[key] || 'Quality metric';
    }

    /**
     * Calculate severity counts
     */
    calculateSeverityCounts(issues) {
        return issues.reduce((counts, issue) => {
            counts[issue.severity] = (counts[issue.severity] || 0) + 1;
            return counts;
        }, { high: 0, medium: 0, low: 0 });
    }

    /**
     * Animate charts on load
     */
    animateCharts() {
        const cards = document.querySelectorAll('.overview-card, .category-card, .quality-item');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    /**
     * Bind interactive events
     */
    bindEvents() {
        // Add click handlers for category cards
        this.container.addEventListener('click', (e) => {
            const categoryCard = e.target.closest('.category-card');
            if (categoryCard) {
                this.handleCategoryClick(categoryCard);
            }
        });

        // Add hover effects for quality items
        this.container.addEventListener('mouseenter', (e) => {
            const qualityItem = e.target.closest('.quality-item');
            if (qualityItem) {
                this.highlightRelatedData(qualityItem);
            }
        });
    }

    /**
     * Handle category card click
     */
    handleCategoryClick(card) {
        const title = card.querySelector('.category-title').textContent;
        
        // Show detailed information
        this.showCategoryDetails(title);
    }

    /**
     * Highlight related data
     */
    highlightRelatedData(_item) {
        // Add visual feedback to related elements
        const relatedCards = document.querySelectorAll('.category-card');
        relatedCards.forEach(card => {
            card.style.borderColor = 'rgba(59, 130, 246, 0.5)';
        });

        setTimeout(() => {
            relatedCards.forEach(card => {
                card.style.borderColor = '';
            });
        }, 2000);
    }

    /**
     * Show category details modal
     */
    showCategoryDetails(categoryName) {
        const category = this.data.mockDataCategories.find(cat => cat.category === categoryName);
        if (!category) return;

        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>${category.category} Details</h3>
                <div class="category-details">
                    <p><strong>Files:</strong> ${category.fileCount}</p>
                    <p><strong>Size:</strong> ${category.totalSize}</p>
                    <p><strong>Quality Score:</strong> ${category.qualityScore}</p>
                    <p><strong>Issues:</strong> ${category.issues}</p>
                    <p><strong>Confidence:</strong> ${category.confidence}%</p>
                    <p><strong>Description:</strong> ${category.description}</p>
                </div>
                <button onclick="this.closest('.detail-modal').remove()">Close</button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(modal);
    }

    /**
     * Show error message
     */
    showError(message) {
        this.container.textContent = `
            <div class="mock-analysis-dashboard">
                <div class="error-message">
                    <h3>❌ Error</h3>
                    <p>${message}</p>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Refresh dashboard data
     */
    async refresh() {
        await this.loadMockDataAnalysis();
    }

    /**
     * Export dashboard data
     */
    exportData(_format = 'json') {
        if (!this.data) {
            alert('No data to export');
            return;
        }

        const exportData = {
            generatedAt: new Date().toISOString(),
            analysisOverview: this.data.analysisOverview,
            mockDataCategories: this.data.mockDataCategories,
            qualityMetrics: this.data.qualityMetrics,
            detectedIssues: this.data.detectedIssues,
            ggufAIInsights: this.data.ggufAIInsights
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mock-data-analysis-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Refresh analysis data
     */
    async refreshAnalysis() {
        // Show loading state
        const refreshBtn = document.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.textContent = '<i class="fas fa-spinner fa-spin"></i> Loading...' /* Replaced innerHTML with textContent for safety */
            refreshBtn.disabled = true;
        }

        try {
            await this.loadMockDataAnalysis();
            console.log('✅ Mock data analysis refreshed successfully');
        } catch (error) {
            console.error('❌ Failed to refresh analysis:', error);
        } finally {
            // Restore button state
            if (refreshBtn) {
                refreshBtn.textContent = '<i class="fas fa-sync-alt"></i> Refresh' /* Replaced innerHTML with textContent for safety */
                refreshBtn.disabled = false;
            }
        }
    }

    /**
     * Destroy dashboard and cleanup
     */
    destroy() {
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        const styleElement = document.getElementById('mock-analysis-dashboard-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MockDataAnalysisDashboard;
} else if (typeof window !== 'undefined') {
    window.MockDataAnalysisDashboard = MockDataAnalysisDashboard;
}
