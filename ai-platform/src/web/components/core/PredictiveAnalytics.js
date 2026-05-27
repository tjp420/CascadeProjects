/**
 * Predictive Analytics - Machine learning for trend analysis and predictions
 */

export class PredictiveAnalytics {
    constructor() {
        this.historicalData = [];
        this.models = {
            growth: new GrowthPredictionModel(),
            quality: new QualityPredictionModel(),
            performance: new PerformancePredictionModel(),
            risk: new RiskAssessmentModel()
        };
        this.predictions = new Map();
        this.trends = new Map();
        this.init();
    }

    init() {
        console.log('🤖 Predictive Analytics initialized');
        this.loadHistoricalData();
        this.trainModels();
        this.setupEventListeners();
    }

    loadHistoricalData() {
        // Load historical data from localStorage or API
        const stored = localStorage.getItem('dashboard-historical-data');
        if (stored) {
            try {
                this.historicalData = JSON.parse(stored);
                console.log(`📊 Loaded ${this.historicalData.length} historical data points`);
            } catch (error) {
                console.error('❌ Failed to load historical data:', error);
                // Initialize with empty data instead of mock
                this.historicalData = [];
            }
        } else {
            // Initialize with empty data instead of mock
            this.historicalData = [];
        }
    }

    // Mock historical data generation removed - using real data only

    trainModels() {
        console.log('🧠 Training predictive models...');

        // Train all models with historical data
        Object.values(this.models).forEach(model => {
            model.train(this.historicalData);
        });

        console.log('✅ All models trained successfully');
    }

    setupEventListeners() {
        // Listen for new data events
        document.addEventListener('analysisComplete', (event) => {
            this.onNewAnalysisData(event.detail);
        });

        // Listen for prediction requests
        document.addEventListener('requestPrediction', (event) => {
            this.generatePrediction(event.detail);
        });
    }

    onNewAnalysisData(analysisData) {
        // Add new data point to historical data
        const dataPoint = {
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().getTime(),
            ...analysisData
        };

        this.historicalData.push(dataPoint);

        // Keep only last 90 days
        if (this.historicalData.length > 90) {
            this.historicalData = this.historicalData.slice(-90);
        }

        // Save to localStorage
        localStorage.setItem('dashboard-historical-data', JSON.stringify(this.historicalData));

        // Retrain models with new data
        this.trainModels();

        // Update predictions
        this.updateAllPredictions();
    }

    async generatePrediction(options = {}) {
        const {
            horizon = 30, // days to predict
            confidence = 0.8,
            model = 'all'
        } = options;

        console.log(`🔮 Generating ${horizon}-day prediction with ${confidence} confidence...`);

        const predictions = {};

        if (model === 'all' || model === 'growth') {
            predictions.growth = this.models.growth.predict(this.historicalData, horizon, confidence);
        }

        if (model === 'all' || model === 'quality') {
            predictions.quality = this.models.quality.predict(this.historicalData, horizon, confidence);
        }

        if (model === 'all' || model === 'performance') {
            predictions.performance = this.models.performance.predict(this.historicalData, horizon, confidence);
        }

        if (model === 'all' || model === 'risk') {
            predictions.risk = this.models.risk.assess(this.historicalData, confidence);
        }

        // Cache predictions
        const cacheKey = `prediction_${horizon}_${confidence}_${model}`;
        this.predictions.set(cacheKey, {
            predictions: predictions,
            timestamp: new Date().toISOString(),
            horizon: horizon,
            confidence: confidence,
            model: model
        });

        // Emit prediction event
        document.dispatchEvent(new CustomEvent('predictionGenerated', {
            detail: { predictions, horizon, confidence, model }
        }));

        return predictions;
    }

    updateAllPredictions() {
        // Update predictions for all models
        const horizons = [7, 30, 90]; // 1 week, 1 month, 3 months

        horizons.forEach(horizon => {
            this.generatePrediction({ horizon, model: 'all' });
        });
    }

