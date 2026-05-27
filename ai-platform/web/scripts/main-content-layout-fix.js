// Main Content Layout Fix
// Fixes main content positioning and sidebar integration

console.log('🔧 Loading main content layout fix...');

// Fix main content layout and positioning
window.fixMainContentLayout = function() {
    console.log('🔧 Fixing main content layout and positioning...');
    
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    if (!mainContent) {
        console.error('❌ Main content not found');
        return false;
    }
    
    console.log('Found main content, fixing layout...');
    
    // Get sidebar width
    const sidebarWidth = sidebar ? sidebar.offsetWidth : 250;
    const isCollapsed = sidebar ? sidebar.classList.contains('collapsed') : false;
    const actualSidebarWidth = isCollapsed ? 60 : sidebarWidth;
    
    console.log('Sidebar measurements:');
    console.log('✅ Sidebar width:', sidebarWidth + 'px');
    console.log('✅ Is collapsed:', isCollapsed);
    console.log('✅ Actual sidebar width:', actualSidebarWidth + 'px');
    
    // Fix main content positioning
    mainContent.style.marginLeft = actualSidebarWidth + 'px';
    mainContent.style.width = 'calc(100% - ' + actualSidebarWidth + 'px)';
    mainContent.style.display = 'block';
    mainContent.style.visibility = 'visible';
    mainContent.style.opacity = '1';
    mainContent.style.position = 'relative';
    mainContent.style.transition = 'margin-left 0.3s ease, width 0.3s ease';
    mainContent.style.overflow = 'visible';
    
    // Fix dashboard container if it exists
    if (dashboardContainer) {
        dashboardContainer.style.marginLeft = actualSidebarWidth + 'px';
        dashboardContainer.style.width = 'calc(100% - ' + actualSidebarWidth + 'px)';
        dashboardContainer.style.display = 'block';
        dashboardContainer.style.visibility = 'visible';
        dashboardContainer.style.opacity = '1';
        dashboardContainer.style.position = 'relative';
        dashboardContainer.style.transition = 'margin-left 0.3s ease, width 0.3s ease';
        dashboardContainer.style.overflow = 'visible';
    }
    
    // Ensure main content is properly positioned
    mainContent.style.left = '0px';
    mainContent.style.right = '0px';
    mainContent.style.top = '0px';
    mainContent.style.bottom = 'auto';
    
    // Remove any problematic positioning
    mainContent.style.position = 'relative';
    mainContent.style.transform = 'none';
    mainContent.style.translateX = '0px';
    mainContent.style.translateY = '0px';
    
    // Ensure content is visible
    const contentElements = mainContent.querySelectorAll('div, section, article, header, main');
    contentElements.forEach(function(el) {
        el.style.display = '';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
    });
    
    // Test the fix
    setTimeout(function() {
        console.log('🧪 Testing main content layout fix...');
        
        const mainContentRect = mainContent.getBoundingClientRect();
        const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : { width: 250, height: 0 };
        
        console.log('Layout test results:');
        console.log('✅ Main content left position:', mainContentRect.left + 'px');
        console.log('✅ Main content width:', mainContentRect.width + 'px');
        console.log('✅ Sidebar width:', sidebarRect.width + 'px');
        console.log('✅ Main content margin-left:', window.getComputedStyle(mainContent).marginLeft);
        console.log('✅ Main content width (computed):', window.getComputedStyle(mainContent).width);
        
        const isPositionedCorrectly = mainContentRect.left >= sidebarRect.width - 5; // Allow 5px tolerance
        const hasCorrectWidth = mainContentRect.width > 0;
        
        if (isPositionedCorrectly && hasCorrectWidth) {
            console.log('✅ Main content layout successfully fixed');
            showNotification('Main content layout fixed - dashboard properly positioned', 'success');
        } else {
            console.log('⚠️ Main content layout may still have issues');
            showNotification('Main content layout may need further adjustment', 'warning');
        }
    }, 500);
    
    return true;
};

