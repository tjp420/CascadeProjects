/**
 * Development Tools Tracker
 * Comprehensive dashboard for development tools management and usage tracking
 * Provides visualization of dev tools, database integration, API framework, and merge tools
 */

class DevelopmentToolsTracker {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showUsage: true,
            showPerformance: true,
            realTimeUpdates: true,
            updateInterval: 35000, // 35 seconds
            theme: 'dark',
            ...options
        };
        this.data = null;
        this.updateTimer = null;
        
        this.init();
    }

    /**
     * Initialize the development tools tracker
     */
    init() {
        if (!this.container) {
            console.error('Development tools tracker container not found');
            return;
        }

        this.setupStyles();
        this.createTrackerStructure();
        this.bindEvents();
        
        if (this.options.realTimeUpdates) {
            this.startRealTimeUpdates();
        }
    }

    /**
     * Setup CSS styles for the tracker
     */
    setupStyles() {
        const styleId = 'development-tools-tracker-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .development-tools-tracker {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                }

                .tracker-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .tracker-title {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .tracker-subtitle {
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
                    border-color: #f59e0b;
                    box-shadow: 0 8px 25px rgba(245, 158, 11, 0.2);
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
                    border-color: #f59e0b;
                    box-shadow: 0 8px 25px rgba(245, 158, 11, 0.2);
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
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                    border: 1px solid #f59e0b;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .tool-btn:hover {
                    background: rgba(245, 158, 11, 0.3);
                    transform: translateY(-1px);
                }

                .tool-btn.primary {
                    background: rgba(245, 158, 11, 0.3);
                    color: #f8fafc;
                    border-color: #f59e0b;
                }

                .tool-btn.primary:hover {
                    background: #f59e0b;
                }

                .database-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .database-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .database-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                }

                .database-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    text-align: center;
                    transition: all 0.3s ease;
                }

                .database-item:hover {
                    border-color: #f59e0b;
                    box-shadow: 0 4px 15px rgba(245, 158, 11, 0.2);
                }

                .database-icon {
                    font-size: 2rem;
                    margin-bottom: 0.5rem;
                }

                .database-name {
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.25rem;
                }

                .database-status {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .api-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .api-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .api-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                }

                .api-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    transition: all 0.3s ease;
                }

                .api-item:hover {
                    border-color: #f59e0b;
                    box-shadow: 0 4px 15px rgba(245, 158, 11, 0.2);
                }

                .api-method {
                    display: inline-block;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 500;
                    margin-bottom: 0.5rem;
                }

                .method-get {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }

                .method-post {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                }

                .method-put {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                }

                .method-delete {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .api-endpoint {
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.25rem;
                }

                .api-description {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .merge-tool-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .merge-tool-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .merge-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                }

                .merge-stat {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    text-align: center;
                }

                .merge-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .merge-label {
                    color: #94a3b8;
                    font-size: 0.8rem;
                    text-transform: uppercase;
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

                .bar-database {
                    --bar-color-top: #10b981;
                    --bar-color-bottom: #059669;
                }

                .bar-api {
                    --bar-color-top: #3b82f6;
                    --bar-color-bottom: #2563eb;
                }

                .bar-merge {
                    --bar-color-top: #f59e0b;
                    --bar-color-bottom: #d97706;
                }

                .bar-testing {
                    --bar-color-top: #ef4444;
                    --bar-color-bottom: #dc2626;
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
                    border-color: #f59e0b;
                    box-shadow: 0 4px 15px rgba(245, 158, 11, 0.2);
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
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
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
                    .development-tools-tracker {
                        padding: 1rem;
                    }

                    .tools-overview {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .tools-grid {
                        grid-template-columns: 1fr;
                    }

                    .database-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create the tracker structure
     */
    createTrackerStructure() {
        this.container.textContent = `
            <div class="development-tools-tracker">
                <div class="tracker-header">
                    <h2 class="tracker-title">🔧 Development Tools Tracker</h2>
                    <p class="tracker-subtitle">Comprehensive development tools management and usage tracking</p>
                    <div class="refresh-indicator" id="refresh-indicator">
                        <span>🔧</span>
                        <span>Live</span>
                    </div>
                </div>

                <div class="tools-overview" id="tools-overview">
                    <!-- Overview cards will be rendered here -->
                </div>

                <div class="tools-grid" id="tools-grid">
                    <!-- Tool cards will be rendered here -->
                </div>

                <div class="database-section" id="database-section">
                    <h3 class="database-header">🗄️ Database Integration</h3>
                    <div class="database-grid" id="database-grid">
                        <!-- Database items will be rendered here -->
                    </div>
                </div>

                <div class="api-section" id="api-section">
                    <h3 class="api-header">🌐 API Framework</h3>
                    <div class="api-grid" id="api-grid">
                        <!-- API items will be rendered here -->
                    </div>
                </div>

                <div class="merge-tool-section" id="merge-tool-section">
                    <h3 class="merge-tool-header">🔀 Merge Tool</h3>
                    <div class="merge-stats" id="merge-stats">
                        <!-- Merge stats will be rendered here -->
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
                    <h3 class="insights-header">💡 Development Insights</h3>
                    <div class="insights-grid" id="insights-grid">
                        <!-- Insights will be rendered here -->
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load development tools data and render tracker
     */
    async loadDevToolsData() {
        try {
            // Load roadmap data
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            this.data = roadmapData.developmentTools;
            this.renderTracker();
            
        } catch (error) {
            console.error('Failed to load development tools data:', error);
            this.showError('Failed to load development tools data');
        }
    }

    /**
     * Render the tracker with data
     */
    renderTracker() {
        if (!this.data) return;

        this.renderOverview();
        this.renderTools();
        this.renderDatabase();
        this.renderAPI();
        this.renderMergeTool();
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
        
        // Calculate metrics from enhanced data
        const totalTools = this.data.tools.length;
        const activeTools = this.data.tools.filter(tool => tool.status === 'active').length;
        const avgSuccessRate = Math.round(this.data.tools.reduce((sum, tool) => sum + tool.usage.successRate, 0) / this.data.tools.length);
        const avgProcessingTime = this.data.tools.reduce((sum, tool) => sum + parseFloat(tool.usage.avgTime.replace('seconds', '')), 0) / this.data.tools.length;
        
        container.textContent = `
            <div class="overview-card">
                <div class="card-value">${totalTools}</div>
                <div class="card-label">Total Tools</div>
                <div class="card-metric">Development tools</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${activeTools}</div>
                <div class="card-label">Active Tools</div>
                <div class="card-metric">Currently running</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${avgSuccessRate}%</div>
                <div class="card-label">Success Rate</div>
                <div class="card-metric">Average success</div>
            </div>
            <div class="overview-card">
                <div class="card-value">${avgProcessingTime.toFixed(1)}s</div>
                <div class="card-label">Avg Time</div>
                <div class="card-metric">Processing time</div>
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
                        <div class="metric-value">${tool.usage.totalGenerated || tool.usage.totalValidations || tool.usage.totalAnalyses}</div>
                        <div class="metric-label">Total</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${tool.usage.avgTime}</div>
                        <div class="metric-label">Avg Time</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${tool.usage.successRate}%</div>
                        <div class="metric-label">Success</div>
                    </div>
                </div>
                <div class="tool-description">
                    ${tool.name} with ${tool.usage.successRate}% success rate and ${tool.usage.avgTime} average processing time
                </div>
                <div class="tool-actions">
                    <button class="tool-btn primary" onclick="devToolsTracker.useTool('${tool.name}')">Use Tool</button>
                    <button class="tool-btn" onclick="devToolsTracker.viewDetails('${tool.name}')">Details</button>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render database section
     */
    renderDatabase() {
        const container = document.getElementById('database-grid');
        
        const databases = [
            { name: 'PostgreSQL', status: 'Connected', icon: '🐘' },
            { name: 'MongoDB', status: 'Connected', icon: '🍃' },
            { name: 'Redis', status: 'Connected', icon: '⚡' },
            { name: 'SQLite', status: 'Available', icon: '📁' }
        ];
        
        container.textContent = databases.map(db => `
            <div class="database-item">
                <div class="database-icon">${db.icon}</div>
                <div class="database-name">${db.name}</div>
                <div class="database-status">${db.status}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render API section
     */
    renderAPI() {
        const container = document.getElementById('api-grid');
        
        const apis = [
            { method: 'GET', endpoint: '/api/v1/data', description: 'Retrieve data records' },
            { method: 'POST', endpoint: '/api/v1/create', description: 'Create new records' },
            { method: 'PUT', endpoint: '/api/v1/update', description: 'Update existing records' },
            { method: 'DELETE', endpoint: '/api/v1/delete', description: 'Delete records' },
            { method: 'GET', endpoint: '/api/v1/search', description: 'Search functionality' },
            { method: 'POST', endpoint: '/api/v1/export', description: 'Export data' }
        ];
        
        container.textContent = apis.map(api => `
            <div class="api-item">
                <div class="api-method method-${api.method.toLowerCase()}">${api.method}</div>
                <div class="api-endpoint">${api.endpoint}</div>
                <div class="api-description">${api.description}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render merge tool section
     */
    renderMergeTool() {
        const container = document.getElementById('merge-stats');
        
        const stats = [
            { label: 'Total Merges', value: '156', icon: '🔀' },
            { label: 'Success Rate', value: '94%', icon: '✅' },
            { label: 'Avg Time', value: '2.3s', icon: '⏱️' },
            { label: 'Conflicts', value: '12', icon: '⚠️' }
        ];
        
        container.textContent = stats.map(stat => `
            <div class="merge-stat">
                <div class="merge-value">${stat.value}</div>
                <div class="merge-label">${stat.label}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render usage analytics
     */
    renderUsage() {
        const container = document.getElementById('usage-chart');
        
        const usageData = [
            { name: 'Database', value: 78, color: 'database' },
            { name: 'API', value: 92, color: 'api' },
            { name: 'Merge Tool', value: 65, color: 'merge' },
            { name: 'Testing', value: 88, color: 'testing' }
        ];
        
        container.textContent = usageData.map(tool => `
            <div class="bar bar-${tool.color}" style="height: 0%" data-target-height="${tool.value}%">
                <div class="bar-value">${tool.value}%</div>
                <div class="bar-label">${tool.name}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
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
     * Generate development insights
     */
    generateInsights() {
        return [
            {
                title: 'High Tool Utilization',
                description: 'Development tools are being utilized efficiently with high user satisfaction',
                impact: 'High',
                confidence: 92
            },
            {
                title: 'Excellent Performance',
                description: 'All development tools are performing at optimal levels with high efficiency',
                impact: 'High',
                confidence: 88
            },
            {
                title: 'Database Integration Strong',
                description: 'Database connections are stable and performing well across all environments',
                impact: 'Medium',
                confidence: 85
            },
            {
                title: 'API Framework Robust',
                description: 'API framework provides comprehensive functionality with good performance metrics',
                impact: 'Medium',
                confidence: 87
            },
            {
                title: 'Merge Tool Effective',
                description: 'Merge tool is working efficiently with high success rate and low conflict rates',
                impact: 'Medium',
                confidence: 90
            }
        ];
    }

    /**
     * Animate charts on load
     */
    animateCharts() {
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
     * Use development tool
     */
    useTool(toolName) {
        this.showNotification(`🔧 Launching ${toolName}...`, 'info');
        
        // Simulate tool launch
        setTimeout(() => {
            this.showNotification(`✅ ${toolName} is ready to use`, 'success');
        }, 2000);
    }

    /**
     * View tool details
     */
    viewDetails(toolName) {
        const tool = this.data.tools.find(t => t === toolName);
        if (!tool) return;

        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>${tool} Details</h3>
                <div class="tool-details">
                    <p><strong>Status:</strong> Active</p>
                    <p><strong>Performance:</strong> High</p>
                    <p><strong>Efficiency:</strong> ${this.data.usageMetrics.efficiency}</p>
                    <p><strong>User Satisfaction:</strong> ${this.data.usageMetrics.userSatisfaction}%</p>
                    <p><strong>Usage Frequency:</strong> ${this.data.usageMetrics.avgUsage}</p>
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
            card.style.borderColor = 'rgba(245, 158, 11, 0.5)';
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
                await this.loadDevToolsData();
                indicator.classList.remove('updating');
            } catch (error) {
                console.error('Failed to refresh development tools data:', error);
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
            <div class="development-tools-tracker">
                <div class="error-message">
                    <h3>❌ Error</h3>
                    <p>${message}</p>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Refresh tracker data
     */
    async refresh() {
        await this.loadDevToolsData();
    }

    /**
     * Export tracker data
     */
    exportData(format = 'json') {
        if (!this.data) {
            alert('No data to export');
            return;
        }

        const exportData = {
            generatedAt: new Date().toISOString(),
            developmentTools: this.data,
            insights: this.generateInsights(),
            usageMetrics: this.data.usageMetrics
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `development-tools-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy tracker and cleanup
     */
    destroy() {
        this.stopRealTimeUpdates();
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        const styleElement = document.getElementById('development-tools-tracker-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DevelopmentToolsTracker;
} else if (typeof window !== 'undefined') {
    window.DevelopmentToolsTracker = DevelopmentToolsTracker;
}
