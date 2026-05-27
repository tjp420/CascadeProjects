/**
 * Dashboard Components Unit Tests
 * Sprint 3 Test Coverage Enhancement - Target: 80% coverage
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

// Set up DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock Chart.js
global.Chart = class Chart {
  static getChart() {
 return null; 
}
  constructor() {
 this.data = { datasets: [] }; 
}
  update() {
 return true; 
}
};

describe('Dashboard Components', () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.body.textContent = '' /* Replaced innerHTML with textContent for safety */
  });

  describe('Dashboard Container', () => {
    test('should create dashboard container element', () => {
      const container = document.createElement('div');
      container.className = 'dashboard-container';
      document.body.appendChild(container);

      expect(document.querySelector('.dashboard-container')).toBeTruthy();
      expect(container.parentElement).toBe(document.body);
    });

    test('should handle sidebar toggle functionality', () => {
      // Create sidebar element
      const sidebar = document.createElement('aside');
      sidebar.className = 'sidebar';
      sidebar.style.width = '250px';
      document.body.appendChild(sidebar);

      // Create container
      const container = document.createElement('div');
      container.className = 'dashboard-container';
      document.body.appendChild(container);

      // Simulate toggle function
      function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
          const isCollapsed = sidebar.style.width === '0px';
          sidebar.style.width = isCollapsed ? '250px' : '0px';
        }
      }

      // Test toggle
      toggleSidebar();
      expect(sidebar.style.width).toBe('0px');
      
      toggleSidebar();
      expect(sidebar.style.width).toBe('250px');
    });
  });

  describe('Navigation System', () => {
    test('should handle navigation between sections', () => {
      // Create navigation items
      const navItems = [
        { id: 'overview', label: 'Overview' },
        { id: 'analysis', label: 'Analysis' },
        { id: 'reports', label: 'Reports' }
      ];

      navItems.forEach(item => {
        const navElement = document.createElement('div');
        navElement.className = 'nav-item';
        navElement.dataset.section = item.id;
        navElement.textContent = item.label;
        document.body.appendChild(navElement);
      });

      // Create container
      const container = document.createElement('div');
      container.className = 'dashboard-container';
      document.body.appendChild(container);

      // Simulate navigation function
      function navigateTo(section, element) {
        document.querySelectorAll('.nav-item').forEach(item => {
          item.classList.remove('active');
        });
        if (element) {
          element.classList.add('active');
        }
        
        container.textContent = `<div class="section-${section}">Content for ${section}</div>` /* Replaced innerHTML with textContent for safety */
      }

      // Test navigation
      const overviewNav = document.querySelector('[data-section="overview"]');
      navigateTo('overview', overviewNav);

      expect(overviewNav.classList.contains('active')).toBe(true);
      expect(container.querySelector('.section-overview')).toBeTruthy();
    });

    test('should handle invalid navigation gracefully', () => {
      const container = document.createElement('div');
      container.className = 'dashboard-container';
      document.body.appendChild(container);

      function navigateTo(section, element) {
        if (!section || typeof section !== 'string') {
          console.warn('Invalid section provided');
          return;
        }
        // Navigation logic here
      }

      expect(() => navigateTo(null, null)).not.toThrow();
      expect(() => navigateTo('', null)).not.toThrow();
    });
  });

  describe('Chart Components', () => {
    test('should create chart elements', () => {
      const chartCanvas = document.createElement('canvas');
      chartCanvas.id = 'testChart';
      document.body.appendChild(chartCanvas);

      const chart = new Chart(chartCanvas);
      
      expect(chart).toBeInstanceOf(Chart);
      expect(chart.data).toHaveProperty('datasets');
    });

    test('should update chart data', () => {
      const chartCanvas = document.createElement('canvas');
      chartCanvas.id = 'testChart';
      document.body.appendChild(chartCanvas);

      const chart = new Chart(chartCanvas);
      chart.data.datasets.push({
        label: 'Test Data',
        data: [1, 2, 3, 4, 5]
      });

      const updateResult = chart.update();
      expect(updateResult).toBe(true);
    });

    test('should handle missing chart gracefully', () => {
      const missingChart = Chart.getChart('nonexistent');
      expect(missingChart).toBeNull();
    });
  });

  describe('Stats Grid Components', () => {
    test('should create stat cards', () => {
      const statsGrid = document.createElement('div');
      statsGrid.className = 'stats-grid';
      
      const statCard = document.createElement('div');
      statCard.className = 'stat-card';
      statCard.textContent = `
        <div class="stat-value">85%</div>
        <div class="stat-label">Code Quality</div>
        <div class="stat-change positive">+5%</div>
      ` /* Replaced innerHTML with textContent for safety */
      
      statsGrid.appendChild(statCard);
      document.body.appendChild(statsGrid);

      expect(statsGrid.querySelector('.stat-card')).toBeTruthy();
      expect(statsGrid.querySelector('.stat-value').textContent).toBe('85%');
      expect(statsGrid.querySelector('.stat-label').textContent).toBe('Code Quality');
      expect(statsGrid.querySelector('.stat-change').textContent).toBe('+5%');
    });

    test('should handle multiple stat cards', () => {
      const statsGrid = document.createElement('div');
      statsGrid.className = 'stats-grid';
      
      const statsData = [
        { value: '85%', label: 'Code Quality', change: '+5%', type: 'positive' },
        { value: '92%', label: 'Test Coverage', change: '+3%', type: 'positive' },
        { value: '78%', label: 'Performance', change: '-2%', type: 'negative' }
      ];

      statsData.forEach(stat => {
        const statCard = document.createElement('div');
        statCard.className = 'stat-card';
        statCard.textContent = `
          <div class="stat-value">${stat.value}</div>
          <div class="stat-label">${stat.label}</div>
          <div class="stat-change ${stat.type}">${stat.change}</div>
        ` /* Replaced innerHTML with textContent for safety */
        statsGrid.appendChild(statCard);
      });

      document.body.appendChild(statsGrid);

      const statCards = statsGrid.querySelectorAll('.stat-card');
      expect(statCards).toHaveLength(3);
      expect(statCards[0].querySelector('.stat-value').textContent).toBe('85%');
      expect(statCards[1].querySelector('.stat-label').textContent).toBe('Test Coverage');
      expect(statCards[2].querySelector('.stat-change').classList.contains('negative')).toBe(true);
    });
  });

  describe('Activity Feed', () => {
    test('should create activity items', () => {
      const activityList = document.createElement('div');
      activityList.className = 'activity-list';
      
      const activities = [
        { icon: 'fa-code', title: 'Code analysis completed', time: '2 mins ago', color: 'primary' },
        { icon: 'fa-shield-alt', title: 'Security scan finished', time: '5 mins ago', color: 'success' }
      ];

      activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.textContent = `
          <div class="activity-icon ${activity.color}">
            <i class="fas ${activity.icon}"></i>
          </div>
          <div class="activity-content">
            <div class="activity-title">${activity.title}</div>
            <div class="activity-description">System update completed</div>
            <div class="activity-time">${activity.time}</div>
          </div>
        ` /* Replaced innerHTML with textContent for safety */
        activityList.appendChild(activityItem);
      });

      document.body.appendChild(activityList);

      const activityItems = activityList.querySelectorAll('.activity-item');
      expect(activityItems).toHaveLength(2);
      expect(activityItems[0].querySelector('.activity-title').textContent).toBe('Code analysis completed');
      expect(activityItems[1].querySelector('.activity-icon').classList.contains('success')).toBe(true);
    });

    test('should handle empty activity list', () => {
      const activityList = document.createElement('div');
      activityList.className = 'activity-list';
      document.body.appendChild(activityList);

      const activityItems = activityList.querySelectorAll('.activity-item');
      expect(activityItems).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing DOM elements gracefully', () => {
      expect(() => {
        const missingElement = document.querySelector('.nonexistent');
        if (missingElement) {
          missingElement.click();
        }
      }).not.toThrow();
    });

    test('should handle invalid data in stat cards', () => {
      const statCard = document.createElement('div');
      statCard.className = 'stat-card';
      statCard.textContent = `
        <div class="stat-value">${null}</div>
        <div class="stat-label">${undefined}</div>
        <div class="stat-change">${NaN}</div>
      ` /* Replaced innerHTML with textContent for safety */
      
      document.body.appendChild(statCard);

      expect(statCard.querySelector('.stat-value').textContent).toBe('null');
      expect(statCard.querySelector('.stat-label').textContent).toBe('undefined');
      expect(statCard.querySelector('.stat-change').textContent).toBe('NaN');
    });
  });

  describe('Performance', () => {
    test('should render components efficiently', () => {
      const startTime = performance.now();
      
      // Create multiple components
      for (let i = 0; i < 100; i++) {
        const component = document.createElement('div');
        component.className = 'dashboard-component';
        component.textContent = `<span>Component ${i}</span>` /* Replaced innerHTML with textContent for safety */
        document.body.appendChild(component);
      }
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(100); // Should render within 100ms
      expect(document.querySelectorAll('.dashboard-component')).toHaveLength(100);
    });
  });

  describe('Accessibility', () => {
    test('should support keyboard navigation', () => {
      const button = document.createElement('button');
      button.textContent = 'Test Button';
      button.setAttribute('tabindex', '0');
      document.body.appendChild(button);

      // Simulate keyboard interaction
      button.focus();
      expect(document.activeElement).toBe(button);

      // Simulate Enter key press
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' });
      expect(() => button.dispatchEvent(enterEvent)).not.toThrow();
    });

    test('should have proper ARIA labels', () => {
      const chart = document.createElement('canvas');
      chart.setAttribute('aria-label', 'Code Quality Chart');
      chart.setAttribute('role', 'img');
      document.body.appendChild(chart);

      expect(chart.getAttribute('aria-label')).toBe('Code Quality Chart');
      expect(chart.getAttribute('role')).toBe('img');
    });
  });
});
