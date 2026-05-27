// Add Dashboard Button
// Adds a prominent Dashboard button to the navigation menu

console.log('🔧 Loading add dashboard button...');

// Add dashboard button to navigation
window.addDashboardButton = function() {
    console.log('🔧 Adding Dashboard button to navigation...');
    
    const sidebarNav = document.querySelector('.sidebar-nav');
    const firstNavSection = sidebarNav ? sidebarNav.querySelector('.nav-section') : null;
    
    if (!sidebarNav || !firstNavSection) {
        console.error('❌ Sidebar navigation not found');
        return false;
    }
    
    console.log('Found sidebar navigation, adding Dashboard button...');
    
    // Check if Dashboard button already exists
    const existingDashboardBtn = document.querySelector('.nav-item[data-section="dashboard"]');
    if (existingDashboardBtn) {
        console.log('✅ Dashboard button already exists');
        return true;
    }
    
    // Create Dashboard button
    const dashboardButton = document.createElement('a');
    dashboardButton.href = '#';
    dashboardButton.className = 'nav-item';
    dashboardButton.setAttribute('data-section', 'dashboard');
    dashboardButton.setAttribute('onclick', 'navigateTo("dashboard", this)');
    dashboardButton.style.cssText = `
        display: flex;
        align-items: center;
        padding: 15px;
        margin: 5px 0;
        cursor: pointer;
        pointer-events: auto;
        visibility: visible;
        opacity: 1;
        position: relative;
        z-index: 1;
        min-height: 50px;
        width: 100%;
        box-sizing: border-box;
        background-color: rgba(52, 152, 219, 0.2);
        border-left: 4px solid #3498db;
        font-weight: 600;
        color: #3498db;
    `;
    
    // Add icon
    const icon = document.createElement('i');
    icon.className = 'fas fa-home nav-icon';
    icon.style.cssText = `
        display: inline-block;
        visibility: visible;
        opacity: 1;
        width: 20px;
        height: 20px;
        pointer-events: none;
        color: #3498db;
        margin-right: 15px;
        flex-shrink: 0;
    `;
    
    // Add text
    const text = document.createElement('span');
    text.className = 'nav-text';
    text.textContent = 'Dashboard';
    text.style.cssText = `
        display: inline;
        visibility: visible;
        opacity: 1;
        pointer-events: none;
        margin-left: 15px;
        font-size: 14px;
        color: #3498db;
        line-height: 1.4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;
    
    // Add badge
    const badge = document.createElement('span');
    badge.className = 'nav-badge';
    badge.textContent = 'HOME';
    badge.style.cssText = `
        background-color: #3498db;
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: bold;
        margin-left: auto;
        margin-right: 10px;
    `;
    
    // Assemble the button
    dashboardButton.appendChild(icon);
    dashboardButton.appendChild(text);
    dashboardButton.appendChild(badge);
    
    // Add hover effect
    dashboardButton.addEventListener('mouseenter', function() {
        this.style.backgroundColor = 'rgba(52, 152, 219, 0.3)';
    });
    
    dashboardButton.addEventListener('mouseleave', function() {
        if (!this.classList.contains('active')) {
            this.style.backgroundColor = 'rgba(52, 152, 219, 0.2)';
        }
    });
    
    // Add click event
    dashboardButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('🏠 Dashboard button clicked');
        
        // Remove active class from all items
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(function(item) {
            item.classList.remove('active');
            // Reset other items to default styling
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
        icon.style.color = '#3498db';
        text.style.color = '#3498db';
        
        // Navigate to dashboard
        window.navigateTo('dashboard', this);
    });
    
    // Insert at the beginning of the first nav section
    const firstSectionTitle = firstNavSection.querySelector('.nav-section-title');
    if (firstSectionTitle) {
        firstNavSection.insertBefore(dashboardButton, firstSectionTitle.nextSibling);
    } else {
        firstNavSection.insertBefore(dashboardButton, firstNavSection.firstChild);
    }
    
    // Also add a separator after the Dashboard button
    const separator = document.createElement('div');
    separator.style.cssText = `
        height: 1px;
        background-color: #34495e;
        margin: 10px 15px;
        opacity: 0.3;
    `;
    firstNavSection.insertBefore(separator, dashboardButton.nextSibling);
    
    console.log('✅ Dashboard button added to navigation');
    
    // Test the button
    setTimeout(function() {
        console.log('🧪 Testing Dashboard button...');
        
        const dashboardBtn = document.querySelector('.nav-item[data-section="dashboard"]');
        if (dashboardBtn) {
            console.log('✅ Dashboard button found and accessible');
            console.log('✅ Button text:', dashboardBtn.textContent.trim());
            console.log('✅ Button visible:', window.getComputedStyle(dashboardBtn).visibility);
            console.log('✅ Button clickable:', window.getComputedStyle(dashboardBtn).pointerEvents);
            
            showNotification('Dashboard button added - Click to return to main dashboard', 'success');
        } else {
            console.log('❌ Dashboard button not found');
            showNotification('Dashboard button may not be properly added', 'warning');
        }
    }, 500);
    
    return true;
};

// Enhanced navigateTo function to handle dashboard navigation
window.navigateTo = function(section, element) {
    console.log('🧭 Navigation to:', section);
    
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
    
    // Add active class and styling to clicked element
    if (element) {
        element.classList.add('active');
        
        // Special styling for Dashboard button
        if (element.getAttribute('data-section') === 'dashboard') {
            element.style.backgroundColor = 'rgba(52, 152, 219, 0.4)';
            element.style.borderLeft = '4px solid #3498db';
            element.style.fontWeight = '600';
            element.style.color = '#3498db';
            const icon = element.querySelector('.nav-icon');
            const text = element.querySelector('.nav-text');
            if (icon) icon.style.color = '#3498db';
            if (text) text.style.color = '#3498db';
        } else {
            // Regular styling for other items
            element.style.backgroundColor = 'rgba(255,255,255,0.1)';
            element.style.fontWeight = '500';
        }
        
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

// Auto-add dashboard button on page load
function autoAddDashboardButton() {
    console.log('🔧 Auto-adding Dashboard button...');
    
    setTimeout(function() {
        addDashboardButton();
    }, 2000);
}

// Monitor for dashboard button
function monitorDashboardButton() {
    setInterval(function() {
        const dashboardBtn = document.querySelector('.nav-item[data-section="dashboard"]');
        if (!dashboardBtn) {
            console.log('🔧 Dashboard button missing, re-adding...');
            addDashboardButton();
        }
    }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Add dashboard button loaded');
    
    // Auto-add on load
    autoAddDashboardButton();
    
    // Start monitoring
    monitorDashboardButton();
    
    console.log('✅ Add dashboard button initialized');
});

// Make functions globally available
window.addDashboardButton = addDashboardButton;
window.autoAddDashboardButton = autoAddDashboardButton;
window.monitorDashboardButton = monitorDashboardButton;

console.log('🔧 Add dashboard button initialized');
