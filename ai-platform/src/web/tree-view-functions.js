// Tree View Expand/Collapse Functions
// Fixes the expand all and collapse all functionality

// Store the state of directories
const directoryStates = {};

function toggleDirectory(directoryName) {
    const directoryElement = document.querySelector(`[onclick="toggleDirectory('${directoryName}')"]`);
    if (!directoryElement) return;
    
    const isExpanded = directoryStates[directoryName] !== false;
    const newIcon = isExpanded ? 'fa-folder' : 'fa-folder-open';
    const oldIcon = isExpanded ? 'fa-folder-open' : 'fa-folder';
    
    // Toggle the icon
    const icon = directoryElement.querySelector('svg');
    if (icon) {
        icon.classList.remove(oldIcon);
        icon.classList.add(newIcon);
    }
    
    // Toggle the sub-items visibility
    const parentItem = directoryElement.parentElement;
    const subItems = parentItem.querySelectorAll(':scope > .tree-item');
    subItems.forEach(item => {
        item.style.display = isExpanded ? 'none' : 'block';
    });
    
    // Update state
    directoryStates[directoryName] = !isExpanded;
    
    console.log(`Toggled ${directoryName}: ${!isExpanded ? 'expanded' : 'collapsed'}`);
}

function expandAll() {
    console.log('Expanding all directories...');
    
    // Find all directory toggle elements
    const directoryElements = document.querySelectorAll('[onclick^="toggleDirectory"]');
    
    directoryElements.forEach(element => {
        const onclickAttr = element.getAttribute('onclick');
        const match = onclickAttr.match(/toggleDirectory\('([^']+)'\)/);
        if (match) {
            const directoryName = match[1];
            
            // Expand this directory
            directoryStates[directoryName] = true;
            
            // Update icon to folder-open
            const icon = element.querySelector('svg');
            if (icon) {
                icon.classList.remove('fa-folder');
                icon.classList.add('fa-folder-open');
            }
            
            // Show all sub-items
            const parentItem = element.parentElement;
            const subItems = parentItem.querySelectorAll(':scope > .tree-item');
            subItems.forEach(item => {
                item.style.display = 'block';
            });
        }
    });
    
    console.log('All directories expanded');
    showNotification('All directories expanded', 'success');
}

function collapseAll() {
    console.log('Collapsing all directories...');
    
    // Find all directory toggle elements
    const directoryElements = document.querySelectorAll('[onclick^="toggleDirectory"]');
    
    directoryElements.forEach(element => {
        const onclickAttr = element.getAttribute('onclick');
        const match = onclickAttr.match(/toggleDirectory\('([^']+)'\)/);
        if (match) {
            const directoryName = match[1];
            
            // Collapse this directory (except root)
            if (directoryName !== 'web') {
                directoryStates[directoryName] = false;
                
                // Update icon to folder
                const icon = element.querySelector('svg');
                if (icon) {
                    icon.classList.remove('fa-folder-open');
                    icon.classList.add('fa-folder');
                }
                
                // Hide all sub-items
                const parentItem = element.parentElement;
                const subItems = parentItem.querySelectorAll(':scope > .tree-item');
                subItems.forEach(item => {
                    item.style.display = 'none';
                });
            }
        }
    });
    
    console.log('All directories collapsed');
    showNotification('All directories collapsed', 'success');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '9999';
    notification.style.minWidth = '250px';
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

// Initialize tree view when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Tree view functions loaded');
    
    // Auto-expand root directory
    setTimeout(() => {
        const webDirectory = document.querySelector('[onclick="toggleDirectory(\'web\')"]');
        if (webDirectory) {
            toggleDirectory('web');
        }
    }, 500);
});

// Make functions globally available
window.toggleDirectory = toggleDirectory;
window.expandAll = expandAll;
window.collapseAll = collapseAll;
