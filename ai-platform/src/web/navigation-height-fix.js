// Navigation Height Fix
// Fixes incorrect height calculation that cuts off navigation options

console.log('🔧 Loading navigation height fix...');

// Fix navigation height calculation
window.fixNavigationHeight = function() {
    console.log('🔧 Fixing navigation height calculation...');
    
    const sidebar = document.getElementById('sidebar');
    const sidebarNav = document.querySelector('.sidebar-nav');
    const sidebarHeader = document.querySelector('.sidebar-header');
    const sidebarFooter = document.querySelector('.sidebar-footer');
    
    if (!sidebar || !sidebarNav) {
        console.error('❌ Sidebar or navigation not found');
        return false;
    }
    
    console.log('Found sidebar elements, fixing height calculation...');
    
    // Get actual heights of header and footer
    const headerHeight = sidebarHeader ? sidebarHeader.offsetHeight : 0;
    const footerHeight = sidebarFooter ? sidebarFooter.offsetHeight : 0;
    const totalOffset = headerHeight + footerHeight;
    
    console.log('Measured heights:');
    console.log('✅ Header height:', headerHeight + 'px');
    console.log('✅ Footer height:', footerHeight + 'px');
    console.log('✅ Total offset:', totalOffset + 'px');
    
    // Fix the height calculation - it should subtract header and footer heights
    const correctHeight = 'calc(100vh - ' + totalOffset + 'px)';
    
    // Apply correct height to navigation container
    sidebarNav.style.height = correctHeight;
    sidebarNav.style.maxHeight = correctHeight;
    sidebarNav.style.minHeight = correctHeight;
    sidebarNav.style.overflowY = 'auto'; // Re-enable scrolling for navigation
    
    // Remove any incorrect height calculations
    sidebarNav.style.removeProperty('height');
    sidebarNav.style.removeProperty('max-height');
    sidebarNav.style.removeProperty('min-height');
    
    // Apply the correct calculation
    sidebarNav.style.height = correctHeight;
    sidebarNav.style.maxHeight = correctHeight;
    sidebarNav.style.minHeight = correctHeight;
    
    // Ensure sidebar can scroll
    sidebar.style.overflowY = 'auto';
    sidebar.style.overflowX = 'hidden';
    sidebar.style.height = '100vh';
    sidebar.style.maxHeight = '100vh';
    
    // Make header and footer sticky
    if (sidebarHeader) {
        sidebarHeader.style.position = 'sticky';
        sidebarHeader.style.top = '0';
        sidebarHeader.style.zIndex = '10';
        sidebarHeader.style.backgroundColor = '#2c3e50';
        sidebarHeader.style.width = '100%';
    }
    
    if (sidebarFooter) {
        sidebarFooter.style.position = 'sticky';
        sidebarFooter.style.bottom = '0';
        sidebarFooter.style.zIndex = '10';
        sidebarFooter.style.backgroundColor = '#2c3e50';
        sidebarFooter.style.width = '100%';
        sidebarFooter.style.marginTop = 'auto';
    }
    
    // Remove padding that might be causing issues
    sidebarNav.style.paddingBottom = '0px';
    
    // Ensure all navigation items are visible and accessible
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function(item, index) {
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.padding = '15px';
        item.style.margin = '5px 0';
        item.style.cursor = 'pointer';
        item.style.pointerEvents = 'auto';
        item.style.visibility = 'visible';
        item.style.opacity = '1';
        item.style.position = 'relative';
        item.style.zIndex = '1';
        item.style.minHeight = '50px';
        item.style.width = '100%';
        item.style.boxSizing = 'border-box';
        
        console.log('Fixed navigation item ' + (index + 1) + ': ' + (item.textContent || item.querySelector('.nav-text')?.textContent || 'Unknown'));
    });
    
    // Test the fix
    setTimeout(function() {
        console.log('🧪 Testing navigation height fix...');
        
        const navScrollHeight = sidebarNav.scrollHeight;
        const navClientHeight = sidebarNav.clientHeight;
        const navItems = document.querySelectorAll('.nav-item');
        
        console.log('Height test results:');
        console.log('✅ Navigation scroll height:', navScrollHeight + 'px');
        console.log('✅ Navigation client height:', navClientHeight + 'px');
        console.log('✅ Navigation items count:', navItems.length);
        console.log('✅ Calculated height:', correctHeight);
        
        const canScroll = navScrollHeight > navClientHeight;
        const allItemsVisible = navItems.length > 0;
        
        console.log('✅ Can scroll:', canScroll);
        console.log('✅ All items visible:', allItemsVisible);
        
        if (canScroll && allItemsVisible) {
            console.log('✅ Navigation height successfully fixed');
            showNotification('Navigation height fixed - all menu options accessible', 'success');
        } else if (!canScroll && allItemsVisible) {
            console.log('✅ All items fit in view - no scroll needed');
            showNotification('All menu options visible - no scroll needed', 'info');
        } else {
            console.log('⚠️ Navigation height still has issues');
            showNotification('Navigation height may still need adjustment', 'warning');
        }
        
        // Log the final calculated height
        console.log('✅ Final navigation height calculation:', correctHeight);
        console.log('✅ Actual navigation container height:', window.getComputedStyle(sidebarNav).height);
    }, 500);
    
    return true;
};

