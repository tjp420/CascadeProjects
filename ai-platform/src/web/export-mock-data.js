/**
 * Export Mock Data Generator
 *
 * This file consolidates all mock data generation functions for export operations.
 * Extracted from export-system.js for better organization and maintainability.
 *
 * @version 1.0.0
 * @created 2026-05-20
 */

// ============================================================================
// MOCK DATA GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate mock data based on type
 * @param {string} type - Type of data to generate (full, overview, technical-debt, performance, backup)
 * @returns {object} Mock data object
 */
function generateMockData(type) {
    switch (type) {
    case 'full':
        return {
            overview: { totalFiles: 1250, totalComplexity: 45000, performance: 87 },
            technicalDebt: { high: 15, medium: 23, low: 45 },
            performance: { responseTime: 245, throughput: 1200, errorRate: 0.02 },
            backup: { lastBackup: '2024-05-20T10:30:00', totalBackups: 156 },
        };
    case 'overview':
        return { totalFiles: 1250, totalComplexity: 45000, performance: 87 };
    case 'technical-debt':
        return { high: 15, medium: 23, low: 45, totalIssues: 83 };
    case 'performance':
        return { responseTime: 245, throughput: 1200, errorRate: 0.02, uptime: 99.9 };
    case 'backup':
        return { lastBackup: '2024-05-20T10:30:00', totalBackups: 156, storageUsed: '8.2GB' };
    default:
        return {};
    }
}

/**
 * Generate mock CSV data for specific datasets
 * @param {string} datasetId - Dataset identifier (ecommerce, analytics, financial)
 * @returns {string} CSV formatted mock data
 */
function generateMockCSVData(datasetId) {
    const datasets = {
        ecommerce: `Order ID,Customer ID,Product ID,Quantity,Price,Total,Date
ORD-001,CUST-001,PROD-001,2,29.99,59.98,2024-05-20
ORD-002,CUST-002,PROD-002,1,49.99,49.99,2024-05-20
ORD-003,CUST-003,PROD-003,3,19.99,59.97,2024-05-20
ORD-004,CUST-001,PROD-004,1,99.99,99.99,2024-05-19
ORD-005,CUST-004,PROD-001,5,29.99,149.95,2024-05-19`,

        analytics: `Timestamp,Page URL,Session ID,User ID,Action,Duration
2024-05-20T10:00:00,/home,SES-001,USR-001,pageview,45
2024-05-20T10:01:30,/products,SES-001,USR-001,pageview,120
2024-05-20T10:03:45,/cart,SES-001,USR-001,pageview,30
2024-05-20T10:04:15,/checkout,SES-001,USR-001,pageview,180
2024-05-20T10:07:30,/home,SES-002,USR-002,pageview,60`,

        financial: `Transaction ID,Account ID,Type,Amount,Date,Status
TXN-001,ACC-001,debit,1500.00,2024-05-20,completed
TXN-002,ACC-002,credit,2500.00,2024-05-20,completed
TXN-003,ACC-001,debit,500.00,2024-05-19,completed
TXN-004,ACC-003,credit,1000.00,2024-05-19,pending
TXN-005,ACC-002,debit,750.00,2024-05-18,completed`,
    };

    return datasets[datasetId] || datasets.ecommerce;
}

/**
 * Generate mock upload data for specified time period
 * @param {string} period - Time period (today, week, month, all)
 * @returns {object} Mock upload data with statistics
 */
function generateMockUploadData(period) {
    const now = new Date();
    let startDate = new Date(now);

    switch (period) {
    case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
    case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
    case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
    case 'all':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    // Generate mock upload data
    const uploads = [];
    const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < Math.min(daysDiff, 30); i++) {
        const uploadDate = new Date(startDate);
        uploadDate.setDate(uploadDate.getDate() + i);

        uploads.push({
            date: uploadDate.toISOString(),
            files: Math.floor(Math.random() * 50) + 10,
            totalSize: Math.floor(Math.random() * 10000000) + 1000000,
            fileTypes: ['JavaScript', 'Python', 'TypeScript', 'Java', 'JSON', 'Markdown'],
            complexity: Math.floor(Math.random() * 100) + 20,
            issues: Math.floor(Math.random() * 20) + 5,
        });
    }

    return {
        period: period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        uploads: uploads,
        summary: {
            totalUploads: uploads.length,
            totalFiles: uploads.reduce((acc, upload) => acc + upload.files, 0),
            totalSize: uploads.reduce((acc, upload) => acc + upload.totalSize, 0),
            averageFilesPerUpload:
        uploads.reduce((acc, upload) => acc + upload.files, 0) / uploads.length,
            averageComplexity:
        uploads.reduce((acc, upload) => acc + upload.complexity, 0) / uploads.length,
            averageIssues: uploads.reduce((acc, upload) => acc + upload.issues, 0) / uploads.length,
        },
    };
}

