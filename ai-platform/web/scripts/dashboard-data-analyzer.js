// Dashboard Data Analyzer - Enhanced JSON Parser and Analysis Engine
console.log('📊 Dashboard Data Analyzer loading...');

class DashboardDataAnalyzer {
    constructor() {
        this.currentData = null;
        this.historicalData = [];
        this.benchmarks = this.initializeBenchmarks();
        this.alerts = [];
    }

    initializeBenchmarks() {
        return {
            performance: {
                excellent: 90,
                good: 80,
                acceptable: 70,
                poor: 60,
            },
            responseTime: {
                excellent: 200,
                good: 300,
                acceptable: 400,
                poor: 500,
            },
            errorRate: {
                excellent: 0.01,
                good: 0.05,
                acceptable: 0.1,
                poor: 0.5,
            },
            complexityPerFile: {
                excellent: 20,
                good: 35,
                acceptable: 50,
                poor: 75,
            },
        };
    }

    parseDashboardExport(jsonData) {
        try {
            this.currentData = jsonData;
            const analysis = this.performComprehensiveAnalysis();
            this.checkAlerts();
            return analysis;
        } catch (error) {
            console.error('Error parsing dashboard data:', error);
            throw new Error('Failed to parse dashboard export data');
        }
    }

    performComprehensiveAnalysis() {
        const data = this.currentData;

        return {
            overview: this.analyzeOverview(data.overview),
            technicalDebt: this.analyzeTechnicalDebt(data.technicalDebt),
            performance: this.analyzePerformance(data.performance),
            backup: this.analyzeBackup(data.backup),
            healthScore: this.calculateOverallHealthScore(data),
            recommendations: this.generateRecommendations(data),
            trends: this.analyzeTrends(),
            alerts: this.alerts,
        };
    }

    analyzeOverview(overview) {
        const complexityPerFile = overview.totalComplexity / overview.totalFiles;
        const complexityGrade = this.gradeMetric(complexityPerFile, this.benchmarks.complexityPerFile);

        return {
            totalFiles: overview.totalFiles,
            totalComplexity: overview.totalComplexity,
            performance: overview.performance,
            complexityPerFile: Math.round(complexityPerFile * 10) / 10,
            complexityGrade: complexityGrade,
            fileComplexityDistribution: this.calculateComplexityDistribution(overview),
            systemScale: this.categorizeSystemScale(overview.totalFiles),
        };
    }

    analyzeTechnicalDebt(technicalDebt) {
        const total = technicalDebt.high + technicalDebt.medium + technicalDebt.low;
        const highPriorityRatio = (technicalDebt.high / total) * 100;
        const debtDensity = total / this.currentData.overview.totalFiles;

        return {
            ...technicalDebt,
            total: total,
            highPriorityRatio: Math.round(highPriorityRatio * 10) / 10,
            debtDensity: Math.round(debtDensity * 100) / 100,
            urgency: this.calculateDebtUrgency(technicalDebt),
            estimatedRemediationTime: this.estimateRemediationTime(technicalDebt),
            riskLevel: this.assessDebtRisk(technicalDebt),
        };
    }

    analyzePerformance(performance) {
        const responseTimeGrade = this.gradeMetric(
            performance.responseTime,
            this.benchmarks.responseTime,
            true
        );
        const errorRateGrade = this.gradeMetric(performance.errorRate, this.benchmarks.errorRate, true);
        const throughputScore = this.calculateThroughputScore(performance.throughput);

        return {
            responseTime: performance.responseTime,
            throughput: performance.throughput,
            errorRate: performance.errorRate,
            responseTimeGrade: responseTimeGrade,
            errorRateGrade: errorRateGrade,
            throughputScore: throughputScore,
            efficiency: this.calculatePerformanceEfficiency(performance),
            slaCompliance: this.checkSLACompliance(performance),
        };
    }

    analyzeBackup(backup) {
        const lastBackupDate = new Date(backup.lastBackup);
        const now = new Date();
        const hoursSinceBackup = (now - lastBackupDate) / (1000 * 60 * 60);
        const backupHealth = this.assessBackupHealth(hoursSinceBackup, backup.totalBackups);

        return {
            lastBackup: backup.lastBackup,
            totalBackups: backup.totalBackups,
            hoursSinceLastBackup: Math.round(hoursSinceBackup * 10) / 10,
            backupFrequency: this.calculateBackupFrequency(backup.totalBackups),
            backupHealth: backupHealth,
            backupReliability: this.calculateBackupReliability(backup),
        };
    }

