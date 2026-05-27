/**
 * Dependency Graph Visualization Component
 * Visualizes file dependencies using D3.js force-directed graph
 */

export class DependencyGraphVisualization {
    constructor() {
        this.graphData = null;
        this.svg = null;
        this.simulation = null;
    }

    /**
     * Analyze directory and build dependency graph
     */
    async analyzeDependencies(projectData) {
        console.log('🔗 Building dependency graph...');
        
        const files = projectData?.files || [];
        const fileTypes = projectData?.file_types || {};
        
        // Create nodes from files
        const nodes = [];
        const links = [];
        
        // Group files by directory
        const directoryGroups = {};
        Object.entries(fileTypes).forEach(([ext, count]) => {
            if (typeof count === 'number') {
                // For summary data, create representative nodes
                for (let i = 0; i < Math.min(count, 5); i++) {
                    const nodeId = `${ext.replace('.', '')}-${i}`;
                    nodes.push({
                        id: nodeId,
                        name: `${ext} file ${i + 1}`,
                        type: ext,
                        group: ext,
                        value: 10
                    });
                }
            }
        });
        
        // Create links based on common patterns
        const typeGroups = {};
        nodes.forEach(node => {
            if (!typeGroups[node.type]) {
                typeGroups[node.type] = [];
            }
            typeGroups[node.type].push(node.id);
        });
        
        // Link files of related types
        const relatedTypes = [
            ['.js', '.json', '.html', '.css'],
            ['.py', '.txt', '.md'],
            ['.html', '.css', '.js']
        ];
        
        relatedTypes.forEach(group => {
            for (let i = 0; i < group.length - 1; i++) {
                const type1 = group[i];
                const type2 = group[i + 1];
                
                if (typeGroups[type1] && typeGroups[type2]) {
                    typeGroups[type1].forEach(id1 => {
                        typeGroups[type2].forEach(id2 => {
                            if (Math.random() > 0.7) { // 30% chance to create link
                                links.push({
                                    source: id1,
                                    target: id2,
                                    value: 1
                                });
                            }
                        });
                    });
                }
            }
        });
        
        this.graphData = { nodes, links };
        
        console.log(`✅ Dependency graph built: ${nodes.length} nodes, ${links.length} links`);
        return this.graphData;
    }

    /**
     * Render dependency graph using D3.js
     */
    renderGraph(containerId, width = 800, height = 600) {
        console.log('🎨 Rendering dependency graph...');
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('❌ Container not found:', containerId);
            return;
        }
        
        // Clear previous graph
        container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        // Create SVG
        this.svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [0, 0, width, height])
            .style('font', '10px sans-serif');
        
        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.svg.select('g').attr('transform', event.transform);
            });
        
        this.svg.call(zoom);
        
        // Create group for zoom
        const g = this.svg.append('g');
        
        // Color scale
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        
        // Create simulation
        this.simulation = d3.forceSimulation(this.graphData.nodes)
            .force('link', d3.forceLink(this.graphData.links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(20));
        
        // Draw links
        const link = g.append('g')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .selectAll('line')
            .data(this.graphData.links)
            .join('line')
            .attr('stroke-width', d => Math.sqrt(d.value));
        
        // Draw nodes
        const node = g.append('g')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .selectAll('circle')
            .data(this.graphData.nodes)
            .join('circle')
            .attr('r', 10)
            .attr('fill', d => colorScale(d.group))
            .call(this.drag(this.simulation));
        
        // Add labels
        const labels = g.append('g')
            .selectAll('text')
            .data(this.graphData.nodes)
            .join('text')
            .text(d => d.name)
            .attr('x', 12)
            .attr('y', 3)
            .attr('font-size', '8px')
            .attr('fill', '#333')
            .style('pointer-events', 'none');
        
        // Add tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', 'rgba(0,0,0,0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px');
        
        node.on('mouseover', function(event, d) {
            tooltip.style('visibility', 'visible')
                .text(`${d.name} (${d.type})`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
            .on('mouseout', function() {
                tooltip.style('visibility', 'hidden');
            });
        
        // Update positions on simulation tick
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            
            labels
                .attr('x', d => d.x + 12)
                .attr('y', d => d.y + 3);
        });
        
        console.log('✅ Dependency graph rendered');
        
        return this.svg;
    }

    /**
     * Drag behavior for nodes
     */
    drag(simulation) {
        function dragstarted(event) {
            if (!event.active) {
                simulation.alphaTarget(0.3).restart();
            }
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        
        function dragended(event) {
            if (!event.active) {
                simulation.alphaTarget(0);
            }
            event.subject.fx = null;
            event.subject.fy = null;
        }
        
        return d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
    }

    /**
     * Highlight circular dependencies
     */
    highlightCircularDependencies() {
        console.log('🔄 Highlighting circular dependencies...');
        
        // Simple cycle detection using DFS
        const adj = {};
        this.graphData.links.forEach(link => {
            if (!adj[link.source.id]) {
                adj[link.source.id] = [];
            }
            if (!adj[link.target.id]) {
                adj[link.target.id] = [];
            }
            adj[link.source.id].push(link.target.id);
        });
        
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        
        function detectCycle(node, path = []) {
            visited.add(node);
            recursionStack.add(node);
            path.push(node);
            
            if (adj[node]) {
                for (const neighbor of adj[node]) {
                    if (!visited.has(neighbor)) {
                        if (detectCycle(neighbor, [...path])) {
                            return true;
                        }
                    } else if (recursionStack.has(neighbor)) {
                        cycles.push([...path, neighbor]);
                        return true;
                    }
                }
            }
            
            recursionStack.delete(node);
            path.pop();
            return false;
        }
        
        this.graphData.nodes.forEach(node => {
            if (!visited.has(node.id)) {
                detectCycle(node.id);
            }
        });
        
        console.log(`🔄 Found ${cycles.length} circular dependencies`);
        
        // Highlight cycles in the graph
        if (cycles.length > 0) {
            const cycleNodes = new Set();
            cycles.forEach(cycle => cycle.forEach(nodeId => cycleNodes.add(nodeId)));
            
            this.svg.selectAll('circle')
                .attr('stroke', d => cycleNodes.has(d.id) ? '#ff0000' : '#fff')
                .attr('stroke-width', d => cycleNodes.has(d.id) ? 3 : 1.5);
        }
        
        return cycles;
    }

    /**
     * Filter graph by file type
     */
    filterByType(fileType) {
        console.log(`🔍 Filtering by type: ${fileType}`);
        
        const filteredNodes = this.graphData.nodes.filter(n => n.type === fileType);
        const filteredLinks = this.graphData.links.filter(l => 
            l.source.type === fileType || l.target.type === fileType
        );
        
        return { nodes: filteredNodes, links: filteredLinks };
    }

    /**
     * Export graph as image
     */
    exportAsImage(containerId, filename = 'dependency-graph.png') {
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