    getTrends() {
        const trends = {};

        // Calculate trends for each metric
        const metrics = ['totalFiles', 'codeQuality', 'technicalDebt', 'linesOfCode', 'testCoverage', 'codeSmells'];

        metrics.forEach(metric => {
            trends[metric] = this.calculateTrend(this.historicalData, metric);
        });

        this.trends = trends;
        return trends;
    }

    calculateTrend(data, metric) {
        if (data.length < 2) {
            return { trend: 'insufficient_data', confidence: 0 };
        }

        const values = data.map(d => d[metric] || 0);
        const dates = data.map(d => d.timestamp);

        // Calculate linear regression
        const regression = this.linearRegression(dates, values);

        // Determine trend direction
        let trend = 'stable';
        if (regression.slope > 0.1) {
            trend = 'increasing';
        } else if (regression.slope < -0.1) {
            trend = 'decreasing';
        }

        // Calculate confidence based on R²
        const confidence = Math.max(0, Math.min(1, regression.r2));

        return {
            trend: trend,
            slope: regression.slope,
            intercept: regression.intercept,
            r2: regression.r2,
            confidence: confidence,
            dataPoints: data.length
        };
    }

    linearRegression(x, y) {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + x[i] * y[i], 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate R²
        const yMean = sumY / n;
        const yMeanSq = y.reduce((a, b) => a + b * b, 0);
        const ssRes = y.reduce((a, b) => a + Math.pow(b - yMean, 2), 0);
        const ssTot = yMeanSq - n * yMean * yMean;
        const r2 = 1 - (ssRes / ssTot);

        return { slope, intercept, r2 };
    }

    detectAnomalies(data) {
        if (data.length < 10) {
            return [];
        }

        const anomalies = [];
        const thresholds = {
            codeQuality: { min: 30, max: 90 },
            technicalDebt: { min: 0, max: 50 },
            testCoverage: { min: 20, max: 80 },
            codeSmells: { min: 0, max: 10 },
            bugs: { min: 0, max: 5 }
        };

        data.forEach((point, _index) => {
            const anomaliesInPoint = [];

            Object.entries(thresholds).forEach(([metric, threshold]) => {
                const value = point[metric] || 0;
                if (value < threshold.min || value > threshold.max) {
                    anomaliesInPoint.push({
                        metric: metric,
                        value: value,
                        threshold: threshold,
                        severity: this.getAnomalySeverity(value, threshold)
                    });
                }
            });

            if (anomaliesInPoint.length > 0) {
                anomalies.push({
                    date: point.date,
                    anomalies: anomaliesInPoint,
                    severity: this.getMaxSeverity(anomaliesInPoint)
                });
            }
        });

        return anomalies;
    }

    getAnomalySeverity(value, threshold) {
        const deviation = Math.abs(value - threshold.min) / (threshold.max - threshold.min);

        if (deviation > 0.8) {
            return 'critical';
        }
        if (deviation > 0.5) {
            return 'high';
        }
        if (deviation > 0.3) {
            return 'medium';
        }
        return 'low';
    }

    getMaxSeverity(anomalies) {
        const severities = anomalies.map(a => a.severity);
        if (severities.includes('critical')) {
            return 'critical';
        }
        if (severities.includes('high')) {
            return 'high';
        }
        if (severities.includes('medium')) {
            return 'medium';
        }
        return 'low';
    }

