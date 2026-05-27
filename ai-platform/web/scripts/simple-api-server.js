/**
 * Simple Node.js API Server for AI Coding Intelligence Dashboard
 * Provides the endpoints that the dashboard expects on port 8081
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import url, { fileURLToPath } from 'url';

const PORT = 8081;
const HOST = 'localhost';

// Simple API server to provide the endpoints the dashboard needs
class SimpleAPIServer {
    constructor() {
        this.server = null;
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds cache
        this.startTime = Date.now();
    }

    // Generate mock project overview data
    getProjectOverview(directory = './') {
        return {
            totalFiles: 150,
            totalDirectories: 25,
            projectDepth: 4,
            linesOfCode: 15678,
            codeQuality: 82,
            testCoverage: 65,
            technicalDebt: 'Medium',
            maintainability: 'Good',
            healthScore: 78,
            developmentVelocity: 'Medium',
            teamProductivity: 75,
            projectComplexity: 'Medium',
            languages: ['JavaScript', 'Python', 'HTML', 'CSS'],
            frameworks: ['Node.js', 'Express'],
            timestamp: new Date().toISOString()
        };
    }

    // Generate mock technical debt analysis
    getTechnicalDebtAnalysis() {
        return {
            overall: {
                score: 35,
                severity: 'medium',
                grade: 'C',
                riskLevel: 'medium',
                estimatedEffort: 12
            },
            categories: {
                complexity: { score: 45, severity: 'medium' },
                documentation: { score: 30, severity: 'low' },
                testing: { score: 25, severity: 'high' },
                duplication: { score: 40, severity: 'medium' }
            },
            metrics: {
                codeComplexity: 45,
                codeDuplication: 40,
                codeSmells: 25,
                testCoverage: 65,
                documentation: 30,
                dependencies: 50,
                security: 70,
                performance: 60
            },
            recommendations: [
                { priority: 'high', action: 'Improve test coverage', description: 'Add comprehensive unit tests' },
                { priority: 'medium', action: 'Reduce code complexity', description: 'Refactor complex functions' },
                { priority: 'low', action: 'Improve documentation', description: 'Add inline documentation' }
            ],
            timestamp: new Date().toISOString()
        };
    }

    // Generate mock test coverage data
    getTestCoverage() {
        const currentCoverage = 65; // Start at 65% based on project metrics
        const improvement = Math.random() * 2; // Random improvement up to 2%
        const newCoverage = Math.min(currentCoverage + improvement, 80);
        
        return {
            overall: newCoverage,
            lines: {
                covered: Math.round(1000 * newCoverage / 100),
                total: 1000,
                percentage: newCoverage
            },
            functions: {
                covered: Math.round(150 * newCoverage / 100),
                total: 150,
                percentage: newCoverage
            },
            branches: {
                covered: Math.round(200 * newCoverage / 100),
                total: 200,
                percentage: newCoverage
            },
            statements: {
                covered: Math.round(1200 * newCoverage / 100),
                total: 1200,
                percentage: newCoverage
            },
            files: {
                'dashboard_components/core/DataEngine.js': {
                    lines: { covered: 45, total: 50, percentage: 90 },
                    functions: { covered: 8, total: 10, percentage: 80 },
                    branches: { covered: 12, total: 15, percentage: 80 },
                    statements: { covered: 55, total: 60, percentage: 92 }
                },
                'dashboard_components/core/DarkMode.js': {
                    lines: { covered: 380, total: 400, percentage: 95 },
                    functions: { covered: 25, total: 30, percentage: 83 },
                    branches: { covered: 45, total: 50, percentage: 90 },
                    statements: { covered: 450, total: 480, percentage: 94 }
                },
                'dashboard_components/core/PerformanceMonitor.js': {
                    lines: { covered: 120, total: 180, percentage: 67 },
                    functions: { covered: 15, total: 20, percentage: 75 },
                    branches: { covered: 25, total: 40, percentage: 63 },
                    statements: { covered: 140, total: 200, percentage: 70 }
                }
            },
            insights: [
                {
                    type: 'info',
                    title: 'Moderate Test Coverage',
                    message: `Test coverage is ${newCoverage.toFixed(1)}%`,
                    recommendation: 'Continue improving test coverage',
                    priority: 'medium',
                    impact: 'medium'
                }
            ],
            recommendations: [
                {
                    action: 'Add unit tests for core components',
                    priority: 'high',
                    impact: 'high',
                    estimatedEffort: 'medium',
                    category: 'unit_testing'
                },
                {
                    action: 'Add tests for conditional logic and error handling',
                    priority: 'medium',
                    impact: 'medium',
                    estimatedEffort: 'low',
                    category: 'branch_testing'
                }
            ],
            trends: {
                trend: 'improving',
                average: 40.5,
                change: newCoverage - 40,
                projectedTarget: {
                    periods: Math.ceil((70 - newCoverage) / 1.5),
                    estimatedDate: new Date(Date.now() + Math.ceil((70 - newCoverage) / 1.5) * 7 * 24 * 60 * 60 * 1000),
                    confidence: 'medium'
                }
            },
            target: 70,
            lastRun: new Date().toISOString(),
            isTracking: true
        };
    }

    // Get code structure
    getCodeStructure() {
        return {
            architecture: 'Modular',
            patterns: ['MVC', 'Repository', 'Service'],
            languages: ['JavaScript', 'Python', 'HTML', 'CSS'],
            frameworks: ['Node.js', 'Express', 'FastAPI'],
            complexity: 'Medium',
            maintainability: 'Good',
            testCoverage: 65,
            dependencies: 45,
            modules: 12,
            classes: 28,
            functions: 156,
            linesOfCode: 15678,
            technicalDebt: 'Medium',
            codeQuality: 82,
            documentation: 'Moderate',
            timestamp: new Date().toISOString()
        };
    }

    // Get file structure
    getFileStructure() {
        return {
            totalFiles: 150,
            totalDirectories: 25,
            fileTypes: {
                '.js': 45,
                '.py': 12,
                '.html': 8,
                '.css': 15,
                '.json': 20,
                '.md': 10,
                '.txt': 5,
                '.yml': 3,
                '.other': 32
            },
            largestFiles: [
                { name: 'dashboard.html', size: 1143551, type: '.html' },
                { name: 'api-client.js', size: 6391, type: '.js' },
                { name: 'server.js', size: 222, type: '.js' }
            ],
            timestamp: new Date().toISOString()
        };
    }

    // Get code quality
    getCodeQuality() {
        return {
            overall: {
                score: 82,
                grade: 'B',
                status: 'good'
            },
            metrics: {
                complexity: 75,
                maintainability: 85,
                reliability: 80,
                security: 78,
                testCoverage: 65,
                duplication: 90
            },
            issues: [
                { type: 'complexity', count: 5, severity: 'medium' },
                { type: 'duplication', count: 2, severity: 'low' },
                { type: 'security', count: 1, severity: 'high' }
            ],
            timestamp: new Date().toISOString()
        };
    }

    // Get recommendations
    getRecommendations() {
        return {
            high: [
                'Improve test coverage to meet 80% target',
                'Update outdated dependencies for security',
                'Review and optimize code complexity'
            ],
            medium: [
                'Implement additional error handling',
                'Add more comprehensive documentation',
                'Optimize database queries for performance'
            ],
            low: [
                'Implement caching for frequently accessed data',
                'Add input validation and sanitization',
                'Review and update security policies'
            ],
            priority: 'high',
            timestamp: new Date().toISOString()
        };
    }

    // Get projects
    getProjects() {
        return {
            projects: [
                {
                    id: 1,
                    name: 'AI Coding Dashboard',
                    description: 'Modern web application with real-time analysis',
                    repo_url: 'https://github.com/example/dashboard',
                    is_active: true,
                    created_at: new Date().toISOString(),
                    last_analyzed: new Date().toISOString()
                },
                {
                    id: 2,
                    name: 'Code Analysis Engine',
                    description: 'Backend analysis service',
                    repo_url: 'https://github.com/example/analyzer',
                    is_active: true,
                    created_at: new Date().toISOString(),
                    last_analyzed: new Date().toISOString()
                }
            ],
            total: 2,
            timestamp: new Date().toISOString()
        };
    }

    // Get security (alias for getSecurityAnalysis)
    getSecurity() {
        return this.getSecurityAnalysis();
    }

    // Get performance analysis
    getPerformance() {
        return {
            testCoverage: 65,
            totalFiles: 150,
            linesOfCode: 15678,
            complexity: 'Medium',
            maintainability: 'Good',
            responseTime: 150,
            throughput: 800,
            memoryUsage: 40,
            timestamp: new Date().toISOString()
        };
    }

    // Get notifications
    getNotifications() {
        return {
            notifications: [
                {
                    id: 1,
                    type: 'analysis',
                    title: 'Analysis Complete',
                    message: 'Code analysis completed successfully',
                    timestamp: new Date(Date.now() - 3600000).toISOString(),
                    created_at: new Date(Date.now() - 3600000).toISOString(),
                    read: false
                },
                {
                    id: 2,
                    type: 'security',
                    title: 'Security Scan',
                    message: 'Security vulnerabilities detected',
                    timestamp: new Date(Date.now() - 7200000).toISOString(),
                    created_at: new Date(Date.now() - 7200000).toISOString(),
                    read: false
                },
                {
                    id: 3,
                    type: 'performance',
                    title: 'Performance Update',
                    message: 'Performance metrics updated',
                    timestamp: new Date(Date.now() - 10800000).toISOString(),
                    created_at: new Date(Date.now() - 10800000).toISOString(),
                    read: true
                },
                {
                    id: 4,
                    type: 'error',
                    title: 'Error Detected',
                    message: 'API request failed',
                    timestamp: new Date(Date.now() - 14400000).toISOString(),
                    created_at: new Date(Date.now() - 14400000).toISOString(),
                    read: true
                }
            ],
            total: 4,
            unread: 2,
            timestamp: new Date().toISOString()
        };
    }

    // Get security analysis
    getSecurityAnalysis() {
        return {
            overall: {
                score: 78,
                grade: 'B',
                status: 'good',
                vulnerabilities: 3
            },
            categories: {
                authentication: { score: 85, issues: 0 },
                authorization: { score: 80, issues: 1 },
                dataProtection: { score: 75, issues: 1 },
                infrastructure: { score: 82, issues: 1 }
            },
            vulnerabilities: [
                { type: 'SQL Injection', severity: 'medium', count: 1 },
                { type: 'XSS', severity: 'low', count: 2 },
                { type: 'CSRF', severity: 'medium', count: 1 }
            ],
            recommendations: [
                'Implement input validation and sanitization',
                'Add CSRF protection to forms',
                'Update security headers'
            ],
            timestamp: new Date().toISOString()
        };
    }

    // Get performance analysis
    getPerformanceAnalysis() {
        return {
            overall: {
                score: 85,
                grade: 'B',
                status: 'good',
                responseTime: 120
            },
            metrics: {
                responseTime: 120, // ms
                throughput: 1000, // requests/min
                cpuUsage: 45, // %
                memoryUsage: 60, // %
                errorRate: 0.5, // %
                availability: 99.9 // %
            },
            bottlenecks: [
                { component: 'Database', impact: 'medium', suggestion: 'Add connection pooling' },
                { component: 'API Gateway', impact: 'low', suggestion: 'Enable caching' }
            ],
            recommendations: [
                'Optimize database queries',
                'Implement response caching',
                'Add load balancing for high traffic'
            ],
            timestamp: new Date().toISOString()
        };
    }

    // Get notifications
    getNotifications() {
        return {
            notifications: [
                {
                    id: 1,
                    type: 'analysis_complete',
                    title: 'Analysis Complete',
                    message: 'Code analysis finished successfully',
                    is_read: false,
                    created_at: new Date().toISOString()
                },
                {
                    id: 2,
                    type: 'security_alert',
                    title: 'Security Alert',
                    message: '3 medium priority security issues found',
                    is_read: false,
                    created_at: new Date().toISOString()
                },
                {
                    id: 3,
                    type: 'performance_degradation',
                    title: 'Performance Alert',
                    message: 'Performance score decreased by 5%',
                    is_read: true,
                    created_at: new Date().toISOString()
                }
            ],
            unread_count: 2,
            timestamp: new Date().toISOString()
        };
    }

    // Check cache
    getCachedResponse(path) {
        const cached = this.cache.get(path);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            console.log(`📋 Cache hit for: ${path}`);
            return cached.data;
        }
        return null;
    }

    // Set cache
    setCachedResponse(path, data) {
        this.cache.set(path, {
            data,
            timestamp: Date.now()
        });
    }

    // Handle requests
    handleRequest(req, res) {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const parsedUrl = url.parse(req.url, true);
        const path = parsedUrl.pathname;
        
        console.log(`[${new Date().toISOString()}] ${req.method} ${path}`);

        try {
            let responseData = this.getCachedResponse(path);
            if (!responseData) {
                if (path === '/') {
                    // Serve the dashboard HTML file
                    const indexPath = './index.html';
                    
                    if (fs.existsSync(indexPath)) {
                        const htmlContent = fs.readFileSync(indexPath, 'utf8');
                        res.setHeader('Content-Type', 'text/html');
                        res.writeHead(200);
                        res.end(htmlContent);
                        return;
                    } else {
                        responseData = { error: 'Dashboard file not found' };
                    }
                } else if (path === '/api-client.js' || path.startsWith('/api-client.js?')) {
                    // Serve the API client JavaScript file
                    const clientPath = './api-client.js';
                    
                    if (fs.existsSync(clientPath)) {
                        const jsContent = fs.readFileSync(clientPath, 'utf8');
                        res.setHeader('Content-Type', 'application/javascript');
                        res.writeHead(200);
                        res.end(jsContent);
                        return;
                    } else {
                        responseData = { error: 'API client file not found' };
                    }
                } else if (path === '/dashboard_enhancement.js' || path.startsWith('/dashboard_enhancement.js?')) {
                    // Serve the dashboard enhancement JavaScript file
                    const enhancementPath = './dashboard_enhancement.js';
                    
                    if (fs.existsSync(enhancementPath)) {
                        const jsContent = fs.readFileSync(enhancementPath, 'utf8');
                        res.setHeader('Content-Type', 'application/javascript');
                        res.writeHead(200);
                        res.end(jsContent);
                        return;
                    } else {
                        responseData = { error: 'Dashboard enhancement file not found' };
                    }
                } else if (path === '/roadmap_builder.js' || path.startsWith('/roadmap_builder.js?')) {
                    // Serve the roadmap builder JavaScript file
                    const roadmapPath = './roadmap_builder.js';
                    
                    if (fs.existsSync(roadmapPath)) {
                        const jsContent = fs.readFileSync(roadmapPath, 'utf8');
                        res.setHeader('Content-Type', 'application/javascript');
                        res.writeHead(200);
                        res.end(jsContent);
                        return;
                    } else {
                        responseData = { error: 'Roadmap builder file not found' };
                    }
                } else if (path === '/sw.js') {
                    // Serve the Service Worker file
                    const swPath = './sw.js';
                    
                    if (fs.existsSync(swPath)) {
                        const swContent = fs.readFileSync(swPath, 'utf8');
                        res.setHeader('Content-Type', 'application/javascript');
                        res.writeHead(200);
                        res.end(swContent);
                        return;
                    } else {
                        responseData = { error: 'Service Worker file not found' };
                    }
                } else if (path === '/favicon.ico') {
                    // Handle favicon request
                    res.writeHead(204);
                    res.end();
                    return;
                } else if (path === '/api/project/overview' || path === '/api/analysis/project/overview') {
                    const directory = parsedUrl.query.directory || './';
                    responseData = this.getProjectOverview(directory);
                } else if (path === '/api/analysis/technical-debt') {
                    responseData = this.getTechnicalDebtAnalysis();
                } else if (path === '/api/test-coverage') {
                    responseData = this.getTestCoverage();
                } else if (path === '/api/activity/feed') {
                    responseData = {
                        activities: [
                            {
                                id: 1,
                                type: 'analysis_complete',
                                title: 'Security Analysis Complete',
                                description: 'Enhanced security cleanup completed successfully',
                                timestamp: new Date().toISOString(),
                                user: 'System'
                            },
                            {
                                id: 2,
                                type: 'quality_improvement',
                                title: 'Code Quality Improved',
                                description: 'Quality score improved from 75% to 82%',
                                timestamp: new Date(Date.now() - 3600000).toISOString(),
                                user: 'System'
                            },
                            {
                                id: 3,
                                type: 'performance_optimization',
                                title: 'Performance Enhanced',
                                description: 'Performance score improved from 55% to 65%',
                                timestamp: new Date(Date.now() - 7200000).toISOString(),
                                user: 'System'
                            }
                        ]
                    };
                } else if (path === '/api/notifications' || path === '/api/notifications/list') {
                    responseData = {
                        notifications: [
                            {
                                id: 1,
                                type: 'success',
                                title: 'Security Cleanup Complete',
                                message: 'Enhanced security cleanup completed with 62.1% false positive rate',
                                is_read: false,
                                created_at: new Date().toISOString()
                            },
                            {
                                id: 2,
                                type: 'info',
                                title: 'Quality Transformation',
                                message: 'Code quality transformed from 75% to 82% with Good maintainability',
                                is_read: false,
                                created_at: new Date(Date.now() - 1800000).toISOString()
                            },
                            {
                                id: 3,
                                type: 'warning',
                                title: 'Performance Optimization',
                                message: 'Performance enhanced from 55% to 65% with 100% success rate',
                                is_read: true,
                                created_at: new Date(Date.now() - 3600000).toISOString()
                            }
                        ]
                    };
                } else if (path === '/api/analysis/security') {
                    responseData = {
                        securityScore: 102,
                        vulnerabilities: 11,
                        falsePositives: 18,
                        findings: [
                            {
                                type: 'sql_injection',
                                severity: 'medium',
                                count: 4,
                                false_positives: 4
                            },
                            {
                                type: 'eval_usage',
                                severity: 'medium',
                                count: 8,
                                false_positives: 6
                            },
                            {
                                type: 'shell_injection',
                                severity: 'medium',
                                count: 10,
                                false_positives: 8
                            }
                        ],
                        timestamp: new Date().toISOString()
                    };
                } else if (path === '/api/security/metrics') {
                    responseData = {
                        overall_score: 102,
                        vulnerability_count: 11,
                        false_positive_rate: 62.1,
                        security_level: 'enhanced',
                        last_scan: new Date().toISOString()
                    };
                } else if (path === '/api/performance/metrics' || path === '/api/analysis/performance') {
                    responseData = {
                        overall_score: 85,
                        response_time: 100,
                        memory_usage: 60,
                        cpu_usage: 60,
                        throughput: 95,
                        availability: 99.9,
                        timestamp: new Date().toISOString()
                    };
                } else if (path === '/api/reports/debt/export') {
                    responseData = {
                        report_url: 'technical_debt_report.pdf',
                        generated_at: new Date().toISOString(),
                        summary: {
                            total_debt: 45,
                            critical_issues: 5,
                            medium_issues: 12,
                            low_issues: 28,
                            estimated_effort: '2-3 weeks'
                        }
                    };
                } else if (path === '/api/reports/analysis/export') {
                    responseData = {
                        report_url: 'comprehensive_analysis_report.pdf',
                        generated_at: new Date().toISOString(),
                        summary: {
                            security_score: 102,
                            quality_score: 89.8,
                            performance_score: 85,
                            overall_health: 90,
                            issues_resolved: 15764
                        }
                    };
                } else if (path === '/api/reports/generate') {
                    responseData = {
                        report_id: 'report_' + Date.now(),
                        status: 'generated',
                        download_url: '/api/reports/download/' + Date.now(),
                        generated_at: new Date().toISOString()
                    };
                } else if (path === '/api/export/generate') {
                    // High-performance export generation endpoint
                    const reportId = 'export_' + Date.now();
                    const timestamp = new Date().toISOString();
                    
                    // Send response immediately without pretty-printing for performance
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        success: true,
                        report_id: reportId,
                        status: 'generating',
                        estimated_time: '2-3 seconds',
                        progress_url: `/api/export/status/${reportId}`,
                        download_url: `/api/export/download/${reportId}`,
                        format: 'pdf',
                        generated_at: timestamp
                    }));
                    return;
                } else if (path === '/api/export/data') {
                    responseData = {
                        export_url: 'project_data_' + Date.now() + '.json',
                        format: 'json',
                        size: '2.5MB',
                        generated_at: new Date().toISOString(),
                        includes: ['security', 'quality', 'performance', 'technical_debt']
                    };
                } else if (path === '/api/analysis/results') {
                    // Serve comprehensive analysis results with optimized performance
                    const analysisPath = './comprehensive_data_analysis_results.json';
                    
                    // Check cache first
                    const cacheKey = `analysis_results_${fs.existsSync(analysisPath) ? fs.statSync(analysisPath).mtime.getTime() : 'missing'}`;
                    if (this.hasCachedResponse(cacheKey)) {
                        const cachedData = this.getCachedResponse(cacheKey);
                        res.setHeader('Content-Type', 'application/json');
                        res.writeHead(200);
                        res.end(JSON.stringify(cachedData));
                        return;
                    }
                    
                    if (fs.existsSync(analysisPath)) {
                        // Use async file reading to prevent blocking
                        fs.readFile(analysisPath, 'utf8', (err, data) => {
                            if (err) {
                                console.error('Error reading analysis results:', err);
                                responseData = { error: 'Failed to read analysis results' };
                                res.writeHead(500);
                                res.end(JSON.stringify(responseData));
                                return;
                            }
                            
                            try {
                                const analysisData = JSON.parse(data);
                                // Cache the result for future requests
                                this.setCachedResponse(cacheKey, analysisData);
                                
                                res.setHeader('Content-Type', 'application/json');
                                res.writeHead(200);
                                res.end(JSON.stringify(analysisData));
                            } catch (parseError) {
                                console.error('Error parsing analysis results:', parseError);
                                responseData = { error: 'Invalid analysis results format' };
                                res.writeHead(500);
                                res.end(JSON.stringify(responseData));
                            }
                        });
                        return; // Important: return early to avoid sending response twice
                    } else {
                        responseData = { error: 'Analysis results not found' };
                    }
                } else if (path === '/api/health') {
                    responseData = {
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        uptime: process.uptime(),
                        endpoints: [
                            '/api/project/overview',
                            '/api/analysis/technical-debt',
                            '/api/test-coverage',
                            '/api/health',
                            '/api/analysis/code-structure',
                            '/api/analysis/file-structure',
                            '/api/analysis/quality',
                            '/api/analysis/recommendations',
                            '/api/analysis/run',
                            '/api/auth/login',
                            '/api/auth/me'
                        ]
                    };
                } else if (path === '/api/analysis/code-structure') {
                    responseData = this.getCodeStructure();
                } else if (path === '/api/analysis/file-structure') {
                    responseData = this.getFileStructure();
                } else if (path === '/api/analysis/quality') {
                    responseData = this.getCodeQuality();
                } else if (path === '/api/analysis/security') {
                    responseData = this.getSecurity();
                } else if (path === '/api/test-coverage') {
                    responseData = this.getTestCoverage();
                } else if (path === '/api/analysis/recommendations') {
                    responseData = this.getRecommendations();
                } else if (path === '/api/notifications') {
                    responseData = this.getNotifications();
                } else if (path === '/api/auth/me') {
                    // Mock auth/me endpoint
                    responseData = {
                        id: 1,
                        email: 'user@example.com',
                        username: 'testuser',
                        authenticated: true,
                        timestamp: new Date().toISOString()
                    };
                } else if (path === '/api/auth/login') {
                    // Mock auth/login endpoint
                    if (req.method === 'POST') {
                        let body = '';
                        req.on('data', chunk => {
                            body += chunk.toString();
                        });
                        req.on('end', () => {
                            try {
                                const credentials = body ? JSON.parse(body) : {};
                                const token = 'mock_token_' + Date.now();
                                responseData = {
                                    success: true,
                                    token: token,
                                    access_token: token,
                                    user: {
                                        id: 1,
                                        email: credentials.email || 'user@example.com',
                                        username: credentials.username || 'testuser'
                                    },
                                    timestamp: new Date().toISOString()
                                };
                                res.writeHead(200);
                                res.end(JSON.stringify(responseData));
                                return;
                            } catch (error) {
                                // If parsing fails, still return success with default user
                                const token = 'mock_token_' + Date.now();
                                responseData = {
                                    success: true,
                                    token: token,
                                    access_token: token,
                                    user: {
                                        id: 1,
                                        email: 'user@example.com',
                                        username: 'testuser'
                                    },
                                    timestamp: new Date().toISOString()
                                };
                                res.writeHead(200);
                                res.end(JSON.stringify(responseData));
                                return;
                            }
                        });
                        return;
                    } else {
                        responseData = {
                            success: true,
                            token: 'mock_token_' + Date.now(),
                            user: {
                                id: 1,
                                email: 'user@example.com',
                                username: 'testuser'
                            },
                            timestamp: new Date().toISOString()
                        };
                    }
                } else if (path === '/api/projects') {
                    responseData = this.getProjects();
                } else if (path === '/api/notifications') {
                    responseData = this.getNotifications();
                } else if (path === '/api/notifications/unread-count') {
                    responseData = { unread_count: 3 };
                } else if (path === '/api/analysis/run') {
                    // Mock run analysis endpoint
                    if (req.method === 'POST') {
                        // Parse request body
                        let body = '';
                        req.on('data', chunk => {
                            body += chunk.toString();
                        });
                        req.on('end', () => {
                            try {
                                const request = JSON.parse(body);
                                const validTypes = ['code_quality', 'security', 'performance', 'technical_debt', 'comprehensive'];
                                
                                if (!validTypes.includes(request.analysis_type)) {
                                    responseData = { 
                                        error: 'Invalid analysis type: ' + request.analysis_type + '. Valid types: ' + validTypes.join(', ')
                                    };
                                    res.writeHead(400);
                                    res.end(JSON.stringify(responseData, null, 2));
                                    return;
                                }
                                
                                // Return appropriate results based on analysis type
                                let results;
                                switch(request.analysis_type) {
                                case 'code_quality':
                                    results = this.getCodeQuality();
                                    break;
                                case 'security':
                                    results = this.getSecurityAnalysis();
                                    break;
                                case 'performance':
                                    results = this.getPerformanceAnalysis();
                                    break;
                                case 'technical_debt':
                                    results = this.getTechnicalDebtAnalysis();
                                    break;
                                case 'comprehensive':
                                    results = this.getCodeStructure();
                                    break;
                                default:
                                    results = this.getCodeStructure();
                                }
                                
                                responseData = {
                                    id: Math.floor(Math.random() * 1000),
                                    project_id: request.project_id || 1,
                                    analysis_type: request.analysis_type,
                                    status: 'completed',
                                    results: results,
                                    created_at: new Date().toISOString(),
                                    completed_at: new Date().toISOString()
                                };
                                
                                res.writeHead(200);
                                res.end(JSON.stringify(responseData));
                                return;
                            } catch (error) {
                                responseData = { error: 'Invalid request body: ' + error.message };
                                res.writeHead(400);
                                res.end(JSON.stringify(responseData));
                                return;
                            }
                        });
                        return;
                    } else {
                        responseData = { error: 'Method not allowed' };
                        res.writeHead(405);
                        res.end(JSON.stringify(responseData));
                        return;
                    }
                } else {
                    responseData = {
                        status: 'endpoint_not_found',
                        message: `Endpoint '${path}' not available`,
                        available_endpoints: [
                            '/api/project/overview',
                            '/api/analysis/technical-debt',
                            '/api/test-coverage',
                            '/api/health'
                        ]
                    };
                    res.writeHead(404);
                    res.end(JSON.stringify(responseData));
                    return;
                }
                this.setCachedResponse(path, responseData);
            }

            if (!res.headersSent) {
                // Use compact JSON for better performance
                res.writeHead(200);
                res.end(JSON.stringify(responseData));
            }

        } catch (error) {
            console.error('Error handling request:', error);
            console.error('Error details:', error.stack);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end(JSON.stringify({ 
                    error: 'Internal server error',
                    details: error.message,
                    stack: error.stack
                }));
            }
        }
    }

    forwardRequest(req, res, targetUrl) {
        const url = new URL(targetUrl);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: req.method,
            headers: {
                ...req.headers,
                host: url.hostname
            }
        };

        const proxyReq = require('http').request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy error:', err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Proxy error' }));
        });

        req.pipe(proxyReq);
    }

    start() {
        this.server = http.createServer((req, res) => {
            // Add CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
            
            // Handle preflight requests
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
            
            this.handleRequest(req, res);
        });

        this.server.listen(PORT, HOST, () => {
            console.log('🚀 Simple API Server Started');
            console.log(`🌐 Server running at: http://${HOST}:${PORT}`);
            console.log('📊 Available endpoints:');
            console.log(`  GET  http://${HOST}:${PORT}/api/project/overview`);
            console.log(`  GET  http://${HOST}:${PORT}/api/analysis/technical-debt`);
            console.log(`  GET  http://${HOST}:${PORT}/api/test-coverage`);
            console.log(`  GET  http://${HOST}:${PORT}/api/health`);
            console.log('⏹️  Press Ctrl+C to stop the server');
        });

        this.server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use`);
            } else {
                console.error('❌ Server error:', err);
            }
        });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n⏹️  Server stopped by user');
            this.server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

// Start the server
const apiServer = new SimpleAPIServer();
apiServer.start();
