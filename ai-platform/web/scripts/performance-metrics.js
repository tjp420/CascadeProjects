// Performance Metrics Module
console.log('📊 Performance Metrics module loading...');

// Mock performance data
const performanceData = {
    overallMetrics: {
        avgResponseTime: 4.2,
        throughput: 1250,
        errorRate: 0.8,
        uptime: 99.7,
        cpuUsage: 45,
        memoryUsage: 67,
        diskUsage: 23,
        networkLatency: 12,
        lastUpdated: '2024-05-20T13:25:00',
    },
    responseTimeHistory: [
        { timestamp: '13:00', value: 3.8 },
        { timestamp: '13:05', value: 4.1 },
        { timestamp: '13:10', value: 3.9 },
        { timestamp: '13:15', value: 4.5 },
        { timestamp: '13:20', value: 4.2 },
        { timestamp: '13:25', value: 4.2 },
    ],
    endpoints: [
        {
            name: 'API Health Check',
            path: '/health',
            avgResponseTime: 0.8,
            requests: 1250,
            errorRate: 0,
            status: 'healthy',
            lastResponse: '2024-05-20T13:25:30',
        },
        {
            name: 'Backup API',
            path: '/api/backup/*',
            avgResponseTime: 2.3,
            requests: 450,
            errorRate: 0.2,
            status: 'healthy',
            lastResponse: '2024-05-20T13:25:15',
        },
        {
            name: 'Dashboard Load',
            path: '/dashboard/*',
            avgResponseTime: 1.5,
            requests: 890,
            errorRate: 0.1,
            status: 'healthy',
            lastResponse: '2024-05-20T13:25:45',
        },
        {
            name: 'Export Service',
            path: '/api/export/*',
            avgResponseTime: 8.7,
            requests: 125,
            errorRate: 2.4,
            status: 'degraded',
            lastResponse: '2024-05-20T13:24:30',
        },
        {
            name: 'Analysis Engine',
            path: '/api/analysis/*',
            avgResponseTime: 12.3,
            requests: 85,
            errorRate: 1.2,
            status: 'slow',
            lastResponse: '2024-05-20T13:25:00',
        },
    ],
    systemResources: {
        cpu: {
            current: 45,
            average: 42,
            peak: 78,
            cores: 8,
        },
        memory: {
            current: 67,
            total: 16000,
            available: 5280,
            used: 10720,
        },
        disk: {
            current: 23,
            total: 500000,
            available: 385000,
            used: 115000,
        },
        network: {
            inbound: 2.5,
            outbound: 3.8,
            latency: 12,
            packetsLost: 0.1,
        },
    },
    alerts: [
        {
            type: 'warning',
            title: 'Export Service Slow Response',
            description: 'Export API showing degraded performance with 8.7s average response time',
            timestamp: '2024-05-20T13:20:00',
            severity: 'medium',
        },
        {
            type: 'info',
            title: 'Memory Usage Above Threshold',
            description: 'Memory usage at 67% - consider optimizing or scaling',
            timestamp: '2024-05-20T13:15:00',
            severity: 'low',
        },
    ],
    recommendations: [
        {
            priority: 'high',
            title: 'Optimize Export Service',
            description:
        'Export API showing slow response times. Consider implementing caching or async processing.',
            impact: 'High',
            effort: 'Medium',
        },
        {
            priority: 'medium',
            title: 'Scale Memory Resources',
            description:
        'Memory usage consistently above 60%. Consider adding more RAM or optimizing memory usage.',
            impact: 'Medium',
            effort: 'Low',
        },
        {
            priority: 'low',
            title: 'Monitor Network Latency',
            description: 'Network latency slightly elevated. Monitor for potential network issues.',
            impact: 'Low',
            effort: 'Low',
        },
    ],
};

