// Error Management Functions
// Handles viewing error details and resolving errors in the dashboard

// Sample error data (in production, this would come from your backend)
const errorDatabase = {
    'error_001': {
        id: 'error_001',
        type: 'Component Loading Error',
        severity: 'medium',
        message: 'Failed to load component: dashboard_components/ma-compliance-tab.html',
        details: {
            timestamp: new Date().toISOString(),
            stack: 'Error: Component not found at path: dashboard_components/ma-compliance-tab.html',
            component: 'ma-compliance-tab.html',
            attemptedPath: '/dashboard_components/ma-compliance-tab.html',
            userAgent: navigator.userAgent,
            url: window.location.href
        },
        suggestions: [
            'Check if the component file exists in the correct directory',
            'Verify the component path is spelled correctly',
            'Ensure the component file has proper HTML structure'
        ],
        status: 'unresolved',
        occurrences: 3,
        firstSeen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        lastSeen: new Date().toISOString()
    },
    'error_002': {
        id: 'error_002',
        type: 'WebSocket Connection Error',
        severity: 'low',
        message: 'Roadmap WebSocket connection failed',
        details: {
            timestamp: new Date().toISOString(),
            stack: 'WebSocket error: {"isTrusted":true}',
            url: 'ws://localhost:8765',
            readyState: 3,
            code: 1006
        },
        suggestions: [
            'Check if WebSocket server is running on port 8765',
            'Verify network connectivity',
            'Ensure firewall is not blocking the connection'
        ],
        status: 'unresolved',
        occurrences: 5,
        firstSeen: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        lastSeen: new Date().toISOString()
    },
    'error_003': {
        id: 'error_003',
        type: 'Authentication Error',
        severity: 'high',
        message: 'Invalid credentials provided',
        details: {
            timestamp: new Date().toISOString(),
            stack: 'Authentication failed: Invalid email or password',
            endpoint: '/api/auth/login',
            statusCode: 401
        },
        suggestions: [
            'Use demo credentials: admin@demo.com/admin123',
            'Check if authentication server is running',
            'Verify email and password format'
        ],
        status: 'unresolved',
        occurrences: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString()
    }
};

