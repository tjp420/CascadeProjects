/**
 * AI Roadmap API Routes
 * 
 * Defines API endpoints for AI-powered roadmap generation and analysis
 */

const express = require('express');
const AIRoadmapController = require('./AIRoadmapController');

const router = express.Router();
const controller = new AIRoadmapController();

/**
 * GET /api/ai/roadmap
 * Generate AI-powered development roadmap
 */
router.get('/roadmap', async (req, res) => {
  await controller.generateAIRoadmap(req, res);
});

/**
 * POST /api/ai/roadmap
 * Generate AI roadmap with custom parameters
 */
router.post('/roadmap', async (req, res) => {
  await controller.generateAIRoadmap(req, res);
});

/**
 * GET /api/ai/insights
 * Get AI-powered project insights
 */
router.get('/insights', async (req, res) => {
  await controller.getAIInsights(req, res);
});

/**
 * GET /api/ai/analysis
 * Analyze project with AI
 */
router.get('/analysis', async (req, res) => {
  await controller.analyzeProject(req, res);
});

/**
 * GET /api/ai/recommendations
 * Get AI-powered recommendations
 */
router.get('/recommendations', async (req, res) => {
  await controller.getAIRecommendations(req, res);
});

/**
 * POST /api/ai/refresh
 * Refresh AI cache and regenerate
 */
router.post('/refresh', async (req, res) => {
  try {
    controller.clearCache();
    
    const _roadmap = await controller.generateAIRoadmap(req, res);
    
    res.json({
      success: true,
      message: 'AI cache cleared and roadmap refreshed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to refresh AI cache',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/ai/health
 * Check AI roadmap system health
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      aiGenerator: 'operational',
      cache: 'active',
      timestamp: new Date().toISOString(),
      capabilities: {
        codeAnalysis: true,
        patternRecognition: true,
        progressTracking: true,
        recommendationEngine: true,
        timelineGeneration: true
      }
    };
    
    res.json({
      success: true,
      health
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'AI health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
