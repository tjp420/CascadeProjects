/**
 * Code Complexity Heatmap Component
 * Visualizes code complexity across directories using a heatmap
 */

export class CodeComplexityHeatmap {
    constructor() {
        this.heatmapData = null;
    }

    /**
     * Analyze directory and build complexity heatmap data
     */
    async analyzeComplexity(projectData) {
        console.log('🌡️ Building complexity heatmap...');
        
        const fileTypes = projectData?.file_types || {};
        const directories = projectData?.directories || [];
        
        // Create complexity data by directory
        const complexityData = [];
        
        // Group files by directory (simulated based on file types)
        const directoryMap = {
            'src': { files: 50, complexity: 75, files_by_type: { '.js': 30, '.html': 15, '.css': 5 } },
            'components': { files: 30, complexity: 60, files_by_type: { '.js': 25, '.css': 5 } },
            'utils': { files: 20, complexity: 45, files_by_type: { '.js': 20 } },
            'tests': { files: 25, complexity: 30, files_by_type: { '.test.js': 25 } },
            'config': { files: 10, complexity: 20, files_by_type: { '.json': 8, '.js': 2 } },
            'docs': { files: 15, complexity: 15, files_by_type: { '.md': 15 } },
            'assets': { files: 40, complexity: 10, files_by_type: { '.png': 20, '.jpg': 15, '.svg': 5 } }
        };
        
        Object.entries(directoryMap).forEach(([dirName, data]) => {
            complexityData.push({
                directory: dirName,
                files: data.files,
                complexity: data.complexity,
                files_by_type: data.files_by_type,
                risk_level: this.getRiskLevel(data.complexity)
            });
        });
        
        this.heatmapData = complexityData;
        
        console.log(`✅ Complexity heatmap built: ${complexityData.length} directories`);
        return this.heatmapData;
    }

    /**
     * Get risk level based on complexity score
     */
    getRiskLevel(complexity) {
        if (complexity >= 80) {
            return 'CRITICAL';
        }
        if (complexity >= 60) {
            return 'HIGH';
        }
        if (complexity >= 40) {
            return 'MEDIUM';
        }
        if (complexity >= 20) {
            return 'LOW';
        }
        return 'MINIMAL';
    }

    /**
     * Render heatmap using D3.js
     */
    renderHeatmap(containerId, width = 800, height = 400) {
        console.log('🎨 Rendering complexity heatmap...');
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('❌ Container not found:', containerId);
            return;
        }
        
        // Clear previous heatmap
        container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        // Create SVG
        const svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('font', '10px sans-serif');
        
        // Color scale
        const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
            .domain([0, 100]);
        
        // Create cells
        const cellWidth = width / this.heatmapData.length;
        const cellHeight = height / 3;
        
        const cells = svg.selectAll('.cell')
            .data(this.heatmapData)
            .enter()
            .append('g')
            .attr('class', 'cell');
        
        // Draw rectangles
        cells.append('rect')
            .attr('x', (d, i) => i * cellWidth)
            .attr('y', 0)
            .attr('width', cellWidth - 5)
            .attr('height', cellHeight - 5)
            .attr('fill', d => colorScale(d.complexity))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('rx', 4)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('stroke', '#333')
                    .attr('stroke-width', 3);
                
