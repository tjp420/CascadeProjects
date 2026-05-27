/**
 * Advanced Analytics Dashboard
 * Comprehensive reporting and analytics system for AI Coding Intelligence Dashboard
 * 
 * Features:
 * - Real-time data visualization
 * - Interactive charts and graphs
 * - Custom report generation
 * - Performance metrics tracking
 * - Predictive analytics
 * - Export capabilities
 */

class AdvancedAnalyticsDashboard {
    constructor() {
        this.container = null;
        this.charts = new Map();
        this.dataCache = new Map();
        this.refreshInterval = 30000; // 30 seconds
        this.isInitialized = false;
        this.currentView = 'overview';
        this.dateRange = '30d'; // Default 30 days
        this.metrics = {
            codeQuality: 0,
            securityScore: 0,
            performanceScore: 0,
            testCoverage: 0,
            technicalDebt: 0
        };
        
        // Initialize event listeners
        this.initEventListeners();
    }

    /**
     * Initialize the analytics dashboard
     */
    async initialize(container) {
        this.container = container;
        
        if (!this.container) {
            console.error('❌ Advanced Analytics Dashboard: Container not found');
            return;
        }

        console.log('🚀 Initializing Advanced Analytics Dashboard...');
        
        try {
            // Load dashboard HTML
            await this.loadDashboardHTML();
            
            // Initialize components
            await this.initializeComponents();
            
            // Load initial data
            await this.loadDashboardData();
            
            // Start real-time updates
            this.startRealTimeUpdates();
            
            this.isInitialized = true;
            console.log('✅ Advanced Analytics Dashboard initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Advanced Analytics Dashboard:', error);
            this.showError('Failed to load analytics dashboard');
        }
    }

