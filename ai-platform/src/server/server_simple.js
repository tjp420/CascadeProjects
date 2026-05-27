/**
 * Simple Node.js Server for AI Coding Intelligence Dashboard
 * ES6 Module Compatible - Properly serves ES6 modules with correct MIME types
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || 'localhost';

// MIME types for different file extensions
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'text/plain';
}

function serveFile(filePath, res) {
    const fullPath = path.join(__dirname, filePath);
  
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // File not found, try serving index.html for SPA routing
                if (!filePath.endsWith('.html') && !filePath.includes('.')) {
                    serveFile('index.html', res);
                    return;
                }
                sendError(res, 404, 'File not found');
            } else {
                sendError(res, 500, 'Internal server error');
            }
            return;
        }

        const mimeType = getMimeType(filePath);
        res.writeHead(200, {
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(data);
    });
}

function sendError(res, statusCode, message) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end(message);
}

function handleRequest(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    let filePath = parsedUrl.pathname;

    // Remove leading slash and handle root
    if (filePath === '/') {
        filePath = '/index.html';
    } else {
        filePath = decodeURIComponent(filePath.substring(1));
    }

    // Security check - prevent directory traversal
    if (filePath.includes('..') || filePath.includes('\\')) {
        sendError(res, 400, 'Bad request');
        return;
    }

    // Handle OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // Only handle GET requests
    if (req.method !== 'GET') {
        sendError(res, 405, 'Method not allowed');
        return;
    }

    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} -> ${filePath}`);

    serveFile(filePath, res);
}

// Create and start server
const server = http.createServer((req, res) => {
    handleRequest(req, res);
});

server.listen(PORT, HOST, () => {
    console.log('🚀 AI Coding Intelligence Dashboard Server Started');
    console.log('📁 Serving directory:', __dirname);
    console.log('🌐 Server running at: http://' + HOST + ':' + PORT);
    console.log('📚 Documentation portal: http://' + HOST + ':' + PORT + '/documentation_portal.html');
    console.log('📊 Main dashboard: http://' + HOST + ':' + PORT + '/index.html');
    console.log('⏹️  Press Ctrl+C to stop the server');
    console.log('-'.repeat(60));
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log('💡 Try using a different port: node server_simple.js 8001');
    } else {
        console.error('❌ Server error:', err);
    }
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n⏹️  Server stopped by user');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n⏹️  Server terminated');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
