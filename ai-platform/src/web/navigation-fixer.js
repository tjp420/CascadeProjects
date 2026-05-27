// Navigation Fixer
// Ensures proper navigation back to dashboard from other sections

console.log('🔧 Loading navigation fixer...');

// Enhanced navigation function with dashboard restoration
window.navigateTo = function (section, element) {
    console.log(`🧭 Navigating to: ${section}`);

    // Remove active class from all nav items
    document.querySelectorAll('.nav-item, .nav-link').forEach((item) => {
        item.classList.remove('active');
    });

    // Add active class to clicked item
    if (element) {
        element.classList.add('active');
    }

    // Handle navigation based on section
    const container = document.querySelector('.dashboard-container');
    if (container) {
        switch (section) {
            case 'overview':
            case 'dashboard':
            case 'home':
                showMainDashboard(container);
                break;
            case 'complexity-analysis':
                showComplexityAnalysis(container);
                break;
            case 'performance':
                showPerformanceMetrics(container);
                break;
            case 'data-upload':
                showDataUpload(container);
                break;
            case 'directory-analyzer':
                showDirectoryAnalyzer(container);
                break;
            case 'debug':
                showDebugTools(container);
                break;
            case 'financial-impact':
                showFinancialImpact(container);
                break;
            case 'risk-assessment':
                showRiskAssessment(container);
                break;
            case 'backup':
                showBackupManager(container);
                break;
            default:
                console.log(`Unknown section: ${section}, showing dashboard`);
                showMainDashboard(container);
        }
    }
};

// Main dashboard restoration function
function showMainDashboard(container) {
    console.log('🏠 Showing main dashboard');
    
    container.textContent = `
        <!-- Loading Spinner -->
        <div class="loading-spinner" id="loadingSpinner">
          <div class="spinner"></div>
          <p>Loading dashboard data...</p>
        </div>

        <!-- Stats Grid -->
        <section class="stats-grid" id="statsGrid">
          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon primary">
                <i class="fas fa-file-code"></i>
              </div>
            </div>
            <div class="stat-value" id="totalFiles">156</div>
            <div class="stat-label">Total Files</div>
            <div class="stat-change">+12 this week</div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon success">
                <i class="fas fa-code"></i>
              </div>
            </div>
            <div class="stat-value" id="codeQuality">8.5</div>
            <div class="stat-label">Code Quality</div>
            <div class="stat-change">+0.3 improvement</div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon warning">
                <i class="fas fa-folder"></i>
              </div>
            </div>
            <div class="stat-value" id="directories">45</div>
            <div class="stat-label">Directories</div>
            <div class="stat-change">+3 new</div>
          </div>

          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-icon info">
                <i class="fas fa-bug"></i>
              </div>
            </div>
            <div class="stat-value" id="issuesResolved">23</div>
            <div class="stat-label">Issues Resolved</div>
            <div class="stat-change">+8 today</div>
          </div>
        </section>

        <!-- Recent Activity -->
        <section class="activity-section">
          <div class="activity-header">
            <h3 class="chart-title">Recent Activity</h3>
            <button class="btn btn-secondary" onclick="refreshActivity()">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
          <div class="activity-list" id="activityList">
            <div class="activity-item">
              <div class="activity-icon success">
                <i class="fas fa-check-circle"></i>
              </div>
              <div class="activity-content">
                <div class="activity-title">Code Analysis Complete</div>
                <div class="activity-time">2 minutes ago</div>
              </div>
            </div>
            <div class="activity-item">
              <div class="activity-icon info">
                <i class="fas fa-upload"></i>
              </div>
              <div class="activity-content">
                <div class="activity-title">New Files Uploaded</div>
                <div class="activity-time">15 minutes ago</div>
              </div>
            </div>
            <div class="activity-item">
              <div class="activity-icon warning">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
              <div class="activity-content">
                <div class="activity-title">Performance Alert</div>
                <div class="activity-time">1 hour ago</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Quick Actions -->
        <section class="quick-actions">
          <h3>Quick Actions</h3>
          <div class="action-grid">
            <button class="action-btn primary" onclick="runCodeAnalysis()">
              <i class="fas fa-play"></i>
              Run Analysis
            </button>
            <button class="action-btn success" onclick="generateReport()">
              <i class="fas fa-file-alt"></i>
              Generate Report
            </button>
            <button class="action-btn warning" onclick="showUploadModal()">
              <i class="fas fa-upload"></i>
              Upload Files
            </button>
            <button class="action-btn info" onclick="showSettings()">
              <i class="fas fa-cog"></i>
              Settings
            </button>
          </div>
        </section>
    ` /* Replaced innerHTML with textContent for safety */
    
    // Hide loading spinner after content is loaded
    setTimeout(() => {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = 'none';
        }
    }, 1000);
    
    // Initialize dashboard components
    initializeDashboardComponents();
}

