#!/usr/bin/env node

/**
 * Roadmap Analysis Runner
 * Command-line tool to run comprehensive project analysis
 */

const path = require('path');
const fs = require('fs').promises;

// Import analysis tools
const RoadmapAnalyzer = require('../src/analysis/RoadmapAnalyzer');
const AnalyzerDashboard = require('../src/analysis/AnalyzerDashboard');

class AnalysisRunner {
  constructor() {
    this.projectPath = process.cwd();
    this.outputDir = path.join(this.projectPath, 'analysis-results');
  }

  /**
   * Run complete analysis
   */
  async runAnalysis(options = {}) {
    console.log('🚀 Starting AI Platform Analysis...');
    console.log(`📁 Project Path: ${this.projectPath}`);
    
    try {
      // Create output directory
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // Initialize analyzer
      const analyzer = new RoadmapAnalyzer(this.projectPath);
      
      // Run analysis
      console.log('🔍 Analyzing project structure and code...');
      const analysis = await analyzer.analyzeProject();
      
      // Generate dashboard
      console.log('📊 Generating dashboard...');
      const dashboard = new AnalyzerDashboard(this.projectPath);
      const dashboardData = await dashboard.generateDashboard();
      
      // Save results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputPath = path.join(this.outputDir, `analysis-${timestamp}.json`);
      const savedPaths = await dashboard.saveDashboard(outputPath);
      
      // Generate summary
      this.printSummary(analysis, dashboardData, savedPaths);
      
      // Update roadmap data if requested
      if (options.updateRoadmap) {
        await this.updateRoadmapData(dashboardData.roadmap);
      }
      
      console.log('\n✅ Analysis completed successfully!');
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    }
  }

