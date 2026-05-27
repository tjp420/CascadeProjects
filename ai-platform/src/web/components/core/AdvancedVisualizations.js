/**
 * Advanced Visualization Components
 * 
 * Enhanced chart visualizations with interactive features and modern design
 */

import Chart from 'chart.js/auto';

export class AdvancedVisualizations {
    constructor() {
        this.charts = new Map();
        this.defaultOptions = this.getDefaultOptions();
    }

    /**
     * Get default chart options
     */
    getDefaultOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12,
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            },
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            }
        };
    }

    /**
     * Create metric trend chart
     */
    createTrendChart(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            return null;
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: data.label || 'Metric',
                    data: data.values,
                    borderColor: data.color || '#6366f1',
                    backgroundColor: this.createGradient(ctx, data.color || '#6366f1'),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...this.defaultOptions,
                ...options,
                plugins: {
                    ...this.defaultOptions.plugins,
                    ...options.plugins
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create gauge chart for single metrics
     */
    createGaugeChart(canvasId, value, maxValue, label, color = '#6366f1') {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            return null;
        }

        const percentage = (value / maxValue) * 100;
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [label, 'Remaining'],
                datasets: [{
                    data: [value, maxValue - value],
                    backgroundColor: [color, '#e2e8f0'],
                    borderWidth: 0,
                    circumference: 270,
                    rotation: 225,
                    cutout: '75%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    },
                    title: {
                        display: true,
                        text: `${percentage.toFixed(1)}%`,
                        position: 'bottom',
                        font: {
                            size: 24,
                            weight: 'bold'
                        },
                        color: color
                    }
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create heatmap visualization
     */
    createHeatmap(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            return null;
        }

        // Process data for heatmap
        const labels = data.map(d => d.label);
        const values = data.map(d => d.value);
        const colors = values.map(v => this.getHeatmapColor(v, Math.min(...values), Math.max(...values)));

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: options.label || 'Intensity',
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    borderRadius: 4
                }]
            },
            options: {
                ...this.defaultOptions,
                indexAxis: 'y',
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        display: false
                    }
                },
                ...options
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create radar chart for multi-dimensional analysis
     */
    createRadarChart(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            return null;
        }

        const chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: data.labels,
                datasets: data.datasets.map((dataset, index) => ({
                    label: dataset.label,
                    data: dataset.values,
                    backgroundColor: this.createGradient(ctx, dataset.color || this.colors[index], 0.2),
                    borderColor: dataset.color || this.colors[index],
                    borderWidth: 2,
                    pointBackgroundColor: dataset.color || this.colors[index],
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }))
            },
            options: {
                ...this.defaultOptions,
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        angleLines: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        pointLabels: {
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    }
                },
                ...options
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create waterfall chart for cumulative analysis
     */
    createWaterfallChart(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            return null;
        }

        const processedData = this.processWaterfallData(data);

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: processedData.labels,
                datasets: [{
                    label: options.label || 'Value',
                    data: processedData.values,
                    backgroundColor: processedData.colors,
                    borderWidth: 0,
                    borderRadius: 4
                }]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const index = context.dataIndex;
                                const item = data[index];
                                return `${item.label}: ${item.value > 0 ? '+' : ''}${item.value}`;
                            }
                        }
                    }
                },
                ...options
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create Sankey diagram for flow visualization (simplified implementation)
     */
    createSankeyDiagram(canvasId, data, options = {}) {
        // This is a simplified version - for full Sankey, consider using a dedicated library
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            return null;
        }

        // Convert to a stacked bar chart as approximation
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.stages,
                datasets: data.flows.map((flow, index) => ({
                    label: flow.name,
                    data: flow.values,
                    backgroundColor: flow.color || this.colors[index % this.colors.length],
                    borderWidth: 0
                }))
            },
            options: {
                ...this.defaultOptions,
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true
                    }
                },
                ...options
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create timeline visualization
     */
    createTimelineChart(canvasId, events, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            return null;
        }

        const chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: options.label || 'Events',
                    data: events.map(event => ({
                        x: event.date,
                        y: event.category || 1,
                        event: event
                    })),
                    backgroundColor: events.map(e => e.color || '#6366f1'),
                    pointRadius: 8,
                    pointHoverRadius: 12
                }]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const event = context.raw.event;
                                return `${event.title}: ${event.date}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        }
                    },
                    y: {
                        display: false
                    }
                },
                ...options
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create comparison chart
     */
    createComparisonChart(canvasId, datasets, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            return null;
        }

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datasets[0].labels,
                datasets: datasets.map((dataset, index) => ({
                    label: dataset.label,
                    data: dataset.values,
                    backgroundColor: dataset.color || this.colors[index % this.colors.length],
                    borderWidth: 0,
                    borderRadius: 4
                }))
            },
            options: {
                ...this.defaultOptions,
                ...options
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create distribution chart
     */
    createDistributionChart(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            return null;
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: options.label || 'Distribution',
                    data: data.values,
                    borderColor: data.color || '#6366f1',
                    backgroundColor: this.createGradient(ctx, data.color || '#6366f1', 0.3),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        display: false
                    }
                },
                ...options
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create progress chart
     */
    createProgressChart(canvasId, progressData, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            return null;
        }

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: progressData.map(d => d.label),
                datasets: [{
                    label: 'Progress',
                    data: progressData.map(d => d.value),
                    backgroundColor: progressData.map(d => d.color || this.getColorForValue(d.value)),
                    borderWidth: 0,
                    borderRadius: 8
                }]
            },
            options: {
                ...this.defaultOptions,
                indexAxis: 'y',
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        max: 100,
                        ticks: {
                            callback: (value) => `${value}%`
                        }
                    }
                },
                ...options
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Update existing chart
     */
    updateChart(canvasId, newData) {
        const chart = this.charts.get(canvasId);
        if (!chart) {
            return false;
        }

        chart.data = newData;
        chart.update();
        return true;
    }

    /**
     * Destroy chart
     */
    destroyChart(canvasId) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.destroy();
            this.charts.delete(canvasId);
            return true;
        }
        return false;
    }

    /**
     * Destroy all charts
     */
    destroyAllCharts() {
        this.charts.forEach((chart, canvasId) => {
            chart.destroy();
        });
        this.charts.clear();
    }

    /**
     * Create gradient for chart
     */
    createGradient(ctx, color, alpha = 0.5) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, this.hexToRgba(color, alpha));
        gradient.addColorStop(1, this.hexToRgba(color, 0.05));
        return gradient;
    }

    /**
     * Get heatmap color based on value
     */
    getHeatmapColor(value, min, max) {
        const percentage = (value - min) / (max - min);
        
        if (percentage < 0.25) {
            return '#10b981';
        } // green
        if (percentage < 0.5) {
            return '#3b82f6';
        } // blue
        if (percentage < 0.75) {
            return '#f59e0b';
        } // orange
        return '#ef4444'; // red
    }

    /**
     * Get color based on value (for progress charts)
     */
    getColorForValue(value) {
        if (value >= 80) {
            return '#10b981';
        }
        if (value >= 60) {
            return '#3b82f6';
        }
        if (value >= 40) {
            return '#f59e0b';
        }
        return '#ef4444';
    }

    /**
     * Process data for waterfall chart
     */
    processWaterfallData(data) {
        let runningTotal = 0;
        const labels = [];
        const values = [];
        const colors = [];

        data.forEach((item, index) => {
            labels.push(item.label);
            
            if (item.isTotal) {
                values.push(runningTotal);
                colors.push('#6366f1');
            } else {
                values.push(item.value);
                runningTotal += item.value;
                colors.push(item.value > 0 ? '#10b981' : '#ef4444');
            }
        });

        return { labels, values, colors };
    }

    /**
     * Convert hex to rgba
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Available colors
     */
    colors = [
        '#6366f1', // primary
        '#8b5cf6', // secondary
        '#10b981', // success
        '#f59e0b', // warning
        '#ef4444', // danger
        '#3b82f6', // info
        '#ec4899', // pink
        '#14b8a6'  // teal
    ];
}

export default AdvancedVisualizations;