// Enhanced toggleSidebar that also fixes main content
window.toggleSidebar = function() {
    console.log('🔄 Toggling sidebar with main content fix...');
    
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const toggleButton = document.querySelector('.sidebar-toggle');
    
    if (!sidebar || !mainContent) {
        console.error('❌ Sidebar or main content not found');
        return;
    }
    
    // Check current state
    const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
    const willBeCollapsed = !isCurrentlyCollapsed;
    
    console.log('Current state: ' + (isCurrentlyCollapsed ? 'collapsed' : 'expanded') + ', will become: ' + (willBeCollapsed ? 'collapsed' : 'expanded'));
    
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
    
    // Apply exact size styles
    if (willBeCollapsed) {
        // COLLAPSED STATE
        const collapsedWidth = 60;
        sidebar.style.width = collapsedWidth + 'px';
        sidebar.style.minWidth = collapsedWidth + 'px';
        sidebar.style.maxWidth = collapsedWidth + 'px';
        sidebar.style.overflow = 'hidden';
        
        if (mainContent) {
            mainContent.style.marginLeft = collapsedWidth + 'px';
            mainContent.style.width = 'calc(100% - ' + collapsedWidth + 'px)';
        }
        
        if (dashboardContainer) {
            dashboardContainer.style.marginLeft = collapsedWidth + 'px';
            dashboardContainer.style.width = 'calc(100% - ' + collapsedWidth + 'px)';
        }
        
        // Hide text content
        const textElements = sidebar.querySelectorAll('.sidebar-logo span, .nav-text, .nav-section-title');
        textElements.forEach(function(el) {
            el.style.display = 'none';
        });
        
        // Update button
        if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.textContent = '<i class="fas fa-bars"></i>' /* Replaced innerHTML with textContent for safety */
        }
        
        console.log('✅ Sidebar COLLAPSED to ' + collapsedWidth + 'px');
        
    } else {
        // EXPANDED STATE
        const expandedWidth = 250;
        sidebar.style.width = expandedWidth + 'px';
        sidebar.style.minWidth = expandedWidth + 'px';
        sidebar.style.maxWidth = expandedWidth + 'px';
        sidebar.style.overflow = 'visible';
        
        if (mainContent) {
            mainContent.style.marginLeft = expandedWidth + 'px';
            mainContent.style.width = 'calc(100% - ' + expandedWidth + 'px)';
        }
        
        if (dashboardContainer) {
            dashboardContainer.style.marginLeft = expandedWidth + 'px';
            dashboardContainer.style.width = 'calc(100% - ' + expandedWidth + 'px)';
        }
        
        // Show text content
        const textElements = sidebar.querySelectorAll('.sidebar-logo span, .nav-text, .nav-section-title');
        textElements.forEach(function(el) {
            el.style.display = '';
        });
        
        // Update button
        if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', 'true');
            toggleButton.textContent = '<i class="fas fa-times"></i>' /* Replaced innerHTML with textContent for safety */
        }
        
        console.log('✅ Sidebar EXPANDED to ' + expandedWidth + 'px');
    }
    
    // Force layout recalculation
    if (mainContent) {
        mainContent.style.display = 'none';
        mainContent.offsetHeight; // Forces reflow
        mainContent.style.display = 'block';
    }
    
    if (dashboardContainer) {
        dashboardContainer.style.display = 'none';
        dashboardContainer.offsetHeight; // Forces reflow
        dashboardContainer.style.display = 'block';
    }
    
    // Save preference
    localStorage.setItem('sidebar-collapsed', willBeCollapsed);
    
    // Trigger custom event
    window.dispatchEvent(new CustomEvent('sidebarToggle', {
        detail: { collapsed: willBeCollapsed, timestamp: Date.now() }
    }));
    
    console.log('✅ Sidebar toggle with main content fix completed');
    showNotification('Sidebar ' + (willBeCollapsed ? 'collapsed' : 'expanded') + ' - main content adjusted', 'info');
    
    return true;
};

// Force main content layout fix
window.forceMainContentFix = function() {
    console.log('🔧 Force fixing main content layout...');
    
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.getElementById('sidebar');
    
    if (!mainContent) {
        console.error('❌ Main content not found');
        return false;
    }
    
    // Reset main content positioning
    mainContent.style.removeProperty('position');
    mainContent.style.removeProperty('transform');
    mainContent.style.removeProperty('translateX');
    mainContent.style.removeProperty('translateY');
    mainContent.style.removeProperty('left');
    mainContent.style.removeProperty('right');
    mainContent.style.removeProperty('top');
    mainContent.style.removeProperty('bottom');
    
    // Set correct positioning
    mainContent.style.position = 'relative';
    mainContent.style.display = 'block';
    mainContent.style.visibility = 'visible';
    mainContent.style.opacity = '1';
    mainContent.style.left = sidebar ? sidebar.offsetWidth + 'px' : '250px';
    mainContent.style.marginLeft = sidebar ? sidebar.offsetWidth + 'px' : '250px';
    mainContent.style.width = 'calc(100% - ' + (sidebar ? sidebar.offsetWidth : 250) + 'px)';
    mainContent.style.top = '0px';
    mainContent.style.right = '0px';
    mainContent.style.bottom = 'auto';
    
    console.log('✅ Main content force-fixed to proper position');
    showNotification('Main content layout force-fixed', 'success');
    
    return true;
};

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

// Auto-fix on page load
function autoFixMainContentLayout() {
    console.log('🔧 Auto-fixing main content layout...');
    
    setTimeout(function() {
        fixMainContentLayout();
    }, 2000);
}

// Monitor main content layout
function monitorMainContentLayout() {
    setInterval(function() {
        const mainContent = document.querySelector('.main-content');
        const sidebar = document.getElementById('sidebar');
        
        if (mainContent && sidebar) {
            const mainContentLeft = mainContent.getBoundingClientRect().left;
            const sidebarRight = sidebar.getBoundingClientRect().right;
            const expectedLeft = sidebarRight;
            
            // Check if main content is misaligned
            if (Math.abs(mainContentLeft - expectedLeft) > 10) {
                console.log('🔧 Main content misaligned, fixing...');
                fixMainContentLayout();
            }
        }
    }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Main content layout fix loaded');
    
    // Auto-fix on load
    autoFixMainContentLayout();
    
    // Start monitoring
    monitorMainContentLayout();
    
    console.log('✅ Main content layout fix initialized');
});

// Make functions globally available
window.fixMainContentLayout = fixMainContentLayout;
window.forceMainContentFix = forceMainContentFix;
window.autoFixMainContentLayout = autoFixMainContentLayout;
window.monitorMainContentLayout = monitorMainContentLayout;

console.log('🔧 Main content layout fix initialized');
