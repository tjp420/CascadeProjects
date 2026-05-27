// BI Tool Integration Connectors
console.log('🔗 BI Integration Connectors loading...');

class BIIntegrationManager {
    constructor() {
        this.connectors = {
            powerbi: new PowerBIConnector(),
            tableau: new TableauConnector(),
            googlesheets: new GoogleSheetsConnector(),
            excel: new ExcelConnector()
        };
    }

    exportToPowerBI(data) {
        return this.connectors.powerbi.exportData(data);
    }

    exportToTableau(data) {
        return this.connectors.tableau.exportData(data);
    }

    exportToGoogleSheets(data) {
        return this.connectors.googlesheets.exportData(data);
    }

    exportToExcel(data) {
        return this.connectors.excel.exportData(data);
    }

    getAllExports(data) {
        return {
            powerbi: this.exportToPowerBI(data),
            tableau: this.exportToTableau(data),
            googlesheets: this.exportToGoogleSheets(data),
            excel: this.exportToExcel(data)
        };
    }
}

// Power BI Connector
class PowerBIConnector {
    exportData(data) {
        // Create Power BI dataset format
        const dataset = {
            name: 'Dashboard Metrics',
            tables: [
                {
                    name: 'Overview',
                    columns: [
                        { name: 'Metric', dataType: 'string' },
                        { name: 'Value', dataType: 'number' },
                        { name: 'Grade', dataType: 'string' },
                        { name: 'Timestamp', dataType: 'dateTime' }
                    ],
                    rows: [
                        { Metric: 'Total Files', Value: data.overview.totalFiles, Grade: '-', Timestamp: new Date().toISOString() },
                        { Metric: 'Total Complexity', Value: data.overview.totalComplexity, Grade: '-', Timestamp: new Date().toISOString() },
                        { Metric: 'Performance Score', Value: data.overview.performance, Grade: this.getGrade(data.overview.performance), Timestamp: new Date().toISOString() }
                    ]
                },
                {
                    name: 'TechnicalDebt',
                    columns: [
                        { name: 'Priority', dataType: 'string' },
                        { name: 'Count', dataType: 'number' },
                        { name: 'Percentage', dataType: 'number' }
                    ],
                    rows: [
                        { Priority: 'High', Count: data.technicalDebt.high, Percentage: (data.technicalDebt.high / data.technicalDebt.total * 100).toFixed(1) },
                        { Priority: 'Medium', Count: data.technicalDebt.medium, Percentage: (data.technicalDebt.medium / data.technicalDebt.total * 100).toFixed(1) },
                        { Priority: 'Low', Count: data.technicalDebt.low, Percentage: (data.technicalDebt.low / data.technicalDebt.total * 100).toFixed(1) }
                    ]
                },
                {
                    name: 'Performance',
                    columns: [
                        { name: 'Metric', dataType: 'string' },
                        { name: 'Value', dataType: 'number' },
                        { name: 'Unit', dataType: 'string' },
                        { name: 'Status', dataType: 'string' }
                    ],
                    rows: [
                        { Metric: 'Response Time', Value: data.performance.responseTime, Unit: 'ms', Status: this.getResponseTimeStatus(data.performance.responseTime) },
                        { Metric: 'Throughput', Value: data.performance.throughput, Unit: 'req/min', Status: 'Good' },
                        { Metric: 'Error Rate', Value: data.performance.errorRate * 100, Unit: '%', Status: this.getErrorRateStatus(data.performance.errorRate) }
                    ]
                }
            ]
        };

        return {
            format: 'powerbi',
            data: dataset,
            downloadUrl: this.createPowerBIDownloadLink(dataset),
            instructions: `
                Power BI Import Instructions:
                1. Open Power BI Desktop
                2. Click "Get Data" → "JSON"
                3. Copy and paste the JSON data above
                4. Click "Load"
                5. Create visualizations from the imported tables
            `
        };
    }

