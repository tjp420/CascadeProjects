/**
 * Quality Metrics Tracker
 * Comprehensive tracking and visualization of data quality metrics
 * Provides real-time monitoring and historical analysis of quality trends
 */

class QualityMetricsTracker {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showTrends: true,
            animateCharts: true,
            realTimeUpdates: true,
            updateInterval: 30000, // 30 seconds
            theme: 'dark',
            ...options
        };
        this.data = null;
        this.historicalData = [];
        this.updateTimer = null;
        
        this.init();
    }

    /**
     * Initialize the quality metrics tracker
     */
    init() {
        if (!this.container) {
            console.error('Quality metrics tracker container not found');
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
        const styleId = 'quality-metrics-tracker-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .quality-metrics-tracker {
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
                    background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .tracker-subtitle {
                    color: #94a3b8;
                    font-size: 1rem;
                }

                .overall-score-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 2rem;
                    text-align: center;
                    margin-bottom: 2rem;
                    position: relative;
                    overflow: hidden;
                }

                .overall-score-section::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: linear-gradient(45deg, transparent, rgba(16, 185, 129, 0.1), transparent);
                    animation: shimmer 3s infinite;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
                    100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
                }

                .score-circle {
                    width: 150px;
                    height: 150px;
                    border-radius: 50%;
                    margin: 0 auto 1rem;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3rem;
                    font-weight: 700;
                    color: #f8fafc;
                    transition: all 0.3s ease;
                }

                .score-excellent {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    box-shadow: 0 0 30px rgba(16, 185, 129, 0.3);
                }

                .score-good {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    box-shadow: 0 0 30px rgba(59, 130, 246, 0.3);
                }

                .score-fair {
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    box-shadow: 0 0 30px rgba(245, 158, 11, 0.3);
                }

                .score-poor {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    box-shadow: 0 0 30px rgba(239, 68, 68, 0.3);
                }

                .score-label {
                    font-size: 1.2rem;
                    color: #94a3b8;
                    margin-bottom: 0.5rem;
                }

                .score-description {
                    color: #64748b;
                    font-size: 0.9rem;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .metric-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .metric-card:hover {
                    transform: translateY(-2px);
                    border-color: #3b82f6;
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
                }

                .metric-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .metric-name {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .metric-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                }

                .value-high {
                    color: #10b981;
                }

                .value-medium {
                    color: #f59e0b;
                }

                .value-low {
                    color: #ef4444;
                }

                .metric-trend {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.9rem;
                    color: #94a3b8;
                }

                .trend-up {
                    color: #10b981;
                }

                .trend-down {
                    color: #ef4444;
                }

                .trend-stable {
                    color: #64748b;
                }

                .metric-bar-container {
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 8px;
                    height: 12px;
                    overflow: hidden;
                    margin: 1rem 0;
                }

                .metric-bar {
                    height: 100%;
                    border-radius: 8px;
                    transition: width 1s ease-in-out;
                    position: relative;
                }

                .metric-bar::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                    animation: shimmer 2s infinite;
                }

                .bar-high {
                    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
                }

                .bar-medium {
                    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
                }

                .bar-low {
                    background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
                }

                .metric-description {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.4;
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
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    border: 1px solid #3b82f6;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .trend-btn:hover {
                    background: rgba(59, 130, 246, 0.3);
                    transform: translateY(-1px);
                }

                .trend-btn.active {
                    background: #3b82f6;
                    color: #f8fafc;
                }

                .trend-chart {
                    height: 200px;
                    position: relative;
                    margin: 1rem 0;
                }

                .line-chart {
                    width: 100%;
                    height: 100%;
                    position: relative;
                }

                .chart-line {
                    stroke: #3b82f6;
                    stroke-width: 2;
                    fill: none;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }

                .chart-area {
                    fill: url(#gradient);
                    opacity: 0.3;
                }

                .chart-point {
                    fill: #3b82f6;
                    stroke: #1e293b;
                    stroke-width: 2;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .chart-point:hover {
                    r: 6;
                    fill: #60a5fa;
                }

                .chart-tooltip {
                    position: absolute;
                    background: rgba(15, 23, 42, 0.95);
                    color: #f8fafc;
                    padding: 0.5rem;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    pointer-events: none;
                    z-index: 1000;
                }

                .recommendations-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .recommendations-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .recommendation-list {
                    display: grid;
                    gap: 1rem;
                }

                .recommendation-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                }

                .recommendation-item:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
                }

                .recommendation-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .icon-improvement {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }

                .icon-warning {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                }

                .icon-critical {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
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
                    line-height: 1.4;
                }

                .recommendation-impact {
                    font-size: 0.8rem;
                    color: #64748b;
                    margin-top: 0.5rem;
                }

                .status-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 0.5rem;
                    animation: pulse 2s infinite;
                }

                .status-good {
                    background: #10b981;
                }

                .status-warning {
                    background: #f59e0b;
                }

                .status-critical {
                    background: #ef4444;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                .refresh-indicator {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.25rem 0.75rem;
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    margin-left: 1rem;
                }

                .refresh-indicator.updating {
                    animation: pulse 1s infinite;
                }

                @media (max-width: 768px) {
                    .quality-metrics-tracker {
                        padding: 1rem;
                    }

                    .metrics-grid {
                        grid-template-columns: 1fr;
                    }

                    .score-circle {
                        width: 120px;
                        height: 120px;
                        font-size: 2.5rem;
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
            <div class="quality-metrics-tracker">
                <div class="tracker-header">
                    <h2 class="tracker-title">📈 Quality Metrics Tracker</h2>
                    <p class="tracker-subtitle">Real-time monitoring of data quality metrics and trends</p>
                    <div class="refresh-indicator" id="refresh-indicator">
                        <span class="status-indicator status-good"></span>
                        <span>Live</span>
                    </div>
                </div>

                <div class="overall-score-section" id="overall-score-section">
                    <div class="score-circle" id="overall-score-circle">--</div>
                    <div class="score-label">Overall Quality Score</div>
                    <div class="score-description" id="score-description">Calculating...</div>
                </div>

                <div class="metrics-grid" id="metrics-grid">
                    <!-- Individual metrics will be rendered here -->
                </div>

                <div class="trends-section" id="trends-section">
                    <div class="trends-header">
                        <h3>📊 Quality Trends</h3>
                        <div class="trend-controls">
                            <button class="trend-btn active" data-period="24h">24h</button>
                            <button class="trend-btn" data-period="7d">7d</button>
                            <button class="trend-btn" data-period="30d">30d</button>
                        </div>
                    </div>
                    <div class="trend-chart" id="trend-chart">
                        <svg class="line-chart" id="line-chart">
                            <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" style="stop-color:#3b82f6 /* Replaced innerHTML with textContent for safety */stop-opacity:0.3" />
                                    <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0.05" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div class="chart-tooltip" id="chart-tooltip" style="display: none;"></div>
                    </div>
                </div>

                <div class="recommendations-section" id="recommendations-section">
                    <h3 class="recommendations-header">💡 Quality Recommendations</h3>
                    <div class="recommendation-list" id="recommendation-list">
                        <!-- Recommendations will be rendered here -->
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Load quality metrics data and render tracker
     */
    async loadQualityMetrics() {
        try {
            // Load roadmap data
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            this.data = roadmapData.qualityMetrics;
            this.addHistoricalDataPoint(this.data);
            
            this.renderTracker();
            
        } catch (error) {
            console.error('Failed to load quality metrics:', error);
            this.showError('Failed to load quality metrics');
        }
    }

    /**
     * Add historical data point
     */
    addHistoricalDataPoint(data) {
        const timestamp = new Date().toISOString();
        this.historicalData.push({
            timestamp,
            overallQuality: data.overallQuality,
            dataIntegrity: data.dataIntegrity,
            schemaCompliance: data.schemaCompliance,
            consistencyScore: data.consistencyScore,
            completenessScore: data.completenessScore,
            accuracyScore: data.accuracyScore
        });
        
        // Keep only last 30 data points
        if (this.historicalData.length > 30) {
            this.historicalData.shift();
        }
    }

    /**
     * Render the tracker with data
     */
    renderTracker() {
        if (!this.data) return;

        this.renderOverallScore();
        this.renderIndividualMetrics();
        this.renderTrends();
        this.renderRecommendations();
        
        if (this.options.animateCharts) {
            this.animateCharts();
        }
    }

    /**
     * Render overall quality score
     */
    renderOverallScore() {
        const scoreCircle = document.getElementById('overall-score-circle');
        const scoreDescription = document.getElementById('score-description');
        const overallScore = this.data.overallQuality;
        
        scoreCircle.textContent = overallScore;
        scoreCircle.className = 'score-circle ' + this.getScoreClass(overallScore);
        
        if (overallScore >= 90) {
            scoreDescription.textContent = 'Excellent quality - Data meets all standards';
        } else if (overallScore >= 80) {
            scoreDescription.textContent = 'Good quality - Minor improvements recommended';
        } else if (overallScore >= 70) {
            scoreDescription.textContent = 'Fair quality - Several areas need attention';
        } else {
            scoreDescription.textContent = 'Poor quality - Significant improvements required';
        }
    }

    /**
     * Render individual metrics
     */
    renderIndividualMetrics() {
        const container = document.getElementById('metrics-grid');
        
        const metrics = [
            { key: 'dataIntegrity', name: 'Data Integrity', description: 'Consistency and accuracy of data values' },
            { key: 'schemaCompliance', name: 'Schema Compliance', description: 'Adherence to defined data schemas' },
            { key: 'consistencyScore', name: 'Consistency', description: 'Uniformity across datasets' },
            { key: 'completenessScore', name: 'Completeness', description: 'Presence of required fields' },
            { key: 'accuracyScore', name: 'Accuracy', description: 'Correctness of data values' }
        ];
        
        container.textContent = metrics.map(metric => {
            const value = this.data[metric.key] /* Replaced innerHTML with textContent for safety */
            const trend = this.calculateTrend(metric.key);
            
            return `
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-name">${metric.name}</div>
                        <div class="metric-trend">
                            <span class="trend-${trend.direction}">${trend.icon}</span>
                            <span>${trend.change}%</span>
                        </div>
                    </div>
                    <div class="metric-value ${this.getValueClass(value)}">${value}</div>
                    <div class="metric-bar-container">
                        <div class="metric-bar ${this.getBarClass(value)}" style="width: 0%" data-target-width="${value}%"></div>
                    </div>
                    <div class="metric-description">${metric.description}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render trends chart
     */
    renderTrends() {
        const chart = document.getElementById('line-chart');
        const tooltip = document.getElementById('chart-tooltip');
        
        if (this.historicalData.length < 2) {
            chart.textContent = '<text x="50%" y="50%" text-anchor="middle" fill="#94a3b8">Insufficient data for trends</text>' /* Replaced innerHTML with textContent for safety */
            return;
        }
        
        const width = chart.clientWidth;
        const height = chart.clientHeight;
        const padding = 20;
        
        const xScale = (width - 2 * padding) / (this.historicalData.length - 1);
        const yScale = (height - 2 * padding) / 100;
        
        // Create path for the line
        const points = this.historicalData.map((point, index) => {
            const x = padding + index * xScale;
            const y = height - padding - (point.overallQuality * yScale);
            return `${x},${y}`;
        });
        
        const pathData = `M ${points.join(' L ')}`;
        
        // Create area path
        const areaData = `${pathData} L ${padding + (this.historicalData.length - 1) * xScale},${height - padding} L ${padding},${height - padding} Z`;
        
        chart.textContent = `
            <path class="chart-area" d="${areaData}" />
            <path class="chart-line" d="${pathData}" />
            ${this.historicalData.map((point, index) => {
                const x = padding + index * xScale /* Replaced innerHTML with textContent for safety */
                const y = height - padding - (point.overallQuality * yScale);
                return `
                    <circle class="chart-point" cx="${x}" cy="${y}" r="4" 
                        data-timestamp="${point.timestamp}" 
                        data-value="${point.overallQuality}" />
                `;
            }).join('')}
        `;
        
        // Add hover events for points
        chart.querySelectorAll('.chart-point').forEach(point => {
            point.addEventListener('mouseenter', (e) => {
                const timestamp = e.target.dataset.timestamp;
                const value = e.target.dataset.value;
                
                tooltip.textContent = `
                    <div>Quality Score: ${value}</div>
                    <div>${new Date(timestamp).toLocaleString()}</div>
                ` /* Replaced innerHTML with textContent for safety */
                tooltip.style.display = 'block';
                tooltip.style.left = e.pageX + 10 + 'px';
                tooltip.style.top = e.pageY - 30 + 'px';
            });
            
            point.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });
    }

    /**
     * Render quality recommendations
     */
    renderRecommendations() {
        const container = document.getElementById('recommendation-list');
        const recommendations = this.generateRecommendations();
        
        container.textContent = recommendations.map(rec => `
            <div class="recommendation-item">
                <div class="recommendation-icon ${rec.iconClass}">
                    ${rec.icon}
                </div>
                <div class="recommendation-content">
                    <div class="recommendation-title">${rec.title}</div>
                    <div class="recommendation-description">${rec.description}</div>
                    <div class="recommendation-impact">Impact: ${rec.impact} | Priority: ${rec.priority}</div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Generate quality recommendations based on metrics
     */
    generateRecommendations() {
        const recommendations = [];
        const metrics = this.data;
        
        // Check for low-scoring metrics
        if (metrics.dataIntegrity < 85) {
            recommendations.push({
                icon: '⚠️',
                iconClass: 'icon-warning',
                title: 'Improve Data Integrity',
                description: 'Data integrity is below optimal levels. Review data validation rules and implement stricter consistency checks.',
                impact: 'High',
                priority: 'High'
            });
        }
        
        if (metrics.schemaCompliance < 85) {
            recommendations.push({
                icon: '⚠️',
                iconClass: 'icon-warning',
                title: 'Enhance Schema Compliance',
                description: 'Schema compliance needs improvement. Update data validation rules and ensure all data follows defined schemas.',
                impact: 'Medium',
                priority: 'Medium'
            });
        }
        
        if (metrics.consistencyScore < 85) {
            recommendations.push({
                icon: '⚠️',
                iconClass: 'icon-warning',
                title: 'Standardize Data Consistency',
                description: 'Data consistency across datasets is inconsistent. Implement standard data formats and validation rules.',
                impact: 'Medium',
                priority: 'Medium'
            });
        }
        
        if (metrics.completenessScore < 85) {
            recommendations.push({
                icon: '⚠️',
                iconClass: 'icon-warning',
                title: 'Improve Data Completeness',
                description: 'Missing required fields detected. Review data collection processes and ensure all required fields are populated.',
                impact: 'High',
                priority: 'High'
            });
        }
        
        if (metrics.accuracyScore < 85) {
            recommendations.push({
                icon: '⚠️',
                iconClass: 'icon-warning',
                title: 'Enhance Data Accuracy',
                description: 'Data accuracy is below acceptable levels. Implement data validation and automated testing.',
                impact: 'High',
                priority: 'High'
            });
        }
        
        // Add positive reinforcement if all metrics are good
        if (metrics.overallQuality >= 90) {
            recommendations.push({
                icon: '✅',
                iconClass: 'icon-improvement',
                title: 'Excellent Quality Maintained',
                description: 'All quality metrics are performing well. Continue current practices and monitor for any changes.',
                impact: 'Low',
                priority: 'Low'
            });
        }
        
        return recommendations;
    }

    /**
     * Calculate trend for a metric
     */
    calculateTrend(metricKey) {
        if (this.historicalData.length < 2) {
            return { direction: 'stable', icon: '➡️', change: 0 };
        }
        
        const current = this.data[metricKey];
        const previous = this.historicalData[this.historicalData.length - 2][metricKey];
        
        const change = current - previous;
        const changePercent = Math.round((change / previous) * 100);
        
        if (change > 0) {
            return { direction: 'up', icon: '📈', change: changePercent };
        } else if (change < 0) {
            return { direction: 'down', icon: '📉', change: changePercent };
        } else {
            return { direction: 'stable', icon: '➡️', change: 0 };
        }
    }

    /**
     * Get score class based on value
     */
    getScoreClass(value) {
        if (value >= 90) return 'score-excellent';
        if (value >= 80) return 'score-good';
        if (value >= 70) return 'score-fair';
        return 'score-poor';
    }

    /**
     * Get value class based on score
     */
    getValueClass(value) {
        if (value >= 90) return 'value-high';
        if (value >= 80) return 'value-medium';
        return 'value-low';
    }

    /**
     * Get bar class based on value
     */
    getBarClass(value) {
        if (value >= 90) return 'bar-high';
        if (value >= 80) return 'bar-medium';
        return 'bar-low';
    }

    /**
     * Animate charts on load
     */
    animateCharts() {
        // Animate metric bars
        const bars = document.querySelectorAll('.metric-bar');
        bars.forEach((bar, index) => {
            const targetWidth = bar.dataset.targetWidth;
            setTimeout(() => {
                bar.style.width = targetWidth;
            }, index * 100);
        });
        
        // Animate score circle
        const scoreCircle = document.getElementById('overall-score-circle');
        if (scoreCircle) {
            scoreCircle.style.transform = 'scale(0)';
            setTimeout(() => {
                scoreCircle.style.transform = 'scale(1)';
            }, 300);
        }
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

        // Metric card interactions
        this.container.addEventListener('click', (e) => {
            const metricCard = e.target.closest('.metric-card');
            if (metricCard) {
                this.handleMetricClick(metricCard);
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
        
        // Update chart for selected period
        const period = button.dataset.period;
        this.updateTrendChart(period);
    }

    /**
     * Update trend chart for selected period
     */
    updateTrendChart(period) {
        // Filter historical data based on period
        let filteredData = this.historicalData;
        
        if (period === '24h') {
            filteredData = this.historicalData.slice(-24);
        } else if (period === '7d') {
            filteredData = this.historicalData.slice(-7);
        } else if (period === '30d') {
            filteredData = this.historicalData.slice(-30);
        }
        
        // Re-render trends with filtered data
        const tempData = this.historicalData;
        this.historicalData = filteredData;
        this.renderTrends();
        this.historicalData = tempData;
    }

    /**
     * Handle metric card click
     */
    handleMetricClick(card) {
        const metricName = card.querySelector('.metric-name').textContent;
        
        // Show detailed information
        this.showMetricDetails(metricName);
    }

    /**
     * Show metric details modal
     */
    showMetricDetails(metricName) {
        const metricKey = this.getMetricKeyByName(metricName);
        const value = this.data[metricKey];
        const trend = this.calculateTrend(metricKey);
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.textContent = `
            <div class="modal-content">
                <h3>${metricName} Details</h3>
                <div class="metric-details">
                    <p><strong>Current Score:</strong> ${value}</p>
                    <p><strong>Trend:</strong> ${trend.icon} ${trend.change}%</p>
                    <p><strong>Status:</strong> ${this.getMetricStatus(value)}</p>
                    <p><strong>Recommendation:</strong> ${this.getMetricRecommendation(metricKey, value)}</p>
                </div>
                <button onclick="this.closest('.detail-modal').remove()">Close</button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        document.body.appendChild(modal);
    }

    /**
     * Get metric key by display name
     */
    getMetricKeyByName(name) {
        const mapping = {
            'Data Integrity': 'dataIntegrity',
            'Schema Compliance': 'schemaCompliance',
            'Consistency': 'consistencyScore',
            'Completeness': 'completenessScore',
            'Accuracy': 'accuracyScore'
        };
        return mapping[name] || name;
    }

    /**
     * Get metric status based on value
     */
    getMetricStatus(value) {
        if (value >= 90) return 'Excellent';
        if (value >= 80) return 'Good';
        if (value >= 70) return 'Fair';
        return 'Poor';
    }

    /**
     * Get metric recommendation
     */
    getMetricRecommendation(metricKey, value) {
        if (value >= 90) {
            return 'Continue current practices and monitor for changes.';
        } else if (value >= 80) {
            return 'Minor improvements recommended for optimal performance.';
        } else if (value >= 70) {
            return 'Significant improvements needed in this area.';
        } else {
            return 'Critical improvements required immediately.';
        }
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        this.updateTimer = setInterval(async () => {
            try {
                const indicator = document.getElementById('refresh-indicator');
                if (indicator) {
                    indicator.classList.add('updating');
                }
                
                await this.loadQualityMetrics();
                
                if (indicator) {
                    indicator.classList.remove('updating');
                }
            } catch (error) {
                console.error('Failed to update quality metrics:', error);
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
    }

    /**
     * Show error message
     */
    showError(message) {
        this.container.textContent = `
            <div class="quality-metrics-tracker">
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
        await this.loadQualityMetrics();
    }

    /**
     * Export tracker data
     */
    exportData(_format = 'json') {
        if (!this.data) {
            alert('No data to export');
            return;
        }

        const exportData = {
            generatedAt: new Date().toISOString(),
            currentMetrics: this.data,
            historicalData: this.historicalData,
            recommendations: this.generateRecommendations()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quality-metrics-${new Date().toISOString().split('T')[0]}.json`;
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
        
        const styleElement = document.getElementById('quality-metrics-tracker-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QualityMetricsTracker;
} else if (typeof window !== 'undefined') {
    window.QualityMetricsTracker = QualityMetricsTracker;
}
