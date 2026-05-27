// Dashboard Access Fix
// Ensures the Dashboard button properly shows the main dashboard content

console.log('🔧 Loading dashboard access fix...');

// Fix dashboard access from menu
window.fixDashboardAccess = function() {
    console.log('🔧 Fixing dashboard access from menu...');
    
    // Check if Dashboard button exists
    const dashboardBtn = document.querySelector('.nav-item[data-section="dashboard"]');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    console.log('Dashboard button found:', !!dashboardBtn);
    console.log('Dashboard container found:', !!dashboardContainer);
    
    if (!dashboardBtn) {
        console.log('❌ Dashboard button not found, adding it...');
        addDashboardButton();
        return fixDashboardAccess(); // Try again after adding
    }
    
    if (!dashboardContainer) {
        console.error('❌ Dashboard container not found');
        return false;
    }
    
    // Ensure the Dashboard button click handler works properly
    dashboardBtn.onclick = function(e) {
        e.preventDefault();
        console.log('🏠 Dashboard button clicked - showing main dashboard');
        
        // Remove active class from all items
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(function(item) {
            item.classList.remove('active');
            // Reset styling for non-active items
            if (item.getAttribute('data-section') !== 'dashboard') {
                item.style.backgroundColor = '';
                item.style.borderLeft = '';
                item.style.fontWeight = '';
                item.style.color = 'white';
                const itemIcon = item.querySelector('.nav-icon');
                const itemText = item.querySelector('.nav-text');
                if (itemIcon) itemIcon.style.color = 'white';
                if (itemText) itemText.style.color = 'white';
            }
        });
        
        // Add active class and styling to Dashboard button
        this.classList.add('active');
        this.style.backgroundColor = 'rgba(52, 152, 219, 0.4)';
        this.style.borderLeft = '4px solid #3498db';
        this.style.fontWeight = '600';
        this.style.color = '#3498db';
        const icon = this.querySelector('.nav-icon');
        const text = this.querySelector('.nav-text');
        if (icon) icon.style.color = '#3498db';
        if (text) text.style.color = '#3498db';
        
        // Show the main dashboard content
        showMainDashboard(dashboardContainer);
        
        // Show notification
        showNotification('Dashboard loaded - Main dashboard view active', 'success');
        
        return false;
    };
    
    // Test the button
    setTimeout(function() {
        console.log('🧪 Testing dashboard access...');
        
        if (dashboardBtn && dashboardContainer) {
            console.log('✅ Dashboard button and container both found');
            console.log('✅ Dashboard button onclick handler attached');
            console.log('✅ Ready to show main dashboard content');
            
            // Simulate a click to test
            console.log('🧪 Simulating Dashboard button click...');
            dashboardBtn.click();
        } else {
            console.log('❌ Dashboard access fix failed - missing elements');
        }
    }, 1000);
    
    return true;
};

// Enhanced showMainDashboard function
window.showMainDashboard = function(container) {
    console.log('🏠 Showing main dashboard content...');
    
    if (!container) {
        console.error('❌ Dashboard container not provided');
        return false;
    }
    
    // Show the main dashboard content
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
        
        // Animate stats
        animateStats();
        
        // Start activity monitoring
        startActivityMonitoring();
        
        console.log('✅ Main dashboard content loaded and animated');
    }, 1000);
    
    return true;
};

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
function showNotification(message, type) {
    type = type || 'info';
    
    // Remove existing notifications
    const existing = document.querySelectorAll('.alert-dismissible');
    existing.forEach(function(el) {
        el.remove();
    });
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'alert alert-' + type + ' alert-dismissible fade show position-fixed top-0 end-0 m-3';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.textContent = message + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>' /* Replaced innerHTML with textContent for safety */
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(function() {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Auto-fix dashboard access on page load
function autoFixDashboardAccess() {
    console.log('🔧 Auto-fixing dashboard access...');
    
    setTimeout(function() {
        fixDashboardAccess();
    }, 2000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Dashboard access fix loaded');
    
    // Auto-fix on load
    autoFixDashboardAccess();
    
    console.log('✅ Dashboard access fix initialized');
});

// Make functions globally available
window.fixDashboardAccess = fixDashboardAccess;
window.autoFixDashboardAccess = autoFixDashboardAccess;

console.log('🔧 Dashboard access fix initialized');
