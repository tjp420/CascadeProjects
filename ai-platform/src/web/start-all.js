/**
 * Start All Servers - API + Dashboard
 * Starts both the API server (port 8081) and Dashboard server (port 8000)
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting AI Coding Intelligence Dashboard Servers...\n');

// Start API Server (port 8081)
console.log('📡 Starting API Server on port 8081...');
const apiServer = spawn('node', ['simple-api-server.js'], {
    cwd: __dirname,
    stdio: 'pipe'
});

apiServer.stdout.on('data', (data) => {
    console.log(`[API] ${data.toString().trim()}`);
});

apiServer.stderr.on('data', (data) => {
    console.error(`[API ERROR] ${data.toString().trim()}`);
});

// Start Dashboard Server (port 8000)
setTimeout(() => {
    console.log('\n🌐 Starting Dashboard Server on port 8000...');
    const dashboardServer = spawn('node', ['start-dashboard.js'], {
        cwd: __dirname,
        stdio: 'pipe'
    });

    dashboardServer.stdout.on('data', (data) => {
        console.log(`[DASHBOARD] ${data.toString().trim()}`);
    });

    dashboardServer.stderr.on('data', (data) => {
        console.error(`[DASHBOARD ERROR] ${data.toString().trim()}`);
    });

    setTimeout(() => {
        console.log('\n✅ Both servers are running!');
        console.log('🌐 Dashboard: http://localhost:8000');
        console.log('📊 API Server: http://localhost:8081');
        console.log('\n⏹️  Press Ctrl+C to stop both servers');
    }, 2000);
}, 2000);

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n⏹️  Shutting down servers...');
    apiServer.kill();
    process.exit(0);
});
