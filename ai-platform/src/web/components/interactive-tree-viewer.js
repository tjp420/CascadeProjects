/**
 * Interactive Directory Tree Viewer
 * Advanced visualization for directory structure with expand/collapse functionality
 */

class InteractiveDirectoryTree {
    constructor(containerId, data) {
        this.container = document.getElementById(containerId);
        this.data = data;
        this.expandedNodes = new Set();
        this.searchTerm = '';
        this.filterType = 'all';
        
        this.init();
    }

    init() {
        this.createTreeContainer();
        this.createSearchControls();
        this.renderTree();
        this.attachEventListeners();
    }

    createTreeContainer() {
        this.container.textContent = `
            <div class="interactive-tree-container">
                <div class="tree-controls">
                    <div class="search-container">
                        <input type="text" id="tree-search" placeholder="Search directories..." class="search-input">
                        <button id="clear-search" class="btn-secondary btn-sm">Clear</button>
                    </div>
                    <div class="filter-controls">
                        <select id="filter-type" class="filter-select">
                            <option value="all">All Files</option>
                            <option value="large">Large Directories (>100 files)</option>
                            <option value="medium">Medium (10-100 files)</option>
                            <option value="small">Small (<10 files)</option>
                        </select>
                        <button id="expand-all" class="btn-secondary btn-sm">Expand All</button>
                        <button id="collapse-all" class="btn-secondary btn-sm">Collapse All</button>
                    </div>
                    <div class="stats-container">
                        <span class="stat-item">📁 <span id="total-directories">0</span> directories</span>
                        <span class="stat-item">📂 <span id="total-files">0</span> files</span>
                        <span class="stat-item">📏 <span id="total-size">0</span></span>
                    </div>
                </div>
                <div class="tree-view" id="tree-view"></div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        this.addStyles();
    }

    createSearchControls() {
        const searchInput = document.getElementById('tree-search');
        const clearButton = document.getElementById('clear-search');
        const filterType = document.getElementById('filter-type');
        const expandAll = document.getElementById('expand-all');
        const collapseAll = document.getElementById('collapse-all');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.renderTree();
            });
        }

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                searchInput.value = '';
                this.searchTerm = '';
                this.renderTree();
            });
        }

        if (filterType) {
            filterType.addEventListener('change', (e) => {
                this.filterType = e.target.value;
                this.renderTree();
            });
        }

        if (expandAll) {
            expandAll.addEventListener('click', () => {
                this.expandAll();
            });
        }

        if (collapseAll) {
            collapseAll.addEventListener('click', () => {
                this.collapseAll();
            });
        }
    }

    renderTree() {
        const treeView = document.getElementById('tree-view');
        if (!treeView) {
            return;
        }

        const filteredData = this.filterData();
        const treeHtml = this.buildTreeHtml(filteredData);
        treeView.textContent = treeHtml /* Replaced innerHTML with textContent for safety */

        this.updateStats(filteredData);
        this.attachTreeEventListeners();
    }

    filterData() {
        if (!this.data || !this.data.largestDirectories) {
            return [];
        }

        let filtered = [...this.data.largestDirectories];

        // Apply search filter
        if (this.searchTerm) {
            filtered = filtered.filter(dir => 
                dir.name.toLowerCase().includes(this.searchTerm)
            );
        }

        // Apply size filter
        if (this.filterType !== 'all') {
            filtered = filtered.filter(dir => {
                switch (this.filterType) {
                case 'large':
                    return dir.files > 100;
                case 'medium':
                    return dir.files >= 10 && dir.files <= 100;
                case 'small':
                    return dir.files < 10;
                default:
                    return true;
                }
            });
        }

        return filtered;
    }

    buildTreeHtml(directories) {
        if (directories.length === 0) {
            return '<div class="no-results">No directories found matching your criteria</div>';
        }

        return directories.map(dir => this.buildDirectoryNode(dir)).join('');
    }

    buildDirectoryNode(directory) {
        const nodeId = this.generateNodeId(directory.name);
        const isExpanded = this.expandedNodes.has(nodeId);
        const hasChildren = directory.files > 0;
        const icon = isExpanded ? '📂' : '📁';
        
        return `
            <div class="tree-node" data-node-id="${nodeId}" data-files="${directory.files}" data-size="${directory.size}">
                <div class="node-content">
                    <button class="node-toggle ${isExpanded ? 'expanded' : ''}" data-node-id="${nodeId}">
                        <span class="node-icon">${icon}</span>
                        <span class="node-name">${directory.name}</span>
                    </button>
                    <div class="node-details">
                        <span class="file-count">${directory.files} files</span>
                        <span class="file-size">${directory.size}</span>
                    </div>
                </div>
                ${hasChildren ? this.buildChildrenContent(directory, nodeId) : ''}
            </div>
        `;
    }

    buildChildrenContent(directory, nodeId) {
        const isExpanded = this.expandedNodes.has(nodeId);
        if (!isExpanded) {
            return '';
        }

        // Simulate child files and subdirectories
        const childFiles = this.generateChildFiles(directory);
        const childDirs = this.generateChildDirectories(directory);

        return `
            <div class="node-children" data-parent="${nodeId}">
                ${childFiles.map(file => this.buildFileNode(file)).join('')}
                ${childDirs.map(dir => this.buildDirectoryNode(dir)).join('')}
            </div>
        `;
    }

    buildFileNode(file) {
        const fileIcon = this.getFileIcon(file.name);
        return `
            <div class="tree-file" data-file="${file.name}">
                <span class="file-icon">${fileIcon}</span>
                <span class="file-name">${file.name}</span>
                <span class="file-size">${file.size}</span>
            </div>
        `;
    }

    generateChildFiles(directory) {
        // Generate sample files for demonstration
        const commonFiles = ['index.js', 'README.md', 'package.json', 'config.json', '.gitignore'];
        const childFiles = [];

        for (let i = 0; i < Math.min(5, directory.files); i++) {
            childFiles.push({
                name: commonFiles[i] || `file${i}.js`,
                size: this.formatFileSize(Math.random() * 10000),
                type: this.getFileType(commonFiles[i] || 'file.js')
            });
        }

        return childFiles;
    }

    generateChildDirectories(directory) {
        // Generate sample subdirectories for demonstration
        const commonSubdirs = ['src', 'tests', 'docs', 'config', 'lib'];
        const childDirs = [];

        for (let i = 0; i < Math.min(3, Math.floor(directory.files / 20)); i++) {
            childDirs.push({
                name: `${directory.name}/${commonSubdirs[i]}`,
                files: Math.floor(Math.random() * 20) + 1,
                size: this.formatFileSize(Math.random() * 5000),
                depth: (directory.depth || 0) + 1
            });
        }

        return childDirs;
    }

    getFileIcon(filename) {
        const extension = filename.split('.').pop()?.toLowerCase();
        const iconMap = {
            'js': '🟨',
            'ts': '📘',
            'jsx': '⚛️',
            'tsx': '⚛️',
            'py': '🐍',
            'json': '📋',
            'md': '📝',
            'txt': '📄',
            'html': '🌐',
            'css': '🎨',
            'scss': '🎨',
            'less': '🎨',
            'svg': '🖼️',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️',
            'pdf': '📑',
            'zip': '📦',
            'lock': '🔒',
            'env': '🔧',
            'yml': '📄',
            'yaml': '📄',
            'toml': '📄',
            'ini': '📄'
        };
        
        return iconMap[extension] || '📄';
    }

    getFileType(filename) {
        const extension = filename.split('.').pop()?.toLowerCase();
        const typeMap = {
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'py': 'python',
            'json': 'json',
            'md': 'markdown',
            'html': 'html',
            'css': 'css',
            'svg': 'svg'
        };
        
        return typeMap[extension] || 'text';
    }

    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    generateNodeId(name) {
        return name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    }

    attachEventListeners() {
        const treeView = document.getElementById('tree-view');
        if (!treeView) {
            return;
        }

        treeView.addEventListener('click', (e) => {
            const toggle = e.target.closest('.node-toggle');
            if (toggle) {
                e.preventDefault();
                const nodeId = toggle.getAttribute('data-node-id');
                this.toggleNode(nodeId);
            }

            const fileNode = e.target.closest('.tree-file');
            if (fileNode) {
                this.selectFile(fileNode);
            }
        });
    }

    attachTreeEventListeners() {
        // Re-attach event listeners after re-render
        const treeView = document.getElementById('tree-view');
        if (!treeView) {
            return;
        }

        treeView.addEventListener('click', (e) => {
            const toggle = e.target.closest('.node-toggle');
            if (toggle) {
                e.preventDefault();
                const nodeId = toggle.getAttribute('data-node-id');
                this.toggleNode(nodeId);
            }

            const fileNode = e.target.closest('.tree-file');
            if (fileNode) {
                this.selectFile(fileNode);
            }
        });
    }

    toggleNode(nodeId) {
        if (this.expandedNodes.has(nodeId)) {
            this.expandedNodes.delete(nodeId);
        } else {
            this.expandedNodes.add(nodeId);
        }
        this.renderTree();
    }

    expandAll() {
        const allNodes = document.querySelectorAll('.node-toggle');
        allNodes.forEach(toggle => {
            const nodeId = toggle.getAttribute('data-node-id');
            this.expandedNodes.add(nodeId);
        });
        this.renderTree();
    }

    collapseAll() {
        this.expandedNodes.clear();
        this.renderTree();
    }

    selectFile(fileNode) {
        // Remove previous selection
        document.querySelectorAll('.tree-file.selected').forEach(node => {
            node.classList.remove('selected');
        });
        
        // Add selection to current file
        fileNode.classList.add('selected');
        
        // Show file details
        const fileName = fileNode.getAttribute('data-file');
        const fileSize = fileNode.querySelector('.file-size').textContent;
        
        this.showFileDetails(fileName, fileSize);
    }

    showFileDetails(fileName, fileSize) {
        // Create or update file details panel
        let detailsPanel = document.getElementById('file-details-panel');
        
        if (!detailsPanel) {
            detailsPanel = document.createElement('div');
            detailsPanel.id = 'file-details-panel';
            detailsPanel.className = 'file-details-panel';
            this.container.appendChild(detailsPanel);
        }
        
        detailsPanel.textContent = `
            <div class="details-header">
                <h3>File Details</h3>
                <button class="close-details" onclick="this.parentElement.remove()">×</button>
            </div>
            <div class="details-content">
                <div class="detail-row">
                    <strong>Name:</strong> ${fileName}
                </div>
                <div class="detail-row">
                    <strong>Size:</strong> ${fileSize}
                </div>
                <div class="detail-row">
                    <strong>Type:</strong> ${this.getFileType(fileName)}
                </div>
                <div class="detail-row">
                    <strong>Modified:</strong> ${new Date().toLocaleString()}
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    updateStats(directories) {
        const totalDirs = directories.length;
        const totalFiles = directories.reduce((sum, dir) => sum + dir.files, 0);
        const totalSize = directories.reduce((sum, dir) => {
            const sizeBytes = this.parseFileSize(dir.size);
            return sum + sizeBytes;
        }, 0);

        document.getElementById('total-directories').textContent = totalDirs;
        document.getElementById('total-files').textContent = totalFiles;
        document.getElementById('total-size').textContent = this.formatFileSize(totalSize);
    }

    parseFileSize(sizeStr) {
        const units = ['B', 'KB', 'MB', 'GB'];
        const parts = sizeStr.split(' ');
        const size = parseFloat(parts[0]);
        const unit = parts[1];
        
        const unitIndex = units.indexOf(unit);
        return size * Math.pow(1024, unitIndex);
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .interactive-tree-container {
                background: white;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
                overflow: hidden;
            }
            
            .tree-controls {
                padding: 15px;
                border-bottom: 1px solid #e5e7eb;
                background: #f8f9fa;
            }
            
            .search-container {
                display: flex;
                gap: 10px;
                margin-bottom: 10px;
            }
            
            .search-input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .filter-controls {
                display: flex;
                gap: 10px;
                align-items: center;
                margin-bottom: 10px;
            }
            
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
            
            .stats-container {
                display: flex;
                gap: 20px;
                font-size: 12px;
                color: #666;
            }
            
            .stat-item {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .tree-view {
                max-height: 600px;
                overflow-y: auto;
                padding: 15px;
            }
            
            .tree-node {
                margin-left: 0;
                user-select: none;
            }
            
            .tree-node[data-depth="1"] {
                margin-left: 20px;
            }
            
            .tree-node[data-depth="2"] {
                margin-left: 40px;
            }
            
            .tree-node[data-depth="3"] {
                margin-left: 60px;
            }
            
            .node-content {
                display: flex;
                align-items: center;
                padding: 8px 0;
                min-height: 32px;
                cursor: pointer;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            
            .node-content:hover {
                background: #f0f8ff;
            }
            
            .node-toggle {
                background: none;
                border: none;
                padding: 0;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 16px;
            }
            
            .node-icon {
                transition: transform 0.2s;
            }
            
            .node-toggle.expanded .node-icon {
                transform: rotate(90deg);
            }
            
            .node-name {
                font-weight: 500;
                color: #2c3e50;
            }
            
            .node-details {
                margin-left: 10px;
                font-size: 12px;
                color: #666;
                opacity: 0.8;
            }
            
            .node-children {
                margin-left: 20px;
                border-left: 1px solid #e5e7eb;
                padding-left: 10px;
                margin-top: 5px;
            }
            
            .tree-file {
                display: flex;
                align-items: center;
                padding: 4px 8px;
                margin: 2px 0;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s;
                font-size: 12px;
            }
            
            .tree-file:hover {
                background: #f8f9fa;
            }
            
            .tree-file.selected {
                background: #007bff;
                color: white;
            }
            
            .file-icon {
                margin-right: 8px;
            }
            
            .file-name {
                flex: 1;
                color: #495057;
            }
            
            .file-size {
                color: #6c757d;
                font-size: 11px;
            }
            
            .no-results {
                text-align: center;
                padding: 40px;
                color: #666;
                font-style: italic;
            }
            
            .file-details-panel {
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
        `;
        document.head.appendChild(style);
    }
}

// Global wrapper functions for tree view buttons
window.expandAll = function() {
    console.log('expandAll called globally');
    
    // Try to find the active tree instance
    const treeContainer = document.querySelector('.interactive-tree-container');
    if (treeContainer && treeContainer._treeInstance) {
        treeContainer._treeInstance.expandAll();
        showNotification('All directories expanded', 'success');
    } else {
        // Fallback: expand all tree items manually
        const allToggleElements = document.querySelectorAll('.node-toggle');
        const allTreeItems = document.querySelectorAll('.tree-item');
        
        allToggleElements.forEach(toggle => {
            const icon = toggle.querySelector('svg');
            if (icon) {
                icon.classList.remove('fa-folder');
                icon.classList.add('fa-folder-open');
            }
        });
        
        allTreeItems.forEach(item => {
            item.style.display = 'block';
        });
        
        showNotification('All directories expanded', 'success');
    }
};

window.collapseAll = function() {
    console.log('collapseAll called globally');
    
    // Try to find the active tree instance
    const treeContainer = document.querySelector('.interactive-tree-container');
    if (treeContainer && treeContainer._treeInstance) {
        treeContainer._treeInstance.collapseAll();
        showNotification('All directories collapsed', 'success');
    } else {
        // Fallback: collapse all tree items manually (except root)
        const allToggleElements = document.querySelectorAll('.node-toggle');
        const allTreeItems = document.querySelectorAll('.tree-item');
        
        allToggleElements.forEach((toggle, index) => {
            if (index > 0) { // Don't collapse the first (root) item
                const icon = toggle.querySelector('svg');
                if (icon) {
                    icon.classList.remove('fa-folder-open');
                    icon.classList.add('fa-folder');
                }
            }
        });
        
        // Hide child items
        allTreeItems.forEach((item, index) => {
            if (index > 0) { // Don't hide the root
                const marginLeft = item.style.marginLeft || '0px';
                if (parseInt(marginLeft) > 0) {
                    item.style.display = 'none';
                }
            }
        });
        
        showNotification('All directories collapsed', 'success');
    }
};

window.toggleDirectory = function(directoryName) {
    console.log('toggleDirectory called for:', directoryName);
    
    const element = document.querySelector(`[onclick="toggleDirectory('${directoryName}')"]`);
    if (!element) return;
    
    const isExpanded = element.getAttribute('data-expanded') !== 'false';
    const icon = element.querySelector('svg');
    const parentItem = element.parentElement;
    const subItems = parentItem.querySelectorAll(':scope > .tree-item');
    
    if (isExpanded) {
        // Collapse
        if (icon) {
            icon.classList.remove('fa-folder-open');
            icon.classList.add('fa-folder');
        }
        subItems.forEach(item => {
            item.style.display = 'none';
        });
        element.setAttribute('data-expanded', 'false');
    } else {
        // Expand
        if (icon) {
            icon.classList.remove('fa-folder');
            icon.classList.add('fa-folder-open');
        }
        subItems.forEach(item => {
            item.style.display = 'block';
        });
        element.setAttribute('data-expanded', 'true');
    }
};

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '9999';
    notification.style.minWidth = '250px';
    notification.textContent = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    ` /* Replaced innerHTML with textContent for safety */
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Export for use in dashboard
window.InteractiveDirectoryTree = InteractiveDirectoryTree;
