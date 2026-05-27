// Complexity Analysis Module
console.log('🔍 Complexity Analysis module loading...');

// Mock complexity data
const complexityData = {
    overallMetrics: {
        totalComplexity: 145,
        averageComplexity: 3.2,
        highComplexityFiles: 8,
        mediumComplexityFiles: 23,
        lowComplexityFiles: 45,
        totalFiles: 76,
        lastAnalyzed: '2024-05-20T10:30:00',
    },
    complexityTrend: [
        { date: '2024-05-01', complexity: 132 },
        { date: '2024-05-05', complexity: 138 },
        { date: '2024-05-10', complexity: 142 },
        { date: '2024-05-15', complexity: 148 },
        { date: '2024-05-20', complexity: 145 },
    ],
    fileAnalysis: [
        {
            name: 'dashboard-scripts.js',
            path: '/dashboard-scripts.js',
            complexity: 15,
            lines: 8397,
            functions: 45,
            classes: 3,
            issues: 12,
            maintainabilityIndex: 0,
            cyclomaticComplexity: 392,
        },
        {
            name: 'backup-manager.js',
            path: '/dashboard_components/backup-manager.js',
            complexity: 8,
            lines: 543,
            functions: 18,
            classes: 1,
            issues: 5,
            maintainabilityIndex: 0,
            cyclomaticComplexity: 61,
        },
        {
            name: 'api/app.py',
            path: '/api/app.py',
            complexity: 6,
            lines: 715,
            functions: 12,
            classes: 2,
            issues: 3,
            maintainabilityIndex: 5,
            cyclomaticComplexity: 25,
        },
        {
            name: 'backup_system.py',
            path: '/api/backup_system.py',
            complexity: 4,
            lines: 802,
            functions: 8,
            classes: 1,
            issues: 2,
            maintainabilityIndex: 45,
            cyclomaticComplexity: 18,
        },
        {
            name: 'dashboard-init.js',
            path: '/dashboard-init.js',
            complexity: 3,
            lines: 418,
            functions: 15,
            classes: 0,
            issues: 1,
            maintainabilityIndex: 6,
            cyclomaticComplexity: 31,
        },
    ],
    complexityDistribution: {
        low: { count: 45, percentage: 59 },
        medium: { count: 23, percentage: 30 },
        high: { count: 8, percentage: 11 },
    },
    recommendations: [
        {
            type: 'high_priority',
            title: 'Refactor dashboard-scripts.js',
            description:
        'This file has extremely high complexity (392) and zero maintainability index. Consider breaking it into smaller modules.',
            impact: 'High',
            effort: 'High',
        },
        {
            type: 'medium_priority',
            title: 'Optimize backup-manager.js',
            description:
        'Moderate complexity with some maintainability issues. Extract some functions into utilities.',
            impact: 'Medium',
            effort: 'Medium',
        },
        {
            type: 'low_priority',
            title: 'Review api/app.py',
            description:
        'Some complexity issues but generally well-structured. Minor optimizations recommended.',
            impact: 'Low',
            effort: 'Low',
        },
    ],
};

