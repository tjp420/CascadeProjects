/**
 * Local dashboard server — static web + dashboard stub APIs + WebSocket.
 * Prefer `npm run dashboard` (simplebeacon-server.js) for Simplebeacon routes.
 */
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const setupDashboardStubAPIs = require('./src/api/dashboard-stub-api');

const app = express();
const webRoot = path.join(__dirname, 'web');
const PORT = 54355;
const verboseRuntimeLogs = process.env.DEBUG_LOGS === 'true' || process.env.NODE_ENV === 'development';
const debugLog = (...args) => {
    if (verboseRuntimeLogs) {
        console.log(...args);
    }
};

app.use(express.json());

app.get('/favicon.ico', (_req, res) => {
    const icoPath = path.join(webRoot, 'favicon.ico');
    if (fs.existsSync(icoPath)) {
        res.type('image/png');
        return res.sendFile(icoPath);
    }
    res.status(404).end();
});

// Stub API routes must register before any /api static handler
setupDashboardStubAPIs(app, webRoot);

app.get('/api/mock-backend.js', (_req, res) => {
    res.sendFile(path.join(webRoot, 'api', 'mock-backend.js'));
});

app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API route not found',
        path: req.path,
        method: req.method,
        hint: 'Use npm run dashboard for Simplebeacon routes'
    });
});

app.use((req, res, next) => {
    if (/^\/(services|scripts|components|simplebeacon-dashboard)\/.*\.(js|css|html)$/i.test(req.path)
        || req.path.endsWith('.html')
        || (req.path.startsWith('/data/') && req.path.endsWith('.json'))) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
    }
    express.static(webRoot)(req, res, next);
});

app.get('/', (_req, res) => {
    const dashboardPath = path.join(webRoot, 'simplebeacon-dashboard/index.html');
    if (fs.existsSync(dashboardPath)) {
        return res.sendFile(dashboardPath);
    }
    res.status(404).send('Simplebeacon dashboard not found');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    if (request.url?.split('?')[0] !== '/ws') {
        socket.destroy();
        return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to dashboard WebSocket',
        timestamp: new Date().toISOString()
    }));
});

server.listen(PORT, () => {
    console.log('🚀 Dashboard server running on http://localhost:' + PORT);
    console.log('📊 Dashboard: http://localhost:' + PORT + '/');
    console.log('🔧 Stub APIs: /api/analytics, /api/security, /api/quality, …');
    console.log('🌐 WebSocket: ws://localhost:' + PORT + '/ws');
    console.log('💡 Full Simplebeacon stack: npm run dashboard');
});
