// Force Sidebar Restore - Direct and Forceful
// This will definitely restore the sidebar to full size

console.log('🔧 Loading force sidebar restore...');

// Direct DOM manipulation approach - no dependencies
function forceSidebarRestoreNow() {
    console.log('🔧 Force restoring sidebar to full size...');
    
    // Get the sidebar element
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const toggleButton = document.querySelector('.sidebar-toggle');
    
    if (!sidebar) {
        console.error('❌ Sidebar not found');
        return;
    }
    
    // Remove collapsed class if present
    sidebar.classList.remove('collapsed');
    
    // Set expanded styles directly - no CSS classes needed
    sidebar.style.width = '250px';
    sidebar.style.minWidth = '250px';
    sidebar.style.maxWidth = '250px';
    sidebar.style.overflow = 'visible';
    sidebar.style.display = 'block';
    sidebar.style.visibility = 'visible';
    
    // Update main content
    if (mainContent) {
        mainContent.classList.remove('expanded');
        mainContent.style.marginLeft = '250px';
        mainContent.style.width = 'calc(100% - 250px)';
        mainContent.style.display = 'block';
        mainContent.style.visibility = 'visible';
    }
    
    // Update dashboard container
    if (dashboardContainer) {
        dashboardContainer.classList.remove('expanded');
        dashboardContainer.style.marginLeft = '250px';
        dashboardContainer.style.width = 'calc(100% - 250px)';
        dashboardContainer.style.display = 'block';
        dashboardContainer.style.visibility = 'visible';
    }
    
    // Show all text content
    const textElements = sidebar.querySelectorAll('span, .nav-text, .nav-section-title');
    textElements.forEach(function(el) {
            el.style.display = '';
            el.style.visibility = 'visible';
        });
    
    // Update toggle button
    if (toggleButton) {
        toggleButton.setAttribute('aria-expanded', 'true');
        toggleButton.textContent = '<i class="fas fa-times"></i>' /* Replaced innerHTML with textContent for safety */
        toggleButton.style.display = 'block';
        toggleButton.style.visibility = 'visible';
    }
    
    // Remove any inline styles that might be causing issues
    const styleElements = sidebar.querySelectorAll('[style]');
    styleElements.forEach(function(el) {
        // Keep necessary styles but remove problematic ones
        const style = el.getAttribute('style') || '';
        if (style.includes('width: 0') || style.includes('width: auto')) {
            el.style.width = '250px';
        }
    });
    
    // Force reflow to ensure changes take effect
    if (dashboardContainer) {
        dashboardContainer.style.display = 'none';
        dashboardContainer.offsetHeight; // Forces reflow
        dashboardContainer.style.display = 'block';
    }
    
    // Update localStorage
    localStorage.setItem('sidebar-collapsed', 'false');
    
    console.log('✅ Sidebar forced to FULL SIZE (250px)');
    console.log('✅ Main content adjusted to full width');
    console.log('✅ Dashboard container adjusted to full width');
    
    // Show success notification
    showNotification('Sidebar restored to full size (250px)', 'success');
    
    return true;
}

// Override the toggleSidebar function completely
window.toggleSidebar = function() {
    console.log('🔄 Toggle sidebar - forcing proper behavior...');
    
    const sidebar = document.getElementById('sidebar');
    
    if (!sidebar) {
        console.error('❌ Sidebar not found');
        return;
    }
    
    // Check current state
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    if (isCollapsed) {
        // Expand to full size
        console.log('📐 Expanding sidebar to full size...');
        forceSidebarRestoreNow();
    } else {
        // Collapse to compact size
        console.log('📐 Collapsing sidebar to compact size...');
        
        sidebar.classList.add('collapsed');
        sidebar.style.width = '60px';
        sidebar.style.minWidth = '60px';
        sidebar.style.maxWidth = '60px';
        
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.add('expanded');
            mainContent.style.marginLeft = '60px';
            mainContent.style.width = 'calc(100% - 60px)';
        }
        
        const dashboardContainer = document.querySelector('.dashboard-container');
        if (dashboardContainer) {
            dashboardContainer.classList.add('expanded');
            dashboardContainer.style.marginLeft = '60px';
            dashboardContainer.style.width = 'calc(100% - 60px)';
        }
        
        // Hide text content
        const textElements = sidebar.querySelectorAll('span, .nav-text, .nav-section-title');
        textElements.forEach(function(el) {
            el.style.display = 'none';
        });
        
        // Update button
        const toggleButton = document.querySelector('.sidebar-toggle');
        if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.textContent = '<i class="fas fa-bars"></i>' /* Replaced innerHTML with textContent for safety */
        }
        
        console.log('✅ Sidebar collapsed to compact size (60px)');
        showNotification('Sidebar collapsed to compact size (60px)', 'info');
    }
    
    return true;
}

// Auto-restore on page load
function autoRestoreSidebar() {
    console.log('🔧 Auto-restore sidebar on page load...');
    
    setTimeout(function() {
        forceSidebarRestoreNow();
    }, 1000);
}

// Continuous monitoring
function monitorSidebarState() {
    setInterval(function() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            const width = window.getComputedStyle(sidebar).width;
            const numericWidth = parseInt(width);
            
            // If sidebar is collapsed but has wrong width, force restore
            if (sidebar.classList.contains('collapsed') && numericWidth > 70) {
                console.log('🔧 Collapsed sidebar has wrong width, fixing...');
                forceSidebarRestoreNow();
            }
            
            // If sidebar is expanded but has wrong width, force restore
            if (!sidebar.classList.contains('collapsed') && (numericWidth < 200 || numericWidth > 300)) {
                console.log('🔧 Expanded sidebar has wrong width, fixing...');
                forceSidebarRestoreNow();
            }
        }
    }, 3000);
}

// Emergency restore function - call this if everything else fails
window.emergencySidebarRestore = function() {
    console.log('🚨 EMERGENCY: Force restoring sidebar...');
    
    // Try multiple approaches
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        console.error('❌ Emergency restore failed - no sidebar found');
        return false;
    }
    
    // Approach 1: Direct style override
    sidebar.style.setProperty('width', '250px', 'important');
    sidebar.style.setProperty('min-width', '250px', 'important');
    sidebar.style.setProperty('max-width', '250px', 'important');
    sidebar.style.setProperty('display', 'block', 'important');
    
    // Approach 2: Remove collapsed class
    sidebar.classList.remove('collapsed');
    
    // Approach 3: Clear all inline styles that might be interfering
    sidebar.removeAttribute('style');
    
    // Reapply correct styles
    sidebar.style.width = '250px';
    sidebar.style.minWidth = '250px';
    sidebar.style.maxWidth = '250px';
    sidebar.style.overflow = 'visible';
    
    console.log('🚨 Emergency restore completed');
    showNotification('Emergency sidebar restore completed', 'warning');
    
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

// Initialize immediately
console.log('🔧 Force sidebar restore loaded');

// Auto-restore on page load
autoRestoreSidebar();

// Start monitoring
monitorSidebarState();

// Make emergency function available globally
window.emergencySidebarRestore = emergencySidebarRestore;

console.log('🔧 Force sidebar restore ready');