// Show performance metrics
function _showPerformanceMetrics(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-tachometer-alt"></i> Performance Metrics
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="runPerformanceTest()">
                        <i class="fas fa-play"></i> Run Test
                    </button>
                    <button class="btn btn-secondary" onclick="exportPerformanceReport()">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                    <button class="btn btn-secondary" onclick="refreshPerformanceData()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <!-- Key Performance Indicators -->
            <div class="kpi-overview" style="margin-bottom: 2rem;">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${performanceData.overallMetrics.avgResponseTime}s</div>
                        <div class="stat-label">Avg Response Time</div>
                        <div class="stat-change" style="color: var(--success-color);">-0.3s improvement</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${performanceData.overallMetrics.throughput}</div>
                        <div class="stat-label">Requests/min</div>
                        <div class="stat-change">+12% increase</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${performanceData.overallMetrics.errorRate}%</div>
                        <div class="stat-label">Error Rate</div>
                        <div class="stat-change" style="color: var(--success-color);">-0.2% improvement</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${performanceData.overallMetrics.uptime}%</div>
                        <div class="stat-label">Uptime</div>
                        <div class="stat-change" style="color: var(--success-color);">Excellent</div>
                    </div>
                </div>
            </div>
            
            <!-- Performance Tabs -->
            <div class="performance-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showPerformanceTab('overview')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Overview
                    </button>
                    <button class="tab-btn" onclick="showPerformanceTab('endpoints')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Endpoints
                    </button>
                    <button class="tab-btn" onclick="showPerformanceTab('resources')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Resources
                    </button>
                    <button class="tab-btn" onclick="showPerformanceTab('alerts')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Alerts
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="performance-tab-content">
                ${getOverviewContent()}
            </div>
        </div>
    `;
}

// Get overview content
function getOverviewContent() {
    return `
        <div class="performance-overview">
            <!-- Response Time Chart -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                <div class="chart-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Response Time Trend</h3>
                    <div style="height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                        <div style="text-align: center;">
                            <i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <p>Response time chart would be rendered here</p>
                            <p style="font-size: 0.9rem;">Showing average response times over the last hour</p>
                        </div>
                    </div>
                </div>
                
                <div class="system-health" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">System Health</h3>
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0;">
                            <span style="color: var(--text-secondary);">CPU Usage</span>
                            <span style="color: ${getPerformanceColor(performanceData.overallMetrics.cpuUsage)}; font-weight: bold;">${performanceData.overallMetrics.cpuUsage}%</span>
                        </div>
                        <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${performanceData.overallMetrics.cpuUsage}%; background: ${getPerformanceColor(performanceData.overallMetrics.cpuUsage)}; border-radius: 3px;"></div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0;">
                            <span style="color: var(--text-secondary);">Memory Usage</span>
                            <span style="color: ${getPerformanceColor(performanceData.overallMetrics.memoryUsage)}; font-weight: bold;">${performanceData.overallMetrics.memoryUsage}%</span>
                        </div>
                        <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${performanceData.overallMetrics.memoryUsage}%; background: ${getPerformanceColor(performanceData.overallMetrics.memoryUsage)}; border-radius: 3px;"></div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0;">
                            <span style="color: var(--text-secondary);">Disk Usage</span>
                            <span style="color: var(--success-color); font-weight: bold;">${performanceData.overallMetrics.diskUsage}%</span>
                        </div>
                        <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${performanceData.overallMetrics.diskUsage}%; background: var(--success-color); border-radius: 3px;"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Quick Stats -->
            <div class="quick-stats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 1.5rem; color: var(--success-color); font-weight: bold;">99.7%</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Uptime</div>
                </div>
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 1.5rem; color: var(--primary-color); font-weight: bold;">12ms</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Network Latency</div>
                </div>
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 1.5rem; color: var(--warning-color); font-weight: bold;">2.5MB/s</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Inbound Traffic</div>
                </div>
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 1.5rem; color: var(--primary-color); font-weight: bold;">3.8MB/s</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Outbound Traffic</div>
                </div>
            </div>
            
            <!-- Recent Recommendations -->
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Performance Recommendations</h3>
                <div style="display: grid; gap: 1rem;">
                    ${performanceData.recommendations
        .slice(0, 2)
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

// Get endpoints content
function getEndpointsContent() {
    return `
        <div class="endpoints-analysis">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">API Endpoint Performance</h3>
                <div>
                    <select onchange="filterEndpoints(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Endpoints</option>
                        <option value="healthy">Healthy</option>
                        <option value="degraded">Degraded</option>
                        <option value="slow">Slow</option>
                    </select>
                </div>
            </div>
            
            <div class="endpoints-list" style="display: grid; gap: 1rem;">
                ${performanceData.endpoints
        .map(
            (endpoint) => `
                    <div class="endpoint-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${endpoint.name}</h4>
                                    <span class="status-badge status-${endpoint.status}">${endpoint.status}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${endpoint.path}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.25rem; font-weight: bold; color: ${getResponseTimeColor(endpoint.avgResponseTime)};">${endpoint.avgResponseTime}s</div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Avg Response</p>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${endpoint.requests}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Requests</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: ${getErrorRateColor(endpoint.errorRate)}; font-weight: bold; font-size: 0.9rem;">${endpoint.errorRate}%</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Error Rate</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${(endpoint.requests / endpoint.avgResponseTime).toFixed(0)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Req/sec</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${formatTimestamp(endpoint.lastResponse)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Last Response</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem;">
                                <button class="btn btn-sm btn-secondary" onclick="viewEndpointDetails('${endpoint.path}')">
                                    <i class="fas fa-chart-line"></i> Details
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="testEndpoint('${endpoint.path}')">
                                    <i class="fas fa-play"></i> Test
                                </button>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">
                                Status: ${endpoint.status}
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

// Get resources content
function getResourcesContent() {
    return `
        <div class="system-resources">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">System Resources</h3>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem;">
                <!-- CPU Resources -->
                <div class="resource-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">
                        <i class="fas fa-microchip"></i> CPU Usage
                    </h4>
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary);">Current Usage</span>
                            <span style="color: ${getPerformanceColor(performanceData.systemResources.cpu.current)}; font-weight: bold;">${performanceData.systemResources.cpu.current}%</span>
                        </div>
                        <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${performanceData.systemResources.cpu.current}%; background: ${getPerformanceColor(performanceData.systemResources.cpu.current)}; border-radius: 4px;"></div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.9rem;">
                        <div style="text-align: center;">
                            <div style="color: var(--text-primary); font-weight: bold;">${performanceData.systemResources.cpu.average}%</div>
                            <div style="color: var(--text-secondary);">Average</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: var(--warning-color); font-weight: bold;">${performanceData.systemResources.cpu.peak}%</div>
                            <div style="color: var(--text-secondary);">Peak</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: var(--text-primary); font-weight: bold;">${performanceData.systemResources.cpu.cores}</div>
                            <div style="color: var(--text-secondary);">Cores</div>
                        </div>
                    </div>
                </div>
                
                <!-- Memory Resources -->
                <div class="resource-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">
                        <i class="fas fa-memory"></i> Memory Usage
                    </h4>
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary);">Current Usage</span>
                            <span style="color: ${getPerformanceColor(performanceData.systemResources.memory.current)}; font-weight: bold;">${performanceData.systemResources.memory.current}%</span>
                        </div>
                        <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${performanceData.systemResources.memory.current}%; background: ${getPerformanceColor(performanceData.systemResources.memory.current)}; border-radius: 4px;"></div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.9rem;">
                        <div style="text-align: center;">
                            <div style="color: var(--text-primary); font-weight: bold;">${formatMemorySize(performanceData.systemResources.memory.used)}</div>
                            <div style="color: var(--text-secondary);">Used</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: var(--success-color); font-weight: bold;">${formatMemorySize(performanceData.systemResources.memory.available)}</div>
                            <div style="color: var(--text-secondary);">Available</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: var(--text-primary); font-weight: bold;">${formatMemorySize(performanceData.systemResources.memory.total)}</div>
                            <div style="color: var(--text-secondary);">Total</div>
                        </div>
                    </div>
                </div>
                
                <!-- Disk Resources -->
                <div class="resource-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">
                        <i class="fas fa-hdd"></i> Disk Usage
                    </h4>
                    <div style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary);">Current Usage</span>
                            <span style="color: var(--success-color); font-weight: bold;">${performanceData.systemResources.disk.current}%</span>
                        </div>
                        <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${performanceData.systemResources.disk.current}%; background: var(--success-color); border-radius: 4px;"></div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.9rem;">
                        <div style="text-align: center;">
                            <div style="color: var(--text-primary); font-weight: bold;">${formatMemorySize(performanceData.systemResources.disk.used)}</div>
                            <div style="color: var(--text-secondary);">Used</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: var(--success-color); font-weight: bold;">${formatMemorySize(performanceData.systemResources.disk.available)}</div>
                            <div style="color: var(--text-secondary);">Available</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="color: var(--text-primary); font-weight: bold;">${formatMemorySize(performanceData.systemResources.disk.total)}</div>
                            <div style="color: var(--text-secondary);">Total</div>
                        </div>
                    </div>
                </div>
                
                <!-- Network Resources -->
                <div class="resource-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">
                        <i class="fas fa-network-wired"></i> Network
                    </h4>
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text-secondary);">Inbound Traffic</span>
                            <span style="color: var(--primary-color); font-weight: bold;">${performanceData.systemResources.network.inbound} MB/s</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text-secondary);">Outbound Traffic</span>
                            <span style="color: var(--primary-color); font-weight: bold;">${performanceData.systemResources.network.outbound} MB/s</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text-secondary);">Latency</span>
                            <span style="color: ${getPerformanceColor(performanceData.systemResources.network.latency)}; font-weight: bold;">${performanceData.systemResources.network.latency}ms</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--text-secondary);">Packet Loss</span>
                            <span style="color: var(--success-color); font-weight: bold;">${performanceData.systemResources.network.packetsLost}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Get alerts content
function getAlertsContent() {
    return `
        <div class="performance-alerts">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Performance Alerts</h3>
                <div>
                    <select onchange="filterAlerts(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Alerts</option>
                        <option value="critical">Critical</option>
                        <option value="warning">Warning</option>
                        <option value="info">Info</option>
                    </select>
                </div>
            </div>
            
            <div class="alerts-list" style="display: grid; gap: 1rem;">
                ${performanceData.alerts
        .map(
            (alert) => `
                    <div class="alert-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; border-left: 4px solid ${getAlertColor(alert.type)};">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${alert.title}</h4>
                                    <span class="alert-badge alert-${alert.type}">${alert.type}</span>
                                    <span class="severity-badge severity-${alert.severity}">${alert.severity}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${alert.description}</p>
                            </div>
                            <div style="text-align: right; margin-left: 1rem;">
                                <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">${formatTimestamp(alert.timestamp)}</p>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem;">
                                <button class="btn btn-sm btn-secondary" onclick="acknowledgeAlert('${alert.title}')">
                                    <i class="fas fa-check"></i> Acknowledge
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="investigateAlert('${alert.title}')">
                                    <i class="fas fa-search"></i> Investigate
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

// Helper functions
function getPerformanceColor(value) {
    if (value <= 50) {
        return 'var(--success-color)';
    }
    if (value <= 75) {
        return 'var(--warning-color)';
    }
    return 'var(--danger-color)';
}

function getResponseTimeColor(value) {
    if (value <= 1) {
        return 'var(--success-color)';
    }
    if (value <= 3) {
        return 'var(--primary-color)';
    }
    if (value <= 5) {
        return 'var(--warning-color)';
    }
    return 'var(--danger-color)';
}

function getErrorRateColor(value) {
    if (value === 0) {
        return 'var(--success-color)';
    }
    if (value <= 1) {
        return 'var(--warning-color)';
    }
    return 'var(--danger-color)';
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

function getAlertColor(type) {
    switch (type) {
    case 'critical':
        return 'var(--danger-color)';
    case 'warning':
        return 'var(--warning-color)';
    case 'info':
        return 'var(--primary-color)';
    default:
        return 'var(--text-secondary)';
    }
}

function formatMemorySize(bytes) {
    if (bytes >= 1000000) {
        return (bytes / 1000000).toFixed(1) + 'GB';
    } else if (bytes >= 1000) {
        return (bytes / 1000).toFixed(1) + 'MB';
    }
    return bytes + 'B';
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}

// Tab switching
function _showPerformanceTab(tabName) {
    const content = document.getElementById('performance-tab-content');
    if (!content) {
        return;
    }

    // Update tab buttons
    document.querySelectorAll('.performance-tabs .tab-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });

    event.target.classList.add('active');
    event.target.style.color = 'var(--primary-color)';
    event.target.style.borderBottom = '2px solid var(--primary-color)';

    // Update content
    switch (tabName) {
    case 'overview':
        content.textContent = getOverviewContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'endpoints':
        content.textContent = getEndpointsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'resources':
        content.textContent = getResourcesContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'alerts':
        content.textContent = getAlertsContent() /* Replaced innerHTML with textContent for safety */
        break;
    }
}

// Action functions
function _runPerformanceTest() {
    console.log('Running performance test...');
    alert('Performance test would run here, testing all endpoints and system resources');
}

function _exportPerformanceReport() {
    console.log('Exporting performance report...');
    alert('Performance report would be exported as PDF/Excel with all metrics');
}

function _refreshPerformanceData() {
    console.log('Refreshing performance data...');
    location.reload();
}

function _filterEndpoints(filter) {
    console.log('Filtering endpoints:', filter);
    // Implementation would filter the endpoint list
}

function _viewEndpointDetails(path) {
    console.log('Viewing endpoint details:', path);
    alert(`Detailed performance metrics for ${path} would be shown here`);
}

function _testEndpoint(path) {
    console.log('Testing endpoint:', path);
    alert(`Performance test for ${path} would be executed here`);
}

function _filterAlerts(filter) {
    console.log('Filtering alerts:', filter);
    // Implementation would filter the alert list
}

function _acknowledgeAlert(title) {
    console.log('Acknowledging alert:', title);
    alert(`Alert "${title}" would be acknowledged and marked as resolved`);
}

function _investigateAlert(title) {
    console.log('Investigating alert:', title);
    alert(`Investigation details for "${title}" would be shown here`);
}

// Add styles for performance badges
if (!document.getElementById('performance-styles')) {
    const style = document.createElement('style');
    style.id = 'performance-styles';
    style.textContent = `
.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.status-healthy {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.status-degraded {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.status-slow {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.alert-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.alert-critical {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.alert-warning {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.alert-info {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.severity-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
}

.severity-high {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.severity-medium {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.severity-low {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}
`;
    document.head.appendChild(style);
}

console.log('✅ Performance Metrics module loaded');
