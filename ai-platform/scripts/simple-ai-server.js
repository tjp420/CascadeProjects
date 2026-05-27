#!/usr/bin/env node

/**
 * Simple AI Server with CORS Support
 * 
 * This script starts a simple AI server on port 3002 with proper CORS headers
 * to fix the console errors in the dashboard.
 */

const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS for all routes
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'AI Server is running' });
});

// AI Analysis endpoint
app.get('/api/ai/analysis', (req, res) => {
    res.json({
        success: true,
        analysis: {
            projectHealth: 'Excellent',
            developmentVelocity: 'High',
            technicalDebt: 'Low',
            riskLevel: 'Low',
            recommendations: [
                'Continue current development pace',
                'Focus on testing coverage',
                'Monitor technical debt'
            ]
        }
    });
});

// AI Recommendations endpoint
app.get('/api/ai/recommendations', (req, res) => {
    res.json({
        success: true,
        recommendations: [
            {
                action: 'Improve test coverage',
                priority: 'high',
                description: 'Increase test coverage from 78% to 85%',
                impact: 'High'
            },
            {
                action: 'Update dependencies',
                priority: 'medium',
                description: 'Update 3 outdated dependencies',
                impact: 'Medium'
            },
            {
                action: 'Refactor legacy code',
                priority: 'low',
                description: 'Refactor 5 legacy code modules',
                impact: 'Low'
            }
        ]
    });
});

// AI Insights endpoint
app.get('/api/ai/insights', (req, res) => {
    res.json({
        success: true,
        insights: {
            projectHealth: 'Excellent',
            developmentMetrics: {
                velocity: 'High',
                quality: '85.6%',
                coverage: '78.4%',
                security: '92.3%'
            },
            predictions: {
                nextMilestone: 'Q3 2026',
                estimatedCompletion: 'Q4 2026',
                riskFactors: ['Low', 'Low', 'Medium']
            },
            recommendations: [
                'Maintain current development velocity',
                'Focus on security improvements',
                'Plan for production deployment'
            ]
        }
    });
});

// AI Roadmap endpoint
app.get('/api/ai/roadmap', (req, res) => {
    res.json({
        success: true,
        roadmap: {
            phases: [
                { name: 'Foundation', status: 'completed', completion: 100 },
                { name: 'Data Processing', status: 'completed', completion: 100 },
                { name: 'Integration', status: 'completed', completion: 100 },
                { name: 'Enhancement', status: 'in-progress', completion: 66 },
                { name: 'Production', status: 'upcoming', completion: 0 }
            ],
            metrics: {
                totalFeatures: 47,
                completedFeatures: 31,
                inProgressFeatures: 0,
                completionRate: '65.9%'
            }
        },
        aiInsights: {
            projectHealth: 'Excellent',
            developmentVelocity: 'High',
            technicalDebt: 'Low',
            riskLevel: 'Low'
        },
        aiConfidence: 95,
        predictions: {
            nextMilestone: 'Phase 4 Completion',
            estimatedDate: 'Q3 2026',
            confidence: 89
        },
        recommendations: [
            'Continue current development pace',
            'Focus on Phase 4 completion',
            'Plan for Phase 5 production'
        ]
    });
});

// Mock AI endpoints for dashboard
app.get('/api/ai/mock-autofix', (req, res) => {
    res.json({
        success: true,
        fixed: true,
        issuesFixed: 5,
        message: 'Mock data auto-fixed successfully'
    });
});

app.get('/api/ai/mock-insights', (req, res) => {
    res.json({
        success: true,
        insights: {
            dataQuality: 'Good',
            processingEfficiency: 'High',
            optimizationOpportunities: 3
        }
    });
});

app.get('/api/ai/mock-generation', (req, res) => {
    res.json({
        success: true,
        generated: true,
        recordsGenerated: 100,
        message: 'Mock data generated successfully'
    });
});

// Start server
const PORT = 3002;
app.listen(PORT, () => {
    console.log('🤖 Simple AI Server running on port 3002');
    console.log('📊 Dashboard: http://localhost:3000/dashboard.html');
    console.log('🔗 AI Endpoints: http://localhost:3002/api/ai/*');
    console.log('✅ CORS enabled for localhost:3000');
    console.log('');
    console.log('📋 Available endpoints:');
    console.log('   GET /health - Server health check');
    console.log('   GET /api/ai/analysis - AI project analysis');
    console.log('   GET /api/ai/recommendations - AI recommendations');
    console.log('   GET /api/ai/insights - AI insights');
    console.log('   GET /api/ai/roadmap - AI roadmap analysis');
    console.log('   GET /api/ai/mock-autofix - Mock auto-fix');
    console.log('   GET /api/ai/mock-insights - Mock insights');
    console.log('   GET /api/ai/mock-generation - Mock data generation');
    console.log('');
    console.log('🚀 AI Server is ready to serve dashboard requests!');
});

// Handle errors gracefully
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});