  /**
   * Print analysis summary
   */
  printSummary(analysis, dashboard, savedPaths) {
    console.log('\n📊 ANALYSIS SUMMARY');
    console.log('='.repeat(50));
    
    // Project Overview
    console.log('\n🏗️ PROJECT OVERVIEW');
    console.log(`   Status: ${dashboard.overview.status.toUpperCase()}`);
    console.log(`   Health Score: ${dashboard.overview.health}%`);
    console.log(`   Total Files: ${dashboard.overview.summary.totalFiles}`);
    console.log(`   Directories: ${dashboard.overview.summary.totalDirectories}`);
    
    // Code Quality
    console.log('\n🔧 CODE QUALITY');
    console.log(`   Avg Complexity: ${dashboard.overview.summary.codeComplexity}`);
    console.log(`   Maintainability: ${dashboard.overview.summary.maintainabilityIndex}`);
    console.log(`   Hotspots: ${dashboard.overview.summary.technicalDebt}`);
    
    // Features
    console.log('\n🎯 FEATURES');
    console.log(`   Completion Rate: ${dashboard.overview.summary.featureCompletion}%`);
    console.log(`   Completed: ${dashboard.features.summary.completed}`);
    console.log(`   In Progress: ${dashboard.features.summary.inProgress}`);
    console.log(`   Planned: ${dashboard.features.summary.planned}`);
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log(`   Total: ${dashboard.recommendations.summary.total}`);
    console.log(`   Immediate: ${dashboard.recommendations.summary.immediate}`);
    console.log(`   Short Term: ${dashboard.recommendations.summary.shortTerm}`);
    console.log(`   Long Term: ${dashboard.recommendations.summary.longTerm}`);
    
    // Top Recommendations
    if (dashboard.recommendations.immediate.length > 0) {
      console.log('\n🔥 TOP PRIORITY RECOMMENDATIONS:');
      dashboard.recommendations.immediate.slice(0, 3).forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.title}`);
        console.log(`      Type: ${rec.type}`);
        console.log(`      Effort: ${rec.effort}`);
        console.log(`      Impact: ${rec.impact}`);
      });
    }
    
    // Output Files
    console.log('\n📄 OUTPUT FILES');
    console.log(`   JSON: ${savedPaths.jsonPath}`);
    console.log(`   HTML: ${savedPaths.htmlPath}`);
    
    // Next Steps
    console.log('\n🚀 RECOMMENDED NEXT STEPS:');
    if (dashboard.recommendations.immediate.length > 0) {
      console.log('   1. Address immediate recommendations');
      console.log('   2. Focus on database migration');
      console.log('   3. Refactor high complexity files');
    } else {
      console.log('   1. Continue with Phase 4 enhancement');
      console.log('   2. Monitor code quality metrics');
      console.log('   3. Plan for production deployment');
    }
  }

  /**
   * Update roadmap data with analysis results
   */
  async updateRoadmapData(roadmapData) {
    try {
      const roadmapPath = path.join(this.projectPath, 'data-central', 'roadmap', 'roadmap-data.json');
      
      // Backup existing file
      const backupPath = path.join(this.outputDir, 'roadmap-backup.json');
      await fs.copyFile(roadmapPath, backupPath);
      
      // Update with new data
      await fs.writeFile(roadmapPath, JSON.stringify(roadmapData, null, 2));
      
      console.log(`✅ Roadmap data updated: ${roadmapPath}`);
      console.log(`   Backup saved: ${backupPath}`);
      
    } catch (error) {
      console.log('⚠️ Could not update roadmap data:', error.message);
    }
  }

  /**
   * Run quick analysis
   */
  async runQuickAnalysis() {
    console.log('⚡ Running quick analysis...');
    
    try {
      const analyzer = new RoadmapAnalyzer(this.projectPath);
      const analysis = await analyzer.analyzeProject();
      
      // Quick summary
      console.log('\n⚡ QUICK ANALYSIS RESULTS');
      console.log('='.repeat(30));
      console.log(`Project Status: ${this.getProjectStatus(analysis)}`);
      console.log(`Files: ${analysis.structure.totalFiles}`);
      console.log(`Complexity: ${analysis.complexity.averageComplexity.toFixed(1)}`);
      console.log(`Features: ${analysis.features.completionRate}% complete`);
      console.log(`Hotspots: ${analysis.complexity.hotspots.length}`);
      console.log(`Recommendations: ${analysis.recommendations.priority.length}`);
      
      // Top issues
      if (analysis.complexity.hotspots.length > 0) {
        console.log('\n⚠️ TOP COMPLEXITY ISSUES:');
        analysis.complexity.hotspots.slice(0, 3).forEach((hotspot, index) => {
          console.log(`   ${index + 1}. ${path.basename(hotspot.file)} (${hotspot.complexity})`);
        });
      }
      
    } catch (error) {
      console.error('❌ Quick analysis failed:', error);
    }
  }

  /**
   * Get project status
   */
  getProjectStatus(analysis) {
    const completionRate = analysis.features.completionRate;
    const maintainability = analysis.complexity.maintainabilityIndex;
    
    if (completionRate >= 80 && maintainability >= 70) {
      return 'HEALTHY';
    } else if (completionRate >= 60 && maintainability >= 50) {
      return 'GOOD';
    } else if (completionRate >= 40 && maintainability >= 30) {
      return 'WARNING';
    } else {
      return 'CRITICAL';
    }
  }

  /**
   * Show help
   */
  showHelp() {
    console.log(`
🚀 AI Platform Roadmap Analyzer

Usage: node run-analysis.js [options]

Options:
  --quick          Run quick analysis only
  --update-roadmap Update roadmap data with analysis results
  --help           Show this help message

Examples:
  node run-analysis.js                    # Full analysis
  node run-analysis.js --quick            # Quick analysis
  node run-analysis.js --update-roadmap    # Analysis + update roadmap

Output:
  - analysis-results/analysis-[timestamp].json
  - analysis-results/analysis-[timestamp].html
  - data-central/roadmap/roadmap-data.json (if --update-roadmap)
    `);
  }
}

// CLI Handler
async function main() {
  const runner = new AnalysisRunner();
  const args = process.argv.slice(2);
  
  // Parse arguments
  const options = {
    quick: args.includes('--quick'),
    updateRoadmap: args.includes('--update-roadmap'),
    help: args.includes('--help')
  };
  
  // Show help
  if (options.help) {
    runner.showHelp();
    return;
  }
  
  // Run analysis
  if (options.quick) {
    await runner.runQuickAnalysis();
  } else {
    await runner.runAnalysis(options);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Analysis runner failed:', error);
    process.exit(1);
  });
}

module.exports = AnalysisRunner;
