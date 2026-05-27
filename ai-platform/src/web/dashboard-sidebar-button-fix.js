// Dashboard Sidebar Button Fix
// Specific fix for the sidebar toggle button in ai_dashboard.html

console.log('🔧 Loading dashboard sidebar button fix...');

// Override the toggleSidebar function specifically for the dashboard
window.toggleSidebar = function () {
    console.log('🔄 Dashboard sidebar toggle activated with size fix...');
    
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const toggleButton = document.querySelector('.sidebar-toggle');
    
    if (!sidebar) {
        console.error('❌ Sidebar element not found');
        return;
    }
    
    // Check current state
    const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
    const willBeCollapsed = !isCurrentlyCollapsed;
    
    console.log(`Current state: ${isCurrentlyCollapsed ? 'collapsed' : 'expanded'}, will become: ${willBeCollapsed ? 'collapsed' : 'expanded'}`);
    
    // Toggle the collapsed state
    if (willBeCollapsed) {
        sidebar.classList.add('collapsed');
        if (mainContent) mainContent.classList.add('expanded');
        if (dashboardContainer) dashboardContainer.classList.add('expanded');
    } else {
        sidebar.classList.remove('collapsed');
        if (mainContent) mainContent.classList.remove('expanded');
        if (dashboardContainer) dashboardContainer.classList.remove('expanded');
    }
    
    // Apply explicit size styles - THIS IS THE KEY FIX
    if (willBeCollapsed) {
        // COLLAPSED STATE - EXACT SIZES
        sidebar.style.width = '60px';
        sidebar.style.minWidth = '60px';
        sidebar.style.maxWidth = '60px';
        sidebar.style.overflow = 'hidden';
        
        if (mainContent) {
            mainContent.style.marginLeft = '60px';
            mainContent.style.width = 'calc(100% - 60px)';
            mainContent.style.transition = 'margin-left 0.3s ease, width 0.3s ease';
        }
        
        if (dashboardContainer) {
            dashboardContainer.style.marginLeft = '60px';
            dashboardContainer.style.width = 'calc(100% - 60px)';
            dashboardContainer.style.transition = 'margin-left 0.3s ease, width 0.3s ease';
        }
        
        // Hide text content
        const textElements = sidebar.querySelectorAll('.sidebar-logo span, .nav-text, .nav-section-title');
        textElements.forEach(el => {
            el.style.display = 'none';
        });
        
        // Update button
        if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.textContent = '<i class="fas fa-bars"></i>' /* Replaced innerHTML with textContent for safety */
        }
        
        console.log('✅ Sidebar COLLAPSED to 60px');
        
    } else {
        // EXPANDED STATE - EXACT SIZES
        sidebar.style.width = '250px';
        sidebar.style.minWidth = '250px';
        sidebar.style.maxWidth = '250px';
        sidebar.style.overflow = 'visible';
        
        if (mainContent) {
            mainContent.style.marginLeft = '250px';
            mainContent.style.width = 'calc(100% - 250px)';
            mainContent.style.transition = 'margin-left 0.3s ease, width 0.3s ease';
        }
        
        if (dashboardContainer) {
            dashboardContainer.style.marginLeft = '250px';
            dashboardContainer.style.width = 'calc(100% - 250px)';
            dashboardContainer.style.transition = 'margin-left 0.3s ease, width 0.3s ease';
        }
        
        // Show text content
        const textElements = sidebar.querySelectorAll('.sidebar-logo span, .nav-text, .nav-section-title');
        textElements.forEach(el => {
            el.style.display = '';
        });
        
        // Update button
        if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', 'true');
            toggleButton.textContent = '<i class="fas fa-times"></i>' /* Replaced innerHTML with textContent for safety */
        }
        
        console.log('✅ Sidebar EXPANDED to 250px');
    }
    
    // Force layout recalculation to prevent size issues
    if (dashboardContainer) {
        dashboardContainer.style.display = 'none';
        dashboardContainer.offsetHeight; // This forces reflow
        dashboardContainer.style.display = 'block';
    }
    
    // Save preference
    localStorage.setItem('sidebar-collapsed', willBeCollapsed);
    
    // Trigger custom event
    window.dispatchEvent(new CustomEvent('sidebarToggle', {
        detail: { collapsed: willBeCollapsed, timestamp: Date.now() }
    }));
    
    // Show notification
    showNotification(`Sidebar ${willBeCollapsed ? 'collapsed' : 'expanded'} (${willBeCollapsed ? '60px' : '250px'})`, 'success');
};