    calculateOverallHealthScore(data) {
        const performanceScore = data.overview.performance;
        const complexityScore = Math.max(0, 100 - (data.overview.complexityPerFile / 75) * 100);
        const debtScore = Math.max(0, 100 - (data.technicalDebt.total / 100) * 100);
        const performanceMetricsScore = this.calculatePerformanceMetricsScore(data.performance);

        const weights = {
            performance: 0.3,
            complexity: 0.25,
            technicalDebt: 0.25,
            performanceMetrics: 0.2,
        };

        const overallScore =
      performanceScore * weights.performance +
      complexityScore * weights.complexity +
      debtScore * weights.technicalDebt +
      performanceMetricsScore * weights.performanceMetrics;

        return {
            score: Math.round(overallScore * 10) / 10,
            grade: this.getHealthGrade(overallScore),
            components: {
                performance: performanceScore,
                complexity: complexityScore,
                technicalDebt: debtScore,
                performanceMetrics: performanceMetricsScore,
            },
        };
    }

    generateRecommendations(data) {
        const recommendations = [];

        // Performance recommendations
        if (data.performance.responseTime > 300) {
            recommendations.push({
                priority: 'high',
                category: 'performance',
                title: 'Optimize Response Time',
                description: `Current response time of ${data.performance.responseTime}ms exceeds the 300ms target`,
                impact: 'high',
                effort: 'medium',
                estimatedImprovement: '15-25% performance increase',
            });
        }

        // Technical debt recommendations
        if (data.technicalDebt.high > 10) {
            recommendations.push({
                priority: 'critical',
                category: 'technical-debt',
                title: 'Address High-Priority Technical Debt',
                description: `${data.technicalDebt.high} high-priority issues require immediate attention`,
                impact: 'high',
                effort: 'high',
                estimatedImprovement: 'Significant reduction in maintenance costs',
            });
        }

        // Complexity recommendations
        if (data.overview.complexityPerFile > 50) {
            recommendations.push({
                priority: 'medium',
                category: 'complexity',
                title: 'Reduce Code Complexity',
                description: `Average complexity of ${data.overview.complexityPerFile} per file is above recommended levels`,
                impact: 'medium',
                effort: 'medium',
                estimatedImprovement: 'Improved maintainability and developer productivity',
            });
        }

        // Backup recommendations
        if (data.backup.hoursSinceLastBackup > 24) {
            recommendations.push({
                priority: 'high',
                category: 'backup',
                title: 'Improve Backup Frequency',
                description: `Last backup was ${Math.round(data.backup.hoursSinceLastBackup)} hours ago`,
                impact: 'medium',
                effort: 'low',
                estimatedImprovement: 'Enhanced data protection and recovery capabilities',
            });
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    analyzeTrends() {
        if (this.historicalData.length < 2) {
            return {
                status: 'insufficient_data',
                message: 'Need at least 2 data points for trend analysis',
            };
        }

        const latest = this.currentData;
        const previous = this.historicalData[this.historicalData.length - 2];

        return {
            performance: this.calculateTrend(previous.overview.performance, latest.overview.performance),
            complexity: this.calculateTrend(
                previous.overview.totalComplexity,
                latest.overview.totalComplexity
            ),
            technicalDebt: this.calculateTrend(previous.technicalDebt.total, latest.technicalDebt.total),
            responseTime: this.calculateTrend(
                previous.performance.responseTime,
                latest.performance.responseTime
            ),
            errorRate: this.calculateTrend(
                previous.performance.errorRate * 100,
                latest.performance.errorRate * 100
            ),
        };
    }

    checkAlerts() {
        this.alerts = [];
        const data = this.currentData;

        // Critical alerts
        if (data.performance.responseTime > 500) {
            this.alerts.push({
                level: 'critical',
                type: 'performance',
                message: `Critical: Response time (${data.performance.responseTime}ms) exceeds acceptable limits`,
                threshold: 500,
                currentValue: data.performance.responseTime,
            });
        }

        if (data.performance.errorRate > 0.1) {
            this.alerts.push({
                level: 'critical',
                type: 'reliability',
                message: `Critical: Error rate (${(data.performance.errorRate * 100).toFixed(2)}%) exceeds SLA`,
                threshold: 0.1,
                currentValue: data.performance.errorRate,
            });
        }

        // Warning alerts
        if (data.technicalDebt.high > 20) {
            this.alerts.push({
                level: 'warning',
                type: 'technical-debt',
                message: `Warning: High number of high-priority technical debt issues (${data.technicalDebt.high})`,
                threshold: 20,
                currentValue: data.technicalDebt.high,
            });
        }

        if (data.backup.hoursSinceLastBackup > 48) {
            this.alerts.push({
                level: 'warning',
                type: 'backup',
                message: `Warning: Backup is ${Math.round(data.backup.hoursSinceLastBackup)} hours old`,
                threshold: 48,
                currentValue: data.backup.hoursSinceLastBackup,
            });
        }
    }

    // Helper methods
    gradeMetric(value, benchmarks, lowerIsBetter = false) {
        if (lowerIsBetter) {
            if (value <= benchmarks.excellent) {
                return 'A+';
            }
            if (value <= benchmarks.good) {
                return 'A';
            }
            if (value <= benchmarks.acceptable) {
                return 'B';
            }
            if (value <= benchmarks.poor) {
                return 'C';
            }
            return 'D';
        } else {
            if (value >= benchmarks.excellent) {
                return 'A+';
            }
            if (value >= benchmarks.good) {
                return 'A';
            }
            if (value >= benchmarks.acceptable) {
                return 'B';
            }
            if (value >= benchmarks.poor) {
                return 'C';
            }
            return 'D';
        }
    }

    calculateComplexityDistribution(overview) {
    // Simulate complexity distribution based on total
        const total = overview.totalComplexity;
        return {
            simple: Math.round(total * 0.2),
            moderate: Math.round(total * 0.5),
            complex: Math.round(total * 0.25),
            veryComplex: Math.round(total * 0.05),
        };
    }

    categorizeSystemScale(totalFiles) {
        if (totalFiles < 100) {
            return 'small';
        }
        if (totalFiles < 1000) {
            return 'medium';
        }
        if (totalFiles < 5000) {
            return 'large';
        }
        return 'enterprise';
    }

    calculateDebtUrgency(technicalDebt) {
        const highWeight = technicalDebt.high * 3;
        const mediumWeight = technicalDebt.medium * 2;
        const lowWeight = technicalDebt.low * 1;
        const totalWeight = highWeight + mediumWeight + lowWeight;

        if (totalWeight > 100) {
            return 'critical';
        }
        if (totalWeight > 50) {
            return 'high';
        }
        if (totalWeight > 20) {
            return 'medium';
        }
        return 'low';
    }

    estimateRemediationTime(technicalDebt) {
        const highHours = technicalDebt.high * 8;
        const mediumHours = technicalDebt.medium * 4;
        const lowHours = technicalDebt.low * 2;
        const totalHours = highHours + mediumHours + lowHours;

        return {
            totalHours: totalHours,
            totalDays: Math.round(totalHours / 8),
            teamWeeks: Math.round(totalHours / (8 * 40 * 3)), // Assuming 3 team members
            breakdown: {
                high: highHours,
                medium: mediumHours,
                low: lowHours,
            },
        };
    }

    assessDebtRisk(technicalDebt) {
        const highRatio =
      technicalDebt.high / (technicalDebt.high + technicalDebt.medium + technicalDebt.low);
        if (highRatio > 0.3) {
            return 'high';
        }
        if (highRatio > 0.15) {
            return 'medium';
        }
        return 'low';
    }

    calculateThroughputScore(throughput) {
        if (throughput >= 2000) {
            return 100;
        }
        if (throughput >= 1500) {
            return 90;
        }
        if (throughput >= 1000) {
            return 80;
        }
        if (throughput >= 500) {
            return 70;
        }
        return 60;
    }

    calculatePerformanceEfficiency(performance) {
        const responseTimeScore = Math.max(0, 100 - (performance.responseTime / 500) * 100);
        const errorRateScore = Math.max(0, 100 - performance.errorRate * 10000);
        const throughputScore = this.calculateThroughputScore(performance.throughput);

        return Math.round((responseTimeScore + errorRateScore + throughputScore) / 3);
    }

    checkSLACompliance(performance) {
        return {
            responseTime: performance.responseTime <= 300,
            errorRate: performance.errorRate <= 0.001,
            throughput: performance.throughput >= 1000,
            overall:
        performance.responseTime <= 300 &&
        performance.errorRate <= 0.001 &&
        performance.throughput >= 1000,
        };
    }

    assessBackupHealth(hoursSinceBackup, totalBackups) {
        if (hoursSinceBackup <= 24 && totalBackups >= 30) {
            return 'excellent';
        }
        if (hoursSinceBackup <= 48 && totalBackups >= 20) {
            return 'good';
        }
        if (hoursSinceBackup <= 72 && totalBackups >= 10) {
            return 'acceptable';
        }
        return 'poor';
    }

    calculateBackupFrequency(totalBackups) {
    // Assuming 30-day period
        return Math.round((totalBackups / 30) * 10) / 10;
    }

    calculateBackupReliability(backup) {
    // Simplified reliability calculation
        const frequencyScore = Math.min(100, (backup.totalBackups / 30) * 100);
        const recencyScore = Math.max(0, 100 - (backup.hoursSinceLastBackup / 72) * 100);
        return Math.round((frequencyScore + recencyScore) / 2);
    }

    calculatePerformanceMetricsScore(performance) {
        const responseTimeScore = Math.max(0, 100 - (performance.responseTime / 500) * 100);
        const errorRateScore = Math.max(0, 100 - performance.errorRate * 10000);
        const throughputScore = this.calculateThroughputScore(performance.throughput);

        return Math.round(responseTimeScore * 0.4 + errorRateScore * 0.4 + throughputScore * 0.2);
    }

    getHealthGrade(score) {
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

    calculateTrend(previous, current) {
        const change = ((current - previous) / previous) * 100;
        const direction = change > 0 ? 'improving' : change < 0 ? 'declining' : 'stable';
        const magnitude = Math.abs(change);

        return {
            direction: direction,
            change: Math.round(change * 10) / 10,
            magnitude: magnitude > 10 ? 'significant' : magnitude > 5 ? 'moderate' : 'minor',
            previous: previous,
            current: current,
        };
    }

    // Store historical data
    storeHistoricalData() {
        if (this.currentData) {
            this.historicalData.push({
                ...this.currentData,
                timestamp: new Date().toISOString(),
            });

            // Keep only last 30 entries
            if (this.historicalData.length > 30) {
                this.historicalData.shift();
            }
        }
    }

    // Export analysis results
    exportAnalysis(format = 'json') {
        const analysis = this.performComprehensiveAnalysis();

        switch (format) {
        case 'json':
            return JSON.stringify(analysis, null, 2);
        case 'csv':
            return this.convertToCSV(analysis);
        case 'html':
            return this.convertToHTML(analysis);
        default:
            return analysis;
        }
    }

    convertToCSV(analysis) {
    // Convert key metrics to CSV format
        const headers = ['Metric', 'Current Value', 'Target', 'Status', 'Trend'];
        const rows = [
            ['Performance Score', analysis.overview.performance, '90', analysis.healthScore.grade, '-'],
            [
                'Complexity Per File',
                analysis.overview.complexityPerFile,
                '<35',
                analysis.overview.complexityGrade,
                '-',
            ],
            [
                'Response Time (ms)',
                analysis.performance.responseTime,
                '<300',
                analysis.performance.responseTimeGrade,
                '-',
            ],
            [
                'Error Rate (%)',
                (analysis.performance.errorRate * 100).toFixed(2),
                '<0.1',
                analysis.performance.errorRateGrade,
                '-',
            ],
            ['Technical Debt Total', analysis.technicalDebt.total, '<50', '-', '-'],
            ['High Priority Issues', analysis.technicalDebt.high, '<10', '-', '-'],
        ];

        return [headers, ...rows].map((row) => row.join(',')).join('\n');
    }

    convertToHTML(analysis) {
        return `
        <div class="dashboard-analysis">
            <h2>Dashboard Analysis Report</h2>
            <div class="health-score">
                <h3>Overall Health Score: ${analysis.healthScore.score}/100 (${analysis.healthScore.grade})</h3>
            </div>
            <div class="alerts">
                ${analysis.alerts
        .map(
            (alert) => `
                    <div class="alert alert-${alert.level}">
                        <strong>${alert.level.toUpperCase()}:</strong> ${alert.message}
                    </div>
                `
        )
        .join('')}
            </div>
            <div class="recommendations">
                <h3>Recommendations</h3>
                ${analysis.recommendations
        .map(
            (rec) => `
                    <div class="recommendation priority-${rec.priority}">
                        <h4>${rec.title}</h4>
                        <p>${rec.description}</p>
                        <small>Priority: ${rec.priority} | Impact: ${rec.impact} | Effort: ${rec.effort}</small>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
        `;
    }
}

// Global analyzer instance
window.dashboardAnalyzer = new DashboardDataAnalyzer();

console.log('✅ Dashboard Data Analyzer loaded');
