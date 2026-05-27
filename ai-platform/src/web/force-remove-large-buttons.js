// Force Remove Large Dashboard Buttons
// Aggressively removes all large dashboard buttons

console.log('🔧 Loading force remove large dashboard buttons...');

// Force remove all large dashboard buttons
window.forceRemoveLargeButtons = function() {
    console.log('🔧 Force removing ALL large dashboard buttons...');
    
    let removedCount = 0;
    
    // Method 1: Remove by class
    const simpleButtons = document.querySelectorAll('.simple-dashboard-btn');
    simpleButtons.forEach(function(button) {
        console.log('🗑️ Removing simple-dashboard-btn');
        button.remove();
        removedCount++;
    });
    
    // Method 2: Remove by content text
    const allDivs = document.querySelectorAll('div');
    allDivs.forEach(function(div) {
        const text = div.textContent || div.innerText || '';
        if (text.includes('MAIN DASHBOARD') || text.includes('Click here to access')) {
            console.log('🗑️ Removing div with MAIN DASHBOARD text');
            div.remove();
            removedCount++;
        }
    });
    
    // Method 3: Remove by style attributes
    const styledDivs = document.querySelectorAll('div[style*="linear-gradient"]');
    styledDivs.forEach(function(div) {
        const style = div.getAttribute('style') || '';
        if (style.includes('102, 126, 234') || style.includes('118, 75, 162')) {
            console.log('🗑️ Removing div with purple gradient style');
            div.remove();
            removedCount++;
        }
    });
    
    // Method 4: Remove by background color
    const allElements = document.querySelectorAll('*');
    allElements.forEach(function(element) {
        const style = window.getComputedStyle(element);
        const bgColor = style.backgroundColor;
        
        if (bgColor.includes('102, 126, 234') || bgColor.includes('118, 75, 162') || 
            bgColor.includes('rgb(102, 126, 234)') || bgColor.includes('rgb(118, 75, 162)')) {
            if (element.textContent.includes('DASHBOARD') || element.textContent.includes('MAIN')) {
                console.log('🗑️ Removing element with purple background and dashboard text');
                element.remove();
                removedCount++;
            }
        }
    });
    
    // Method 5: Remove any remaining large buttons
    const possibleButtons = document.querySelectorAll('div, a, button');
    possibleButtons.forEach(function(element) {
        const text = element.textContent || element.innerText || '';
        const style = element.getAttribute('style') || '';
        
        // Check if it's a large dashboard button
        if ((text.includes('MAIN DASHBOARD') || text.includes('Click here to access')) &&
            (style.includes('padding: 20px') || style.includes('font-size: 16px') || 
             style.includes('border-radius: 12px'))) {
            console.log('🗑️ Removing large dashboard button by content and style');
            element.remove();
            removedCount++;
        }
    });
    
    console.log('✅ Force removal completed. Removed', removedCount, 'large dashboard buttons');
    
    // Verify removal
    setTimeout(function() {
        console.log('🧪 Verifying large button removal...');
        
        let remainingCount = 0;
        
        // Check for any remaining large buttons
        const remainingSimple = document.querySelectorAll('.simple-dashboard-btn');
        remainingCount += remainingSimple.length;
        
        const remainingByText = Array.from(document.querySelectorAll('div')).filter(div => 
            (div.textContent || '').includes('MAIN DASHBOARD')
        );
        remainingCount += remainingByText.length;
        
        const remainingByStyle = Array.from(document.querySelectorAll('div')).filter(div => {
            const style = div.getAttribute('style') || '';
            return style.includes('102, 126, 234') || style.includes('118, 75, 162');
        });
        remainingCount += remainingByStyle.length;
        
        if (remainingCount === 0) {
            console.log('✅ All large dashboard buttons successfully removed');
            showNotification('✅ All large dashboard buttons removed', 'success');
        } else {
            console.log('⚠️ Still found', remainingCount, 'large dashboard buttons');
            showNotification('⚠️ Some large buttons may still be present', 'warning');
        }
        
        // Ensure the regular Dashboard button is working
        const regularBtn = document.querySelector('.nav-item[data-section="dashboard"]');
        if (regularBtn) {
            console.log('✅ Regular Dashboard button found and working');
            
            // Auto-click it to show dashboard
            setTimeout(() => {
                regularBtn.click();
            }, 500);
        } else {
            console.log('❌ Regular Dashboard button not found');
        }
    }, 1000);
    
    return removedCount;
};

// Create CSS rule to hide any remaining large buttons
function hideLargeButtonsCSS() {
    const style = document.createElement('style');
    style.id = 'hide-large-buttons';
    style.textContent = `
        div:has([style*="102, 126, 234"]),
        div:has([style*="118, 75, 162"]),
        div:has-text("MAIN DASHBOARD"),
        div:has-text("Click here to access"),
        .simple-dashboard-btn {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
        }
    `;
    document.head.appendChild(style);
    console.log('✅ CSS rule added to hide large buttons');
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

// Auto-force remove on page load
function autoForceRemove() {
    console.log('🔧 Auto-force removing large buttons...');
    
    setTimeout(function() {
        forceRemoveLargeButtons();
        hideLargeButtonsCSS();
    }, 1000);
    
    // Run again after 2 seconds to catch any late-loading buttons
    setTimeout(function() {
        forceRemoveLargeButtons();
    }, 3000);
}

// Monitor and remove any new large buttons that appear
function monitorAndRemove() {
    setInterval(function() {
        const largeButtons = document.querySelectorAll('.simple-dashboard-btn');
        const largeByText = Array.from(document.querySelectorAll('div')).filter(div => 
            (div.textContent || '').includes('MAIN DASHBOARD')
        );
        
        if (largeButtons.length > 0 || largeByText.length > 0) {
            console.log('🔧 Detected new large buttons, removing...');
            forceRemoveLargeButtons();
        }
    }, 3000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Force remove large buttons loaded');
    
    // Auto-force remove on load
    autoForceRemove();
    
    // Start monitoring
    monitorAndRemove();
    
    console.log('✅ Force remove large buttons initialized');
});

// Make functions globally available
window.forceRemoveLargeButtons = forceRemoveLargeButtons;
window.hideLargeButtonsCSS = hideLargeButtonsCSS;
window.autoForceRemove = autoForceRemove;
window.monitorAndRemove = monitorAndRemove;

console.log('🔧 Force remove large buttons initialized');
