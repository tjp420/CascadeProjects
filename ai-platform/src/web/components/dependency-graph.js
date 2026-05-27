/**
 * Dependency Graph Visualization
 * Interactive network diagram showing project dependencies and relationships
 */

class DependencyGraph {
    constructor(containerId, data) {
        this.container = document.getElementById(containerId);
        this.data = data;
        this.nodes = [];
        this.edges = [];
        this.selectedNodes = new Set();
        this.layoutType = 'force';
        
        this.init();
    }

    init() {
        this.createGraphContainer();
        this.processData();
        this.renderGraph();
        this.attachEventListeners();
    }

    createGraphContainer() {
        this.container.textContent = `
            <div class="dependency-graph-container">
                <div class="graph-controls">
                    <div class="layout-controls">
                        <label>Layout:</label>
                        <select id="layout-type" class="layout-select">
                            <option value="force">Force Layout</option>
                            <option value="hierarchical">Hierarchical</option>
                            <option value="circular">Circular</option>
                            <option value="grid">Grid</option>
                        </select>
                    </div>
                    <div class="filter-controls">
                        <label>Filter:</label>
                        <select id="dependency-filter" class="filter-select">
                            <option value="all">All Dependencies</option>
                            <option value="high">High Impact</option>
                            <option value="medium">Medium Impact</option>
                            <option value="low">Low Impact</option>
                            <option value="circular">Circular Dependencies</option>
                        </select>
                    </div>
                    <div class="action-controls">
                        <button id="reset-zoom" class="btn-secondary btn-sm">Reset Zoom</button>
                        <button id="export-graph" class="btn-primary btn-sm">Export Image</button>
                    </div>
                </div>
                <div class="graph-stats">
                    <div class="stat-item">
                        <span class="stat-value" id="total-nodes">0</span>
                        <span class="stat-label">Modules</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" id="total-edges">0</span>
                        <span class="stat-label">Dependencies</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" id="circular-deps">0</span>
                        <span class="stat-label">Circular</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" id="max-depth">0</span>
                        <span class="stat-label">Max Depth</span>
                    </div>
                </div>
                <div class="graph-canvas-container">
                    <svg id="dependency-graph" width="800" height="600"></svg>
                </div>
                <div class="graph-legend">
                    <div class="legend-item">
                        <div class="legend-color high"></div>
                        <span>High Impact</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color medium"></div>
                        <span>Medium Impact</span>
                    </div>
                    <div class="legend-item">
                        <legend-color low"></div>
                        <span>Low Impact</span>
                    </div>
                    <div class="legend-item">
                        <legend-color circular"></div>
                        <span>Circular</span>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        this.addStyles();
    }

    processData() {
        if (!this.data || !this.data.dependencies) {
            this.nodes = [];
            this.edges = [];
            return;
        }

        // Create nodes from modules
        const modules = this.data.modules || ['main', 'utils', 'api', 'ui', 'config'];
        this.nodes = modules.map((module, index) => ({
            id: module,
            label: module,
            group: this.getNodeGroup(module),
            impact: this.calculateImpact(module),
            size: this.getNodeSize(module),
            x: 0,
            y: 0
        }));

        // Create edges from dependencies
        const dependencies = this.data.dependencies || [];
        this.edges = dependencies.map((dep, index) => {
            const sourceId = dep.from || modules[0];
            const targetId = dep.to || modules[1];
            
            return {
                id: `edge-${index}`,
                source: sourceId,
                target: targetId,
                impact: dep.impact || 'medium',
                type: dep.type || 'normal',
                circular: dep.circular || false
            };
        });

        // Calculate graph metrics
        this.calculateGraphMetrics();
    }

    getNodeGroup(module) {
        // Group modules by category
        const groups = {
            'core': ['main', 'index', 'app'],
            'utils': ['utils', 'helpers', 'common'],
            'api': ['api', 'server', 'routes'],
            'ui': ['ui', 'components', 'views'],
            'config': ['config', 'settings', 'constants']
        };
        
        for (const [group, modules] of Object.entries(groups)) {
            if (modules.includes(module)) {
                return group;
            }
        }
        
        return 'other';
    }

    calculateImpact(module) {
        // Calculate impact based on module characteristics
        const highImpactModules = ['main', 'app', 'server', 'api'];
        const mediumImpactModules = ['utils', 'ui', 'components'];
        const lowImpactModules = ['config', 'constants', 'helpers'];
        
        if (highImpactModules.includes(module)) {
            return 'high';
        }
        if (mediumImpactModules.includes(module)) {
            return 'medium';
        }
        if (lowImpactModules.includes(module)) {
            return 'low';
        }
        return 'medium';
    }

    getNodeSize(module) {
        // Calculate node size based on module importance
        const impact = this.calculateImpact(module);
        const sizeMap = { high: 30, medium: 20, low: 10 };
        return sizeMap[impact] || 15;
    }

    calculateGraphMetrics() {
        const circularDeps = this.edges.filter(edge => edge.circular).length;
        const maxDepth = this.calculateMaxDepth();
        
        document.getElementById('total-nodes').textContent = this.nodes.length;
        document.getElementById('total-edges').textContent = this.edges.length;
        document.getElementById('circular-deps').textContent = circularDeps;
        document.getElementById('max-depth').textContent = maxDepth;
    }

    calculateMaxDepth() {
        const visited = new Set();
        const depths = new Map();
        
        const calculateDepth = (nodeId, currentDepth = 0) => {
            if (visited.has(nodeId)) {
                return currentDepth;
            }
            visited.add(nodeId);
            
            let maxChildDepth = currentDepth;
            
            const outgoingEdges = this.edges.filter(edge => edge.source === nodeId);
            for (const edge of outgoingEdges) {
                const childDepth = calculateDepth(edge.target, currentDepth + 1);
                maxChildDepth = Math.max(maxChildDepth, childDepth);
            }
            
            return maxChildDepth;
        };
        
        let maxDepth = 0;
        for (const node of this.nodes) {
            visited.clear();
            const depth = calculateDepth(node.id);
            maxDepth = Math.max(maxDepth, depth);
        }
        
        return maxDepth;
    }

    renderGraph() {
        const svg = document.getElementById('dependency-graph');
        if (!svg) {
            return;
        }

        // Clear previous graph
        svg.textContent = '' /* Replaced innerHTML with textContent for safety */

        // Create SVG elements
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const edgesGroup = document.createElementNS('http://www.org/2000/svg', 'g');
        const nodesGroup = document.createElementNS('http://www.org/2000/svg', 'g');

        svg.appendChild(defs);
        svg.appendChild(edgesGroup);
        svg.appendChild(nodesGroup);

        // Add arrow marker definition
        const marker = document.createElementNS('http://www.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        
        const arrow = document.createElementNS('http://www.org/2000/svg', 'polygon');
        arrow.setAttribute('points', '0 0, 10 3.5, 0 7');
        arrow.setAttribute('fill', '#666');
        
        marker.appendChild(arrow);
        defs.appendChild(marker);

        // Apply layout and render
        this.applyLayout();
        this.renderEdges(edgesGroup);
        this.renderNodes(nodesGroup);
        this.attachGraphEventListeners();
    }

    applyLayout() {
        const svg = document.getElementById('dependency-graph');
        const width = svg.getAttribute('width');
        const height = svg.getAttribute('height');

        switch (this.layoutType) {
        case 'force':
            this.applyForceLayout(width, height);
            break;
        case 'hierarchical':
            this.applyHierarchicalLayout(width, height);
            break;
        case 'circular':
            this.applyCircularLayout(width, height);
            break;
        case 'grid':
            this.applyGridLayout(width, height);
            break;
        default:
            this.applyForceLayout(width, height);
        }
    }

    applyForceLayout(width, height) {
        // Simple force-directed graph layout
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Initialize positions
        this.nodes.forEach(node => {
            node.x = centerX + (Math.random() - 0.5) * 200;
            node.y = centerY + (Math.random() - 0.5) * 200;
        });

        // Apply forces
        const iterations = 100;
        const k = 0.1; // Spring constant
        const damping = 0.9; // Damping factor

        for (let i = 0; i < iterations; i++) {
            // Apply repulsion between nodes
            for (let j = 0; j < this.nodes.length; j++) {
                for (let k = j + 1; k < this.nodes.length; k++) {
                    const node1 = this.nodes[j];
                    const node2 = this.nodes[k];
                    
                    const dx = node2.x - node1.x;
                    const dy = node2.y - node1.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 0) {
                        const force = k / (distance * distance);
                        const fx = force * dx;
                        fy = force * dy;
                        
                        node1.x -= fx;
                        node1.y -= fy;
                        node2.x += fx;
                        node2.y += fy;
                    }
                }
            }

            // Apply attraction along edges
            for (const edge of this.edges) {
                const sourceNode = this.nodes.find(n => n.id === edge.source);
                const targetNode = this.nodes.find(n => n.id === edge.target);
                
                if (sourceNode && targetNode) {
                    const dx = targetNode.x - sourceNode.x;
                    const dy = targetNode.y - sourceNode.y;
                    
                    sourceNode.x += dx * k;
                    sourceNode.y += dy * k;
                    targetNode.x -= dx * k;
                    targetNode.y -= dy * k;
                }
            }

            // Apply damping
            this.nodes.forEach(node => {
                node.x = centerX + (node.x - centerX) * damping;
                node.y = centerY + (node.y - centerY) * damping;
            });
        }
    }

    applyHierarchicalLayout(width, height) {
        // Simple hierarchical layout
        const levels = this.calculateHierarchyLevels();
        const levelHeight = height / (levels.length || 1);
        
        levels.forEach((nodes, level) => {
            const y = levelHeight * (level + 1);
            const width = width / (nodes.length + 1);
            
            nodes.forEach((node, index) => {
                node.x = width * (index + 1) / (nodes.length + 1);
                node.y = y;
            });
        });
    }

    calculateHierarchyLevels() {
        const levels = [];
        const visited = new Set();
        
        const getLevel = (nodeId, currentLevel = 0) => {
            if (visited.has(nodeId)) {
                return currentLevel;
            }
            visited.add(nodeId);
            
            let maxChildLevel = currentLevel;
            
            const outgoingEdges = this.edges.filter(edge => edge.source === nodeId);
            for (const edge of outgoingEdges) {
                const childLevel = getLevel(edge.target, currentLevel + 1);
                maxChildLevel = Math.max(maxChildLevel, childLevel);
            }
            
            return maxChildLevel;
        };

        // Assign nodes to levels
        this.nodes.forEach(node => {
            const level = getLevel(node.id);
            if (!levels[level]) {
                levels[level] = [];
            }
            levels[level].push(node);
        });

        return levels;
    }

    applyCircularLayout(width, height) {
        // Circular layout
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 3;
        
        this.nodes.forEach((node, index) => {
            const angle = (2 * Math.PI * index) / this.nodes.length;
            node.x = centerX + radius * Math.cos(angle);
            node.y = centerY + radius * Math.sin(angle);
        });
    }

    applyGridLayout(width, height) {
        // Grid layout
        const cols = Math.ceil(Math.sqrt(this.nodes.length));
        const rows = Math.ceil(this.nodes.length / cols);
        
        const cellWidth = width / cols;
        const cellHeight = height / rows;
        
        this.nodes.forEach((node, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            node.x = cellWidth * (col + 0.5);
            node.y = cellHeight * (row + 0.5);
        });
    }

    renderEdges(edgesGroup) {
        this.edges.forEach(edge => {
            const sourceNode = this.nodes.find(n => n.id === edge.source);
            const targetNode = this.nodes.find(n => n.id === edge.target);
            
            if (sourceNode && targetNode) {
                const line = document.createElementNS('http://www.org/2000/svg', 'line');
                
                line.setAttribute('x1', sourceNode.x);
                line.setAttribute('y1', sourceNode.y);
                line.setAttribute('x2', targetNode.x);
                line.setAttribute('y2', targetNode.y);
                line.setAttribute('stroke', this.getEdgeColor(edge));
                line.setAttribute('stroke-width', this.getEdgeWidth(edge));
                line.setAttribute('marker-end', 'url(#arrowhead)');
                line.setAttribute('data-source', edge.source);
                line.setAttribute('data-target', edge.target);
                line.setAttribute('data-type', edge.type);
                line.setAttribute('data-circular', edge.circular);
                
                edgesGroup.appendChild(line);
            }
        });
    }

    renderNodes(nodesGroup) {
        this.nodes.forEach(node => {
            const g = document.createElementNS('http://www.org/2000/svg', 'g');
            g.setAttribute('data-node-id', node.id);
            g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
            
            // Create circle for node
            const circle = document.createElementNS('http://www.org/2000/svg', 'circle');
            circle.setAttribute('r', node.size);
            circle.setAttribute('fill', this.getNodeColor(node));
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '2');
            circle.setAttribute('data-node-id', node.id);
            circle.setAttribute('data-impact', node.impact);
            
            // Create text label
            const text = document.createElementNS('http://www.org/2000/svg', 'text');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dy', '0.3em');
            text.setAttribute('font-size', '12px');
            text.setAttribute('fill', '#333');
            text.textContent = node.label;
            
            g.appendChild(circle);
            g.appendChild(text);
            nodesGroup.appendChild(g);
        });
    }

    getEdgeColor(edge) {
        const colors = {
            high: '#e74c3c',
            medium: '#f39c12',
            low: '#27ae60',
            normal: '#3498db',
            circular: '#9b59b6'
        };
        
        return colors[edge.impact] || colors[edge.type] || colors.normal;
    }

    getEdgeWidth(edge) {
        const widths = {
            high: 3,
            medium: 2,
            low: 1,
            normal: 1,
            circular: 2
        };
        
        return widths[edge.impact] || widths[edge.type] || widths.normal;
    }

    getNodeColor(node) {
        const colors = {
            high: '#e74c3c',
            medium: '#f39c12',
            low: '#27ae60'
        };
        
        return colors[node.impact] || '#3498db';
    }

    attachEventListeners() {
        const svg = document.getElementById('dependency-graph');
        
        // Layout type change
        const layoutSelect = document.getElementById('layout-type');
        if (layoutSelect) {
            layoutSelect.addEventListener('change', (e) => {
                this.layoutType = e.target.value;
                this.renderGraph();
            });
        }

        // Filter change
        const filterSelect = document.getElementById('dependency-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterDependencies(e.target.value);
            });
        }

        // Zoom controls
        const resetZoom = document.getElementById('reset-zoom');
        if (resetZoom) {
            resetZoom.addEventListener('click', () => {
                this.resetZoom();
            });
        }

        // Export functionality
        const exportBtn = document.getElementById('export-graph');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportGraph();
            });
        }

        // Node interactions
        svg.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.tagName === 'circle') {
                const nodeId = target.getAttribute('data-node-id');
                this.selectNode(nodeId);
            }
            
            if (target.tagName === 'line') {
                const sourceId = target.getAttribute('data-source');
                const targetId = target.getAttribute('data-target');
                this.selectEdge(sourceId, targetId);
            }
        });
    }

    attachGraphEventListeners() {
        // Re-attach event listeners after re-render
        const svg = document.getElementById('dependency-graph');
        
        svg.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.tagName === 'circle') {
                const nodeId = target.getAttribute('data-node-id');
                this.selectNode(nodeId);
            }
            
            if (target.tagName === 'line') {
                const sourceId = target.getAttribute('data-source');
                const targetId = target.getAttribute('data-target');
                this.selectEdge(sourceId, targetId);
            }
        });
    }

    selectNode(nodeId) {
        // Toggle node selection
        if (this.selectedNodes.has(nodeId)) {
            this.selectedNodes.delete(nodeId);
        } else {
            this.selectedNodes.add(nodeId);
        }
        
        this.updateNodeStyles();
        this.showNodeDetails(nodeId);
    }

    selectEdge(sourceId, targetId) {
        // Highlight edge
        const edges = document.querySelectorAll('line[data-source="' + sourceId + '"][data-target="' + targetId + '"]');
        
        edges.forEach(edge => {
            edge.setAttribute('stroke-width', '3');
            edge.setAttribute('stroke', '#007bff');
        });
        
        setTimeout(() => {
            edges.forEach(edge => {
                edge.setAttribute('stroke-width', this.getEdgeWidth(
                    this.edges.find(e => e.source === sourceId && e.target === targetId)
                ));
                edge.setAttribute('stroke', this.getEdgeColor(
                    this.edges.find(e => e.source === sourceId && e.target === targetId)
                ));
            });
        }, 1000);
        
        this.showEdgeDetails(sourceId, targetId);
    }

    updateNodeStyles() {
        this.nodes.forEach(node => {
            const circle = document.querySelector(`circle[data-node-id="${node.id}"]`);
            if (circle) {
                if (this.selectedNodes.has(node.id)) {
                    circle.setAttribute('stroke', '#007bff');
                    circle.setAttribute('stroke-width', '3');
                } else {
                    circle.setAttribute('stroke', '#fff');
                    circle.setAttribute('stroke-width', '2');
                }
            }
        });
    }

    showNodeDetails(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) {
            return;
        }

        // Create or update details panel
        let detailsPanel = document.getElementById('dependency-details-panel');
        
        if (!detailsPanel) {
            detailsPanel = document.createElement('div');
            detailsPanel.id = 'dependency-details-panel';
            detailsPanel.className = 'dependency-details-panel';
            this.container.appendChild(detailsPanel);
        }

        const incomingEdges = this.edges.filter(e => e.target === nodeId);
        const outgoingEdges = this.edges.filter(e => e.source === nodeId);
        const allEdges = [...incomingEdges, ...outgoingEdges];

        detailsPanel.textContent = `
            <div class="details-header">
                <h3>Dependency Details</h3>
                <button class="close-details" onclick="this.parentElement.remove()">×</button>
            </div>
            <div class="details-content">
                <div class="detail-row">
                    <strong>Module:</strong> ${node.label}
                </div>
                <div class="detail-row">
                    <strong>Group:</strong> ${node.group}
                </div>
                <div class="detail-row">
                    <strong>Impact:</strong> ${node.impact}
                </div>
                <div class="detail-row">
                    <strong>Dependencies:</strong> ${outgoingEdges.length} outgoing, ${incomingEdges.length} incoming
                </div>
                <div class="detail-row">
                    <strong>Total Connections:</strong> ${allEdges.length}
                </div>
                <div class="detail-row">
                    <strong>Circular:</strong> ${allEdges.some(e => e.circular) ? 'Yes' : 'No'}
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    showEdgeDetails(sourceId, targetId) {
        const edge = this.edges.find(e => e.source === sourceId && e.target === targetId);
        if (!edge) {
            return;
        }

        const sourceNode = this.nodes.find(n => n.id === sourceId);
        const targetNode = this.nodes.find(n => n.id === targetId);
        
        // Create or update details panel
        let detailsPanel = document.getElementById('dependency-details-panel');
        
        if (!detailsPanel) {
            detailsPanel = document.createElement('div');
            detailsPanel.id = 'dependency-details-panel';
            detailsPanel.className = 'dependency-details-panel';
            this.container.appendChild(detailsPanel);
        }

        detailsPanel.textContent = `
            <div class="details-header">
                <h3>Dependency Details</h3>
                <button class="close-details" onclick="this.parentElement.remove()">×</button>
            </div>
            <div class="details-content">
                <div class="detail-row">
                    <strong>From:</strong> ${sourceNode.label}
                </div>
                <div class="detail-row">
                    <strong>To:</strong> ${targetNode.label}
                </div>
                <div class="detail-row">
                    <strong>Type:</strong> ${edge.type}
                </div>
                <div class="detail-row">
                    <strong>Impact:</strong> ${edge.impact}
                </div>
                <div class="detail-row">
                    <strong>Circular:</strong> ${edge.circular ? 'Yes' : 'No'}
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    filterDependencies(filterType) {
        let filteredEdges = [...this.edges];
        
        switch (filterType) {
        case 'high':
            filteredEdges = filteredEdges.filter(e => e.impact === 'high');
            break;
        case 'medium':
            filteredEdges = filteredEdges.filter(e => e.impact === 'medium');
            break;
        case 'low':
            filteredEdges = filteredEdges.filter(e => e.impact === 'low');
            break;
        case 'circular':
            filteredEdges = filteredEdges.filter(e => e.circular);
            break;
        }
        
        this.edges = filteredEdges;
        this.renderGraph();
        this.calculateGraphMetrics();
    }

    resetZoom() {
        const svg = document.getElementById('dependency-graph');
        const width = svg.getAttribute('width');
        const height = svg.getAttribute('height');
        
        // Reset viewbox
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        
        // Reapply layout
        this.applyLayout();
        this.renderGraph();
    }

    exportGraph() {
        const svg = document.getElementById('dependency-graph');
        
        // Create download link
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `dependency-graph-${new Date().toISOString().split('T')[0]}.svg`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        // Show success message
        this.showMessage('Dependency graph exported successfully!', 'success');
    }

    showMessage(message, type = 'info') {
        // Create notification
        const notification = document.createElement('div');
        notification.className = `graph-notification ${type}`;
        notification.textContent = message;
        
        this.container.appendChild(notification);
        
        // Auto-remove after delay
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .dependency-graph-container {
                background: white;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
                overflow: hidden;
            }
            
            .graph-controls {
                padding: 15px;
                border-bottom: 1px solid #e5e7eb;
                background: #f8f9fa;
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
                align-items: center;
            }
            
            .layout-controls,
            .filter-controls,
            .action-controls {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            
            .layout-select,
            .filter-select {
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .btn-sm {
                padding: 6px 12px;
                font-size: 12px;
            }
            
            .graph-stats {
                display: flex;
                gap: 20px;
                font-size: 12px;
                color: #666;
                padding: 10px 15px;
                background: #f8f9fa;
                border-radius: 4px;
            }
            
            .stat-item {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .stat-value {
                font-weight: bold;
                color: #2c3e50;
            }
            
            .stat-label {
                color: #666;
            }
            
            .graph-canvas-container {
                position: relative;
                background: #fafafa;
                border: 1px solid #e5e7eb;
                margin: 15px;
                border-radius: 4px;
                overflow: hidden;
            }
            
            #dependency-graph {
                width: 100%;
                height: 600px;
                background: white;
            }
            
            .graph-legend {
                display: flex;
                gap: 15px;
                padding: 15px;
                font-size: 12px;
                color: #666;
                background: #f8f9fa;
                border-top: 1px solid #e5e7eb;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
            }
            
            .legend-color.high {
                background: #e74c3c;
            }
            
            .legend-color.medium {
                background: #f39c12;
            }
            
            .legend-color.low {
                background: #27ae60;
            }
            
            .legend-color.circular {
                background: #9b59b6;
            }
            
            .dependency-details-panel {
                position: fixed;
                top: 50%;
                right: 20px;
                transform: translateY(-50%);
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                min-width: 300px;
                max-width: 400px;
            }
            
            .details-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .details-header h3 {
                margin: 0;
                font-size: 16px;
                color: #2c3e50;
            }
            
            .close-details {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .details-content {
                font-size: 14px;
            }
            
            .detail-row {
                padding: 5px 0;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .detail-row:last-child {
                border-bottom: none;
            }
            
            .detail-row strong {
                color: #2c3e50;
                display: inline-block;
                width: 80px;
            }
            
            .graph-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 10001;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                font-size: 14px;
                font-weight: 500;
            }
            
            .graph-notification.success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            
            .graph-notification.error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            
            .graph-notification.info {
                background: #d1ecf1;
                color: #0c5460;
                border: 1px solid #bee5db;
            }
        `;
        document.head.appendChild(style);
    }
}

// Export for use in dashboard
window.DependencyGraph = DependencyGraph;
