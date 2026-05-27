// Roadmap Collaboration System
// Handles multi-user collaboration, comments, notifications, and real-time updates

class RoadmapCollaboration {
    constructor() {
        this.currentUser = null;
        this.activeUsers = new Map();
        this.comments = new Map();
        this.notifications = [];
        this.presenceInterval = null;
        
        // Initialize collaboration features
        this.init();
    }

    async init() {
        // Get current user (in a real app, this would come from auth system)
        this.currentUser = await this.getCurrentUser();
        
        // Initialize WebSocket for real-time collaboration
        this.initWebSocket();
        
        // Start presence broadcasting
        this.startPresenceBroadcast();
        
        // Load existing comments
        this.loadComments();
        
        // Setup UI event listeners
        this.setupEventListeners();
        
        console.log('✅ Roadmap collaboration system initialized');
    }

    async getCurrentUser() {
        // Mock user data - in production, this would come from authentication
        return {
            id: 'user-' + Math.random().toString(36).substr(2, 9),
            name: 'Current User',
            email: 'user@example.com',
            avatar: null,
            role: 'admin',
            permissions: ['read', 'write', 'delete', 'admin']
        };
    }

    initWebSocket() {
        if (!window.roadmapAPI || !window.roadmapAPI.ws) {
            console.warn('WebSocket not available for collaboration');
            return;
        }

        const ws = window.roadmapAPI.ws;
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (e) {
                console.log('📨 Received collaboration message:', event.data);
            }
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
        case 'user_joined':
            this.handleUserJoined(data);
            break;
        case 'user_left':
            this.handleUserLeft(data);
            break;
        case 'comment_added':
            this.handleCommentAdded(data);
            break;
        case 'milestone_updated':
            this.handleMilestoneUpdated(data);
            break;
        case 'presence_update':
            this.handlePresenceUpdate(data);
            break;
        default:
            console.log('Unknown collaboration message:', data);
        }
    }

    handleUserJoined(data) {
        const user = data.user;
        this.activeUsers.set(user.id, user);
        this.showNotification(`${user.name} joined the roadmap`, 'info');
        this.updateActiveUsersDisplay();
    }

    handleUserLeft(data) {
        const user = data.user;
        this.activeUsers.delete(user.id);
        this.showNotification(`${user.name} left the roadmap`, 'info');
        this.updateActiveUsersDisplay();
    }

    handleCommentAdded(data) {
        const comment = data.comment;
        const milestoneId = comment.milestone_id;
        
        // Add to local comments
        if (!this.comments.has(milestoneId)) {
            this.comments.set(milestoneId, []);
        }
        this.comments.get(milestoneId).push(comment);
        
        // Update UI
        this.updateCommentsDisplay(milestoneId);
        this.showNotification(`${comment.user.name} commented on ${comment.milestone_name}`, 'info');
    }

    handleMilestoneUpdated(data) {
        const { milestone, updated_by } = data;
        
        // Show notification if not current user
        if (updated_by.id !== this.currentUser.id) {
            this.showNotification(`${updated_by.name} updated ${milestone.name}`, 'info');
        }
        
        // Refresh roadmap if visible
        if (window.refreshRoadmap) {
            window.refreshRoadmap();
        }
    }

    handlePresenceUpdate(data) {
        const { user, cursor_position, milestone_id } = data;
        
        if (this.activeUsers.has(user.id)) {
            const activeUser = this.activeUsers.get(user.id);
            activeUser.cursor_position = cursor_position;
            activeUser.milestone_id = milestone_id;
            activeUser.last_seen = new Date();
            
            this.updateCursorDisplay(user.id, cursor_position, milestone_id);
        }
    }

    startPresenceBroadcast() {
        // Broadcast presence every 30 seconds
        this.presenceInterval = setInterval(() => {
            this.broadcastPresence();
        }, 30000);
    }

    broadcastPresence() {
        if (!window.roadmapAPI || !window.roadmapAPI.isOnline) {
            return;
        }
        
        const presence = {
            type: 'presence_update',
            user: this.currentUser,
            timestamp: new Date().toISOString()
        };
        
        // Send via WebSocket
        if (window.roadmapAPI.ws && window.roadmapAPI.ws.readyState === WebSocket.OPEN) {
            window.roadmapAPI.ws.send(JSON.stringify(presence));
        }
    }

    // Comments functionality
    async addComment(milestoneId, content, parentId = null) {
        try {
            const comment = {
                id: 'comment-' + Date.now(),
                milestone_id: milestoneId,
                user: this.currentUser,
                content: content,
                parent_id: parentId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            // Add to local comments
            if (!this.comments.has(milestoneId)) {
                this.comments.set(milestoneId, []);
            }
            this.comments.get(milestoneId).push(comment);
            
            // Send to server
            if (window.roadmapAPI && window.roadmapAPI.isOnline) {
                await this.sendCommentToServer(comment);
            }
            
            // Update UI
            this.updateCommentsDisplay(milestoneId);
            
            return comment;
        } catch (error) {
            console.error('Failed to add comment:', error);
            throw error;
        }
    }

    async sendCommentToServer(comment) {
        // In a real implementation, this would send to the API
        console.log('Sending comment to server:', comment);
    }

    async loadComments() {
        try {
            // In a real implementation, this would load from API
            // For now, load from localStorage
            const saved = localStorage.getItem('roadmap_comments');
            if (saved) {
                const commentsData = JSON.parse(saved);
                this.comments = new Map(Object.entries(commentsData));
            }
        } catch (error) {
            console.error('Failed to load comments:', error);
            this.comments = new Map();
        }
    }

    saveComments() {
        try {
            const commentsData = Object.fromEntries(this.comments);
            localStorage.setItem('roadmap_comments', JSON.stringify(commentsData));
        } catch (error) {
            console.error('Failed to save comments:', error);
        }
    }

    // UI Functions
    openCommentsModal(milestoneId, milestoneName) {
        const modal = document.createElement('div');
        modal.id = 'comments-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const comments = this.comments.get(milestoneId) || [];
        
        modal.textContent = `
            <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin: 0;">💬 Comments - ${milestoneName}</h3>
                    <button onclick="closeCommentsModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                        ✕
                    </button>
                </div>
                
                <div id="comments-list" style="margin-bottom: 1.5rem; max-height: 400px; overflow-y: auto;">
                    ${this.renderComments(comments)}
                </div>
                
                <div style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
                    <textarea id="new-comment" placeholder="Add a comment..." style="width: 100%; min-height: 80px; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); resize: vertical;"></textarea>
                    <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
                        <button onclick="addCommentToMilestone('${milestoneId}')" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                            Add Comment
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeCommentsModal();
            }
        });
        
        // Show modal
        setTimeout(() => {
            modal.style.display = 'flex';
        }, 100);
    }

    renderComments(comments) {
        if (comments.length === 0) {
            return '<p style="color: var(--text-secondary); text-align: center;">No comments yet. Be the first to comment!</p>';
        }
        
        return comments.map(comment => `
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; margin-right: 0.75rem; font-weight: 500;">
                        ${comment.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 500; color: var(--text-primary);">${comment.user.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${new Date(comment.created_at).toLocaleString()}</div>
                    </div>
                </div>
                <div style="color: var(--text-primary); line-height: 1.5;">${comment.content}</div>
            </div>
        `).join('');
    }

    updateCommentsDisplay(milestoneId) {
        const commentsList = document.getElementById('comments-list');
        if (commentsList) {
            const comments = this.comments.get(milestoneId) || [];
            commentsList.textContent = this.renderComments(comments) /* Replaced innerHTML with textContent for safety */
        }
    }

    closeCommentsModal() {
        const modal = document.getElementById('comments-modal');
        if (modal) {
            modal.style.display = 'none';
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        }
    }

    // Notifications
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10001;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        
        // Set background color based on type
        const colors = {
            info: 'var(--primary-color)',
            success: 'var(--success-color)',
            warning: 'var(--warning-color)',
            error: 'var(--danger-color)'
        };
        
        notification.style.background = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // Active users display
    updateActiveUsersDisplay() {
        const container = document.getElementById('active-users');
        if (!container) {
            return;
        }
        
        const users = Array.from(this.activeUsers.values());
        
        container.textContent = users.map(user => `
            <div style="display: flex /* Replaced innerHTML with textContent for safety */ align-items: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px; margin-bottom: 0.5rem;">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; margin-right: 0.5rem; font-size: 0.8rem; font-weight: 500;">
                    ${user.name.charAt(0).toUpperCase()}
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 0.9rem; color: var(--text-primary);">${user.name}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary);">Active now</div>
                </div>
            </div>
        `).join('');
    }

    // Cursor display for real-time collaboration
    updateCursorDisplay(userId, position, milestoneId) {
        // In a real implementation, this would show user cursors on the roadmap
        console.log(`User ${userId} cursor at ${position} in milestone ${milestoneId}`);
    }

    // Setup event listeners
    setupEventListeners() {
        // Listen for milestone clicks to add comments
        document.addEventListener('click', (e) => {
            if (e.target.closest('.milestone-comment-btn')) {
                const milestoneId = e.target.closest('.milestone-comment-btn').dataset.milestoneId;
                const milestoneName = e.target.closest('.milestone-comment-btn').dataset.milestoneName;
                this.openCommentsModal(milestoneId, milestoneName);
            }
        });
    }

    // Activity feed
    async logActivity(action, details) {
        const activity = {
            id: 'activity-' + Date.now(),
            user: this.currentUser,
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        };
        
        // Add to activity feed
        this.notifications.unshift(activity);
        
        // Keep only last 50 activities
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }
        
        // Update activity display
        this.updateActivityDisplay();
    }

    updateActivityDisplay() {
        const activityList = document.getElementById('activityList');
        if (!activityList) {
            return;
        }
        
        const recentActivities = this.notifications.slice(0, 10);
        
        activityList.textContent = recentActivities.map(activity => `
            <div style="padding: 0.75rem /* Replaced innerHTML with textContent for safety */ border-bottom: 1px solid var(--border-color); display: flex; align-items: center;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; margin-right: 0.75rem; font-weight: 500;">
                    ${activity.user.name.charAt(0).toUpperCase()}
                </div>
                <div style="flex: 1;">
                    <div style="color: var(--text-primary); font-size: 0.9rem;">
                        <strong>${activity.user.name}</strong> ${activity.action}
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.8rem;">
                        ${new Date(activity.timestamp).toLocaleString()}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Cleanup
    cleanup() {
        if (this.presenceInterval) {
            clearInterval(this.presenceInterval);
        }
        
        // Save data
        this.saveComments();
    }
}

// Global functions for UI interactions
window.addCommentToMilestone = function(milestoneId) {
    const textarea = document.getElementById('new-comment');
    const content = textarea.value.trim();
    
    if (!content) {
        alert('Please enter a comment');
        return;
    }
    
    if (window.roadmapCollaboration) {
        window.roadmapCollaboration.addComment(milestoneId, content)
            .then(() => {
                textarea.value = '';
            })
            .catch(error => {
                console.error('Failed to add comment:', error);
                alert('Failed to add comment');
            });
    }
};

window.closeCommentsModal = function() {
    if (window.roadmapCollaboration) {
        window.roadmapCollaboration.closeCommentsModal();
    }
};

// Team management functions
window.addTeamMember = function() {
    console.log('Adding team member...');
    
    // Create add team member modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">👥 Add Team Member</h3>
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="display: grid; gap: 1rem;">
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Name</label>
                    <input type="text" id="memberName" placeholder="Enter member name" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Email</label>
                    <input type="email" id="memberEmail" placeholder="Enter email address" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Role</label>
                    <select id="memberRole" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="">Select role</option>
                        <option value="developer">Developer</option>
                        <option value="designer">Designer</option>
                        <option value="manager">Manager</option>
                        <option value="analyst">Analyst</option>
                        <option value="stakeholder">Stakeholder</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Department</label>
                    <input type="text" id="memberDepartment" placeholder="Enter department" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="confirmAddTeamMember()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Add Member
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Show modal
    setTimeout(() => {
        modal.style.display = 'flex';
    }, 100);
};

window.confirmAddTeamMember = function() {
    const name = document.getElementById('memberName').value.trim();
    const email = document.getElementById('memberEmail').value.trim();
    const role = document.getElementById('memberRole').value;
    const department = document.getElementById('memberDepartment').value.trim();
    
    if (!name || !email || !role) {
        if (window.showNotification) {
            window.showNotification('Please fill in all required fields', 'warning');
        } else {
            alert('Please fill in all required fields');
        }
        return;
    }
    
    // Simulate adding team member
    if (window.showNotification) {
        window.showNotification(`${name} added to ${department} as ${role}!`, 'success');
    } else {
        alert(`${name} added to ${department} as ${role}!`);
    }
    
    // Close modal
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) {
        modal.remove();
    }
};

window.createDepartment = function() {
    console.log('Creating department...');
    
    // Create department modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🏢 Create Department</h3>
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="display: grid; gap: 1rem;">
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Department Name</label>
                    <input type="text" id="deptName" placeholder="Enter department name" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Department Head</label>
                    <input type="text" id="deptHead" placeholder="Enter department head name" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Budget</label>
                    <input type="text" id="deptBudget" placeholder="Enter budget (e.g., $50,000)" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Description</label>
                    <textarea id="deptDescription" placeholder="Enter department description" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); resize: vertical;"></textarea>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="confirmCreateDepartment()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Create Department
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Show modal
    setTimeout(() => {
        modal.style.display = 'flex';
    }, 100);
};

window.confirmCreateDepartment = function() {
    const name = document.getElementById('deptName').value.trim();
    const head = document.getElementById('deptHead').value.trim();
    const budget = document.getElementById('deptBudget').value.trim();
    const description = document.getElementById('deptDescription').value.trim();
    
    if (!name || !head) {
        if (window.showNotification) {
            window.showNotification('Please fill in department name and head', 'warning');
        } else {
            alert('Please fill in department name and head');
        }
        return;
    }
    
    // Simulate creating department
    if (window.showNotification) {
        window.showNotification(`Department "${name}" created with ${head} as head!`, 'success');
    } else {
        alert(`Department "${name}" created with ${head} as head!`);
    }
    
    // Close modal
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) {
        modal.remove();
    }
};

// Initialize collaboration system
let roadmapCollaboration;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        roadmapCollaboration = new RoadmapCollaboration();
        window.roadmapCollaboration = roadmapCollaboration;
    });
} else {
    roadmapCollaboration = new RoadmapCollaboration();
    window.roadmapCollaboration = roadmapCollaboration;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (roadmapCollaboration) {
        roadmapCollaboration.cleanup();
    }
});

console.log('✅ Roadmap collaboration system loaded');
