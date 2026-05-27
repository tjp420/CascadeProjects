/**
 * Technical Debt Dashboard Component
 * 
 * Real-time technical debt monitoring with trend visualization,
 * debt reduction tracking, and comprehensive reporting capabilities
 */

class DebtDashboard {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = options;
    this.isInitialized = false;
    this.chartInstances = new Map();
    this.refreshInterval = options.refreshInterval || 30000; // 30 seconds
    this.maxDataPoints = options.maxDataPoints || 100;
    this.isAutoRefreshEnabled = options.autoRefresh !== false;
    
    console.log(`[DEBT_DASHBOARD] Debt dashboard initialized for container: ${containerId}`);
  }

  // Initialize dashboard
  async initialize() {
    if (this.isInitialized) {
      console.log('[DEBT_DASHBOARD] Dashboard already initialized');
      return;
    }

    try {
      // Create dashboard structure
      this.createDashboardStructure();
      
      // Initialize charts
      this.initializeCharts();
      
      // Start real-time updates
      this.startRealTimeUpdates();
      
      // Load initial data
      await this.loadInitialData();
      
      this.isInitialized = true;
      console.log('[DEBT_DASHBOARD] Dashboard initialized successfully');
      
    } catch (error) {
      console.error('[DEBT_DASHBOARD] Failed to initialize dashboard:', error.message);
      throw error;
    }
  }

  // Create dashboard structure
  createDashboardStructure() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      throw new Error(`Container not found: ${this.containerId}`);
    }

    container.textContent = `
      <div class="debt-dashboard">
        <div class="dashboard-header">
          <h2>📊 Technical Debt Dashboard</h2>
          <div class="dashboard-controls">
            <button class="btn btn-primary" onclick="debtDashboard.refreshData()">
              🔄 Refresh Data
            </button>
            <button class="btn btn-secondary" onclick="debtDashboard.exportReport()">
              📄 Export Report
            </button>
            <button class="btn btn-info" onclick="debtDashboard.toggleAutoRefresh()">
              🔄 Auto Refresh: <span id="auto-refresh-status">OFF</span>
            </button>
          </div>
          <div class="dashboard-stats">
            <div class="stat-card">
              <div class="stat-value" id="overall-score">--</div>
              <div class="stat-label">Overall Score</div>
            </div>
            <tdiv class="stat-card">
              <div class="stat-value" id="trend-indicator">--</div>
              <div class="stat-label">Trend</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="critical-count">0</div>
              <div class="stat-label">Critical Issues</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="reduction-progress">0%</div>
              <div class="stat-label">Reduction Progress</div>
            </div>
          </div>
        </div>

        <div class="dashboard-content">
          <div class="dashboard-section">
            <h3>📈 Debt by Category</h3>
            <div class="category-grid">
              <div class="category-card complexity">
                <div class="category-header">
                  <h4>Complexity</h4>
                  <div class="category-score" id="complexity-score">--</div>
                  <div class="category-trend" id="complexity-trend">--</div>
                </div>
                <div class="category-details">
                  <div class="category-factors">
                    <div class="factor">
                      <span class="factor-name">Cyclomatic Complexity</span>
                      <span class="factor-score" id="complexity-cyclomatic">--</span>
                    </div>
                    <div class="factor">
                      <span class="factor-name">Maintainability Index</span>
                      <span class="factor-score" id="complexity-maintainability">--</span>
                    </div>
                    <div class="factor">
                      <span class="factor-name">Code Duplication</span>
                      <span class="factor-score" id="complexity-duplication">--</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="category-card quality">
                <div class="category-header">
                  <h4>Quality</h4>
                  <div class="category-score" id="quality-score">--</div>
                  <div class="category-trend" id="quality-trend">--</div>
                </div>
                <div class="category-details">
                  <div class="category-factors">
                    <div class="factor">
                      <span class="factor-name">Test Coverage</span>
                      <span class="factor-score" id="quality-test-coverage">--</span>
                    </div>
                    <div class="factor">
                      <span class="factor-name">Documentation</span>
                      <span class="factor-score" id="quality-documentation">--</span>
                    </div>
                    <div class="factor">
                      <span class="factor-name">Standards Compliance</span>
                      <span class="factor-score" id="quality-standards">--</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="category-card security">
                <div class="category-header">
                  <h4>Security</h4>
                  <div class="category-score" id="security-score">--</div>
                  <div class="category-trend" id="security-trend">--</div>
                </div>
                <div class="category-details">
                  <div class="category-factors">
                    <div class="factor">
                      <span class="factor-name">Vulnerabilities</span>
                      <span class="factor-score" id="security-vulnerabilities">--</span>
                    </div>
                    <div class="factor">
                      <span class="factor-name">Security Tests</span>
                      <span class="factor-score" id="security-tests">--</span>
                    </div>
                    <div class="factor">
                      <span class="factor-name">Compliance Gaps</span>
                      <span class="factor-score" id="security-compliance">--</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="category-card performance">
                <div class="category-header">
                  <h4>Performance</h4>
                  <div class="category-score" id="performance-score">--</div>
                  <div class="category-trend" id="performance-trend">--</div>
                </div>
                <div class="category-details">
                  <div class="category-factors">
                    <div class="factor">
                      <span class="factor-name">Response Time</span>
                      <span class="factor-score" id="performance-response-time">--</span>
                    </div>
                    <div class="factor">
                      <span class="factor-name">Memory Usage</span>
                      <span class="factor-score" id="performance-memory-usage">--</span>
                    </div>
                    <div class="factor">
                      <span class="factor-name">Scalability Issues</span>
                      <span class="factor-score" id="performance-scalability">--</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="category-card architecture">
                <div class="category-header">
                  <h4>Architecture</h4>
                  <div class="category-score" id="architecture-score">--</div>
                  <div class="category-trend" id="architecture-trend">--</div>
                </div>
                <div class="category-details">
                  <div class="category-factors">
                    <div class="factor">
                      <span class="factor-name">Design Patterns</span>
                      <span class="factor-score" id="architecture-design-patterns">--</span>
                    </div>
                    <div class="factor">
                      <span class="factor-name">Modularity</span>
                      <span class="factor-score" id="architecture-modularity">--</span>
                    </div>
                    <div class="factor">
                      <span class="factor-name">Coupling</span>
                      <span class="factor-score" id="architecture-coupling">--</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="dashboard-section">
            <h3>📊 Debt Trends</h3>
            <div class="trend-container">
              <div class="trend-chart-container">
                <canvas id="debt-trend-chart"></canvas>
              </div>
            </div>
          </div>

          <div class="dashboard-section">
            <h3>📋 Reduction Progress</h3>
            <div class="progress-container">
              <div class="progress-list" id="reduction-progress-list">
                <!-- Progress items will be added dynamically -->
              </div>
            </div>
          </div>

          <div class="dashboard-section">
            <h3>📋 Recommendations</h3>
            <div class="recommendations-list" id="recommendations-list">
              <!-- Recommendations will be added dynamically -->
            </div>
          </div>
        </div>

        <div class="dashboard-footer">
          <div class="footer-info">
            <span id="last-update">Last updated: --</span>
            <span id="data-points">Data points: --</span>
          </div>
        </div>
      </div>
    ` /* Replaced innerHTML with textContent for safety */

    // Add CSS styles
    if (!document.getElementById('debt-dashboard-styles')) {
      const style = document.createElement('style');
      style.id = 'debt-dashboard-styles';
      style.textContent = `
        .debt-dashboard {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);
          color: #ffffff;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .dashboard-controls {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: #4ECDC4;
          color: white;
        }

        .btn-secondary {
          background: #6B7280;
          color: white;
        }

        .btn-info {
          background: #17A2B8;
          color: white;
        }

        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .dashboard-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.1);
          padding: 16px;
          border-radius: 8px;
          text-align: center;
          min-width: 100px;
          backdrop-filter: blur(10px);
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 12px;
          opacity: 0.8;
        }

        .dashboard-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }

        .dashboard-section {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .dashboard-section h3 {
          margin-bottom: 16px;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .category-card {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          backdrop-filter: blur(10px);
        }

        .category-header {
          margin-bottom: 12px;
        }

        .category-header h4 {
          margin: 0;
          color: #ffffff;
          font-size: 16px;
        }

        .category-score, .category-trend {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 4px;
        }

        .category-details {
          margin-top: 12px;
        }

        .category-factors {
          display: grid;
          gap: 8px;
          font-size: 12px;
        }

        .factor {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
        }

        .factor-name {
          color: rgba(255, 255, 255, 0.8);
          font-size: 11px;
        }

        .factor-score {
          color: #ffffff;
          font-weight: bold;
          font-size: 12px;
        }

        .trend-container {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          height: 300px;
          position: relative;
        }

        #debt-trend-chart {
          width: 100%;
          height: 100%;
          display: block;
        }

        .progress-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .progress-item {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 8px;
          border-left: 4px solid #4CAF50;
        }

        .progress-item.high {
          border-left-color: #F44336;
        }

        .progress-item.medium {
          border-left-color: #FF9800;
        }

        .progress-item.low {
          border-left-color: #FFC107;
        }

        .progress-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .progress-item-title {
          font-weight: 500;
          color: #ffffff;
        }

        .progress-item-progress {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
        }

        .recommendations-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .recommendation-item {
          background: rgba(255, 255, 255, 0.1);
          border-left: 4px solid #4CAF50;
          padding: 12px;
          margin-bottom: 8px;
          border-radius: 4px;
        }

        .recommendation-item.critical {
          border-left-color: #F44336;
        }

        .recommendation-item.high {
          border-left-color: #FF9800;
        }

        .recommendation-item.medium {
          border-left-color: #FFC107;
        }

        .recommendation-item.low {
          border-left-color: #4CAF50;
        }

        .recommendation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .recommendation-title {
          font-weight: 500;
          color: #ffffff;
        }

        .recommendation-description {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
        }

        .no-data {
          text-align: center;
          opacity: 0.6;
          padding: 40px;
        }

        .dashboard-footer {
          display: flex;
          justify-content: space-between;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          font-size: 12px;
          opacity: 0.8;
        }

        .footer-info span {
          margin-right: 20px;
        }

        .trend-up {
          color: #4CAF50;
        }

        .trend-down {
          color: #F44336;
        }

        .trend-stable {
          color: #FFC107;
        }

        .trend-improving::before {
          content: '📈';
          margin-right: 4px;
        }

        .trend-declining::before {
          content: '📉';
          margin-right: 4px;
        }

        .trend-stable::before {
          content: '➡️';
          margin-right: 4px;
        }

        .trend-up::after {
          content: '📈';
          margin-left: 4px;
        }

        .trend-down::after {
          content: '📉';
          margin-left: 4px;
        }

        .trend-stable::after {
          content: '➡️';
          margin-left: 4px;
        }
      `;
      
      document.head.appendChild(style);
    }
  }

  // Initialize charts
  initializeCharts() {
    // Initialize trend chart
    const canvas = document.getElementById('debt-trend-chart');
    if (canvas) {
      this.chartInstances.set('trend', { canvas });
    }
    
    console.log(`[DEBT_DASHBOARD] Initialized ${this.chartInstances.size} charts`);
  }

  // Start real-time updates
  startRealTimeUpdates() {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
    }

    this.updateIntervalId = setInterval(() => {
      this.refreshData();
    }, this.refreshInterval);

    this.isAutoRefreshEnabled = true;
    document.getElementById('auto-refresh-status').textContent = 'ON';
    
    console.log(`[DEBT_DASHBOARD] Real-time updates started (${this.refreshInterval}ms interval)`);
  }

  // Stop real-time updates
  stopRealTimeUpdates() {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }

    this.isAutoRefreshEnabled = false;
    document.getElementById('auto-refresh-status').textContent = 'OFF';
    
    console.log('[DEBT_DASHBOARD] Real-time updates stopped');
  }

  // Toggle auto refresh
  toggleAutoRefresh() {
    if (this.isAutoRefreshEnabled) {
      this.stopRealTimeUpdates();
    } else {
      this.startRealTimeUpdates();
    }
  }

  // Refresh data
  async refreshData() {
    try {
      // In a real implementation, this would fetch from the technical debt calculator
      const mockData = this.generateMockData();
      
      // Update dashboard with new data
      this.updateDashboard(mockData);
      
      console.log('[DEBT_DASHBOARD] Data refreshed successfully');
      
    } catch (error) {
      console.error('[DEBT_DASHBOARD] Error refreshing data:', error.message);
    }
  }

  // Generate mock data for demonstration
  generateMockData() {
    const now = new Date();
    
    return {
      timestamp: now.toISOString(),
      summary: {
        totalScore: 45.2,
        grade: 'acceptable',
        criticalIssues: 3,
        highIssues: 8,
        mediumIssues: 12,
        lowIssues: 5,
        totalIssues: 28
      },
      categories: {
        complexity: {
          score: 65.5,
          grade: 'acceptable',
          trend: 'improving',
          factors: {
            cyclomatic_complexity: 72,
            maintainability_index: 45,
            code_duplication: 35
          }
        },
        quality: {
          score: 38.5,
          grade: 'poor',
          trend: 'declining',
          factors: {
            test_coverage: 25,
            documentation_coverage: 15,
            standards_compliance: 30,
            error_handling: 20,
            security_tests: 15
          }
        },
        security: {
          score: 25.0,
          grade: 'poor',
          trend: 'stable',
          factors: {
            vulnerabilities: 35,
            security_tests: 15,
            compliance_gaps: 20,
            encryption_issues: 10
          }
        },
        performance: {
          score: 55.0,
          grade: 'acceptable',
          trend: 'improving',
          factors: {
            response_time: 45,
            memory_usage: 60,
            scalability_issues: 25,
            resource_leaks: 15
          }
        },
        architecture: {
          score: 70.0,
          grade: 'good',
          trend: 'stable',
          factors: {
            design_patterns: 75,
            modularity: 65,
            coupling: 40,
            documentation: 30
          }
        }
      },
      metrics: {
        totalAssessments: 150,
        averageScore: 42.8,
        criticalCount: 45,
        highCount: 120,
        mediumCount: 85,
        lowCount: 35,
        averageReduction: 15.2
      },
      recommendations: [
        {
          priority: 'high',
          action: 'Focus on resolving critical security issues',
          description: 'Security debt score of 25.0 requires immediate attention'
        },
        {
          priority: 'high',
          action: 'Improve code quality metrics',
          description: 'Quality score of 38.5 is declining, needs improvement'
        },
        {
          priority: 'medium',
          action: 'Monitor performance bottlenecks',
          description: 'Response time issues detected in performance category'
        },
        {
          priority: 'low',
          action: 'Improve architecture debt stability',
          description: 'Architecture score is good but could be enhanced'
        }
      ],
      generatedAt: now.toISOString()
    };
  }

  // Update dashboard with data
  updateDashboard(data) {
    // Update overall score
    document.getElementById('overall-score').textContent = Math.round(data.summary.totalScore);
    document.getElementById('overall-score').className = this.getScoreClass(data.summary.totalScore);

    // Update trend indicator
    const trendElement = document.getElementById('trend-indicator');
    trendElement.textContent = this.formatTrend(data.summary.trend);
    trendElement.className = `trend-${data.summary.trend}`;

    // Update critical issues count
    document.getElementById('critical-count').textContent = data.summary.criticalIssues;

    // Update reduction progress
    const progress = data.metrics.averageReduction || 0;
    document.getElementById('reduction-progress').textContent = `${Math.round(progress)}%`;

    // Update category scores
    Object.entries(data.categories).forEach(([name, category]) => {
      const scoreElement = document.getElementById(`${name}-score`);
      const trendElement = document.getElementById(`${name}-trend`);
      
      if (scoreElement) {
        scoreElement.textContent = Math.round(category.score);
        scoreElement.className = this.getScoreClass(category.score);
      }
      
      if (trendElement) {
        trendElement.textContent = this.formatTrend(category.trend);
        trendElement.className = `trend-${category.trend}`;
      }
    });

    // Update metric scores
    Object.entries(data.metrics).forEach(([name, metric]) => {
      const scoreElement = document.getElementById(`${name}-score`);
      if (scoreElement) {
        scoreElement.textContent = Math.round(metric.score);
        scoreElement.className = this.getScoreClass(metric.score);
      }
    });

    // Update recommendations
    this.updateRecommendations(data.recommendations);

    // Update footer info
    document.getElementById('last-update').textContent = `Last updated: ${new Date().toLocaleString()}`;
    document.getElementById('data-points').textContent = data.metrics.totalAssessments;

    // Draw trend chart
    this.drawTrendChart(data.history || []);

    console.log(`[DEBT_DASHBOARD] Dashboard updated with ${data.summary.totalScore} overall score`);
  }

  // Update recommendations
  updateRecommendations(recommendations) {
    const container = document.getElementById('recommendations-list');
    
    if (!recommendations || recommendations.length === 0) {
      container.textContent = '<div class="no-recommendations">No recommendations available</div>' /* Replaced innerHTML with textContent for safety */
      return;
    }

    container.textContent = '' /* Replaced innerHTML with textContent for safety */
    
    recommendations.forEach(rec => {
      const item = document.createElement('div');
      item.className = `recommendation-item ${rec.priority}`;
      item.textContent = `
        <div class="recommendation-header">
          <span class="recommendation-title">${rec.action}</span>
          <span class="recommendation-priority">${rec.priority.toUpperCase()}</span>
        </div>
        <div class="recommendation-description">${rec.description}</div>
      ` /* Replaced innerHTML with textContent for safety */
      
      container.appendChild(item);
    });
  }

  // Draw trend chart
  drawTrendChart(history) {
    const canvas = this.chartInstances.get('trend');
    if (!canvas || !history || history.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid
    this.drawGrid(ctx, width, height);
    
    // Draw trend line
    if (history.length > 1) {
      const points = history.map((item, index) => ({
        x: (index / (history.length - 1)) * width,
        y: height - (item.score / 100) * height
      }));
      
      // Draw trend line
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      
      ctx.stroke();
      
      // Draw points
      ctx.fillStyle = '#4CAF50';
      points.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  // Draw grid
  drawGrid(ctx, width, height) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 10; i++) {
      const y = (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  // Get score class for styling
  getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'acceptable';
    if (score >= 20) return 'poor';
    return 'critical';
  }

  // Format trend for display
  formatTrend(trend) {
    switch (trend) {
      case 'improving':
        return '📈';
      case 'declining':
        return '📉';
      case 'stable':
        return '➡️';
      default:
        return '➡️';
    }
  }

  // Export report
  exportReport() {
    const report = this.generateMockReport();
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `technical-debt-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    console.log('[DEBT_DASHBOARD] Technical debt report exported');
  }

  // Generate mock report for demonstration
  generateMockReport() {
    const now = new Date();
    
    const history = [];
    
    // Generate last 30 days of data
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      
      history.push({
        timestamp: date.toISOString(),
        overallScore: 40 + Math.random() * 40,
        categories: {
          complexity: 40 + Math.random() * 40,
          quality: 30 + Math.random() * 40,
          security: 20 + Math.random() * 30,
          performance: 35 + Math.random() * 35,
          architecture: 45 + Math.random() * 35
        }
      });
    }

    return {
      timestamp: now.toISOString(),
      summary: {
        totalScore: history.length > 0 ? history[history.length - 1].overallScore : 0,
        grade: this.getScoreGrade(history.length > 0 ? history[history.length - 1].overallScore || 0 : 0),
        criticalIssues: history.reduce((sum, item) => sum + ((item.categories.security?.score || 0) > 60 ? 1 : 0), 0),
        highIssues: history.reduce((sum, item) => sum + ((item.categories.quality?.score || 0) > 40 ? 1 : 0), 0),
        mediumIssues: history.reduce((sum, item) => sum + ((item.categories.performance?.score || 0) > 30 ? 1 : 0), 0),
        lowIssues: history.reduce((sum, item) => sum + ((item.categories.architecture?.score || 0) > 25 ? 1 : 0), 0),
        totalIssues: history.reduce((sum, item) => sum + Object.values(item.categories).reduce((catSum, cat) => catSum + (cat.score || 0), 0), 0)
      },
      history,
      metrics: {
        totalAssessments: history.length,
        averageScore: history.length > 0 ? history.reduce((sum, item) => sum + item.overallScore, 0) / history.length : 0,
        criticalCount: history.reduce((sum, item) => sum + ((item.categories.security?.score || 0) > 60 ? 1 : 0), 0),
        highCount: history.reduce((sum, item) => sum + ((item.categories.quality?.score || 0) > 40 ? 1 : 0), 0),
        mediumCount: history.reduce((sum, item) => sum + ((item.categories.performance?.score || 0) > 30 ? 1 : 0), 0),
        lowCount: history.reduce((sum, item) => sum + ((item.categories.architecture?.score || 0) > 25 ? 1 : 0), 0)
      },
      recommendations: history.length > 0 ? this.generateRecommendations(history[history.length - 1]) : [],
      exportedAt: now.toISOString()
    };
  }

  // Generate recommendations from history
  generateRecommendations(latestAssessment) {
    const recommendations = [];
    
    if (!latestAssessment) return recommendations;
    
    // High priority recommendations
    if (latestAssessment.overallScore > 60) {
      recommendations.push({
        priority: 'critical',
        action: 'Address critical technical debt immediately',
        description: `Overall debt score of ${latestAssessment.overallScore} requires immediate attention`
      });
    }

    // Category-specific recommendations
    Object.entries(latestAssessment.categories).forEach(([categoryName, category]) => {
      if (category.score > category.threshold.poor) {
        recommendations.push({
          priority: 'high',
          action: `Improve ${categoryName} technical debt`,
          description: `${categoryName} score of ${Math.round(category.score)} exceeds acceptable threshold`
        });
      }
    });

    // Low-hanging fruit
    Object.entries(latestAssessment.categories).forEach(([categoryName, category]) => {
      if (category.score < category.threshold.good && category.score > 0) {
        recommendations.push({
          priority: 'medium',
          action: `Monitor ${categoryName} technical debt`,
          description: `${categoryName} score of ${Math.round(category.score)} is improving but still needs attention`
        });
      }
    });

    return recommendations;
  }

  // Get system state
  getState() {
    return {
      isInitialized: this.isInitialized,
      containerId: this.containerId,
      options: this.options,
      chartInstances: Array.from(this.chartInstances.keys()),
      isAutoRefreshEnabled: this.isAutoRefresh,
      refreshInterval: this.refreshInterval,
      maxDataPoints: this.maxDataPoints,
      stats: this.getStats()
    };
  }

  // Get statistics
  getStats() {
    const currentAssessment = this.debtHistory.length > 0 ? this.debtHistory[this.debtHistory.length - 1] : null;
    
    const categoryStats = {};
    this.debtCategories.forEach((category, name) => {
      categoryStats[name] = {
        currentScore: category.currentScore,
        trend: category.trend,
        threshold: category.threshold,
        usage: category.history.length,
        lastUpdated: category.lastUpdated
      };
    });

    const metricStats = {};
    this.debtMetrics.forEach((metric, name) => {
      metricStats[name] = {
        currentScore: metric.currentScore,
        trend: metric.trend,
        threshold: metric.threshold,
        usage: metric.history.length,
        lastUpdated: metric.lastUpdated
      };
    });

    return {
      totalAssessments: this.debtHistory.length,
      currentAssessment,
      categoryStats,
      metricStats,
      reductionProgress: this.getDebtReductionProgress(),
      overallTrend: currentAssessment?.trend || 'stable',
      averageScore: currentAssessment?.overallScore || 0,
      grade: currentAssessment?.grade || 'unknown',
      lastUpdated: currentAssessment?.timestamp || null
    };
  }

  // Destroy dashboard
  destroy() {
    this.stopRealTimeUpdates();
    
    // Clear references
    this.chartInstances.clear();
    this.debtCategories.clear();
    this.debtMetrics.clear();
    this.debtHistory = [];
    this.reductionGoals.clear();
    
    this.isInitialized = false;
    console.log('[DEBT_DASHBOARD] Dashboard destroyed');
  }
}

// Global instance
let debtDashboard = null;

// Initialize dashboard when DOM is ready
function initializeDebtDashboard(containerId = 'debt-dashboard') {
  if (!debtDashboard) {
    debtDashboard = new DebtDashboard(containerId);
  }
  return debtDashboard.initialize();
}

// Export for global access
window.debtDashboard = debtDashboard;

module.exports = {
  DebtDashboard,
  initializeDebtDashboard
};
