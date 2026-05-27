/**
 * Roadmap API Routes
 * 
 * Defines API endpoints for roadmap data with status protection integration
 */

const express = require('express');
const RoadmapController = require('./RoadmapController');
const { createStatusProtectionMiddleware } = require('../../middleware/statusProtection');

const router = express.Router();
const controller = new RoadmapController();

// Status protection middleware for all roadmap routes
const statusProtection = createStatusProtectionMiddleware({
  enabled: true,
  logCorrections: true,
  applyToRoutes: ['/api/roadmap'],
  contentType: 'application/json'
});

/**
 * GET /api/roadmap
 * Get current roadmap data with status protection
 */
router.get('/', async (req, res) => {
  await controller.getRoadmapData(req, res);
});

/**
 * POST /api/roadmap
 * Update roadmap data with automatic status protection correction
 */
router.post('/', statusProtection, async (req, res) => {
  await controller.updateRoadmapData(req, res);
});

/**
 * GET /api/roadmap/report
 * Generate roadmap report with status protection
 */
router.get('/report', async (req, res) => {
  await controller.generateRoadmapReport(req, res);
});

/**
 * POST /api/roadmap/report
 * Generate roadmap report from incoming data with status protection
 */
router.post('/report', statusProtection, async (req, res) => {
  await controller.generateRoadmapReport(req, res);
});

/**
 * GET /api/roadmap/status-protection
 * Get status protection information and system status
 */
router.get('/status-protection', async (req, res) => {
  await controller.getStatusProtectionInfo(req, res);
});

/**
 * POST /api/roadmap/validate
 * Validate and correct incoming roadmap data
 */
router.post('/validate', statusProtection, async (req, res) => {
  try {
    const StatusProtectionSystem = require('../../src/core/StatusProtectionSystem');
    const protectionSystem = new StatusProtectionSystem();
    
    const originalData = JSON.parse(JSON.stringify(req.body));
    const correctedData = await protectionSystem.validateAndCorrectData(req.body);
    
    const correctionsMade = JSON.stringify(originalData) !== JSON.stringify(correctedData);
    
    res.json({
      success: true,
      original: originalData,
      corrected: correctedData,
      correctionsMade,
      timestamp: new Date().toISOString(),
      protectionStatus: 'active'
    });
    
  } catch (error) {
    console.error('Validation Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to validate roadmap data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/roadmap/health
 * Check roadmap API health and status protection
 */
router.get('/health', async (req, res) => {
  try {
    const StatusProtectionSystem = require('../../src/core/StatusProtectionSystem');
    const protectionSystem = new StatusProtectionSystem();
    const verification = await protectionSystem.verifyCentralData();
    
    res.json({
      success: true,
      health: {
        status: verification.valid ? 'healthy' : 'vulnerable',
        statusProtection: 'active',
        centralData: verification.valid ? 'protected' : 'unprotected',
        timestamp: new Date().toISOString()
      },
      verification: verification
    });
    
  } catch (error) {
    console.error('Health Check Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check roadmap health',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
