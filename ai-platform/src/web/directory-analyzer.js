// Directory Analyzer Module
console.log('📂 Directory Analyzer module loading...');

// Mock directory analysis data
const directoryData = {
    currentAnalysis: {
        path: '/Users/Trevor/CascadeProjects/web',
        totalFiles: 156,
        totalDirectories: 45,
        totalSize: 102400000,
        largestFile: 'dashboard-scripts.js',
        largestFileSize: 8397000,
        deepestLevel: 8,
        fileTypes: {
            JavaScript: 45,
            Python: 28,
            JSON: 23,
            HTML: 18,
            CSS: 12,
            Markdown: 15,
            Text: 8,
            Other: 7,
        },
        lastAnalyzed: '2024-05-20T13:30:00',
    },
    directoryStructure: [
        {
            name: 'web',
            type: 'directory',
            size: 102400000,
            files: 156,
            subdirectories: 45,
            level: 0,
            expanded: true,
            children: [
                {
                    name: 'api',
                    type: 'directory',
                    size: 25600000,
                    files: 28,
                    subdirectories: 8,
                    level: 1,
                    expanded: false,
                    children: [
                        {
                            name: 'routers',
                            type: 'directory',
                            size: 8900000,
                            files: 12,
                            subdirectories: 0,
                            level: 2,
                            expanded: false,
                        },
                        {
                            name: 'models',
                            type: 'directory',
                            size: 3400000,
                            files: 8,
                            subdirectories: 0,
                            level: 2,
                            expanded: false,
                        },
                    ],
                },
                {
                    name: 'dashboard_components',
                    type: 'directory',
                    size: 15600000,
                    files: 18,
                    subdirectories: 0,
                    level: 1,
                    expanded: false,
                },
                {
                    name: 'tests',
                    type: 'directory',
                    size: 8900000,
                    files: 35,
                    subdirectories: 12,
                    level: 1,
                    expanded: false,
                },
            ],
        },
    ],
    fileAnalysis: [
        {
            name: 'dashboard-scripts.js',
            path: '/dashboard-scripts.js',
            size: 8397000,
            type: 'JavaScript',
            lines: 8397,
            complexity: 15,
            lastModified: '2024-05-20T13:25:00',
            issues: 12,
        },
        {
            name: 'backup_system.py',
            path: '/api/backup_system.py',
            size: 65000,
            type: 'Python',
            lines: 802,
            complexity: 4,
            lastModified: '2024-05-20T13:20:00',
            issues: 2,
        },
        {
            name: 'ai_dashboard.html',
            path: '/ai_dashboard.html',
            size: 15000,
            type: 'HTML',
            lines: 364,
            complexity: 2,
            lastModified: '2024-05-20T13:15:00',
            issues: 0,
        },
    ],
    insights: [
        {
            type: 'warning',
            title: 'Large File Detected',
            description:
        'dashboard-scripts.js is unusually large (8.4MB) - consider splitting into smaller modules',
            severity: 'medium',
        },
        {
            type: 'info',
            title: 'Deep Directory Structure',
            description: 'Maximum directory depth of 8 levels detected - consider flattening structure',
            severity: 'low',
        },
        {
            type: 'success',
            title: 'Good File Distribution',
            description:
        'Files are well-distributed across directories with no single overcrowded folder',
            severity: 'info',
        },
    ],
    recommendations: [
        {
            priority: 'high',
            title: 'Refactor Large JavaScript Files',
            description:
        'Split large JS files into smaller, more manageable modules for better maintainability',
            impact: 'High',
            effort: 'Medium',
        },
        {
            priority: 'medium',
            title: 'Optimize Directory Structure',
            description:
        'Consider flattening deeply nested directories to improve navigation and organization',
            impact: 'Medium',
            effort: 'Low',
        },
        {
            priority: 'low',
            title: 'Consolidate Similar Files',
            description:
        'Group similar file types together for better organization and easier maintenance',
            impact: 'Low',
            effort: 'Low',
        },
    ],
};

