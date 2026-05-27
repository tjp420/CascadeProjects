/**
 * File Size Distribution Component
 * Visualizes file size distribution using histogram with Chart.js
 */

export class FileSizeDistribution {
    constructor() {
        this.distributionData = null;
        this.chart = null;
    }

    /**
     * Analyze directory and build file size distribution data
     */
    async analyzeFileSizeDistribution(projectData) {
        console.log('📦 Building file size distribution...');
        
        const fileTypes = projectData?.file_types || {};
        const totalFiles = projectData?.total_files || 0;
        
        // Simulate file size data by type (in real implementation, this would come from actual file sizes)
        const sizeDistribution = [];
        const typeSizes = {
            '.js': { files: 1000, avgSize: 15000, maxSize: 500000 },
            '.py': { files: 500, avgSize: 12000, maxSize: 300000 },
            '.html': { files: 200, avgSize: 8000, maxSize: 100000 },
            '.css': { files: 150, avgSize: 5000, maxSize: 50000 },
            '.json': { files: 100, avgSize: 2000, maxSize: 20000 },
            '.md': { files: 50, avgSize: 3000, maxSize: 15000 },
            '.txt': { files: 30, avgSize: 1000, maxSize: 5000 },
            '.png': { files: 200, avgSize: 50000, maxSize: 2000000 },
            '.jpg': { files: 150, avgSize: 80000, maxSize: 3000000 },
            '.svg': { files: 50, avgSize: 10000, maxSize: 50000 }
        };
        
        Object.entries(typeSizes).forEach(([ext, data]) => {
            const totalSize = data.files * data.avgSize;
            sizeDistribution.push({
                fileType: ext,
                fileCount: data.files,
                avgSize: data.avgSize,
                maxSize: data.maxSize,
                totalSize: totalSize,
                sizePercent: (totalSize / 10000000 * 100).toFixed(2) // Assuming 10MB total
            });
        });
        
        // Sort by total size
        sizeDistribution.sort((a, b) => b.totalSize - a.totalSize);
        
        // Create histogram bins
        const bins = [
            { label: '< 1KB', count: 0, totalSize: 0 },
            { label: '1-10KB', count: 0, totalSize: 0 },
            { label: '10-100KB', count: 0, totalSize: 0 },
            { label: '100KB-1MB', count: 0, totalSize: 0 },
            { label: '1-10MB', count: 0, totalSize: 0 },
            { label: '> 10MB', count: 0, totalSize: 0 }
        ];
        
        // Distribute files into bins (simulated)
        sizeDistribution.forEach(item => {
            if (item.avgSize < 1000) {
                bins[0].count += item.fileCount;
            } else if (item.avgSize < 10000) {
                bins[1].count += item.fileCount;
            } else if (item.avgSize < 100000) {
                bins[2].count += item.fileCount;
            } else if (item.avgSize < 1000000) {
                bins[3].count += item.fileCount;
            } else if (item.avgSize < 10000000) {
                bins[4].count += item.fileCount;
            } else {
                bins[5].count += item.fileCount;
            }
        });
        
        this.distributionData = {
            byType: sizeDistribution,
            histogram: bins,
            totalFiles: totalFiles,
            totalSize: sizeDistribution.reduce((sum, item) => sum + item.totalSize, 0)
        };
        
        console.log(`✅ File size distribution built: ${sizeDistribution.length} file types`);
        return this.distributionData;
    }

    /**
     * Render histogram using Chart.js
     */
    renderHistogram(containerId) {
        console.log('🎨 Rendering file size histogram...');
        
        const canvas = document.getElementById(containerId);
        if (!canvas) {
            console.error('❌ Canvas not found:', containerId);
            return;
        }
        
        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.distributionData.histogram.map(bin => bin.label),
                datasets: [{
                    label: 'Number of Files',
                    data: this.distributionData.histogram.map(bin => bin.count),
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(255, 159, 64, 0.7)',
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(153, 102, 255, 0.7)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'File Size Distribution',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.raw} files`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Files'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'File Size Range'
                        }
                    }
                }
            }
        });
        
        console.log('✅ File size histogram rendered');
        
        return this.chart;
    }

    /**
     * Render pie chart for file type distribution by size
     */
    renderPieChart(containerId) {
        console.log('🎨 Rendering file type pie chart...');
        
        const canvas = document.getElementById(containerId);
        if (!canvas) {
            console.error('❌ Canvas not found:', containerId);
            return;
        }
        
        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        
        const topTypes = this.distributionData.byType.slice(0, 8);
        const otherTypes = this.distributionData.byType.slice(8);
        
        if (otherTypes.length > 0) {
            topTypes.push({
                fileType: 'Other',
                totalSize: otherTypes.reduce((sum, item) => sum + item.totalSize, 0)
            });
        }
        
        this.chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: topTypes.map(item => item.fileType),
                datasets: [{
                    data: topTypes.map(item => item.totalSize),
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(255, 159, 64, 0.7)',
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 205, 86, 0.7)',
                        'rgba(201, 203, 207, 0.7)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 205, 86, 1)',
                        'rgba(201, 203, 207, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'File Size by Type',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${(value / 1024 / 1024).toFixed(2)} MB (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('✅ File type pie chart rendered');
        
        return this.chart;
    }

    /**
     * Identify large files (outliers)
     */
    identifyLargeFiles(threshold = 1000000) { // 1MB threshold
        const largeFiles = [];
        
        this.distributionData.byType.forEach(item => {
            if (item.maxSize > threshold) {
                largeFiles.push({
                    fileType: item.fileType,
                    maxSize: item.maxSize,
                    avgSize: item.avgSize,
                    fileCount: item.fileCount
                });
            }
        });
        
        return largeFiles.sort((a, b) => b.maxSize - a.maxSize);
    }

    /**
     * Export chart as image
     */
    exportAsImage(canvasId, filename = 'file-size-distribution.png') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('❌ Canvas not found');
            return;
        }
        
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        console.log('✅ Chart exported as image');
    }
}
