/**
 * AI Tools Dashboard
 * Comprehensive dashboard for AI tools management and performance tracking
 * Provides visualization of AI tool usage, performance metrics, and insights
 */

class AIToolsDashboard {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showPerformance: true,
            showUsage: true,
            realTimeUpdates: true,
            updateInterval: 30000, // 30 seconds
            theme: 'dark',
            ...options
        };
        this.data = null;
        this.updateTimer = null;
        
        this.init();
    }

    /**
     * Initialize the AI tools dashboard
     */
    init() {
        if (!this.container) {
            console.error('AI tools dashboard container not found');
            return;
        }

        this.setupStyles();
        this.createDashboardStructure();
        this.bindEvents();
        
        if (this.options.realTimeUpdates) {
            this.startRealTimeUpdates();
        }
    }

    /**
     * Setup CSS styles for the dashboard
     */
    setupStyles() {
        const styleId = 'ai-tools-dashboard-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .ai-tools-dashboard {
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
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .dashboard-subtitle {
                    color: #94a3b8;
                    font-size: 1rem;
                }

                .tools-overview {
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
                    border-color: #8b5cf6;
                    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.2);
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

                .tools-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .tool-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .tool-card:hover {
                    transform: translateY(-2px);
                    border-color: #8b5cf6;
                    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.2);
                }

                .tool-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .tool-name {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .tool-status {
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .status-active {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .status-inactive {
                    background: rgba(100, 116, 139, 0.2);
                    color: #64748b;
                    border: 1px solid #64748b;
                }

                .tool-metrics {
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

                .tool-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    margin-bottom: 1rem;
                }

                .tool-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .tool-btn {
                    padding: 0.5rem 1rem;
                    background: rgba(139, 92, 246, 0.2);
                    color: #8b5cf6;
                    border: 1px solid #8b5cf6;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .tool-btn:hover {
                    background: rgba(139, 92, 246, 0.3);
                    transform: translateY(-1px);
                }

                .tool-btn.primary {
                    background: rgba(139, 92, 246, 0.3);
                    color: #f8fafc;
                    border-color: #8b5cf6;
                }

                .tool-btn.primary:hover {
                    background: #8b5cf6;
                }

                .performance-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .performance-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .performance-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                }

                .performance-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    text-align: center;
                }

                .performance-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .performance-label {
                    color: #94a3b8;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                }

                .performance-bar {
                    height: 8px;
                    background: rgba(148, 163, 184, 0.2);
                    border-radius: 4px;
                    overflow: hidden;
                    margin: 0.5rem 0;
                }

                .performance-fill {
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

                .usage-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .usage-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .usage-chart {
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

                .bar-ai-analysis {
                    --bar-color-top: #8b5cf6;
                    --bar-color-bottom: #7c3aed;
                }

                .bar-gguf-analysis {
                    --bar-color-top: #3b82f6;
                    --bar-color-bottom: #2563eb;
                }

                .bar-code-generation {
                    --bar-color-top: #10b981;
                    --bar-color-bottom: #059669;
                }

                .bar-mock-data {
                    --bar-color-top: #f59e0b;
                    --bar-color-bottom: #d97706;
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
                    border-color: #8b5cf6;
                    box-shadow: 0 4px 15px rgba(139, 92, 246, 0.2);
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
                    background: rgba(139, 92, 246, 0.2);
                    color: #8b5cf6;
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
                    .ai-tools-dashboard {
                        padding: 1rem;
                    }

                    .tools-overview {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .tools-grid {
                        grid-template-columns: 1fr;
                    }

                    .performance-grid {
                        grid-template-columns: repeat(2, 1fr);
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
            <div class="ai-tools-dashboard">
                <div class="dashboard-header">
                    <h2 class="dashboard-title">🤖 AI Tools Dashboard</h2>
                    <p class="dashboard-subtitle">Comprehensive AI tools management and performance tracking</p>
                    <div class="refresh-indicator" id="refresh-indicator">
                        <span>🔄</span>
                        <span>Live</span>
                    </div>
                </div>

                <div class="tools-overview" id="tools-overview">
                    <!-- Overview cards will be rendered here -->
                </div>

                <div class="tools-grid" id="tools-grid">
                    <!-- Tool cards will be rendered here -->
                </div>

                <div class="performance-section" id="performance-section">
                    <h3 class="performance-header">📊 Performance Metrics</h3>
                    <div class="performance-grid" id="performance-grid">
                        <!-- Performance metrics will be rendered here -->
                    </div>
                </div>

                <div class="usage-section" id="usage-section">
                    <h3 class="usage-header">📈 Usage Analytics</h3>
                    <div class="usage-chart">
                        <div class="bar-chart" id="usage-chart">
                            <!-- Usage bars will be rendered here -->
                        </div>
                    </div>
                </div>

                <div class="insights-section" id="insights-section">
                    <h3 class="insights-header">🧠 AI Insights</h3>
                    <div class="insights-grid" id="insights-grid">
                        <!-- Insights will be rendered here -->
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load AI tools data and render dashboard
     */
    async loadAIToolsData() {
        try {
            // Load roadmap data
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            this.data = roadmapData.aiTools;
            this.renderDashboard();
            
        } catch (error) {
            console.error('Failed to load AI tools data:', error);
            this.showError('Failed to load AI tools data');
        }
    }

    /**
     * Render the dashboard with data
     */
    renderDashboard() {
        if (!this.data) return;

        this.renderOverview();
        this.renderTools();
        this.renderPerformance();
        this.renderUsage();
        this.renderInsights();
        
        if (this.options.showPerformance) {
            this.animateCharts();
        }
    }

    /**
     * Render overview cards
     */
    renderOverview() {
        const container = document.getElementById('tools-overview');
        
        // Calculate total tools and active tools from enhanced data
        const totalTools = this.data.tools.length;
        const activeTools = this.data.tools.filter(tool => tool.status === 'active').length;
        const avgAccuracy = Math.round(this.data.tools.reduce((sum, tool) => sum + tool.performance.accuracy, 0) / this.data.tools.length);
        const avgSatisfaction = Math.round((this.data.tools.reduce((sum, tool) => sum + (tool.usage.successRate || 95), 0) / this.data.tools.length));
        
        container.textContent = `
            <div class="overview-card">
                <div class="card-value">${totalTools}</div>
                <div class="card-label">Total Tools</div>
                <div class="card-metric">AI tools available</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${activeTools}</div>
                <div class="card-label">Active Tools</div>
                <div class="card-metric">Currently running</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${avgAccuracy}%</div>
                <div class="card-label">Accuracy</div>
                <div class="card-metric">Overall performance</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${avgSatisfaction}%</div>
                <div class="card-label">Satisfaction</div>
                <div class="card-metric">User feedback</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render tools grid
     */
    renderTools() {
        const container = document.getElementById('tools-grid');
        
        container.textContent = this.data.tools.map((tool, index) => `
            <div class="tool-card">
                <div class="tool-header">
                    <div class="tool-name">${tool.name}</div>
                    <span class="tool-status status-${tool.status}">${tool.status}</span>
                </div>
                <div class="tool-metrics">
                    <div class="metric-item">
                        <div class="metric-value">${tool.performance.accuracy}%</div>
                        <div class="metric-label">Accuracy</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${tool.performance.speed}</div>
                        <div class="metric-label">Speed</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${tool.performance.memory}</div>
                        <div class="metric-label">Memory</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${tool.performance.cpu}</div>
                        <div class="metric-label">CPU</div>
                    </div>
                </div>
                <div class="tool-description">
                    ${tool.name} with ${tool.performance.accuracy}% accuracy and ${tool.performance.speed} processing speed
                </div>
                <div class="tool-actions">
                    <button class="tool-btn primary" onclick="aiToolsDashboard.useTool('${tool.name}')">Use Tool</button>
                    <button class="tool-btn" onclick="aiToolsDashboard.viewDetails('${tool.name}')">Details</button>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render performance metrics
     */
    renderPerformance() {
        const container = document.getElementById('performance-grid');
        
        // Calculate average metrics from enhanced data
        const avgAccuracy = Math.round(this.data.tools.reduce((sum, tool) => sum + tool.performance.accuracy, 0) / this.data.tools.length);
        const avgSpeed = this.data.tools[0].performance.speed; // Use GGUF Analysis Engine speed as primary metric
        const avgMemory = Math.round(this.data.tools.reduce((sum, tool) => {
            const memory = parseFloat(tool.performance.memory.replace('MB', ''));
            return sum + memory;
        }, 0) / this.data.tools.length);
        const avgCPU = this.data.tools.reduce((sum, tool) => sum + parseFloat(tool.performance.cpu.replace('%', '')), 0) / this.data.tools.length;
        
        container.textContent = [
            {
                label: 'Processing Speed',
                value: avgSpeed,
                fill: 'fill-excellent'
            },
            {
                label: 'Accuracy',
                value: `${avgAccuracy}%`,
                fill: 'fill-excellent'
            },
            {
                label: 'Memory Usage',
                value: `${avgMemory}MB`,
                fill: 'fill-good'
            },
            {
                label: 'CPU Usage',
                value: `${avgCPU}%`,
                fill: 'fill-excellent'
            }
        ].map(metric => `
            <div class="performance-item">
                <div class="performance-value">${metric.value}</div>
                <div class="performance-label">${metric.label}</div>
                <div class="performance-bar">
                    <div class="performance-fill ${metric.fill}" style="width: 0%" data-target-width="${this.getPerformanceWidth(metric.value)}%"></div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render usage analytics
     */
    renderUsage() {
        const container = document.getElementById('usage-chart');
        
        const usageData = [
            { name: 'GGUF Analysis Engine', value: 98.5, color: 'ai-analysis' },
            { name: 'Data Quality Monitor', value: 89.2, color: 'gguf-analysis' },
            { name: 'Optimization Engine', value: 95, color: 'code-generation' }
        ];
        
        container.textContent = usageData.map(tool => `
            <div class="bar bar-${tool.color}" style="height: 0%" data-target-height="${tool.value}%">
                <div class="bar-value">${tool.value}%</div>
                <div class="bar-label">${tool.name}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render AI insights
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
     * Generate AI insights
     */
    generateInsights() {
        return this.data.insights.optimizationRecommendations.map((rec, index) => ({
            title: rec.action,
            description: rec.description,
            impact: rec.impact,
            confidence: rec.priority === 'high' ? 95 : rec.priority === 'medium' ? 88 : 85
        }));
    }

    /**
     * Get performance width for bars
     */
    getPerformanceWidth(value) {
        if (typeof value === 'string') {
            if (value.includes('%')) {
                return parseInt(value.replace('%', ''));
            }
            if (value.includes('seconds')) {
                const seconds = parseFloat(value.replace('seconds', ''));
                return Math.max(10, 100 - (seconds * 10));
            }
        }
        return 80;
    }

    /**
     * Animate charts on load
     */
    animateCharts() {
        // Animate performance bars
        const performanceBars = document.querySelectorAll('.performance-fill');
        performanceBars.forEach((bar, index) => {
            const targetWidth = bar.dataset.targetWidth;
            setTimeout(() => {
                bar.style.width = targetWidth;
            }, index * 100);
        });
        
        // Animate usage bars
        const usageBars = document.querySelectorAll('.bar');
        usageBars.forEach((bar, index) => {
            const targetHeight = bar.dataset.targetHeight;
            setTimeout(() => {
                bar.style.height = targetHeight;
            }, index * 100);
        });
    }

    /**
     * Bind interactive events
     */
    bindEvents() {
        // Add click handlers for tool cards
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('tool-btn')) {
                e.preventDefault();
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
     * Use AI tool
     */
    useTool(toolName) {
        this.showNotification(`🚀 Launching ${toolName}...`, 'info');
        
        // Simulate tool launch
        setTimeout(() => {
            this.showNotification(`✅ ${toolName} is ready to use`, 'success');
        }, 2000);
    }

    /**
     * View tool details
     */
    viewDetails(toolName) {
        const tool = this.data.tools.find(t => t.name === toolName);
        if (!tool) return;

        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>${tool.name} Details</h3>
                <div class="tool-details">
                    <p><strong>Status:</strong> ${tool.status}</p>
                    <p><strong>Accuracy:</strong> ${tool.performance.accuracy}%</p>
                    <p><strong>Speed:</strong> ${tool.performance.speed}</p>
                    <p><strong>Memory:</strong> ${tool.performance.memory}</p>
                    <p><strong>CPU:</strong> ${tool.performance.cpu}</p>
                </div>
                <div class="tool-usage-details">
                    <h4>Usage Metrics</h4>
                    <p><strong>Total Analyses:</strong> ${tool.usage.totalAnalyses}</p>
                    <p><strong>Success Rate:</strong> ${tool.usage.successRate}%</p>
                    <p><strong>Avg Processing Time:</strong> ${tool.usage.avgProcessingTime}</p>
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
        const relatedCards = document.querySelectorAll('.tool-card');
        relatedCards.forEach(card => {
            card.style.borderColor = 'rgba(139, 92, 246, 0.5)';
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
                await this.loadAIToolsData();
                indicator.classList.remove('updating');
            } catch (error) {
                console.error('Failed to refresh AI tools data:', error);
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
            <div class="ai-tools-dashboard">
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
        await this.loadAIToolsData();
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
            aiTools: this.data,
            insights: this.generateInsights(),
            performanceMetrics: this.data.performanceMetrics
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-tools-dashboard-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy dashboard and cleanup
     */
    destroy() {
        this.stopRealTimeUpdates();
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        const styleElement = document.getElementById('ai-tools-dashboard-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIToolsDashboard;
} else if (typeof window !== 'undefined') {
    window.AIToolsDashboard = AIToolsDashboard;
}
