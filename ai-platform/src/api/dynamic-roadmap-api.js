/**
 * Dynamic Roadmap API - Provides real-time roadmap analysis based on actual project data
 * Replaces static mock data with live project structure and database analysis
 */

const path = require('path');
const fs = require('fs').promises;
const GlobalContextManager = require('../core/GlobalContextManager');
const RoadmapDataAnalyzer = require('../core/RoadmapDataAnalyzer');

class DynamicRoadmapAPI {
    constructor(app, globalContextManager) {
        this.app = app;
        this.globalContextManager = globalContextManager;
        this.RoadmapDataAnalyzer = require('../core/RoadmapDataAnalyzer');
        this.analyzer = new this.RoadmapDataAnalyzer(globalContextManager);
        this.setupRoutes();
    }

    setupRoutes() {
        // Main dynamic roadmap analysis endpoint
        this.app.get('/api/dynamic-roadmap/analyze', async (req, res) => {
            try {
                console.log('🔍 Starting dynamic roadmap analysis...');
                
                const analysis = await this.analyzer.analyzeProjectForRoadmap();
                
                res.json({
                    success: true,
                    analysis: analysis,
                    timestamp: new Date().toISOString(),
                    source: 'dynamic-analysis'
                });

                console.log('✅ Dynamic roadmap analysis completed successfully');

            } catch (error) {
                console.error('❌ Failed to perform dynamic roadmap analysis:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to analyze project for roadmap',
                    message: error.message
                });
            }
        });

        // Get project structure analysis
        this.app.get('/api/dynamic-roadmap/structure', async (req, res) => {
            try {
                const structure = await this.analyzer.analyzeProjectStructure();
                
                res.json({
                    success: true,
                    structure: structure,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Failed to analyze project structure:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to analyze project structure',
                    message: error.message
                });
            }
        });

        // Get codebase metrics
        this.app.get('/api/dynamic-roadmap/metrics', async (req, res) => {
            try {
                const metrics = await this.analyzer.analyzeCodebaseMetrics();
                
                res.json({
                    success: true,
                    metrics: metrics,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Failed to analyze codebase metrics:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to analyze codebase metrics',
                    message: error.message
                });
            }
        });

        // Get implemented features analysis
        this.app.get('/api/dynamic-roadmap/features', async (req, res) => {
            try {
                const features = await this.analyzer.analyzeImplementedFeatures();
                
                res.json({
                    success: true,
                    features: features,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Failed to analyze implemented features:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to analyze implemented features',
                    message: error.message
                });
            }
        });

        // Get development progress
        this.app.get('/api/dynamic-roadmap/progress', async (req, res) => {
            try {
                const progress = await this.analyzer.calculateDevelopmentProgress();
                
                res.json({
                    success: true,
                    progress: progress,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Failed to calculate development progress:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to calculate development progress',
                    message: error.message
                });
            }
        });

        // Get roadmap recommendations
        this.app.get('/api/dynamic-roadmap/recommendations', async (req, res) => {
            try {
                const recommendations = await this.analyzer.generateRoadmapRecommendations();
                
                res.json({
                    success: true,
                    recommendations: recommendations,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Failed to generate roadmap recommendations:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to generate roadmap recommendations',
                    message: error.message
                });
            }
        });

        // Get AI integration analysis
        this.app.get('/api/dynamic-roadmap/ai-integration', async (req, res) => {
            try {
                const aiIntegration = await this.analyzer.analyzeAIIntegration();
                
                res.json({
                    success: true,
                    aiIntegration: aiIntegration,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Failed to analyze AI integration:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to analyze AI integration',
                    message: error.message
                });
            }
        });

        // build-from-path is registered via setupBuildFromPathRoute() before static middleware

        // Refresh analysis cache
        this.app.post('/api/dynamic-roadmap/refresh', async (req, res) => {
            try {
                console.log('🔄 Refreshing dynamic roadmap analysis cache...');
                
                // Clear cache
                this.analyzer.analysisCache.clear();
                this.analyzer.lastAnalysisTime = null;
                
                // Perform fresh analysis
                const analysis = await this.analyzer.analyzeProjectForRoadmap();
                
                res.json({
                    success: true,
                    analysis: analysis,
                    timestamp: new Date().toISOString(),
                    message: 'Analysis cache refreshed successfully'
                });

                console.log('✅ Dynamic roadmap analysis cache refreshed');

            } catch (error) {
                console.error('❌ Failed to refresh analysis cache:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to refresh analysis cache',
                    message: error.message
                });
            }
        });

        // Compare with previous analysis (if available)
        this.app.get('/api/dynamic-roadmap/compare', async (req, res) => {
            try {
                const currentAnalysis = await this.analyzer.analyzeProjectForRoadmap();
                
                // For now, return current analysis with comparison placeholder
                // In a real implementation, you'd store previous analyses for comparison
                res.json({
                    success: true,
                    current: currentAnalysis,
                    previous: null, // Would be loaded from storage
                    comparison: {
                        changes: [],
                        progressDelta: 0,
                        newFeatures: [],
                        completedFeatures: []
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Failed to compare roadmap analyses:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to compare roadmap analyses',
                    message: error.message
                });
            }
        });
    }
}

module.exports = DynamicRoadmapAPI;
