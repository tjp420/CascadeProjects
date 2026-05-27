const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// Serve static files
app.use(express.static(path.join(__dirname, '../web')));

// Main route - serve dashboard
app.get('/', (req, res) => {
  res.sendFile('dashboard.html', { root: path.join(__dirname, '../web') });
});

// AI Dashboard route
app.get('/ai_dashboard.html', (req, res) => {
  res.sendFile('ai_dashboard.html', { root: path.join(__dirname, '../web') });
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/ai-build', (req, res) => {
  res.json({
    success: true,
    message: 'AI build endpoint ready',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AI Platform Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🤖 AI System: Integrated and ready`);
});
