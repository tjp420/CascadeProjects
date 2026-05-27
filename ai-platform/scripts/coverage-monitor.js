
/**
 * Real-time Coverage Monitor
 * Sprint 3 Test Coverage Enhancement - Automated Monitoring System
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CoverageMonitor {
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = projectRoot;
        this.coverageDir = path.join(projectRoot, 'coverage');
        this.resultsDir = path.join(projectRoot, 'coverage-results');
        this.monitoringData = {
            timestamp: new Date().toISOString(),
            coverage: {},
            trends: [],
            alerts: [],
            recommendations: []
        };
        
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    async runCoverageAnalysis() {
        console.log('🔍 Starting coverage analysis...');
        
        try {
            // Run Jest with coverage
            console.log('📊 Running Jest coverage analysis...');
            const jestOutput = execSync('npm run test:coverage', { 
                encoding: 'utf8',
                cwd: this.projectRoot,
                stdio: 'pipe'
            });
            
            // Parse coverage results
            const coverageData = await this.parseCoverageResults();
            
            // Analyze trends
            const trendAnalysis = await this.analyzeTrends(coverageData);
            
            // Generate alerts
            const alerts = this.generateAlerts(coverageData, trendAnalysis);
            
            // Create recommendations
            const recommendations = this.generateRecommendations(coverageData, alerts);
            
            // Compile monitoring data
            this.monitoringData = {
                timestamp: new Date().toISOString(),
                coverage: coverageData,
                trends: trendAnalysis,
                alerts: alerts,
                recommendations: recommendations
            };
            
            // Save results
            await this.saveMonitoringResults();
            
            // Generate report
            await this.generateReport();
            
            console.log('✅ Coverage analysis completed successfully');
            return this.monitoringData;
            
        } catch (error) {
            console.error('❌ Coverage analysis failed:', error.message);
            throw error;
        }
    }

    async parseCoverageResults() {
        const coverageFile = path.join(this.coverageDir, 'coverage-final.json');
        
        if (!fs.existsSync(coverageFile)) {
            throw new Error('Coverage results file not found');
        }
        
        const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
        
        return {
            total: {
                lines: coverageData.total?.lines?.pct || 0,
                functions: coverageData.total?.functions?.pct || 0,
                branches: coverageData.total?.branches?.pct || 0,
                statements: coverageData.total?.statements?.pct || 0
            },
            files: this.processFileCoverage(coverageData),
            summary: this.generateCoverageSummary(coverageData)
        };
    }

    processFileCoverage(coverageData) {
        const files = {};
        
        for (const [filename, data] of Object.entries(coverageData)) {
            if (filename === 'total') {
continue;
}
            
            files[filename] = {
                lines: data.lines?.pct || 0,
                functions: data.functions?.pct || 0,
                branches: data.branches?.pct || 0,
                statements: data.statements?.pct || 0,
                uncoveredLines: data.lines?.details ? 
                    Object.keys(data.lines.details).filter(line => !data.lines.details[line]) : [],
                totalLines: data.lines?.total || 0
            };
        }
        
        return files;
    }

    generateCoverageSummary(coverageData) {
        const files = Object.keys(coverageData).filter(key => key !== 'total');
        const fileCount = files.length;
        
        let highCoverage = 0;
        let mediumCoverage = 0;
        let lowCoverage = 0;
        
        for (const filename of files) {
            const fileData = coverageData[filename];
            const lineCoverage = fileData.lines?.pct || 0;
            
            if (lineCoverage >= 80) {
highCoverage++;
} else if (lineCoverage >= 60) {
mediumCoverage++;
} else {
lowCoverage++;
}
        }
        
        return {
            totalFiles: fileCount,
            highCoverageFiles: highCoverage,
            mediumCoverageFiles: mediumCoverage,
            lowCoverageFiles: lowCoverage,
            averageCoverage: files.reduce((sum, file) => 
                sum + (coverageData[file].lines?.pct || 0), 0) / fileCount
        };
    }

    async analyzeTrends(currentCoverage) {
        const trendsFile = path.join(this.resultsDir, 'coverage-trends.json');
        let trends = [];
        
        if (fs.existsSync(trendsFile)) {
            trends = JSON.parse(fs.readFileSync(trendsFile, 'utf8'));
        }
        
        // Add current data point
        const currentDataPoint = {
            timestamp: new Date().toISOString(),
            overallCoverage: currentCoverage.total.lines,
            fileCount: currentCoverage.summary.totalFiles,
            highCoverageFiles: currentCoverage.summary.highCoverageFiles,
            lowCoverageFiles: currentCoverage.summary.lowCoverageFiles
        };
        
        trends.push(currentDataPoint);
        
        // Keep only last 30 data points
        if (trends.length > 30) {
            trends = trends.slice(-30);
        }
        
        // Calculate trend direction
        let trendDirection = 'stable';
        if (trends.length >= 2) {
            const recent = trends.slice(-7); // Last 7 data points
            const firstCoverage = recent[0].overallCoverage;
            const lastCoverage = recent[recent.length - 1].overallCoverage;
            const change = lastCoverage - firstCoverage;
            
            if (change > 2) {
trendDirection = 'improving';
} else if (change < -2) {
trendDirection = 'declining';
}
        }
        
        // Save updated trends
        fs.writeFileSync(trendsFile, JSON.stringify(trends, null, 2));
        
        return {
            direction: trendDirection,
            dataPoints: trends.length,
            recentChange: trends.length >= 2 ? 
                trends[trends.length - 1].overallCoverage - trends[trends.length - 2].overallCoverage : 0,
            averageCoverage: trends.reduce((sum, point) => sum + point.overallCoverage, 0) / trends.length
        };
    }

    generateAlerts(coverageData, trendAnalysis) {
        const alerts = [];
        const overallCoverage = coverageData.total.lines;
        
        // Coverage threshold alerts
        if (overallCoverage < 60) {
            alerts.push({
                type: 'critical',
                message: `Coverage is critically low at ${overallCoverage}%`,
                recommendation: 'Immediate action required to improve test coverage'
            });
        } else if (overallCoverage < 70) {
            alerts.push({
                type: 'warning',
                message: `Coverage is below target at ${overallCoverage}%`,
                recommendation: 'Focus on increasing coverage to meet 80% target'
            });
        } else if (overallCoverage >= 80) {
            alerts.push({
                type: 'success',
                message: `Target coverage achieved! Current: ${overallCoverage}%`,
                recommendation: 'Maintain current coverage levels'
            });
        }
        
        // Trend alerts
        if (trendAnalysis.direction === 'declining') {
            alerts.push({
                type: 'warning',
                message: 'Coverage trend is declining',
                recommendation: 'Investigate recent changes that may have reduced coverage'
            });
        }
        
        // Low coverage files alert
        const lowCoverageFiles = Object.entries(coverageData.files)
            .filter(([_, data]) => data.lines < 50)
            .length;
        
        if (lowCoverageFiles > 0) {
            alerts.push({
                type: 'info',
                message: `${lowCoverageFiles} files have less than 50% coverage`,
                recommendation: 'Prioritize testing for these files'
            });
        }
        
        return alerts;
    }

    generateRecommendations(coverageData, alerts) {
        const recommendations = [];
        const overallCoverage = coverageData.total.lines;
        
        // Coverage-based recommendations
        if (overallCoverage < 60) {
            recommendations.push({
                priority: 'high',
                action: 'Focus on core module coverage',
                description: 'Add comprehensive tests for essential business logic components'
            });
        }
        
        if (overallCoverage < 80) {
            recommendations.push({
                priority: 'medium',
                action: 'Increase integration test coverage',
                description: 'Add end-to-end tests for critical user workflows'
            });
        }
        
        // File-specific recommendations
        const lowCoverageFiles = Object.entries(coverageData.files)
            .filter(([_, data]) => data.lines < 50)
            .sort(([_, a], [__, b]) => a.lines - b.lines)
            .slice(0, 5);
        
        for (const [filename, data] of lowCoverageFiles) {
            recommendations.push({
                priority: 'high',
                action: `Improve coverage for ${filename}`,
                description: `Current coverage: ${data.lines}%. Add tests for uncovered functions and branches.`
            });
        }
        
        // Alert-based recommendations
        for (const alert of alerts) {
            if (alert.type === 'warning' || alert.type === 'critical') {
                recommendations.push({
                    priority: alert.type === 'critical' ? 'high' : 'medium',
                    action: 'Address coverage alerts',
                    description: alert.recommendation
                });
            }
        }
        
        return recommendations;
    }

    async saveMonitoringResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsFile = path.join(this.resultsDir, `coverage-monitor-${timestamp}.json`);
        
        fs.writeFileSync(resultsFile, JSON.stringify(this.monitoringData, null, 2));
        
        // Also save as latest
        const latestFile = path.join(this.resultsDir, 'latest-coverage-monitor.json');
        fs.writeFileSync(latestFile, JSON.stringify(this.monitoringData, null, 2));
        
        console.log(`📁 Results saved to: ${resultsFile}`);
    }

    async generateReport() {
        const report = this.generateHtmlReport();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(this.resultsDir, `coverage-report-${timestamp}.html`);
        
        fs.writeFileSync(reportFile, report);
        
        console.log(`📊 Report generated: ${reportFile}`);
    }

    generateHtmlReport() {
        const { coverage, trends, alerts, recommendations } = this.monitoringData;
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage Monitoring Report - Sprint 3</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .alerts { margin-bottom: 30px; }
        .alert { padding: 15px; margin-bottom: 10px; border-radius: 5px; }
        .alert.critical { background: #f8d7da; border-left: 4px solid #dc3545; }
        .alert.warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .alert.success { background: #d4edda; border-left: 4px solid #28a745; }
        .alert.info { background: #d1ecf1; border-left: 4px solid #17a2b8; }
        .recommendations { margin-bottom: 30px; }
        .recommendation { background: #e9ecef; padding: 15px; margin-bottom: 10px; border-radius: 5px; }
        .recommendation.high { border-left: 4px solid #dc3545; }
        .recommendation.medium { border-left: 4px solid #ffc107; }
        .trend-info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .timestamp { color: #666; font-size: 0.9em; text-align: center; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Sprint 3 Coverage Monitoring Report</h1>
            <p>Real-time test coverage analysis and recommendations</p>
            <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value">${coverage.total.lines.toFixed(1)}%</div>
                <div class="metric-label">Overall Coverage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${coverage.summary.totalFiles}</div>
                <div class="metric-label">Total Files</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${coverage.summary.highCoverageFiles}</div>
                <div class="metric-label">High Coverage Files</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${trends.direction || 'N/A'}</div>
                <div class="metric-label">Trend Direction</div>
            </div>
        </div>

        <div class="trend-info">
            <h3>📈 Trend Analysis</h3>
            <p><strong>Direction:</strong> ${trends.direction}</p>
            <p><strong>Data Points:</strong> ${trends.dataPoints}</p>
            <p><strong>Recent Change:</strong> ${trends.recentChange > 0 ? '+' : ''}${trends.recentChange.toFixed(2)}%</p>
            <p><strong>Average Coverage:</strong> ${trends.averageCoverage.toFixed(2)}%</p>
        </div>

        <div class="alerts">
            <h3>🚨 Alerts</h3>
            ${alerts.map(alert => `
                <div class="alert ${alert.type}">
                    <strong>${alert.type.toUpperCase()}:</strong> ${alert.message}
                    <br><em>Recommendation: ${alert.recommendation}</em>
                </div>
            `).join('')}
        </div>

        <div class="recommendations">
            <h3>💡 Recommendations</h3>
            ${recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <strong>${rec.action}</strong> (${rec.priority} priority)
                    <br>${rec.description}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
    }
}

// CLI interface
if (require.main === module) {
    const monitor = new CoverageMonitor();
    
    monitor.runCoverageAnalysis()
        .then(() => {
            console.log('🎉 Coverage monitoring completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Coverage monitoring failed:', error);
            process.exit(1);
        });
}

module.exports = CoverageMonitor;