// Enhanced navigateTo function with better scroll handling
window.navigateTo = function(section, element) {
    console.log('🧭 Navigation to:', section);
    
    // Remove active class from all items
    const allNavItems = document.querySelectorAll('.nav-item');
    allNavItems.forEach(function(item) {
        item.classList.remove('active');
    });
    
    // Add active class to clicked element
    if (element) {
        element.classList.add('active');
        
        // Smooth scroll to make the active item visible
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            const elementTop = element.offsetTop;
            const elementHeight = element.offsetHeight;
            const scrollTop = sidebar.scrollTop;
            const viewportHeight = sidebar.clientHeight;
            const sidebarHeader = document.querySelector('.sidebar-header');
            const headerHeight = sidebarHeader ? sidebarHeader.offsetHeight : 0;
            const sidebarFooter = document.querySelector('.sidebar-footer');
            const footerHeight = sidebarFooter ? sidebarFooter.offsetHeight : 0;
            
            // Calculate visible area
            const visibleTop = scrollTop + headerHeight;
            const visibleBottom = scrollTop + viewportHeight - footerHeight;
            const elementBottom = elementTop + elementHeight;
            
            // Check if element is outside visible area
            if (elementTop < visibleTop || elementBottom > visibleBottom) {
                // Calculate target scroll position
                const targetScroll = elementTop - headerHeight - (viewportHeight / 2) + (elementHeight / 2) + footerHeight;
                
                sidebar.scrollTo({
                    top: Math.max(0, targetScroll),
                    behavior: 'smooth'
                });
                console.log('📜 Smooth scrolled to active navigation item');
            }
        }
    }
    
    // Handle navigation content
    const container = document.querySelector('.dashboard-container');
    if (container) {
        switch (section) {
            case 'overview':
            case 'dashboard':
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
            case 'compliance':
                showComplianceCheck(container);
                break;
            case 'codebase-analysis':
                showCodebaseAnalysis(container);
                break;
            case 'security-scan':
                showSecurityScan(container);
                break;
            case 'scalability':
                showScalabilityReview(container);
                break;
            case 'benchmark':
                showIndustryBenchmark(container);
                break;
            case 'executive-summary':
                showExecutiveSummary(container);
                break;
            case 'deal-timeline':
                showDealTimeline(container);
                break;
            case 'integration-plan':
                showIntegrationPlan(container);
                break;
            default:
                console.log('Unknown section:', section);
                showMainDashboard(container);
        }
    }
    
    console.log('✅ Navigation completed');
    showNotification('Navigated to: ' + section, 'info');
};

// Force height fix function
window.forceNavigationHeightFix = function() {
    console.log('🔧 Force fixing navigation height...');
    
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
        // Remove all height-related styles
        sidebarNav.style.removeProperty('height');
        sidebarNav.style.removeProperty('max-height');
        sidebarNav.style.removeProperty('min-height');
        sidebarNav.style.removeProperty('padding-bottom');
        
        // Set to auto to let content determine height
        sidebarNav.style.height = 'auto';
        sidebarNav.style.maxHeight = 'none';
        sidebarNav.style.minHeight = 'auto';
        
        // Ensure sidebar can scroll
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.style.overflowY = 'auto';
            sidebar.style.height = '100vh';
            sidebar.style.maxHeight = '100vh';
        }
        
        console.log('✅ Force height fix applied');
        showNotification('Navigation height force-fixed to auto', 'success');
    }
    
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
function autoFixNavigationHeight() {
    console.log('🔧 Auto-fixing navigation height...');
    
    setTimeout(function() {
        fixNavigationHeight();
    }, 2000);
}

// Monitor navigation height issues
function monitorNavigationHeight() {
    setInterval(function() {
        const sidebarNav = document.querySelector('.sidebar-nav');
        const navItems = document.querySelectorAll('.nav-item');
        
        if (sidebarNav && navItems.length > 0) {
            const navScrollHeight = sidebarNav.scrollHeight;
            const navClientHeight = sidebarNav.clientHeight;
            const lastItem = navItems[navItems.length - 1];
            const lastItemBottom = lastItem ? lastItem.offsetTop + lastItem.offsetHeight : 0;
            
            // Check if last item is not visible
            if (lastItemBottom > navClientHeight || navScrollHeight < navClientHeight) {
                console.log('🔧 Navigation height issue detected, fixing...');
                fixNavigationHeight();
            }
        }
    }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Navigation height fix loaded');
    
    // Auto-fix on load
    autoFixNavigationHeight();
    
    // Start monitoring
    monitorNavigationHeight();
    
    console.log('✅ Navigation height fix initialized');
});

// Make functions globally available
window.fixNavigationHeight = fixNavigationHeight;
window.autoFixNavigationHeight = autoFixNavigationHeight;
window.monitorNavigationHeight = monitorNavigationHeight;

console.log('🔧 Navigation height fix initialized');
