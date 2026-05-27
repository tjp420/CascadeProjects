/**
 * Development Roadmap API endpoints
 * Provides analysis for development roadmap with real project data
 */

const fs = require('fs').promises;
const path = require('path');

const GGUF_ROADMAP_PATH = path.join(__dirname, '../../data/roadmap/gguf-roadmap-data.json');

async function loadGgufRoadmapData() {
  const content = await fs.readFile(GGUF_ROADMAP_PATH, 'utf8');
  return JSON.parse(content);
}

/**
 * Setup development roadmap API routes
 */
function setupDevelopmentRoadmapAPIs(app) {
  // Development Roadmap Analysis API
  app.get('/api/development-roadmap/analyze', async (req, res) => {
    try {
      console.log('🔍 Starting development roadmap analysis...');
      
      const ggufData = await loadGgufRoadmapData();
      
      // Generate comprehensive analysis
      const analysis = generateDevelopmentRoadmapAnalysis(ggufData);
      
      res.json({
        success: true,
        report: analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Development roadmap analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'Development roadmap analysis failed',
        message: error.message
      });
    }
  });

  // Development Roadmap Data API
  app.get('/api/development-roadmap/data', async (req, res) => {
    try {
      console.log('📋 Loading development roadmap data...');
      
      const ggufData = await loadGgufRoadmapData();
      
      res.json({
        success: true,
        type: 'development-roadmap',
        data: ggufData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to load development roadmap data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load development roadmap data',
        message: error.message
      });
    }
  });

  // Legacy Roadmap Data API (for backward compatibility)
  app.get('/api/roadmap/data', async (req, res) => {
    try {
      console.log('📋 Loading roadmap data (legacy endpoint)...');
      const type = req.query.type || 'gguf';
      
      let data;
      if (type === 'gguf') {
        data = await loadGgufRoadmapData();
      } else if (type === 'ai-powered') {
        // Try to load AI-powered data
        const aiPoweredPath = path.join(__dirname, '../../docs/roadmap-reports/ai-powered-roadmap-report-2026-05-22-000306.json');
        try {
          const aiPoweredContent = await fs.readFile(aiPoweredPath, 'utf8');
          data = JSON.parse(aiPoweredContent);
        } catch (aiError) {
          data = await loadGgufRoadmapData();
        }
      }
      
      res.json({
        success: true,
        type: type,
        data: data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to load roadmap data for type', req.query.type, ':', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load roadmap data',
        message: error.message
      });
    }
  });

  // Development Roadmap Export API
  app.get('/api/development-roadmap/export', async (req, res) => {
    try {
      console.log('📤 Starting development roadmap export...');
      
      const ggufData = await loadGgufRoadmapData();
      
      // Generate analysis for export
      const analysis = generateDevelopmentRoadmapAnalysis(ggufData);
      
      // Set proper headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="development-roadmap-analysis-${new Date().toISOString().split('T')[0]}.json"`);
      
      res.json({
        type: 'development-roadmap-comprehensive-analysis',
        title: 'Development Roadmap Analysis Report',
        generatedAt: new Date().toISOString(),
        generatedBy: 'Development Roadmap Analyzer',
        data: ggufData,
        analysis: analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Development roadmap export failed:', error);
      res.status(500).json({
        success: false,
        error: 'Development roadmap export failed',
        message: error.message
      });
    }
  });

  // GGUF Report Data API
  app.get('/api/gguf/report', async (req, res) => {
    try {
      console.log('📋 Loading GGUF report data...');
      const ggufReportData = await loadGgufRoadmapData();
      
      res.json({
        success: true,
        type: 'gguf-report',
        data: ggufReportData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to load GGUF report data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load GGUF report data',
        message: error.message
      });
    }
  });
}

/**
 * Generate comprehensive development roadmap analysis
 */
function generateDevelopmentRoadmapAnalysis(ggufData) {
  const projectOverview = ggufData.projectOverview || {};
  const developmentPhases = ggufData.developmentPhases || [];
  const releaseTimeline = ggufData.releaseTimeline || [];
  const featureCategories = ggufData.featureCategories || [];
  const keyMilestones = ggufData.keyMilestones || [];
  const ggufAIInsights = ggufData.ggufAIInsights || {};
  const ggufAIRecommendations = ggufData.ggufAIRecommendations || [];
  const performanceMetrics = ggufData.performanceMetrics || {};
  const nextSteps = ggufData.nextSteps || [];

  return {
    type: 'development-roadmap-analysis',
    title: 'Development Roadmap Analysis',
    generatedAt: new Date().toISOString(),
    generatedBy: 'Development Roadmap Analyzer',
    
    executiveSummary: {
      totalFeatures: projectOverview.totalFeatures ?? null,
      completedFeatures: projectOverview.completedFeatures ?? null,
      inProgressFeatures: projectOverview.inProgressFeatures ?? null,
      plannedFeatures: projectOverview.plannedFeatures ?? null,
      completionRate: projectOverview.completionRate ?? null,
      overallProgress: projectOverview.overallProgress ?? null,
      projectHealth: projectOverview.projectHealth ?? null,
      developmentVelocity: projectOverview.developmentVelocity ?? null,
      teamProductivity: projectOverview.teamProductivity ?? null
    },

    developmentPhases: developmentPhases.map(phase => ({
      phase: phase.phase,
      title: phase.title,
      status: phase.status,
      progress: phase.progress || 0,
      startDate: phase.startDate,
      endDate: phase.endDate,
      description: phase.description,
      features: phase.features || [],
      deliverables: phase.deliverables || [],
      metrics: phase.metrics || {},
      milestones: phase.milestones || [],
      aiConfidence: phase.aiConfidence || 0,
      ggufInsights: phase.ggufInsights || ''
    })),

    timeline: [
      ...developmentPhases.map(phase => ({
        date: phase.endDate,
        title: phase.title,
        description: phase.description,
        status: phase.status,
        progress: phase.progress || 0
      })),
      ...releaseTimeline.map(release => ({
        date: release.date,
        title: release.title,
        description: release.description,
        status: release.status,
        features: release.features || []
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date)),

    featureCategories: featureCategories.map(category => ({
      category: category.category,
      totalFeatures: category.totalFeatures || 0,
      completedFeatures: category.completedFeatures || 0,
      completionRate: category.completionRate || '0%',
      confidence: category.confidence || 0,
      description: category.description || ''
    })),

    keyMilestones: keyMilestones.map(milestone => ({
      milestone: milestone.milestone,
      date: milestone.date,
      status: milestone.status,
      description: milestone.description,
      achievement: milestone.achievement || ''
    })),

    recommendations: ggufAIRecommendations.map(rec => ({
      priority: rec.priority || 'medium',
      action: rec.action || '',
      description: rec.description || '',
      impact: rec.impact || 'Medium',
      effort: rec.effort || 'Medium',
      timeline: rec.timeline || 'Next Phase'
    })),

    metrics: {
      phaseMetrics: {
        completedPhases: developmentPhases.filter(p => p.status === 'completed').length,
        inProgressPhases: developmentPhases.filter(p => p.status === 'in-progress').length,
        plannedPhases: developmentPhases.filter(p => p.status === 'planned').length,
        totalPhases: developmentPhases.length
      },
      performanceMetrics: performanceMetrics,
      aiInsights: ggufAIInsights,
      nextSteps: nextSteps
    },

    riskAssessment: {
      technicalRisk: 'Low',
      scheduleRisk: 'Medium',
      resourceRisk: 'Low',
      marketRisk: 'Low',
      overallRisk: 'Low'
    },

    privacyAndSecurity: {
      localProcessing: 'All analysis stays on your machine',
      completePrivacy: 'No data sent to external services',
      secure: 'No external security risks',
      offline: 'Works without internet connection',
      control: 'You have complete control',
      cost: 'No API costs or subscription fees'
    }
  }
}

module.exports = setupDevelopmentRoadmapAPIs;
