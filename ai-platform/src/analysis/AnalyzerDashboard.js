const logger = require('../lib/production-logger');
/**
 * Analyzer Dashboard
 * Comprehensive dashboard for roadmap analysis and visualization
 */

const RoadmapAnalyzer = require('./RoadmapAnalyzer');
const fs = require('fs').promises;
const path = require('path');

class AnalyzerDashboard {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.analyzer = new RoadmapAnalyzer(projectPath);
    this.dashboard = {
      overview: {},
      structure: {},
      quality: {},
      features: {},
      recommendations: {},
      roadmap: {}
    };
  }

  /**
   * Generate comprehensive dashboard
   */
  async generateDashboard() {
    logger.debug('📊 Generating analyzer dashboard...');
    
    try {
      // Perform analysis
      const analysis = await this.analyzer.analyzeProject();
      
      // Generate dashboard sections
      this.dashboard.overview = this.generateOverview(analysis);
      this.dashboard.structure = this.generateStructureAnalysis(analysis);
      this.dashboard.quality = this.generateQualityAnalysis(analysis);
      this.dashboard.features = this.generateFeatureAnalysis(analysis);
      this.dashboard.recommendations = this.generateRecommendationAnalysis(analysis);
      this.dashboard.roadmap = this.analyzer.generateRoadmap();
      
      logger.debug('✅ Dashboard generation completed!');
      return this.dashboard;
      
    } catch (error) {
      console.error('❌ Dashboard generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate overview section
   */
  generateOverview(analysis) {
    return {
      projectName: 'Cascade AI Platform',
      projectVersion: 'v1.0.0',
      analysisDate: new Date().toISOString(),
      status: this.getProjectStatus(analysis),
      health: this.calculateProjectHealth(analysis),
      summary: {
        totalFiles: analysis.structure.totalFiles,
        totalDirectories: analysis.structure.totalDirectories,
        codeComplexity: analysis.complexity.averageComplexity.toFixed(1),
        maintainabilityIndex: analysis.complexity.maintainabilityIndex,
        featureCompletion: analysis.features.completionRate,
        technicalDebt: analysis.metrics.technicalDebt.highComplexity
      }
    };
  }

  /**
   * Get project status
   */
  getProjectStatus(analysis) {
    const completionRate = analysis.features.completionRate;
    const maintainability = analysis.complexity.maintainabilityIndex;
    
    if (completionRate >= 80 && maintainability >= 70) {
      return 'healthy';
    } else if (completionRate >= 60 && maintainability >= 50) {
      return 'good';
    } else if (completionRate >= 40 && maintainability >= 30) {
      return 'warning';
    } else {
      return 'critical';
    }
  }

  /**
   * Calculate project health score
   */
  calculateProjectHealth(analysis) {
    let score = 0;

    // Feature completion (30%)
    score += (analysis.features.completionRate / 100) * 30;

    // Code quality (25%)
    score += (analysis.complexity.maintainabilityIndex / 100) * 25;

    // Technical debt (20%)
    const debtScore = Math.max(0, 100 - (analysis.metrics.technicalDebt.highComplexity * 10));
    score += (debtScore / 100) * 20;

    // Project structure (15%)
    const structureScore = analysis.structure.totalFiles > 100 ? 100 : 50;
    score += (structureScore / 100) * 15;

    // Dependencies (10%)
    const depScore = analysis.dependencies.external.production ? 100 : 50;
    score += (depScore / 100) * 10;

    return Math.round(score);
  }

  /**
   * Generate structure analysis
   */
  generateStructureAnalysis(analysis) {
    return {
      fileSystem: {
        totalFiles: analysis.structure.totalFiles,
        totalDirectories: analysis.structure.totalDirectories,
        totalSize: this.formatFileSize(analysis.metrics.projectSize.totalSize),
        fileTypes: analysis.structure.fileTypes
      },
      components: {
        adapters: analysis.structure.componentBreakdown.adapters || {},
        core: analysis.structure.componentBreakdown.core || {},
        aiSystem: analysis.structure.componentBreakdown.aiSystem || {},
        server: analysis.structure.componentBreakdown.server || {},
        web: analysis.structure.componentBreakdown.web || {}
      },
      architecture: {
        type: analysis.structure.architecture.type,
        patterns: analysis.structure.architecture.patterns,
        layers: analysis.structure.architecture.layers,
        technologies: analysis.structure.architecture.technologies
      },
      directories: analysis.structure.directorySizes
    };
  }

  /**
   * Generate quality analysis
   */
  generateQualityAnalysis(analysis) {
    return {
      codeQuality: {
        averageComplexity: analysis.complexity.averageComplexity.toFixed(1),
        maintainabilityIndex: analysis.complexity.maintainabilityIndex,
        rating: this.getQualityRating(analysis.complexity.maintainabilityIndex),
        hotspots: analysis.complexity.hotspots.map(hotspot => ({
          file: path.basename(hotspot.file),
          complexity: hotspot.complexity,
          issues: hotspot.issues
        }))
      },
      technicalDebt: {
        highComplexity: analysis.metrics.technicalDebt.highComplexity,
        largeFiles: analysis.metrics.technicalDebt.largeFiles,
        unusedDependencies: analysis.metrics.technicalDebt.unusedDependencies,
        circularDependencies: analysis.metrics.technicalDebt.circularDependencies,
        totalScore: this.calculateTechnicalDebtScore(analysis.metrics.technicalDebt)
      },
      dependencies: {
        external: {
          production: Object.keys(analysis.dependencies.external.production || {}).length,
          development: Object.keys(analysis.dependencies.external.development || {}).length
        },
        internal: Object.keys(analysis.dependencies.internal || {}).length
      }
    };
  }

  /**
   * Get quality rating
   */
  getQualityRating(index) {
    if (index >= 80) return 'excellent';
    if (index >= 70) return 'good';
    if (index >= 50) return 'fair';
    if (index >= 30) return 'poor';
    return 'very-poor';
  }

  /**
   * Calculate technical debt score
   */
  calculateTechnicalDebtScore(debt) {
    let score = 0;
    score += debt.highComplexity * 10;
    score += debt.largeFiles * 5;
    score += debt.unusedDependencies * 3;
    score += debt.circularDependencies * 15;
    return score;
  }

  /**
   * Generate feature analysis
   */
  generateFeatureAnalysis(analysis) {
    return {
      summary: {
        total: analysis.features.total,
        completed: analysis.features.completed.length,
        inProgress: analysis.features.inProgress.length,
        planned: analysis.features.planned.length,
        completionRate: analysis.features.completionRate
      },
      completed: analysis.features.completed.map(feature => ({
        name: feature.name,
        type: feature.type,
        implementation: feature.implementation,
        dataFiles: feature.dataFiles.length
      })),
      inProgress: analysis.features.inProgress.map(feature => ({
        name: feature.name,
        type: feature.type,
        implementation: feature.implementation,
        dataFiles: feature.dataFiles.length
      })),
      planned: analysis.features.planned.map(feature => ({
        name: feature.name,
        type: feature.type,
        implementation: feature.implementation,
        dataFiles: feature.dataFiles.length
      })),
      progress: this.calculateProgressBreakdown(analysis.features)
    };
  }

  /**
   * Calculate progress breakdown
   */
  calculateProgressBreakdown(features) {
    const total = features.total;
    return {
      completed: {
        count: features.completed.length,
        percentage: Math.round((features.completed.length / total) * 100)
      },
      inProgress: {
        count: features.inProgress.length,
        percentage: Math.round((features.inProgress.length / total) * 100)
      },
      planned: {
        count: features.planned.length,
        percentage: Math.round((features.planned.length / total) * 100)
      }
    };
  }

  /**
   * Generate recommendation analysis
   */
  generateRecommendationAnalysis(analysis) {
    return {
      summary: {
        total: analysis.recommendations.priority.length,
        immediate: analysis.recommendations.immediate.length,
        shortTerm: analysis.recommendations.shortTerm.length,
        longTerm: analysis.recommendations.longTerm.length
      },
      immediate: analysis.recommendations.immediate.map(rec => ({
        title: rec.title,
        type: rec.type,
        description: rec.description,
        effort: rec.effort,
        impact: rec.impact,
        priority: this.calculatePriority(rec.impact, rec.effort)
      })),
      shortTerm: analysis.recommendations.shortTerm.map(rec => ({
        title: rec.title,
        type: rec.type,
        description: rec.description,
        effort: rec.effort,
        impact: rec.impact,
        priority: this.calculatePriority(rec.impact, rec.effort)
      })),
      longTerm: analysis.recommendations.longTerm.map(rec => ({
        title: rec.title,
        type: rec.type,
        description: rec.description,
        effort: rec.effort,
        impact: rec.impact,
        priority: this.calculatePriority(rec.impact, rec.effort)
      })),
      categories: this.categorizeRecommendations(analysis.recommendations.priority)
    };
  }

  /**
   * Calculate priority score
   */
  calculatePriority(impact, effort) {
    const impactScore = impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
    const effortScore = effort === 'low' ? 3 : effort === 'medium' ? 2 : 1;
    return impactScore * effortScore;
  }

  /**
   * Categorize recommendations
   */
  categorizeRecommendations(recommendations) {
    const categories = {};
    
    recommendations.forEach(rec => {
      if (!categories[rec.type]) {
        categories[rec.type] = [];
      }
      categories[rec.type].push({
        title: rec.title,
        priority: rec.priority,
        effort: rec.effort
      });
    });

    return categories;
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate HTML dashboard
   */
  async generateHTMLDashboard() {
    const dashboard = await this.generateDashboard();
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Platform - Analyzer Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .status-${dashboard.overview.status} {
            display: inline-block;
            padding: 10px 20px;
            border-radius: 20px;
            font-weight: bold;
            margin-top: 10px;
        }
        
        .status-healthy { background: #4caf50; }
        .status-good { background: #8bc34a; }
        .status-warning { background: #ff9800; }
        .status-critical { background: #f44336; }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
        }
        
        .card h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        
        .metric-value {
            font-weight: bold;
            color: #667eea;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s ease;
        }
        
        .hotspot {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
        
        .recommendation {
            background: #e8f5e8;
            border-left: 4px solid #4caf50;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
        }
        
        .recommendation.high {
            border-left-color: #f44336;
            background: #ffebee;
        }
        
        .recommendation.medium {
            border-left-color: #ff9800;
            background: #fff8e1;
        }
        
        .chart {
            text-align: center;
            padding: 20px;
        }
        
        .health-score {
            font-size: 3em;
            font-weight: bold;
            color: #667eea;
            margin: 20px 0;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 AI Platform Analyzer Dashboard</h1>
            <p>Comprehensive project analysis and roadmap insights</p>
            <div class="status-${dashboard.overview.status}">
                Project Status: ${dashboard.overview.status.toUpperCase()}
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>📊 Project Overview</h3>
                <div class="metric">
                    <span>Health Score</span>
                    <span class="metric-value">${dashboard.overview.health}%</span>
                </div>
                <div class="metric">
                    <span>Total Files</span>
                    <span class="metric-value">${dashboard.overview.summary.totalFiles}</span>
                </div>
                <div class="metric">
                    <span>Directories</span>
                    <span class="metric-value">${dashboard.overview.summary.totalDirectories}</span>
                </div>
                <div class="metric">
                    <span>Code Complexity</span>
                    <span class="metric-value">${dashboard.overview.summary.codeComplexity}</span>
                </div>
                <div class="metric">
                    <span>Maintainability</span>
                    <span class="metric-value">${dashboard.overview.summary.maintainabilityIndex}</span>
                </div>
            </div>
            
            <div class="card">
                <h3>🎯 Feature Progress</h3>
                <div class="metric">
                    <span>Completion Rate</span>
                    <span class="metric-value">${dashboard.features.summary.completionRate}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${dashboard.features.summary.completionRate}%"></div>
                </div>
                <div class="metric">
                    <span>Completed</span>
                    <span class="metric-value">${dashboard.features.summary.completed}</span>
                </div>
                <div class="metric">
                    <span>In Progress</span>
                    <span class="metric-value">${dashboard.features.summary.inProgress}</span>
                </div>
                <div class="metric">
                    <span>Planned</span>
                    <span class="metric-value">${dashboard.features.summary.planned}</span>
                </div>
            </div>
            
            <div class="card">
                <h3>🔧 Code Quality</h3>
                <div class="metric">
                    <span>Avg Complexity</span>
                    <span class="metric-value">${dashboard.quality.codeQuality.averageComplexity}</span>
                </div>
                <div class="metric">
                    <span>Maintainability</span>
                    <span class="metric-value">${dashboard.quality.codeQuality.rating}</span>
                </div>
                <div class="metric">
                    <span>Hotspots</span>
                    <span class="metric-value">${dashboard.quality.codeQuality.hotspots.length}</span>
                </div>
                <div class="metric">
                    <span>Technical Debt</span>
                    <span class="metric-value">${dashboard.quality.technicalDebt.totalScore}</span>
                </div>
                ${dashboard.quality.codeQuality.hotspots.length > 0 ? `
                    <div class="hotspot">
                        <strong>⚠️ Complexity Hotspots:</strong>
                        ${dashboard.quality.codeQuality.hotspots.map(h => 
                            `<div>${h.file} (${h.complexity})</div>`
                        ).join('')}
                    </div>
                ` : ''}
            </div>
            
            <div class="card">
                <h3>💡 Recommendations</h3>
                <div class="metric">
                    <span>Total Items</span>
                    <span class="metric-value">${dashboard.recommendations.summary.total}</span>
                </div>
                <div class="metric">
                    <span>Immediate</span>
                    <span class="metric-value">${dashboard.recommendations.summary.immediate}</span>
                </div>
                <div class="metric">
                    <span>Short Term</span>
                    <span class="metric-value">${dashboard.recommendations.summary.shortTerm}</span>
                </div>
                <div class="metric">
                    <span>Long Term</span>
                    <span class="metric-value">${dashboard.recommendations.summary.longTerm}</span>
                </div>
                ${dashboard.recommendations.immediate.slice(0, 2).map(rec => `
                    <div class="recommendation high">
                        <strong>${rec.title}</strong>
                        <p>${rec.description}</p>
                        <small>Effort: ${rec.effort} | Impact: ${rec.impact}</small>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="card">
            <h3>📈 Project Structure</h3>
            <div class="grid">
                <div>
                    <h4>Components</h4>
                    ${Object.entries(dashboard.structure.components).map(([key, value]) => `
                        <div class="metric">
                            <span>${key}</span>
                            <span class="metric-value">${value.count || 0} files</span>
                        </div>
                    `).join('')}
                </div>
                <div>
                    <h4>Architecture</h4>
                    <div class="metric">
                        <span>Type</span>
                        <span class="metric-value">${dashboard.structure.architecture.type}</span>
                    </div>
                    <div class="metric">
                        <span>Patterns</span>
                        <span class="metric-value">${dashboard.structure.architecture.patterns.length}</span>
                    </div>
                    <div class="metric">
                        <span>Dependencies</span>
                        <span class="metric-value">${dashboard.quality.dependencies.external.production}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h3>🗺️ Development Roadmap</h3>
            <div class="grid">
                ${dashboard.roadmap.timeline.map(phase => `
                    <div class="card" style="margin: 10px 0;">
                        <h4>${phase.marker} ${phase.title}</h4>
                        <p>${phase.description}</p>
                        <div class="metric">
                            <span>Status</span>
                            <span class="metric-value">${phase.status}</span>
                        </div>
                        <div class="metric">
                            <span>Date</span>
                            <span class="metric-value">${phase.date}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
    
    <script>
        // Add interactivity
        document.addEventListener('DOMContentLoaded', function() {
            // Animate progress bars
            const progressBars = document.querySelectorAll('.progress-fill');
            progressBars.forEach(bar => {
                const width = bar.style.width;
                bar.style.width = '0%';
                setTimeout(() => {
                    bar.style.width = width;
                }, 100);
            });
            
            // Add click handlers for cards
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                card.addEventListener('click', function() {
                    this.style.transform = 'scale(1.02)';
                    setTimeout(() => {
                        this.style.transform = '';
                    }, 200);
                });
            });
        });
    </script>
</body>
</html>`;
    
    return html;
  }

  /**
   * Save dashboard to file
   */
  async saveDashboard(outputPath) {
    const dashboard = await this.generateDashboard();
    const html = await this.generateHTMLDashboard();
    
    // Save JSON data
    await fs.writeFile(outputPath, JSON.stringify(dashboard, null, 2));
    
    // Save HTML dashboard
    const htmlPath = outputPath.replace('.json', '.html');
    await fs.writeFile(htmlPath, html);
    
    logger.debug(`✅ Dashboard saved to ${outputPath}`);
    logger.debug(`✅ HTML dashboard saved to ${htmlPath}`);
    
    return { jsonPath: outputPath, htmlPath };
  }
}

module.exports = AnalyzerDashboard;

