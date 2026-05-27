/**
 * Technical Debt Analyzer
 * Comprehensive dashboard for technical debt analysis and reduction tracking
 * Provides visualization of debt metrics, reduction strategies, and impact analysis
 */

class TechnicalDebtAnalyzer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showReduction: true,
            showMetrics: true,
            realTimeUpdates: true,
            updateInterval: 40000, // 40 seconds
            theme: 'dark',
            ...options
        };
        this.data = null;
        this.updateTimer = null;
        
        this.init();
    }

    /**
     * Initialize the technical debt analyzer
     */
    init() {
        if (!this.container) {
            console.error('Technical debt analyzer container not found');
            return;
        }

        this.setupStyles();
        this.createAnalyzerStructure();
        this.bindEvents();
        
        if (this.options.realTimeUpdates) {
            this.startRealTimeUpdates();
        }
    }

    /**
     * Setup CSS styles for the analyzer
     */
    setupStyles() {
        const styleId = 'technical-debt-analyzer-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .technical-debt-analyzer {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                }

                .analyzer-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .analyzer-title {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .analyzer-subtitle {
                    color: #94a3b8;
                    font-size: 1rem;
                }

                .debt-overview {
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
                    border-color: #ef4444;
                    box-shadow: 0 8px 25px rgba(239, 68, 68, 0.2);
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

                .debt-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .debt-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .debt-card:hover {
                    transform: translateY(-2px);
                    border-color: #ef4444;
                    box-shadow: 0 8px 25px rgba(239, 68, 68, 0.2);
                }

                .debt-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .debt-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .debt-severity {
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    text-transform: uppercase;
                }

                .severity-critical {
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

                .debt-metrics {
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

                .debt-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    margin-bottom: 1rem;
                }

                .debt-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .debt-btn {
                    padding: 0.5rem 1rem;
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                    border: 1px solid #ef4444;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .debt-btn:hover {
                    background: rgba(239, 68, 68, 0.3);
                    transform: translateY(-1px);
                }

                .debt-btn.primary {
                    background: rgba(239, 68, 68, 0.3);
                    color: #f8fafc;
                    border-color: #ef4444;
                }

                .debt-btn.primary:hover {
                    background: #ef4444;
                }

                .reduction-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .reduction-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .reduction-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                }

                .reduction-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    text-align: center;
                    transition: all 0.3s ease;
                }

                .reduction-item:hover {
                    border-color: #ef4444;
                    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);
                }

                .reduction-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .reduction-label {
                    color: #94a3b8;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                }

                .reduction-bar {
                    height: 8px;
                    background: rgba(148, 163, 184, 0.2);
                    border-radius: 4px;
                    overflow: hidden;
                    margin: 0.5rem 0;
                }

                .reduction-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 1s ease-in-out;
                }

                .fill-excellent {
                    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
                }

                .fill-good {
                    background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
                }

                .fill-fair {
                    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
                }

                .fill-poor {
                    background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
                }

                .analytics-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .analytics-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .analytics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                }

                .analytics-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    text-align: center;
                }

                .analytics-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .analytics-label {
                    color: #94a3b8;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                }

                .trends-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .trends-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .trend-controls {
                    display: flex;
                    gap: 0.5rem;
                }

                .trend-btn {
                    padding: 0.5rem 1rem;
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                    border: 1px solid #ef4444;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .trend-btn:hover {
                    background: rgba(239, 68, 68, 0.3);
                    transform: translateY(-1px);
                }

                .trend-btn.active {
                    background: #ef4444;
                    color: #f8fafc;
                }

                .trend-chart {
                    height: 300px;
                    position: relative;
                    margin: 1rem 0;
                }

                .line-chart {
                    width: 100%;
                    height: 100%;
                    position: relative;
                }

                .chart-canvas {
                    width: 100%;
                    height: 100%;
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
                    gap: 1rem;
                }

                .insight-card {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    transition: all 0.3s ease;
                }

                .insight-card:hover {
                    border-color: #ef4444;
                    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);
                }

                .insight-title {
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .insight-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.4;
                }

                .insight-metric {
                    color: #64748b;
                    font-size: 0.8rem;
                    margin-top: 0.5rem;
                }

                .refresh-indicator {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.25rem 0.75rem;
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    margin-left: 1rem;
                }

                .refresh-indicator.updating {
                    animation: pulse 1s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                @media (max-width: 768px) {
                    .technical-debt-analyzer {
                        padding: 1rem;
                    }

                    .debt-overview {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .debt-grid {
                        grid-template-columns: 1fr;
                    }

                    .reduction-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create the analyzer structure
     */
    createAnalyzerStructure() {
        this.container.textContent = `
            <div class="technical-debt-analyzer">
                <div class="analyzer-header">
                    <h2 class="analyzer-title">⚠️ Technical Debt Analyzer</h2>
                    <p class="analyzer-subtitle">Comprehensive technical debt analysis and reduction tracking</p>
                    <div class="refresh-indicator" id="refresh-indicator">
                        <span>⚠️</span>
                        <span>Live</span>
                    </div>
                </div>

                <div class="debt-overview" id="debt-overview">
                    <!-- Overview cards will be rendered here -->
                </div>

                <div class="debt-grid" id="debt-grid">
                    <!-- Debt cards will be rendered here -->
                </div>

                <div class="reduction-section" id="reduction-section">
                    <h3 class="reduction-header">📉 Debt Reduction Progress</h3>
                    <div class="reduction-grid" id="reduction-grid">
                        <!-- Reduction metrics will be rendered here -->
                    </div>
                </div>

                <div class="analytics-section" id="analytics-section">
                    <h3 class="analytics-header">📊 Debt Analytics</h3>
                    <div class="analytics-grid" id="analytics-grid">
                        <!-- Analytics metrics will be rendered here -->
                    </div>
                </div>

                <div class="trends-section" id="trends-section">
                    <div class="trends-header">
                        <h3>📈 Debt Trends</h3>
                        <div class="trend-controls">
                            <button class="trend-btn active" data-period="1m">1 Month</button>
                            <button class="trend-btn" data-period="3m">3 Months</button>
                            <button class="trend-btn" data-period="6m">6 Months</button>
                        </div>
                    </div>
                    <div class="trend-chart">
                        <canvas class="chart-canvas" id="trends-chart"></canvas>
                    </div>
                </div>

                <div class="insights-section" id="insights-section">
                    <h3 class="insights-header">🧠 Debt Insights</h3>
                    <div class="insights-grid" id="insights-grid">
                        <!-- Insights will be rendered here -->
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load technical debt data and render analyzer
     */
    async loadTechnicalDebtData() {
        try {
            // Load roadmap data
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            this.data = roadmapData.technicalDebt;
            this.renderAnalyzer();
            
        } catch (error) {
            console.error('Failed to load technical debt data:', error);
            this.showError('Failed to load technical debt data');
        }
    }

    /**
     * Render the analyzer with data
     */
    renderAnalyzer() {
        if (!this.data) return;

        this.renderOverview();
        this.renderDebtGrid();
        this.renderReduction();
        this.renderAnalytics();
        this.renderTrendsChart();
        this.renderInsights();
        
        if (this.options.showMetrics) {
            this.animateCharts();
        }
    }

    /**
     * Render overview cards
     */
    renderOverview() {
        const container = document.getElementById('debt-overview');
        
        // Calculate metrics from enhanced data
        const totalDebt = this.data.categories.reduce((sum, cat) => sum + cat.score, 0);
        const criticalDebt = this.data.categories.filter(cat => cat.severity === 'high').reduce((sum, cat) => sum + cat.score, 0);
        const mediumDebt = this.data.categories.filter(cat => cat.severity === 'medium').reduce((sum, cat) => sum + cat.score, 0);
        const lowDebt = this.data.categories.filter(cat => cat.severity === 'low').reduce((sum, cat) => sum + cat.score, 0);
        
        container.textContent = `
            <div class="overview-card">
                <div class="card-value">${this.data.debtScore}</div>
                <div class="card-label">Debt Score</div>
                <div class="card-metric">Overall debt rating</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${criticalDebt}</div>
                <div class="card-label">Critical</div>
                <div class="card-metric">High priority</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${mediumDebt}</div>
                <div class="card-label">Medium</div>
                <div class="card-metric">Medium priority</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${this.data.qualityMetrics.overallQuality}%</div>
                <div class="card-label">Quality</div>
                <div class="card-metric">Overall quality</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render debt grid
     */
    renderDebtGrid() {
        const container = document.getElementById('debt-grid');
        
        container.textContent = this.data.categories.map((category, index) => `
            <div class="debt-card">
                <div class="debt-header">
                    <div class="debt-title">${category.category}</div>
                    <span class="debt-severity severity-${category.severity}">${category.severity}</span>
                </div>
                <div class="debt-metrics">
                    <div class="metric-item">
                        <div class="metric-value">${category.score}</div>
                        <div class="metric-label">Score</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${category.affectedFiles}</div>
                        <div class="metric-label">Files</div>
                    </div>
                </div>
                <div class="debt-description">${category.description}</div>
                <div class="debt-actions">
                    <button class="debt-btn primary" onclick="technicalDebtAnalyzer.resolveDebt('${category.category}')">Resolve</button>
                    <button class="debt-btn" onclick="technicalDebtAnalyzer.viewDetails('${category.category}')">Details</button>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render reduction section
     */
    renderReduction() {
        const container = document.getElementById('reduction-grid');
        
        const reductionRate = this.data.debtReductionRate;
        
        container.textContent = [
            {
                label: 'Reduction Rate',
                value: `${reductionRate}%`,
                fill: 'fill-excellent'
            },
            {
                label: 'Critical Resolved',
                value: `${Math.round(this.data.criticalDebt * 0.5)}`,
                fill: 'fill-good'
            },
            {
                label: 'Medium Resolved',
                value: `${Math.round(this.data.mediumDebt * 0.8)}`,
                fill: 'fill-good'
            },
            {
                label: 'Low Resolved',
                value: `${this.data.lowDebt}`,
                fill: 'fill-excellent'
            }
        ].map(metric => `
            <div class="reduction-item">
                <div class="reduction-value">${metric.value}</div>
                <div class="reduction-label">${metric.label}</div>
                <div class="reduction-bar">
                    <div class="reduction-fill ${metric.fill}" style="width: 0%" data-target-width="${metric.value.replace('%', '')}%"></div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render analytics section
     */
    renderAnalytics() {
        const container = document.getElementById('analytics-grid');
        
        const analytics = [
            {
                label: 'Debt Score',
                value: '72',
                description: 'Overall debt health score'
            },
            {
                label: 'Reduction Velocity',
                value: '2.3/month',
                description: 'Average debt reduction rate'
            },
            {
                label: 'Avg Resolution Time',
                value: '4.5 days',
                description: 'Average time to resolve debt'
            },
            {
                label: 'Debt Density',
                value: '15%',
                description: 'Debt per 1000 lines'
            }
        ];
        
        container.textContent = analytics.map(metric => `
            <div class="analytics-item">
                <div class="analytics-value">${metric.value}</div>
                <div class="analytics-label">${metric.label}</div>
                <div class="analytics-description">${metric.description}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render trends chart
     */
    renderTrendsChart() {
        const canvas = document.getElementById('trends-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.clientWidth;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Set canvas size
        canvas.width = width;
        canvas.height = height;
        
        // Draw trends data
        const data = this.generateTrendsData();
        const padding = 20;
        
        // Draw axes
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Draw grid lines
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
        ctx.lineWidth = 0.5;
        
        // Horizontal grid lines
        for (let i = 1; i < 5; i++) {
            const y = height - padding - (i * (height - 2 * padding) / 4);
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }
        
        // Draw trends line
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        data.forEach((point, index) => {
            const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((point.value / 100) * (height - 2 * padding));
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw data points
        data.forEach((point, index) => {
            const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((point.value / 100) * (height - 2 * padding));
            
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    /**
     * Render insights
     */
    renderInsights() {
        const container = document.getElementById('insights-grid');
        
        const insights = this.generateInsights();
        
        container.textContent = insights.map(insight => `
            <div class="insight-card">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-description">${insight.description}</div>
                <div class="insight-metric">Impact: ${insight.impact} | Confidence: ${insight.confidence}%</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Generate trends data
     */
    generateTrendsData() {
        const data = [];
        const period = document.querySelector('.trend-btn.active')?.dataset.period || '1m';
        
        let points = 30;
        if (period === '1m') points = 30;
        if (period === '3m') points = 90;
        if (period === '6m') points = 180;
        
        for (let i = 0; i < points; i++) {
            data.push({
                day: i,
                value: 100 - (i * 0.3) + Math.random() * 10
            });
        }
        
        return data;
    }

    /**
     * Generate insights
     */
    generateInsights() {
        return [
            {
                title: 'Debt Reduction Progress Strong',
                description: 'Technical debt reduction rate of 67% indicates effective debt management strategies',
                impact: 'High',
                confidence: 88
            },
            {
                title: 'Critical Debt Addressed',
                description: 'Critical debt items are being prioritized and resolved effectively',
                impact: 'High',
                confidence: 85
            },
            {
                title: 'Medium Debt Management',
                description: 'Medium priority debt items show good progress in resolution',
                impact: 'Medium',
                confidence: 82
            },
            {
                title: 'Low Debt Maintained',
                description: 'Low priority debt items are being tracked and managed appropriately',
                impact: 'Low',
                confidence: 90
            },
            {
                title: 'Debt Prevention Needed',
                description: 'Focus on preventing new debt accumulation through better practices',
                impact: 'High',
                confidence: 92
            }
        ];
    }

    /**
     * Animate charts on load
     */
    animateCharts() {
        // Animate reduction bars
        const reductionBars = document.querySelectorAll('.reduction-fill');
        reductionBars.forEach((bar, index) => {
            const targetWidth = bar.dataset.targetWidth;
            setTimeout(() => {
                bar.style.width = targetWidth;
            }, index * 100);
        });
    }

    /**
     * Bind interactive events
     */
    bindEvents() {
        // Trend period buttons
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('trend-btn')) {
                this.changeTrendPeriod(e.target);
            }
        });

        // Add hover effects for insight cards
        this.container.addEventListener('mouseenter', (e) => {
            const insightCard = e.target.closest('.insight-card');
            if (insightCard) {
                this.highlightRelatedData(insightCard);
            }
        });
    }

    /**
     * Change trend period
     */
    changeTrendPeriod(button) {
        // Remove active class from all buttons
        document.querySelectorAll('.trend-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Update chart based on selected period
        this.renderTrendsChart();
    }

    /**
     * Resolve technical debt
     */
    resolveDebt(debtTitle) {
        this.showNotification(`🔧 Resolving ${debtTitle}...`, 'info');
        
        // Simulate debt resolution
        setTimeout(() => {
            this.showNotification(`✅ ${debtTitle} resolved successfully`, 'success');
            
            // Update data
            if (this.data) {
                this.data.totalDebt = Math.max(0, this.data.totalDebt - 1);
                this.data.totalDebtReduction++;
                this.renderOverview();
            }
        }, 3000);
    }

    /**
     * View debt details
     */
    viewDetails(debtTitle) {
        const debtItem = {
            title: debtTitle,
            severity: 'medium',
            count: 3,
            description: 'Detailed analysis of the technical debt item and recommended actions',
            impact: 'Medium',
            effort: 'Low'
        };

        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>${debtTitle} Details</h3>
                <div class="debt-details">
                    <p><strong>Severity:</strong> ${debtItem.severity}</p>
                    <p><strong>Count:</strong> ${debtItem.count}</p>
                    <p><strong>Impact:</strong> ${debtItem.impact}</p>
                    <p><strong>Effort:</strong> ${debtItem.effort}</p>
                    <p><strong>Description:</strong> ${debtItem.description}</p>
                </div>
                <button onclick="this.closest('.detail-modal').remove()">Close</button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(modal);
    }

    /**
     * Highlight related data when hovering insights
     */
    highlightRelatedData(insightCard) {
        // Add visual feedback to related elements
        const relatedCards = document.querySelectorAll('.debt-card');
        relatedCards.forEach(card => {
            card.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        });

        setTimeout(() => {
            relatedCards.forEach(card => {
                card.style.borderColor = '';
            });
        }, 2000);
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type} show`;
        notification.textContent = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        const indicator = document.getElementById('refresh-indicator');
        if (indicator) {
            indicator.classList.add('updating');
        }

        this.updateTimer = setInterval(async () => {
            try {
                indicator.classList.add('updating');
                await this.loadTechnicalDebtData();
                indicator.classList.remove('updating');
            } catch (error) {
                console.error('Failed to refresh technical debt data:', error);
                indicator.classList.remove('updating');
            }
        }, this.options.updateInterval);
    }

    /**
     * Stop real-time updates
     */
    stopRealTimeUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        const indicator = document.getElementById('refresh-indicator');
        if (indicator) {
            indicator.classList.remove('updating');
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.container.textContent = `
            <div class="technical-debt-analyzer">
                <div class="error-message">
                    <h3>❌ Error</h3>
                    <p>${message}</p>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Refresh analyzer data
     */
    async refresh() {
        await this.loadTechnicalDebtData();
    }

    /**
     * Export analyzer data
     */
    exportData(format = 'json') {
        if (!this.data) {
            alert('No data to export');
            return;
        }

        const exportData = {
            generatedAt: new Date().toISOString(),
            technicalDebt: this.data,
            insights: this.generateInsights(),
            analytics: this.generateAnalyticsData()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `technical-debt-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Generate analytics data
     */
    generateAnalyticsData() {
        return {
            debtScore: 72,
            reductionVelocity: '2.3/month',
            avgResolutionTime: '4.5 days',
            debtDensity: '15%',
            totalDebtReduction: this.data.totalDebtReduction,
            debtReductionRate: this.data.debtReductionRate
        };
    }

    /**
     * Destroy analyzer and cleanup
     */
    destroy() {
        this.stopRealTimeUpdates();
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        const styleElement = document.getElementById('technical-debt-analyzer-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TechnicalDebtAnalyzer;
} else if (typeof window !== 'undefined') {
    window.TechnicalDebtAnalyzer = TechnicalDebtAnalyzer;
}