    generateInsights() {
        const insights = [];
        const trends = this.getTrends();
        const anomalies = this.detectAnomalies(this.historicalData);
        const latestData = this.historicalData[this.historicalData.length - 1];

        // Trend insights
        Object.entries(trends).forEach(([metric, trend]) => {
            if (trend.confidence > 0.7) {
                let insight = '';

                if (trend.trend === 'increasing') {
                    if (metric === 'codeQuality') {
                        insight = `📈 Code quality is improving (${Math.round(trend.confidence * 100)}% confidence). Consider maintaining current development practices.`;
                    } else if (metric === 'technicalDebt') {
                        insight = `⚠️ Technical debt is increasing (${Math.round(trend.confidence * 100)}% confidence). Review recent changes for maintainability.`;
                    } else if (metric === 'testCoverage') {
                        insight = `📊 Test coverage is improving (${Math.round(trend.confidence * 100)}% confidence). Continue investing in testing infrastructure.`;
                    }
                } else if (trend.trend === 'decreasing') {
                    if (metric === 'technicalDebt') {
                        insight = `✅ Technical debt is decreasing (${Math.round(trend.confidence * 100)}% confidence). Refactoring efforts are paying off.`;
                    } else if (metric === 'bugs') {
                        insight = `✅ Bug count is decreasing (${Math.round(trend.confidence * 100)}% confidence). Quality improvements are effective.`;
                    }
                } else if (trend.trend === 'stable') {
                    insight = `📊 ${metric} is stable (${Math.round(trend.confidence * 100)}% confidence). Monitor for changes.`;
                }

                insights.push({
                    type: 'trend',
                    metric: metric,
                    trend: trend.trend,
                    confidence: trend.confidence,
                    message: insight
                });
            }
        });

        // Anomaly insights
        if (anomalies.length > 0) {
            const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
            if (criticalAnomalies.length > 0) {
                insights.push({
                    type: 'anomaly',
                    severity: 'critical',
                    message: '🚨 Critical anomalies detected in recent data. Immediate attention required.',
                    count: criticalAnomalies.length
                });
            }

            const highAnomalies = anomalies.filter(a => a.severity === 'high');
            if (highAnomalies.length > 0) {
                insights.push({
                    type: 'anomaly',
                    severity: 'high',
                    message: '⚠️ High severity anomalies detected. Review and address soon.',
                    count: highAnomalies.length
                });
            }
        }

        // Performance insights
        if (latestData) {
            const performanceScore = this.calculatePerformanceScore(latestData);

            if (performanceScore < 60) {
                insights.push({
                    type: 'performance',
                    severity: 'medium',
                    message: `📉 Performance score is ${performanceScore}%. Consider optimization strategies.`,
                    score: performanceScore
                });
            } else if (performanceScore > 85) {
                insights.push({
                    type: 'performance',
                    severity: 'low',
                    message: `🚀 Performance score is ${performanceScore}%. Excellent performance maintained.`,
                    score: performanceScore
                });
            }
        }

        return insights;
    }