// Show complexity analysis
function _showComplexityAnalysis(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-code-branch"></i> Complexity Analysis
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="runComplexityAnalysis()">
                        <i class="fas fa-play"></i> Run Analysis
                    </button>
                    <button class="btn btn-secondary" onclick="exportComplexityReport()">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                    <button class="btn btn-secondary" onclick="refreshComplexityData()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <!-- Overall Metrics -->
            <div class="complexity-overview" style="margin-bottom: 2rem;">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${complexityData.overallMetrics.totalComplexity}</div>
                        <div class="stat-label">Total Complexity</div>
                        <div class="stat-change">+3 from last week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${complexityData.overallMetrics.averageComplexity}</div>
                        <div class="stat-label">Average Complexity</div>
                        <div class="stat-change">-0.2 improvement</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${complexityData.overallMetrics.highComplexityFiles}</div>
                        <div class="stat-label">High Complexity Files</div>
                        <div class="stat-change" style="color: var(--warning-color);">Needs attention</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${complexityData.overallMetrics.totalFiles}</div>
                        <div class="stat-label">Total Files Analyzed</div>
                        <div class="stat-change">+2 new files</div>
                    </div>
                </div>
            </div>
            
            <!-- Complexity Distribution -->
            <div class="complexity-distribution" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                <div class="chart-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Complexity Distribution</h3>
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">Low Complexity (1-3)</span>
                            <span style="color: var(--success-color); font-weight: bold;">${complexityData.complexityDistribution.low.count} (${complexityData.complexityDistribution.low.percentage}%)</span>
                        </div>
                        <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${complexityData.complexityDistribution.low.percentage}%; background: var(--success-color); border-radius: 4px;"></div>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">Medium Complexity (4-7)</span>
                            <span style="color: var(--warning-color); font-weight: bold;">${complexityData.complexityDistribution.medium.count} (${complexityData.complexityDistribution.medium.percentage}%)</span>
                        </div>
                        <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${complexityData.complexityDistribution.medium.percentage}%; background: var(--warning-color); border-radius: 4px;"></div>
                        </div>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">High Complexity (8+)</span>
                            <span style="color: var(--danger-color); font-weight: bold;">${complexityData.complexityDistribution.high.count} (${complexityData.complexityDistribution.high.percentage}%)</span>
                        </div>
                        <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${complexityData.complexityDistribution.high.percentage}%; background: var(--danger-color); border-radius: 4px;"></div>
                        </div>
                    </div>
                </div>
                
                <div class="trend-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Complexity Trend</h3>
                    <div style="height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                        <div style="text-align: center;">
                            <i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <p>Trend chart would be rendered here</p>
                            <p style="font-size: 0.9rem;">Showing complexity changes over time</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Complexity Tabs -->
            <div class="complexity-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showComplexityTab('files')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        File Analysis
                    </button>
                    <button class="tab-btn" onclick="showComplexityTab('recommendations')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Recommendations
                    </button>
                    <button class="tab-btn" onclick="showComplexityTab('hotspots')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Hotspots
                    </button>
                    <button class="tab-btn" onclick="showComplexityTab('metrics')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Metrics
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="complexity-tab-content">
                ${getFileAnalysisContent()}
            </div>
        </div>
    `;
}

// Get file analysis content
function getFileAnalysisContent() {
    return `
        <div class="file-analysis">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">File Complexity Analysis</h3>
                <div>
                    <select onchange="filterComplexityFiles(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Files</option>
                        <option value="high">High Complexity</option>
                        <option value="medium">Medium Complexity</option>
                        <option value="low">Low Complexity</option>
                    </select>
                </div>
            </div>
            
            <div class="files-list" style="display: grid; gap: 1rem;">
                ${complexityData.fileAnalysis
        .map(
            (file) => `
                    <div class="file-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${file.name}</h4>
                                    <span class="complexity-badge complexity-${getComplexityLevel(file.complexity)}">
                                        Complexity: ${file.complexity}
                                    </span>
                                    ${file.maintainabilityIndex === 0 ? '<span class="maintainability-badge critical">Low Maintainability</span>' : ''}
                                </div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${file.path}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="display: flex; gap: 1rem; font-size: 0.9rem;">
                                    <span style="color: var(--text-secondary);">
                                        <i class="fas fa-code"></i> ${file.lines} lines
                                    </span>
                                    <span style="color: var(--text-secondary);">
                                        <i class="fas fa-function"></i> ${file.functions} functions
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${file.complexity}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Complexity</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: ${getComplexityColor(file.cyclomaticComplexity)}; font-weight: bold; font-size: 0.9rem;">${file.cyclomaticComplexity}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Cyclomatic</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: ${getMaintainabilityColor(file.maintainabilityIndex)}; font-weight: bold; font-size: 0.9rem;">${file.maintainabilityIndex}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Maintainability</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: ${getIssuesColor(file.issues)}; font-weight: bold; font-size: 0.9rem;">${file.issues}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Issues</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem;">
                                <button class="btn btn-sm btn-secondary" onclick="viewFileDetails('${file.name}')">
                                    <i class="fas fa-eye"></i> View Details
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="refactorFile('${file.name}')">
                                    <i class="fas fa-tools"></i> Refactor
                                </button>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">
                                Last analyzed: ${new Date(complexityData.overallMetrics.lastAnalyzed).toLocaleString()}
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

// Get recommendations content
function getRecommendationsContent() {
    return `
        <div class="recommendations">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Complexity Recommendations</h3>
            <div class="recommendations-list" style="display: grid; gap: 1rem;">
                ${complexityData.recommendations
        .map(
            (rec) => `
                    <div class="recommendation-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; border-left: 4px solid ${getRecommendationColor(rec.type)};">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">${rec.title}</h4>
                                <p style="color: var(--text-secondary); margin: 0;">${rec.description}</p>
                            </div>
                            <span class="priority-badge priority-${rec.type}">${rec.type.replace('_', ' ')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem; font-size: 0.9rem;">
                                <span style="color: var(--text-secondary);">
                                    <i class="fas fa-chart-line"></i> Impact: ${rec.impact}
                                </span>
                                <span style="color: var(--text-secondary);">
                                    <i class="fas fa-clock"></i> Effort: ${rec.effort}
                                </span>
                            </div>
                            <div>
                                <button class="btn btn-sm btn-primary" onclick="implementRecommendation('${rec.title}')">
                                    <i class="fas fa-play"></i> Implement
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

// Get hotspots content
function getHotspotsContent() {
    const hotspots = complexityData.fileAnalysis.filter(
        (file) => file.complexity >= 8 || file.cyclomaticComplexity >= 50
    );

    return `
        <div class="hotspots">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Complexity Hotspots</h3>
            <div class="hotspots-list" style="display: grid; gap: 1rem;">
                ${hotspots
        .map(
            (file) => `
                    <div class="hotspot-card" style="background: var(--card-bg); border: 2px solid var(--danger-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <div style="font-size: 2rem; color: var(--danger-color);">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${file.name}</h4>
                                <p style="color: var(--text-secondary); margin: 0;">Critical complexity detected</p>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 6px;">
                                <div style="color: var(--danger-color); font-weight: bold; font-size: 1.2rem;">${file.complexity}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Complexity Score</div>
                            </div>
                            <div style="text-align: center; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 6px;">
                                <div style="color: var(--danger-color); font-weight: bold; font-size: 1.2rem;">${file.cyclomaticComplexity}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Cyclomatic</div>
                            </div>
                            <div style="text-align: center; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 6px;">
                                <div style="color: var(--danger-color); font-weight: bold; font-size: 1.2rem;">${file.issues}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Issues</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            <button class="btn btn-sm btn-danger" onclick="immediateRefactor('${file.name}')">
                                <i class="fas fa-tools"></i> Immediate Refactor
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="analyzeFurther('${file.name}')">
                                <i class="fas fa-search"></i> Analyze Further
                            </button>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get metrics content
function getMetricsContent() {
    return `
        <div class="metrics">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Complexity Metrics</h3>
            <div class="metrics-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem;">
                <div class="metric-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Cyclomatic Complexity</h4>
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">Average</span>
                            <span style="color: var(--text-primary); font-weight: bold;">47.8</span>
                        </div>
                        <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: 65%; background: var(--warning-color); border-radius: 3px;"></div>
                        </div>
                    </div>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Measures the number of linearly independent paths through code</p>
                </div>
                
                <div class="metric-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Maintainability Index</h4>
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">Average</span>
                            <span style="color: var(--text-primary); font-weight: bold;">12.3</span>
                        </div>
                        <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: 25%; background: var(--danger-color); border-radius: 3px;"></div>
                        </div>
                    </div>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Indicates ease of maintaining code (0-100 scale)</p>
                </div>
                
                <div class="metric-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Code Coverage</h4>
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">Coverage</span>
                            <span style="color: var(--text-primary); font-weight: bold;">73%</span>
                        </div>
                        <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: 73%; background: var(--success-color); border-radius: 3px;"></div>
                        </div>
                    </div>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Percentage of code covered by tests</p>
                </div>
                
                <div class="metric-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Technical Debt</h4>
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">Hours</span>
                            <span style="color: var(--text-primary); font-weight: bold;">142h</span>
                        </div>
                        <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: 45%; background: var(--primary-color); border-radius: 3px;"></div>
                        </div>
                    </div>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Estimated effort to fix all issues</p>
                </div>
            </div>
        </div>
    `;
}

// Helper functions
function getComplexityLevel(complexity) {
    if (complexity <= 3) {
        return 'low';
    }
    if (complexity <= 7) {
        return 'medium';
    }
    return 'high';
}

function getComplexityColor(value) {
    if (value <= 10) {
        return 'var(--success-color)';
    }
    if (value <= 50) {
        return 'var(--warning-color)';
    }
    return 'var(--danger-color)';
}

function getMaintainabilityColor(value) {
    if (value >= 70) {
        return 'var(--success-color)';
    }
    if (value >= 40) {
        return 'var(--warning-color)';
    }
    return 'var(--danger-color)';
}

function getIssuesColor(value) {
    if (value === 0) {
        return 'var(--success-color)';
    }
    if (value <= 3) {
        return 'var(--warning-color)';
    }
    return 'var(--danger-color)';
}

function getRecommendationColor(type) {
    switch (type) {
    case 'high_priority':
        return 'var(--danger-color)';
    case 'medium_priority':
        return 'var(--warning-color)';
    case 'low_priority':
        return 'var(--success-color)';
    default:
        return 'var(--primary-color)';
    }
}

// Tab switching
function _showComplexityTab(tabName) {
    const content = document.getElementById('complexity-tab-content');
    if (!content) {
        return;
    }

    // Update tab buttons
    document.querySelectorAll('.complexity-tabs .tab-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });

    event.target.classList.add('active');
    event.target.style.color = 'var(--primary-color)';
    event.target.style.borderBottom = '2px solid var(--primary-color)';

    // Update content
    switch (tabName) {
    case 'files':
        content.textContent = getFileAnalysisContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'recommendations':
        content.textContent = getRecommendationsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'hotspots':
        content.textContent = getHotspotsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'metrics':
        content.textContent = getMetricsContent() /* Replaced innerHTML with textContent for safety */
        break;
    }
}

// Action functions
function _runComplexityAnalysis() {
    console.log('Running complexity analysis...');
    alert('Complexity analysis would run here, analyzing all project files');
}

function _exportComplexityReport() {
    console.log('Exporting complexity report...');
    alert('Complexity report would be exported as PDF/Excel');
}

function _refreshComplexityData() {
    console.log('Refreshing complexity data...');
    location.reload();
}

function _filterComplexityFiles(filter) {
    console.log('Filtering files by complexity:', filter);
    // Implementation would filter the file list
}

function _viewFileDetails(fileName) {
    console.log('Viewing file details:', fileName);
    alert(`Detailed analysis for ${fileName} would be shown here`);
}

function _refactorFile(fileName) {
    console.log('Refactoring file:', fileName);
    alert(`Refactoring suggestions for ${fileName} would be provided`);
}

function _implementRecommendation(title) {
    console.log('Implementing recommendation:', title);
    alert(`Implementation plan for "${title}" would be shown here`);
}

function _immediateRefactor(fileName) {
    console.log('Immediate refactor for:', fileName);
    alert(`Immediate refactoring actions for ${fileName} would be executed`);
}

function _analyzeFurther(fileName) {
    console.log('Analyzing further:', fileName);
    alert(`Detailed analysis for ${fileName} would be performed`);
}

// Add styles for complexity badges
if (!document.getElementById('complexity-styles')) {
    const style = document.createElement('style');
    style.id = 'complexity-styles';
    style.textContent = `
.complexity-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
}

.complexity-low {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.complexity-medium {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.complexity-high {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.maintainability-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
}

.maintainability-badge.critical {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}
`;
    document.head.appendChild(style);
}

console.log('✅ Complexity Analysis module loaded');
