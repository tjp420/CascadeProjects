/**
 * Chart Factory - Consolidated chart management using Factory pattern
 * Merges analytics-charts.js and interactive-charts.js functionality
 */

class ChartFactory {
    constructor() {
        this.charts = new Map();
        this.chartInstances = new Map();
        this.chartData = new Map();
        this.chartColors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
            '#fa709a', '#fee140', '#30cfd0', '#330867'
        ];
        
        this.colors = {
            primary: '#6366f1',
            secondary: '#8b5cf6',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444',
            info: '#3b82f6',
            gray: '#6b7280'
        };
        
        this.chartThemes = {
            default: {
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderColor: '#6366f1',
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#6366f1'
            },
            dark: {
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: '#4dabf7',
                pointBackgroundColor: '#4dabf7',
                pointBorderColor: '#1a1d23',
                pointHoverBackgroundColor: '#1a1d23',
                pointHoverBorderColor: '#4dabf7'
            }
        };
        
        this.interactiveFeatures = {
            zoom: true,
            pan: true,
            click: true,
            hover: true,
            selection: true
        };
        
        this.chartTypes = [
            'doughnut',
            'bar', 
            'line',
            'radar',
            'polarArea',
            'pie'
        ];
        
        this.init();
    }

    init() {
        console.log('Chart factory initialized');
        this.setupChartInteraction();
        this.setupThemeListener();
    }

    // Factory Method - Create different chart types
    createChart(type, canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element not found: ${canvasId}`);
            return null;
        }

        // Destroy existing chart if present
        this.destroyChart(canvasId);

        const ctx = canvas.getContext('2d');
        const chartConfig = this.getChartConfig(type, data, options);
        
        try {
            const chart = new Chart(ctx, chartConfig);
            this.charts.set(canvasId, chart);
            this.chartInstances.set(canvasId, {
                type,
                config: chartConfig,
                createdAt: new Date().toISOString()
            });
            
            console.log(`Created ${type} chart: ${canvasId}`);
            return chart;
        } catch (error) {
            console.error(`Failed to create chart ${canvasId}:`, error);
            return null;
        }
    }

    // Chart Configuration Builder
    getChartConfig(type, data, options = {}) {
        const baseConfig = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 12
                    },
                    padding: 10,
                    cornerRadius: 4
                }
            }
        };

        // Apply theme
        const theme = this.getCurrentTheme();
        if (theme === 'dark') {
            baseConfig.plugins.legend.labels.color = '#e9ecef';
            baseConfig.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        }

        switch (type) {
        case 'doughnut':
            return this.getDoughnutConfig(data, baseConfig, options);
        case 'bar':
            return this.getBarConfig(data, baseConfig, options);
        case 'line':
            return this.getLineConfig(data, baseConfig, options);
        case 'radar':
            return this.getRadarConfig(data, baseConfig, options);
        case 'polarArea':
            return this.getPolarAreaConfig(data, baseConfig, options);
        case 'pie':
            return this.getPieConfig(data, baseConfig, options);
        default:
            throw new Error(`Unsupported chart type: ${type}`);
        }
    }

    getDoughnutConfig(data, baseConfig, options) {
        return {
            type: 'doughnut',
            data: {
                labels: data.labels || [],
                datasets: [{
                    data: data.values || [],
                    backgroundColor: data.colors || this.generateColors(data.labels?.length || 0),
                    borderWidth: 2,
                    borderColor: theme === 'dark' ? '#1a1d23' : '#ffffff'
                }]
            },
            options: {
                ...baseConfig,
                cutout: '60%',
                plugins: {
                    ...baseConfig.plugins,
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        };
    }

    getBarConfig(data, baseConfig, options) {
        return {
            type: 'bar',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: data.label || 'Data',
                    data: data.values || [],
                    backgroundColor: data.backgroundColor || this.colors.primary,
                    borderColor: data.borderColor || this.colors.primary,
                    borderWidth: 1,
                    borderRadius: 4,
                    hoverBackgroundColor: data.hoverColor || this.colors.primary
                }]
            },
            options: {
                ...baseConfig,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: theme === 'dark' ? '#e9ecef' : '#212529'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: theme === 'dark' ? '#e9ecef' : '#212529'
                        }
                    }
                },
                plugins: {
                    ...baseConfig.plugins,
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        };
    }

    getLineConfig(data, baseConfig, options) {
        return {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: data.label || 'Data',
                    data: data.values || [],
                    borderColor: data.borderColor || this.colors.primary,
                    backgroundColor: data.backgroundColor || `${this.colors.primary}20`,
                    borderWidth: 2,
                    fill: options.fill || false,
                    tension: options.tension || 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                ...baseConfig,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: theme === 'dark' ? '#e9ecef' : '#212529'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: theme === 'dark' ? '#e9ecef' : '#212529'
                        }
                    }
                },
                plugins: {
                    ...baseConfig.plugins,
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        };
    }

    getRadarConfig(data, baseConfig, options) {
        return {
            type: 'radar',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: data.label || 'Data',
                    data: data.values || [],
                    borderColor: data.borderColor || this.colors.primary,
                    backgroundColor: data.backgroundColor || `${this.colors.primary}20`,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                ...baseConfig,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: options.maxValue || 100,
                        grid: {
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        pointLabels: {
                            color: theme === 'dark' ? '#e9ecef' : '#212529',
                            font: {
                                size: 11
                            }
                        },
                        ticks: {
                            color: theme === 'dark' ? '#e9ecef' : '#212529',
                            backdropColor: 'transparent'
                        }
                    }
                },
                plugins: {
                    ...baseConfig.plugins,
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        };
    }

    getPolarAreaConfig(data, baseConfig, options) {
        return {
            type: 'polarArea',
            data: {
                labels: data.labels || [],
                datasets: [{
                    data: data.values || [],
                    backgroundColor: data.colors || this.generateColors(data.labels?.length || 0, 0.6),
                    borderWidth: 2,
                    borderColor: theme === 'dark' ? '#1a1d23' : '#ffffff'
                }]
            },
            options: {
                ...baseConfig,
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: {
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: theme === 'dark' ? '#e9ecef' : '#212529'
                        }
                    }
                },
                plugins: {
                    ...baseConfig.plugins,
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        };
    }

    getPieConfig(data, baseConfig, options) {
        return {
            type: 'pie',
            data: {
                labels: data.labels || [],
                datasets: [{
                    data: data.values || [],
                    backgroundColor: data.colors || this.generateColors(data.labels?.length || 0),
                    borderWidth: 2,
                    borderColor: theme === 'dark' ? '#1a1d23' : '#ffffff'
                }]
            },
            options: {
                ...baseConfig,
                plugins: {
                    ...baseConfig.plugins,
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        };
    }

    // Utility Methods
    generateColors(count, alpha = 0.8) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const color = this.chartColors[i % this.chartColors.length];
            colors.push(alpha < 1 ? `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : color);
        }
        return colors;
    }

    getCurrentTheme() {
        return document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    }

    setupThemeListener() {
        // Listen for theme changes to update charts
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    this.updateChartsTheme();
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    updateChartsTheme() {
        const theme = this.getCurrentTheme();
        console.log(`Updating charts theme to: ${theme}`);
        
        this.charts.forEach((chart, canvasId) => {
            const instance = this.chartInstances.get(canvasId);
            if (instance) {
                // Update chart colors based on theme
                const newConfig = this.getChartConfig(instance.type, chart.data, {});
                chart.options = newConfig.options;
                chart.update('none');
            }
        });
    }

    setupChartInteraction() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.chart-container') || e.target.closest('canvas')) {
                this.handleChartInteraction(e);
            }
        });
    }

    handleChartInteraction(event) {
        const canvas = event.target.closest('canvas');
        if (!canvas) {
            return;
        }

        const chartId = canvas.id;
        const chart = this.charts.get(chartId);
        
        if (chart) {
            const activePoints = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
            if (activePoints.length) {
                const firstPoint = activePoints[0];
                const label = chart.data.labels[firstPoint.index];
                const value = chart.data.datasets[firstPoint.datasetIndex].data[firstPoint.index];
                
                this.showDataPointDetails(label, value, firstPoint.datasetIndex);
            }
        }
    }

    showDataPointDetails(label, value, datasetIndex) {
        // Create or update tooltip
        let tooltip = document.getElementById('chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'chart-tooltip';
            tooltip.style.cssText = `
                position: fixed;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
            `;
            document.body.appendChild(tooltip);
        }

        tooltip.textContent = `
            <strong>${label}</strong><br>
            Value: ${value}
        ` /* Replaced innerHTML with textContent for safety */
        
        tooltip.style.opacity = '1';
        
        // Position tooltip near mouse
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = `${rect.left + event.clientX - rect.left + 10}px`;
        tooltip.style.top = `${rect.top + event.clientY - rect.top - 30}px`;
        
        // Hide after 3 seconds
        setTimeout(() => {
            tooltip.style.opacity = '0';
        }, 3000);
    }

    // Chart Management Methods
    updateChart(canvasId, newData) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.data = newData;
            chart.update();
            console.log(`Updated chart: ${canvasId}`);
        }
    }

    destroyChart(canvasId) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.destroy();
            this.charts.delete(canvasId);
            this.chartInstances.delete(canvasId);
            console.log(`Destroyed chart: ${canvasId}`);
        }
    }

    destroyAllCharts() {
        this.charts.forEach((chart, canvasId) => {
            chart.destroy();
        });
        this.charts.clear();
        this.chartInstances.clear();
        console.log('All charts destroyed');
    }

    // Convenience Methods for Common Charts
    createFileTypesChart(canvasId, fileTypes) {
        const labels = Object.keys(fileTypes).filter(ext => fileTypes[ext] > 0);
        const values = labels.map(ext => fileTypes[ext]);
        
        return this.createChart('doughnut', canvasId, {
            labels: labels.map(ext => ext || 'no extension'),
            values: values,
            colors: this.generateColors(labels.length)
        }, {
            title: 'File Type Distribution'
        });
    }

    createSizeChart(canvasId, files) {
        const largestFiles = files.slice(0, 5);
        const labels = largestFiles.map(file => file.name);
        const values = largestFiles.map(file => file.size / 1024); // Convert to KB
        
        return this.createChart('bar', canvasId, {
            labels: labels,
            values: values,
            label: 'File Size (KB)'
        }, {
            title: 'Largest Files'
        });
    }

    createMetricsChart(canvasId, metrics) {
        const labels = Object.keys(metrics);
        const values = Object.values(metrics);
        
        return this.createChart('radar', canvasId, {
            labels: labels,
            values: values,
            label: 'Project Metrics'
        }, {
            title: 'Project Metrics Overview',
            maxValue: 100
        });
    }

    // Export Methods
    exportChart(canvasId, format = 'png') {
        const chart = this.charts.get(canvasId);
        if (!chart) {
            console.warn(`Chart not found: ${canvasId}`);
            return null;
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return null;
        }

        let url, filename;
        
        switch (format) {
        case 'png':
            url = canvas.toDataURL('image/png');
            filename = `chart_${canvasId}_${Date.now()}.png`;
            break;
        case 'jpg':
            url = canvas.toDataURL('image/jpeg', 0.9);
            filename = `chart_${canvasId}_${Date.now()}.jpg`;
            break;
        default:
            console.warn(`Unsupported export format: ${format}`);
            return null;
        }

        // Download the image
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        console.log(`Exported chart ${canvasId} as ${format}`);
        return filename;
    }

    // Public API
    getChart(canvasId) {
        return this.charts.get(canvasId);
    }

    getAllCharts() {
        return Array.from(this.charts.entries());
    }

    getChartCount() {
        return this.charts.size;
    }

    getSupportedTypes() {
        return [...this.chartTypes];
    }

    destroy() {
        this.destroyAllCharts();
    }
}

// Initialize chart factory when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chartFactory = new ChartFactory();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartFactory;
}
