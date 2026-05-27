/**
 * Chart Controller - Manages chart initialization and updates
 */

export class ChartController {
    constructor(dataEngine) {
        this.dataEngine = dataEngine;
        this.charts = new Map();
        this.chartDefaults = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        };
    }

    initializeCharts() {
        console.log('Initializing charts...');
        const data = this.dataEngine.getData();
        if (!data) {
            return;
        }

        this.initializeFileTypesChart(data);
        this.initializeSizeChart(data);
        this.initializeMetricsChart(data);
    }

    initializeFileTypesChart(data) {
        const canvasId = 'fileTypesChart';
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            return;
        }

        const fileTypes = data.file_types;
        const labels = Object.keys(fileTypes).filter(ext => fileTypes[ext] > 0);
        const chartData = labels.map(ext => fileTypes[ext]);

        // Robust cleanup: check both our map and Chart.js registry
        if (this.charts.has('fileTypes')) {
            this.charts.get('fileTypes').destroy();
        }
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) {
            existingChart.destroy();
        }

        this.charts.set('fileTypes', new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map(ext => ext || 'no extension'),
                datasets: [{
                    data: chartData,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                    ]
                }]
            },
            options: {
                ...this.chartDefaults,
                plugins: {
                    ...this.chartDefaults.plugins,
                    title: {
                        display: true,
                        text: 'File Type Distribution'
                    }
                }
            }
        }));
    }

    initializeSizeChart(data) {
        const canvasId = 'sizeChart';
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            return;
        }

        const largestFiles = data.largest_files.slice(0, 5);
        const labels = largestFiles.map(file => file.name);
        const chartData = largestFiles.map(file => file.size / 1024);

        if (this.charts.has('size')) {
            this.charts.get('size').destroy();
        }
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) {
            existingChart.destroy();
        }

        this.charts.set('size', new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'File Size (KB)',
                    data: chartData,
                    backgroundColor: '#36A2EB'
                }]
            },
            options: {
                ...this.chartDefaults,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Size (KB)'
                        }
                    }
                },
                plugins: {
                    ...this.chartDefaults.plugins,
                    title: {
                        display: true,
                        text: 'Largest Files'
                    }
                }
            }
        }));
    }

    initializeMetricsChart(data) {
        const canvasId = 'metricsChart';
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            return;
        }

        const metrics = data.metrics || {};
        const labels = Object.keys(metrics);
        const chartData = Object.values(metrics);

        if (this.charts.has('metrics')) {
            this.charts.get('metrics').destroy();
        }
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) {
            existingChart.destroy();
        }

        this.charts.set('metrics', new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Project Metrics',
                    data: chartData,
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    pointBackgroundColor: 'rgba(99, 102, 241, 1)'
                }]
            },
            options: {
                ...this.chartDefaults,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                },
                plugins: {
                    ...this.chartDefaults.plugins,
                    title: {
                        display: true,
                        text: 'Project Metrics Overview'
                    }
                }
            }
        }));
    }

    updateCharts() {
        const data = this.dataEngine.getData();
        if (!data) {
            return;
        }

        this.initializeFileTypesChart(data);
        this.initializeSizeChart(data);
        this.initializeMetricsChart(data);
    }

    destroyChart(chartId) {
        if (this.charts.has(chartId)) {
            this.charts.get(chartId).destroy();
            this.charts.delete(chartId);
        }
    }

    destroyAllCharts() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }

    getChart(chartId) {
        return this.charts.get(chartId);
    }

    getAllCharts() {
        return Array.from(this.charts.entries());
    }
}