    createPowerBIDownloadLink(dataset) {
        const jsonData = JSON.stringify(dataset, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        return URL.createObjectURL(blob);
    }

    getGrade(score) {
        if (score >= 90) {
            return 'A+';
        }
        if (score >= 85) {
            return 'A';
        }
        if (score >= 80) {
            return 'B+';
        }
        if (score >= 75) {
            return 'B';
        }
        if (score >= 70) {
            return 'C+';
        }
        if (score >= 65) {
            return 'C';
        }
        return 'D';
    }

    getResponseTimeStatus(responseTime) {
        if (responseTime <= 200) {
            return 'Excellent';
        }
        if (responseTime <= 300) {
            return 'Good';
        }
        if (responseTime <= 400) {
            return 'Acceptable';
        }
        return 'Poor';
    }

    getErrorRateStatus(errorRate) {
        if (errorRate <= 0.01) {
            return 'Excellent';
        }
        if (errorRate <= 0.05) {
            return 'Good';
        }
        if (errorRate <= 0.1) {
            return 'Acceptable';
        }
        return 'Poor';
    }
}

// Tableau Connector
class TableauConnector {
    exportData(data) {
        // Create Tableau hyper extract format
        const extract = {
            connection: {
                name: 'Dashboard Metrics Connection',
                type: 'json',
                authentication: 'none'
            },
            tables: [
                {
                    name: 'Overview',
                    columns: [
                        { name: 'TotalFiles', dataType: 'integer' },
                        { name: 'TotalComplexity', dataType: 'integer' },
                        { name: 'PerformanceScore', dataType: 'integer' },
                        { name: 'ComplexityPerFile', dataType: 'decimal' },
                        { name: 'ExportDate', dataType: 'datetime' }
                    ],
                    data: [{
                        TotalFiles: data.overview.totalFiles,
                        TotalComplexity: data.overview.totalComplexity,
                        PerformanceScore: data.overview.performance,
                        ComplexityPerFile: (data.overview.totalComplexity / data.overview.totalFiles).toFixed(2),
                        ExportDate: new Date().toISOString()
                    }]
                },
                {
                    name: 'TechnicalDebtBreakdown',
                    columns: [
                        { name: 'Priority', dataType: 'string' },
                        { name: 'Count', dataType: 'integer' },
                        { name: 'Percentage', dataType: 'decimal' }
                    ],
                    data: [
                        { Priority: 'High', Count: data.technicalDebt.high, Percentage: (data.technicalDebt.high / data.technicalDebt.total * 100).toFixed(1) },
                        { Priority: 'Medium', Count: data.technicalDebt.medium, Percentage: (data.technicalDebt.medium / data.technicalDebt.total * 100).toFixed(1) },
                        { Priority: 'Low', Count: data.technicalDebt.low, Percentage: (data.technicalDebt.low / data.technicalDebt.total * 100).toFixed(1) }
                    ]
                },
                {
                    name: 'PerformanceMetrics',
                    columns: [
                        { name: 'ResponseTime', dataType: 'integer' },
                        { name: 'Throughput', dataType: 'integer' },
                        { name: 'ErrorRate', dataType: 'decimal' },
                        { name: 'SLACompliance', dataType: 'boolean' }
                    ],
                    data: [{
                        ResponseTime: data.performance.responseTime,
                        Throughput: data.performance.throughput,
                        ErrorRate: data.performance.errorRate,
                        SLACompliance: data.performance.responseTime <= 300 && data.performance.errorRate <= 0.001
                    }]
                }
            ]
        };

        return {
            format: 'tableau',
            data: extract,
            downloadUrl: this.createTableauDownloadLink(extract),
            instructions: `
                Tableau Import Instructions:
                1. Open Tableau Desktop
                2. Click "Connect" → "To a Server" → "Microsoft Excel"
                3. Download the JSON file and convert to Excel
                4. Select the Excel file and import
                5. Create visualizations from the imported data
            `
        };
    }

    createTableauDownloadLink(extract) {
        const jsonData = JSON.stringify(extract, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        return URL.createObjectURL(blob);
    }
}

// Google Sheets Connector
class GoogleSheetsConnector {
    exportData(data) {
        // Create Google Sheets format
        const sheets = {
            overview: this.createOverviewSheet(data),
            technicalDebt: this.createTechnicalDebtSheet(data),
            performance: this.createPerformanceSheet(data),
            backup: this.createBackupSheet(data)
        };

        return {
            format: 'googlesheets',
            data: sheets,
            downloadUrl: this.createGoogleSheetsDownloadLink(sheets),
            instructions: `
                Google Sheets Import Instructions:
                1. Open Google Sheets
                2. Click "File" → "Import" → "Upload"
                3. Download and upload the JSON file
                4. Select "Replace spreadsheet" with this sheet
                5. Create charts and dashboards from the data
            `
        };
    }

    createOverviewSheet(data) {
        return {
            name: 'Overview',
            headers: ['Metric', 'Value', 'Status', 'Notes'],
            rows: [
                ['Total Files', data.overview.totalFiles, 'Active', 'Current file count'],
                ['Total Complexity', data.overview.totalComplexity, 'Active', 'Total complexity points'],
                ['Performance Score', `${data.overview.performance}%`, this.getPerformanceStatus(data.overview.performance), 'Overall system performance'],
                ['Complexity Per File', (data.overview.totalComplexity / data.overview.totalFiles).toFixed(2), this.getComplexityStatus(data.overview.totalComplexity / data.overview.totalFiles), 'Average complexity per file']
            ]
        };
    }

