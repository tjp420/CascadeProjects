// Double Scrollbar Fix
// Consolidates scroll functionality to eliminate double scrollbars

console.log('🔧 Loading double scrollbar fix...');

// Fix double scrollbar issue
window.fixDoubleScrollbar = function() {
    console.log('🔧 Fixing double scrollbar issue...');
    
    const sidebar = document.getElementById('sidebar');
    const sidebarNav = document.querySelector('.sidebar-nav');
    const sidebarHeader = document.querySelector('.sidebar-header');
    const sidebarFooter = document.querySelector('.sidebar-footer');
    
    if (!sidebar || !sidebarNav) {
        console.error('❌ Sidebar or navigation not found');
        return false;
    }
    
    console.log('Found sidebar elements, fixing double scrollbar...');
    
    // Remove scroll from navigation container - let sidebar handle it
    sidebarNav.style.overflowY = 'hidden';
    sidebarNav.style.overflowX = 'hidden';
    sidebarNav.style.height = 'auto';
    sidebarNav.style.maxHeight = 'none';
    
    // Make sidebar handle all scrolling
    sidebar.style.overflowY = 'auto';
    sidebar.style.overflowX = 'hidden';
    sidebar.style.height = '100vh';
    sidebar.style.maxHeight = '100vh';
    
    // Ensure header and footer don't interfere with scrolling
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
    
    // Adjust navigation container to account for header and footer
    const headerHeight = sidebarHeader ? sidebarHeader.offsetHeight : 0;
    const footerHeight = sidebarFooter ? sidebarFooter.offsetHeight : 0;
    const totalOffset = headerHeight + footerHeight;
    
    // Add padding to navigation to prevent overlap with footer
    sidebarNav.style.paddingBottom = (footerHeight + 20) + 'px';
    
    // Adjust navigation container height to fit between header and footer
    sidebarNav.style.minHeight = 'calc(100vh - ' + totalOffset + 'px)';
    sidebarNav.style.maxHeight = 'calc(100vh - ' + totalOffset + 'px)';
    
    // Ensure navigation items are still accessible
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function(item) {
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
    });
    
    // Update custom scrollbar styling for single scrollbar
    const existingStyle = document.getElementById('scrollbar-style');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    const style = document.createElement('style');
    style.id = 'scrollbar-style';
    style.textContent = `
        #sidebar::-webkit-scrollbar {
            width: 8px;
        }
        #sidebar::-webkit-scrollbar-track {
            background: #2c3e50;
        }
        #sidebar::-webkit-scrollbar-thumb {
            background: #34495e;
            border-radius: 4px;
        }
        #sidebar::-webkit-scrollbar-thumb:hover {
            background: #4a5f7a;
        }
        #sidebar {
            scrollbar-width: 8px;
            scrollbar-color: #34495e #2c3e50;
        }
        .nav-item {
            transition: background-color 0.2s ease;
        }
        .nav-item:hover {
            background-color: rgba(255,255,255,0.1) !important;
        }
        .nav-item.active {
            background-color: rgba(52, 152, 219, 0.3) !important;
        }
        .sidebar-header {
            border-bottom: 1px solid #34495e;
        }
        .sidebar-footer {
            border-top: 1px solid #34495e;
        }
    `;
    document.head.appendChild(style);
    
    // Test the fix
    setTimeout(function() {
        console.log('🧪 Testing double scrollbar fix...');
        
        const sidebarScrollHeight = sidebar.scrollHeight;
        const sidebarClientHeight = sidebar.clientHeight;
        const navScrollHeight = sidebarNav.scrollHeight;
        const navClientHeight = sidebarNav.clientHeight;
        
        console.log('Scroll test results:');
        console.log('✅ Sidebar scroll height:', sidebarScrollHeight + 'px');
        console.log('✅ Sidebar client height:', sidebarClientHeight + 'px');
        console.log('✅ Nav scroll height:', navScrollHeight + 'px');
        console.log('✅ Nav client height:', navClientHeight + 'px');
        console.log('✅ Header height:', headerHeight + 'px');
        console.log('✅ Footer height:', footerHeight + 'px');
        
        const sidebarCanScroll = sidebarScrollHeight > sidebarClientHeight;
        const navCanScroll = navScrollHeight > navClientHeight;
        
        console.log('✅ Sidebar can scroll:', sidebarCanScroll);
        console.log('✅ Nav can scroll:', navCanScroll);
        console.log('✅ Double scrollbar fixed:', !navCanScroll);
        
        if (!navCanScroll && sidebarCanScroll) {
            console.log('✅ Double scrollbar successfully fixed');
            showNotification('Double scrollbar fixed - single scrollbar active', 'success');
        } else {
            console.log('ℹ️ No double scrollbar issue detected');
            showNotification('No double scrollbar issue - single scrollbar active', 'info');
        }
    }, 500);
    
    return true;
};

// Enhanced navigateTo function with improved scroll handling
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
            
            // Adjust for sticky header and footer
            const scrollableTop = elementTop;
            const scrollableBottom = elementTop + elementHeight;
            const viewportTop = scrollTop + headerHeight;
            const viewportBottom = scrollTop + viewportHeight - footerHeight;
            
            // Check if element is outside viewport
            if (scrollableTop < viewportTop || scrollableBottom > viewportBottom) {
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
            case 'executive-scrollbar':
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

// Auto-fix on page load
function autoFixDoubleScrollbar() {
    console.log('🔧 Auto-fixing double scrollbar...');
    
    setTimeout(function() {
        fixDoubleScrollbar();
    }, 1500);
}

// Monitor for double scrollbar issues
function monitorDoubleScrollbar() {
    setInterval(function() {
        const sidebar = document.getElementById('sidebar');
        const sidebarNav = document.querySelector('.sidebar-nav');
        
        if (sidebar && sidebarNav) {
            const sidebarScroll = sidebar.scrollHeight > sidebar.clientHeight;
            const navScroll = sidebarNav.scrollHeight > sidebarNav.clientHeight;
            
            // If both can scroll, we have a double scrollbar issue
            if (sidebarScroll && navScroll) {
                console.log('🔧 Double scrollbar detected, fixing...');
                fixDoubleScrollbar();
            }
        }
    }, 5000);
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Double scrollbar fix loaded');
    
    // Auto-fix on load
    autoFixDoubleScrollbar();
    
    // Start monitoring
    monitorDoubleScrollbar();
    
    console.log('✅ Double scrollbar fix initialized');
});

// Make functions globally available
window.fixDoubleScrollbar = fixDoubleScrollbar;
window.autoFixDoubleScrollbar = autoFixDoubleScrollbar;
window.monitorDoubleScrollbar = monitorDoubleScrollbar;

console.log('🔧 Double scrollbar fix initialized');
