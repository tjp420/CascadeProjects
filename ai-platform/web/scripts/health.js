/**
 * Health Check Endpoint
 * Implements comprehensive health monitoring for the AI Coding Intelligence Dashboard
 */

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 8000;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const VERSION = process.env.VERSION || '1.0.0';

// Health check metrics
const startTime = Date.now();
let requestCount = 0;
let errorCount = 0;
let lastHealthCheck = Date.now();

// System monitoring
function getSystemMetrics() {
    return {
        uptime: process.uptime(),
        memory: {
            used: process.memoryUsage(),
            total: os.totalmem(),
            free: os.freemem(),
            usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        },
        cpu: {
            loadAverage: os.loadavg(),
            cores: os.cpus().length
        },
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
    };
}

// Application health checks
function getApplicationHealth() {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: VERSION,
        environment: ENVIRONMENT,
        metrics: {
            startTime: new Date(startTime).toISOString(),
            requestCount,
            errorCount,
            errorRate: requestCount > 0 ? (errorCount / requestCount * 100).toFixed(2) : 0,
            lastHealthCheck: new Date(lastHealthCheck).toISOString()
        }
    };

    // Check essential files
    const essentialFiles = ['index.html', 'package.json', 'README.md'];
    const fileChecks = essentialFiles.map(file => {
        const filePath = path.join(__dirname, file);
        const exists = fs.existsSync(filePath);
        const stats = exists ? fs.statSync(filePath) : null;
        return {
            file,
            exists,
            size: stats ? stats.size : 0,
            modified: stats ? stats.mtime : null
        };
    });

    health.files = {
        essential: fileChecks,
        allPresent: fileChecks.every(check => check.exists)
    };

    // Check directories
    const essentialDirs = ['css', 'dashboard_components', 'api'];
    const dirChecks = essentialDirs.map(dir => {
        const dirPath = path.join(__dirname, dir);
        const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
        return { directory: dir, exists };
    });

    health.directories = {
        essential: dirChecks,
        allPresent: dirChecks.every(check => check.exists)
    };

    // Determine overall health status
    if (!health.files.allPresent || !health.directories.allPresent) {
        health.status = 'degraded';
    }

    if (parseFloat(health.metrics.errorRate) > 10) {
        health.status = 'unhealthy';
    }

    return health;
}

// Detailed health check
function getDetailedHealth() {
    const health = getApplicationHealth();
    const system = getSystemMetrics();

    return {
        ...health,
        system,
        performance: {
            responseTime: Date.now() - lastHealthCheck,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        },
        features: {
            analytics: true,
            errorTracking: true,
            performanceMonitoring: true,
            darkMode: true,
            fileAnalysis: true,
            technicalDebtAnalysis: true,
            reportGeneration: true
        },
        dependencies: {
            node: process.version,
            platform: os.platform(),
            arch: os.arch()
        }
    };
}

// Create HTTP server
const server = http.createServer((req, res) => {
    requestCount++;

    try {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Handle OPTIONS requests
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Route handling
        const url = req.url.toLowerCase();

        if (url === '/health' || url === '/health/') {
            // Basic health check
            const health = getApplicationHealth();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health, null, 2));
            lastHealthCheck = Date.now();

        } else if (url === '/health/detailed' || url === '/health/detailed/') {
            // Detailed health check
            const health = getDetailedHealth();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health, null, 2));
            lastHealthCheck = Date.now();

        } else if (url === '/health/ping' || url === '/health/ping/') {
            // Simple ping
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('pong');

        } else if (url === '/health/ready' || url === '/health/ready/') {
            // Readiness check
            const health = getApplicationHealth();
            const isReady = health.status === 'healthy' && health.files.allPresent && health.directories.allPresent;
            
            res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                ready: isReady,
                status: health.status,
                timestamp: new Date().toISOString()
            }));

        } else if (url === '/health/live' || url === '/health/live/') {
            // Liveness check
            const isLive = process.uptime() > 0;
            
            res.writeHead(isLive ? 200 : 503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                live: isLive,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            }));

        } else if (url === '/metrics' || url === '/metrics/') {
            // Prometheus-style metrics
            const system = getSystemMetrics();
            const _health = getApplicationHealth();
            
            const metrics = [
                '# HELP nodejs_uptime_seconds Process uptime in seconds',
                '# TYPE nodejs_uptime_seconds counter',
                `nodejs_uptime_seconds ${process.uptime()}`,
                '',
                '# HELP nodejs_memory_usage_bytes Memory usage in bytes',
                '# TYPE nodejs_memory_usage_bytes gauge',
                `nodejs_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}`,
                `nodejs_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}`,
                `nodejs_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}`,
                `nodejs_memory_usage_bytes{type="external"} ${process.memoryUsage().external}`,
                '',
                '# HELP http_requests_total Total HTTP requests',
                '# TYPE http_requests_total counter',
                `http_requests_total ${requestCount}`,
                '',
                '# HELP http_errors_total Total HTTP errors',
                '# TYPE http_errors_total counter',
                `http_errors_total ${errorCount}`,
                '',
                '# HELP system_memory_usage_percent System memory usage percentage',
                '# TYPE system_memory_usage_percent gauge',
                `system_memory_usage_percent ${system.memory.usage}`,
                '',
                '# HELP system_cpu_load_average System CPU load average',
                '# TYPE system_cpu_load_average gauge',
                `system_cpu_load_average ${system.cpu.loadAverage[0]}`
            ].join('\n');

            res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
            res.end(metrics);

        } else {
            // Serve static files
            const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
            const extname = path.extname(filePath);
            let contentType = 'text/html';

            switch (extname) {
            case '.js': contentType = 'text/javascript'; break;
            case '.css': contentType = 'text/css'; break;
            case '.json': contentType = 'application/json'; break;
            case '.png': contentType = 'image/png'; break;
            case '.jpg': contentType = 'image/jpeg'; break;
            case '.svg': contentType = 'image/svg+xml'; break;
            case '.ico': contentType = 'image/x-icon'; break;
            }

            fs.readFile(filePath, (err, content) => {
                if (err) {
                    errorCount++;
                    if (err.code === 'ENOENT') {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('File not found');
                    } else {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Server error');
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content);
                }
            });
        }

    } catch (error) {
        errorCount++;
        console.error('Health check error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'error',
            message: 'Internal server error',
            timestamp: new Date().toISOString()
        }));
    }
});

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
        console.log('❌ Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    errorCount++;
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    errorCount++;
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Health Check Server running on port ${PORT}`);
    console.log('🏥 Health endpoints:');
    console.log(`   • Basic: http://localhost:${PORT}/health`);
    console.log(`   • Detailed: http://localhost:${PORT}/health/detailed`);
    console.log(`   • Ready: http://localhost:${PORT}/health/ready`);
    console.log(`   • Live: http://localhost:${PORT}/health/live`);
    console.log(`   • Ping: http://localhost:${PORT}/health/ping`);
    console.log(`   • Metrics: http://localhost:${PORT}/metrics`);
    console.log(`🌐 Application: http://localhost:${PORT}/`);
    console.log(`📊 Environment: ${ENVIRONMENT}`);
    console.log(`🔧 Version: ${VERSION}`);
    console.log(`⏰ Started: ${new Date().toISOString()}`);
});

module.exports = {
    getApplicationHealth,
    getDetailedHealth,
    getSystemMetrics,
    server
};
