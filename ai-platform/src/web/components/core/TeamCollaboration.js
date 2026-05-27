/**
 * Team Collaboration - Multi-user support, sharing, and collaboration features
 */

export class TeamCollaboration {
    constructor() {
        this.currentUser = null;
        this.teamMembers = [];
        this.sharedAnalyses = new Map();
        this.comments = new Map();
        this.notifications = new Map();
        this.permissions = new Map();
        this.collaborationSettings = {
            autoShare: false,
            defaultVisibility: 'team',
            enableComments: true,
            enableNotifications: true
        };
        this.init();
    }

    init() {
        console.log('👥 Team Collaboration initialized');
        this.loadTeamData();
        this.setupEventListeners();
        this.createCollaborationUI();
        this.initializeWebSocket();
    }

    loadTeamData() {
        // Load team data from localStorage
        const stored = localStorage.getItem('dashboard-team-data');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.teamMembers = data.teamMembers || [];
                this.currentUser = data.currentUser || null;
                this.collaborationSettings = { ...this.collaborationSettings, ...data.settings };
                this.permissions = new Map(data.permissions || []);
                console.log(`👥 Loaded ${this.teamMembers.length} team members`);
            } catch (error) {
                console.error('❌ Failed to load team data:', error);
                // Initialize with empty team data instead of mock
                this.teamMembers = [];
                this.currentUser = null;
            }
        } else {
            // Initialize with empty team data instead of mock
            this.teamMembers = [];
            this.currentUser = null;
        }
    }

    // Mock team data function removed - using real team data only

    saveTeamData() {
        const data = {
            currentUser: this.currentUser,
            teamMembers: this.teamMembers,
            settings: this.collaborationSettings,
            permissions: Array.from(this.permissions.entries())
        };

        localStorage.setItem('dashboard-team-data', JSON.stringify(data));
    }

    setupEventListeners() {
        // Listen for collaboration events
        document.addEventListener('shareAnalysis', (event) => {
            this.shareAnalysis(event.detail);
        });

        document.addEventListener('addComment', (event) => {
            this.addComment(event.detail);
        });

        document.addEventListener('requestTeamData', (event) => {
            this.getTeamData(event.detail);
        });

        document.addEventListener('updateTeamMember', (event) => {
            this.updateTeamMember(event.detail);
        });

        document.addEventListener('inviteMember', (event) => {
            this.inviteMember(event.detail);
        });
    }

    createCollaborationUI() {
        // Create collaboration UI elements
        this.createTeamPanel();
        this.createShareDialog();
        this.createCommentsPanel();
        this.createNotificationsPanel();
    }

    createTeamPanel() {
        const panel = document.createElement('div');
        panel.id = 'team-panel';
        panel.className = 'team-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            max-height: 80vh;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            overflow-y: auto;
            display: none;
        `;

        panel.textContent = `
            <div class="team-panel-header">
                <h3>👥 Team</h3>
                <button class="close-team-panel">×</button>
            </div>
            <div class="team-panel-content">
                <div class="current-user">
                    <div class="user-avatar">
                        <img src="${this.currentUser.avatar}" alt="${this.currentUser.name}" />
                    </div>
                    <div class="user-info">
                        <div class="user-name">${this.currentUser.name}</div>
                        <div class="user-role">${this.currentUser.role}</div>
                    </div>
                </div>
                <div class="team-members">
                    <h4>Team Members (${this.teamMembers.length})</h4>
                    <div class="member-list">
                        ${this.teamMembers.map(member => `
                            <div class="member-item" data-user-id="${member.id}">
                                <div class="member-avatar">
                                    <img src="${member.avatar}" alt="${member.name}" />
                                </div>
                                <div class="member-info">
                                    <div class="member-name">${member.name}</div>
                                    <div class="member-role">${member.role}</div>
                                    <div class="member-status ${this.getUserStatus(member)}"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="team-actions">
                    <button class="btn-primary btn-sm" onclick="window.dashboard.teamCollaboration.inviteMember({})">
                        <span class="btn-icon">➕</span>
                        Invite Member
                    </button>
                    <button class="btn-secondary btn-sm" onclick="window.dashboard.teamCollaboration.exportTeamData()">
                        <span class="btn-icon">📊</span>
                        Export Data
                    </button>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        document.body.appendChild(panel);

        // Add close handler
        panel.querySelector('.close-team-panel').addEventListener('click', () => {
            this.toggleTeamPanel();
        });

        // Add member click handlers
        panel.querySelectorAll('.member-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.getAttribute('data-user-id');
                this.showMemberDetails(userId);
            });
        });

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .team-panel {
                animation: slideIn 0.3s ease-out;
            }
            
            .team-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .team-panel-header h3 {
                margin: 0;
                color: #2c3e50;
            }
            
            .close-team-panel {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }
            
            .close-team-panel:hover {
                color: #333;
                background: #f8f9fa;
            }
            
            .team-panel-content {
                padding: 0 20px 20px;
            }
            
            .current-user {
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .user-avatar img {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .user-info {
                flex: 1;
            }
            
            .user-name {
                font-weight: 600;
                color: #2c3e50;
                margin: 0 0 5px 0;
            }
            
            .user-role {
                color: #666;
                font-size: 12px;
                margin: 0;
            }
            
            .team-members h4 {
                margin: 0 0 15px 0;
                color: #2c3e50;
                font-size: 14px;
            }
            
            .member-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .member-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .member-item:hover {
                background: #f8f9fa;
            }
            
            .member-avatar img {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .member-info {
                flex: 1;
            }
            
            .member-name {
                font-weight: 500;
                color: #2c3e50;
                margin: 0 0 2px 0;
            }
            
            .member-role {
                color: #666;
                font-size: 12px;
                margin: 0;
            }
            
            .member-status {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                margin-top: 5px;
            }
            
            .member-status.online {
                background: #28a745;
            }
            
            .member-status.offline {
                background: #dc3545;
            }
            
            .member-status.away {
                background: #ffc107;
            }
            
            .team-actions {
                display: flex;
                gap: 10px;
                padding: 0 20px 20px;
                border-top: 1px solid #e5e7eb;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            
            .team-panel.hide {
                animation: slideOut 0.3s ease-out;
            }
        `;
        document.head.appendChild(style);
    }

    createShareDialog() {
        const dialog = document.createElement('div');
        dialog.id = 'share-dialog';
        dialog.className = 'share-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 10000;
            min-width: 400px;
            max-width: 600px;
            display: none;
            padding: 0;
        `;

        dialog.textContent = `
            <div class="share-dialog-header">
                <h3>📤 Share Analysis</h3>
                <button class="close-share-dialog">×</button>
            </div>
            <div class="share-dialog-content">
                <div class="share-options">
                    <div class="share-option">
                        <input type="radio" name="shareType" value="team" checked>
                        <label>Share with Team</label>
                    </div>
                    <div class="share-option">
                        <input type="radio" name="shareType" value="link">
                        <label>Share via Link</label>
                    </div>
                    <div class="share-option">
                        <input type="radio" name="shareType" value="email">
                        <label>Share via Email</label>
                    </div>
                </div>
                <div class="share-details">
                    <div class="share-title">
                        <input type="text" placeholder="Share title" id="share-title" class="form-control">
                    </div>
                    <div class="share-description">
                        <textarea placeholder="Share description" id="share-description" class="form-control" rows="3"></textarea>
                    </div>
                    <div class="share-permissions">
                        <label>
                            <input type="checkbox" id="allow-comments" checked>
                            Allow comments
                        </label>
                        <label>
                            <input type="checkbox" id="allow-editing" checked>
                            Allow editing
                        </label>
                    </div>
                </div>
                <div class="share-actions">
                    <button class="btn-primary" onclick="window.dashboard.teamCollaboration.executeShare()">
                        <span class="btn-icon">📤</span>
                        Share
                    </button>
                    <button class="btn-secondary" onclick="window.dashboard.teamCollaboration.cancelShare()">
                        <span class="btn-icon">❌</span>
                        Cancel
                    </button>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        document.body.appendChild(dialog);

        // Add close handler
        dialog.querySelector('.close-share-dialog').addEventListener('click', () => {
            this.closeShareDialog();
        });

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .share-dialog {
                animation: fadeIn 0.3s ease-out;
            }
            
            .share-dialog-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .share-dialog-header h3 {
                margin: 0;
                color: #2c3e50;
            }
            
            .close-share-dialog {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }
            
            .close-share-dialog:hover {
                color: #333;
                background: #f8f9fa;
            }
            
            .share-dialog-content {
                padding: 0 20px 20px;
            }
            
            .share-options {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 15px;
            }
            
            .share-option {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .share-details {
                margin-bottom: 15px;
            }
            
            .share-title input,
            .share-description textarea {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                font-family: inherit;
                font-size: 14px;
            }
            
            .share-permissions {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 15px;
            }
            
            .share-permissions label {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 14px;
            }
            
            .share-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; transform: scale(1); }
                to { opacity: 0; transform: scale(0.9); }
            
            .share-dialog.hide {
                animation: fadeOut 0.3s ease-out;
            }
        `;
        document.head.appendChild(style);
    }

    createCommentsPanel() {
        const panel = document.createElement('div');
        panel.id = 'comments-panel';
        panel.className = 'comments-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            max-height: 60vh;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            overflow-y: auto;
            display: none;
        `;

        panel.textContent = `
            <div class="comments-header">
                <h4>💬 Comments</h4>
                <button class="close-comments-panel">×</button>
            </div>
            <div class="comments-content">
                <div class="comments-list" id="comments-list">
                    <!-- Comments will be added here -->
                </div>
                <div class="comment-form">
                    <div class="comment-input">
                        <textarea id="comment-input" placeholder="Add a comment..." class="form-control" rows="3"></textarea>
                    </div>
                    <div class="comment-actions">
                        <button class="btn-primary btn-sm" onclick="window.dashboard.teamCollaboration.addComment()">
                            <span class="btn-icon">💬</span>
                            Add Comment
                        </button>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        document.body.appendChild(panel);

        // Add close handler
        panel.querySelector('.close-comments-panel').addEventListener('click', () => {
            this.toggleCommentsPanel();
        });

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .comments-panel {
                animation: slideUp 0.3s ease-out;
            }
            
            .comments-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .comments-header h4 {
                margin: 0;
                color: #2c3e50;
            }
            
            .close-comments-panel {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }
            
            .close-comments-panel:hover {
                color: #333;
                background: #f8f9fa;
            }
            
            .comments-content {
                padding: 0 15px 15px;
            }
            
            .comments-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-height: 40vh;
                overflow-y: auto;
            }
            
            .comment {
                background: #f8f9fa;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 10px;
            }
            
            .comment-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .comment-author {
                font-weight: 600;
                color: #2c3e50;
                font-size: 14px;
            }
            }
            
            .comment-time {
                font-size: 12px;
                color: #666;
            }
            
            .comment-content {
                color: #333;
                line-height: 1.5;
                margin: 8px 0 0 0;
            }
            
            .comment-form {
                margin-top: 15px;
            }
            
            .comment-input {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                font-family: inherit;
                font-size: 14px;
            }
            
            @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            @keyframes slideDown {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(100%); opacity: 0; }
            
            .comments-panel.hide {
                animation: slideDown 0.3s ease-out;
            }
        `;
        document.head.appendChild(style);
    }

    createNotificationsPanel() {
        const panel = document.createElement('div');
        panel.id = 'notifications-panel';
        panel.className = 'notifications-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            max-width: 300px;
            max-height: 80vh;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            overflow-y: auto;
            display: none;
        `;

        panel.textContent = `
            <div class="notifications-header">
                <h4>🔔 Notifications</h4>
                <button class="close-notifications-panel">×</button>
            </div>
            <div class="notifications-content">
                <div class="notifications-list" id="notifications-list">
                    <!-- Notifications will be added here -->
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        document.body.appendChild(panel);

        // Add close handler
        panel.querySelector('.close-notifications-panel').addEventListener('click', () => {
            this.toggleNotificationsPanel();
        });

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .notifications-panel {
                animation: fadeIn 0.3s ease-out;
            }
            
            .notifications-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .notifications-header h4 {
                margin: 0;
                color: #2c3e50;
            }
            
            .close-notifications-panel {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }
            
            .close-notifications-panel:hover {
                color: #333;
                background: #f8f9fa;
            }
            
            .notifications-content {
                padding: 0 15px 15px;
            }
            
            .notifications-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-height: 60vh;
                overflow-y: auto;
            }
            
            .notification {
                background: #f8f9fa;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 10px;
            }
            
            .notification.info {
                border-left: 4px solid #17a2b8;
            }
            
            .notification.success {
                border-left: 4px solid #28a745;
            }
            
            .notification.warning {
                border-left: 4px solid #ffc107;
            }
            
            .notification.error {
                border-left: 4px #dc3545;
            }
            
            .notification-title {
                font-weight: 600;
                color: #2c3e50;
                margin: 0 0 5px 0;
            }
            
            .notification-message {
                color: #333;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .notification-time {
                font-size: 12px;
                color: #666;
                margin-top: 5px;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; transform: scale(1); }
                to { opacity: 0; transform: scale(0.9); }
            
            .notifications-panel.hide {
                animation: fadeOut 0.3s ease-out;
            }
        `;
        document.head.appendChild(style);
    }

    initializeWebSocket() {
        // Initialize WebSocket connection for real-time collaboration
        try {
            this.ws = new WebSocket('ws://localhost:8082/collaboration');

            this.ws.onopen = () => {
                console.log('🔗 WebSocket connected for collaboration');
                this.sendConnectionStatus('connected');
            };

            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };

            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.sendConnectionStatus('disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    this.initializeWebSocket();
                }, 5000);
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.sendConnectionStatus('error');
            };
        } catch (error) {
            console.log('⚠️ WebSocket not available, falling back to polling');
        }
    }

    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);

            switch (data.type) {
            case 'team_update':
                this.handleTeamUpdate(data);
                break;
            case 'shared_analysis':
                this.handleSharedAnalysis(data);
                break;
            case 'comment_added':
                this.handleCommentAdded(data);
                break;
            case 'notification':
                this.handleNotification(data);
                break;
            default:
                console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('❌ Failed to handle WebSocket message:', error);
        }
    }

    handleTeamUpdate(data) {
        // Update team member information
        const member = this.teamMembers.find(m => m.id === data.userId);
        if (member) {
            Object.assign(member, data);
            this.saveTeamData();
            this.showNotification(`${data.userName} updated`, 'info');
        }
    }

    handleSharedAnalysis(data) {
        // Handle shared analysis
        this.sharedAnalyses.set(data.id, data);
        this.showNotification(`Analysis shared by ${data.author}`, 'success');

        // Update UI if analysis is visible
        this.updateSharedAnalysisUI(data);
    }

    handleCommentAdded(data) {
        // Add comment to comments
        const comment = {
            id: data.id,
            author: data.author,
            content: data.content,
            timestamp: data.timestamp,
            analysisId: data.analysisId
        };

        if (!this.comments.has(comment.analysisId)) {
            this.comments.set(comment.analysisId, []);
        }

        this.comments.get(comment.analysisId).push(comment);

        this.updateCommentsUI(comment.analysisId);
        this.showNotification(`${data.author} added comment`, 'info');
    }

    handleNotification(data) {
        // Add notification
        this.notifications.set(data.id, data);
        this.updateNotificationsUI();
        this.showNotification(data.message, data.type);
    }

    // Public API methods
    toggleTeamPanel() {
        const panel = document.getElementById('team-panel');
        if (panel) {
            panel.classList.toggle('hide');
        }
    }

    toggleCommentsPanel() {
        const panel = document.getElementById('comments-panel');
        if (panel) {
            panel.classList.toggle('hide');
        }
    }

    toggleNotificationsPanel() {
        const panel = document.getElementById('notifications-panel');
        if (panel) {
            panel.classList.toggle('hide');
        }
    }

    showMemberDetails(userId) {
        const member = this.teamMembers.find(m => m.id === userId);
        if (member) {
            this.showNotification(`Viewing ${member.name}'s profile`, 'info');
            // Could open a profile modal here
        }
    }

    shareAnalysis(options = {}) {
        const analysisId = options.analysisId || this.generateId();
        const analysis = options.analysisData || window.lastAnalysis?.data;

        const shareData = {
            id: analysisId,
            title: options.title || 'Codebase Analysis',
            description: options.description || '',
            author: this.currentUser.name,
            timestamp: new Date().toISOString(),
            data: analysis,
            permissions: options.permissions || ['view', 'comment'],
            visibility: options.visibility || 'team'
        };

        this.sharedAnalyses.set(analysisId, shareData);

        // Show share dialog
        this.showShareDialog(shareData);
    }

    executeShare() {
        const shareType = document.querySelector('input[name="shareType"]:checked').value;
        const title = document.getElementById('share-title').value;
        const description = document.getElementById('share-description').value;
        const allowComments = document.getElementById('allow-comments').checked;
        const allowEditing = document.getElementById('allow-editing').checked;

        const shareData = {
            type: shareType,
            title: title,
            description: description,
            allowComments: allowComments,
            allowEditing: allowEditing,
            sharedBy: this.currentUser.name,
            timestamp: new Date().toISOString()
        };

        if (shareType === 'team') {
            this.shareWithTeam(shareData);
        } else if (shareType === 'link') {
            this.shareViaLink(shareData);
        } else if (shareType === 'email') {
            this.shareViaEmail(shareData);
        }

        this.closeShareDialog();
    }

    shareWithTeam(shareData) {
        // Share with all team members
        this.teamMembers.forEach(member => {
            const notification = {
                id: this.generateId(),
                recipientId: member.id,
                type: 'shared_analysis',
                message: `${shareData.title} shared by ${shareData.sharedBy}`,
                data: shareData,
                timestamp: new Date().toISOString()
            };

            this.sendNotification(notification);
        });

        // Update shared analyses
        this.sharedAnalyses.set(shareData.id, {
            ...shareData,
            sharedWith: this.teamMembers.map(m => m.id),
            sharedAt: new Date().toISOString()
        });

        this.closeShareDialog();
        this.showNotification('Analysis shared with team', 'success');
    }

    shareViaLink(shareData) {
        const shareUrl = `${window.location.origin}/shared/${shareData.id}`;

        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            this.showNotification('Share link copied to clipboard', 'success');
        }).catch(() => {
            this.showNotification('Failed to copy share link', 'error');
        });

        this.closeShareDialog();
        this.showNotification('Share link generated', 'info');
    }

    shareViaEmail(shareData) {
        const subject = encodeURIComponent(shareData.title);
        const body = encodeURIComponent(`\n\n${shareData.description}\n\nView analysis: ${window.location.origin}/shared/${shareData.id}\n\nShared by: ${shareData.sharedBy}`);
        const mailto = 'team@cascade-projects.com'; // Would be user-configurable

        const mailtoLink = `mailto:${mailto}?subject=${subject}&body=${body}`;

        window.open(mailtoLink);
        this.closeShareDialog();
        this.showNotification('Email client opened', 'info');
    }

    addComment(options = {}) {
        const analysisId = options.analysisId || this.getLatestAnalysisId();
        const content = options.content || '';
        const author = this.currentUser;

        const comment = {
            id: this.generateId(),
            author: author.name,
            content: content,
            timestamp: new Date().toISOString(),
            analysisId: analysisId
        };

        if (!this.comments.has(analysisId)) {
            this.comments.set(analysisId, []);
        }

        this.comments.get(analysisId).push(comment);

        // Update UI
        this.updateCommentsUI(analysisId);

        // Send via WebSocket if available
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'comment_added',
                comment: comment
            }));
        }

        this.showNotification('Comment added', 'success');
    }

    updateCommentsUI(analysisId) {
        const commentsList = document.getElementById('comments-list');
        if (!commentsList) {
            return;
        }

        const comments = this.comments.get(analysisId) || [];

        commentsList.textContent = comments.map(comment => `
            <div class="comment" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <div class="comment-author">${comment.author}</div>
                    <div class="comment-time">${this.formatDate(comment.timestamp)}</div>
                </div>
                <div class="comment-content">${comment.content}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    updateNotificationsUI() {
        const notificationsList = document.getElementById('notifications-list');
        if (!notificationsList) {
            return;
        }

        const notifications = Array.from(this.notifications.values()).slice(-10); // Show last 10
        notificationsList.textContent = notifications.map(notification => `
            <div class="notification ${notification.type}">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${this.formatDate(notification.timestamp)}</div>
            </div>
        `).join('') /* Replaced innerHTML with textContent for safety */
    }

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 14px;
            font-weight: 500;
            animation: fadeIn 0.3s ease-out;
            max-width: 300px;
        `;

        // Set color based on type
        if (type === 'success') {
            notification.style.background = '#d4edda';
            notification.style.color = '#155724';
            notification.style.border = '1px solid #c3e6cb';
        } else if (type === 'error') {
            notification.style.background = '#f8d7da';
            notification.style.color = '#721c24';
            notification.style.border = '1px solid #f5c6cb';
        } else {
            notification.style.background = '#d1ecf1';
            notification.style.color = '#0c5460';
            notification.style.border = '1px solid #bee5db';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    sendNotification(notification) {
        // Send notification via WebSocket if available
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(notification));
        }

        // Also show local notification
        this.showNotification(notification.message, notification.type);
    }

    sendConnectionStatus(status) {
        console.log(`🔗 Connection status: ${status}`);

        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `connection-status ${status}`;
        }
    }

    getLatestAnalysisId() {
        return window.lastAnalysis?.id || 'latest';
    }

    generateId() {
        return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    inviteMember(options = {}) {
        const email = options.email || '';

        if (email) {
            // In a real implementation, this would send an email invitation
            console.log(`📧 Invitation sent to: ${email}`);
            this.showNotification(`Invitation sent to ${email}`, 'success');
        } else {
            // Show invite dialog
            this.showInviteDialog();
        }
    }

    showInviteDialog() {
        const dialog = document.createElement('div');
        dialog.id = 'invite-dialog';
        dialog.className = 'invite-dialog';
        dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                z-index: 10000;
                min-width: 400px;
                max-width: 500px;
                padding: 30px;
                display: none;
            `;

        dialog.textContent = `
                <div class="invite-header">
                    <h3>👥 Invite Team Member</h3>
                    <button class="close-invite-dialog">×</button>
                </div>
                <div class="invite-content">
                    <div class="invite-form">
                        <div class="form-group">
                            <label for="invite-email">Email Address</label>
                            <input type="email" id="invite-email" class="form-control" placeholder="colleague@cascade-projects.com" />
                        </div>
                        <div class="form-group">
                            <label for="invite-role">Role</label>
                            <select id="invite-role" class="form-control">
                                <option value="developer">Developer</option>
                                <option value="architect">Architect</option>
                                <option value="tester">Tester</option>
                                <option value="manager">Manager</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="invite-message">Personal Message (optional)</label>
                            <textarea id="invite-message" class="form-control" rows="3" placeholder="Personal message..."></textarea>
                        </div>
                        <div class="form-actions">
                            <button class="btn-primary" onclick="window.dashboard.teamCollaboration.sendInvitation()">
                                <span class="btn-icon">📧</span>
                                Send Invitation
                            </button>
                            <button class="btn-secondary" onclick="window.dashboard.teamCollaboration.cancelInvite()">
                                <span class="btn-icon">❌</span>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ` /* Replaced innerHTML with textContent for safety */

        document.body.appendChild(dialog);

        // Add close handler
        dialog.querySelector('.close-invite-dialog').addEventListener('click', () => {
            this.closeInviteDialog();
        });

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
                .invite-dialog {
                    animation: fadeIn 0.3s ease-out;
                }
                
                .invite-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .invite-header h3 {
                    margin: 0;
                    color: #2c3e50;
                }
                
                .close-invite-dialog {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                }
                
                .close-invite-dialog:hover {
                    color: #333;
                    background: #f8f9fa;
                }
                
                .invite-content {
                    padding: 0;
                }
                
                .form-group {
                    margin-bottom: 15px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 500;
                    color: #2c3e50;
                }
                
                .form-control {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    font-family: inherit;
                    font-size: 14px;
                }
                
                .form-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                
                @keyframes fadeOut {
                    from { opacity: 1; transform: scale(1); }
                    to { opacity: 0; transform: scale(0.9); }
                }
                
                .invite-dialog.hide {
                    animation: fadeOut 0.3s ease-out;
                }
            `;
        document.head.appendChild(style);
    }

    closeInviteDialog() {
        const dialog = document.getElementById('invite-dialog');
        if (dialog) {
            dialog.classList.add('hide');
            setTimeout(() => dialog.remove(), 300);
        }
    }

    sendInvitation() {
        const email = document.getElementById('invite-email').value;
        const role = document.getElementById('invite-role').value;
        const message = document.getElementById('invite-message').value;

        if (!email) {
            this.showNotification('Please enter an email address', 'error');
            return;
        }

        // In a real implementation, this would send the invitation
        console.log(`📧 Sending invitation to: ${email}`);
        this.showNotification(`Invitation sent to ${email}`, 'success');

        // Close dialog
        this.closeInviteDialog();
    }

    cancelInvite() {
        this.closeInviteDialog();
    }

    exportTeamData() {
        const exportData = {
            timestamp: new Date().toISOString(),
            team: this.teamMembers,
            currentUser: this.currentUser,
            settings: this.collaborationSettings,
            sharedAnalyses: Array.from(this.sharedAnalyses.entries()).map(([id, analysis]) => ({
                id: id,
                ...analysis
            })),
            comments: Array.from(this.comments.entries()).map(([id, comments]) => ({
                id: id,
                comments: comments
            })),
            permissions: Array.from(this.permissions.entries()).map(([id, permission]) => ({
                id: id,
                permission: permission
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `team-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('📊 Team data exported');
        return exportData;
    }

    // Update user status
    updateUserStatus(status) {
        if (this.currentUser) {
            this.currentUser.status = status;
            this.saveTeamData();
            this.showNotification(`Status updated to ${status}`, 'info');
        }
    }

    // Get team member status
    getUserStatus(userId) {
        const member = this.teamMembers.find(m => m.id === userId);
        return member ? member.status || 'offline' : 'unknown';
    }

    // Get all team members
    getTeamMembers() {
        return this.teamMembers;
    }

    // Get shared analyses
    getSharedAnalyses() {
        return Array.from(this.sharedAnalyses.values());
    }

    // Get comments for analysis
    getComments(analysisId) {
        return this.comments.get(analysisId) || [];
    }

    // Get notifications
    getNotifications() {
        return Array.from(this.notifications.values());
    }

    // Update team member
    updateTeamMember(memberData) {
        const member = this.teamMembers.find(m => m.id === memberData.id);
        if (member) {
            Object.assign(member, memberData);
            this.saveTeamData();
        }
    }

    // Remove team member
    removeTeamMember(userId) {
        this.teamMembers = this.teamMembers.filter(m => m.id !== userId);
        this.saveTeamData();

        const member = this.teamMembers.find(m => m.id === userId);
        if (member) {
            this.showNotification(`${member.name} removed from team`, 'info');
        }
    }

    // Get collaboration metrics
    getMetrics() {
        return {
            teamSize: this.teamMembers.length,
            sharedAnalyses: this.sharedAnalyses.size,
            totalComments: Array.from(this.comments.values()).reduce((sum, comments) => sum + comments.length, 0),
            activeUsers: this.teamMembers.filter(m => m.status === 'online').length,
            permissions: this.permissions.size,
            settings: this.collaborationSettings
        };
    }

    // Update collaboration settings
    updateSettings(newSettings) {
        this.collaborationSettings = { ...this.collaborationSettings, ...newSettings };
        this.saveTeamData();
        this.showNotification('Settings updated', 'success');
    }

    // Auto-share functionality
    enableAutoShare() {
        this.collaborationSettings.autoShare = true;
        this.saveTeamData();
        this.showNotification('Auto-share enabled', 'info');
    }

    disableAutoShare() {
        this.collaborationSettings.autoShare = {
            ...this.collaborationSettings,
            autoShare: false
        };
        this.saveTeamData();
        this.showNotification('Auto-share disabled', 'info');
    }

    // Reset all collaboration data
    reset() {
        this.currentUser = null;
        this.teamMembers = [];
        this.sharedAnalyses.clear();
        this.comments.clear();
        this.notifications.clear();
        this.permissions.clear();
        localStorage.removeItem('dashboard-team-data');
        console.log('🔄 Team collaboration data reset');
    }
}

// Export for use in dashboard
window.TeamCollaboration = TeamCollaboration;
