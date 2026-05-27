// Dashboard Monitor - Real-time Monitoring Interface
console.log('📈 Dashboard Monitor loading...');

class DashboardMonitor {
    constructor() {
        this.container = null;
        this.charts = {};
        this.refreshInterval = null;
        this.currentData = null;
        this.isMonitoring = false;
    }

    initialize(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Container not found:', containerId);
            return;
        }
        
        this.createMonitoringInterface();
        this.startMonitoring();
    }

    createMonitoringInterface() {
        this.container.textContent = `
            <div class="dashboard-monitor">
                <div class="monitor-header">
                    <h2>📊 Real-time Dashboard Monitor</h2>
                    <div class="monitor-controls">
                        <button id="refresh-data" class="btn btn-primary">
                            <i class="fas fa-sync-alt"></i> Refresh Data
                        </button>
                        <button id="toggle-monitoring" class="btn btn-secondary">
                            <i class="fas fa-pause"></i> Pause Monitoring
                        </button>
                        <button id="export-analysis" class="btn btn-secondary">
                            <i class="fas fa-download"></i> Export Analysis
                        </button>
                    </div>
                </div>
                
                <div class="monitor-content">
                    <div class="metrics-overview">
                        <div class="metric-cards">
                            <div class="metric-card" id="health-score-card">
                                <div class="metric-value">-</div>
                                <div class="metric-label">Health Score</div>
                                <div class="metric-trend"></div>
                            </div>
                            <div class="metric-card" id="performance-card">
                                <div class="metric-value">-</div>
                                <div class="metric-label">Performance</div>
                                <div class="metric-trend"></div>
                            </div>
                            <div class="metric-card" id="complexity-card">
                                <div class="metric-value">-</div>
                                <div class="metric-label">Complexity/File</div>
                                <div class="metric-trend"></div>
                            </div>
                            <div class="metric-card" id="debt-card">
                                <div class="metric-value">-</div>
                                <div class="metric-label">Tech Debt</div>
                                <div class="metric-trend"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="charts-section">
                        <div class="chart-container">
                            <h3>Performance Metrics</h3>
                            <canvas id="performance-chart"></canvas>
                        </div>
                        <div class="chart-container">
                            <h3>Technical Debt Distribution</h3>
                            <canvas id="debt-chart"></canvas>
                        </div>
                    </div>
                    
                    <div class="alerts-section">
                        <h3>🚨 Active Alerts</h3>
                        <div id="alerts-container" class="alerts-list">
                            <div class="no-alerts">No active alerts</div>
                        </div>
                    </div>
                    
                    <div class="recommendations-section">
                        <h3>💡 Recommendations</h3>
                        <div id="recommendations-container" class="recommendations-list">
                            <div class="no-recommendations">No recommendations available</div>
                        </div>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        this.setupEventListeners();
        this.initializeCharts();
    }

    setupEventListeners() {
        document.getElementById('refresh-data').addEventListener('click', () => {
            this.refreshData();
        });
        
        document.getElementById('toggle-monitoring').addEventListener('click', () => {
            this.toggleMonitoring();
        });
        
        document.getElementById('export-analysis').addEventListener('click', () => {
            this.exportAnalysis();
        });
    }

    initializeCharts() {
        // Performance Chart
        const performanceCtx = document.getElementById('performance-chart').getContext('2d');
        this.charts.performance = new Chart(performanceCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Response Time (ms)',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                }, {
                    label: 'Throughput (req/min)',
                    data: [],
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        
        // Technical Debt Chart
        const debtCtx = document.getElementById('debt-chart').getContext('2d');
        this.charts.debt = new Chart(debtCtx, {
            type: 'doughnut',
            data: {
                labels: ['High Priority', 'Medium Priority', 'Low Priority'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = true;
        this.refreshData();
        
        // Set up automatic refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.refreshData();
        }, 30000);
        
        this.updateMonitoringButton();
    }

    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.updateMonitoringButton();
    }

    toggleMonitoring() {
        if (this.isMonitoring) {
            this.stopMonitoring();
        } else {
            this.startMonitoring();
        }
    }

    updateMonitoringButton() {
        const button = document.getElementById('toggle-monitoring');
        if (this.isMonitoring) {
            button.textContent = '<i class="fas fa-pause"></i> Pause Monitoring' /* Replaced innerHTML with textContent for safety */
            button.classList.remove('btn-secondary');
            button.classList.add('btn-warning');
        } else {
            button.textContent = '<i class="fas fa-play"></i> Start Monitoring' /* Replaced innerHTML with textContent for safety */
            button.classList.remove('btn-warning');
            button.classList.add('btn-secondary');
        }
    }

    refreshData() {
        // Simulate fetching current dashboard data
        const mockData = {
            type: 'full',
            exportDate: new Date().toISOString(),
            data: {
                overview: {
                    totalFiles: 1250,
                    totalComplexity: 45000,
                    performance: 87
                },
                technicalDebt: {
                    high: 15,
                    medium: 23,
                    low: 45
                },
                performance: {
                    responseTime: 245,
                    throughput: 1200,
                    errorRate: 0.02
                },
                backup: {
                    lastBackup: '2024-05-20T10:30:00',
                    totalBackups: 156
                }
            }
        };
        
        this.updateDashboard(mockData);
    }

    updateDashboard(data) {
        this.currentData = data;
        
        // Analyze the data
        const analysis = window.dashboardAnalyzer.parseDashboardExport(data);
        
        // Update metric cards
        this.updateMetricCards(analysis);
        
        // Update charts
        this.updateCharts(analysis);
        
        // Update alerts
        this.updateAlerts(analysis.alerts);
        
        // Update recommendations
        this.updateRecommendations(analysis.recommendations);
        
        // Store historical data
        window.dashboardAnalyzer.storeHistoricalData();
    }

    updateMetricCards(analysis) {
        // Health Score
        const healthCard = document.getElementById('health-score-card');
        healthCard.querySelector('.metric-value').textContent = `${analysis.healthScore.score}/100`;
        healthCard.querySelector('.metric-value').className = `metric-value grade-${analysis.healthScore.grade.toLowerCase()}`;
        healthCard.querySelector('.metric-trend').textContent = this.getTrendIcon(analysis.healthScore.score);
        
        // Performance
        const perfCard = document.getElementById('performance-card');
        perfCard.querySelector('.metric-value').textContent = `${analysis.overview.performance}%`;
        perfCard.querySelector('.metric-value').className = `metric-value grade-${this.getGradeFromScore(analysis.overview.performance)}`;
        perfCard.querySelector('.metric-trend').textContent = this.getTrendIcon(analysis.overview.performance);
        
        // Complexity
        const complexityCard = document.getElementById('complexity-card');
        complexityCard.querySelector('.metric-value').textContent = analysis.overview.complexityPerFile;
        complexityCard.querySelector('.metric-value').className = `metric-value grade-${analysis.overview.complexityGrade.toLowerCase()}`;
        complexityCard.querySelector('.metric-trend').textContent = this.getTrendIcon(50 - analysis.overview.complexityPerFile); // Inverted for complexity
        
        // Technical Debt
        const debtCard = document.getElementById('debt-card');
        debtCard.querySelector('.metric-value').textContent = analysis.technicalDebt.total;
        debtCard.querySelector('.metric-value').className = `metric-value grade-${this.getDebtGrade(analysis.technicalDebt.total)}`;
        debtCard.querySelector('.metric-trend').textContent = this.getTrendIcon(50 - analysis.technicalDebt.total); // Inverted for debt
    }

    updateCharts(analysis) {
        // Update performance chart with historical data
        const historicalData = window.dashboardAnalyzer.historicalData;
        if (historicalData.length > 1) {
            const labels = historicalData.slice(-10).map((_, index) => `T-${index + 1}`);
            const responseTimes = historicalData.slice(-10).map(d => d.performance.responseTime);
            const throughputs = historicalData.slice(-10).map(d => d.performance.throughput);
            
            this.charts.performance.data.labels = labels;
            this.charts.performance.data.datasets[0].data = responseTimes;
            this.charts.performance.data.datasets[1].data = throughputs;
            this.charts.performance.update();
        }
        
        // Update debt chart
        this.charts.debt.data.datasets[0].data = [
            analysis.technicalDebt.high,
            analysis.technicalDebt.medium,
            analysis.technicalDebt.low
        ];
        this.charts.debt.update();
    }

    updateAlerts(alerts) {
        const container = document.getElementById('alerts-container');
        
        if (alerts.length === 0) {
            container.textContent = '<div class="no-alerts">✅ No active alerts</div>' /* Replaced innerHTML with textContent for safety */
            return;
        }
        
        container.textContent = alerts.map(alert => `
            <div class="alert alert-${alert.level}">
                <div class="alert-header">
                    <span class="alert-level">${alert.level.toUpperCase()}</span>
                    <span class="alert-type">${alert.type}</span>
                </div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-details">
                    Current: ${alert.currentValue} | Threshold: ${alert.threshold}
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    updateRecommendations(recommendations) {
        const container = document.getElementById('recommendations-container');
        
        if (recommendations.length === 0) {
            container.textContent = '<div class="no-recommendations">✅ No recommendations at this time</div>' /* Replaced innerHTML with textContent for safety */
            return;
        }
        
        container.textContent = recommendations.slice(0, 5).map(rec => `
            <div class="recommendation priority-${rec.priority}">
                <div class="recommendation-header">
                    <h4>${rec.title}</h4>
                    <span class="priority-badge priority-${rec.priority}">${rec.priority}</span>
                </div>
                <p class="recommendation-description">${rec.description}</p>
                <div class="recommendation-meta">
                    <span class="impact">Impact: ${rec.impact}</span>
                    <span class="effort">Effort: ${rec.effort}</span>
                </div>
                <div class="recommendation-improvement">
                    <small>Expected improvement: ${rec.estimatedImprovement}</small>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    getTrendIcon(value) {
        if (value > 80) {
            return '📈';
        }
        if (value > 60) {
            return '➡️';
        }
        return '📉';
    }

    getGradeFromScore(score) {
        if (score >= 90) {
            return 'A+';
        }
        if (score >= 85) {
            return 'A';
        }
        if (score >= 80) {
            return 'B+';
        }
        if (score >= 75) {
            return 'B';
        }
        if (score >= 70) {
            return 'C+';
        }
        if (score >= 65) {
            return 'C';
        }
        return 'D';
    }

    getDebtGrade(total) {
        if (total <= 20) {
            return 'A+';
        }
        if (total <= 40) {
            return 'A';
        }
        if (total <= 60) {
            return 'B';
        }
        if (total <= 80) {
            return 'C';
        }
        return 'D';
    }

    exportAnalysis() {
        if (!this.currentData) {
            alert('No data available to export');
            return;
        }
        
        const analysis = window.dashboardAnalyzer.exportAnalysis('json');
        const blob = new Blob([analysis], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-analysis-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success notification
        if (typeof showNotification === 'function') {
            showNotification('Analysis exported successfully!', 'success');
        }
    }
}

// Initialize monitor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create monitor container if it doesn't exist
    if (!document.getElementById('dashboard-monitor')) {
        const monitorContainer = document.createElement('div');
        monitorContainer.id = 'dashboard-monitor';
        monitorContainer.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--card-bg);
            z-index: 10000;
            overflow-y: auto;
        `;
        document.body.appendChild(monitorContainer);
    }
    
    // Initialize monitor
    window.dashboardMonitor = new DashboardMonitor();
});

console.log('✅ Dashboard Monitor loaded');
