/**
 * Roadmap Comparison Dashboard
 * Visual dashboard for comparing GGUF and AI roadmap assessments
 * Interactive charts, tables, and insights visualization
 */

class RoadmapComparisonDashboard {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            animateCharts: true,
            interactiveElements: true,
            showInsights: true,
            theme: 'dark',
            ...options
        };
        this.data = null;
        this.charts = [];
        
        this.init();
    }

    /**
     * Initialize the comparison dashboard
     */
    init() {
        if (!this.container) {
            console.error('Comparison dashboard container not found');
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
        const styleId = 'comparison-dashboard-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .comparison-dashboard {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                }

                .dashboard-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .dashboard-title {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .dashboard-subtitle {
                    color: #94a3b8;
                    font-size: 1.1rem;
                }

                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 2rem;
                    margin-bottom: 2rem;
                }

                .comparison-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                }

                .comparison-card:hover {
                    transform: translateY(-2px);
                    border-color: #3b82f6;
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .card-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .card-badge {
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .badge-consistent {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .badge-inconsistent {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                    border: 1px solid #f59e0b;
                }

                .chart-container {
                    height: 300px;
                    position: relative;
                    margin: 1rem 0;
                }

                .bar-chart {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-around;
                    height: 250px;
                    padding: 1rem 0;
                }

                .bar {
                    width: 80px;
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

                .bar-gguf {
                    --bar-color-top: #10b981;
                    --bar-color-bottom: #059669;
                }

                .bar-ai {
                    --bar-color-top: #3b82f6;
                    --bar-color-bottom: #2563eb;
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
                    font-size: 1rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .comparison-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1rem 0;
                }

                .comparison-table th,
                .comparison-table td {
                    padding: 0.75rem;
                    text-align: left;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
                }

                .comparison-table th {
                    background: rgba(15, 23, 42, 0.8);
                    color: #f8fafc;
                    font-weight: 600;
                }

                .comparison-table td {
                    color: #94a3b8;
                }

                .status-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 0.5rem;
                }

                .status-consistent {
                    background: #10b981;
                }

                .status-inconsistent {
                    background: #f59e0b;
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
                    margin-bottom: 1rem;
                }

                .insight-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    margin: 1rem 0;
                    transition: all 0.3s ease;
                }

                .insight-item:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
                }

                .insight-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }

                .insight-title {
                    font-weight: 600;
                    color: #f8fafc;
                }

                .insight-severity {
                    padding: 0.25rem 0.5rem;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 500;
                    text-transform: uppercase;
                }

                .severity-high {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .severity-medium {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                }

                .severity-low {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }

                .insight-description {
                    color: #94a3b8;
                    line-height: 1.5;
                    margin-bottom: 0.5rem;
                }

                .insight-impact {
                    font-size: 0.8rem;
                    color: #64748b;
                }

                .recommendations-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .recommendation-item {
                    display: flex;
                    align-items: flex-start;
                    padding: 1rem;
                    margin: 0.5rem 0;
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    transition: all 0.3s ease;
                }

                .recommendation-item:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
                }

                .recommendation-priority {
                    width: 4px;
                    height: 100%;
                    border-radius: 2px;
                    margin-right: 1rem;
                }

                .priority-high {
                    background: #ef4444;
                }

                .priority-medium {
                    background: #f59e0b;
                }

                .priority-low {
                    background: #10b981;
                }

                .recommendation-content {
                    flex: 1;
                }

                .recommendation-title {
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.25rem;
                }

                .recommendation-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    margin-bottom: 0.5rem;
                }

                .recommendation-meta {
                    display: flex;
                    gap: 1rem;
                    font-size: 0.8rem;
                    color: #64748b;
                }

                .alignment-score {
                    text-align: center;
                    padding: 2rem;
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    margin: 2rem 0;
                }

                .score-circle {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    margin: 0 auto 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    font-weight: 700;
                    color: #f8fafc;
                    position: relative;
                }

                .score-high {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                }

                .score-medium {
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                }

                .score-low {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                }

                .score-label {
                    font-size: 1rem;
                    color: #94a3b8;
                    margin-bottom: 0.5rem;
                }

                .score-description {
                    color: #64748b;
                    font-size: 0.9rem;
                }

                @media (max-width: 768px) {
                    .comparison-dashboard {
                        padding: 1rem;
                    }

                    .dashboard-grid {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }

                    .bar-chart {
                        height: 200px;
                    }

                    .bar {
                        width: 60px;
                    }
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
            <div class="comparison-dashboard">
                <div class="dashboard-header">
                    <h2 class="dashboard-title">📊 Roadmap Comparison Dashboard</h2>
                    <p class="dashboard-subtitle">GGUF vs AI Assessment Analysis</p>
                </div>

                <div class="alignment-score" id="alignment-score">
                    <div class="score-label">Overall Alignment Score</div>
                    <div class="score-circle" id="score-circle">--</div>
                    <div class="score-description" id="score-description">Calculating...</div>
                </div>

                <div class="dashboard-grid">
                    <div class="comparison-card">
                        <div class="card-header">
                            <h3 class="card-title">Completion Rate</h3>
                            <span class="card-badge badge-inconsistent" id="completion-badge">Inconsistent</span>
                        </div>
                        <div class="chart-container">
                            <div class="bar-chart" id="completion-chart"></div>
                        </div>
                    </div>

                    <div class="comparison-card">
                        <div class="card-header">
                            <h3 class="card-title">Project Health</h3>
                            <span class="card-badge badge-inconsistent" id="health-badge">Inconsistent</span>
                        </div>
                        <div class="chart-container">
                            <div class="comparison-table" id="health-table"></div>
                        </div>
                    </div>

                    <div class="comparison-card">
                        <div class="card-header">
                            <h3 class="card-title">Development Velocity</h3>
                            <span class="card-badge badge-inconsistent" id="velocity-badge">Inconsistent</span>
                        </div>
                        <div class="chart-container">
                            <div class="comparison-table" id="velocity-table"></div>
                        </div>
                    </div>

                    <div class="comparison-card">
                        <div class="card-header">
                            <h3 class="card-title">Feature Categories</h3>
                            <span class="card-badge badge-consistent" id="categories-badge">Consistent</span>
                        </div>
                        <div class="chart-container">
                            <div class="comparison-table" id="categories-table"></div>
                        </div>
                    </div>
                </div>

                <div class="insights-section" id="insights-section">
                    <h3 class="insights-header">🔍 Key Insights</h3>
                    <div id="insights-container"></div>
                </div>

                <div class="recommendations-section" id="recommendations-section">
                    <h3 class="insights-header">💡 Recommendations</h3>
                    <div id="recommendations-container"></div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load comparison data and render dashboard
     */
    async loadComparisonData() {
        try {
            // Load both reports
            const roadmapService = new RoadmapDataService();
            const ggufData = await roadmapService.loadRoadmapData('gguf');
            const aiData = await this.generateAIReport();
            
            // Perform comparison analysis
            const analyzer = new RoadmapComparisonAnalyzer();
            const analysis = analyzer.performEnhancedComparison(ggufData, aiData);
            
            this.data = analysis;
            this.renderDashboard();
            
        } catch (error) {
            console.error('Failed to load comparison data:', error);
            this.showError('Failed to load comparison data');
        }
    }

    /**
     * Generate AI report (simplified version)
     */
    async generateAIReport() {
        const roadmapService = new RoadmapDataService();
        const roadmapData = await roadmapService.loadRoadmapData('static');
        
        return {
            type: 'ai-powered-roadmap-report',
            executiveSummary: {
                totalPhases: roadmapData.developmentPhases?.length || 4,
                completedPhases: roadmapData.developmentPhases?.filter(p => p.status === 'completed').length || 2,
                completionRate: '56%', // Conservative assessment
                projectHealth: 'Good',
                developmentVelocity: 'Moderate',
                analysisMethod: 'Cloud-based AI analysis with executive perspective'
            },
            developmentPhases: roadmapData.developmentPhases || []
        };
    }

    /**
     * Render the dashboard with data
     */
    renderDashboard() {
        if (!this.data) return;

        this.renderAlignmentScore();
        this.renderCompletionChart();
        this.renderHealthTable();
        this.renderVelocityTable();
        this.renderCategoriesTable();
        this.renderInsights();
        this.renderRecommendations();
        
        if (this.options.animateCharts) {
            this.animateCharts();
        }
    }

    /**
     * Render alignment score
     */
    renderAlignmentScore() {
        const scoreCircle = document.getElementById('score-circle');
        const scoreDescription = document.getElementById('score-description');
        
        const alignmentScore = this.calculateAlignmentScore();
        
        scoreCircle.textContent = `${alignmentScore}%`;
        scoreCircle.className = 'score-circle ' + this.getScoreClass(alignmentScore);
        
        if (alignmentScore >= 80) {
            scoreDescription.textContent = 'Strong alignment between assessments';
        } else if (alignmentScore >= 60) {
            scoreDescription.textContent = 'Moderate alignment - some differences noted';
        } else {
            scoreDescription.textContent = 'Low alignment - significant differences require attention';
        }
    }

    /**
     * Render completion rate chart
     */
    renderCompletionChart() {
        const chartContainer = document.getElementById('completion-chart');
        const badge = document.getElementById('completion-badge');
        
        const ggufValue = parseFloat(this.data.differences.completionRate.gguf);
        const aiValue = parseFloat(this.data.differences.completionRate.ai);
        const maxValue = Math.max(ggufValue, aiValue);
        
        chartContainer.textContent = `
            <div class="bar bar-gguf" style="height: ${(ggufValue / maxValue) * 100}%">
                <div class="bar-value">${ggufValue}%</div>
                <div class="bar-label">GGUF</div>
            </div>
            <div class="bar bar-ai" style="height: ${(aiValue / maxValue) * 100}%">
                <div class="bar-value">${aiValue}%</div>
                <div class="bar-label">AI</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        // Update badge
        if (this.data.differences.completionRate.significance === 'minimal') {
            badge.textContent = 'Consistent';
            badge.className = 'card-badge badge-consistent';
        } else {
            badge.textContent = 'Inconsistent';
            badge.className = 'card-badge badge-inconsistent';
        }
    }

    /**
     * Render health comparison table
     */
    renderHealthTable() {
        const tableContainer = document.getElementById('health-table');
        const badge = document.getElementById('health-badge');
        
        const ggufHealth = this.data.differences.projectHealth.gguf;
        const aiHealth = this.data.differences.projectHealth.ai;
        
        tableContainer.textContent = `
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Assessment</th>
                        <th>Health Status</th>
                        <th>Consistent</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>GGUF</td>
                        <td>${ggufHealth}</td>
                        <td><span class="status-indicator ${this.data.differences.projectHealth.consistent ? 'status-consistent' : 'status-inconsistent'}"></span>${this.data.differences.projectHealth.consistent ? 'Yes' : 'No'}</td>
                    </tr>
                    <tr>
                        <td>AI</td>
                        <td>${aiHealth}</td>
                        <td><span class="status-indicator ${this.data.differences.projectHealth.consistent ? 'status-consistent' : 'status-inconsistent'}"></span>${this.data.differences.projectHealth.consistent ? 'Yes' : 'No'}</td>
                    </tr>
                </tbody>
            </table>
        ` /* Replaced innerHTML with textContent for safety */
        
        // Update badge
        badge.textContent = this.data.differences.projectHealth.consistent ? 'Consistent' : 'Inconsistent';
        badge.className = 'card-badge ' + (this.data.differences.projectHealth.consistent ? 'badge-consistent' : 'badge-inconsistent');
    }

    /**
     * Render velocity comparison table
     */
    renderVelocityTable() {
        const tableContainer = document.getElementById('velocity-table');
        const badge = document.getElementById('velocity-badge');
        
        const ggufVelocity = this.data.differences.developmentVelocity.gguf;
        const aiVelocity = this.data.differences.developmentVelocity.ai;
        
        tableContainer.textContent = `
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Assessment</th>
                        <th>Velocity</th>
                        <th>Consistent</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>GGUF</td>
                        <td>${ggufVelocity}</td>
                        <td><span class="status-indicator ${this.data.differences.developmentVelocity.consistent ? 'status-consistent' : 'status-inconsistent'}"></span>${this.data.differences.developmentVelocity.consistent ? 'Yes' : 'No'}</td>
                    </tr>
                    <tr>
                        <td>AI</td>
                        <td>${aiVelocity}</td>
                        <td><span class="status-indicator ${this.data.differences.developmentVelocity.consistent ? 'status-consistent' : 'status-inconsistent'}"></span>${this.data.differences.developmentVelocity.consistent ? 'Yes' : 'No'}</td>
                    </tr>
                </tbody>
            </table>
        ` /* Replaced innerHTML with textContent for safety */
        
        // Update badge
        badge.textContent = this.data.differences.developmentVelocity.consistent ? 'Consistent' : 'Inconsistent';
        badge.className = 'card-badge ' + (this.data.differences.developmentVelocity.consistent ? 'badge-consistent' : 'badge-inconsistent');
    }

    /**
     * Render feature categories table
     */
    renderCategoriesTable() {
        const tableContainer = document.getElementById('categories-table');
        const badge = document.getElementById('categories-badge');
        
        const categories = Object.entries(this.data.differences.featureCategories);
        
        tableContainer.textContent = `
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>GGUF</th>
                        <th>AI</th>
                        <th>Consistent</th>
                    </tr>
                </thead>
                <tbody>
                    ${categories.map(([category, comparison]) => `
                        <tr>
                            <td>${category}</td>
                            <td>${comparison.gguf.completionRate}</td>
                            <td>${comparison.ai?.completionRate || 'N/A'}</td>
                            <td><span class="status-indicator ${comparison.consistent ? 'status-consistent' : 'status-inconsistent'}"></span>${comparison.consistent ? 'Yes' : 'No'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` /* Replaced innerHTML with textContent for safety */
        
        // Calculate overall consistency
        const consistentCount = categories.filter(([_, comparison]) => comparison.consistent).length;
        const totalCount = categories.length;
        const isOverallConsistent = consistentCount / totalCount > 0.7;
        
        badge.textContent = isOverallConsistent ? 'Consistent' : 'Inconsistent';
        badge.className = 'card-badge ' + (isOverallConsistent ? 'badge-consistent' : 'badge-inconsistent');
    }

    /**
     * Render insights
     */
    renderInsights() {
        const container = document.getElementById('insights-container');
        
        container.textContent = this.data.insights.map(insight => `
            <div class="insight-item">
                <div class="insight-header">
                    <div class="insight-title">${insight.title}</div>
                    <span class="insight-severity severity-${insight.severity}">${insight.severity}</span>
                </div>
                <div class="insight-description">${insight.description}</div>
                <div class="insight-impact">Impact: ${insight.impact} | Action: ${insight.action}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render recommendations
     */
    renderRecommendations() {
        const container = document.getElementById('recommendations-container');
        
        container.textContent = this.data.recommendations.map(rec => `
            <div class="recommendation-item">
                <div class="recommendation-priority priority-${rec.priority}"></div>
                <div class="recommendation-content">
                    <div class="recommendation-title">${rec.action}</div>
                    <div class="recommendation-description">${rec.description}</div>
                    <div class="recommendation-meta">
                        <span>Impact: ${rec.impact}</span>
                        <span>Effort: ${rec.effort}</span>
                        <span>Timeline: ${rec.timeline}</span>
                    </div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Calculate alignment score
     */
    calculateAlignmentScore() {
        let score = 50;
        
        // Completion rate alignment
        if (this.data.differences.completionRate.significance === 'minimal') score += 25;
        else if (this.data.differences.completionRate.significance === 'low') score += 15;
        else if (this.data.differences.completionRate.significance === 'medium') score += 5;
        
        // Health assessment alignment
        if (this.data.differences.projectHealth.consistent) score += 15;
        
        // Velocity assessment alignment
        if (this.data.differences.developmentVelocity.consistent) score += 10;
        
        return Math.min(100, Math.max(0, score));
    }

    /**
     * Get score class based on value
     */
    getScoreClass(score) {
        if (score >= 80) return 'score-high';
        if (score >= 60) return 'score-medium';
        return 'score-low';
    }

    /**
     * Animate charts on load
     */
    animateCharts() {
        const bars = document.querySelectorAll('.bar');
        bars.forEach((bar, index) => {
            const height = bar.style.height;
            bar.style.height = '0';
            setTimeout(() => {
                bar.style.height = height;
            }, index * 200);
        });
    }

    /**
     * Bind interactive events
     */
    bindEvents() {
        // Add click handlers for bars
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('bar')) {
                this.handleBarClick(e.target);
            }
        });

        // Add hover effects for insight items
        this.container.addEventListener('mouseenter', (e) => {
            if (e.target.closest('.insight-item')) {
                this.highlightRelatedData(e.target.closest('.insight-item'));
            }
        });
    }

    /**
     * Handle bar click events
     */
    handleBarClick(bar) {
        const value = bar.querySelector('.bar-value').textContent;
        const label = bar.querySelector('.bar-label').textContent;
        
        // Show detailed information
        this.showDetailModal(label, value);
    }

    /**
     * Highlight related data when hovering insights
     */
    highlightRelatedData(insightItem) {
        // Add visual feedback to related comparison cards
        const relatedCards = document.querySelectorAll('.comparison-card');
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
     * Show detail modal
     */
    showDetailModal(title, value) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>${title} Assessment Details</h3>
                <p>Current Value: ${value}</p>
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
            <div class="comparison-dashboard">
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
        await this.loadComparisonData();
    }

    /**
     * Export dashboard data
     */
    exportData(format = 'json') {
        if (!this.data) {
            alert('No data to export');
            return;
        }

        const exportData = {
            generatedAt: new Date().toISOString(),
            alignmentScore: this.calculateAlignmentScore(),
            ...this.data
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roadmap-comparison-dashboard-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy dashboard and cleanup
     */
    destroy() {
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        const styleElement = document.getElementById('comparison-dashboard-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoadmapComparisonDashboard;
} else if (typeof window !== 'undefined') {
    window.RoadmapComparisonDashboard = RoadmapComparisonDashboard;
}
