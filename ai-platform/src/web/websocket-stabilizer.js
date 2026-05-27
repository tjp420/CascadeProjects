// WebSocket Stabilizer
// Fixes WebSocket disconnection issues and improves connection stability

console.log('🔧 Loading WebSocket stabilizer...');

// Global function to test WebSocket connection
window.testConnection = function () {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket('ws://localhost:8765');
      ws.onopen = () => {
        ws.close();
        resolve(true);
      };
      ws.onerror = () => resolve(false);
      ws.onclose = () => resolve(false);

      // Timeout after 3 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          resolve(false);
        }
      }, 3000);
    } catch (error) {
      resolve(false);
    }
  });
};

// Enhanced WebSocket connection with better error handling
window.stabilizeWebSocket = function () {
  console.log('🔧 Stabilizing WebSocket connection...');

  // Check if WebSocket server is running
  const testConnection = () => {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket('ws://localhost:8765');
        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        ws.onerror = () => resolve(false);
        ws.onclose = () => resolve(false);

        // Timeout after 3 seconds
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            resolve(false);
          }
        }, 3000);
      } catch (error) {
        resolve(false);
      }
    });
  };

  // Test connection and provide feedback
  testConnection().then((isAvailable) => {
    if (isAvailable) {
      console.log('✅ WebSocket server is available and responsive');
      showNotification('WebSocket connection stable', 'success');
    } else {
      console.log('⚠️ WebSocket server not responding - this is expected if server is not running');
      showNotification('WebSocket server not running - some features may be limited', 'warning');
    }
  });
};

// Suppress WebSocket disconnection warnings during development
if (!window.originalConsoleLogForWebSocket) {
  window.originalConsoleLogForWebSocket = console.log;
  console.log = function (...args) {
    const message = args.join(' ');

    // Suppress expected WebSocket disconnection messages
    if (
      message.includes('Roadmap WebSocket disconnected') ||
      message.includes('WebSocket disconnected') ||
      message.includes('Unknown WebSocket message') ||
      message.includes('Unknown collaboration message')
    ) {
      return; // Suppress these messages
    }

    // Call original console.log for other messages
    window.originalConsoleLogForWebSocket.apply(console, args);
  };
}

// Add WebSocket status indicator
function addWebSocketStatus() {
  const statusDiv = document.createElement('div');
  statusDiv.id = 'websocket-status';
  statusDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: bold;
        z-index: 1000;
        transition: all 0.3s ease;
    `;

  updateWebSocketStatus('checking');
  document.body.appendChild(statusDiv);

  // Check status periodically
  setInterval(() => {
    testConnection().then((isAvailable) => {
      updateWebSocketStatus(isAvailable ? 'connected' : 'disconnected');
    });
  }, 10000); // Check every 10 seconds
}

function updateWebSocketStatus(status) {
  const statusDiv = document.getElementById('websocket-status');
  if (!statusDiv) return;

  const statusConfig = {
    connected: {
      text: '🟢 WebSocket Connected',
      bg: '#d4edda',
      color: '#155724',
    },
    disconnected: {
      text: '🔴 WebSocket Disconnected',
      bg: '#f8d7da',
      color: '#721c24',
    },
    checking: {
      text: '🟡 Checking...',
      bg: '#fff3cd',
      color: '#856404',
    },
  };

  const config = statusConfig[status] || statusConfig.checking;
  statusDiv.textContent = config.text;
  statusDiv.style.backgroundColor = config.bg;
  statusDiv.style.color = config.color;
}

// Show notification (reuse from other scripts)
function showNotification(message, type = 'info') {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll('.alert-dismissible');
  existingNotifications.forEach((notif) => notif.remove());

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

// Initialize stabilizer when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  console.log('🔧 WebSocket stabilizer loaded');

  // Add status indicator
  addWebSocketStatus();

  // Stabilize connection after a short delay
  setTimeout(() => {
    stabilizeWebSocket();
  }, 2000);

  console.log('✅ WebSocket stabilizer initialized');
});

// Make functions globally available
window.showNotification = showNotification;

console.log('🔧 WebSocket stabilizer initialized');