/**
 * Generate detailed mock upload information
 * @param {string} uploadId - Upload identifier
 * @returns {object} Detailed mock upload data
 */
function generateMockUploadDetails(uploadId) {
    const fileTypes = [
        'JavaScript',
        'Python',
        'TypeScript',
        'Java',
        'JSON',
        'Markdown',
        'CSS',
        'HTML',
    ];
    const fileNames = [
        'app.js',
        'main.py',
        'config.json',
        'index.html',
        'styles.css',
        'utils.ts',
        'server.java',
        'README.md',
        'data.csv',
        'package.json',
    ];

    const files = Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, index) => ({
        name: fileNames[index % fileNames.length],
        type: fileTypes[index % fileTypes.length],
        size: Math.floor(Math.random() * 1000000) + 10000,
        complexity: Math.floor(Math.random() * 100) + 1,
    }));

    return {
        id: uploadId,
        uploadDate: new Date(
            Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
        ).toISOString(),
        uploader: 'test.user@example.local',
        uploadType: 'Single Upload',
        status: 'Completed',
        totalFiles: files.length,
        totalSize: files.reduce((acc, file) => acc + file.size, 0),
        fileTypes: files.reduce((acc, file) => {
            acc[file.type] = (acc[file.type] || 0) + 1;
            return acc;
        }, {}),
        averageComplexity: Math.round(
            files.reduce((acc, file) => acc + file.complexity, 0) / files.length
        ),
        totalIssues: Math.floor(Math.random() * 50) + 10,
        riskLevel: Math.random() > 0.7 ? 'High' : Math.random() > 0.3 ? 'Medium' : 'Low',
        files: files,
    };
}

/**
 * Generate mock directory analysis data
 * @param {string} reportType - Type of report (comprehensive, summary, detailed)
 * @param {string} format - Export format (pdf, excel, csv)
 * @param {boolean} includeCharts - Whether to include chart data
 * @returns {object} Mock directory analysis data with content
 */
function generateMockDirectoryData(reportType, format, includeCharts) {
    const now = new Date();

    // Generate mock directory data
    const directoryData = {
        reportType: reportType,
        exportDate: now.toISOString(),
        directoryPath: '/mock/test/directory',
        summary: {
            totalFiles: Math.floor(Math.random() * 100) + 50,
            totalSize: Math.floor(Math.random() * 10000000) + 1000000,
            fileTypes: {
                JavaScript: Math.floor(Math.random() * 30) + 10,
                Python: Math.floor(Math.random() * 25) + 8,
                TypeScript: Math.floor(Math.random() * 20) + 5,
                Java: Math.floor(Math.random() + 15) + 3,
                JSON: Math.floor(Math.random() + 10) + 2,
                Markdown: Math.floor(Math.random() + 15) + 5,
                CSS: Math.floor(Math.random() + 10) + 2,
                HTML: Math.floor(Math.random() + 10) + 2,
            },
            averageSize: Math.floor(Math.random() * 50000) + 10000,
            averageComplexity: Math.floor(Math.random() * 60) + 20,
            totalIssues: Math.floor(Math.random() * 200) + 50,
            riskDistribution: {
                High: Math.floor(Math.random() + 20) + 5,
                Medium: Math.floor(Math.random() + 30) + 10,
                Low: Math.floor(Math.random() + 50) + 20,
            },
        },
        files: Array.from({ length: Math.floor(Math.random() * 50) + 20 }, (_, index) => ({
            name: `mock_file_${index + 1}.${['js', 'py', 'ts', 'java', 'json', 'md', 'css', 'html'][index % 8]}`,
            path: `/mock/test/directory/mock_file_${index + 1}.${['js', 'py', 'ts', 'java', 'json', 'md', 'css', 'html'][index % 8]}`,
            size: Math.floor(Math.random() * 100000) + 10000,
            type: ['js', 'py', 'ts', 'java', 'json', 'md', 'css', 'html'][index % 8],
            complexity: Math.floor(Math.random() * 100) + 1,
            issues: Math.floor(Math.random() * 15) + 1,
            lastModified: new Date(
                now - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
            ).toLocaleString(),
            riskLevel: Math.random() > 0.7 ? 'High' : Math.random() > 0.3 ? 'Medium' : 'Low',
        })),
        recommendations: [
            'Implement automated testing for all analyzed files',
            'Set up code quality gates for the project',
            'Create comprehensive documentation standards',
            'Schedule regular code reviews and refactoring',
            'Monitor code quality metrics and trends',
        ],
    };

    // Add chart data if requested
    if (includeCharts) {
        directoryData.charts = {
            fileTypeDistribution: directoryData.summary.fileTypes,
            complexityDistribution: {
                Low: directoryData.summary.riskDistribution.Low,
                Medium: directoryData.summary.riskDistribution.Medium,
                High: directoryData.summary.riskDistribution.High,
            },
            sizeDistribution: directoryData.files.map((file) => ({
                name: file.name,
                size: file.size,
            })),
        };
    }

    // Generate content based on report type and format
    let content = '';
    switch (reportType) {
    case 'summary':
        content = generateDirectorySummaryContent(directoryData, format, includeCharts);
        break;
    case 'detailed':
        content = generateDirectoryDetailedContent(directoryData, format, includeCharts);
        break;
    case 'files':
        content = generateDirectoryFilesContent(directoryData, format);
        break;
    case 'metrics':
        content = generateDirectoryMetricsContent(directoryData, format, includeCharts);
        break;
    default:
        content = 'Invalid report type';
    }

    return { ...directoryData, content };
}

