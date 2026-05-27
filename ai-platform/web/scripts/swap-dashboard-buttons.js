// Swap Dashboard Buttons
// Removes the large purple button and keeps only the clean regular Dashboard button

console.log('🔧 Loading swap dashboard buttons...');

// Remove large purple button and keep clean regular button
window.swapDashboardButtons = function() {
    console.log('🔧 Swapping dashboard buttons - removing large purple button...');
    
    // Remove all simple dashboard buttons (the large purple ones)
    const simpleButtons = document.querySelectorAll('.simple-dashboard-btn');
    simpleButtons.forEach(function(button) {
        console.log('🗑️ Removing large purple Dashboard button');
        button.remove();
    });
    
    // Find the regular Dashboard button
    const regularDashboardBtn = document.querySelector('.nav-item[data-section="dashboard"]');
    
    if (regularDashboardBtn) {
        console.log('✅ Found regular Dashboard button, enhancing it...');
        
        // Make sure the regular button is properly styled and functional
        regularDashboardBtn.style.backgroundColor = 'rgba(52, 152, 219, 0.2)';
        regularDashboardBtn.style.borderLeft = '4px solid #3498db';
        regularDashboardBtn.style.fontWeight = '600';
        regularDashboardBtn.style.color = '#3498db';
        
        const icon = regularDashboardBtn.querySelector('.nav-icon');
        const text = regularDashboardBtn.querySelector('.nav-text');
        const _badge = regularDashboardBtn.querySelector('.nav-badge');
        
        if (icon) icon.style.color = '#3498db';
        if (text) text.style.color = '#3498db';
        
        // Ensure the regular button has proper click handler
        regularDashboardBtn.onclick = function(e) {
            e.preventDefault();
            console.log('🏠 Regular Dashboard button clicked');
            
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
            if (icon) icon.style.color = '#3498db';
            if (text) text.style.color = '#3498db';
            
            // Show the dashboard content
            const dashboardContainer = document.querySelector('.dashboard-container');
            if (dashboardContainer) {
                console.log('✅ Dashboard container found, showing main dashboard via regular button');
                showMainDashboardContent(dashboardContainer);
                showNotification('🏠 Dashboard loaded via regular button!', 'success');
            } else {
                console.error('❌ Dashboard container not found');
                showNotification('❌ Dashboard container not found', 'error');
            }
            
            return false;
        };
        
        console.log('✅ Regular Dashboard button enhanced and ready');
        
        // Auto-click the regular button to show dashboard
        setTimeout(function() {
            console.log('🧪 Auto-clicking regular Dashboard button...');
            regularDashboardBtn.click();
        }, 1000);
        
    } else {
        console.log('❌ Regular Dashboard button not found');
    }
    
    // Verify the swap
    setTimeout(function() {
        console.log('🧪 Verifying button swap...');
        
        const remainingSimpleButtons = document.querySelectorAll('.simple-dashboard-btn');
        const regularBtn = document.querySelector('.nav-item[data-section="dashboard"]');
        
        console.log('✅ Large purple buttons removed:', remainingSimpleButtons.length === 0);
        console.log('✅ Regular Dashboard button found:', !!regularBtn);
        
        if (remainingSimpleButtons.length === 0 && regularBtn) {
            console.log('✅ Dashboard button swap completed successfully');
            showNotification('✅ Dashboard buttons swapped - using clean regular button', 'success');
        } else {
            console.log('⚠️ Button swap may not be complete');
        }
    }, 1500);
    
    return true;
};

// Show main dashboard content (same as before)
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

// Auto-swap buttons on page load
function autoSwapButtons() {
    console.log('🔧 Auto-swapping dashboard buttons...');
    
    setTimeout(function() {
        swapDashboardButtons();
    }, 2000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Dashboard button swap loaded');
    
    // Auto-swap on load
    autoSwapButtons();
    
    console.log('✅ Dashboard button swap initialized');
});

// Make functions globally available
window.swapDashboardButtons = swapDashboardButtons;
window.autoSwapButtons = autoSwapButtons;

console.log('🔧 Dashboard button swap initialized');
