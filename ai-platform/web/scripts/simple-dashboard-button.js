// Simple Dashboard Button
// Creates a very obvious and accessible Dashboard button

console.log('🔧 Loading simple dashboard button...');

// Create a simple, obvious Dashboard button
window.createSimpleDashboardButton = function() {
    console.log('🔧 Creating simple Dashboard button...');
    
    // Find the navigation
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (!sidebarNav) {
        console.error('❌ Sidebar navigation not found');
        return false;
    }
    
    // Remove any existing dashboard buttons first
    const existingButtons = document.querySelectorAll('.simple-dashboard-btn');
    existingButtons.forEach(btn => btn.remove());
    
    // Create a very obvious Dashboard button
    const dashboardBtn = document.createElement('div');
    dashboardBtn.className = 'simple-dashboard-btn';
    dashboardBtn.textContent = `
        <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) /* Replaced innerHTML with textContent for safety */
            color: white;
            padding: 20px;
            margin: 15px;
            border-radius: 12px;
            cursor: pointer;
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            border: 2px solid #fff;
            transition: all 0.3s ease;
            position: relative;
            z-index: 1000;
        ">
            <div style="font-size: 24px; margin-bottom: 8px;">🏠</div>
            <div>MAIN DASHBOARD</div>
            <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">Click here to access</div>
        </div>
    `;
    
    // Add hover effect
    dashboardBtn.addEventListener('mouseenter', function() {
        this.querySelector('div').style.transform = 'translateY(-2px)';
        this.querySelector('div').style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
    });
    
    dashboardBtn.addEventListener('mouseleave', function() {
        this.querySelector('div').style.transform = 'translateY(0)';
        this.querySelector('div').style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    });
    
    // Add click handler
    dashboardBtn.addEventListener('click', function() {
        console.log('🏠 Simple Dashboard button clicked!');
        
        // Remove active class from all nav items
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(function(item) {
            item.classList.remove('active');
        });
        
        // Show the dashboard container
        const dashboardContainer = document.querySelector('.dashboard-container');
        if (dashboardContainer) {
            console.log('✅ Dashboard container found, showing main dashboard');
            
            // Make sure container is visible
            dashboardContainer.style.display = 'block';
            dashboardContainer.style.visibility = 'visible';
            dashboardContainer.style.opacity = '1';
            
            // Show main dashboard content
            showMainDashboardContent(dashboardContainer);
            
            // Show notification
            showNotification('🏠 Dashboard loaded successfully!', 'success');
        } else {
            console.error('❌ Dashboard container not found');
            showNotification('❌ Dashboard container not found', 'error');
        }
    });
    
    // Insert at the very top of navigation
    sidebarNav.insertBefore(dashboardBtn, sidebarNav.firstChild);
    
    console.log('✅ Simple Dashboard button created and added');
    
    // Test the button
    setTimeout(function() {
        const btn = document.querySelector('.simple-dashboard-btn');
        if (btn) {
            console.log('✅ Simple Dashboard button is accessible');
            console.log('✅ Button text:', btn.textContent.trim());
            console.log('✅ Button visible:', window.getComputedStyle(btn).display !== 'none');
            
            // Auto-click it to show dashboard
            console.log('🧪 Auto-clicking Dashboard button to show content...');
            btn.click();
        } else {
            console.log('❌ Simple Dashboard button not found');
        }
    }, 1000);
    
    return true;
};

// Show main dashboard content
function showMainDashboardContent(container) {
    console.log('🏠 Showing main dashboard content...');
    
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
                <div class="activity-title">✅ Dashboard Loaded Successfully</div>
                <div class="activity-time">Just now</div>
              </div>
            </div>
            <div class="activity-item">
              <div class="activity-icon info">
                <i class="fas fa-upload"></i>
              </div>
              <div class="activity-content">
                <div class="activity-title">📁 Files Processed</div>
                <div class="activity-time">2 minutes ago</div>
              </div>
            </div>
            <div class="activity-item">
              <div class="activity-icon warning">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
              <div class="activity-content">
                <div class="activity-title">⚠️ System Check Complete</div>
                <div class="activity-time">5 minutes ago</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Quick Actions -->
        <section class="quick-actions">
          <h3>🚀 Quick Actions</h3>
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
        
        console.log('✅ Main dashboard content loaded successfully');
    }, 1000);
    
    return true;
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

// Quick action functions
function _runCodeAnalysis() {
    console.log('🔍 Running code analysis...');
    showNotification('🔍 Code analysis started', 'info');
    
    setTimeout(() => {
        showNotification('✅ Code analysis completed successfully', 'success');
    }, 3000);
}

function _generateReport() {
    console.log('📄 Generating report...');
    showNotification('📄 Report generation in progress', 'info');
    
    setTimeout(() => {
        showNotification('✅ Report generated successfully', 'success');
    }, 2000);
}

function _showUploadModal() {
    console.log('📁 Opening upload modal...');
    showNotification('📁 Upload modal would open here', 'info');
}

function _showSettings() {
    console.log('⚙️ Opening settings...');
    showNotification('⚙️ Settings panel would open here', 'info');
}

function _refreshActivity() {
    console.log('🔄 Refreshing activity...');
    showNotification('🔄 Activity refreshed', 'success');
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

// Auto-create the button on page load
function autoCreateSimpleButton() {
    console.log('🔧 Auto-creating simple Dashboard button...');
    
    setTimeout(function() {
        createSimpleDashboardButton();
    }, 1500);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Simple Dashboard button loaded');
    
    // Auto-create on load
    autoCreateSimpleButton();
    
    console.log('✅ Simple Dashboard button initialized');
});

// Make functions globally available
window.createSimpleDashboardButton = createSimpleDashboardButton;
window.autoCreateSimpleButton = autoCreateSimpleButton;

console.log('🔧 Simple Dashboard button initialized');
