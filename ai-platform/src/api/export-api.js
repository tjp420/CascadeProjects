/**
 * Export API endpoints for GGUF roadmap data
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const GGUFRoadmapAnalyzer = require('../core/GGUFRoadmapAnalyzer');

/**
 * Setup export API routes
 */
function setupExportAPIs(app) {
  // GGUF Export API
  app.get('/api/gguf/export/json', async (req, res) => {
    try {
      console.log('📤 Starting GGUF data export...');
      
      // Read GGUF data directly for export
      const fs = require('fs').promises;
      const path = require('path');
      const ggufPath = path.join(__dirname, '../../data/roadmap/gguf-roadmap-data.json');
      
      try {
        const ggufContent = await fs.readFile(ggufPath, 'utf8');
        const ggufData = JSON.parse(ggufContent);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="gguf-roadmap-analysis-${new Date().toISOString().split('T')[0]}.json"`);
        
        res.json({
          type: 'gguf-roadmap-comprehensive-analysis',
          title: 'GGUF-Powered Comprehensive Roadmap Analysis',
          generatedAt: new Date().toISOString(),
          generatedBy: 'Enhanced GGUF Roadmap Analyzer AI',
          data: ggufData,
          timestamp: new Date().toISOString()
        });
      } catch (dataError) {
        console.error('❌ Failed to read GGUF data:', dataError);
        res.status(500).json({
          success: false,
          error: 'Failed to read GGUF data',
          message: dataError.message
        });
      }
    } catch (error) {
      console.error('❌ GGUF export failed:', error);
      res.status(500).json({
        success: false,
        error: 'GGUF export failed',
        message: error.message
      });
    }
  });

  // GGUF Comparison Export API
  app.get('/api/gguf/export/comparison', async (req, res) => {
    try {
      console.log('📊 Starting GGUF comparison export...');
      
      // Read GGUF data for comparison
      const fs = require('fs').promises;
      const path = require('path');
      const ggufPath = path.join(__dirname, '../../data/roadmap/gguf-roadmap-data.json');
      
      try {
        const ggufContent = await fs.readFile(ggufPath, 'utf8');
        const ggufData = JSON.parse(ggufContent);
        
        const comparisonData = {
          type: 'gguf-roadmap-comparison-report',
          title: 'GGUF Roadmap Comparison Analysis',
          generatedAt: new Date().toISOString(),
          generatedBy: 'Enhanced GGUF Roadmap Analyzer AI',
          ggufData: ggufData,
          comparison: {
            dataSource: 'gguf',
            analysisDate: new Date().toISOString(),
            summary: 'GGUF-powered roadmap analysis with comprehensive insights',
            metrics: {
              totalFeatures: ggufData.projectOverview?.totalFeatures ?? null,
              completedFeatures: ggufData.projectOverview?.completedFeatures ?? null,
              completionRate: ggufData.projectOverview?.completionRate ?? null,
              projectHealth: ggufData.projectOverview?.projectHealth ?? null
            }
          },
          timestamp: new Date().toISOString()
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="gguf-roadmap-comparison-${new Date().toISOString().split('T')[0]}.json"`);
        
        res.json(comparisonData);
      } catch (dataError) {
        console.error('❌ Failed to read GGUF data for comparison:', dataError);
        res.status(500).json({
          success: false,
          error: 'Failed to read GGUF data for comparison',
          message: dataError.message
        });
      }
    } catch (error) {
      console.error('❌ GGUF comparison export failed:', error);
      res.status(500).json({
        success: false,
        error: 'GGUF comparison export failed',
        message: error.message
      });
    }
  });

  // GGUF Data Loading API
  app.get('/api/roadmap/data', async (req, res) => {
    try {
      const type = req.query.type || 'gguf';
      console.log(`📋 Loading roadmap data for type: ${type}`);

      if (type === 'gguf') {
        const ggufPath = path.join(__dirname, '../../data/roadmap/gguf-roadmap-data.json');
        const fallbackPath = path.join(__dirname, '../../web/data/cascade-roadmap-sample.json');
        try {
          let ggufData;
          try {
            const ggufContent = await fs.readFile(ggufPath, 'utf8');
            ggufData = JSON.parse(ggufContent);
          } catch {
            const fallbackContent = await fs.readFile(fallbackPath, 'utf8');
            ggufData = JSON.parse(fallbackContent);
          }

          res.json({
            success: true,
            type: 'gguf',
            data: ggufData,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Failed to load GGUF data:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to load GGUF data',
            message: error.message
          });
        }
      } else if (type === 'ai-powered') {
        const aiPath = path.join(__dirname, '../../docs/roadmap-reports/ai-powered-roadmap-report-2026-05-22-000306.json');
        try {
          const aiContent = await fs.readFile(aiPath, 'utf8');
          const aiData = JSON.parse(aiContent);
          
          res.json({
            success: true,
            type: 'ai-powered',
            data: aiData,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('❌ Failed to load AI-powered data:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to load AI-powered data',
            message: error.message
          });
        }
      } else {
        res.status(400).json({
          error: 'Invalid type parameter',
          supportedTypes: ['gguf', 'ai-powered']
        });
      }
      
    } catch (error) {
      console.error('❌ Roadmap data loading failed:', error);
      res.status(500).json({
        success: false,
        error: 'Roadmap data loading failed',
        message: error.message
      });
    }
  });
}

module.exports = setupExportAPIs;
