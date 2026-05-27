const fs = require('fs');
const http = require('http');
const path = require('path');

const port = 3003;
const rootDir = __dirname;

const server = http.createServer((req, res) => {
    // Parse URL and remove query parameters for file path
    const url = new URL(req.url, `http://localhost:${port}`);
    let filePath = path.join(rootDir, url.pathname);
    
    // Default to index.html for root requests
    if (filePath === path.join(rootDir, '/') || filePath === path.join(rootDir, '')) {
        filePath = path.join(rootDir, 'src/pages/index.html');
    }
    
    // Handle specific page requests
    if (url.pathname === '/settings.html') {
        filePath = path.join(rootDir, 'src/pages/settings.html');
    } else if (url.pathname === '/team.html') {
        filePath = path.join(rootDir, 'src/pages/team.html');
    }
    
    // Handle component files
    if (url.pathname.startsWith('/src/components/')) {
        filePath = path.join(rootDir, url.pathname);
    }
    
    // Handle web files
    if (url.pathname.startsWith('/web/')) {
        filePath = path.join(rootDir, url.pathname);
    }
    
    // Get file extension
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.svg':
            contentType = 'image/svg+xml';
            break;
    }
    
    // Read file
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                // File not found, try index.html
                fs.readFile(path.join(rootDir, 'src/pages/index.html'), (err, content) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Server Error');
                    } else {
                        res.writeHead(200, { 'Content-Type': contentType });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(port, () => {
    console.log('========================================');
    console.log('  AI Coding Intelligence Dashboard');
    console.log('  Clean Version - Optimized Structure');
    console.log('========================================');
    console.log('Server running on port ' + port);
    console.log('URL: http://localhost:' + port + '/src/pages/index.html');
    console.log('Dashboard: http://localhost:' + port + '/src/pages/dashboard.html');
    console.log('Pricing: http://localhost:' + port + '/billing/pricing.html');
    console.log('========================================');
});
