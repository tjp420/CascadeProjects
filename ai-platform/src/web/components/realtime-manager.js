/**
 * Real-time Manager for Dashboard
 * Handles WebSocket connections and real-time data updates
 */

class RealtimeManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        this.updateInterval = null;
        this.subscribers = new Map();
        this.mockMode = false; // Disabled - use real API data
    }

    init() {
        console.log('Initializing real-time manager...');
        
        // Try WebSocket connection first
        if (!this.mockMode) {
            this.connectWebSocket();
        } else {
            // Use mock real-time updates for demo
            this.startMockUpdates();
        }
        
        // Set up connection status indicator
        this.createStatusIndicator();
    }

    connectWebSocket() {
        try {
            // WebSocket connection to real API endpoint
            const wsUrl = `ws://${window.location.hostname}:8080/ws/analysis/dashboard`;
            console.log('Attempting WebSocket connection to:', wsUrl);

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateStatus('Connected', 'success');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleRealMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            this.ws.onerror = (error) => {
                console.warn('WebSocket connection error:', error);
                console.log('Attempting reconnection instead of mock fallback...');
                this.handleReconnection();
            };

            this.ws.onclose = () => {
                console.log('WebSocket connection closed');
                this.isConnected = false;
                this.handleReconnection();
            };

        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            console.log('Will retry connection instead of falling back to mock');
            this.handleReconnection();
        }
    }

    handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
            setTimeout(() => this.connectWebSocket(), delay);
        } else {
            console.log('Max reconnect attempts reached, will use polling fallback');
            this.startPollingFallback();
        }
    }

    startPollingFallback() {
        console.log('Starting polling fallback for real-time updates');
        this.updateStatus('Polling Mode', 'warning');
        // Poll API endpoints every 30 seconds as fallback
        this.updateInterval = setInterval(async () => {
            try {
                const perfData = await window.realAnalysisAPI.getPerformanceMetrics();
                this.notifySubscribers('performance', perfData);
            } catch (error) {
                console.error('Polling fallback error:', error);
            }
        }, 30000);
    }

    handleRealMessage(data) {
        console.log('Received real WebSocket message:', data);
        const updateType = data.type || 'update';
        this.notifySubscribers(updateType, data);
    }

    notifySubscribers(type, data) {
        const subscribers = this.subscribers.get(type) || [];
        subscribers.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in subscriber callback:', error);
            }
        });
    }

    subscribe(type, callback) {
        if (!this.subscribers.has(type)) {
            this.subscribers.set(type, []);
        }
        this.subscribers.get(type).push(callback);
    }

    unsubscribe(type, callback) {
        const subscribers = this.subscribers.get(type);
        if (subscribers) {
            const index = subscribers.indexOf(callback);
            if (index > -1) {
                subscribers.splice(index, 1);
            }
        }
    }

    updateStatus(status, type) {
        const indicator = document.getElementById('realtime-status');
        if (indicator) {
            indicator.textContent = status;
            indicator.className = `status-${type}`;
        }
    }

    createStatusIndicator() {
        if (!document.getElementById('realtime-status')) {
            const indicator = document.createElement('div');
            indicator.id = 'realtime-status';
            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                z-index: 10000;
            `;
            document.body.appendChild(indicator);
        }
    }

    destroy() {
        if (this.ws) {
            this.ws.close();
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.subscribers.clear();
    }
}

// Global instance
window.realtimeManager = new RealtimeManager();

// Initialize real-time manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.realtimeManager.init();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealtimeManager;
}