    /**
     * Load dashboard HTML structure
     */
    async loadDashboardHTML() {
        this.container.textContent = `
            <div class="analytics-dashboard">
                <!-- Dashboard Header -->
                <div class="analytics-header">
                    <div class="header-content">
                        <h1 class="dashboard-title">
                            <i class="fas fa-chart-line"></i>
                            Advanced Analytics Dashboard
                        </h1>
                        <div class="header-controls">
                            <div class="date-range-selector">
                                <label for="dateRange">Time Range:</label>
                                <select id="dateRange" class="form-select">
                                    <option value="7d">Last 7 Days</option>
                                    <option value="30d" selected>Last 30 Days</option>
                                    <option value="90d">Last 90 Days</option>
                                    <option value="1y">Last Year</option>
                                </select>
                            </div>
                            <div class="view-selector">
                                <button class="btn btn-primary active" data-view="overview">
                                    <i class="fas fa-tachometer-alt"></i> Overview
                                </button>
                                <button class="btn btn-secondary" data-view="detailed">
                                    <i class="fas fa-chart-bar"></i> Detailed
                                </button>
                                <button class="btn btn-secondary" data-view="trends">
                                    <i class="fas fa-chart-area"></i> Trends
                                </button>
                            </div>
                            <div class="export-controls">
                                <button class="btn btn-success" id="exportReport">
                                    <i class="fas fa-download"></i> Export Report
                                </button>
                                <button class="btn btn-info" id="refreshData">
                                    <i class="fas fa-sync-alt"></i> Refresh
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Key Metrics Overview -->
                <div class="metrics-overview">
                    <div class="metrics-grid">
                        <div class="metric-card" data-metric="codeQuality">
                            <div class="metric-header">
                                <h3>Code Quality</h3>
                                <i class="fas fa-code"></i>
                            </div>
                            <div class="metric-value">
                                <span class="value">--</span>
                                <span class="unit">%</span>
                            </div>
                            <div class="metric-trend">
                                <i class="fas fa-arrow-up trend-up"></i>
                                <span class="trend-value">+2.3%</span>
                            </div>
                        </div>
                        
                        <div class="metric-card" data-metric="securityScore">
                            <div class="metric-header">
                                <h3>Security Score</h3>
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div class="metric-value">
                                <span class="value">--</span>
                                <span class="unit">pts</span>
                            </div>
                            <div class="metric-trend">
                                <i class="fas fa-arrow-up trend-up"></i>
                                <span class="trend-value">+5.1</span>
                            </div>
                        </div>
                        
                        <div class="metric-card" data-metric="performanceScore">
                            <div class="metric-header">
                                <h3>Performance</h3>
                                <i class="fas fa-rocket"></i>
                            </div>
                            <div class="metric-value">
                                <span class="value">--</span>
                                <span class="unit">%</span>
                            </div>
                            <div class="metric-trend">
                                <i class="fas fa-arrow-down trend-down"></i>
                                <span class="trend-value">-1.2%</span>
                            </div>
                        </div>
                        
                        <div class="metric-card" data-metric="testCoverage">
                            <div class="metric-header">
                                <h3>Test Coverage</h3>
                                <i class="fas fa-vial"></i>
                            </div>
                            <div class="metric-value">
                                <span class="value">--</span>
                                <span class="unit">%</span>
                            </div>
                            <div class="metric-trend">
                                <i class="fas fa-arrow-up trend-up"></i>
                                <span class="trend-value">+3.7%</span>
                            </div>
                        </div>
                        
                        <div class="metric-card" data-metric="technicalDebt">
                            <div class="metric-header">
                                <h3>Technical Debt</h3>
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div class="metric-value">
                                <span class="value">--</span>
                                <span class="unit">hrs</span>
                            </div>
                            <div class="metric-trend">
                                <i class="fas fa-arrow-down trend-down"></i>
                                <span class="trend-value">-12</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Charts Section -->
                <div class="charts-section">
                    <div class="charts-grid">
                        <!-- Code Quality Trend Chart -->
                        <div class="chart-container">
                            <div class="chart-header">
                                <h3>Code Quality Trend</h3>
                                <div class="chart-controls">
                                    <button class="btn btn-sm btn-outline" data-chart="qualityTrend">
                                        <i class="fas fa-expand"></i>
                                    </button>
                                </div>
                            </div>
                            <canvas id="qualityTrendChart"></canvas>
                        </div>

                        <!-- Security Issues Chart -->
                        <div class="chart-container">
                            <div class="chart-header">
                                <h3>Security Issues by Severity</h3>
                                <div class="chart-controls">
                                    <button class="btn btn-sm btn-outline" data-chart="securityIssues">
                                        <i class="fas fa-expand"></i>
                                    </button>
                                </div>
                            </div>
                            <canvas id="securityIssuesChart"></canvas>
                        </div>

                        <!-- Performance Metrics Chart -->
                        <div class="chart-container">
                            <div class="chart-header">
                                <h3>Performance Metrics</h3>
                                <div class="chart-controls">
                                    <button class="btn btn-sm btn-outline" data-chart="performanceMetrics">
                                        <i class="fas fa-expand"></i>
                                    </button>
                                </div>
                            </div>
                            <canvas id="performanceMetricsChart"></canvas>
                        </div>

                        <!-- Test Coverage Chart -->
                        <div class="chart-container">
                            <div class="chart-header">
                                <h3>Test Coverage Breakdown</h3>
                                <div class="chart-controls">
                                    <button class="btn btn-sm btn-outline" data-chart="testCoverage">
                                        <i class="fas fa-expand"></i>
                                    </button>
                                </div>
                            </div>
                            <canvas id="testCoverageChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Detailed Analytics Table -->
                <div class="analytics-table-section">
                    <div class="table-header">
                        <h3>Detailed Analytics</h3>
                        <div class="table-controls">
                            <input type="text" id="analyticsSearch" placeholder="Search metrics..." class="form-input">
                            <select id="tableFilter" class="form-select">
                                <option value="all">All Metrics</option>
                                <option value="quality">Quality</option>
                                <option value="security">Security</option>
                                <option value="performance">Performance</option>
                                <option value="coverage">Coverage</option>
                            </select>
                        </div>
                    </div>
                    <div class="analytics-table-container">
                        <table id="analyticsTable" class="data-table">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    <th>Current Value</th>
                                    <th>Previous Period</th>
                                    <th>Change</th>
                                    <th>Trend</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="analyticsTableBody">
                                <!-- Table rows will be populated dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Predictive Insights Section -->
                <div class="insights-section">
                    <div class="insights-header">
                        <h3>AI-Powered Insights</h3>
                        <button class="btn btn-sm btn-info" id="generateInsights">
                            <i class="fas fa-brain"></i> Generate Insights
                        </button>
                    </div>
                    <div class="insights-container" id="insightsContainer">
                        <!-- Insights will be populated dynamically -->
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        // Add CSS styles
        this.addDashboardStyles();
    }

    /**
     * Add dashboard CSS styles
     */
    addDashboardStyles() {
        if (!document.getElementById('analyticsDashboardStyles')) {
            const style = document.createElement('style');
            style.id = 'analyticsDashboardStyles';
            style.textContent = `
                .analytics-dashboard {
                    padding: 2rem;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .analytics-header {
                    background: var(--card-bg);
                    border-radius: 12px;
                    padding: 2rem;
                    margin-bottom: 2rem;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .dashboard-title {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .dashboard-title i {
                    color: var(--primary-color);
                }

                .header-controls {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .date-range-selector label {
                    font-weight: 600;
                    margin-right: 0.5rem;
                    color: var(--text-secondary);
                }

                .view-selector {
                    display: flex;
                    gap: 0.5rem;
                }

                .view-selector button.active {
                    background: var(--primary-color);
                    color: white;
                }

                .metrics-overview {
                    margin-bottom: 2rem;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                }

                .metric-card {
                    background: var(--card-bg);
                    border-radius: 12px;
                    padding: 1.5rem;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .metric-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }

                .metric-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .metric-header h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin: 0;
                }

                .metric-header i {
                    font-size: 1.5rem;
                    color: var(--primary-color);
                }

                .metric-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 0.5rem;
                }

                .metric-value .unit {
                    font-size: 1rem;
                    font-weight: 400;
                    color: var(--text-secondary);
                    margin-left: 0.25rem;
                }

                .metric-trend {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                }

                .trend-up {
                    color: var(--success-color);
                }

                .trend-down {
                    color: var(--danger-color);
                }

                .charts-section {
                    margin-bottom: 2rem;
                }

                .charts-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 1.5rem;
                }

                .chart-container {
                    background: var(--card-bg);
                    border-radius: 12px;
                    padding: 1.5rem;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .chart-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .chart-header h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .analytics-table-section {
                    background: var(--card-bg);
                    border-radius: 12px;
                    padding: 1.5rem;
                    border: 1px solid var(--border-color);
                    margin-bottom: 2rem;
                }

                .table-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .table-header h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .table-controls {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                }

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .data-table th {
                    background: var(--bg-secondary);
                    padding: 1rem;
                    text-align: left;
                    font-weight: 600;
                    color: var(--text-primary);
                    border-bottom: 2px solid var(--border-color);
                }

                .data-table td {
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color);
                    color: var(--text-primary);
                }

                .data-table tr:hover {
                    background: var(--bg-secondary);
                }

                .insights-section {
                    background: var(--card-bg);
                    border-radius: 12px;
                    padding: 1.5rem;
                    border: 1px solid var(--border-color);
                }

                .insights-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .insights-header h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .insights-container {
                    display: grid;
                    gap: 1rem;
                }

                .insight-card {
                    background: var(--bg-secondary);
                    border-radius: 8px;
                    padding: 1rem;
                    border-left: 4px solid var(--primary-color);
                }

                .insight-card.warning {
                    border-left-color: var(--warning-color);
                }

                .insight-card.danger {
                    border-left-color: var(--danger-color);
                }

                .insight-card.success {
                    border-left-color: var(--success-color);
                }

                @media (max-width: 768px) {
                    .analytics-dashboard {
                        padding: 1rem;
                    }

                    .header-content {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .header-controls {
                        width: 100%;
                        justify-content: space-between;
                    }

                    .metrics-grid {
                        grid-template-columns: 1fr;
                    }

                    .charts-grid {
                        grid-template-columns: 1fr;
                    }

                    .table-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .table-controls {
                        width: 100%;
                        justify-content: space-between;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Initialize dashboard components
     */
    async initializeComponents() {
        // Initialize date range selector
        const dateRange = document.getElementById('dateRange');
        if (dateRange) {
            dateRange.addEventListener('change', (e) => {
                this.dateRange = e.target.value;
                this.refreshDashboard();
            });
        }

        // Initialize view selector
        const viewButtons = document.querySelectorAll('[data-view]');
        viewButtons.forEach(button => {
            button.addEventListener('click', (_e) => {
                viewButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.currentView = button.dataset.view;
                this.updateView();
            });
        });

        // Initialize export button
        const exportBtn = document.getElementById('exportReport');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }

        // Initialize refresh button
        const refreshBtn = document.getElementById('refreshData');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshDashboard());
        }

        // Initialize search functionality
        const searchInput = document.getElementById('analyticsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterTable(e.target.value));
        }

        // Initialize table filter
        const tableFilter = document.getElementById('tableFilter');
        if (tableFilter) {
            tableFilter.addEventListener('change', (e) => this.filterTableByCategory(e.target.value));
        }

        // Initialize insights generation
        const generateInsightsBtn = document.getElementById('generateInsights');
        if (generateInsightsBtn) {
            generateInsightsBtn.addEventListener('click', () => this.generateInsights());
        }
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        try {
            console.log('📊 Loading dashboard data...');
            
            // Fetch metrics data
            const metricsData = await this.fetchMetricsData();
            this.updateMetrics(metricsData);

            // Fetch chart data
            const chartData = await this.fetchChartData();
            this.updateCharts(chartData);

            // Populate analytics table
            const tableData = await this.fetchTableData();
            this.populateTable(tableData);

            console.log('✅ Dashboard data loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    /**
     * Fetch metrics data from API
     */
    async fetchMetricsData() {
        // Mock data for now - replace with actual API calls
        return {
            codeQuality: 87.3,
            securityScore: 94.2,
            performanceScore: 82.1,
            testCoverage: 76.8,
            technicalDebt: 124
        };
    }

    /**
     * Update metrics display
     */
    updateMetrics(data) {
        this.metrics = { ...this.metrics, ...data };

        Object.keys(this.metrics).forEach(metric => {
            const card = document.querySelector(`[data-metric="${metric}"]`);
            if (card) {
                const valueElement = card.querySelector('.metric-value .value');
                if (valueElement) {
                    valueElement.textContent = this.formatMetricValue(metric, this.metrics[metric]);
                }
            }
        });
    }

    /**
     * Format metric value for display
     */
    formatMetricValue(metric, value) {
        switch (metric) {
            case 'technicalDebt':
                return value.toString();
            default:
                return value.toFixed(1);
        }
    }

    /**
     * Fetch chart data
     */
    async fetchChartData() {
        // Mock data - replace with actual API calls
        return {
            qualityTrend: this.generateTrendData(),
            securityIssues: this.generateSecurityData(),
            performanceMetrics: this.generatePerformanceData(),
            testCoverage: this.generateCoverageData()
        };
    }

    /**
     * Generate trend data
     */
    generateTrendData() {
        const labels = [];
        const data = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString());
            data.push(75 + Math.random() * 20);
        }
        
        return { labels, data };
    }

    /**
     * Generate security data
     */
    generateSecurityData() {
        return {
            labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
            data: [2, 8, 15, 23, 45]
        };
    }

    /**
     * Generate performance data
     */
    generatePerformanceData() {
        return {
            labels: ['Response Time', 'Memory Usage', 'CPU Usage', 'Throughput', 'Availability'],
            data: [85, 72, 68, 91, 98]
        };
    }

    /**
     * Generate coverage data
     */
    generateCoverageData() {
        return {
            labels: ['Unit Tests', 'Integration Tests', 'E2E Tests', 'Component Tests'],
            data: [82, 74, 68, 91]
        };
    }

    /**
     * Update charts
     */
    updateCharts(data) {
        // Update Quality Trend Chart
        this.updateQualityTrendChart(data.qualityTrend);
        
        // Update Security Issues Chart
        this.updateSecurityIssuesChart(data.securityIssues);
        
        // Update Performance Metrics Chart
        this.updatePerformanceMetricsChart(data.performanceMetrics);
        
        // Update Test Coverage Chart
        this.updateTestCoverageChart(data.testCoverage);
    }

    /**
     * Update Quality Trend Chart
     */
    updateQualityTrendChart(data) {
        const ctx = document.getElementById('qualityTrendChart');
        if (!ctx) return;

        if (this.charts.has('qualityTrend')) {
            this.charts.get('qualityTrend').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Code Quality Score',
                    data: data.data,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 60,
                        max: 100
                    }
                }
            }
        });