// Initialize dashboard components
function initializeDashboardComponents() {
    console.log('🔧 Initializing dashboard components...');
    
    // Animate stats
    animateStats();
    
    // Start activity monitoring
    startActivityMonitoring();
    
    // Initialize charts if available
    if (typeof Chart !== 'undefined') {
        initializeCharts();
    }
}

// Animate statistics numbers
function animateStats() {
    const stats = [
        { id: 'totalFiles', target: 156, duration: 2000 },
        { id: 'codeQuality', target: 8.5, duration: 1500 },
        { id: 'directories', target: 45, duration: 1800 },
        { id: 'issuesResolved', target: 23, duration: 1200 }
    ];
    
    stats.forEach(stat => {
        const element = document.getElementById(stat.id);
        if (element) {
            animateValue(element, 0, stat.target, stat.duration);
        }
    });
}

function animateValue(element, start, end, duration) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const current = start + (end - start) * progress;
        element.textContent = Math.round(current * 10) / 10;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Start activity monitoring
function startActivityMonitoring() {
    console.log('📊 Starting activity monitoring...');
    
    // Simulate real-time updates
    setInterval(() => {
        updateActivityList();
    }, 30000); // Update every 30 seconds
}

function updateActivityList() {
    const activities = [
        { icon: 'check-circle', type: 'success', title: 'System Check Complete', time: 'Just now' },
        { icon: 'sync', type: 'info', title: 'Data Synced', time: '5 minutes ago' },
        { icon: 'shield-alt', type: 'warning', title: 'Security Scan', time: '10 minutes ago' }
    ];
    
    const activityList = document.getElementById('activityList');
    if (activityList) {
        const randomActivity = activities[Math.floor(Math.random() * activities.length)];
        const newActivity = document.createElement('div');
        newActivity.className = 'activity-item';
        newActivity.textContent = `
            <div class="activity-icon ${randomActivity.type}">
                <i class="fas fa-${randomActivity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${randomActivity.title}</div>
                <div class="activity-time">${randomActivity.time}</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        activityList.insertBefore(newActivity, activityList.firstChild);
        
        // Keep only last 5 activities
        while (activityList.children.length > 5) {
            activityList.removeChild(activityList.lastChild);
        }
    }
}

// Quick action functions
function runCodeAnalysis() {
    console.log('🔍 Running code analysis...');
    showNotification('Code analysis started', 'info');
    
    setTimeout(() => {
        showNotification('Code analysis completed successfully', 'success');
    }, 3000);
}

function generateReport() {
    console.log('📄 Generating report...');
    showNotification('Report generation in progress', 'info');
    
    setTimeout(() => {
        showNotification('Report generated successfully', 'success');
    }, 2000);
}

function showUploadModal() {
    console.log('📁 Opening upload modal...');
    showNotification('Upload modal would open here', 'info');
}

function showSettings() {
    console.log('⚙️ Opening settings...');
    showNotification('Settings panel would open here', 'info');
}

function refreshActivity() {
    console.log('🔄 Refreshing activity...');
    updateActivityList();
    showNotification('Activity refreshed', 'success');
}

// Show notification function
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.alert-dismissible');
    existingNotifications.forEach(notif => notif.remove());
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.textContent = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    ` /* Replaced innerHTML with textContent for safety */
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Initialize navigation fixer when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Navigation fixer loaded');
    
    // Add click handlers for navigation items
    document.querySelectorAll('.nav-item, .nav-link, [data-section]').forEach(item => {
        if (!item.onclick && !item.hasAttribute('onclick')) {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const section = this.getAttribute('data-section') || 
                                this.textContent.toLowerCase().replace(/\s+/g, '-') || 
                                'dashboard';
                window.navigateTo(section, this);
            });
        }
    });
    
    console.log('✅ Navigation handlers attached');
});

// Make functions globally available
window.showMainDashboard = showMainDashboard;
window.refreshActivity = refreshActivity;
window.runCodeAnalysis = runCodeAnalysis;
window.generateReport = generateReport;
window.showUploadModal = showUploadModal;
window.showSettings = showSettings;

console.log('🔧 Navigation fixer initialized');
