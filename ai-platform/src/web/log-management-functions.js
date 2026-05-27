// Log Management Functions
// Handles clearing logs and log-related operations in the dashboard

// Confirm and clear logs
window.confirmClearLogs = function() {
    console.log('🗑️ Confirming log clear operation...');
    
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'clearLogsModal';
    modal.textContent = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title">
                        <i class="fas fa-exclamation-triangle"></i> Clear All Logs
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Warning:</strong> This action will permanently delete all logs and cannot be undone.
                    </div>
                    
                    <h6>What will be cleared:</h6>
                    <ul class="list-unstyled">
                        <li><i class="fas fa-trash text-danger"></i> Error logs</li>
                        <li><i class="fas fa-trash text-danger"></i> Activity logs</li>
                        <li><i class="fas fa-trash text-danger"></i> System logs</li>
                        <li><i class="fas fa-trash text-danger"></i> Debug logs</li>
                        <li><i class="fas fa-trash text-danger"></i> User activity logs</li>
                    </ul>
                    
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="confirmClearLogs" required>
                        <label class="form-check-label" for="confirmClearLogs">
                            I understand that this action cannot be undone
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button type="button" class="btn btn-danger" id="executeClearLogsBtn" disabled>
                        <i class="fas fa-trash"></i> Clear All Logs
                    </button>
                </div>
            </div>
        </div>
    ` /* Replaced innerHTML with textContent for safety */
    
    // Add modal to page
    document.body.appendChild(modal);
    
    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Handle checkbox confirmation
    const confirmCheckbox = document.getElementById('confirmClearLogs');
    const executeBtn = document.getElementById('executeClearLogsBtn');
    
    confirmCheckbox.addEventListener('change', function() {
        executeBtn.disabled = !this.checked;
    });
    
    // Handle clear action
    executeBtn.addEventListener('click', function() {
        if (confirmCheckbox.checked) {
            clearAllLogs();
            bsModal.hide();
        }
    });
    
    // Remove modal from DOM when hidden
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
    
    showNotification('Log clear confirmation opened', 'info');
};

// Clear all logs
function clearAllLogs() {
    console.log('🗑️ Executing log clear operation...');
    
    try {
        // Clear various log containers
        const logContainers = [
            '#consoleOutput',
            '#activityList',
            '#errorLog',
            '#debugLog',
            '#systemLog',
            '.log-output',
            '.activity-feed',
            '.error-list',
            '.console-output'
        ];
        
        let clearedContainers = 0;
        
        logContainers.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.textContent = '<div class="text-muted">Logs cleared</div>' /* Replaced innerHTML with textContent for safety */
                clearedContainers++;
            });
        });
        
        // Clear localStorage logs (if any)
        const logKeys = Object.keys(localStorage).filter(key => 
            key.includes('log') || key.includes('error') || key.includes('activity')
        );
        
        logKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Clear sessionStorage logs
        const sessionLogKeys = Object.keys(sessionStorage).filter(key => 
            key.includes('log') || key.includes('error') || key.includes('activity')
        );
        
        sessionLogKeys.forEach(key => {
            sessionStorage.removeItem(key);
        });
        
        // Show success notification
        showNotification(`Successfully cleared ${clearedContainers} log containers and ${logKeys.length + sessionLogKeys.length} stored logs`, 'success');
        
        // Update any log counters
        updateLogCounters();
        
        // Log the clear operation itself
        console.log('✅ All logs cleared successfully');
        
        // Optional: Add a log entry about the clear operation
        addLogEntry('system', 'Logs cleared by user', {
            timestamp: new Date().toISOString(),
            containersCleared: clearedContainers,
            localStorageKeysCleared: logKeys.length,
            sessionStorageKeysCleared: sessionLogKeys.length
        });
        
    } catch (error) {
        console.error('❌ Error clearing logs:', error);
        showNotification(`Error clearing logs: ${error.message}`, 'error');
    }
}

// Update log counters (if they exist)
function updateLogCounters() {
    const counters = document.querySelectorAll('.log-counter, .error-count, .activity-count');
    counters.forEach(counter => {
        counter.textContent = '0';
        counter.classList.remove('bg-danger', 'bg-warning');
        counter.classList.add('bg-success');
    });
}

// Add a log entry (for audit trail)
function addLogEntry(type, message, metadata = {}) {
    // Create a simple log entry for audit purposes
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: type,
        message: message,
        metadata: metadata
    };
    
    // Store in sessionStorage for audit trail
    const auditLogs = JSON.parse(sessionStorage.getItem('auditLogs') || '[]');
    auditLogs.push(logEntry);
    
    // Keep only last 100 audit entries
    if (auditLogs.length > 100) {
        auditLogs.splice(0, auditLogs.length - 100);
    }
    
    sessionStorage.setItem('auditLogs', JSON.stringify(auditLogs));
}

// Export logs (for debugging)
window.exportLogs = function() {
    console.log('📤 Exporting logs...');
    
    try {
        // Collect all available logs
        const logs = {
            timestamp: new Date().toISOString(),
            auditLogs: JSON.parse(sessionStorage.getItem('auditLogs') || '[]'),
            consoleLogs: [], // Would need to implement console capture
            errorLogs: [], // Would need to collect from error containers
            systemInfo: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString()
            }
        };
        
        // Create download
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Logs exported successfully', 'success');
        
    } catch (error) {
        console.error('❌ Error exporting logs:', error);
        showNotification(`Error exporting logs: ${error.message}`, 'error');
    }
};

// Show notification (reuse from other scripts)
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

// Initialize log management
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Log management functions loaded');
    
    // Add export logs button if there's a logs section
    const logsSection = document.querySelector('.logs-section, .activity-section');
    if (logsSection) {
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-sm btn-outline-primary ms-2';
        exportBtn.textContent = '<i class="fas fa-download"></i> Export Logs' /* Replaced innerHTML with textContent for safety */
        exportBtn.onclick = window.exportLogs;
        
        const header = logsSection.querySelector('.section-header, .card-header');
        if (header) {
            header.appendChild(exportBtn);
        }
    }
    
    // Initialize audit trail
    addLogEntry('system', 'Log management system initialized', {
        version: '1.0.0',
        features: ['clearLogs', 'exportLogs', 'auditTrail']
    });
});

// Make functions globally available
window.showNotification = showNotification;
window.addLogEntry = addLogEntry;

console.log('🔧 Log management functions initialized');
