import * as vscode from 'vscode';
import * as path from 'path';
import { designTokens } from '../designSystem';

export interface AnalyticsData {
  timestamp: Date;
  metrics: {
    codeQuality: number;
    securityScore: number;
    maintainability: number;
    testCoverage: number;
    performance: number;
    documentation: number;
  };
  issues: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    autoFixable: number;
  };
  trends: {
    codeQuality: number[];
    securityScore: number[];
    maintainability: number[];
  };
  predictions: {
    nextIssues: number;
    qualityTrend: 'improving' | 'declining' | 'stable';
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  };
}

export interface PredictionResult {
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  predictedIssues: number;
  timeframe: string;
  recommendations: string[];
  factors: string[];
}

export interface TrendAnalysis {
  metric: string;
  trend: 'up' | 'down' | 'stable';
  changeRate: number;
  prediction: number;
  confidence: number;
  timeframe: string;
}

export class AdvancedAnalytics {
  private static instance: AdvancedAnalytics;
  private outputChannel: vscode.OutputChannel;
  private analyticsData: AnalyticsData[] = [];
  private maxHistorySize: number = 100;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('SimpleBeacon Advanced Analytics');
  }

  static getInstance(): AdvancedAnalytics {
    if (!AdvancedAnalytics.instance) {
      AdvancedAnalytics.instance = new AdvancedAnalytics();
    }
    return AdvancedAnalytics.instance;
  }

  async analyzeCodebase(workspaceFolder: vscode.WorkspaceFolder): Promise<AnalyticsData> {
    this.outputChannel.appendLine('🔬 Starting advanced codebase analysis...');
    
    const startTime = Date.now();
    
    try {
      // Collect current metrics
      const metrics = await this.collectMetrics(workspaceFolder);
      const issues = await this.collectIssueMetrics(workspaceFolder);
      
      // Create temporary analytics data for trend calculation
      const tempAnalyticsData: AnalyticsData = {
        timestamp: new Date(),
        metrics,
        issues,
        trends: {} as any,
        predictions: {} as any
      };
      
      const trends = this.calculateTrends([tempAnalyticsData]);
      const predictions = await this.generatePredictions(metrics, trends);

      const analyticsData: AnalyticsData = {
        timestamp: new Date(),
        metrics,
        issues,
        trends,
        predictions
      };

      // Store in history
      this.analyticsData.push(analyticsData);
      if (this.analyticsData.length > this.maxHistorySize) {
        this.analyticsData.shift();
      }

      this.outputChannel.appendLine(`✅ Analysis complete in ${Date.now() - startTime}ms`);
      this.outputChannel.appendLine(`📊 Code Quality: ${metrics.codeQuality}/100`);
      this.outputChannel.appendLine(`🔒 Security Score: ${metrics.securityScore}/100`);
      this.outputChannel.appendLine(`🔧 Maintainability: ${metrics.maintainability}/100`);
      this.outputChannel.appendLine(`🎯 Risk Level: ${predictions.riskLevel}`);
      this.outputChannel.appendLine(`📈 Quality Trend: ${predictions.qualityTrend}`);

      return analyticsData;

    } catch (error) {
      this.outputChannel.appendLine(`❌ Analysis failed: ${error}`);
      throw error;
    }
  }

  async generatePredictiveInsights(): Promise<PredictionResult[]> {
    this.outputChannel.appendLine('🔮 Generating predictive insights...');
    
    const insights: PredictionResult[] = [];
    const recentData = this.analyticsData.slice(-10); // Last 10 analyses
    
    if (recentData.length < 3) {
      return [{
        riskLevel: 'low',
        confidence: 0.3,
        predictedIssues: 0,
        timeframe: '1 week',
        recommendations: ['More data needed for accurate predictions'],
        factors: ['Insufficient historical data']
      }];
    }

    // Analyze trends for predictions
    const qualityTrend = this.analyzeTrend(recentData.map(d => d.metrics.codeQuality));
    const securityTrend = this.analyzeTrend(recentData.map(d => d.metrics.securityScore));
    const maintainabilityTrend = this.analyzeTrend(recentData.map(d => d.metrics.maintainability));

    // Generate risk assessment
    const riskLevel = this.calculateRiskLevel(qualityTrend, securityTrend, maintainabilityTrend);
    const confidence = Math.min(0.95, recentData.length / 10);

    // Predict next issues
    const avgIssues = recentData.reduce((sum, d) => sum + d.issues.total, 0) / recentData.length;
    const trendMultiplier = qualityTrend === 'down' ? 1.2 : qualityTrend === 'up' ? 0.8 : 1;
    const predictedIssues = Math.round(avgIssues * trendMultiplier);

    // Generate recommendations
    const recommendations = this.generateRecommendations(riskLevel, qualityTrend, securityTrend, maintainabilityTrend);
    const factors = this.identifyInfluencingFactors(recentData);

    insights.push({
      riskLevel,
      confidence,
      predictedIssues,
      timeframe: '1 week',
      recommendations,
      factors
    });

    this.outputChannel.appendLine(`✅ Generated ${insights.length} predictive insights`);
    return insights;
  }

  async generateTrendAnalysis(): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    
    const metrics = ['codeQuality', 'securityScore', 'maintainability', 'testCoverage', 'performance', 'documentation'];
    
    for (const metric of metrics) {
      const values = this.analyticsData.map(d => d.metrics[metric as keyof AnalyticsData['metrics']]);
      const trendAnalysis = this.analyzeTrend(values);
      
      trends.push({
        metric,
        trend: trendAnalysis,
        changeRate: this.calculateChangeRate(values),
        prediction: this.predictNextValue(values),
        confidence: this.calculateConfidence(values),
        timeframe: '1 week'
      });
    }

    return trends;
  }

  async generateCustomReport(timeframe: string, metrics: string[]): Promise<string> {
    const filteredData = this.filterDataByTimeframe(timeframe);
    
    let report = `# Advanced Analytics Report\n\n`;
    report += `**Timeframe**: ${timeframe}\n`;
    report += `**Generated**: ${new Date().toISOString()}\n`;
    report += `**Data Points**: ${filteredData.length}\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    const latestData = filteredData[filteredData.length - 1];
    if (latestData) {
      report += `- **Code Quality**: ${latestData.metrics.codeQuality}/100\n`;
      report += `- **Security Score**: ${latestData.metrics.securityScore}/100\n`;
      report += `- **Maintainability**: ${latestData.metrics.maintainability}/100\n`;
      report += `- **Risk Level**: ${latestData.predictions.riskLevel}\n`;
      report += `- **Quality Trend**: ${latestData.predictions.qualityTrend}\n`;
    }

    // Metrics Breakdown
    if (metrics.length > 0) {
      report += `\n## Metrics Breakdown\n\n`;
      for (const metric of metrics) {
        const values = filteredData.map(d => d.metrics[metric as keyof AnalyticsData['metrics']]);
        const trend = this.analyzeTrend(values);
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        
        report += `### ${metric}\n`;
        report += `- **Average**: ${avg.toFixed(1)}/100\n`;
        report += `- **Range**: ${min.toFixed(1)} - ${max.toFixed(1)}/100\n`;
        report += `- **Trend**: ${trend}\n`;
        report += `- **Prediction**: ${this.predictNextValue(values).toFixed(1)}/100\n\n`;
      }
    }

    // Issue Analysis
    report += `\n## Issue Analysis\n\n`;
    const totalIssues = filteredData.reduce((sum, d) => sum + d.issues.total, 0);
    const avgIssues = totalIssues / filteredData.length;
    const autoFixableRate = filteredData.reduce((sum, d) => sum + d.issues.autoFixable, 0) / totalIssues * 100;
    
    report += `- **Total Issues**: ${totalIssues}\n`;
    report += `- **Average per Analysis**: ${avgIssues.toFixed(1)}\n`;
    report += `- **Auto-Fixable**: ${autoFixableRate.toFixed(1)}%\n`;

    // Recommendations
    report += `\n## Recommendations\n\n`;
    const latestPredictions = filteredData[filteredData.length - 1]?.predictions;
    if (latestPredictions) {
      report += latestPredictions.recommendations.map(rec => `- ${rec}`).join('\n');
    }

    return report;
  }

  private async collectMetrics(workspaceFolder: vscode.WorkspaceFolder): Promise<any> {
    // Simulate metric collection
    // In a real implementation, this would analyze the codebase
    return {
      codeQuality: 75 + Math.random() * 20,
      securityScore: 80 + Math.random() * 15,
      maintainability: 70 + Math.random() * 25,
      testCoverage: 60 + Math.random() * 30,
      performance: 85 + Math.random() * 10,
      documentation: 65 + Math.random() * 20
    };
  }

  private async collectIssueMetrics(workspaceFolder: vscode.WorkspaceFolder): Promise<any> {
    // Simulate issue collection
    const totalIssues = Math.floor(10 + Math.random() * 40);
    const autoFixableIssues = Math.floor(totalIssues * 0.6);
    
    return {
      total: totalIssues,
      bySeverity: {
        error: Math.floor(totalIssues * 0.2),
        warning: Math.floor(totalIssues * 0.5),
        info: Math.floor(totalIssues * 0.3)
      },
      byCategory: {
        'security': Math.floor(totalIssues * 0.15),
        'performance': Math.floor(totalIssues * 0.1),
        'style': Math.floor(totalIssues * 0.25),
        'documentation': Math.floor(totalIssues * 0.2),
        'testing': Math.floor(totalIssues * 0.3)
      },
      autoFixable: autoFixableIssues
    };
  }

  private calculateTrends(data: AnalyticsData[]): { codeQuality: number[]; securityScore: number[]; maintainability: number[] } {
    return {
      codeQuality: data.map(d => d.metrics.codeQuality),
      securityScore: data.map(d => d.metrics.securityScore),
      maintainability: data.map(d => d.metrics.maintainability)
    };
  }

  private async generatePredictions(metrics: AnalyticsData['metrics'], trends: AnalyticsData['trends']): Promise<AnalyticsData['predictions']> {
    // Simulate AI-powered predictions
    const qualityTrend = this.analyzeTrend(trends.codeQuality);
    const qualityTrendLabel = qualityTrend === 'up' ? 'improving' : qualityTrend === 'down' ? 'declining' : 'stable';
    
    return {
      nextIssues: Math.max(0, Math.floor(10 + Math.random() * 20)),
      qualityTrend: qualityTrendLabel,
      riskLevel: this.calculateRiskLevel(qualityTrend, 'stable', 'stable'),
      recommendations: this.generateRecommendations(qualityTrendLabel, 'stable', 'stable', 'stable')
    };
  }

  private analyzeTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-3);
    const older = values.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    if (recentAvg > olderAvg + 5) return 'up';
    if (recentAvg < olderAvg - 5) return 'down';
    return 'stable';
  }

  private calculateChangeRate(values: number[]): number {
    if (values.length < 2) return 0;
    
    const first = values[0];
    const last = values[values.length - 1];
    return ((last - first) / first) * 100;
  }

  private predictNextValue(values: number[]): number {
    if (values.length < 3) return values[values.length - 1] || 0;
    
    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return slope * n + intercept;
  }

  private calculateConfidence(values: number[]): number {
    if (values.length < 3) return 0.3;
    return Math.min(0.95, values.length / 10);
  }

  private calculateRiskLevel(qualityTrend: string, securityTrend: string, maintainabilityTrend: string): 'low' | 'medium' | 'high' {
    const riskFactors: Record<string, number> = {
      'down': 2,
      'stable': 1,
      'up': 0
    };
    
    const totalRisk = (riskFactors[qualityTrend] || 1) + (riskFactors[securityTrend] || 1) + (riskFactors[maintainabilityTrend] || 1);
    
    if (totalRisk >= 4) return 'high';
    if (totalRisk >= 2) return 'medium';
    return 'low';
  }

  private generateRecommendations(riskLevel: string, qualityTrend: string, securityTrend: string, maintainabilityTrend: string): string[] {
    const recommendations: string[] = [];
    
    if (riskLevel === 'high') {
      recommendations.push('🚨 Immediate code review required');
      recommendations.push('🔒 Address security vulnerabilities first');
      recommendations.push('📈 Schedule regular quality assessments');
    }
    
    if (qualityTrend === 'declining') {
      recommendations.push('📉 Implement code quality gates');
      recommendations.push('🎯 Set quality improvement targets');
    }
    
    if (securityTrend === 'declining') {
      recommendations.push('🔒 Conduct security audit');
      recommendations.push('🛡️ Implement security training');
    }
    
    if (maintainabilityTrend === 'declining') {
      recommendations.push('🔧 Refactor complex code');
      recommendations.push('📚 Improve documentation');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ Continue current practices');
      recommendations.push('📊 Monitor trends regularly');
    }
    
    return recommendations;
  }

  private identifyInfluencingFactors(data: AnalyticsData[]): string[] {
    const factors: string[] = [];
    
    // Analyze what might be influencing trends
    const issueCounts = data.map(d => d.issues.total);
    const avgIssues = issueCounts.reduce((sum, count) => sum + count, 0) / issueCounts.length;
    
    if (avgIssues > 30) {
      factors.push('High issue volume');
    }
    
    if (avgIssues < 10) {
      factors.push('Low issue volume');
    }
    
    const autoFixableRate = data.reduce((sum, d) => sum + (d.issues.autoFixable / d.issues.total), 0) / data.length;
    if (autoFixableRate > 0.8) {
      factors.push('High auto-fix rate');
    }
    
    return factors;
  }

  private filterDataByTimeframe(timeframe: string): AnalyticsData[] {
    const now = new Date();
    let cutoffDate: Date;
    
    switch (timeframe) {
      case '1 week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1 month':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3 months':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6 months':
        cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    return this.analyticsData.filter(d => d.timestamp >= cutoffDate);
  }

  public getAnalyticsHistory(): AnalyticsData[] {
    return [...this.analyticsData];
  }

  public clearHistory(): void {
    this.analyticsData = [];
  }

  public exportAnalyticsData(): string {
    return JSON.stringify(this.analyticsData, null, 2);
  }

  public importAnalyticsData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      this.analyticsData = data;
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to import analytics data: ${error}`);
    }
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}
