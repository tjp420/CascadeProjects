#!/usr/bin/env node

/**
 * Test AI Server
 * 
 * Standalone server to test AI roadmap functionality
 */

const express = require('express');
const path = require('path');

// Import AI components
const AIRoadmapController = require('../server/api/ai/AIRoadmapController');
const aiRoutes = require('../server/api/ai/AIRoadmapRoutes');

const app = express();
const PORT = process.env.PORT || 3002; // Use different port

// Middleware
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'AI Test Server is running'
  });
});

// Mount AI routes
app.use('/api/ai', aiRoutes);

// Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/dashboard.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Cannot ${req.method} ${req.path}`,
    availableEndpoints: [
      '/health',
      '/api/ai/roadmap',
      '/api/ai/insights',
      '/api/ai/analysis',
      '/api/ai/recommendations',
      '/api/ai/health'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🤖 AI Test Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`🔗 AI Endpoints: http://localhost:${PORT}/api/ai/*`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log('   GET /health - Server health check');
  console.log('   GET /api/ai/roadmap - Generate AI roadmap');
  console.log('   GET /api/ai/insights - Get AI insights');
  console.log('   GET /api/ai/analysis - Analyze project with AI');
  console.log('   GET /api/ai/recommendations - Get AI recommendations');
  console.log('   POST /api/ai/refresh - Refresh AI cache');
  console.log('   GET /api/ai/health - Check AI system health');
  console.log('');
});

module.exports = app;
