/**
 * Code Map Visualizer
 * D3.js-based visualization for code structure and dependencies
 */

// Check if D3.js is loaded
if (typeof d3 === 'undefined') {
    console.error('D3.js is not loaded. Please ensure D3.js is included before this script.');
    throw new Error('D3.js is required but not loaded');
}

class CodeMapVisualizer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container ${containerId} not found`);
            return;
        }

        this.options = {
            width: options.width || 1200,
            height: options.height || 800,
            nodeRadius: options.nodeRadius || 8,
            linkDistance: options.linkDistance || 100,
            chargeStrength: options.chargeStrength || -300,
            apiBaseUrl: options.apiBaseUrl || '',
            ...options
        };

        this.svg = null;
        this.simulation = null;
        this.data = { nodes: [], edges: [] };
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    }

    async loadCodeMap(directory = 'web', language = 'all') {
        try {
            const baseUrl = this.options.apiBaseUrl || '';
            const response = await fetch(`${baseUrl}/api/code-map/?directory=${directory}&language=${language}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.data = await response.json();
            console.log('Code map loaded:', this.data);
            this.render();
            return this.data;
        } catch (error) {
            console.error('Error loading code map:', error);
            throw error;
        }
    }

    render() {
        if (!this.container) {
            return;
        }

        // Clear existing content
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */

        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.options.width)
            .attr('height', this.options.height)
            .call(d3.zoom()
                .scaleExtent([0.1, 4])
                .on('zoom', (event) => {
                    this.g.attr('transform', event.transform);
                }))
            .append('g');

        this.g = this.svg.append('g');

        // Add arrow markers for directed edges
        this.svg.append('defs').selectAll('marker')
            .data(['import', 'contains'])
            .enter()
            .append('marker')
            .attr('id', d => `arrow-${d}`)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 15)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', d => d === 'import' ? '#999' : '#666');

        // Create simulation
        this.simulation = d3.forceSimulation(this.data.nodes)
            .force('link', d3.forceLink(this.data.edges)
                .id(d => d.id)
                .distance(this.options.linkDistance))
            .force('charge', d3.forceManyBody().strength(this.options.chargeStrength))
            .force('center', d3.forceCenter(
                this.options.width / 2,
                this.options.height / 2
            ))
            .force('collide', d3.forceCollide().radius(20));

        // Create links
        const links = this.g.append('g')
            .selectAll('line')
            .data(this.data.edges)
            .enter()
            .append('line')
            .attr('stroke', d => d.type === 'import' ? '#999' : '#666')
            .attr('stroke-width', d => d.type === 'import' ? 1.5 : 1)
            .attr('marker-end', d => `url(#arrow-${d.type})`)
            .attr('opacity', 0.6);

        // Create nodes
        const nodes = this.g.append('g')
            .selectAll('circle')
            .data(this.data.nodes)
            .enter()
            .append('circle')
            .attr('r', d => d.type === 'directory' ? this.options.nodeRadius * 1.5 : this.options.nodeRadius)
            .attr('fill', d => this.getNodeColor(d))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', this.dragstarted.bind(this))
                .on('drag', this.dragged.bind(this))
                .on('end', this.dragended.bind(this)));

        // Add labels
        const labels = this.g.append('g')
            .selectAll('text')
            .data(this.data.nodes)
            .enter()
            .append('text')
            .text(d => d.name)
            .attr('font-size', '10px')
            .attr('font-family', 'sans-serif')
            .attr('fill', '#333')
            .attr('dx', d => d.type === 'directory' ? 12 : 10)
            .attr('dy', 4)
            .style('pointer-events', 'none')
            .style('text-shadow', '0 1px 0 #fff, 0 -1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff');

        // Add tooltips
        nodes.append('title')
            .text(d => this.getNodeTooltip(d));

        // Update positions on simulation tick
        this.simulation.on('tick', () => {
            links
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            nodes
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            labels
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        // Add legend
        this.addLegend();
    }

    getNodeColor(node) {
        if (node.type === 'directory') {
            return '#4a90e2';
        }
        if (node.language === 'python') {
            return '#3572A5';
        }
        if (node.language === 'javascript') {
            return '#f1e05a';
        }
        if (node.language === 'typescript') {
            return '#2b7489';
        }
        return '#999';
    }

    getNodeTooltip(node) {
        let tooltip = `${node.type}: ${node.name}\n`;
        tooltip += `Path: ${node.path}\n`;
        if (node.language) {
            tooltip += `Language: ${node.language}\n`;
        }
        if (node.dependencies && node.dependencies.length > 0) {
            tooltip += `Dependencies: ${node.dependencies.length}\n`;
        }
        return tooltip;
    }

    addLegend() {
        const legendData = [
            { type: 'directory', color: '#4a90e2', label: 'Directory' },
            { type: 'python', color: '#3572A5', label: 'Python' },
            { type: 'javascript', color: '#f1e05a', label: 'JavaScript' },
            { type: 'typescript', color: '#2b7489', label: 'TypeScript' },
            { type: 'import', color: '#999', label: 'Import dependency' },
            { type: 'contains', color: '#666', label: 'Contains' }
        ];

        const legend = this.svg.append('g')
            .attr('class', 'legend')
            .attr('transform', 'translate(10, 10)');

        legendData.forEach((item, i) => {
            const row = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);

            if (item.type === 'import' || item.type === 'contains') {
                row.append('line')
                    .attr('x1', 0)
                    .attr('y1', 0)
                    .attr('x2', 20)
                    .attr('y2', 0)
                    .attr('stroke', item.color)
                    .attr('stroke-width', 2);
            } else {
                row.append('circle')
                    .attr('cx', 10)
                    .attr('cy', 0)
                    .attr('r', 6)
                    .attr('fill', item.color);
            }

            row.append('text')
                .attr('x', 30)
                .attr('y', 4)
                .text(item.label)
                .attr('font-size', '12px')
                .attr('font-family', 'sans-serif');
        });
    }

    dragstarted(event, d) {
        if (!event.active) {
            this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragended(event, d) {
        if (!event.active) {
            this.simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
    }

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        if (this.simulation) {
            this.simulation
                .force('link').distance(this.options.linkDistance)
                .force('charge').strength(this.options.chargeStrength);
            this.simulation.alpha(1).restart();
        }
    }

    exportAsPNG() {
        const svgData = new XMLSerializer().serializeToString(this.svg.node());
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        canvas.width = this.options.width;
        canvas.height = this.options.height;

        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = 'code-map.png';
            downloadLink.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }

    getStatistics() {
        return this.data.statistics || {};
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeMapVisualizer;
}
