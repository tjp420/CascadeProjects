/**
 * Quality Metrics Chart Component
 * Provides comprehensive visualization for GGUF quality metrics
 */

class QualityMetricsChart {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.charts = {};
        this.data = null;
        this.chartType = 'radar'; // radar, bar, line, doughnut
        
        this.init();
    }

    init() {
        this.render();
        this.loadQualityData();
    }

    render() {
        this.container.textContent = `
            <div class="quality-metrics-chart-container">
                <div class="chart-header">
                    <div class="header-title">
                        <h3>
                            <i class="fas fa-chart-line"></i>
                            Quality Metrics Visualization
                        </h3>
                    </div>
                    <div class="header-actions">
                        <div class="chart-type-selector">
                            <select id="chartTypeSelector" class="form-select form-select-sm" onchange="qualityMetricsChart.changeChartType(this.value)">
                                <option value="radar">Radar Chart</option>
                                <option value="bar">Bar Chart</option>
                                <option value="line">Line Chart</option>
                                <option value="doughnut">Doughnut Chart</option>
                            </select>
                        </div>
                        <button class="btn btn-sm btn-outline-primary" onclick="qualityMetricsChart.exportChart()">
                            <i class="fas fa-download"></i>
                            Export
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="qualityMetricsChart.refreshData()">
                            <i class="fas fa-sync-alt"></i>
                            Refresh
                        </button>
                    </div>
                </div>

                <!-- Chart Controls -->
                <div class="chart-controls">
                    <div class="time-range-selector">
                        <label>Time Range:</label>
                        <select id="timeRangeSelector" class="form-select form-select-sm" onchange="qualityMetricsChart.changeTimeRange(this.value)">
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="90d">Last 90 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                    <div class="metric-selector">
                        <label>Metrics:</label>
                        <div class="metric-checkboxes">
                            <label class="metric-checkbox">
                                <input type="checkbox" value="dataIntegrity" checked onchange="qualityMetricsChart.toggleMetric('dataIntegrity', this.checked)">
                                <span>Data Integrity</span>
                            </label>
                            <label class="metric-checkbox">
                                <input type="checkbox" value="schemaCompliance" checked onchange="qualityMetricsChart.toggleMetric('schemaCompliance', this.checked)">
                                <span>Schema Compliance</span>
                            </label>
                            <label class="metric-checkbox">
                                <input type="checkbox" value="consistencyScore" checked onchange="qualityMetricsChart.toggleMetric('consistencyScore', this.checked)">
                                <span>Consistency</span>
                            </label>
                            <label class="metric-checkbox">
                                <input type="checkbox" value="completenessScore" checked onchange="qualityMetricsChart.toggleMetric('completenessScore', this.checked)">
                                <span>Completeness</span>
                            </label>
                            <label class="metric-checkbox">
                                <input type="checkbox" value="accuracyScore" checked onchange="qualityMetricsChart.toggleMetric('accuracyScore', this.checked)">
                                <span>Accuracy</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Main Chart Area -->
                <div class="chart-main-area">
                    <div class="chart-container" id="mainChartContainer">
                        <canvas id="mainQualityChart" width="800" height="400"></canvas>
                    </div>
                    
                    <!-- Loading State -->
                    <div class="loading-state" id="chartLoading" style="display: none /* Replaced innerHTML with textContent for safety */">
                        <div class="spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                        <p>Loading quality metrics...</p>
                    </div>
                    
                    <!-- Error State -->
                    <div class="error-state" id="chartError" style="display: none;">
                        <div class="error-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3>Chart Error</h3>
                        <p>Failed to load quality metrics data</p>
                        <button class="btn btn-primary" onclick="qualityMetricsChart.refreshData()">
                            Try Again
                        </button>
                    </div>
                </div>

                <!-- Chart Summary -->
                <div class="chart-summary">
                    <div class="summary-grid" id="summaryGrid">
                        <!-- Summary cards will be rendered here -->
                    </div>
                </div>

                <!-- Trend Analysis -->
                <div class="trend-analysis">
                    <h4>Quality Trend Analysis</h4>
                    <div class="trend-charts">
                        <div class="trend-chart-container">
                            <h5>Overall Quality Score</h5>
                            <canvas id="trendChart" width="400" height="200"></canvas>
                        </div>
                        <div class="trend-chart-container">
                            <h5>Issue Resolution Rate</h5>
                            <canvas id="resolutionChart" width="400" height="200"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Category Breakdown -->
                <div class="category-breakdown">
                    <h4>Category Quality Breakdown</h4>
                    <div class="category-charts">
                        <div class="category-chart-container">
                            <canvas id="categoryChart" width="400" height="300"></canvas>
                        </div>
                        <div class="category-legend" id="categoryLegend">
                            <!-- Category legend will be rendered here -->
                        </div>
                    </div>
                </div>

                <!-- Comparison View -->
                <div class="comparison-view">
                    <h4>Quality Comparison</h4>
                    <div class="comparison-controls">
                        <div class="comparison-period">
                            <label>Compare Periods:</label>
                            <select id="comparePeriod1" class="form-select form-select-sm">
                                <option value="current">Current</option>
                                <option value="lastWeek">Last Week</option>
                                <option value="lastMonth">Last Month</option>
                            </select>
                            <span>vs</span>
                            <select id="comparePeriod2" class="form-select form-select-sm">
                                <option value="lastWeek">Last Week</option>
                                <option value="lastMonth">Last Month</option>
                                <option value="lastQuarter">Last Quarter</option>
                            </select>
                            <button class="btn btn-sm btn-primary" onclick="qualityMetricsChart.updateComparison()">
                                Compare
                            </button>
                        </div>
                    </div>
                    <div class="comparison-chart-container">
                        <canvas id="comparisonChart" width="800" height="300"></canvas>
                    </div>
                </div>
            </div>
        `;
    }

    async loadQualityData() {
        this.showLoading(true);
        
        try {
            if (window.ggufDataService) {
                this.data = window.ggufDataService.getQualityMetrics();
            } else {
                // Load from API
                const response = await fetch('/api/gguf/analysis');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const analysisData = await response.json();
                this.data = analysisData.qualityMetrics || {};
            }
            
            // Generate historical data for trends
            this.generateHistoricalData();
            
            this.renderCharts();
            this.renderSummary();
            this.showLoading(false);
            
        } catch (error) {
            console.error('Error loading quality data:', error);
            this.showError('Failed to load quality metrics data');
            this.showLoading(false);
        }
    }

    generateHistoricalData() {
        // Generate sample historical data for demonstration
        const days = 30;
        this.historicalData = {
            labels: [],
            overallQuality: [],
            dataIntegrity: [],
            schemaCompliance: [],
            consistencyScore: [],
            completenessScore: [],
            accuracyScore: []
        };
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            this.historicalData.labels.push(date.toLocaleDateString());
            
            // Generate realistic trend data with some randomness
            const baseQuality = 85;
            const improvement = (days - i) * 0.1; // Gradual improvement
            const randomVariation = (Math.random() - 0.5) * 5;
            
            this.historicalData.overallQuality.push(Math.min(100, baseQuality + improvement + randomVariation));
            this.historicalData.dataIntegrity.push(Math.min(100, 88 + improvement + (Math.random() - 0.5) * 3));
            this.historicalData.schemaCompliance.push(Math.min(100, 82 + improvement + (Math.random() - 0.5) * 4));
            this.historicalData.consistencyScore.push(Math.min(100, 86 + improvement + (Math.random() - 0.5) * 3));
            this.historicalData.completenessScore.push(Math.min(100, 90 + improvement + (Math.random() - 0.5) * 2));
            this.historicalData.accuracyScore.push(Math.min(100, 84 + improvement + (Math.random() - 0.5) * 4));
        }
    }

    renderCharts() {
        this.renderMainChart();
        this.renderTrendCharts();
        this.renderCategoryChart();
        this.renderComparisonChart();
    }

    renderMainChart() {
        const canvas = document.getElementById('mainQualityChart');
        const ctx = canvas.getContext('2d');
        
        switch (this.chartType) {
            case 'radar':
                this.renderRadarChart(ctx);
                break;
            case 'bar':
                this.renderBarChart(ctx);
                break;
            case 'line':
                this.renderLineChart(ctx);
                break;
            case 'doughnut':
                this.renderDoughnutChart(ctx);
                break;
        }
    }

    renderRadarChart(ctx) {
        const metrics = this.getEnabledMetrics();
        const labels = this.getMetricLabels(metrics);
        const data = metrics.map(metric => this.data[metric] || 0);
        
        this.drawRadarChart(ctx, labels, data);
    }

    drawRadarChart(ctx, labels, data) {
        const canvas = ctx.canvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 60;
        const angleStep = (Math.PI * 2) / labels.length;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        for (let i = 1; i <= 5; i++) {
            ctx.beginPath();
            for (let j = 0; j < labels.length; j++) {
                const angle = j * angleStep - Math.PI / 2;
                const x = centerX + Math.cos(angle) * (radius * i / 5);
                const y = centerY + Math.sin(angle) * (radius * i / 5);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }
        
        // Draw axes
        for (let i = 0; i < labels.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(angle) * radius,
                centerY + Math.sin(angle) * radius
            );
            ctx.stroke();
        }
        
        // Draw data
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];
        
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
            const x = centerX + Math.cos(angle) * (radius + 30);
            const y = centerY + Math.sin(angle) * (radius + 30);
            ctx.fillText(labels[i], x, y);
        }
        
        // Draw values
        ctx.font = '10px Inter, sans-serif';
        for (let i = 0; i < data.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const value = data[i] / 100;
            const x = centerX + Math.cos(angle) * (radius * value);
            const y = centerY + Math.sin(angle) * (radius * value);
            ctx.fillText(`${data[i].toFixed(1)}%`, x, y - 5);
        }
    }

    renderBarChart(ctx) {
        const metrics = this.getEnabledMetrics();
        const labels = this.getMetricLabels(metrics);
        const data = metrics.map(metric => this.data[metric] || 0);
        
        this.drawBarChart(ctx, labels, data);
    }

    drawBarChart(ctx, labels, data) {
        const canvas = ctx.canvas;
        const padding = 60;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        const barWidth = chartWidth / labels.length * 0.6;
        const barSpacing = chartWidth / labels.length * 0.4;
        const maxValue = 100;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();
        
        // Draw bars
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];
        
        data.forEach((value, index) => {
            const barHeight = (value / maxValue) * chartHeight;
            const x = padding + index * (barWidth + barSpacing) + barSpacing / 2;
            const y = canvas.height - padding - barHeight;
            
            // Draw bar
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw value
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${value}%`, x + barWidth / 2, y - 5);
            
            // Draw label
            ctx.save();
            ctx.translate(x + barWidth / 2, canvas.height - padding + 20);
            ctx.rotate(-Math.PI / 6);
            ctx.fillText(labels[index], 0, 0);
            ctx.restore();
        });
    }

    renderLineChart(ctx) {
        const metrics = this.getEnabledMetrics();
        const labels = this.getMetricLabels(metrics);
        const data = metrics.map(metric => this.data[metric] || 0);
        
        this.drawLineChart(ctx, labels, data);
    }

    drawLineChart(ctx, labels, data) {
        const canvas = ctx.canvas;
        const padding = 60;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        const pointSpacing = chartWidth / (labels.length - 1);
        const maxValue = 100;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();
        
        // Draw line
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        data.forEach((value, index) => {
            const x = padding + index * pointSpacing;
            const y = canvas.height - padding - (value / maxValue) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw points and labels
        data.forEach((value, index) => {
            const x = padding + index * pointSpacing;
            const y = canvas.height - padding - (value / maxValue) * chartHeight;
            
            // Draw point
            ctx.fillStyle = '#6366f1';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw value
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${value}%`, x, y - 10);
            
            // Draw label
            ctx.save();
            ctx.translate(x, canvas.height - padding + 20);
            ctx.rotate(-Math.PI / 6);
            ctx.fillText(labels[index], 0, 0);
            ctx.restore();
        });
    }

    renderDoughnutChart(ctx) {
        const metrics = this.getEnabledMetrics();
        const labels = this.getMetricLabels(metrics);
        const data = metrics.map(metric => this.data[metric] || 0);
        
        this.drawDoughnutChart(ctx, labels, data);
    }

    drawDoughnutChart(ctx, labels, data) {
        const canvas = ctx.canvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const outerRadius = Math.min(centerX, centerY) - 40;
        const innerRadius = outerRadius * 0.6;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];
        const total = data.reduce((sum, value) => sum + value, 0);
        
        let currentAngle = -Math.PI / 2;
        
        data.forEach((value, index) => {
            const sliceAngle = (value / total) * Math.PI * 2;
            
            // Draw slice
            ctx.fillStyle = colors[index % colors.length];
            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, currentAngle, currentAngle + sliceAngle);
            ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
            ctx.closePath();
            ctx.fill();
            
            // Draw label
            const labelAngle = currentAngle + sliceAngle / 2;
            const labelX = centerX + Math.cos(labelAngle) * (outerRadius + 30);
            const labelY = centerY + Math.sin(labelAngle) * (outerRadius + 30);
            
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[index], labelX, labelY);
            ctx.fillText(`${value}%`, labelX, labelY + 15);
            
            currentAngle += sliceAngle;
        });
        
        // Draw center text
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Overall', centerX, centerY - 10);
        ctx.fillText(`${this.data.overallQuality || 0}%`, centerX, centerY + 15);
    }

    renderTrendCharts() {
        this.renderTrendChart();
        this.renderResolutionChart();
    }

    renderTrendChart() {
        const canvas = document.getElementById('trendChart');
        const ctx = canvas.getContext('2d');
        
        this.drawLineChart(ctx, this.historicalData.labels, this.historicalData.overallQuality);
    }

    renderResolutionChart() {
        const canvas = document.getElementById('resolutionChart');
        const ctx = canvas.getContext('2d');
        
        // Generate sample resolution data
        const resolutionData = this.historicalData.overallQuality.map((value, index) => {
            if (index === 0) return 0;
            return Math.max(0, value - this.historicalData.overallQuality[index - 1]);
        });
        
        this.drawBarChart(ctx, this.historicalData.labels.slice(1), resolutionData.slice(1));
    }

    renderCategoryChart() {
        const canvas = document.getElementById('categoryChart');
        const ctx = canvas.getContext('2d');
        
        // Sample category data
        const categories = ['User Profile', 'API Response', 'Analytics', 'Configuration', 'Test Scenario'];
        const qualityScores = [91.2, 89.8, 85.4, 93.1, 88.7];
        
        this.drawBarChart(ctx, categories, qualityScores);
        
        // Update legend
        const legendContainer = document.getElementById('categoryLegend');
        legendContainer.textContent = categories.map((cat, index) => `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'][index]}"></div>
                <div class="legend-content">
                    <span class="legend-label">${cat}</span>
                    <span class="legend-value">${qualityScores[index]}%</span>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    renderComparisonChart() {
        const canvas = document.getElementById('comparisonChart');
        const ctx = canvas.getContext('2d');
        
        // Sample comparison data
        const metrics = this.getEnabledMetrics();
        const labels = this.getMetricLabels(metrics);
        const currentData = metrics.map(metric => this.data[metric] || 0);
        const previousData = currentData.map(value => value - Math.random() * 5);
        
        // Draw both datasets
        this.drawComparisonLineChart(ctx, labels, currentData, previousData);
    }

    drawComparisonLineChart(ctx, labels, currentData, previousData) {
        const canvas = ctx.canvas;
        const padding = 60;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        const pointSpacing = chartWidth / (labels.length - 1);
        const maxValue = 100;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();
        
        // Draw previous data line
        ctx.strokeStyle = 'rgba(156, 163, 175, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        
        previousData.forEach((value, index) => {
            const x = padding + index * pointSpacing;
            const y = canvas.height - padding - (value / maxValue) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw current data line
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        currentData.forEach((value, index) => {
            const x = padding + index * pointSpacing;
            const y = canvas.height - padding - (value / maxValue) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw points and labels for current data
        currentData.forEach((value, index) => {
            const x = padding + index * pointSpacing;
            const y = canvas.height - padding - (value / maxValue) * chartHeight;
            
            // Draw point
            ctx.fillStyle = '#6366f1';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw value
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${value}%`, x, y - 10);
            
            // Draw label
            ctx.save();
            ctx.translate(x, canvas.height - padding + 20);
            ctx.rotate(-Math.PI / 6);
            ctx.fillText(labels[index], 0, 0);
            ctx.restore();
        });
        
        // Draw legend
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Previous', canvas.width - 150, 30);
        ctx.strokeStyle = 'rgba(156, 163, 175, 0.8)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(canvas.width - 150, 40);
        ctx.lineTo(canvas.width - 100, 40);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillText('Current', canvas.width - 150, 60);
        ctx.strokeStyle = '#6366f1';
        ctx.beginPath();
        ctx.moveTo(canvas.width - 150, 70);
        ctx.lineTo(canvas.width - 100, 70);
        ctx.stroke();
    }

    renderSummary() {
        const summaryGrid = document.getElementById('summaryGrid');
        
        const summaryData = [
            {
                label: 'Overall Quality',
                value: `${this.data.overallQuality || 0}%`,
                change: '+2.3%',
                trend: 'up',
                icon: 'fa-chart-line'
            },
            {
                label: 'Data Integrity',
                value: `${this.data.dataIntegrity || 0}%`,
                change: '+1.5%',
                trend: 'up',
                icon: 'fa-shield-alt'
            },
            {
                label: 'Schema Compliance',
                value: `${this.data.schemaCompliance || 0}%`,
                change: '+3.2%',
                trend: 'up',
                icon: 'fa-check-circle'
            },
            {
                label: 'Issues Resolved',
                value: '156',
                change: '+45',
                trend: 'up',
                icon: 'fa-tasks'
            }
        ];
        
        summaryGrid.textContent = summaryData.map(item => `
            <div class="summary-card">
                <div class="summary-icon">
                    <i class="fas ${item.icon}"></i>
                </div>
                <div class="summary-content">
                    <div class="summary-value">${item.value}</div>
                    <div class="summary-label">${item.label}</div>
                    <div class="summary-change trend-${item.trend}">
                        <i class="fas fa-arrow-${item.trend}"></i>
                        ${item.change}
                    </div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    getEnabledMetrics() {
        const checkboxes = document.querySelectorAll('.metric-checkbox input:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    getMetricLabels(metrics) {
        const labelMap = {
            dataIntegrity: 'Data Integrity',
            schemaCompliance: 'Schema Compliance',
            consistencyScore: 'Consistency',
            completenessScore: 'Completeness',
            accuracyScore: 'Accuracy'
        };
        
        return metrics.map(metric => labelMap[metric] || metric);
    }

    changeChartType(type) {
        this.chartType = type;
        this.renderMainChart();
    }

    changeTimeRange(range) {
        // Reload data with different time range
        this.loadQualityData();
    }

    toggleMetric(metric, enabled) {
        this.renderMainChart();
    }

    updateComparison() {
        this.renderComparisonChart();
    }

    exportChart() {
        const canvas = document.getElementById('mainQualityChart');
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'quality-metrics-chart.png';
        a.click();
        
        this.showNotification('Chart exported successfully', 'success');
    }

    refreshData() {
        this.loadQualityData();
    }

    showLoading(show) {
        const loadingElement = document.getElementById('chartLoading');
        const chartElement = document.getElementById('mainChartContainer');
        
        if (show) {
            loadingElement.style.display = 'block';
            chartElement.style.display = 'none';
        } else {
            loadingElement.style.display = 'none';
            chartElement.style.display = 'block';
        }
    }

    showError(message) {
        const errorElement = document.getElementById('chartError');
        const chartElement = document.getElementById('mainChartContainer');
        
        errorElement.style.display = 'block';
        chartElement.style.display = 'none';
    }

    showNotification(message, type = 'info') {
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QualityMetricsChart;
} else {
    window.QualityMetricsChart = QualityMetricsChart;
}
