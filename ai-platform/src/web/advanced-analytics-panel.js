/**
 * Advanced Analytics Panel
 * Comprehensive analytics and insights visualization
 * Provides deep analysis capabilities with interactive charts and data mining
 */

class AdvancedAnalyticsPanel {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showTrends: true,
            enableDataMining: true,
            realTimeAnalysis: true,
            updateInterval: 45000, // 45 seconds
            theme: 'dark',
            ...options
        };
        this.data = null;
        this.analyticsData = [];
        this.charts = [];
        this.updateTimer = null;
        
        this.init();
    }

    /**
     * Initialize the advanced analytics panel
     */
    init() {
        if (!this.container) {
            console.error('Advanced analytics panel container not found');
            return;
        }

        this.setupStyles();
        this.createPanelStructure();
        this.bindEvents();
        
        if (this.options.realTimeAnalysis) {
            this.startRealTimeAnalysis();
        }
    }

    /**
     * Setup CSS styles for the panel
     */
    setupStyles() {
        const styleId = 'advanced-analytics-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .advanced-analytics-panel {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                }

                .panel-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .panel-title {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .panel-subtitle {
                    color: #94a3b8;
                    font-size: 1rem;
                }

                .analytics-overview {
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
                    border-color: #06b6d4;
                    box-shadow: 0 8px 25px rgba(6, 182, 212, 0.2);
                }

                .overview-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .overview-label {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                }

                .overview-trend {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
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

                .analytics-sections {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 2rem;
                    margin-bottom: 2rem;
                }

                .analytics-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                }

                .section-header {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .section-controls {
                    display: flex;
                    gap: 0.5rem;
                }

                .control-btn {
                    padding: 0.5rem 1rem;
                    background: rgba(6, 182, 212, 0.2);
                    color: #06b6d4;
                    border: 1px solid #06b6d4;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .control-btn:hover {
                    background: rgba(6, 182, 212, 0.3);
                    transform: translateY(-1px);
                }

                .control-btn.active {
                    background: #06b6d4;
                    color: #f8fafc;
                }

                .chart-container {
                    height: 300px;
                    position: relative;
                    margin: 1rem 0;
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    overflow: hidden;
                }

                .chart-canvas {
                    width: 100%;
                    height: 100%;
                }

                .data-mining-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .mining-header {
                    font-size: 1.2rem;
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
                    border-color: #06b6d4;
                    box-shadow: 0 4px 15px rgba(6, 182, 212, 0.2);
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

                .insight-confidence {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                    font-size: 0.8rem;
                    color: #64748b;
                }

                .confidence-bar {
                    flex: 1;
                    height: 6px;
                    background: rgba(148, 163, 184, 0.2);
                    border-radius: 3px;
                    overflow: hidden;
                }

                .confidence-fill {
                    height: 100%;
                    border-radius: 3px;
                    transition: width 1s ease-in-out;
                }

                .confidence-high {
                    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
                }

                .confidence-medium {
                    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
                }

                .confidence-low {
                    background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
                }

                .predictions-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .predictions-header {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .prediction-list {
                    display: grid;
                    gap: 1rem;
                }

                .prediction-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: all 0.3s ease;
                }

                .prediction-item:hover {
                    border-color: #06b6d4;
                    box-shadow: 0 4px 15px rgba(6, 182, 212, 0.2);
                }

                .prediction-text {
                    flex: 1;
                    color: #f8fafc;
                    font-weight: 500;
                }

                .prediction-confidence {
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 500;
                }

                .confidence-high {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }

                .confidence-medium {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                }

                .confidence-low {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .prediction-probability {
                    color: #94a3b8;
                    font-size: 0.8rem;
                }

                .export-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .export-header {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .export-controls {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .export-btn {
                    padding: 0.75rem 1.5rem;
                    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
                    color: #f8fafc;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .export-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(6, 182, 212, 0.3);
                }

                .export-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                @media (max-width: 768px) {
                    .advanced-analytics-panel {
                        padding: 1rem;
                    }

                    .analytics-overview {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .analytics-sections {
                        grid-template-columns: 1fr;
                    }

                    .insights-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create the panel structure
     */
    createPanelStructure() {
        this.container.textContent = `
            <div class="advanced-analytics-panel">
                <div class="panel-header">
                    <h2 class="panel-title">🔬 Advanced Analytics Panel</h2>
                    <p class="panel-subtitle">Deep insights and predictive analytics for data optimization</p>
                </div>

                <div class="analytics-overview" id="analytics-overview">
                    <!-- Overview cards will be rendered here -->
                </div>

                <div class="analytics-sections">
                    <div class="analytics-section">
                        <div class="section-header">
                            <h3>📊 Quality Trends Analysis</h3>
                            <div class="section-controls">
                                <button class="control-btn active" data-period="7d">7 Days</button>
                                <button class="control-btn" data-period="30d">30 Days</button>
                                <button class="control-btn" data-period="90d">90 Days</button>
                            </div>
                        </div>
                        <div class="chart-container">
                            <canvas class="chart-canvas" id="quality-trends-chart"></canvas>
                        </div>
                    </div>

                    <div class="analytics-section">
                        <div class="section-header">
                            <h3>📈 Performance Metrics</h3>
                            <div class="section-controls">
                                <button class="control-btn" onclick="advancedAnalytics.refreshPerformanceMetrics()">Refresh</button>
                            </div>
                        </div>
                        <div class="chart-container">
                            <canvas class="chart-canvas" id="performance-chart"></canvas>
                        </div>
                    </div>

                    <div class="analytics-section">
                        <div class="section-header">
                            <h3>🔍 Data Mining Insights</h3>
                            <div class="section-controls">
                                <button class="control-btn" onclick="advancedAnalytics.runDataMining()">Run Analysis</button>
                            </div>
                        </div>
                        <div class="insights-grid" id="data-mining-insights">
                            <!-- Data mining insights will be rendered here -->
                        </div>
                    </div>
                </div>

                <div class="data-mining-section" id="data-mining-section">
                    <div class="mining-header">
                        <h3>🔍 AI-Powered Data Mining</h3>
                    </div>
                    <div class="insights-grid" id="ai-insights">
                        <!-- AI insights will be rendered here -->
                    </div>
                </div>

                <div class="predictions-section" id="predictions-section">
                    <div class="predictions-header">
                        <h3>🔮 Predictive Analytics</h3>
                    </div>
                    <div class="prediction-list" id="prediction-list">
                        <!-- Predictions will be rendered here -->
                    </div>
                </div>

                <div class="export-section">
                    <div class="export-header">
                        <h3>📤 Export Analytics</h3>
                    </div>
                    <div class="export-controls">
                        <button class="export-btn" onclick="advancedAnalytics.exportAnalytics('csv')">Export CSV</button>
                        <button class="export-btn" onclick="advancedAnalytics.exportAnalytics('json')">Export JSON</button>
                        <button class="export-btn" onclick="advancedAnalytics.exportAnalytics('pdf')">Export PDF</button>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load analytics data and render panel
     */
    async loadAnalyticsData() {
        try {
            // Load roadmap data
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            this.data = roadmapData;
            this.generateAnalyticsData();
            
            this.renderPanel();
            
        } catch (error) {
            console.error('Failed to load analytics data:', error);
            this.showError('Failed to load analytics data');
        }
    }

    /**
     * Generate analytics data
     */
    generateAnalyticsData() {
        if (!this.data) return;

        // Generate time-series data for trends
        this.generateTrendsData();
        
        // Generate performance metrics
        this.generatePerformanceMetrics();
        
        // Generate data mining insights
        this.generateDataMiningInsights();
        
        // Generate predictions
        this.generatePredictions();
    }

    /**
     * Generate trends data
     */
    generateTrendsData() {
        const qualityMetrics = this.data.qualityMetrics;
        const now = new Date();
        
        // Generate historical data points for the last 90 days
        for (let i = 90; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            
            // Add some variation to simulate real data changes
            const variation = Math.sin(i * 0.1) * 5;
            
            this.analyticsData.push({
                timestamp: date.toISOString(),
                overallQuality: Math.max(0, Math.min(100, qualityMetrics.overallQuality + variation)),
                dataIntegrity: Math.max(0, Math.min(100, qualityMetrics.dataIntegrity + variation * 0.8)),
                schemaCompliance: Math.max(0, Math.min(100, qualityMetrics.schemaCompliance + variation * 0.6)),
                consistencyScore: Math.max(0, Math.min(100, qualityMetrics.consistencyScore + variation * 0.4)),
                completenessScore: Math.max(0, Math.min(100, qualityMetrics.completenessScore + variation * 0.7)),
                accuracyScore: Math.max(0, Math.min(100, qualityMetrics.accuracyScore + variation * 0.5))
            });
        }
    }

    /**
     * Generate performance metrics
     */
    generatePerformanceMetrics() {
        const analysisOverview = this.data.analysisOverview;
        
        this.performanceMetrics = {
            analysisSpeed: analysisOverview.analysisSpeed,
            filesProcessedPerSecond: analysisOverview.filesProcessedPerSecond,
            memoryUsage: analysisOverview.memoryUsage,
            cpuUsage: analysisOverview.cpuUsage,
            dataQualityScore: analysisOverview.dataQualityScore,
            totalMockFiles: analysisOverview.totalMockFiles,
            totalMockDataSize: analysisOverview.totalMockDataSize
        };
    }

    /**
     * Generate data mining insights
     */
    generateDataMiningInsights() {
        const insights = [];
        const categories = this.data.mockDataCategories;
        const qualityMetrics = this.data.qualityMetrics;
        
        // Category performance analysis
        const categoryAnalysis = categories.map(cat => ({
            category: cat.category,
            qualityScore: cat.qualityScore,
            fileCount: cat.fileCount,
            totalSize: cat.totalSize,
            issues: cat.issues,
            confidence: cat.confidence,
            performance: this.calculateCategoryPerformance(cat),
            efficiency: this.calculateCategoryEfficiency(cat)
        }));
        
        insights.push({
            type: 'category_performance',
            title: 'Category Performance Analysis',
            description: 'Analysis of mock data categories by quality, efficiency, and performance metrics',
            data: categoryAnalysis,
            insights: this.generateCategoryInsights(categoryAnalysis)
        });
        
        // Quality correlation analysis
        const qualityCorrelation = this.analyzeQualityCorrelation();
        insights.push({
            type: 'quality_correlation',
            title: 'Quality Metrics Correlation',
            description: 'Analysis of relationships between different quality metrics',
            data: qualityCorrelation,
            insights: this.generateCorrelationInsights(qualityCorrelation)
        });
        
        // Pattern detection
        const patterns = this.detectDataPatterns();
        insights.push({
            type: 'pattern_detection',
            title: 'Data Pattern Analysis',
            description: 'AI-powered pattern detection in mock data structures',
            data: patterns,
            insights: this.generatePatternInsights(patterns)
        });
        
        return insights;
    }

    /**
     * Calculate category performance
     */
    calculateCategoryPerformance(category) {
        const qualityScore = parseFloat(category.qualityScore);
        const fileCount = category.fileCount;
        const totalSize = parseFloat(category.totalSize.replace('MB', ''));
        
        // Performance score based on quality, file count, and size efficiency
        const qualityWeight = 0.4;
        const efficiencyWeight = 0.3;
        const sizeWeight = 0.3;
        
        const efficiencyScore = fileCount / totalSize; // files per MB
        const normalizedEfficiency = Math.min(1, efficiencyScore / 10); // Normalize to 0-1 scale
        
        return Math.round((qualityScore * qualityWeight + normalizedEfficiency * efficiencyWeight + (100 - totalSize / 100) * sizeWeight) * 100);
    }

    /**
     * Calculate category efficiency
     */
    calculateCategoryEfficiency(category) {
        const qualityScore = parseFloat(category.qualityScore);
        const fileCount = category.fileCount;
        const totalSize = parseFloat(category.totalSize.replace('MB', ''));
        
        // Efficiency: high quality with reasonable file size
        if (qualityScore >= 90 && totalSize <= 30) return 'Excellent';
        if (qualityScore >= 80 && totalSize <= 50) return 'Good';
        if (qualityScore >= 70 && totalSize <= 70) return 'Fair';
        return 'Needs Improvement';
    }

    /**
     * Analyze quality metrics correlation
     */
    analyzeQualityCorrelation() {
        const metrics = this.data.qualityMetrics;
        
        const correlations = {};
        const metricKeys = Object.keys(metrics);
        
        for (let i = 0; i < metricKeys.length; i++) {
            for (let j = i + 1; j < metricKeys.length; j++) {
                const metric1 = metricKeys[i];
                const metric2 = metricKeys[j];
                const correlation = this.calculateCorrelation(
                    this.getMetricTimeSeries(metric1),
                    this.getMetricTimeSeries(metric2)
                );
                
                correlations[`${metric1}_vs_${metric2}`] = correlation;
            }
        }
        
        return correlations;
    }

    /**
     * Get time series data for a metric
     */
    getMetricTimeSeries(metricKey) {
        return this.analyticsData.map(point => point[metricKey]);
    }

    /**
     * Calculate correlation between two arrays
     */
    calculateCorrelation(array1, array2) {
        if (array1.length !== array2.length || array1.length === 0) return 0;
        
        const n = array1.length;
        const sum1 = array1.reduce((a, b) => a + b, 0);
        const sum2 = array2.reduce((a, b) => a + b, 0);
        const sum1Sq = array1.reduce((a, b) => a + b * b, 0);
        const sum2Sq = array2.reduce((a, b) => a + b * b, 0);
        
        const numerator = n * sum1 * sum2 - sum1 * sum2;
        const denominator = Math.sqrt((n * sum1Sq - sum1 * sum1) * (n * sum2Sq - sum2 * sum2));
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Detect data patterns
     */
    detectDataPatterns() {
        const patterns = [];
        const categories = this.data.mockDataCategories;
        const issues = this.data.detectedIssues;
        
        // Pattern 1: Issue concentration by category
        const issuePatterns = this.analyzeIssuePatterns(categories, issues);
        patterns.push({
            type: 'issue_concentration',
            title: 'Issue Concentration Analysis',
            description: 'Analysis of issue distribution across data categories',
            data: issuePatterns,
            insights: this.generateIssuePatternInsights(issuePatterns)
        });
        
        // Pattern 2: Quality score distribution
        const qualityDistribution = this.analyzeQualityDistribution(categories);
        patterns.push({
            type: 'quality_distribution',
            title: 'Quality Score Distribution',
            description: 'Distribution of quality scores across all categories',
            data: qualityDistribution,
            insights: this.generateQualityDistributionInsights(qualityDistribution)
        });
        
        // Pattern 3: File size vs quality relationship
        const sizeQualityRelation = this.analyzeSizeQualityRelation(categories);
        patterns.push({
            type: 'size_quality_relation',
            title: 'Size vs Quality Analysis',
            description: 'Relationship between file size and quality scores',
            data: sizeQualityRelation,
            insights: this.generateSizeQualityInsights(sizeQualityRelation)
        });
        
        return patterns;
    }

    /**
     * Analyze issue patterns
     */
    analyzeIssuePatterns(categories, issues) {
        const issuePatterns = {};
        
        categories.forEach(category => {
            const categoryIssues = issues.filter(issue => 
                category.affectedFiles.some(file => 
                    issue.affectedFiles.includes(file)
                )
            );
            
            issuePatterns[category.category] = {
                category: category.category,
                issueCount: categoryIssues.length,
                issueTypes: [...new Set(categoryIssues.map(issue => issue.type))],
                severityDistribution: this.analyzeSeverityDistribution(categoryIssues),
                averageSeverity: this.calculateAverageSeverity(categoryIssues)
            };
        });
        
        return issuePatterns;
    }

    /**
     * Analyze severity distribution
     */
    analyzeSeverityDistribution(issues) {
        const distribution = { high: 0, medium: 0, low: 0 };
        
        issues.forEach(issue => {
            distribution[issue.severity]++;
        });
        
        return distribution;
    }

    /**
     * Calculate average severity
     */
    calculateAverageSeverity(issues) {
        if (issues.length === 0) return 0;
        
        const severityValues = { high: 3, medium: 2, low: 1 };
        const totalSeverity = issues.reduce((sum, issue) => sum + (severityValues[issue.severity] || 1), 0);
        
        return totalSeverity / issues.length;
    }

    /**
     * Analyze quality distribution
     */
    analyzeQualityDistribution(categories) {
        const scores = categories.map(cat => parseFloat(cat.qualityScore));
        
        const distribution = {
            excellent: scores.filter(s => s >= 90).length,
            good: scores.filter(s => s >= 80 && s < 90).length,
            fair: scores.filter(s => s >= 70 && s < 80).length,
            poor: scores.filter(s => s < 70).length
        };
        
        return distribution;
    }

    /**
     * Analyze size vs quality relationship
     */
    analyzeSizeQualityRelation(categories) {
        return categories.map(cat => ({
            category: cat.category,
            size: parseFloat(cat.totalSize.replace('MB', '')),
            quality: parseFloat(cat.qualityScore),
            ratio: parseFloat(cat.totalSize.replace('MB', '')) / parseFloat(cat.qualityScore),
            efficiency: this.calculateCategoryEfficiency(cat)
        }));
    }

    /**
     * Generate category insights
     */
    generateCategoryInsights(categoryAnalysis) {
        return [
            `${categoryAnalysis.filter(cat => cat.performance >= 80).length} categories have excellent performance`,
            `${categoryAnalysis.filter(cat => cat.efficiency === 'Excellent').length} categories are highly efficient`,
            `Average category performance: ${Math.round(categoryAnalysis.reduce((sum, cat) => sum + cat.performance, 0) / categoryAnalysis.length)}%`,
            `Total files: ${categoryAnalysis.reduce((sum, cat) => sum + cat.fileCount, 0)} across all categories`
        ];
    }

    /**
     * Generate correlation insights
     */
    generateCorrelationInsights(correlations) {
        const insights = [];
        
        Object.entries(correlations).forEach(([pair, correlation]) => {
            const [metric1, metric2] = pair.split('_vs_');
            
            if (Math.abs(correlation) > 0.7) {
                insights.push(`Strong correlation between ${metric1} and ${metric2} (${correlation.toFixed(2)})`);
            } else if (Math.abs(correlation) > 0.5) {
                insights.push(`Moderate correlation between ${metric1} and ${metric2} (${correlation.toFixed(2)})`);
            }
        });
        
        return insights;
    }

    /**
     * Generate pattern insights
     */
    generatePatternInsights(patterns) {
        return patterns.map(pattern => ({
            ...pattern,
            insights: this.getPatternSpecificInsights(pattern)
        }));
    }

    /**
     * Get pattern-specific insights
     */
    getPatternSpecificInsights(pattern) {
        switch (pattern.type) {
            case 'issue_concentration':
                return [
                    `${Object.keys(pattern.data).length} categories have issues`,
                    `High concentration in ${Object.entries(pattern.data).filter(([cat, data]) => data.issueCount > 2).map(([cat, data]) => cat).join(', ')}`,
                    `Average severity: ${(Object.values(pattern.data).reduce((sum, data) => sum + data.averageSeverity, 0) / Object.values(pattern.data).length).toFixed(1)}`
                ];
                
            case 'quality_distribution':
                return [
                    `${pattern.data.excellent} categories have excellent quality scores`,
                    `${pattern.data.good} categories have good quality scores`,
                    `${pattern.data.fair} categories need improvement`,
                    `${pattern.data.poor} categories require immediate attention`
                ];
                
            case 'size_quality_relation':
                const highQuality = pattern.data.filter(item => item.quality >= 90);
                return [
                    `${highQuality.length} categories have high quality scores`,
                    `Average size-to-quality ratio: ${Math.round(pattern.data.reduce((sum, item) => sum + item.ratio, 0) / pattern.data.length)}`,
                    `Best performing: ${pattern.data.reduce((best, item) => item.ratio < best.ratio ? item : best).category}`
                ];
                
            default:
                return ['Pattern analysis completed'];
        }
    }

    /**
     * Generate quality distribution insights
     */
    generateQualityDistributionInsights(distribution) {
        const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        
        return [
            `${distribution.excellent} categories (${Math.round(distribution.excellent / total * 100)}%) have excellent quality`,
            `${distribution.good} categories (${Math.round(distribution.good / total * 100)}%) have good quality`,
            `${distribution.fair} categories (${Math.round(distribution.fair / total * 100)}%) need improvement`,
            `${distribution.poor} categories (${Math.round(distribution.poor / total * 100)} require immediate attention`
        ];
    }

    /**
     * Generate issue pattern insights
     */
    generateIssuePatternInsights(issuePatterns) {
        const insights = [];
        
        Object.entries(issuePatterns).forEach(([category, data]) => {
            if (data.issueCount > 5) {
                insights.push(`${category} has ${data.issueCount} issues requiring attention`);
            }
            
            if (data.averageSeverity > 2) {
                insights.push(`${category} has high severity issues (${data.averageSeverity.toFixed(2)} average severity)`);
            }
            
            const dominantType = data.issueTypes[0];
            if (data.issueTypes.length > 1) {
                insights.push(`${category} primarily has ${data.issueTypes.join(', ')} issues`);
            }
        });
        
        return insights;
    }

    /**
     * Generate predictions
     */
    generatePredictions() {
        const predictions = [];
        
        // Quality trend prediction
        const qualityTrend = this.predictQualityTrend();
        predictions.push({
            type: 'quality_trend',
            title: 'Quality Trend Prediction',
            description: 'Predicted quality score trend for the next 30 days',
            prediction: qualityTrend,
            confidence: this.calculatePredictionConfidence(qualityTrend),
            timeframe: '30 days'
        });
        
        // Issue resolution prediction
        const issueResolution = this.predictIssueResolution();
        predictions.push({
            type: 'issue_resolution',
            title: 'Issue Resolution Timeline',
            description: 'Predicted timeline for resolving current issues',
            prediction: issueResolution,
            confidence: this.calculatePredictionConfidence(issueResolution),
            timeframe: '90 days'
        });
        
        // Performance prediction
        const performancePrediction = this.predictPerformance();
        predictions.push({
            type: 'performance_prediction',
            title: 'Performance Forecast',
            description: 'Predicted system performance metrics',
            prediction: performancePrediction,
            confidence: this.calculatePredictionConfidence(performancePrediction),
            timeframe: '60 days'
        });
        
        return predictions;
    }

    /**
     * Predict quality trend
     */
    predictQualityTrend() {
        const recentData = this.analyticsData.slice(-7); // Last 7 days
        const olderData = this.analyticsData.slice(-30, -23); // Previous 23 days
        
        if (recentData.length < 3 || olderData.length < 3) {
            return 'stable';
        }
        
        const recentAvg = recentData.reduce((sum, point) => sum + point.overallQuality, 0) / recentData.length;
        const olderAvg = olderData.reduce((sum, point) => sum + point.overallQuality, 0) / olderData.length;
        
        if (recentAvg > olderAvg + 2) {
            return 'improving';
        } else if (recentAvg < olderAvg - 2) {
            return 'declining';
        } else {
            return 'stable';
        }
    }

    /**
     * Predict issue resolution timeline
     */
    predictIssueResolution() {
        const issues = this.data.detectedIssues;
        const highPriorityIssues = issues.filter(issue => issue.severity === 'high').length;
        const mediumPriorityIssues = issues.filter(issue => issue.severity === 'medium').length;
        const lowPriorityIssues = issues.filter(issue => issue.severity === 'low').length;
        
        // Estimate resolution time based on priority
        const highPriorityTime = highPriorityIssues * 5; // 5 days per high priority issue
        const mediumPriorityTime = mediumPriority * 3; // 3 days per medium priority issue
        const lowPriorityTime = lowPriorityTime * 1; // 1 day per low priority issue
        
        return {
            totalTime: highPriorityTime + mediumPriorityTime + lowPriorityTime,
            highPriority: highPriorityTime,
            mediumPriority: mediumPriorityTime,
            lowPriority: lowPriorityTime,
            totalIssues: issues.length
        };
    }

    /**
     * Predict performance metrics
     */
    predictPerformance() {
        const currentMetrics = this.performanceMetrics;
        
        // Simulate performance prediction based on current metrics
        const performanceScore = this.calculatePerformanceScore(currentMetrics);
        
        return {
            score: performanceScore,
            analysisSpeed: currentMetrics.analysisSpeed,
            filesPerSecond: currentMetrics.filesProcessedPerSecond,
            memoryUsage: currentMetrics.memoryUsage,
            cpuUsage: currentMetrics.cpuUsage,
            prediction: performanceScore > 80 ? 'Excellent' : performanceScore > 60 ? 'Good' : 'Needs Improvement'
        };
    }

    /**
     * Calculate performance score
     */
    calculatePerformanceScore(metrics) {
        const speedScore = Math.min(100, (metrics.filesProcessedPerSecond / 1000) * 100);
        const memoryScore = metrics.memoryUsage === 'High' ? 90 : metrics.memoryUsage === 'Medium' ? 70 : 50;
        const cpuScore = metrics.cpuUsage === 'Low' ? 90 : metrics.cpuUsage === 'Medium' ? 70 : 50;
        
        return Math.round((speedScore + memoryScore + cpuScore) / 3);
    }

    /**
     * Calculate prediction confidence
     */
    calculatePredictionConfidence(prediction) {
        // Base confidence on data availability and trend consistency
        const dataPoints = this.analyticsData.length;
        const trendConsistency = this.calculateTrendConsistency();
        
        const baseConfidence = Math.min(95, 60 + (dataPoints / 30) * 2);
        const consistencyBonus = trendConsistency * 10;
        
        return Math.min(95, baseConfidence + consistencyBonus);
    }

    /**
     * Calculate trend consistency
     */
    calculateTrendConsistency() {
        if (this.analyticsData.length < 10) return 0.5;
        
        let consistency = 0;
        for (let i = 1; i < this.analyticsData.length; i++) {
            const current = this.analyticsData[i].overallQuality;
            const previous = this.analyticsData[i - 1].overallQuality;
            const change = Math.abs(current - previous);
            
            if (change < 2) consistency++;
        }
        
        return consistency / (this.analyticsData.length - 1);
    }

    /**
     * Render the analytics panel
     */
    renderPanel() {
        if (!this.data) return;

        this.renderOverview();
        this.renderCharts();
        renderInsights();
        renderPredictions();
        
        if (this.options.showTrends) {
            this.animateCharts();
        }
    }

    /**
     * Render overview cards
     */
    renderOverview() {
        const container = document.getElementById('analytics-overview');
        
        const overview = this.calculateOverviewMetrics();
        
        container.textContent = Object.entries(overview).map(([key, value]) => `
            <div class="overview-card">
                <div class="overview-value">${value.value}</div>
                <div class="overview-label">${key}</div>
                <div class="overview-trend">
                    <span class="${value.trend}">${value.trend === 'up' ? '📈' : value.trend === 'down' ? '📉' : '➡️'}</span>
                    <span>${value.change}</span>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Calculate overview metrics
     */
    calculateOverviewMetrics() {
        const qualityMetrics = this.data.qualityMetrics;
        const analysisOverview = this.data.analysisOverview;
        
        const trends = this.calculateTrends();
        
        return {
            'Quality Score': {
                value: qualityMetrics.overallQuality,
                trend: trends.quality,
                change: trends.qualityChange
            },
            'Files Analyzed': {
                value: analysisOverview.totalMockFiles,
                trend: trends.files,
                change: trends.filesChange
            },
            'Data Quality': {
                value: analysisOverview.dataQualityScore,
                trend: trends.quality,
                change: trends.qualityChange
            },
            'Processing Speed': {
                value: analysisOverview.analysisSpeed,
                trend: trends.speed,
                change: trends.speedChange
            }
        };
    }

    /**
     * Calculate trends
     */
    calculateTrends() {
        const recentData = this.analyticsData.slice(-7);
        const olderData = this.analyticsData.slice(-30, -23);
        
        if (recentData.length === 0 || olderData.length === 0) {
            return {
                quality: 'stable',
                files: 'stable',
                speed: 'stable',
                qualityChange: 0,
                filesChange: 0,
                speedChange: 0
            };
        }
        
        const recentQuality = recentData.reduce((sum, point) => sum + point.overallQuality, 0) / recentData.length;
        const olderQuality = olderData.reduce((sum, point) => sum + point.overallQuality, 0) / olderData.length;
        
        const recentFiles = recentData.reduce((sum, point) => sum + point.totalFiles, 0) / recentData.length;
        const olderFiles = olderData.reduce((sum, point) => sum + point.totalFiles, 0) / olderData.length;
        
        const recentSpeed = recentData.reduce((sum, point) => sum + point.filesProcessedPerSecond, 0) / recentData.length;
        const olderSpeed = olderData.reduce((sum, point) => sum + point.filesProcessedPerSecond, 0) / olderData.length;
        
        return {
            quality: recentQuality > olderQuality ? 'up' : recentQuality < olderQuality ? 'down' : 'stable',
            files: recentFiles > olderFiles ? 'up' : recentFiles < olderFiles ? 'down' : 'stable',
            speed: recentSpeed > olderSpeed ? 'up' : recentSpeed < olderSpeed ? 'down' : 'stable',
            qualityChange: Math.round(recentQuality - olderQuality),
            filesChange: Math.round((recentFiles - olderFiles) / olderFiles * 100)
        };
    }

    /**
     * Render charts
     */
    renderCharts() {
        this.renderQualityTrendsChart();
        this.renderPerformanceChart();
    }

    /**
     * Render quality trends chart
     */
    renderQualityTrendsChart() {
        const canvas = document.getElementById('quality-trends-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.clientWidth;
        const height = canvas.height;
        
        const data = this.analyticsData.slice(-30); // Last 30 days
        const padding = 20;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Set canvas size
        canvas.width = width;
        canvas.height = height;
        
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
        
        // Vertical grid lines
        for (let i = 1; i < 5; i++) {
            const x = padding + (i * (width - 2 * padding) / 4);
            ctx.beginPath();
            ctx.lineTo(x, padding);
            ctx.lineTo(x, height - padding);
            ctx.stroke();
        }
        
        // Draw quality trend line
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        data.forEach((point, index) => {
            const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((point.overallQuality / 100) * (height - 2 * padding));
            
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
            const y = height - padding - ((point.overallQuality / 100) * (height - 2 * padding));
            
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    /**
     * Render performance chart
     */
    renderPerformanceChart() {
        const canvas = document.getElementById('performance-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.clientWidth;
        const height = canvas.height;
        
        const metrics = [
            { label: 'Analysis Speed', value: this.performanceMetrics.analysisSpeed, unit: 'files/sec' },
            { label: 'Memory Usage', value: parseFloat(this.performanceMetrics.memoryUsage.replace('MB', '')), unit: 'MB' },
            { label: 'CPU Usage', value: parseFloat(this.performanceMetrics.cpuUsage.replace('%', '')), unit: '%' }
        ];
        
        const padding = 20;
        const barWidth = (width - 2 * padding) / metrics.length - 1;
        const maxValue = Math.max(...metrics.map(m => m.value));
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Set canvas size
        canvas.width = width;
        canvas.height = height;
        
        // Draw bars
        metrics.forEach((metric, index) => {
            const barHeight = (metric.value / maxValue) * (height - 2 * padding);
            const x = padding + index * (barWidth + 10);
            const y = height - padding - barHeight;
            
            // Create gradient based on value
            const colorStops = metric.value >= 80 ? 
                ['#10b981', '#059669'] :
                metric.value >= 60 ? 
                    ['#f59e0b', '#d97706'] :
                    ['#ef4444', '#dc2626'];
            
            const gradient = ctx.createLinearGradient(0, 0, 0, barHeight);
            gradient.addColorStop(0, colorStops[0]);
            gradient.addColorStop(1, colorStops[1]);
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw label
            ctx.fillStyle = '#f8fafc';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(metric.label, x + barWidth / 2, y - 10);
            ctx.fillText(`${metric.value} ${metric.unit}`, x + barWidth / 2, y + 20);
        });
    }

    /**
     * Render insights
     */
    renderInsights() {
        const container = document.getElementById('ai-insights');
        const insights = this.generateDataMiningInsights();
        
        container.textContent = insights.map((insight, index) => `
            <div class="insight-card">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-description">${insight.description}</div>
                <div class="insight-confidence">
                    <span>Confidence: ${Math.round(insight.confidence)}%</span>
                    <div class="confidence-bar">
                        <div class="confidence-fill confidence-${insight.confidence}" style="width: ${insight.confidence}%"></div>
                    </div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Render predictions
     */
    renderPredictions() {
        const container = document.getElementById('prediction-list');
        const predictions = this.generatePredictions();
        
        container.textContent = predictions.map((prediction, index) => `
            <div class="prediction-item">
                <div class="prediction-text">${prediction.title}</div>
                <div class="prediction-description">${prediction.description}</div>
                <span class="prediction-confidence ${prediction.confidence.toLowerCase()}">${prediction.confidence}% confidence</span>
                <span class="prediction-probability">Probability: ${this.calculateProbability(prediction.prediction)}%</span>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Calculate prediction probability
     */
    calculateProbability(prediction) {
        // Simple probability calculation based on confidence score
        return Math.round(prediction.confidence * 0.9 + Math.random() * 10);
    }

    /**
     * Animate charts on load
     */
    animateCharts() {
        setTimeout(() => {
            this.animateProgressBars();
        }, 500);
    }

    /**
     * Animate progress bars
     */
    animateProgressBars() {
        const bars = document.querySelectorAll('.impact-fill');
        bars.forEach((bar, index) => {
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
            if (e.target.classList.contains('control-btn')) {
                this.changeTrendPeriod(e.target);
            }
        });

        // Export buttons
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('export-btn')) {
                const format = e.target.textContent.toLowerCase().includes('csv') ? 'csv' :
                              e.target.textContent.toLowerCase().includes('json') ? 'json' : 'pdf';
                this.exportAnalytics(format);
            }
        });
    }

    /**
     * Change trend period
     */
    changeTrendPeriod(button) {
        // Remove active class from all buttons
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Update chart based on selected period
        const period = button.dataset.period;
        this.updateTrendChart(period);
    }

    /**
     * Update trend chart for selected period
     */
    updateTrendChart(period) {
        const canvas = document.getElementById('quality-trends-chart');
        if (!canvas) return;
        
        let data;
        
        switch (period) {
            case '7d':
                data = this.analyticsData.slice(-7);
                break;
            case '30d':
                data = this.analyticsData.slice(-30);
                break;
            case '90d':
                data = this.analyticsData.slice(-90);
                break;
            default:
                data = this.analyticsData.slice(-7);
        }
        
        this.renderQualityTrendsChart();
    }

    /**
     * Refresh performance metrics
     */
    async refreshPerformanceMetrics() {
        try {
            await this.loadAnalyticsData();
            this.renderPerformanceChart();
            
            this.showNotification('Performance metrics refreshed', 'success');
        } catch (error) {
            console.error('Failed to refresh performance metrics:', error);
            this.showNotification('Failed to refresh performance metrics', 'error');
        }
    }

    /**
     * Run data mining analysis
     */
    async runDataMining() {
        try {
            this.showNotification('Running data mining analysis...', 'info');
            
            // Simulate data mining process
            await this.simulateDataMining();
            
            this.renderInsights();
            
            this.showNotification('Data mining analysis completed', 'success');
        } catch (error) {
            console.error('Failed to run data mining:', error);
            this.showNotification('Data mining failed', 'error');
        }
    }

    /**
     * Simulate data mining process
     */
    async simulateDataMining() {
        return new Promise(resolve => {
            setTimeout(() => {
                this.generateDataMiningInsights();
                resolve();
            }, 3000);
        });
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
     * Start real-time analysis
     */
    startRealTimeAnalysis() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        this.updateTimer = setInterval(async () => {
            try {
                await this.loadAnalyticsData();
                this.renderCharts();
                
                // Update overview
                this.renderOverview();
                
                if (this.options.showTrends) {
                    this.animateCharts();
                }
            } catch (error) {
                console.error('Failed to refresh analytics data:', error);
            }
        }, this.options.updateInterval);
    }

    /**
     * Stop real-time analysis
     */
    stopRealTimeAnalysis() {
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
            <div class="advanced-analytics-panel">
                <div class="error-message">
                    <h3>❌ Error</h3>
                    <p>${message}</p>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Refresh analytics data
     */
    async refresh() {
        await this.loadAnalyticsData();
        this.renderPanel();
    }

    /**
     * Export analytics data
     */
    exportData(format = 'json') {
        if (!this.data) {
            alert('No data to export');
            return;
        }

        const exportData = {
            generatedAt: new Date().toISOString(),
            overview: this.calculateOverviewMetrics(),
            analyticsData: this.analyticsData,
            performanceMetrics: this.performanceMetrics,
            insights: this.generateDataMiningInsights(),
            predictions: this.generatePredictions(),
            rawData: this.data
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `advanced-analytics-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy panel and cleanup
     */
    destroy() {
        this.stopRealTimeAnalysis();
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        const styleElement = document.getElementById('advanced-analytics-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedAnalyticsPanel;
} else if (typeof window !== 'undefined') {
    window.AdvancedAnalyticsPanel = AdvancedAnalyticsPanel;
}