// Helper functions for directory report content generation
function generateDirectorySummaryContent(data, format, includeCharts) {
    if (format === 'csv') {
        const headers = ['File Name', 'Type', 'Size (KB)', 'Complexity', 'Issues', 'Risk Level'];
        const rows = data.files.map((file) => [
            file.name,
            file.type,
            (file.size / 1024).toFixed(2),
            file.complexity,
            file.issues,
            file.riskLevel,
        ]);
        return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    }

    return `
DIRECTORY ANALYSIS SUMMARY REPORT
=====================================

Generated: ${new Date().toLocaleString()}
Report Type: Summary
Directory Path: ${data.directoryPath}
Analysis Date: ${data.exportDate}

EXECUTIVE SUMMARY
------------------
Total Files: ${data.summary.totalFiles}
Total Size: ${(data.summary.totalSize / 1024 / 1024).toFixed(2)}MB
File Types: ${Object.keys(data.summary.fileTypes).join(', ')}
Average File Size: ${(data.summary.averageSize / 1024).toFixed(2)}KB
Average Complexity: ${data.summary.averageComplexity}
Total Issues: ${data.summary.totalIssues}
High Risk Files: ${data.summary.riskDistribution.High}
Medium Risk Files: ${data.summary.riskDistribution.Medium}
Low Risk Files: ${data.summary.riskDistribution.Low}

RECOMMENDATIONS
---------------
${data.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}
`;
}

function generateDirectoryDetailedContent(data, format, includeCharts) {
    return `
DIRECTORY ANALYSIS DETAILED REPORT
====================================

Generated: ${new Date().toLocaleString()}
Report Type: Detailed
Directory Path: ${data.directoryPath}

FILE DETAILS
-------------
${data.files
        .map(
            (file, index) => `
${index + 1}. ${file.name}
   Path: ${file.path}
   Type: ${file.type}
   Size: ${(file.size / 1024).toFixed(2)}KB
   Complexity: ${file.complexity}
   Issues: ${file.issues}
   Risk Level: ${file.riskLevel}
   Last Modified: ${file.lastModified}
`
        )
        .join('\n')}
`;
}

function generateDirectoryFilesContent(data, format) {
    if (format === 'csv') {
        const headers = [
            'File Name',
            'Path',
            'Type',
            'Size (KB)',
            'Complexity',
            'Issues',
            'Risk Level',
            'Last Modified',
        ];
        const rows = data.files.map((file) => [
            file.name,
            file.path,
            file.type,
            (file.size / 1024).toFixed(2),
            file.complexity,
            file.issues,
            file.riskLevel,
            file.lastModified,
        ]);
        return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    }

    return `
DIRECTORY FILES REPORT
======================
${data.files.map((file) => `${file.name} | ${file.type} | ${(file.size / 1024).toFixed(2)}KB | ${file.complexity} | ${file.issues} | ${file.riskLevel}`).join('\n')}
`;
}