// Force restore function - call this if sidebar gets stuck
window.forceRestoreSidebar = function() {
    console.log('🔧 Force restoring sidebar...');
    
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    if (!sidebar) {
        console.error('❌ Cannot restore - sidebar not found');
        return;
    }
    
    // Get saved preference
    const shouldBeCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    
    console.log(`Restoring to ${shouldBeCollapsed ? 'collapsed' : 'expanded'} state`);
    
    // Apply the correct state with exact sizes
    if (shouldBeCollapsed) {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '60px';
        sidebar.style.minWidth = '60px';
        sidebar.style.maxWidth = '60px';
        
        if (mainContent) {
            mainContent.classList.add('expanded');
            mainContent.style.marginLeft = '60px';
            mainContent.style.width = 'calc(100% - 60px)';
        }
        
        if (dashboardContainer) {
            dashboardContainer.classList.add('expanded');
            dashboardContainer.style.marginLeft = 'init';
            dashboardContainer.style.width = 'init';
            setTimeout(() => {
                dashboardContainer.style.marginLeft = '60px';
                dashboardContainer.style.width = 'calc(100% - 60px)';
            }, 50);
        }
        
        // Hide text
        const textElements = sidebar.querySelectorAll('.sidebar-logo span, .nav-text, .nav-section-title');
        textElements.forEach(el => {
            el.style.display = 'none';
        });
        
        // Update button
        const toggleButton = document.querySelector('.sidebar-toggle');
        if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.textContent = '<i class="fas fa-bars"></i>' /* Replaced innerHTML with textContent for safety */
        }
        
    } else {
        sidebar.classList.remove('collapsed');
        sidebar.style.width = '250px';
        sidebar.style.minWidth = '250px';
        sidebar.style.maxWidth = '250px';
        
        if (mainContent) {
            mainContent.classList.remove('expanded');
            mainContent.style.marginLeft = '250px';
            mainContent.style.width = 'calc(100% - 250px)';
        }
        
        if (dashboardContainer) {
            dashboardContainer.classList.remove('expanded');
            dashboardContainer.style.marginLeft = 'init';
            dashboardContainer.style.width = 'init';
            setTimeout(() => {
                dashboardContainer.style.marginLeft = '250px';
                dashboardContainer.style.width = 'calc(100% - 250px)';
            }, 50);
        }
        
        // Show text
        const textElements = sidebar.querySelectorAll('.sidebar-logo span, .nav-text, .nav-section-title');
        textElements.forEach(el => {
            el.style.display = '';
        });
        
        // Update button
        const toggleButton = document.querySelector('.sidebar-toggle');
        if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', 'true');
            toggleButton.textContent = '<i class="fas fa-times"></i>' /* Replaced innerHTML with textContent for safety */
        }
    }
    
    console.log('✅ Sidebar force-restored');
    showNotification('Sidebar force-restored to proper size', 'success');
};

// Auto-fix on page load
function autoFixDashboardSidebar() {
    console.log('🔧 Auto-fixing dashboard sidebar...');
    
    setTimeout(() => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            const currentWidth = window.getComputedStyle(sidebar).width;
            console.log(`Current sidebar width: ${currentWidth}`);
            
            // If width is invalid, force restore
            if (currentWidth === '0px' || currentWidth === 'auto' || parseInt(currentWidth) < 50) {
                console.log('⚠️ Sidebar has invalid width, forcing restore...');
                forceRestoreSidebar();
            } else {
                console.log('✅ Sidebar width looks OK');
            }
        }
    }, 2000);
}

// Size monitoring
function monitorSidebarSize() {
    setInterval(() => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            const width = window.getComputedStyle(sidebar).width;
            const numericWidth = parseInt(width);
            
            // Auto-fix if size is wrong
            if (numericWidth < 50 && !sidebar.classList.contains('collapsed')) {
                console.log('🔧 Sidebar too small, auto-fixing...');
                forceRestoreSidebar();
            }
        }
    }, 5000);
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.alert-dismissible');
    existing.forEach(el => el.remove());
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.textContent = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    ` /* Replaced innerHTML with textContent for safety */
    
    document.body.appendChild(notification);
    
    // Auto-remove
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Dashboard sidebar button fix loaded');
    
    // Auto-fix on load
    autoFixDashboardSidebar();
    
    // Start monitoring
    monitorSidebarSize();
    
    // Add keyboard shortcut (Ctrl+B)
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            window.toggleSidebar();
        }
    });
    
    console.log('✅ Dashboard sidebar button fix initialized');
});

// Make functions globally available
window.autoFixDashboardSidebar = autoFixDashboardSidebar;
window.monitorSidebarSize = monitorSidebarSize;

console.log('🔧 Dashboard sidebar button fix initialized');