    createTechnicalDebtSheet(data) {
        return {
            name: 'Technical Debt',
            headers: ['Priority', 'Count', 'Percentage', 'Action Required', 'Estimated Effort'],
            rows: [
                ['High', data.technicalDebt.high, `${(data.technicalDebt.high / data.technicalDebt.total * 100).toFixed(1)}%`, 'Immediate', `${data.technicalDebt.high * 8} hours`],
                ['Medium', data.technicalDebt.medium, `${(data.technicalDebt.medium / data.technicalDebt.total * 100).toFixed(1)}%`, 'Next Sprint', `${data.technicalDebt.medium * 4} hours`],
                ['Low', data.technicalDebt.low, `${(data.technicalDebt.low / data.technicalDebt.total * 100).toFixed(1)}%`, 'When Available', `${data.technicalDebt.low * 2} hours`],
                ['Total', data.technicalDebt.total, '100%', 'Ongoing', `${(data.technicalDebt.high * 8 + data.technicalDebt.medium * 4 + data.technicalDebt.low * 2)} hours`]
            ]
        };
    }

    createPerformanceSheet(data) {
        return {
            name: 'Performance Metrics',
            headers: ['Metric', 'Value', 'Target', 'Status', 'Trend'],
            rows: [
                ['Response Time', `${data.performance.responseTime}ms`, '<300ms', this.getResponseTimeStatus(data.performance.responseTime), 'Stable'],
                ['Throughput', `${data.performance.throughput} req/min`, '>1000 req/min', 'Good', 'Increasing'],
                ['Error Rate', `${(data.performance.errorRate * 100).toFixed(2)}%`, '<0.1%', this.getErrorRateStatus(data.performance.errorRate), 'Improving'],
                ['SLA Compliance', data.performance.responseTime <= 300 && data.performance.errorRate <= 0.001 ? 'Yes' : 'No', '100%', 'Active', 'Monitoring']
            ]
        };
    }

    createBackupSheet(data) {
        const lastBackup = new Date(data.backup.lastBackup);
        const hoursSinceBackup = (new Date() - lastBackup) / (1000 * 60 * 60);
        
        return {
            name: 'Backup Status',
            headers: ['Metric', 'Value', 'Status', 'Last Updated'],
            rows: [
                ['Total Backups', data.backup.totalBackups, 'Active', new Date().toISOString()],
                ['Last Backup', data.backup.lastBackup, hoursSinceBackup <= 24 ? 'Current' : 'Overdue', data.backup.lastBackup],
                ['Backup Frequency', this.calculateBackupFrequency(data.backup.totalBackups), 'Monitoring', new Date().toISOString()],
                ['Backup Health', this.getBackupHealth(hoursSinceBackup), 'Good', new Date().toISOString()]
            ]
        };
    }

    calculateBackupFrequency(totalBackups) {
        // Assuming 30-day period
        const frequency = totalBackups / 30;
        return `Every ${(24 / frequency).toFixed(0)} hours`;
    }

    getBackupHealth(hoursSinceBackup) {
        if (hoursSinceBackup <= 24) {
            return 'Excellent';
        }
        if (hoursSinceBackup <= 48) {
            return 'Good';
        }
        if (hoursSinceBackup <= 72) {
            return 'Acceptable';
        }
        return 'Poor';
    }

    getPerformanceStatus(score) {
        if (score >= 90) {
            return 'Excellent';
        }
        if (score >= 80) {
            return 'Good';
        }
        if (score >= 70) {
            return 'Acceptable';
        }
        return 'Needs Improvement';
    }

    getComplexityStatus(complexityPerFile) {
        if (complexityPerFile <= 20) {
            return 'Excellent';
        }
        if (complexityPerFile <= 35) {
            return 'Good';
        }
        if (complexityPerFile <= 50) {
            return 'Acceptable';
        }
        return 'High';
    }

    getResponseTimeStatus(responseTime) {
        if (responseTime <= 200) {
            return 'Excellent';
        }
        if (responseTime <= 300) {
            return 'Good';
        }
        if (responseTime <= 400) {
            return 'Acceptable';
        }
        return 'Poor';
    }

