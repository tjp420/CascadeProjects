// Navigation Scroll Fix
// Restores scroll functionality while maintaining accessibility

console.log('🔧 Loading navigation scroll fix...');

// Fix navigation scroll functionality
window.fixNavigationScroll = function() {
    console.log('🔧 Fixing navigation scroll functionality...');
    
    const sidebar = document.getElementById('sidebar');
    const sidebarNav = document.querySelector('.sidebar-nav');
    const navItems = document.querySelectorAll('.nav-item');
    
    if (!sidebar || !sidebarNav) {
        console.error('❌ Sidebar or navigation not found');
        return false;
    }
    
    console.log('Found ' + navItems.length + ' navigation items');
    
    // Restore sidebar scroll functionality
    sidebar.style.overflowY = 'auto';
    sidebar.style.overflowX = 'hidden';
    sidebar.style.height = '100vh';
    sidebar.style.maxHeight = '100vh';
    
    // Fix navigation container for scrolling
    sidebarNav.style.overflowY = 'auto';
    sidebarNav.style.overflowX = 'hidden';
    sidebarNav.style.height = 'calc(100vh - 80px)'; // Account for header
    sidebarNav.style.maxHeight = 'calc(100vh - 80px)';
    sidebarNav.style.display = 'block';
    sidebarNav.style.visibility = 'visible';
    sidebarNav.style.opacity = '1';
    sidebarNav.style.pointerEvents = 'auto';
    sidebarNav.style.position = 'relative';
    sidebarNav.style.zIndex = '1000';
    sidebarNav.style.width = '100%';
    sidebarNav.style.paddingBottom = '20px'; // Space for last items
    
    // Ensure all navigation items are still accessible
    navItems.forEach(function(item, index) {
        // Keep accessibility fixes but ensure scroll works
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.padding = '15px';
        item.style.margin = '5px 0';
        item.style.cursor = 'pointer';
        item.style.pointerEvents = 'auto';
        item.style.visibility = 'visible';
        item.style.opacity = '1';
        item.style.position = 'relative';
        item.style.zIndex = '1001';
        
        // Ensure proper spacing for scroll
        item.style.minHeight = '50px';
        item.style.width = '100%';
        item.style.boxSizing = 'border-box';
        
        // Remove any blocking styles
        item.classList.remove('hidden', 'disabled');
        
        // Add hover effects
        item.addEventListener('mouseenter', function() {
            this.style.backgroundColor = 'rgba(255,255,255,0.1)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '';
        });
        
        // Ensure click events work
        item.addEventListener('click', function(e) {
            console.log('Navigation item clicked:', this.textContent.trim());
            
            // Remove active class from all items
            navItems.forEach(function(navItem) {
                navItem.classList.remove('active');
            });
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Prevent default if it's an anchor
            if (this.tagName === 'A') {
                e.preventDefault();
            }
        });
        
        console.log('Fixed navigation item ' + (index + 1) + ' for scrolling');
    });
    
    // Fix navigation text for scroll
    const navTexts = document.querySelectorAll('.nav-text');
    navTexts.forEach(function(text, _index) {
        text.style.display = 'inline';
        text.style.visibility = 'visible';
        text.style.opacity = '1';
        text.style.pointerEvents = 'none';
        text.style.marginLeft = '15px';
        text.style.fontSize = '14px';
        text.style.color = 'white';
        text.style.lineHeight = '1.4';
        text.style.whiteSpace = 'nowrap';
        text.style.overflow = 'hidden';
        text.style.textOverflow = 'ellipsis';
    });
    
    // Fix navigation icons for scroll
    const navIcons = document.querySelectorAll('.nav-icon');
    navIcons.forEach(function(icon, _index) {
        icon.style.display = 'inline-block';
        icon.style.visibility = 'visible';
        icon.style.opacity = '1';
        icon.style.width = '20px';
        icon.style.height = '20px';
        icon.style.pointerEvents = 'none';
        icon.style.color = 'white';
        icon.style.marginRight = '15px';
        icon.style.flexShrink = '0';
    });
    
    // Fix navigation sections for scroll
    const navSections = document.querySelectorAll('.nav-section');
    navSections.forEach(function(section, index) {
        section.style.display = 'block';
        section.style.visibility = 'visible';
        section.style.opacity = '1';
        section.style.pointerEvents = 'auto';
        section.style.position = 'relative';
        section.style.zIndex = '1000';
        section.style.width = '100%';
        section.style.marginBottom = '10px';
        
        const sectionTitle = section.querySelector('.nav-section-title');
        if (sectionTitle) {
            sectionTitle.style.display = 'block';
            sectionTitle.style.visibility = 'visible';
            sectionTitle.style.opacity = '1';
            sectionTitle.style.color = '#888';
            sectionTitle.style.fontSize = '12px';
            sectionTitle.style.textTransform = 'uppercase';
            sectionTitle.style.marginBottom = '10px';
            sectionTitle.style.padding = '0 15px';
            sectionTitle.style.lineHeight = '1.5';
            sectionTitle.style.whiteSpace = 'nowrap';
        }
        
        console.log('Fixed nav section ' + (index + 1) + ' for scrolling');
    });
    
    // Add custom scrollbar styling
    const style = document.createElement('style');
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
        .sidebar-nav::-webkit-scrollbar {
            width: 8px;
        }
        .sidebar-nav::-webkit-scrollbar-track {
            background: #2c3e50;
        }
        .sidebar-nav::-webkit-scrollbar-thumb {
            background: #34495e;
            border-radius: 4px;
        }
        .sidebar-nav::-webkit-scrollbar-thumb:hover {
            background: #4a5f7a;
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
    `;
    document.head.appendChild(style);
    
    // Test scroll functionality
    setTimeout(function() {
        console.log('🧪 Testing navigation scroll functionality...');
        
        const scrollHeight = sidebarNav.scrollHeight;
        const clientHeight = sidebarNav.clientHeight;
        const canScroll = scrollHeight > clientHeight;
        
        console.log('Navigation scroll test results:');
        console.log('✅ Scroll height:', scrollHeight + 'px');
        console.log('✅ Client height:', clientHeight + 'px');
        console.log('✅ Can scroll:', canScroll);
        console.log('✅ Navigation items accessible:', navItems.length);
        
        if (canScroll) {
            console.log('✅ Scroll functionality working');
            showNotification('Navigation scroll restored - ' + navItems.length + ' menu options accessible', 'success');
        } else {
            console.log('ℹ️ All items fit in view, no scroll needed');
            showNotification('All menu options visible - no scroll needed', 'info');
        }
    }, 500);
    
    return true;
};

// Enhanced navigateTo function with scroll handling
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
        
        // Scroll to make the active item visible if needed
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (sidebarNav) {
            const elementTop = element.offsetTop;
            const elementHeight = element.offsetHeight;
            const scrollTop = sidebarNav.scrollTop;
            const viewportHeight = sidebarNav.clientHeight;
            
            // Check if element is outside viewport
            if (elementTop < scrollTop || elementTop + elementHeight > scrollTop + viewportHeight) {
                // Scroll element into view
                const targetScroll = elementTop - (viewportHeight / 2) + (elementHeight / 2);
                sidebarNav.scrollTo({
                    top: targetScroll,
                    behavior: 'smooth'
                });
                console.log('📜 Scrolled to active navigation item');
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

// Auto-fix scroll on page load
function autoFixNavigationScroll() {
    console.log('🔧 Auto-fixing navigation scroll...');
    
    setTimeout(function() {
        fixNavigationScroll();
    }, 2000);
}

// Monitor scroll functionality
function monitorNavigationScroll() {
    setInterval(function() {
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (sidebarNav) {
            const scrollHeight = sidebarNav.scrollHeight;
            const clientHeight = sidebarNav.clientHeight;
            const canScroll = scrollHeight > clientHeight;
            
            // Check if scroll is disabled when it shouldn't be
            if (canScroll && sidebarNav.style.overflowY === 'hidden') {
                console.log('🔧 Scroll disabled when needed, fixing...');
                fixNavigationScroll();
            }
        }
    }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Navigation scroll fix loaded');
    
    // Auto-fix on load
    autoFixNavigationScroll();
    
    // Start monitoring
    monitorNavigationScroll();
    
    console.log('✅ Navigation scroll fix initialized');
});

// Make functions globally available
window.fixNavigationScroll = fixNavigationScroll;
window.autoFixNavigationScroll = autoFixNavigationScroll;
window.monitorNavigationScroll = monitorNavigationScroll;

console.log('🔧 Navigation scroll fix initialized');
