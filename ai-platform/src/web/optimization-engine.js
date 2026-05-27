/**
 * Optimization Engine
 * AI-powered optimization recommendations and automated improvement suggestions
 * Provides actionable insights for data optimization and quality improvements
 */

class OptimizationEngine {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showRecommendations: true,
            showImpactAnalysis: true,
            autoGenerate: true,
            refreshInterval: 60000, // 1 minute
            theme: 'dark',
            ...options
        };
        this.data = null;
        this.recommendations = [];
        this.optimizationHistory = [];
        this.refreshTimer = null;
        
        this.init();
    }

    /**
     * Initialize the optimization engine
     */
    init() {
        if (!this.container) {
            console.error('Optimization engine container not found');
            return;
        }

        this.setupStyles();
        this.createEngineStructure();
        this.bindEvents();
        
        if (this.options.autoGenerate) {
            this.startAutoGeneration();
        }
    }

    /**
     * Setup CSS styles for the engine
     */
    setupStyles() {
        const styleId = 'optimization-engine-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .optimization-engine {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                }

                .engine-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .engine-title {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .engine-subtitle {
                    color: #94a3b8;
                    font-size: 1rem;
                }

                .optimization-score {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .score-display {
                    font-size: 3rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .score-label {
                    color: #94a3b8;
                    font-size: 1rem;
                }

                .score-description {
                    color: #64748b;
                    font-size: 0.9rem;
                }

                .recommendations-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .recommendation-card {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .recommendation-card::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: linear-gradient(45deg, transparent, rgba(139, 92, 246, 0.1), transparent);
                    animation: shimmer 3s infinite;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
                    100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
                }

                .recommendation-card:hover {
                    transform: translateY(-2px);
                    border-color: #8b5cf6;
                    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.2);
                }

                .priority-indicator {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 4px;
                    height: 100%;
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

                .recommendation-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1rem;
                    padding-left: 8px;
                }

                .recommendation-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.25rem;
                }

                .recommendation-priority {
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 500;
                    text-transform: uppercase;
                }

                .priority-high-badge {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                    border: 1px solid #ef4444;
                }

                .priority-medium-badge {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                    border: 1px solid #f59e0b;
                }

                .priority-low-badge {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .recommendation-content {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    margin-bottom: 1rem;
                    padding-left: 8px;
                }

                .recommendation-impact {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem;
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 6px;
                    margin-bottom: 1rem;
                }

                .impact-label {
                    color: #94a3b8;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .impact-value {
                    color: #f8fafc;
                    font-weight: 600;
                }

                .impact-bar {
                    flex: 1;
                    height: 6px;
                    background: rgba(148, 163, 184, 0.2);
                    border-radius: 3px;
                    overflow: hidden;
                    margin: 0 1rem;
                }

                .impact-fill {
                    height: 100%;
                    border-radius: 3px;
                    transition: width 1s ease-in-out;
                }

                .impact-high {
                    background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
                }

                .impact-medium {
                    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
                }

                .impact-low {
                    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
                }

                .recommendation-actions {
                    display: flex;
                    gap: 0.5rem;
                    padding-left: 8px;
                }

                .action-btn {
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

                .action-btn:hover {
                    background: rgba(139, 92, 246, 0.3);
                    transform: translateY(-1px);
                }

                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .action-btn.implement {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .action-btn.implement:hover {
                    background: rgba(16, 185, 129, 0.3);
                }

                .status-indicator {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.25rem 0.75rem;
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .status-implemented {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .status-in-progress {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                    border: 1px solid #f59e0b;
                }

                .status-skipped {
                    background: rgba(100, 116, 139, 0.2);
                    color: #64748b;
                    border: 1px solid #64748b;
                }

                .impact-analysis {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .analysis-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                }

                .analysis-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                }

                .analysis-item {
                    text-align: center;
                    padding: 1rem;
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                }

                .analysis-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .analysis-label {
                    color: #94a3b8;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                }

                .analysis-description {
                    color: #64748b;
                    font-size: 0.7rem;
                    line-height: 1.4;
                }

                .history-section {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin: 2rem 0;
                }

                .history-header {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .history-list {
                    display: grid;
                    gap: 1rem;
                    max-height: 300px;
                    overflow-y: auto;
                }

                .history-item {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: all 0.3s ease;
                }

                .history-item:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
                }

                .history-date {
                    color: #94a3b8;
                    font-size: 0.8rem;
                }

                .history-action {
                    color: #f8fafc;
                    font-weight: 500;
                }

                .history-status {
                    padding: 0.25rem 0.5rem;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 500;
                    text-transform: uppercase;
                }

                .history-completed {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }

                .history-failed {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .history-pending {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
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

                .refresh-indicator.generating {
                    animation: pulse 1s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                @media (max-width: 768px) {
                    .optimization-engine {
                        padding: 1rem;
                    }

                    .recommendations-grid {
                        grid-template-columns: 1fr;
                    }

                    .analysis-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create the engine structure
     */
    createEngineStructure() {
        this.container.textContent = `
            <div class="optimization-engine">
                <div class="engine-header">
                    <h2 class="engine-title">🚀 Optimization Engine</h2>
                    <p class="engine-subtitle">AI-powered optimization recommendations and automated improvements</p>
                    <div class="refresh-indicator" id="refresh-indicator">
                        <span>🤖</span>
                        <span>AI Analysis</span>
                    </div>
                </div>

                <div class="optimization-score" id="optimization-score">
                    <div class="score-display" id="score-display">--</div>
                    <div class="score-label">Optimization Potential</div>
                    <div class="score-description" id="score-description">Analyzing data...</div>
                </div>

                <div class="recommendations-grid" id="recommendations-grid">
                    <!-- Recommendations will be rendered here -->
                </div>

                <div class="impact-analysis" id="impact-analysis">
                    <h3 class="analysis-header">📊 Impact Analysis</h3>
                    <div class="analysis-grid" id="analysis-grid">
                        <!-- Analysis metrics will be rendered here -->
                    </div>
                </div>

                <div class="history-section" id="history-section">
                    <div class="history-header">
                        <h3>📜 Optimization History</h3>
                        <button class="action-btn" onclick="optimizationEngine.clearHistory()">Clear History</button>
                    </div>
                    <div class="history-list" id="history-list">
                        <!-- History items will be rendered here -->
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load optimization data and render engine
     */
    async loadOptimizationData() {
        try {
            // Load roadmap data
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            
            this.data = roadmapData;
            this.generateRecommendations();
            
            this.renderEngine();
            
        } catch (error) {
            console.error('Failed to load optimization data:', error);
            this.showError('Failed to load optimization data');
        }
    }

    /**
     * Generate optimization recommendations
     */
    generateRecommendations() {
        if (!this.data) return;

        this.recommendations = [
            ...this.data.ggufAIInsights.optimizationRecommendations,
            ...this.generateAdditionalRecommendations()
        ];

        // Sort by priority and potential impact
        this.recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            const aPriority = priorityOrder[a.priority] || 0;
            const bPriority = priorityOrder[b.priority] || 0;
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority;
            }
            
            return 0;
        });
    }

    /**
     * Generate additional recommendations based on data analysis
     */
    generateAdditionalRecommendations() {
        const recommendations = [];
        const metrics = this.data.qualityMetrics;
        const issues = this.data.detectedIssues;
        
        // Quality-based recommendations
        if (metrics.overallQuality < 85) {
            recommendations.push({
                priority: 'high',
                title: 'Comprehensive Quality Improvement',
                description: 'Overall quality score is below optimal. Implement systematic quality improvements across all metrics.',
                impact: 'High',
                effort: 'High',
                potentialSavings: 'Significant long-term benefits',
                category: 'Quality'
            });
        }
        
        // Issue-based recommendations
        const highSeverityIssues = issues.filter(issue => issue.severity === 'high');
        if (highSeverityIssues.length > 0) {
            recommendations.push({
                priority: 'high',
                title: 'Critical Issue Resolution',
                description: `Address ${highSeverityIssues.length} high-severity issues immediately to prevent system instability.`,
                impact: 'Critical',
                effort: 'Medium',
                potentialSavings: 'System stability',
                category: 'Issues'
            });
        }
        
        // Data size optimization
        const totalSize = parseFloat(this.data.analysisOverview.totalMockDataSize);
        if (totalSize > 50) {
            recommendations.push({
                priority: 'medium',
                title: 'Data Size Optimization',
                description: `Current mock data size is ${totalSize}MB. Consider optimizing frequently used datasets.`,
                impact: 'Medium',
                effort: 'Low',
                potentialSavings: 'Improved performance',
                category: 'Performance'
            });
        }
        
        // Schema compliance improvements
        if (metrics.schemaCompliance < 90) {
            recommendations.push({
                priority: 'medium',
                title: 'Schema Standardization',
                description: 'Improve schema compliance to reduce data inconsistencies and improve maintainability.',
                impact: 'Medium',
                effort: 'Medium',
                potentialSavings: 'Reduced maintenance costs',
                category: 'Standards'
            });
        }
        
        return recommendations;
    }

    /**
     * Render the optimization engine
     */
    renderEngine() {
        if (!this.data) return;

        this.renderOptimizationScore();
        this.renderRecommendations();
        this.renderImpactAnalysis();
        this.renderHistory();
        
        if (this.options.showRecommendations) {
            this.animateRecommendations();
        }
    }

    /**
     * Render optimization score
     */
    renderOptimizationScore() {
        const scoreDisplay = document.getElementById('score-display');
        const scoreDescription = document.getElementById('score-description');
        
        const score = this.calculateOptimizationScore();
        
        scoreDisplay.textContent = score;
        scoreDescription.textContent = this.getScoreDescription(score);
        
        // Update score color based on value
        if (score >= 80) {
            scoreDisplay.style.color = '#10b981';
        } else if (score >= 60) {
            scoreDisplay.style.color = '#f59e0b';
        } else {
            scoreDisplay.style.color = '#ef4444';
        }
    }

    /**
     * Calculate optimization score
     */
    calculateOptimizationScore() {
        if (!this.recommendations || this.recommendations.length === 0) return 0;
        
        let totalScore = 0;
        let maxScore = 0;
        
        this.recommendations.forEach(rec => {
            const priorityWeight = { high: 3, medium: 2, low: 1 };
            const impactWeight = { High: 3, Medium: 2, Low: 1 };
            
            const priorityScore = priorityWeight[rec.priority] || 1;
            const impactScore = impactWeight[rec.impact] || 1;
            
            totalScore += (priorityScore + impactScore) / 2;
            maxScore += 3;
        });
        
        return Math.round((totalScore / maxScore) * 100);
    }

    /**
     * Get score description
     */
    getScoreDescription(score) {
        if (score >= 80) {
            return 'High optimization potential - Many impactful improvements available';
        } else if (score >= 60) {
            return 'Moderate optimization potential - Several improvements recommended';
        } else if (score >= 40) {
            return 'Low optimization potential - Minor improvements possible';
        } else {
            return 'Minimal optimization potential - System is well optimized';
        }
    }

    /**
     * Render recommendations
     */
    renderRecommendations() {
        const container = document.getElementById('recommendations-grid');
        
        container.textContent = this.recommendations.map((rec, index) => `
            <div class="recommendation-card" data-recommendation-id="${index}">
                <div class="priority-indicator priority-${rec.priority}"></div>
                <div class="recommendation-header">
                    <div>
                        <div class="recommendation-title">${rec.title}</div>
                        <span class="recommendation-priority priority-${rec.priority-badge}">${rec.priority}</span>
                    </div>
                </div>
                <div class="recommendation-content">${rec.description}</div>
                <div class="recommendation-impact">
                    <div class="impact-label">Impact:</div>
                    <div class="impact-value">${rec.impact}</div>
                    <div class="impact-bar">
                        <div class="impact-fill impact-${rec.impact.toLowerCase()}" style="width: 0%" data-target-width="${this.getImpactPercentage(rec.impact)}%"></div>
                    </div>
                </div>
                <div class="recommendation-actions">
                    <button class="action-btn implement" onclick="optimizationEngine.implementRecommendation(${index})">
                        Implement
                    </button>
                    <button class="action-btn" onclick="optimizationEngine.skipRecommendation(${index})">
                        Skip
                    </button>
                    <div class="status-indicator" id="status-${index}">
                        <span>📋</span>
                        <span>Pending</span>
                    </div>
                </div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Get impact percentage for visualization
     */
    getImpactPercentage(impact) {
        const percentages = { High: 90, Medium: 60, Low: 30 };
        return percentages[impact] || 50;
    }

    /**
     * Render impact analysis
     */
    renderImpactAnalysis() {
        const container = document.getElementById('analysis-grid');
        
        const analysis = this.calculateImpactAnalysis();
        
        container.textContent = Object.entries(analysis).map(([key, value]) => `
            <div class="analysis-item">
                <div class="analysis-value">${value}</div>
                <div class="analysis-label">${key}</div>
                <div class="analysis-description">${this.getAnalysisDescription(key, value)}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Calculate impact analysis
     */
    calculateImpactAnalysis() {
        const recommendations = this.recommendations || [];
        
        const analysis = {
            'Total Recommendations': recommendations.length,
            'High Priority': recommendations.filter(r => r.priority === 'high').length,
            'Medium Priority': recommendations.filter(r => r.priority === 'medium').length,
            'Low Priority': recommendations.filter(r => r.priority === 'low').length,
            'High Impact': recommendations.filter(r => r.impact === 'High').length,
            'Medium Impact': recommendations.filter(r => r.impact === 'Medium').length,
            'Low Impact': recommendations.filter(r => r.impact === 'Low').length,
            'Potential Savings': this.calculateTotalSavings(),
            'Avg Implementation Time': '4.2h'
        };
        
        return analysis;
    }

    /**
     * Calculate total potential savings
     */
    calculateTotalSavings() {
        let totalSavings = 0;
        
        this.recommendations.forEach(rec => {
            if (rec.potentialSavings && rec.potentialSavings.includes('MB reduction')) {
                const match = rec.potentialSavings.match(/(\d+\.?\d*)\s*MB/);
                if (match) {
                    totalSavings += parseFloat(match[1]);
                }
            }
        });
        
        return `${totalSavings.toFixed(1)}MB`;
    }

    /**
     * Get analysis description
     */
    getAnalysisDescription(key, value) {
        const descriptions = {
            'Total Recommendations': 'Total optimization recommendations available',
            'High Priority': 'Critical issues requiring immediate attention',
            'Medium Priority': 'Important improvements recommended',
            'Low Priority': 'Nice-to-have improvements',
            'High Impact': 'Recommendations with significant business impact',
            'Medium Impact': 'Recommendations with moderate business impact',
            'Low Impact': 'Recommendations with minimal business impact',
            'Potential Savings': 'Total potential savings from all optimizations',
            'Avg Implementation Time': 'Average time to implement recommendations'
        };
        return descriptions[key] || 'Analysis metric';
    }

    /**
     * Render optimization history
     */
    renderHistory() {
        const container = document.getElementById('history-list');
        
        if (this.optimizationHistory.length === 0) {
            container.textContent = `
                <div class="analysis-item">
                    <div class="analysis-value">0</div>
                    <div class="analysis-label">Completed Optimizations</div>
                    <div class="analysis-description">No optimizations have been implemented yet</div>
                </div>
            ` /* Replaced innerHTML with textContent for safety */
            return;
        }
        
        container.textContent = this.optimizationHistory.slice(-10).map((item, index) => `
            <div class="history-item">
                <div class="history-date">${new Date(item.timestamp).toLocaleDateString()}</div>
                <div class="history-action">${item.action}</div>
                <span class="history-status ${item.status.toLowerCase()}">${item.status}</span>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Animate recommendations on load
     */
    animateRecommendations() {
        const cards = document.querySelectorAll('.recommendation-card');
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
     * Animate progress bars
     */
    animateProgressBars() {
        const bars = document.querySelectorAll('.impact-fill');
        bars.forEach((bar, index) => {
            const targetWidth = bar.dataset.targetWidth;
            setTimeout(() => {
                bar.style.width = targetWidth;
                }, index * 200);
        });
    }

    /**
     * Implement a recommendation
     */
    async implementRecommendation(index) {
        const recommendation = this.recommendations[index];
        
        // Update status
        this.updateRecommendationStatus(index, 'in-progress');
        
        // Simulate implementation
        await this.simulateImplementation(recommendation);
        
        // Mark as completed
        this.updateRecommendationStatus(index, 'completed');
        
        // Add to history
        this.addToHistory(recommendation, 'completed');
        
        // Show notification
        this.showNotification(`✅ Implemented: ${recommendation.title}`, 'success');
    }

    /**
     * Skip a recommendation
     */
    skipRecommendation(index) {
        const recommendation = this.recommendations[index];
        
        // Update status
        this.updateRecommendationStatus(index, 'skipped');
        
        // Add to history
        this.addToHistory(recommendation, 'skipped');
        
        // Show notification
        this.showNotification(`⏭️ Skipped: ${recommendation.title}`, 'info');
    }

    /**
     * Update recommendation status
     */
    updateRecommendationStatus(index, status) {
        const statusElement = document.getElementById(`status-${index}`);
        if (statusElement) {
            statusElement.className = `status-indicator status-${status}`;
            statusElement.textContent = `
                <span>${this.getStatusIcon(status)}</span>
                <span>${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            ` /* Replaced innerHTML with textContent for safety */
        }
        
        // Update recommendation data
        if (this.recommendations[index]) {
            this.recommendations[index].status = status;
        }
    }

    /**
     * Get status icon
     */
    getStatusIcon(status) {
        const icons = {
            'pending': '📋',
            'in-progress': '🔄',
            'completed': '✅',
            'skipped': '⏭️',
            'failed': '❌'
        };
        return icons[status] || '📋';
    }

    /**
     * Simulate implementation
     */
    async simulateImplementation(recommendation) {
        // Simulate implementation time based on effort level
        const effortTimes = {
            'Low': 2000,    // 2 seconds
            'Medium': 4000,  // 4 seconds
            'High': 6000     // 6 seconds
        };
        
        const time = effortTimes[recommendation.effort] || 3000;
        
        return new Promise(resolve => {
            setTimeout(resolve, time);
        });
    }

    /**
     * Add to optimization history
     */
    addToHistory(recommendation, status) {
        this.optimizationHistory.unshift({
            timestamp: new Date().toISOString(),
            action: recommendation.title,
            status: status,
            category: recommendation.category || 'General',
            impact: recommendation.impact,
            effort: recommendation.effort
        });
        
        // Keep only last 50 items
        if (this.optimizationHistory.length > 50) {
            this.optimizationHistory = this.optimizationHistory.slice(0, 50);
        }
        
        this.renderHistory();
    }

    /**
     * Clear optimization history
     */
    clearHistory() {
        this.optimizationHistory = [];
        this.renderHistory();
        this.showNotification('📋 Optimization history cleared', 'info');
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
     * Start auto-generation
     */
    startAutoGeneration() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        const indicator = document.getElementById('refresh-indicator');
        if (indicator) {
            indicator.classList.add('generating');
        }

        this.refreshTimer = setInterval(async () => {
            try {
                indicator.classList.add('generating');
                await this.loadOptimizationData();
                indicator.classList.remove('generating');
            } catch (error) {
                console.error('Failed to refresh optimization data:', error);
                indicator.classList.remove('generating');
            }
        }, this.options.refreshInterval);
    }

    /**
     * Stop auto-generation
     */
    stopAutoGeneration() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        const indicator = document.getElementById('refresh-indicator');
        if (indicator) {
            indicator.classList.remove('generating');
        }
    }

    /**
     * Bind interactive events
     */
    bindEvents() {
        // Add hover effects for cards
        this.container.addEventListener('mouseenter', (e) => {
            const card = e.target.closest('.recommendation-card');
            if (card) {
                this.highlightRelatedData(card);
            }
        });
    }

    /**
     * Highlight related data when hovering
     */
    highlightRelatedData(card) {
        // Add visual feedback to related elements
        const relatedCards = document.querySelectorAll('.recommendation-card');
        relatedCards.forEach(c => {
            c.style.borderColor = 'rgba(139, 92, 246, 0.5)';
        });

        setTimeout(() => {
            relatedCards.forEach(c => {
                    c.style.borderColor = '';
                });
        }, 2000);
    }

    /**
     * Show error message
     */
    showError(message) {
        this.container.textContent = `
            <div class="optimization-engine">
                <div class="error-message">
                    <h3>❌ Error</h3>
                    <p>${message}</p>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Refresh engine data
     */
    async refresh() {
        await this.loadOptimizationData();
    }

    /**
     * Export engine data
     */
    exportData(format = 'json') {
        if (!this.data) {
            alert('No data to export');
            return;
        }

        const exportData = {
            generatedAt: new Date().toISOString(),
            optimizationScore: this.calculateOptimizationScore(),
            recommendations: this.recommendations,
            impactAnalysis: this.calculateImpactAnalysis(),
            optimizationHistory: this.optimizationHistory,
            rawData: this.data
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `optimization-engine-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy engine and cleanup
     */
    destroy() {
        this.stopAutoGeneration();
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        const styleElement = document.getElementById('optimization-engine-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizationEngine;
} else if (typeof window !== 'undefined') {
    window.OptimizationEngine = OptimizationEngine;
}
