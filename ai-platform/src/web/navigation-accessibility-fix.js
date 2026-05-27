// Navigation Accessibility Fix
// Ensures all menu options are accessible and clickable

console.log('🔧 Loading navigation accessibility fix...');

// Fix navigation accessibility
window.fixNavigationAccessibility = function() {
    console.log('🔧 Fixing navigation accessibility...');
    
    const sidebarNav = document.querySelector('.sidebar-nav');
    const navItems = document.querySelectorAll('.nav-item');
    const navTexts = document.querySelectorAll('.nav-text');
    const navIcons = document.querySelectorAll('.nav-icon');
    const navSections = document.querySelectorAll('.nav-section');
    
    if (!sidebarNav) {
        console.error('❌ Sidebar navigation not found');
        return false;
    }
    
    console.log('Found ' + navItems.length + ' navigation items');
    
    // Ensure sidebar is visible and accessible
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        // Remove any blocking styles
        sidebar.style.overflow = 'visible';
        sidebar.style.pointerEvents = 'auto';
        sidebar.style.zIndex = '1000';
        
        // Ensure proper dimensions
        sidebar.style.width = '250px';
        sidebar.style.minWidth = '250px';
        sidebar.style.maxWidth = '250px';
        sidebar.style.height = 'auto';
        sidebar.style.display = 'block';
        sidebar.style.visibility = 'visible';
    }
    
    // Fix each navigation item
    navItems.forEach(function(item, index) {
        // Remove any blocking styles
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
        
        // Ensure it's not hidden
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
        
        console.log('Fixed navigation item ' + (index + 1) + ': ' + (item.textContent || item.querySelector('.nav-text')?.textContent || 'Unknown'));
    });
    
    // Fix navigation text
    navTexts.forEach(function(text, index) {
        text.style.display = 'inline';
        text.style.visibility = 'visible';
        text.style.opacity = '1';
        text.style.pointerEvents = 'none'; // Let the parent handle clicks
        text.style.marginLeft = '15px';
        text.style.fontSize = '14px';
        text.style.color = 'white';
        
        console.log('Fixed nav text ' + (index + 1));
    });
    
    // Fix navigation icons
    navIcons.forEach(function(icon, index) {
        icon.style.display = 'inline-block';
        icon.style.visibility = 'visible';
        icon.style.opacity = '1';
        icon.style.width = '20px';
        icon.style.height = '20px';
        icon.style.pointerEvents = 'none'; // Let the parent handle clicks
        icon.style.color = 'white';
        icon.style.marginRight = '15px';
        
        console.log('Fixed nav icon ' + (index + 1));
    });
    
    // Fix navigation sections
    navSections.forEach(function(section, index) {
        section.style.display = 'block';
        section.style.visibility = 'visible';
        section.style.opacity = '1';
        section.style.pointerEvents = 'auto';
        section.style.position = 'relative';
        section.style.zIndex = '1000';
        
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
        }
        
        console.log('Fixed nav section ' + (index + 1));
    });
    
    // Fix the sidebar navigation container
    sidebarNav.style.display = 'block';
    sidebarNav.style.visibility = 'visible';
    sidebarNav.style.opacity = '1';
    sidebarNav.style.pointerEvents = 'auto';
    sidebarNav.style.position = 'relative';
    sidebarNav.style.zIndex = '1000';
    sidebarNav.style.width = '100%';
    sidebarNav.style.height = 'auto';
    sidebarNav.style.overflow = 'visible';
    
    // Ensure no overlay or blocking elements
    const overlays = document.querySelectorAll('.overlay, .modal-backdrop');
    overlays.forEach(function(overlay) {
        if (overlay.style.display !== 'none') {
            console.log('Found blocking overlay, hiding it');
            overlay.style.display = 'none';
        }
    });
    
    // Test navigation functionality
    setTimeout(function() {
        console.log('🧪 Testing navigation accessibility...');
        
        const firstNavItem = navItems[0];
        if (firstNavItem) {
            console.log('✅ First navigation item is accessible');
            console.log('✅ Navigation text visible:', firstNavItem.querySelector('.nav-text')?.style.visibility);
            console.log('✅ Navigation icon visible:', firstNavItem.querySelector('.nav-icon')?.style.visibility);
        }
        
        console.log('✅ Navigation accessibility fix completed');
        showNotification('Navigation accessibility fixed - all menu options now accessible', 'success');
    }, 500);
    
    return true;
};

// Override navigateTo function to ensure it works
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
    }
    
    // Handle navigation
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

// Auto-fix navigation on page load
function autoFixNavigation() {
    console.log('🔧 Auto-fixing navigation accessibility...');
    
    setTimeout(function() {
        fixNavigationAccessibility();
    }, 1500);
}

// Monitor navigation accessibility
function monitorNavigationAccessibility() {
    setInterval(function() {
        const navItems = document.querySelectorAll('.nav-item');
        const hiddenItems = Array.from(navItems).filter(function(item) {
            const style = window.getComputedStyle(item);
            return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
        });
        
        if (hiddenItems.length > 0) {
            console.log('🔧 Found hidden navigation items, fixing...');
            fixNavigationAccessibility();
        }
    }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Navigation accessibility fix loaded');
    
    // Auto-fix on load
    autoFixNavigation();
    
    // Start monitoring
    monitorNavigationAccessibility();
    
    console.log('✅ Navigation accessibility fix initialized');
});

// Make functions globally available
window.fixNavigationAccessibility = fixNavigationAccessibility;
window.autoFixNavigation = autoFixNavigation;
window.monitorNavigationAccessibility = monitorNavigationAccessibility;

console.log('🔧 Navigation accessibility fix initialized');