function generateDirectoryMetricsContent(data, format, includeCharts) {
    return `
DIRECTORY METRICS REPORT
=========================

Generated: ${new Date().toLocaleString()}
Directory Path: ${data.directoryPath}

METRICS OVERVIEW
----------------
Total Files: ${data.summary.totalFiles}
Total Size: ${(data.summary.totalSize / 1024 / 1024).toFixed(2)}MB
Average Complexity: ${data.summary.averageComplexity}
Total Issues: ${data.summary.totalIssues}

FILE TYPE DISTRIBUTION
----------------------
${Object.entries(data.summary.fileTypes)
        .map(([type, count]) => `${type}: ${count} files`)
        .join('\n')}

RISK DISTRIBUTION
-----------------
High: ${data.summary.riskDistribution.High} files
Medium: ${data.summary.riskDistribution.Medium} files
Low: ${data.summary.riskDistribution.Low} files
`;
}

/**
 * Generate mock diagnostics data
 * @param {string} reportType - Type of report (comprehensive, summary, detailed)
 * @param {string} format - Export format (pdf, excel, csv)
 * @param {boolean} includeCharts - Whether to include chart data
 * @param {string} period - Time period for data (today, week, month)
 * @returns {object} Mock diagnostics data with content
 */
function generateMockDiagnosticsData(reportType, format, includeCharts, period) {
    const now = new Date();

    // Generate mock diagnostics data
    const diagnosticsData = {
        reportType: reportType,
        exportDate: now.toISOString(),
        period: period,
        systemInfo: {
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        healthScore: Math.floor(Math.random() * 30) + 70,
        checks: {
            performance: {
                status: Math.random() > 0.3 ? 'Pass' : 'Warning',
                responseTime: Math.floor(Math.random() * 100) + 50,
                throughput: Math.floor(Math.random() * 1000) + 500,
                cpuUsage: Math.floor(Math.random() * 40) + 20,
                memoryUsage: Math.floor(Math.random() * 50) + 30,
                diskUsage: Math.floor(Math.random() * 80) + 10,
            },
            connectivity: {
                status: Math.random() > 0.2 ? 'Pass' : 'Warning',
                apiEndpoints: Math.floor(Math.random() * 10) + 5,
                failedEndpoints: Math.floor(Math.random() * 3),
                latency: Math.floor(Math.random() * 50) + 10,
                uptime: Math.floor(Math.random() * 100) + 900,
            },
            errors: {
                status: Math.random() > 0.4 ? 'Pass' : 'Warning',
                totalErrors: Math.floor(Math.random() * 20) + 5,
                criticalErrors: Math.floor(Math.random() * 5),
                warnings: Math.floor(Math.random() * 30) + 10,
                lastError: new Date(now - Math.floor(Math.random() * 24 * 60 * 60 * 1000)).toISOString(),
            },
            memory: {
                status: Math.random() > 0.3 ? 'Pass' : 'Warning',
                memoryUsage: Math.floor(Math.random() * 50) + 30,
                potentialLeaks: Math.floor(Math.random() * 5),
                heapSize: Math.floor(Math.random() * 100) + 50,
                gcEvents: Math.floor(Math.random() * 100) + 50,
            },
            security: {
                status: Math.random() > 0.25 ? 'Pass' : 'Warning',
                vulnerabilities: Math.floor(Math.random() * 5),
                securityScore: Math.floor(Math.random() * 30) + 70,
                lastScan: new Date(now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
            },
        },
        recommendations: [
            'Monitor system performance metrics regularly',
            'Implement automated error tracking and alerting',
            'Schedule regular security scans and audits',
            'Optimize memory usage and implement garbage collection',
            'Review and update system configurations',
        ],
    };

    // Add chart data if requested
    if (includeCharts) {
        diagnosticsData.charts = {
            performanceMetrics: diagnosticsData.checks.performance,
            connectivityStatus: diagnosticsData.checks.connectivity,
            errorTrends: {
                total: diagnosticsData.checks.errors.totalErrors,
                critical: diagnosticsData.checks.errors.criticalErrors,
                warnings: diagnosticsData.checks.errors.warnings,
            },
            memoryUsage: diagnosticsData.checks.memory,
            securityStatus: diagnosticsData.checks.security,
        };
    }

    // Generate content based on report type and format
    let content = '';
    switch (reportType) {
    case 'summary':
        content = generateDiagnosticsSummaryContent(diagnosticsData, format, includeCharts);
        break;
    case 'detailed':
        content = generateDiagnosticsDetailedContent(diagnosticsData, format, includeCharts);
        break;
    case 'debug':
        content = generateDiagnosticsDebugContent(diagnosticsData, format, includeCharts);
        break;
    case 'health':
        content = generateDiagnosticsHealthContent(diagnosticsData, format, includeCharts);
        break;
    default:
        content = 'Invalid report type';
    }

    return { ...diagnosticsData, content };
}

// Helper functions for diagnostics report content generation
function generateDiagnosticsSummaryContent(data, format, includeCharts) {
    if (format === 'csv') {
        const headers = ['Check Name', 'Status', 'Score', 'Details'];
        const rows = Object.entries(data.checks).map(([name, check]) => [
            name,
            check.status,
            typeof check.score === 'number' ? check.score : 'N/A',
            Object.entries(check)
                .filter(([key, value]) => key !== 'status')
                .map(([key, value]) => `${key}: ${value}`)
                .join(', '),
        ]);
        return [headers, ...rows].map((row) => row.join(',')).join('\n');
    }

    return `
SYSTEM DIAGNOSTICS SUMMARY REPORT
==================================

Generated: ${new Date().toLocaleString()}
Report Type: Summary
Report Period: ${data.period}
System Platform: ${data.systemInfo.platform}
Export Date: ${data.exportDate}

EXECUTIVE SUMMARY
------------------
Overall Health Score: ${data.healthScore}/100
System Status: ${data.healthScore > 80 ? 'Healthy' : data.healthScore > 60 ? 'Needs Attention' : 'Critical'}
Total Checks Run: ${Object.keys(data.checks).length}
Checks Passed: ${Object.values(data.checks).filter((check) => check.status === 'Pass').length}
Checks Failed: ${Object.values(data.checks).filter((check) => check.status === 'Warning').length}

SYSTEM INFORMATION
------------------
Platform: ${data.systemInfo.platform}
User Agent: ${data.systemInfo.userAgent}
Language: ${data.systemInfo.language}
Screen Resolution: ${data.systemInfo.screenResolution}
Timezone: ${data.systemInfo.timezone}

RECOMMENDATIONS
---------------
${data.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}
`;
}

function generateDiagnosticsDetailedContent(data, format, includeCharts) {
    return `
SYSTEM DIAGNOSTICS DETAILED REPORT
=====================================

Generated: ${new Date().toLocaleString()}
Report Type: Detailed
Report Period: ${data.period}

DETAILED CHECK RESULTS
-----------------------
${Object.entries(data.checks)
        .map(
            ([name, check]) => `
${name.toUpperCase()}
-----------
Status: ${check.status}
${Object.entries(check)
        .filter(([key]) => key !== 'status')
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')}
`
        )
        .join('\n')}
`;
}

function generateDiagnosticsDebugContent(data, format, includeCharts) {
    return `
SYSTEM DIAGNOSTICS DEBUG REPORT
================================

Generated: ${new Date().toLocaleString()}
Report Type: Debug

DEBUG INFORMATION
-----------------
System Info: ${JSON.stringify(data.systemInfo, null, 2)}
Health Score: ${data.healthScore}
Error Details: ${JSON.stringify(data.checks.errors, null, 2)}
Memory Details: ${JSON.stringify(data.checks.memory, null, 2)}
`;
}

function generateDiagnosticsHealthContent(data, format, includeCharts) {
    return `
SYSTEM HEALTH REPORT
====================

Generated: ${new Date().toLocaleString()}
Report Type: Health

OVERALL HEALTH
--------------
Health Score: ${data.healthScore}/100
Status: ${data.healthScore > 80 ? 'Healthy' : data.healthScore > 60 ? 'Needs Attention' : 'Critical'}

CHECK STATUS
------------
${Object.entries(data.checks)
        .map(([name, check]) => `${name}: ${check.status}`)
        .join('\n')}
`;
}

// ============================================================================
// EXPORT FUNCTIONS FOR GLOBAL ACCESS
// ============================================================================

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateMockData,
        generateMockCSVData,
        generateMockUploadData,
        generateMockUploadDetails,
        generateMockDirectoryData,
        generateMockDiagnosticsData,
    };
}

// Make functions available globally for browser usage
if (typeof window !== 'undefined') {
    window.ExportMockData = {
        generateMockData,
        generateMockCSVData,
        generateMockUploadData,
        generateMockUploadDetails,
        generateMockDirectoryData,
        generateMockDiagnosticsData,
    };
}
