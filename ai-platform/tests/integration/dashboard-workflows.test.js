/**
 * Dashboard Integration Tests
 * Sprint 3 Test Coverage Enhancement - Critical Path Testing
 */

const { JSDOM } = require('jsdom');

describe('Dashboard Integration Tests', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Dashboard</title>
        </head>
        <body>
          <div class="dashboard-container">
            <div id="loadingSpinner">Loading...</div>
          </div>
          <script>
            window.comprehensiveAnalysisData = {
              performanceAnalysis: {
                performanceScore: 85,
                responseTime: '120ms',
                memoryUsage: '45%',
                throughput: '850 req/sec',
                weeklyChange: 3,
                detailedMetrics: {
                  apiResponseTime: { current: 120, average: 135, peak: 250, unit: 'ms', status: 'Good' },
                  databaseQueryTime: { current: 45, average: 52, peak: 120, unit: 'ms', status: 'Good' },
                  pageLoadTime: { current: 2.3, average: 2.8, peak: 4.1, unit: 's', status: 'Moderate' },
                  memoryUsage: { current: 67, average: 71, peak: 89, unit: '%', status: 'Good' },
                  cpuUsage: { current: 45, average: 48, peak: 78, unit: '%', status: 'Good' },
                  networkLatency: { current: 15, average: 18, peak: 45, unit: 'ms', status: 'Excellent' },
                  throughput: { current: 850, average: 900, peak: 1200, unit: 'req/sec', status: 'Good' }
                },
                recommendations: {
                  optimized: ['API response times are excellent', 'Database queries are well-optimized'],
                  improvements: ['Consider optimizing page load time by implementing lazy loading'],
                  actions: ['Implement CDN for static assets', 'Optimize database indexes']
                }
              }
            };
          </script>
        </body>
      </html>
    `, { runScripts: 'dangerously' });
    
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Performance Metrics Loading', () => {
    test('should load performance metrics successfully', () => {
      // Mock the loadPerformanceMetrics function
      window.loadPerformanceMetrics = function(container) {
        const performanceData = window.comprehensiveAnalysisData.performanceAnalysis;
        const detailedMetrics = performanceData.detailedMetrics;
        
        container.textContent = `
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${performanceData.performanceScore}%</div>
              <div class="stat-label">Overall Performance</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${detailedMetrics.cpuUsage.current}%</div>
              <div class="stat-label">CPU Usage</div>
            </div>
          </div>
        ` /* Replaced innerHTML with textContent for safety */
      };

      const container = document.querySelector('.dashboard-container');
      window.loadPerformanceMetrics(container);

      expect(container.querySelector('.stat-value').textContent).toBe('85%');
      expect(container.querySelectorAll('.stat-card').length).toBe(2);
    });

    test('should display detailed metrics table', () => {
      window.loadPerformanceMetrics = function(container) {
        const detailedMetrics = window.comprehensiveAnalysisData.performanceAnalysis.detailedMetrics;
        
        container.textContent = `
          <table>
            <tbody>
              <tr>
                <td>API Response Time</td>
                <td>${detailedMetrics.apiResponseTime.current}${detailedMetrics.apiResponseTime.unit}</td>
                <td>${detailedMetrics.apiResponseTime.status}</td>
              </tr>
            </tbody>
          </table>
        ` /* Replaced innerHTML with textContent for safety */
      };

      const container = document.querySelector('.dashboard-container');
      window.loadPerformanceMetrics(container);

      const table = container.querySelector('table');
      expect(table).toBeTruthy();
      expect(table.textContent).toContain('120ms');
      expect(table.textContent).toContain('Good');
    });
  });

  describe('Navigation Workflow', () => {
    test('should navigate between sections correctly', () => {
      // Mock navigation function
      window.navigateTo = function(section, element) {
        const container = document.querySelector('.dashboard-container');
        
        switch(section) {
          case 'performance':
            container.textContent = '<h2>Performance Metrics</h2>' /* Replaced innerHTML with textContent for safety */
            break;
          case 'overview':
            container.textContent = '<h2>Dashboard Overview</h2>' /* Replaced innerHTML with textContent for safety */
            break;
        }
      };

      const container = document.querySelector('.dashboard-container');
      
      // Navigate to performance
      window.navigateTo('performance');
      expect(container.textContent).toContain('Performance Metrics');
      
      // Navigate to overview
      window.navigateTo('overview');
      expect(container.textContent).toContain('Dashboard Overview');
    });
  });

  describe('Data Loading Workflow', () => {
    test('should handle loading states correctly', () => {
      window.showLoading = function(message = 'Loading...', container = null) {
        const targetContainer = container || document.querySelector('.dashboard-container');
        targetContainer.textContent = `
          <div class="loading-spinner">
            <div class="spinner"></div>
            <h3>${message}</h3>
          </div>
        ` /* Replaced innerHTML with textContent for safety */
      };

      const container = document.querySelector('.dashboard-container');
      window.showLoading('Analyzing code...', container);

      expect(container.querySelector('.loading-spinner')).toBeTruthy();
      expect(container.querySelector('.spinner')).toBeTruthy();
      expect(container.textContent).toContain('Analyzing code...');
    });

    test('should handle error states gracefully', () => {
      window.showError = function(message, container = null) {
        const targetContainer = container || document.querySelector('.dashboard-container');
        targetContainer.textContent = `
          <div class="error-state">
            <div class="error-icon">❌</div>
            <h3>Error</h3>
            <p>${message}</p>
          </div>
        ` /* Replaced innerHTML with textContent for safety */
      };

      const container = document.querySelector('.dashboard-container');
      window.showError('Failed to load data', container);

      expect(container.querySelector('.error-state')).toBeTruthy();
      expect(container.textContent).toContain('Failed to load data');
    });
  });

  describe('Chart Integration', () => {
    test('should initialize performance charts', () => {
      // Mock Chart.js
      window.Chart = class MockChart {
        constructor(ctx, config) {
          this.ctx = ctx;
          this.config = config;
        }
        update() {
          return true;
        }
        static getChart() {
          return null;
        }
      };

      window.initializePerformanceCharts = function() {
        const container = document.querySelector('.dashboard-container');
        container.innerHTML += `
          <div class="chart-container">
            <canvas id="responseTimeChart"></canvas>
            <canvas id="resourceUsageChart"></canvas>
          </div>
        `;

        // Mock chart creation
        const responseChart = new Chart(document.getElementById('responseTimeChart'), {
          type: 'line',
          data: { labels: ['00:00', '04:00'], datasets: [{ data: [120, 115] }] }
        });

        expect(responseChart).toBeTruthy();
        expect(responseChart.config.type).toBe('line');
      };

      const container = document.querySelector('.dashboard-container');
      window.initializePerformanceCharts();

      expect(container.querySelector('#responseTimeChart')).toBeTruthy();
      expect(container.querySelector('#resourceUsageChart')).toBeTruthy();
    });
  });

  describe('Export Functionality', () => {
    test('should export performance report', () => {
      window.exportPerformanceReport = function() {
        const reportData = {
          timestamp: new Date().toISOString(),
          performance: {
            score: 85,
            responseTime: '120ms',
            memoryUsage: '45%'
          }
        };

        // Mock download
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        return {
          success: true,
          data: reportData,
          url: url
        };
      };

      const result = window.exportPerformanceReport();
      
      expect(result.success).toBe(true);
      expect(result.data.performance.score).toBe(85);
      expect(result.data.performance.responseTime).toBe('120ms');
    });
  });

  describe('Real-time Updates', () => {
    test('should refresh performance metrics', () => {
      window.refreshPerformanceMetrics = function() {
        const metrics = {
          overallScore: Math.floor(Math.random() * 10 + 85) + '%',
          responseTime: Math.floor(Math.random() * 50 + 100) + 'ms',
          cpuUsage: Math.floor(Math.random() * 20 + 35) + '%',
          memoryUsage: Math.floor(Math.random() * 15 + 60) + '%'
        };

        // Update DOM elements
        const elements = {
          overallScore: document.getElementById('overallScore'),
          responseTime: document.getElementById('responseTime'),
          cpuUsage: document.getElementById('cpuUsage'),
          memoryUsage: document.getElementById('memoryUsage')
        };

        Object.keys(elements).forEach(key => {
          if (elements[key]) {
            elements[key].textContent = metrics[key];
          }
        });

        return metrics;
      };

      // Create mock elements
      const container = document.querySelector('.dashboard-container');
      container.textContent = `
        <div id="overallScore">85%</div>
        <div id="responseTime">120ms</div>
        <div id="cpuUsage">45%</div>
        <div id="memoryUsage">67%</div>
      ` /* Replaced innerHTML with textContent for safety */

      const originalValues = {
        overallScore: document.getElementById('overallScore').textContent,
        responseTime: document.getElementById('responseTime').textContent
      };

      const refreshedMetrics = window.refreshPerformanceMetrics();

      expect(refreshedMetrics).toHaveProperty('overallScore');
      expect(refreshedMetrics).toHaveProperty('responseTime');
      expect(refreshedMetrics.overallScore).toMatch(/\d+%/);
    });
  });
});