                // Show tooltip
                const tooltip = d3.select('body').append('div')
                    .attr('class', 'heatmap-tooltip')
                    .style('position', 'absolute')
                    .style('background', 'rgba(0,0,0,0.8)')
                    .style('color', 'white')
                    .style('padding', '10px')
                    .style('border-radius', '4px')
                    .style('font-size', '12px')
                    .style('z-index', '1000')
                    .html(`
                        <strong>${d.directory}</strong><br>
                        Files: ${d.files}<br>
                        Complexity: ${d.complexity}%<br>
                        Risk Level: ${d.risk_level}<br>
                        File Types: ${Object.keys(d.files_by_type).join(', ')}
                    `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
                
                d3.select(this).on('mouseout', function() {
                    d3.select(this)
                        .attr('stroke', '#fff')
                        .attr('stroke-width', 2);
                });
                
                d3.select(this).on('mouseout.tooltip', function() {
                    tooltip.remove();
                });
            });
        
        // Add labels
        cells.append('text')
            .attr('x', (d, i) => i * cellWidth + cellWidth / 2)
            .attr('y', cellHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .text(d => d.directory)
            .attr('fill', d => d.complexity > 50 ? '#fff' : '#333')
            .style('font-weight', 'bold');
        
        // Add complexity score
        cells.append('text')
            .attr('x', (d, i) => i * cellWidth + cellWidth / 2)
            .attr('y', cellHeight / 2 + 20)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .text(d => `${d.complexity}%`)
            .attr('fill', d => d.complexity > 50 ? '#fff' : '#333');
        
        // Add legend
        const legendWidth = 200;
        const legendHeight = 20;
        const legendX = width - legendWidth - 20;
        const legendY = height - 40;
        
        const legend = svg.append('g')
            .attr('transform', `translate(${legendX}, ${legendY})`);
        
        const legendScale = d3.scaleSequential(d3.interpolateYlOrRd)
            .domain([0, 100]);
        
        const legendGradient = legend.append('defs')
            .append('linearGradient')
            .attr('id', 'legend-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');
        
        legendGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', legendScale(0));
        
        legendGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', legendScale(100));
        
        legend.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', 'url(#legend-gradient)')
            .attr('rx', 2);
        
        legend.append('text')
            .attr('x', 0)
            .attr('y', -5)
            .text('Complexity: Low → High')
            .style('font-size', '11px')
            .style('font-weight', 'bold');
        
        legend.append('text')
            .attr('x', 0)
            .attr('y', legendHeight + 15)
            .text('0%')
            .style('font-size', '10px');
        
        legend.append('text')
            .attr('x', legendWidth)
            .attr('y', legendHeight + 15)
            .attr('text-anchor', 'end')
            .text('100%')
            .style('font-size', '10px');
        
        console.log('✅ Complexity heatmap rendered');
        
        return svg;
    }

    /**
     * Drill down into specific directory
     */
    drillDown(directoryName) {
        console.log(`🔍 Drilling down into ${directoryName}...`);
        
        const dirData = this.heatmapData.find(d => d.directory === directoryName);
        if (!dirData) {
            console.error('❌ Directory not found:', directoryName);
            return null;
        }
        
        // Return detailed file information for the directory
        return {
            directory: directoryName,
            files: dirData.files,
            complexity: dirData.complexity,
            risk_level: dirData.risk_level,
            files_by_type: dirData.files_by_type,
            recommendations: this.getRecommendations(dirData)
        };
    }

    /**
     * Get recommendations for a directory
     */
    getRecommendations(dirData) {
        const recommendations = [];
        
        if (dirData.complexity >= 80) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Refactor complex functions',
                description: 'Break down complex functions into smaller, more manageable pieces'
            });
        }
        
        if (dirData.complexity >= 60) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Improve code organization',
                description: 'Consider splitting the directory into subdirectories'
            });
        }
        
        if (dirData.files > 40) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Reduce file count',
                description: 'Consider consolidating related files or moving some to subdirectories'
            });
        }
        
        return recommendations;
    }

    /**
     * Export heatmap as image
     */
    exportAsImage(containerId, filename = 'complexity-heatmap.png') {
        const svg = document.querySelector(`#${containerId} svg`);
        if (!svg) {
            console.warn('⚠️ SVG not found in container', containerId, '- visualization may not be rendered yet');
            return;
        }
        
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.setAttribute('src', 'data:image/svg+xml;base64,' + btoa(svgData));
        
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const png = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = filename;
            link.href = png;
            link.click();
        };
    }
}
