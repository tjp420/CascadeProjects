// Roadmap API Client
// Handles communication between frontend and backend roadmap API

class RoadmapAPIClient {
    constructor() {
        this.baseURL = '/api/roadmap';
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processSyncQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    // Generic API request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`API request failed: ${url}`, error);
            throw error;
        }
    }

    // Milestone operations
    async getMilestones(filters = {}) {
        try {
            const params = new URLSearchParams();
            
            if (filters.status) {
                params.append('status', filters.status);
            }
            if (filters.priority) {
                params.append('priority', filters.priority);
            }
            if (filters.team) {
                params.append('team', filters.team);
            }
            if (filters.skip) {
                params.append('skip', filters.skip);
            }
            if (filters.limit) {
                params.append('limit', filters.limit);
            }
            
            const endpoint = params.toString() ? `/milestones?${params}` : '/milestones';
            return await this.request(endpoint);
        } catch (error) {
            console.error('Failed to fetch milestones:', error);
            throw error;
        }
    }

    async getMilestone(milestoneId) {
        try {
            return await this.request(`/milestones/${milestoneId}`);
        } catch (error) {
            console.error(`Failed to fetch milestone ${milestoneId}:`, error);
            throw error;
        }
    }

    async createMilestone(milestoneData) {
        try {
            const result = await this.request('/milestones', {
                method: 'POST',
                body: JSON.stringify(milestoneData)
            });
            
            // Add to sync queue if offline
            if (!this.isOnline) {
                this.addToSyncQueue('create_milestone', milestoneData);
            }
            
            return result;
        } catch (error) {
            console.error('Failed to create milestone:', error);
            
            // Queue for later sync if offline
            if (!this.isOnline) {
                this.addToSyncQueue('create_milestone', milestoneData);
                // Return optimistic response
                return {
                    id: `MILE-${Date.now()}`,
                    ...milestoneData,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
            }
            
            throw error;
        }
    }

    async updateMilestone(milestoneId, updateData) {
        try {
            const result = await this.request(`/milestones/${milestoneId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            // Add to sync queue if offline
            if (!this.isOnline) {
                this.addToSyncQueue('update_milestone', { id: milestoneId, ...updateData });
            }
            
            return result;
        } catch (error) {
            console.error(`Failed to update milestone ${milestoneId}:`, error);
            
            // Queue for later sync if offline
            if (!this.isOnline) {
                this.addToSyncQueue('update_milestone', { id: milestoneId, ...updateData });
                // Return optimistic response
                return {
                    id: milestoneId,
                    ...updateData,
                    updated_at: new Date().toISOString()
                };
            }
            
            throw error;
        }
    }

    async deleteMilestone(milestoneId) {
        try {
            await this.request(`/milestones/${milestoneId}`, {
                method: 'DELETE'
            });
            
            // Add to sync queue if offline
            if (!this.isOnline) {
                this.addToSyncQueue('delete_milestone', { id: milestoneId });
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to delete milestone ${milestoneId}:`, error);
            
            // Queue for later sync if offline
            if (!this.isOnline) {
                this.addToSyncQueue('delete_milestone', { id: milestoneId });
                return true;
            }
            
            throw error;
        }
    }

    // Timeline settings operations
    async getTimelineSettings() {
        try {
            return await this.request('/settings');
        } catch (error) {
            console.error('Failed to fetch timeline settings:', error);
            throw error;
        }
    }

    async updateTimelineSettings(settings) {
        try {
            const result = await this.request('/settings', {
                method: 'PUT',
                body: JSON.stringify(settings)
            });
            
            // Add to sync queue if offline
            if (!this.isOnline) {
                this.addToSyncQueue('update_settings', settings);
            }
            
            return result;
        } catch (error) {
            console.error('Failed to update timeline settings:', error);
            
            // Queue for later sync if offline
            if (!this.isOnline) {
                this.addToSyncQueue('update_settings', settings);
                return settings;
            }
            
            throw error;
        }
    }

    // Export/Import operations
    async exportRoadmap() {
        try {
            return await this.request('/export');
        } catch (error) {
            console.error('Failed to export roadmap:', error);
            throw error;
        }
    }

    async importRoadmap(data) {
        try {
            return await this.request('/import', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error('Failed to import roadmap:', error);
            throw error;
        }
    }

    // Statistics
    async getStatistics() {
        try {
            return await this.request('/statistics');
        } catch (error) {
            console.error('Failed to fetch statistics:', error);
            throw error;
        }
    }

    // Health check
    async healthCheck() {
        try {
            return await this.request('/health');
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'unhealthy', error: error.message };
        }
    }

    // Sync queue management
    addToSyncQueue(action, data) {
        this.syncQueue.push({
            action,
            data,
            timestamp: new Date().toISOString()
        });
        
        // Save sync queue to localStorage
        localStorage.setItem('roadmap_sync_queue', JSON.stringify(this.syncQueue));
        
        console.log(`Added to sync queue: ${action}`);
    }

    async processSyncQueue() {
        if (this.syncQueue.length === 0) {
            return;
        }
        
        console.log(`Processing ${this.syncQueue.length} items in sync queue...`);
        
        const queue = [...this.syncQueue];
        this.syncQueue = [];
        
        for (const item of queue) {
            try {
                await this.processSyncItem(item);
            } catch (error) {
                console.error(`Failed to sync item: ${item.action}`, error);
                // Re-add to queue for retry
                this.syncQueue.push(item);
            }
        }
        
        // Update localStorage
        localStorage.setItem('roadmap_sync_queue', JSON.stringify(this.syncQueue));
        
        if (this.syncQueue.length > 0) {
            console.warn(`${this.syncQueue.length} items remaining in sync queue`);
        } else {
            console.log('Sync queue processed successfully');
        }
    }

    async processSyncItem(item) {
        switch (item.action) {
        case 'create_milestone':
            await this.createMilestone(item.data);
            break;
        case 'update_milestone':
            await this.updateMilestone(item.data.id, item.data);
            break;
        case 'delete_milestone':
            await this.deleteMilestone(item.data.id);
            break;
        case 'update_settings':
            await this.updateTimelineSettings(item.data);
            break;
        default:
            console.warn(`Unknown sync action: ${item.action}`);
        }
    }

    // Load sync queue from localStorage
    loadSyncQueue() {
        try {
            const saved = localStorage.getItem('roadmap_sync_queue');
            if (saved) {
                this.syncQueue = JSON.parse(saved);
                console.log(`Loaded ${this.syncQueue.length} items from sync queue`);
            }
        } catch (error) {
            console.error('Failed to load sync queue:', error);
            this.syncQueue = [];
        }
    }

    // Real-time sync with WebSocket
    connectWebSocket() {
        if (!this.isOnline) {
            return;
        }
        
        try {
            // Connect to the standalone WebSocket server on port 8765
            const wsUrl = `ws://localhost:8765`;
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ Roadmap WebSocket connected to standalone server');
                // Subscribe to roadmap updates
                this.ws.send(JSON.stringify({
                    type: 'subscribe',
                    subscription: 'roadmap'
                }));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (e) {
                    console.log('📨 Received WebSocket message:', event.data);
                }
            };
            
            this.ws.onclose = () => {
                console.log('⚠️ Roadmap WebSocket disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.connectWebSocket(), 5000);
            };
            
            this.ws.onerror = (error) => {
                console.error('Roadmap WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
        case 'milestone_created':
        case 'milestone_updated':
        case 'milestone_deleted':
            // Refresh roadmap display
            if (window.refreshRoadmap) {
                window.refreshRoadmap();
            }
            break;
        case 'settings_updated':
            // Refresh timeline settings
            if (window.refreshRoadmap) {
                window.refreshRoadmap();
            }
            break;
        default:
            console.log('Unknown WebSocket message:', data);
        }
    }

    // Conflict resolution
    async resolveConflict(localData, remoteData) {
        // Simple conflict resolution: remote wins with user notification
        console.warn('Conflict detected, remote data takes precedence');
        
        if (window.showNotification) {
            window.showNotification(
                'Data conflict resolved: Server data was used',
                'warning'
            );
        }
        
        return remoteData;
    }

    // Batch operations
    async batchUpdateMilestones(updates) {
        const results = [];
        
        for (const update of updates) {
            try {
                const result = await this.updateMilestone(update.id, update.data);
                results.push({ success: true, id: update.id, result });
            } catch (error) {
                results.push({ success: false, id: update.id, error: error.message });
            }
        }
        
        return results;
    }

    // Search and filter
    async searchMilestones(query, filters = {}) {
        try {
            const params = new URLSearchParams();
            params.append('search', query);
            
            // Add other filters
            Object.entries(filters).forEach(([key, value]) => {
                if (value) {
                    params.append(key, value);
                }
            });
            
            return await this.request(`/milestones/search?${params}`);
        } catch (error) {
            console.error('Failed to search milestones:', error);
            throw error;
        }
    }
}

// Initialize and export the API client
const roadmapAPI = new RoadmapAPIClient();

// Load sync queue on initialization
roadmapAPI.loadSyncQueue();

// Connect WebSocket if online
if (roadmapAPI.isOnline) {
    roadmapAPI.connectWebSocket();
}

// Make globally available
window.roadmapAPI = roadmapAPI;

console.log('✅ Roadmap API client loaded');