        this.charts.set('qualityTrend', chart);
    }

    /**
     * Update Security Issues Chart
     */
    updateSecurityIssuesChart(data) {
        const ctx = document.getElementById('securityIssuesChart');
        if (!ctx) return;

        if (this.charts.has('securityIssues')) {
            this.charts.get('securityIssues').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Security Issues',
                    data: data.data,
                    backgroundColor: [
                        '#ef4444',
                        '#f97316',
                        '#eab308',
                        '#22c55e',
                        '#3b82f6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });

        this.charts.set('securityIssues', chart);
    }

    /**
     * Update Performance Metrics Chart
     */
    updatePerformanceMetricsChart(data) {
        const ctx = document.getElementById('performanceMetricsChart');
        if (!ctx) return;

        if (this.charts.has('performanceMetrics')) {
            this.charts.get('performanceMetrics').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Performance Score',
                    data: data.data,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        this.charts.set('performanceMetrics', chart);
    }

    /**
     * Update Test Coverage Chart
     */
    updateTestCoverageChart(data) {
        const ctx = document.getElementById('testCoverageChart');
        if (!ctx) return;

        if (this.charts.has('testCoverage')) {
            this.charts.get('testCoverage').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    backgroundColor: [
                        '#4f46e5',
                        '#06b6d4',
                        '#10b981',
                        '#f59e0b'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        this.charts.set('testCoverage', chart);
    }

    /**
     * Fetch table data
     */
    async fetchTableData() {
        // Mock data - replace with actual API calls
        return [
            {
                metric: 'Code Quality Score',
                current: 87.3,
                previous: 85.1,
                change: 2.2,
                trend: 'up',
                category: 'quality'
            },
            {
                metric: 'Security Vulnerabilities',
                current: 12,
                previous: 18,
                change: -6,
                trend: 'down',
                category: 'security'
            },
            {
                metric: 'Average Response Time',
                current: 145,
                previous: 167,
                change: -22,
                trend: 'down',
                category: 'performance'
            },
            {
                metric: 'Test Coverage',
                current: 76.8,
                previous: 73.2,
                change: 3.6,
                trend: 'up',
                category: 'coverage'
            }
        ];
    }

    /**
     * Populate analytics table
     */
    populateTable(data) {
        const tbody = document.getElementById('analyticsTableBody');
        if (!tbody) return;

        tbody.textContent = '' /* Replaced innerHTML with textContent for safety */

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.textContent = `
                <td>${row.metric}</td>
                <td>${row.current}${row.category === 'quality' || row.category === 'coverage' ? '%' : row.category === 'performance' ? 'ms' : ''}</td>
                <td>${row.previous}${row.category === 'quality' || row.category === 'coverage' ? '%' : row.category === 'performance' ? 'ms' : ''}</td>
                <td class="${row.trend === 'up' ? 'trend-up' : 'trend-down'}">
                    ${row.trend === 'up' ? '+' : ''}${row.change}
                </td>
                <td>
                    <i class="fas fa-arrow-${row.trend} ${row.trend}-color"></i>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="advancedAnalytics.viewDetails('${row.metric}')">
                        <i class="fas fa-chart-line"></i> Details
                    </button>
                </td>
            ` /* Replaced innerHTML with textContent for safety */
            tbody.appendChild(tr);
        });
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        this.updateInterval = setInterval(() => {
            this.refreshDashboard();
        }, this.refreshInterval);
    }

    /**
     * Refresh dashboard data
     */
    async refreshDashboard() {
        console.log('🔄 Refreshing dashboard data...');
        await this.loadDashboardData();
    }

    /**
     * Export report
     */
    async exportReport() {
        console.log('📄 Exporting analytics report...');
        
        // Show loading state
        this.showLoading('Generating report...');
        
        try {
            // Generate report data
            const reportData = {
                metrics: this.metrics,
                dateRange: this.dateRange,
                generatedAt: new Date().toISOString(),
                charts: this.getChartData(),
                tableData: await this.fetchTableData()
            };

            // Create downloadable report
            const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showSuccess('Report exported successfully');
            
        } catch (error) {
            console.error('❌ Failed to export report:', error);
            this.showError('Failed to export report');
        }
    }

    /**
     * Generate AI-powered insights
     */
    async generateInsights() {
        console.log('🧠 Generating AI-powered insights...');
        
        const container = document.getElementById('insightsContainer');
        if (!container) return;

        // Show loading state
        container.textContent = '<div class="loading">Generating insights...</div>' /* Replaced innerHTML with textContent for safety */

        try {
            // Mock insights - replace with actual AI API calls
            const insights = [
                {
                    type: 'success',
                    title: 'Code Quality Improvement',
                    message: 'Code quality has improved by 2.3% over the last 30 days. Keep up the good work!',
                    recommendation: 'Continue following current coding standards and practices.'
                },
                {
                    type: 'warning',
                    title: 'Performance Concern',
                    message: 'Response time has increased by 15% in the last week.',
                    recommendation: 'Consider optimizing database queries and implementing caching strategies.'
                },
                {
                    type: 'danger',
                    title: 'Security Vulnerability',
                    message: '3 new critical security vulnerabilities detected.',
                    recommendation: 'Immediate action required. Review and patch security issues.'
                }
            ];

            this.displayInsights(insights);
            
        } catch (error) {
            console.error('❌ Failed to generate insights:', error);
            container.textContent = '<div class="error">Failed to generate insights</div>' /* Replaced innerHTML with textContent for safety */
        }
    }

    /**
     * Display insights
     */
    displayInsights(insights) {
        const container = document.getElementById('insightsContainer');
        if (!container) return;

        container.textContent = '' /* Replaced innerHTML with textContent for safety */

        insights.forEach(insight => {
            const card = document.createElement('div');
            card.className = `insight-card ${insight.type}`;
            card.textContent = `
                <div class="insight-header">
                    <h4>${insight.title}</h4>
                    <span class="insight-type ${insight.type}">${insight.type.toUpperCase()}</span>
                </div>
                <p class="insight-message">${insight.message}</p>
                <div class="insight-recommendation">
                    <strong>Recommendation:</strong> ${insight.recommendation}
                </div>
            ` /* Replaced innerHTML with textContent for safety */
            container.appendChild(card);
        });
    }

    /**
     * Filter table by search term
     */
    filterTable(searchTerm) {
        const tbody = document.getElementById('analyticsTableBody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    /**
     * Filter table by category
     */
    filterTableByCategory(category) {
        const tbody = document.getElementById('analyticsTableBody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');

        rows.forEach(row => {
            if (category === 'all') {
                row.style.display = '';
            } else {
                // This would need to be implemented based on actual data structure
                row.style.display = '';
            }
        });
    }

    /**
     * Update view based on selected view type
     */
    updateView() {
        console.log('🔄 Updating view to:', this.currentView);
        
        // Implement different view layouts
        switch (this.currentView) {
            case 'overview':
                this.showOverviewView();
                break;
            case 'detailed':
                this.showDetailedView();
                break;
            case 'trends':
                this.showTrendsView();
                break;
        }
    }

    /**
     * Show overview view
     */
    showOverviewView() {
        // Show metrics and key charts
        document.querySelector('.metrics-overview').style.display = 'block';
        document.querySelector('.charts-section').style.display = 'grid';
        document.querySelector('.analytics-table-section').style.display = 'none';
    }

    /**
     * Show detailed view
     */
    showDetailedView() {
        // Show detailed table and all charts
        document.querySelector('.metrics-overview').style.display = 'block';
        document.querySelector('.charts-section').style.display = 'grid';
        document.querySelector('.analytics-table-section').style.display = 'block';
    }

    /**
     * Show trends view
     */
    showTrendsView() {
        // Focus on trend charts
        document.querySelector('.metrics-overview').style.display = 'none';
        document.querySelector('.charts-section').style.display = 'grid';
        document.querySelector('.analytics-table-section').style.display = 'block';
    }

    /**
     * View metric details
     */
    viewDetails(metric) {
        console.log('📊 Viewing details for:', metric);
        // Implement detailed view for specific metric
    }

    /**
     * Get chart data for export
     */
    getChartData() {
        const chartData = {};
        this.charts.forEach((chart, key) => {
            chartData[key] = {
                type: chart.config.type,
                data: chart.data,
                options: chart.config.options
            };
        });
        return chartData;
    }

    /**
     * Show loading state
     */
    showLoading(message) {
        // Implement loading state
        console.log('⏳ Loading:', message);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        console.log('✅ Success:', message);
        // Implement success notification
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('❌ Error:', message);
        // Implement error notification
    }

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Add any global event listeners
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear update interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Destroy charts
        this.charts.forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts.clear();

        // Clear cache
        this.dataCache.clear();
    }
}

// Global instance
window.advancedAnalytics = new AdvancedAnalyticsDashboard();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedAnalyticsDashboard;
}