// Show directory analyzer
function showDirectoryAnalyzer(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-folder-tree"></i> Directory Analyzer
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="analyzeDirectory()">
                        <i class="fas fa-search"></i> Analyze Directory
                    </button>
                    <button class="btn btn-secondary" onclick="changeDirectory()">
                        <i class="fas fa-folder-open"></i> Change Directory
                    </button>
                    <button class="btn btn-secondary" onclick="exportAnalysisReport()">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                </div>
            </div>
            
            <!-- Current Path -->
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <i class="fas fa-folder" style="color: var(--primary-color);"></i>
                    <span style="color: var(--text-primary); font-family: monospace;">${directoryData.currentAnalysis.path}</span>
                    <span style="color: var(--text-secondary);">• Last analyzed: ${formatTimestamp(directoryData.currentAnalysis.lastAnalyzed)}</span>
                </div>
            </div>
            
            <!-- Directory Stats -->
            <div class="directory-stats" style="margin-bottom: 2rem;">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${directoryData.currentAnalysis.totalFiles}</div>
                        <div class="stat-label">Total Files</div>
                        <div class="stat-change">+5 new files</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${directoryData.currentAnalysis.totalDirectories}</div>
                        <div class="stat-label">Directories</div>
                        <div class="stat-change">+2 new folders</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${formatFileSize(directoryData.currentAnalysis.totalSize)}</div>
                        <div class="stat-label">Total Size</div>
                        <div class="stat-change">+12.5MB</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${directoryData.currentAnalysis.deepestLevel}</div>
                        <div class="stat-label">Max Depth</div>
                        <div class="stat-change" style="color: var(--warning-color);">Deep structure</div>
                    </div>
                </div>
            </div>
            
            <!-- Directory Tabs -->
            <div class="directory-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showDirectoryTab('structure')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Structure
                    </button>
                    <button class="tab-btn" onclick="showDirectoryTab('files')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Files
                    </button>
                    <button class="tab-btn" onclick="showDirectoryTab('types')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        File Types
                    </button>
                    <button class="tab-btn" onclick="showDirectoryTab('insights')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Insights
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="directory-tab-content">
                ${getStructureContent()}
            </div>
        </div>
    `;
}

// Get structure content
function getStructureContent() {
    return `
        <div class="directory-structure">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Directory Structure</h3>
                <div>
                    <button class="btn btn-sm btn-secondary" onclick="expandAll()">
                        <i class="fas fa-expand"></i> Expand All
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="collapseAll()">
                        <i class="fas fa-compress"></i> Collapse All
                    </button>
                </div>
            </div>
            
            <div class="tree-view" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                ${renderDirectoryTree(directoryData.directoryStructure)}
            </div>
        </div>
    `;
}

// Get files content
function getFilesContent() {
    return `
        <div class="file-analysis">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">File Analysis</h3>
                <div>
                    <select onchange="sortFiles(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="size">Sort by Size</option>
                        <option value="name">Sort by Name</option>
                        <option value="type">Sort by Type</option>
                        <option value="modified">Sort by Modified</option>
                    </select>
                </div>
            </div>
            
            <div class="files-list" style="display: grid; gap: 1rem;">
                ${directoryData.fileAnalysis
        .map(
            (file) => `
                    <div class="file-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${file.name}</h4>
                                    <span class="file-type-badge">${file.type}</span>
                                    ${file.issues > 0 ? `<span class="issues-badge">${file.issues} issues</span>` : ''}
                                </div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${file.path}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.25rem; font-weight: bold; color: var(--text-primary);">${formatFileSize(file.size)}</div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${file.lines} lines</p>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${file.complexity}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Complexity</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${file.lines}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Lines</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: ${getIssuesColor(file.issues)}; font-weight: bold; font-size: 0.9rem;">${file.issues}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Issues</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${formatTimestamp(file.lastModified)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Modified</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem;">
                                <button class="btn btn-sm btn-secondary" onclick="viewFileDetails('${file.name}')">
                                    <i class="fas fa-eye"></i> Details
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="analyzeFile('${file.name}')">
                                    <i class="fas fa-search"></i> Analyze
                                </button>
                            </div>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get file types content
function getTypesContent() {
    return `
        <div class="file-types">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">File Type Distribution</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">File Type Chart</h4>
                    <div style="height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                        <div style="text-align: center;">
                            <i class="fas fa-chart-pie" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <p>File type distribution chart would be rendered here</p>
                            <p style="font-size: 0.9rem;">Showing breakdown by file type</p>
                        </div>
                    </div>
                </div>
                
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Type Statistics</h4>
                    <div style="display: grid; gap: 1rem;">
                        ${Object.entries(directoryData.currentAnalysis.fileTypes)
        .map(
            ([type, count]) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0;">
                                <span style="color: var(--text-primary);">${type}</span>
                                <span style="color: var(--text-secondary);">${count} files</span>
                            </div>
                        `
        )
        .join('')}
                    </div>
                </div>
            </div>
            
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">File Type Insights</h4>
                <div style="display: grid; gap: 1rem;">
                    <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--primary-color);">
                        <h5 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">Most Common Type</h5>
                        <p style="color: var(--text-secondary); margin: 0;">JavaScript files are the most common (45 files), indicating a web-focused project</p>
                    </div>
                    <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                        <h5 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">Good Diversity</h5>
                        <p style="color: var(--text-secondary); margin: 0;">Good mix of file types with proper separation of concerns</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Get insights content
function getInsightsContent() {
    return `
        <div class="directory-insights">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Directory Insights</h3>
            
            <div class="insights-list" style="display: grid; gap: 1rem; margin-bottom: 2rem;">
                ${directoryData.insights
        .map(
            (insight) => `
                    <div class="insight-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; border-left: 4px solid ${getInsightColor(insight.type)};">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${insight.title}</h4>
                                    <span class="insight-badge insight-${insight.type}">${insight.type}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${insight.description}</p>
                            </div>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
            
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Recommendations</h4>
                <div style="display: grid; gap: 1rem;">
                    ${directoryData.recommendations
        .map(
            (rec) => `
                        <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid ${getPriorityColor(rec.priority)};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">${rec.title}</span>
                                <span style="color: ${getPriorityColor(rec.priority)}; font-size: 0.8rem; background: ${getPriorityBgColor(rec.priority)}; padding: 0.25rem 0.5rem; border-radius: 4px;">${rec.priority}</span>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">${rec.description}</p>
                        </div>
                    `
        )
        .join('')}
                </div>
            </div>
        </div>
    `;
}

// Helper functions
function renderDirectoryTree(structure, level = 0) {
    return structure
        .map(
            (item) => `
        <div class="tree-item" style="margin-left: ${level * 20}px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; cursor: pointer;" onclick="toggleDirectory('${item.name}')">
                ${
    item.type === 'directory'
        ? `<i class="fas fa-${item.expanded ? 'folder-open' : 'folder'}" style="color: var(--warning-color);"></i>`
        : `<i class="${getFileIcon(item.name)}" style="color: ${getFileIconColor(item.name)};"></i>`
}
                <span style="color: var(--text-primary);">${item.name}</span>
                ${
    item.type === 'directory'
        ? `<span style="color: var(--text-secondary); font-size: 0.9rem;">(${item.files} files, ${item.subdirectories} dirs)</span>`
        : `<span style="color: var(--text-secondary); font-size: 0.9rem;">${formatFileSize(item.size)}</span>`
}
            </div>
            ${
    item.type === 'directory' && item.expanded && item.children
        ? renderDirectoryTree(item.children, level + 1)
        : ''
}
        </div>
    `
        )
        .join('');
}

function getFileIcon(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const iconMap = {
        js: 'fab fa-js',
        py: 'fab fa-python',
        html: 'fas fa-code',
        css: 'fas fa-palette',
        json: 'fas fa-file-code',
        md: 'fas fa-file-alt',
        txt: 'fas fa-file-alt',
    };
    return iconMap[extension] || 'fas fa-file';
}

function getFileIconColor(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const colorMap = {
        js: 'var(--warning-color)',
        py: 'var(--primary-color)',
        html: 'var(--danger-color)',
        css: 'var(--success-color)',
        json: 'var(--primary-color)',
        md: 'var(--text-secondary)',
        txt: 'var(--text-secondary)',
    };
    return colorMap[extension] || 'var(--text-secondary)';
}

function getInsightColor(type) {
    switch (type) {
    case 'warning':
        return 'var(--warning-color)';
    case 'error':
        return 'var(--danger-color)';
    case 'success':
        return 'var(--success-color)';
    case 'info':
        return 'var(--primary-color)';
    default:
        return 'var(--text-secondary)';
    }
}

function getPriorityColor(priority) {
    switch (priority) {
    case 'high':
        return 'var(--danger-color)';
    case 'medium':
        return 'var(--warning-color)';
    case 'low':
        return 'var(--success-color)';
    default:
        return 'var(--primary-color)';
    }
}

function getPriorityBgColor(priority) {
    switch (priority) {
    case 'high':
        return 'rgba(239, 68, 68, 0.1)';
    case 'medium':
        return 'rgba(245, 158, 11, 0.1)';
    case 'low':
        return 'rgba(34, 197, 94, 0.1)';
    default:
        return 'rgba(102, 126, 234, 0.1)';
    }
}

function getIssuesColor(count) {
    if (count === 0) {
        return 'var(--success-color)';
    }
    if (count <= 5) {
        return 'var(--warning-color)';
    }
    return 'var(--danger-color)';
}

function formatFileSize(bytes) {
    if (bytes === 0) {
        return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Tab switching
function showDirectoryTab(tabName) {
    const content = document.getElementById('directory-tab-content');
    if (!content) {
        return;
    }

    // Update tab buttons
    document.querySelectorAll('.directory-tabs .tab-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });

    event.target.classList.add('active');
    event.target.style.color = 'var(--primary-color)';
    event.target.style.borderBottom = '2px solid var(--primary-color)';

    // Update content
    switch (tabName) {
    case 'structure':
        content.textContent = getStructureContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'files':
        content.textContent = getFilesContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'types':
        content.textContent = getTypesContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'insights':
        content.textContent = getInsightsContent() /* Replaced innerHTML with textContent for safety */
        break;
    }
}

// Action functions
function analyzeDirectory() {
    console.log('Analyzing directory...');
    alert('Directory analysis would run here, scanning all files and subdirectories');
}

function changeDirectory() {
    console.log('Changing directory...');
    alert('Directory selection dialog would be shown here');
}

function exportAnalysisReport() {
    console.log('Exporting analysis report...');
    alert('Directory analysis report would be exported as PDF/Excel');
}

function expandAll() {
    console.log('Expanding all directories...');
    alert('All directories would be expanded in the tree view');
}

function collapseAll() {
    console.log('Collapsing all directories...');
    alert('All directories would be collapsed in the tree view');
}

function toggleDirectory(name) {
    console.log('Toggling directory:', name);
    alert(`Directory ${name} would be expanded/collapsed here`);
}

function sortFiles(sortBy) {
    console.log('Sorting files by:', sortBy);
    alert(`Files would be sorted by ${sortBy}`);
}

function viewFileDetails(filename) {
    console.log('Viewing file details:', filename);
    alert(`Detailed analysis for ${filename} would be shown here`);
}

function analyzeFile(filename) {
    console.log('Analyzing file:', filename);
    alert(`Code analysis for ${filename} would be performed here`);
}

// Add styles for directory badges
if (!document.getElementById('directory-analyzer-styles')) {
    const style = document.createElement('style');
    style.id = 'directory-analyzer-styles';
    style.textContent = `
.file-type-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--bg-primary);
    color: var(--text-secondary);
}

.issues-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.insight-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.insight-warning {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.insight-error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.insight-success {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.insight-info {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.tree-item {
    transition: background-color 0.2s ease;
}

.tree-item:hover {
    background: var(--bg-primary);
    border-radius: 4px;
}
`;
    document.head.appendChild(style);
}

console.log('✅ Directory Analyzer module loaded');
