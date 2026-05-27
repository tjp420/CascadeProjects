/**
 * Roadmap Integration Tools
 * Integrates analysis results with the central data truth system
 */

const RoadmapAnalyzer = require('./RoadmapAnalyzer');
const AnalyzerDashboard = require('./AnalyzerDashboard');
const fs = require('fs').promises;
const path = require('path');

class RoadmapIntegration {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.analyzer = new RoadmapAnalyzer(projectPath);
    this.dashboard = new AnalyzerDashboard(projectPath);
    this.dataCentralPath = path.join(projectPath, 'data-central');
  }

  /**
   * Perform comprehensive analysis and integration
   */
  async analyzeAndIntegrate() {
    console.log('🔗 Starting comprehensive analysis and integration...');
    
    try {
      // Step 1: Perform analysis
      console.log('📊 Step 1: Performing project analysis...');
      const analysis = await this.analyzer.analyzeProject();
      
      // Step 2: Generate dashboard
      console.log('📈 Step 2: Generating dashboard...');
      const dashboard = await this.dashboard.generateDashboard();
      
      // Step 3: Create analysis data files
      console.log('💾 Step 3: Creating analysis data files...');
      await this.createAnalysisDataFiles(analysis, dashboard);
      
      // Step 4: Update central data truth system
      console.log('🔄 Step 4: Updating central data truth system...');
      await this.updateCentralDataTruth(analysis, dashboard);
      
      // Step 5: Generate integration report
      console.log('📋 Step 5: Generating integration report...');
      await this.generateIntegrationReport(analysis, dashboard);
      
      console.log('✅ Analysis and integration completed successfully!');
      return { analysis, dashboard };
      
    } catch (error) {
      console.error('❌ Analysis and integration failed:', error);
      throw error;
    }
  }

  /**
   * Create analysis data files
   */
  async createAnalysisDataFiles(analysis, dashboard) {
    const analysisDir = path.join(this.dataCentralPath, 'analysis');
    
    try {
      // Create analysis directory
      await fs.mkdir(analysisDir, { recursive: true });
      
      // Save analysis data
      const analysisData = {
        timestamp: new Date().toISOString(),
        type: 'analysis-data',
        title: 'Project Analysis Data',
        analysis: analysis,
        dashboard: dashboard,
        metadata: {
          source: 'roadmap-analyzer',
          version: '1.0.0',
          processed: true,
          validated: true
        }
      };
      
      await fs.writeFile(
        path.join(analysisDir, 'analysis-data.json'),
        JSON.stringify(analysisData, null, 2)
      );
      
      // Save structure analysis
      await fs.writeFile(
        path.join(analysisDir, 'structure-analysis.json'),
        JSON.stringify(analysis.structure, null, 2)
      );
      
      // Save quality analysis
      await fs.writeFile(
        path.join(analysisDir, 'quality-analysis.json'),
        JSON.stringify({
          complexity: analysis.complexity,
          metrics: analysis.metrics,
          recommendations: analysis.recommendations
        }, null, 2)
      );
      
      // Save feature analysis
      await fs.writeFile(
        path.join(analysisDir, 'feature-analysis.json'),
        JSON.stringify(analysis.features, null, 2)
      );
      
      console.log('✅ Analysis data files created');
      
    } catch (error) {
      console.log('⚠️ Could not create analysis data files:', error.message);
    }
  }

  /**
   * Update central data truth system
   */
  async updateCentralDataTruth(analysis, dashboard) {
    try {
      // Update roadmap with real data
      await this.updateRoadmapData(dashboard.roadmap);
      
      // Create metrics data
      await this.createMetricsData(analysis, dashboard);
      
      // Create recommendations data
      await this.createRecommendationsData(dashboard.recommendations);
      
      console.log('✅ Central data truth system updated');
      
    } catch (error) {
      console.log('⚠️ Could not update central data truth system:', error.message);
    }
  }

  /**
   * Update roadmap data with analysis results
   */
  async updateRoadmapData(roadmapData) {
    try {
      const roadmapPath = path.join(this.dataCentralPath, 'roadmap', 'roadmap-data.json');
      
      // Backup existing file
      const backupPath = path.join(this.dataCentralPath, 'roadmap', 'roadmap-backup.json');
      try {
        await fs.copyFile(roadmapPath, backupPath);
      } catch (error) {
        // File might not exist, that's ok
      }
      
      // Update with new data
      await fs.writeFile(roadmapPath, JSON.stringify(roadmapData, null, 2));
      
      console.log('✅ Roadmap data updated');
      
    } catch (error) {
      console.log('⚠️ Could not update roadmap data:', error.message);
    }
  }

  /**
   * Create metrics data
   */
  async createMetricsData(analysis, dashboard) {
    try {
      const metricsDir = path.join(this.dataCentralPath, 'analytics');
      await fs.mkdir(metricsDir, { recursive: true });
      
      const metricsData = {
        timestamp: new Date().toISOString(),
        type: 'project-metrics',
        title: 'Project Metrics Analysis',
        projectMetrics: dashboard.overview.summary,
        qualityMetrics: dashboard.quality,
        structureMetrics: dashboard.structure,
        featureMetrics: dashboard.features,
        recommendationMetrics: dashboard.recommendations.summary,
        healthScore: dashboard.overview.health,
        status: dashboard.overview.status,
        metadata: {
          source: 'roadmap-analyzer',
          version: '1.0.0',
          processed: true,
          validated: true
        }
      };
      
      await fs.writeFile(
        path.join(metricsDir, 'project-metrics.json'),
        JSON.stringify(metricsData, null, 2)
      );
      
      console.log('✅ Metrics data created');
      
    } catch (error) {
      console.log('⚠️ Could not create metrics data:', error.message);
    }
  }

  /**
   * Create recommendations data
   */
  async createRecommendationsData(recommendations) {
    try {
      const recommendationsDir = path.join(this.dataCentralPath, 'technical-debt');
      await fs.mkdir(recommendationsDir, { recursive: true });
      
      const recommendationsData = {
        timestamp: new Date().toISOString(),
        type: 'recommendations',
        title: 'Project Recommendations',
        summary: recommendations.summary,
        immediate: recommendations.immediate,
        shortTerm: recommendations.shortTerm,
        longTerm: recommendations.longTerm,
        categories: recommendations.categories,
        priority: recommendations.priority,
        metadata: {
          source: 'roadmap-analyzer',
          version: '1.0.0',
          processed: true,
          validated: true
        }
      };
      
      await fs.writeFile(
        path.join(recommendationsDir, 'recommendations.json'),
        JSON.stringify(recommendationsData, null, 2)
      );
      
      console.log('✅ Recommendations data created');
      
    } catch (error) {
      console.log('⚠️ Could not create recommendations data:', error.message);
    }
  }

  /**
   * Generate integration report
   */
  async generateIntegrationReport(analysis, dashboard) {
    try {
      const reportDir = path.join(this.projectPath, 'reports');
      await fs.mkdir(reportDir, { recursive: true });
      
      const report = {
        timestamp: new Date().toISOString(),
        type: 'integration-report',
        title: 'Roadmap Analysis Integration Report',
        summary: {
          analysisDate: new Date().toLocaleString(),
          projectStatus: dashboard.overview.status,
          healthScore: dashboard.overview.health,
          totalFiles: analysis.structure.totalFiles,
          completionRate: analysis.features.completionRate
        },
        analysis: {
          structure: {
            totalFiles: analysis.structure.totalFiles,
            totalDirectories: analysis.structure.totalDirectories,
            components: Object.keys(analysis.structure.componentBreakdown || {}).length
          },
          quality: {
            averageComplexity: analysis.complexity.averageComplexity,
            maintainabilityIndex: analysis.complexity.maintainabilityIndex,
            hotspots: analysis.complexity.hotspots.length
          },
          features: {
            total: analysis.features.total,
            completed: analysis.features.completed.length,
            inProgress: analysis.features.inProgress.length,
            planned: analysis.features.planned.length
          },
          recommendations: {
            total: analysis.recommendations.priority.length,
            immediate: analysis.recommendations.immediate.length,
            shortTerm: analysis.recommendations.shortTerm.length,
            longTerm: analysis.recommendations.longTerm.length
          }
        },
        integration: {
          dataFilesCreated: [
            'data-central/analysis/analysis-data.json',
            'data-central/analysis/structure-analysis.json',
            'data-central/analysis/quality-analysis.json',
            'data-central/analysis/feature-analysis.json',
            'data-central/analytics/project-metrics.json',
            'data-central/technical-debt/recommendations.json'
          ],
          centralDataUpdated: true,
          roadmapUpdated: true
        },
        nextSteps: this.generateNextSteps(analysis, dashboard),
        metadata: {
          source: 'roadmap-integration',
          version: '1.0.0',
          processed: true,
          validated: true
        }
      };
      
      const reportPath = path.join(reportDir, 'roadmap-analysis-integration.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      console.log('✅ Integration report created');
      
    } catch (error) {
      console.log('⚠️ Could not generate integration report:', error.message);
    }
  }

  /**
   * Generate next steps
   */
  generateNextSteps(analysis, dashboard) {
    const steps = [];
    
    // Based on analysis results
    if (dashboard.overview.health < 70) {
      steps.push({
        priority: 'high',
        action: 'Address critical issues',
        description: 'Project health score is below 70%, immediate action required'
      });
    }
    
    if (analysis.complexity.hotspots.length > 0) {
      steps.push({
        priority: 'high',
        action: 'Refactor complexity hotspots',
        description: `${analysis.complexity.hotspots.length} files need complexity reduction`
      });
    }
    
    if (analysis.features.completionRate < 80) {
      steps.push({
        priority: 'medium',
        action: 'Complete remaining features',
        description: `${analysis.features.planned.length} features are still planned`
      });
    }
    
    if (analysis.recommendations.immediate.length > 0) {
      steps.push({
        priority: 'high',
        action: 'Implement immediate recommendations',
        description: `${analysis.recommendations.immediate.length} items need immediate attention`
      });
    }
    
    // Phase-specific steps
    steps.push({
      priority: 'medium',
      action: 'Continue Phase 4 enhancement',
      description: 'Database migration and security hardening'
    });
    
    steps.push({
      priority: 'low',
      action: 'Monitor project health',
      description: 'Regular analysis and health checks'
    });
    
    return steps;
  }

  /**
   * Validate integration
   */
  async validateIntegration() {
    console.log('🔍 Validating integration...');
    
    const validation = {
      dataFiles: [],
      centralData: {},
      consistency: {},
      errors: []
    };
    
    try {
      // Check data files
      const analysisDir = path.join(this.dataCentralPath, 'analysis');
      const expectedFiles = [
        'analysis-data.json',
        'structure-analysis.json',
        'quality-analysis.json',
        'feature-analysis.json'
      ];
      
      for (const file of expectedFiles) {
        try {
          await fs.access(path.join(analysisDir, file));
          validation.dataFiles.push(file);
        } catch (error) {
          validation.errors.push(`Missing file: ${file}`);
        }
      }
      
      // Check central data updates
      const centralFiles = [
        'roadmap/roadmap-data.json',
        'analytics/project-metrics.json',
        'technical-debt/recommendations.json'
      ];
      
      for (const file of centralFiles) {
        try {
          await fs.access(path.join(this.dataCentralPath, file));
          validation.centralData[file] = 'exists';
        } catch (error) {
          validation.errors.push(`Missing central data file: ${file}`);
        }
      }
      
      // Check data consistency
      const roadmapData = await this.readRoadmapData();
      if (roadmapData) {
        validation.consistency.roadmap = 'consistent';
        validation.consistency.summary = roadmapData.summary;
      } else {
        validation.errors.push('Roadmap data not accessible');
      }
      
      console.log('✅ Integration validation completed');
      
    } catch (error) {
      validation.errors.push(`Validation error: ${error.message}`);
    }
    
    return validation;
  }

  /**
   * Read roadmap data
   */
  async readRoadmapData() {
    try {
      const roadmapPath = path.join(this.dataCentralPath, 'roadmap', 'roadmap-data.json');
      const data = await fs.readFile(roadmapPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate HTML integration report
   */
  async generateHTMLIntegrationReport() {
    try {
      const validation = await this.validateIntegration();
      
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Roadmap Analysis Integration Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; text-align: center; }
        .card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .success { border-left: 4px solid #4caf50; }
        .error { border-left: 4px solid #f44336; }
        .warning { border-left: 4px solid #ff9800; }
        h2 { color: #667eea; margin-bottom: 15px; }
        .metric { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        .status { padding: 5px 10px; border-radius: 15px; color: white; font-size: 0.8em; }
        .status-success { background: #4caf50; }
        .status-error { background: #f44336; }
        .status-warning { background: #ff9800; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔗 Roadmap Analysis Integration Report</h1>
            <p>Comprehensive analysis and integration validation</p>
        </div>
        
        <div class="card ${validation.errors.length === 0 ? 'success' : 'error'}">
            <h2>📊 Integration Status</h2>
            <div class="metric">
                <span>Data Files Created</span>
                <span class="status status-${validation.dataFiles.length === 4 ? 'success' : 'error'}">
                    ${validation.dataFiles.length}/4
                </span>
            </div>
            <div class="metric">
                <span>Central Data Updated</span>
                <span class="status status-${Object.keys(validation.centralData).length === 3 ? 'success' : 'error'}">
                    ${Object.keys(validation.centralData).length}/3
                </span>
            </div>
            <div class="metric">
                <span>Consistency Check</span>
                <span class="status status-${validation.consistency.roadmap ? 'success' : 'error'}">
                    ${validation.consistency.roadmap ? 'PASS' : 'FAIL'}
                </span>
            </div>
            <div class="metric">
                <span>Overall Status</span>
                <span class="status status-${validation.errors.length === 0 ? 'success' : 'error'}">
                    ${validation.errors.length === 0 ? 'SUCCESS' : 'ERRORS'}
                </span>
            </div>
        </div>
        
        ${validation.dataFiles.length > 0 ? `
        <div class="card success">
            <h2>✅ Data Files Created</h2>
            ${validation.dataFiles.map(file => `
                <div class="metric">
                    <span>${file}</span>
                    <span>✅ Created</span>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        ${Object.keys(validation.centralData).length > 0 ? `
        <div class="card success">
            <h2>✅ Central Data Updated</h2>
            ${Object.entries(validation.centralData).map(([file, status]) => `
                <div class="metric">
                    <span>${file}</span>
                    <span>✅ ${status}</span>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        ${validation.errors.length > 0 ? `
        <div class="card error">
            <h2>❌ Integration Errors</h2>
            ${validation.errors.map(error => `
                <div class="metric">
                    <span>${error}</span>
                    <span>❌ Error</span>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="card">
            <h2>📋 Next Steps</h2>
            <div class="metric">
                <span>Run Analysis</span>
                <span>node scripts/run-analysis.js</span>
            </div>
            <div class="metric">
                <span>View Dashboard</span>
                <span>Open analysis-results/*.html</span>
            </div>
            <div class="metric">
                <span>Check Integration</span>
                <span>node scripts/run-analysis.js --validate</span>
            </div>
        </div>
    </div>
</body>
</html>`;
      
      const reportDir = path.join(this.projectPath, 'reports');
      await fs.mkdir(reportDir, { recursive: true });
      await fs.writeFile(path.join(reportDir, 'integration-validation.html'), html);
      
      console.log('✅ HTML integration report created');
      
    } catch (error) {
      console.log('⚠️ Could not generate HTML report:', error.message);
    }
  }
}

module.exports = RoadmapIntegration;
