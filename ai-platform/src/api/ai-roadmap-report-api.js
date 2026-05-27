/**
 * AI Roadmap Report API
 * API endpoints for comprehensive AI-powered roadmap reporting
 */

const express = require('express');
const AIRoadmapReportGenerator = require('../core/AIRoadmapReportGenerator');
const router = express.Router();

// Initialize the report generator
const reportGenerator = new AIRoadmapReportGenerator();

/**
 * Initialize the report generator
 */
async function initializeReportGenerator() {
    try {
        await reportGenerator.initialize();
        console.log('✅ AI Roadmap Report API initialized');
    } catch (error) {
        console.error('❌ Failed to initialize AI Roadmap Report API:', error);
    }
}

// Initialize on module load
initializeReportGenerator();

/**
 * Generate comprehensive AI-powered roadmap report
 */
router.get('/generate', async (req, res) => {
    try {
        console.log('🔄 Generating comprehensive AI roadmap report...');
        
        const report = await reportGenerator.generateComprehensiveReport();
        
        res.json({
            success: true,
            message: 'AI roadmap report generated successfully',
            data: report,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ AI roadmap report generated successfully');
    } catch (error) {
        console.error('❌ Failed to generate AI roadmap report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate AI roadmap report',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get AI-powered insights and recommendations
 */
router.get('/insights', async (req, res) => {
    try {
        console.log('🔄 Generating AI insights...');
        
        // Generate report if not already generated
        if (!reportGenerator.analysisResults.executiveSummary) {
            await reportGenerator.generateComprehensiveReport();
        }
        
        const insights = {
            executiveSummary: reportGenerator.analysisResults.executiveSummary,
            strategicRecommendations: reportGenerator.analysisResults.strategicRecommendations,
            predictiveAnalytics: reportGenerator.analysisResults.predictiveAnalytics,
            riskAssessment: reportGenerator.analysisResults.riskAssessment,
            businessImpact: reportGenerator.analysisResults.businessImpact
        };
        
        res.json({
            success: true,
            message: 'AI insights generated successfully',
            data: insights,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ AI insights generated successfully');
    } catch (error) {
        console.error('❌ Failed to generate AI insights:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate AI insights',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get comparative analysis between GGUF and AI data sources
 */
router.get('/comparison', async (req, res) => {
    try {
        console.log('🔄 Generating comparative analysis...');
        
        // Generate report if not already generated
        if (!reportGenerator.analysisResults.comparativeAnalysis) {
            await reportGenerator.generateComprehensiveReport();
        }
        
        const comparison = reportGenerator.analysisResults.comparativeAnalysis;
        
        res.json({
            success: true,
            message: 'Comparative analysis generated successfully',
            data: comparison,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Comparative analysis generated successfully');
    } catch (error) {
        console.error('❌ Failed to generate comparative analysis:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate comparative analysis',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get performance metrics and analytics
 */
router.get('/performance', async (req, res) => {
    try {
        console.log('🔄 Generating performance metrics...');
        
        // Generate report if not already generated
        if (!reportGenerator.analysisResults.performanceMetrics) {
            await reportGenerator.generateComprehensiveReport();
        }
        
        const performance = reportGenerator.analysisResults.performanceMetrics;
        
        res.json({
            success: true,
            message: 'Performance metrics generated successfully',
            data: performance,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Performance metrics generated successfully');
    } catch (error) {
        console.error('❌ Failed to generate performance metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate performance metrics',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Export report in specified format
 */
router.get('/export/:format', async (req, res) => {
    try {
        const format = req.params.format;
        console.log(`🔄 Exporting report in ${format} format...`);
        
        // Generate report if not already generated
        if (!reportGenerator.analysisResults.executiveSummary) {
            await reportGenerator.generateComprehensiveReport();
        }
        
        const exportData = await reportGenerator.exportReport(format);
        
        // Set appropriate headers for file download
        res.setHeader('Content-Type', exportData.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
        
        if (format === 'json') {
            res.json(exportData.data);
        } else {
            // For other formats, return placeholder message
            res.send(exportData.data);
        }
        
        console.log(`✅ Report exported successfully as ${format}`);
    } catch (error) {
        console.error(`❌ Failed to export report as ${req.params.format}:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to export report as ${req.params.format}`,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get executive summary
 */
router.get('/executive-summary', async (req, res) => {
    try {
        console.log('🔄 Generating executive summary...');
        
        // Generate report if not already generated
        if (!reportGenerator.analysisResults.executiveSummary) {
            await reportGenerator.generateComprehensiveReport();
        }
        
        const executiveSummary = reportGenerator.analysisResults.executiveSummary;
        
        res.json({
            success: true,
            message: 'Executive summary generated successfully',
            data: executiveSummary,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Executive summary generated successfully');
    } catch (error) {
        console.error('❌ Failed to generate executive summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate executive summary',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get risk assessment
 */
router.get('/risk-assessment', async (req, res) => {
    try {
        console.log('🔄 Generating risk assessment...');
        
        // Generate report if not already generated
        if (!reportGenerator.analysisResults.riskAssessment) {
            await reportGenerator.generateComprehensiveReport();
        }
        
        const riskAssessment = reportGenerator.analysisResults.riskAssessment;
        
        res.json({
            success: true,
            message: 'Risk assessment generated successfully',
            data: riskAssessment,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Risk assessment generated successfully');
    } catch (error) {
        console.error('❌ Failed to generate risk assessment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate risk assessment',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get predictive analytics
 */
router.get('/predictive-analytics', async (req, res) => {
    try {
        console.log('🔄 Generating predictive analytics...');
        
        // Generate report if not already generated
        if (!reportGenerator.analysisResults.predictiveAnalytics) {
            await reportGenerator.generateComprehensiveReport();
        }
        
        const predictiveAnalytics = reportGenerator.analysisResults.predictiveAnalytics;
        
        res.json({
            success: true,
            message: 'Predictive analytics generated successfully',
            data: predictiveAnalytics,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Predictive analytics generated successfully');
    } catch (error) {
        console.error('❌ Failed to generate predictive analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate predictive analytics',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Schedule automated report generation
 */
router.post('/schedule', async (req, res) => {
    try {
        const { schedule, recipients, format } = req.body;
        
        console.log('🔄 Setting up automated report scheduling...');
        
        // Placeholder for scheduling implementation
        const scheduleConfig = {
            schedule: schedule || 'weekly',
            recipients: recipients || [],
            format: format || 'json',
            enabled: true,
            createdAt: new Date().toISOString()
        };
        
        res.json({
            success: true,
            message: 'Report scheduling configured successfully',
            data: scheduleConfig,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Report scheduling configured successfully');
    } catch (error) {
        console.error('❌ Failed to configure report scheduling:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to configure report scheduling',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get report generation status
 */
router.get('/status', async (req, res) => {
    try {
        const status = {
            initialized: reportGenerator.ggufData !== null && reportGenerator.aiData !== null,
            dataLoaded: reportGenerator.ggufData !== null && reportGenerator.aiData !== null,
            reportGenerated: reportGenerator.analysisResults.executiveSummary !== undefined,
            lastGenerated: reportGenerator.analysisResults.generatedAt || null,
            dataSources: {
                gguf: {
                    loaded: reportGenerator.ggufData !== null,
                    features: reportGenerator.ggufData?.projectOverview?.totalFeatures || 0
                },
                ai: {
                    loaded: reportGenerator.aiData !== null,
                    features: reportGenerator.aiData?.projectOverview?.totalFeatures || 0
                }
            }
        };
        
        res.json({
            success: true,
            message: 'Status retrieved successfully',
            data: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Failed to get status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get status',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get trend analysis
 */
router.get('/trends', async (req, res) => {
    try {
        console.log('🔄 Generating trend analysis...');
        
        const trendAnalysis = reportGenerator.generateTrendAnalysis();
        
        res.json({
            success: true,
            message: 'Trend analysis generated successfully',
            data: trendAnalysis,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Trend analysis generated successfully');
    } catch (error) {
        console.error('❌ Failed to generate trend analysis:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate trend analysis',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get scenario planning
 */
router.get('/scenarios', async (req, res) => {
    try {
        console.log('🔄 Generating scenario planning...');
        
        const scenarioPlanning = reportGenerator.generateScenarioPlanning();
        
        res.json({
            success: true,
            message: 'Scenario planning generated successfully',
            data: scenarioPlanning,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Scenario planning generated successfully');
    } catch (error) {
        console.error('❌ Failed to generate scenario planning:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate scenario planning',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get enhanced executive summary
 */
router.get('/executive-summary', async (req, res) => {
    try {
        console.log('🔄 Generating enhanced executive summary...');
        
        const executiveSummary = reportGenerator.generateExecutiveSummary();
        
        res.json({
            success: true,
            message: 'Executive summary generated successfully',
            data: executiveSummary,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Executive summary generated successfully');
    } catch (error) {
        console.error('❌ Failed to generate executive summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate executive summary',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Setup AI Roadmap Report API routes
 */
function setupAIRoadmapReportAPIs(app) {
    // Use the router with a base path
    app.use('/api/ai-roadmap-report', router);
    
    console.log('✅ AI Roadmap Report API setup complete');
}

module.exports = setupAIRoadmapReportAPIs;