// View error details
window.viewErrorDetails = function(errorId) {
    console.log(`🔍 Viewing details for error: ${errorId}`);
    
    const error = errorDatabase[errorId];
    if (!error) {
        showNotification(`Error ${errorId} not found`, 'error');
        return;
    }
    
    // Create modal for error details
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'errorDetailsModal';
    modal.textContent = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-bug"></i> Error Details: ${errorId}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h6>Basic Information</h6>
                            <table class="table table-sm">
                                <tr>
                                    <td><strong>Type:</strong></td>
                                    <td><span class="badge bg-${getSeverityColor(error.severity)}">${error.type}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Severity:</strong></td>
                                    <td><span class="badge bg-${getSeverityColor(error.severity)}">${error.severity}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Status:</strong></td>
                                    <td><span class="badge bg-${error.status === 'resolved' ? 'success' : 'warning'}">${error.status}</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Occurrences:</strong></td>
                                    <td>${error.occurrences}</td>
                                </tr>
                                <tr>
                                    <td><strong>First Seen:</strong></td>
                                    <td>${new Date(error.firstSeen).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td><strong>Last Seen:</strong></td>
                                    <td>${new Date(error.lastSeen).toLocaleString()}</td>
                                </tr>
                            </table>
                        </div>
                        <div class="col-md-6">
                            <h6>Error Message</h6>
                            <div class="alert alert-${getSeverityColor(error.severity)}">
                                <code>${error.message}</code>
                            </div>
                            
                            <h6 class="mt-3">Suggestions</h6>
                            <ul class="list-unstyled">
                                ${error.suggestions.map(suggestion => 
                                    `<li class="mb-2"><i class="fas fa-lightbulb text-warning"></i> ${suggestion}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    </div>
                    
                    <div class="mt-3">
                        <h6>Technical Details</h6>
                        <div class="accordion" id="errorAccordion">
                            <div class="accordion-item">
                                <h2 class="accordion-header">
                                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseDetails">
                                        <i class="fas fa-code"></i> Stack Trace & Details
                                    </button>
                                </h2>
                                <div id="collapseDetails" class="accordion-collapse collapse" data-bs-parent="#errorAccordion">
                                    <div class="accordion-body">
                                        <pre class="bg-light p-2 rounded"><code>${JSON.stringify(error.details, null, 2)}</code></pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary" onclick="resolveError('${errorId}')">
                        <i class="fas fa-check"></i> Mark Resolved
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
    
    // Remove modal from DOM when hidden
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
    
    showNotification(`Viewing details for ${errorId}`, 'info');
};

// Resolve error
window.resolveError = function(errorId) {
    console.log(`✅ Resolving error: ${errorId}`);
    
    const error = errorDatabase[errorId];
    if (!error) {
        showNotification(`Error ${errorId} not found`, 'error');
        return;
    }
    
    // Update error status
    error.status = 'resolved';
    error.resolvedAt = new Date().toISOString();
    error.resolvedBy = 'user'; // In production, this would be the actual user
    
    // Close any open modal
    const modal = document.getElementById('errorDetailsModal');
    if (modal) {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
            bsModal.hide();
        }
    }
    
    // Update UI to reflect resolved status
    updateErrorStatus(errorId, 'resolved');
    
    // Show success notification
    showNotification(`Error ${errorId} marked as resolved`, 'success');
    
    // Log the resolution
    console.log(`✅ Error ${errorId} resolved at ${error.resolvedAt}`);
};

// Update error status in UI
function updateErrorStatus(errorId, status) {
    // Find and update the error card in the DOM
    const errorCards = document.querySelectorAll('[data-error-id]');
    errorCards.forEach(card => {
        if (card.getAttribute('data-error-id') === errorId) {
            // Update status badge
            const statusBadge = card.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = `badge bg-${status === 'resolved' ? 'success' : 'warning'}`;
                statusBadge.textContent = status;
            }
            
            // Update action buttons
            const resolveBtn = card.querySelector(`[onclick="resolveError('${errorId}')"]`);
            if (resolveBtn && status === 'resolved') {
                resolveBtn.disabled = true;
                resolveBtn.textContent = '<i class="fas fa-check"></i> Resolved' /* Replaced innerHTML with textContent for safety */
                resolveBtn.classList.remove('btn-primary');
                resolveBtn.classList.add('btn-success');
            }
        }
    });
}

// Get severity color for badges
function getSeverityColor(severity) {
    const colors = {
        'low': 'info',
        'medium': 'warning',
        'high': 'danger',
        'critical': 'danger'
    };
    return colors[severity] || 'secondary';
}

// Show notification (reuse from comprehensive fix)
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

// Initialize error management
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Error management functions loaded');
    
    // Add data-error-id attributes to error cards (if they exist)
    const errorCards = document.querySelectorAll('.error-card');
    errorCards.forEach((card, index) => {
        const errorId = `error_00${index + 1}`;
        card.setAttribute('data-error-id', errorId);
        
        // Add status badge if not present
        if (!card.querySelector('.status-badge')) {
            const error = errorDatabase[errorId];
            if (error) {
                const statusBadge = document.createElement('span');
                statusBadge.className = `badge bg-${getSeverityColor(error.severity)} status-badge ms-2`;
                statusBadge.textContent = error.status;
                card.querySelector('.card-header').appendChild(statusBadge);
            }
        }
    });
    
    // Test error management on load
    setTimeout(() => {
        console.log('✅ Error management system ready');
        console.log('Available errors:', Object.keys(errorDatabase));
    }, 1000);
});

// Make functions globally available
window.showNotification = showNotification;

console.log('🔧 Error management functions initialized');
