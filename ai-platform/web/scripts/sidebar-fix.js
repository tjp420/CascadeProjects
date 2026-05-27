// Sidebar Size Fix
// Fixes sidebar toggle issues and ensures proper size restoration

console.log('🔧 Loading sidebar size fix...');

// Enhanced sidebar toggle with proper size management
window.toggleSidebar = function () {
    console.log('🔄 Toggling sidebar with size fix...');
    
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    if (!sidebar || !mainContent) {
        console.warn('Sidebar or main content not found');
        return;
    }
    
    // Check current state
    const _isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
    
    // Toggle the collapsed state
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
    
    // Force layout recalculation
    const newIsCollapsed = sidebar.classList.contains('collapsed');
    
    // Apply explicit size styles
    if (newIsCollapsed) {
        // Collapsed state
        sidebar.style.width = '60px';
        sidebar.style.minWidth = '60px';
        sidebar.style.maxWidth = '60px';
        mainContent.style.marginLeft = '60px';
        mainContent.style.width = `calc(100% - 60px)`;
        
        // Hide sidebar content
        const sidebarContent = sidebar.querySelectorAll('.sidebar-content, .nav-text, .sidebar-text');
        sidebarContent.forEach(el => {
            el.style.display = 'none';
        });
        
        // Show only icons
        const sidebarIcons = sidebar.querySelectorAll('.nav-icon, .fa');
        sidebarIcons.forEach(icon => {
            icon.style.display = 'inline-block';
            icon.style.margin = '0 auto';
        });
        
    } else {
        // Expanded state
        sidebar.style.width = '250px';
        sidebar.style.minWidth = '250px';
        sidebar.style.maxWidth = '250px';
        mainContent.style.marginLeft = '250px';
        mainContent.style.width = `calc(100% - 250px)`;
        
        // Restore sidebar content
        const sidebarContent = sidebar.querySelectorAll('.sidebar-content, .nav-text, .sidebar-text');
        sidebarContent.forEach(el => {
            el.style.display = 'block';
        });
        
        // Restore icon positioning
        const sidebarIcons = sidebar.querySelectorAll('.nav-icon, .fa');
        sidebarIcons.forEach(icon => {
            icon.style.margin = '';
            icon.style.display = '';
        });
    }
    
    // Update dashboard container if it exists
    if (dashboardContainer) {
        dashboardContainer.style.width = newIsCollapsed ? 
            'calc(100% - 60px)' : 'calc(100% - 250px)';
        dashboardContainer.style.marginLeft = newIsCollapsed ? '60px' : '250px';
        
        // Force reflow
        dashboardContainer.style.display = 'none';
        dashboardContainer.offsetHeight; // Trigger reflow
        dashboardContainer.style.display = 'block';
    }
    
    // Save preference to localStorage
    localStorage.setItem('sidebar-collapsed', newIsCollapsed);
    
    // Trigger resize event to notify other components
    window.dispatchEvent(new CustomEvent('sidebarToggle', {
        detail: { collapsed: newIsCollapsed }
    }));
    
    console.log(`Sidebar ${newIsCollapsed ? 'collapsed' : 'expanded'} - size restored`);
    
    // Show notification
    showNotification(`Sidebar ${newIsCollapsed ? 'collapsed' : 'expanded'}`, 'info');
};

// Force sidebar size restoration
window.forceSidebarRestore = function() {
    console.log('🔧 Forcing sidebar size restoration...');
    
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    if (!sidebar || !mainContent) {
        console.warn('Sidebar elements not found for restoration');
        return;
    }
    
    // Get saved preference
    const shouldBeCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    
    // Apply the correct state
    if (shouldBeCollapsed) {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
        
        // Apply collapsed styles
        sidebar.style.width = '60px';
        sidebar.style.minWidth = '60px';
        sidebar.style.maxWidth = '60px';
        mainContent.style.marginLeft = '60px';
        mainContent.style.width = `calc(100% - 60px)`;
        
        if (dashboardContainer) {
            dashboardContainer.style.marginLeft = '60px';
            dashboardContainer.style.width = 'calc(100% - 60px)';
        }
        
    } else {
        sidebar.classList.remove('collapsed');
        mainContent.classList.remove('expanded');
        
        // Apply expanded styles
        sidebar.style.width = '250px';
        sidebar.style.minWidth = '250px';
        sidebar.style.maxWidth = '250px';
        mainContent.style.marginLeft = '250px';
        mainContent.style.width = `calc(100% - 250px)`;
        
        if (dashboardContainer) {
            dashboardContainer.style.marginLeft = '250px';
            dashboardContainer.style.width = 'calc(100% - 250px)';
        }
    }
    
    console.log('✅ Sidebar size force-restored');
    showNotification('Sidebar size restored', 'success');
};

// Auto-fix sidebar on page load
function autoFixSidebar() {
    console.log('🔧 Auto-fixing sidebar on load...');
    
    // Wait for DOM to be ready
    setTimeout(() => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            // Check if sidebar has proper styles
            const computedWidth = window.getComputedStyle(sidebar).width;
            
            if (computedWidth === '0px' || computedWidth === 'auto') {
                console.log('⚠️ Sidebar has no width, applying fix...');
                forceSidebarRestore();
            } else {
                console.log('✅ Sidebar width is OK:', computedWidth);
            }
        }
    }, 1000);
}

// Add resize observer to maintain proper sizes
function addResizeObserver() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (!sidebar || !mainContent) return;
    
    const resizeObserver = new ResizeObserver(entries => {
        entries.forEach(entry => {
            const { width } = entry.contentRect;
            
            // Maintain minimum sizes
            const isCollapsed = sidebar.classList.contains('collapsed');
            const expectedWidth = isCollapsed ? 60 : 250;
            
            if (width < expectedWidth - 10) { // Allow some tolerance
                console.log('🔧 Sidebar too small, fixing...');
                if (isCollapsed) {
                    sidebar.style.width = '60px';
                    sidebar.style.minWidth = '60px';
                } else {
                    sidebar.style.width = '250px';
                    sidebar.style.minWidth = '250px';
                }
            }
        });
    });
    
    resizeObserver.observe(sidebar);
    console.log('✅ Resize observer added for sidebar');
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

// Initialize sidebar fix when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Sidebar fix loaded');
    
    // Auto-fix sidebar on load
    autoFixSidebar();
    
    // Add resize observer
    addResizeObserver();
    
    // Add keyboard shortcut for sidebar toggle (Ctrl+B)
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            window.toggleSidebar();
        }
    });
    
    // Listen for sidebar toggle events
    window.addEventListener('sidebarToggle', function(e) {
        console.log('📡 Sidebar toggle event received:', e.detail);
        
        // Ensure dashboard container responds properly
        setTimeout(() => {
            const dashboardContainer = document.querySelector('.dashboard-container');
            if (dashboardContainer) {
                const isCollapsed = e.detail.collapsed;
                dashboardContainer.style.transition = 'all 0.3s ease';
                
                if (isCollapsed) {
                    dashboardContainer.style.marginLeft = '60px';
                    dashboardContainer.style.width = 'calc(100% - 60px)';
                } else {
                    dashboardContainer.style.marginLeft = '250px';
                    dashboardContainer.style.width = 'calc(100% - 250px)';
                }
            }
        }, 100);
    });
    
    console.log('✅ Sidebar fix initialized');
});

// Make functions globally available
window.forceSidebarRestore = forceSidebarRestore;
window.autoFixSidebar = autoFixSidebar;

console.log('🔧 Sidebar fix initialized');