    getErrorRateStatus(errorRate) {
        if (errorRate <= 0.01) {
            return 'Excellent';
        }
        if (errorRate <= 0.05) {
            return 'Good';
        }
        if (errorRate <= 0.1) {
            return 'Acceptable';
        }
        return 'Poor';
    }

    createGoogleSheetsDownloadLink(sheets) {
        const jsonData = JSON.stringify(sheets, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        return URL.createObjectURL(blob);
    }
}

// Excel Connector
class ExcelConnector {
    exportData(data) {
        // Create Excel-ready CSV format
        const csvData = this.createExcelCSV(data);
        
        return {
            format: 'excel',
            data: csvData,
            downloadUrl: this.createExcelDownloadLink(csvData),
            instructions: `
                Excel Import Instructions:
                1. Download the CSV file
                2. Open Excel
                3. Click "Data" → "From Text/CSV"
                4. Select the downloaded file
                5. Create pivot tables and charts
            `
        };
    }

    createExcelCSV(data) {
        const rows = [
            ['Dashboard Metrics Export'],
            ['Export Date:', new Date().toISOString()],
            [],
            ['Overview'],
            ['Metric', 'Value', 'Status'],
            ['Total Files', data.overview.totalFiles, 'Active'],
            ['Total Complexity', data.overview.totalComplexity, 'Active'],
            ['Performance Score', `${data.overview.performance}%`, this.getPerformanceStatus(data.overview.performance)],
            ['Complexity Per File', (data.overview.totalComplexity / data.overview.totalFiles).toFixed(2), this.getComplexityStatus(data.overview.totalComplexity / data.overview.totalFiles)],
            [],
            ['Technical Debt'],
            ['Priority', 'Count', 'Percentage', 'Action Required'],
            ['High', data.technicalDebt.high, `${(data.technicalDebt.high / data.technicalDebt.total * 100).toFixed(1)}%`, 'Immediate'],
            ['Medium', data.technicalDebt.medium, `${(data.technicalDebt.medium / data.technicalDebt.total * 100).toFixed(1)}%`, 'Next Sprint'],
            ['Low', data.technicalDebt.low, `${(data.technicalDebt.low / data.technicalDebt.total * 100).toFixed(1)}%`, 'When Available'],
            ['Total', data.technicalDebt.total, '100%', 'Ongoing'],
            [],
            ['Performance Metrics'],
            ['Metric', 'Value', 'Target', 'Status'],
            ['Response Time', `${data.performance.responseTime}ms`, '<300ms', this.getResponseTimeStatus(data.performance.responseTime)],
            ['Throughput', `${data.performance.throughput} req/min`, '>1000 req/min', 'Good'],
            ['Error Rate', `${(data.performance.errorRate * 100).toFixed(2)}%`, '<0.1%', this.getErrorRateStatus(data.performance.errorRate)],
            [],
            ['Backup Status'],
            ['Metric', 'Value', 'Status'],
            ['Total Backups', data.backup.totalBackups, 'Active'],
            ['Last Backup', data.backup.lastBackup, new Date(data.backup.lastBackup) > new Date(Date.now() - 24 * 60 * 60 * 1000) ? 'Current' : 'Overdue'],
            ['Backup Frequency', 'Daily', 'Monitoring']
        ];

        return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }

    createExcelDownloadLink(csvData) {
        const blob = new Blob([csvData], { type: 'text/csv' });
        return URL.createObjectURL(blob);
    }

    getPerformanceStatus(score) {
        if (score >= 90) {
            return 'Excellent';
        }
        if (score >= 80) {
            return 'Good';
        }
        if (score >= 70) {
            return 'Acceptable';
        }
        return 'Needs Improvement';
    }

    getComplexityStatus(complexityPerFile) {
        if (complexityPerFile <= 20) {
            return 'Excellent';
        }
        if (complexityPerFile <= 35) {
            return 'Good';
        }
        if (complexityPerFile <= 50) {
            return 'Acceptable';
        }
        return 'High';
    }

    getResponseTimeStatus(responseTime) {
        if (responseTime <= 200) {
            return 'Excellent';
        }
        if (responseTime <= 300) {
            return 'Good';
        }
        if (responseTime <= 400) {
            return 'Acceptable';
        }
        return 'Poor';
    }

    getErrorRateStatus(errorRate) {
        if (errorRate <= 0.01) {
            return 'Excellent';
        }
        if (errorRate <= 0.05) {
            return 'Good';
        }
        if (errorRate <= 0.1) {
            return 'Acceptable';
        }
        return 'Poor';
    }
}

// Global BI Integration Manager
window.biIntegrationManager = new BIIntegrationManager();

console.log('✅ BI Integration Connectors loaded');