    calculatePerformanceScore(data) {
        const weights = {
            codeQuality: 0.3,
            technicalDebt: 0.25,
            testCoverage: 0.2,
            codeSmells: 0.15,
            maintainability: 0.1
        };

        let score = 100;

        // Code quality (higher is better)
        score -= (100 - data.codeQuality) * weights.codeQuality;

        // Technical debt (lower is better)
        score += data.technicalDebt * weights.technicalDebt;

        // Test coverage (higher is better)
        score += (data.testCoverage - 50) * weights.testCoverage;

        // Code smells (lower is better)
        score -= data.codeSmells * weights.codeSmells;

        // Maintainability (higher is better)
        score += (data.maintainability - 50) * weights.maintainability;

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    exportPredictions() {
        const exportData = {
            timestamp: new Date().toISOString(),
            historicalData: this.historicalData,
            predictions: Array.from(this.predictions.entries()).map(([key, value]) => ({
                key: key,
                ...value
            })),
            trends: this.getTrends(),
            anomalies: this.detectAnomalies(this.historicalData),
            insights: this.generateInsights(),
            models: Object.keys(this.models).map(key => ({
                name: key,
                accuracy: this.models[key].accuracy || 0
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `predictive-analytics-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('📊 Predictive analytics data exported');
        return exportData;
    }

    getModelAccuracy() {
        const accuracies = {};

        Object.entries(this.models).forEach(([name, model]) => {
            accuracies[name] = model.accuracy || 0;
        });

        return accuracies;
    }

    // Reset all models and data
    reset() {
        this.historicalData = [];
        this.predictions.clear();
        this.trends.clear();

        Object.values(this.models).forEach(model => {
            model.reset();
        });

        localStorage.removeItem('dashboard-historical-data');
        console.log('🔄 Predictive analytics reset');
    }
}

// Base class for prediction models
class PredictionModel {
    constructor() {
        this.accuracy = 0;
        this.trained = false;
    }

    train(data) {
        console.log(`🧠 Training ${this.constructor.name} model...`);
        this.trained = true;
        this.calculateAccuracy(data);
    }

    calculateAccuracy(_data) {
        // Calculate model accuracy based on historical data
        // This is a placeholder - actual implementation would depend on the model type
        this.accuracy = 0.85 + Math.random() * 0.1; // Mock accuracy
    }

    predict(data, horizon, confidence) {
        if (!this.trained) {
            throw new Error('Model not trained');
        }

        // Placeholder prediction logic
        return this.generatePrediction(data, horizon, confidence);
    }

    generatePrediction(_data, _horizon, _confidence) {
        // Override in child classes
        return {};
    }

    reset() {
        this.trained = false;
        this.accuracy = 0;
    }
}

// Growth prediction model
class GrowthPredictionModel extends PredictionModel {
    generatePrediction(data, horizon, confidence) {
        const latestData = data[data.length - 1];
        const growthRate = this.calculateGrowthRate(data);

        const predictions = [];
        let currentFiles = latestData.totalFiles;

        for (let i = 1; i <= horizon; i++) {
            const predictedFiles = currentFiles + (growthRate * i);
            const confidenceFactor = Math.max(0.5, confidence - (i / horizon) * 0.3);

            predictions.push({
                date: this.addDays(new Date(), i),
                predictedFiles: Math.round(predictedFiles),
                confidence: confidenceFactor,
                growthRate: growthRate
            });

            currentFiles = predictedFiles;
        }

        return {
            type: 'growth',
            horizon: horizon,
            confidence: confidence,
            predictions: predictions,
            currentFiles: latestData.totalFiles,
            growthRate: growthRate
        };
    }

    calculateGrowthRate(data) {
        if (data.length < 2) {
            return 0;
        }

        const first = data[0].totalFiles;
        const last = data[data.length - 1].totalFiles;
        const days = (last.timestamp - first.timestamp) / (1000 * 60 * 60 * 24);

        return days > 0 ? (last - first) / days : 0;
    }

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    calculateAccuracy(data) {
        // Calculate accuracy based on how well the model would have predicted past values
        let correct = 0;
        let total = 0;

        for (let i = 1; i < Math.min(data.length, 30); i++) {
            const actual = data[i];
            const previous = data[i - 1];

            const growthRate = this.calculateGrowthRate(data.slice(0, i));
            const predicted = previous.totalFiles + growthRate;

            const error = Math.abs(predicted - actual.totalFiles) / actual.totalFiles;

            if (error < 0.1) { // Within 10% error
                correct++;
            }
            total++;
        }

        this.accuracy = total > 0 ? correct / total : 0;
    }
}

// Quality prediction model
class QualityPredictionModel extends PredictionModel {
    generatePrediction(data, horizon, confidence) {
        const latestData = data[data.length - 1];
        const qualityTrend = this.calculateQualityTrend(data);

        const predictions = [];
        let currentQuality = latestData.codeQuality;

        for (let i = 1; i <= horizon; i++) {
            const predictedQuality = currentQuality + (qualityTrend * i);
            const confidenceFactor = Math.max(0.5, confidence - (i / horizon) * 0.3);

            predictions.push({
                date: this.addDays(new Date(), i),
                predictedQuality: Math.min(100, Math.max(0, Math.round(predictedQuality))),
                confidence: confidenceFactor,
                qualityTrend: qualityTrend
            });

            currentQuality = predictedQuality;
        }

        return {
            type: 'quality',
            horizon: horizon,
            confidence: confidence,
            predictions: predictions,
            currentQuality: latestData.codeQuality,
            qualityTrend: qualityTrend
        };
    }

    calculateQualityTrend(data) {
        if (data.length < 2) {
            return 0;
        }

        const first = data[0].codeQuality;
        const last = data[data.length - 1].codeQuality;
        const days = (last.timestamp - first.timestamp) / (1000 * 60 * 60 * 24);

        return days > 0 ? (last - first) / days : 0;
    }

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    calculateAccuracy(data) {
        let correct = 0;
        let total = 0;

        for (let i = 1; i < Math.min(data.length, 30); i++) {
            const actual = data[i];
            const previous = data[i - 1];

            const qualityTrend = this.calculateQualityTrend(data.slice(0, i));
            const predicted = previous.codeQuality + qualityTrend;

            const error = Math.abs(predicted - actual.codeQuality);

            if (error < 5) { // Within 5 percentage points
                correct++;
            }
            total++;
        }

        this.accuracy = total > 0 ? correct / total : 0;
    }
}

// Performance prediction model
class PerformancePredictionModel extends PredictionModel {
    generatePrediction(data, horizon, confidence) {
        const latestData = data[data.length - 1];
        const performanceScore = this.calculatePerformanceScore(latestData);
        const performanceTrend = this.calculatePerformanceTrend(data);

        const predictions = [];
        let currentScore = performanceScore;

        for (let i = 1; i <= horizon; i++) {
            const predictedScore = currentScore + (performanceTrend * i);
            const confidenceFactor = Math.max(0.5, confidence - (i / horizon) * 0.3);

            predictions.push({
                date: this.addDays(new Date(), i),
                predictedScore: Math.min(100, Math.max(0, Math.round(predictedScore))),
                confidence: confidenceFactor,
                performanceTrend: performanceTrend,
                components: this.predictComponents(currentScore + (performanceTrend * i))
            });

            currentScore = predictedScore;
        }

        return {
            type: 'performance',
            horizon: horizon,
            confidence: confidence,
            predictions: predictions,
            currentScore: performanceScore,
            performanceTrend: performanceTrend
        };
    }

    calculatePerformanceScore(data) {
        const weights = {
            codeQuality: 0.3,
            technicalDebt: 0.25,
            testCoverage: 0.2,
            codeSmells: 0.15,
            maintainability: 0.1
        };

        let score = 100;

        score -= (100 - data.codeQuality) * weights.codeQuality;
        score += data.technicalDebt * weights.technicalDebt;
        score += (data.testCoverage - 50) * weights.testCoverage;
        score -= data.codeSmells * weights.codeSmells;
        score += (data.maintainability - 50) * weights.maintainability;

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    calculatePerformanceTrend(data) {
        if (data.length < 2) {
            return 0;
        }

        const scores = data.map(d => this.calculatePerformanceScore(d));
        const first = scores[0];
        const last = scores[scores.length - 1];
        const days = (data[data.length - 1].timestamp - data[0].timestamp) / (1000 * 60 * 60 * 24);

        return days > 0 ? (last - first) / days : 0;
    }

    predictComponents(score) {
        const components = {
            codeQuality: score >= 70 ? 'excellent' : score >= 50 ? 'good' : 'needs_improvement',
            technicalDebt: score >= 70 ? 'low' : score >= 50 ? 'moderate' : 'high',
            testCoverage: score >= 70 ? 'excellent' : score >= 50 ? 'good' : 'needs_improvement',
            maintainability: score >= 70 ? 'excellent' : score >= 50 ? 'good' : 'needs_improvement'
        };

        return components;
    }

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    calculateAccuracy(data) {
        let correct = 0;
        let total = 0;

        for (let i = 1; i < Math.min(data.length, 30); i++) {
            const actual = data[i];
            const previous = data[i - 1];

            const actualScore = this.calculatePerformanceScore(actual);
            const previousScore = this.calculatePerformanceScore(previous);
            const trend = this.calculatePerformanceTrend(data.slice(0, i));
            const predictedScore = previousScore + trend;

            const error = Math.abs(predictedScore - actualScore);

            if (error < 10) { // Within 10 percentage points
                correct++;
            }
            total++;
        }

        this.accuracy = total > 0 ? correct / total : 0;
    }
}

// Risk assessment model
class RiskAssessmentModel extends PredictionModel {
    assess(data, confidence) {
        const risks = [];

        // Assess various risk factors
        risks.push(this.assessTechnicalDebtRisk(data, confidence));
        risks.push(this.assessQualityRisk(data, confidence));
        risks.push(this.assessComplexityRisk(data, confidence));
        risks.push(this.assessDependencyRisk(data, confidence));
        risks.push(this.assessTestCoverageRisk(data, confidence));

        // Calculate overall risk score
        const riskScore = this.calculateOverallRisk(risks);

        return {
            type: 'risk',
            confidence: confidence,
            risks: risks,
            overallRisk: riskScore,
            recommendations: this.generateRiskRecommendations(risks)
        };
    }

    assessTechnicalDebtRisk(data, confidence) {
        const debt = data.technicalDebt || 0;
        let risk = 'low';

        if (debt > 50) {
            risk = 'high';
        } else if (debt > 30) {
            risk = 'medium';
        }

        return {
            type: 'technical_debt',
            risk: risk,
            value: debt,
            confidence: confidence
        };
    }

    assessQualityRisk(data, confidence) {
        const quality = data.codeQuality || 0;
        let risk = 'low';

        if (quality < 40) {
            risk = 'high';
        } else if (quality < 60) {
            risk = 'medium';
        }

        return {
            type: 'quality',
            risk: risk,
            value: quality,
            confidence: confidence
        };
    }

    assessComplexityRisk(data, confidence) {
        const complexity = data.complexity || 5;
        let risk = 'low';

        if (complexity > 8) {
            risk = 'high';
        } else if (complexity > 6) {
            risk = 'medium';
        }

        return {
            type: 'complexity',
            risk: risk,
            value: complexity,
            confidence: confidence
        };
    }

    assessDependencyRisk(data, confidence) {
        const dependencies = data.dependencies || 20;
        let risk = 'low';

        if (dependencies > 50) {
            risk = 'high';
        } else if (dependencies > 30) {
            risk = 'medium';
        }

        return {
            type: 'dependencies',
            risk: risk,
            value: dependencies,
            confidence: confidence
        };
    }

    assessTestCoverageRisk(data, confidence) {
        const coverage = data.testCoverage || 0;
        let risk = 'high';

        if (coverage > 70) {
            risk = 'low';
        } else if (coverage > 50) {
            risk = 'medium';
        }

        return {
            type: 'test_coverage',
            risk: risk,
            value: coverage,
            confidence: confidence
        };
    }

    calculateOverallRisk(risks) {
        const riskScores = {
            low: 1,
            medium: 2,
            high: 3
        };

        const totalRisk = risks.reduce((sum, risk) => sum + riskScores[risk.risk], 0);
        const averageRisk = totalRisk / risks.length;

        return averageRisk;
    }

    generateRiskRecommendations(risks) {
        const recommendations = [];

        risks.forEach(risk => {
            switch (risk.type) {
            case 'technical_debt':
                if (risk.risk === 'high') {
                    recommendations.push('Prioritize refactoring to reduce technical debt');
                } else if (risk.risk === 'medium') {
                    recommendations.push('Schedule regular refactoring sessions');
                }
                break;
            case 'quality':
                if (risk.risk === 'high') {
                    recommendations.push('Implement code quality improvement initiatives');
                } else if (risk.risk === 'medium') {
                    recommendations.push('Enhance code review processes');
                }
                break;
            case 'complexity':
                if (risk.risk === 'high') {
                    recommendations.push('Simplify complex code structures');
                } else if (risk.risk === 'medium') {
                    recommendations.push('Add documentation for complex areas');
                }
                break;
            case 'dependencies':
                if (risk.risk === 'high') {
                    recommendations.push('Review and reduce coupling');
                } else if (risk.risk === 'medium') {
                    recommendations.push('Document dependency relationships');
                }
                break;
            case 'test_coverage':
                if (risk.risk === 'high') {
                    recommendations.push('Increase test coverage significantly');
                } else if (risk.risk === 'medium') {
                    recommendations.push('Expand test suite');
                }
                break;
            }
        });

        return recommendations;
    }
}

// Export for use in dashboard
window.PredictiveAnalytics = PredictiveAnalytics;
window.GrowthPredictionModel = GrowthPredictionModel;
window.QualityPredictionModel = QualityPredictionModel;
window.PerformancePredictionModel = PerformancePredictionModel;
window.RiskAssessmentModel = RiskAssessmentModel;
