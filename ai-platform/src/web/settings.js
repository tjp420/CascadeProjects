// Settings Module
console.log('⚙️ Settings module loading...');

// Mock settings data
const settingsData = {
    userSettings: {
        profile: {
            name: 'AI Assistant',
            email: 'ai.assistant@company.com',
            role: 'Administrator',
            avatar: 'AI',
            timezone: 'America/Chicago',
            language: 'en-US',
            theme: 'dark',
            notifications: {
                email: true,
                push: true,
                desktop: false,
                reports: true,
                alerts: true,
                updates: false
            }
        },
        preferences: {
            dashboard: {
                defaultView: 'overview',
                refreshInterval: 30,
                autoRefresh: true,
                compactMode: false,
                showAnimations: true,
                chartAnimations: true
            },
            data: {
                dateFormat: 'MM/DD/YYYY',
                timeFormat: '12-hour',
                currency: 'USD',
                numberFormat: 'en-US',
                decimalPlaces: 2
            },
            privacy: {
                analytics: true,
                crashReports: true,
                usageData: false,
                personalizedContent: true
            }
        },
        security: {
            twoFactorAuth: false,
            sessionTimeout: 60,
            passwordExpiry: 90,
            loginAttempts: 5,
            requireStrongPassword: true,
            lastPasswordChange: '2024-03-15'
        }
    },
    systemSettings: {
        general: {
            systemName: 'AI Coding Intelligence Dashboard',
            version: '2.1.0',
            environment: 'production',
            maintenanceMode: false,
            debugMode: false,
            logLevel: 'info'
        },
        performance: {
            maxConcurrentUsers: 100,
            sessionTimeout: 120,
            cacheTimeout: 300,
            compressionEnabled: true,
            minificationEnabled: true,
            cdnEnabled: true
        },
        backup: {
            autoBackup: true,
            backupFrequency: 'daily',
            retentionPeriod: 30,
            backupLocation: 'cloud',
            encryptionEnabled: true,
            compressionEnabled: true,
            lastBackup: '2024-05-20T13:00:00'
        },
        integrations: {
            slack: {
                enabled: true,
                webhookUrl: 'https://hooks.slack.com/services/...',
                channel: '#dashboard-alerts',
                notifications: ['critical', 'warnings']
            },
            email: {
                enabled: true,
                smtpServer: 'smtp.company.com',
                port: 587,
                encryption: 'tls',
                fromAddress: 'dashboard@company.com'
            },
            api: {
                enabled: true,
                rateLimit: 1000,
                apiKeyRequired: true,
                corsEnabled: true,
                version: 'v1'
            }
        },
        limits: {
            maxFileSize: 100,
            maxStorage: 1000,
            maxReports: 10000,
            maxConcurrentExports: 5,
            sessionDuration: 120
        }
    },
    auditLog: [
        {
            id: 'audit_001',
            timestamp: '2024-05-20T13:25:00',
            user: 'AI Assistant',
            action: 'Settings Updated',
            category: 'configuration',
            details: 'Updated dashboard refresh interval to 30 seconds',
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        {
            id: 'audit_002',
            timestamp: '2024-05-20T12:15:00',
            user: 'AI Assistant',
            action: 'Security Settings Modified',
            category: 'security',
            details: 'Enabled two-factor authentication',
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        {
            id: 'audit_003',
            timestamp: '2024-05-20T11:30:00',
            user: 'AI Assistant',
            action: 'Integration Added',
            category: 'integrations',
            details: 'Connected Slack integration for notifications',
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
    ]
};

// Show settings
function showSettings(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-cog"></i> Settings
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="saveAllSettings()">
                        <i class="fas fa-save"></i> Save All
                    </button>
                    <button class="btn btn-secondary" onclick="resetSettings()">
                        <i class="fas fa-undo"></i> Reset
                    </button>
                    <button class="btn btn-secondary" onclick="exportSettings()">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            </div>
            
            <!-- Settings Tabs -->
            <div class="settings-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showSettingsTab('profile')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Profile
                    </button>
                    <button class="tab-btn" onclick="showSettingsTab('preferences')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Preferences
                    </button>
                    <button class="tab-btn" onclick="showSettingsTab('security')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Security
                    </button>
                    <button class="tab-btn" onclick="showSettingsTab('system')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        System
                    </button>
                    <button class="tab-btn" onclick="showSettingsTab('integrations')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Integrations
                    </button>
                    <button class="tab-btn" onclick="showSettingsTab('audit')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Audit Log
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="settings-tab-content">
                ${getProfileContent()}
            </div>
        </div>
    `;
}

// Get profile content
function getProfileContent() {
    return `
        <div class="profile-settings">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- User Profile -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">User Profile</h3>
                    
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                        <div class="avatar-preview" style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), var(--success-color)); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.5rem;">
                            ${settingsData.userSettings.profile.avatar}
                        </div>
                        <div>
                            <button class="btn btn-sm btn-secondary" onclick="changeAvatar()">
                                <i class="fas fa-camera"></i> Change Avatar
                            </button>
                        </div>
                    </div>
                    
                    <div style="display: grid; gap: 1rem;">
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Name</label>
                            <input type="text" value="${settingsData.userSettings.profile.name}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Email</label>
                            <input type="email" value="${settingsData.userSettings.profile.email}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Role</label>
                            <input type="text" value="${settingsData.userSettings.profile.role}" readonly style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-secondary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Timezone</label>
                            <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="America/Chicago" selected>America/Chicago</option>
                                <option value="America/New_York">America/New York</option>
                                <option value="Europe/London">Europe/London</option>
                                <option value="Asia/Tokyo">Asia/Tokyo</option>
                            </select>
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Language</label>
                            <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="en-US" selected>English (US)</option>
                                <option value="es-ES">Spanish</option>
                                <option value="fr-FR">French</option>
                                <option value="de-DE">German</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- Notifications -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Notification Preferences</h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        ${Object.entries(settingsData.userSettings.profile.notifications).map(([key, value]) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                <div>
                                    <div style="color: var(--text-primary); font-weight: 500;">${formatNotificationLabel(key)}</div>
                                    <div style="color: var(--text-secondary); font-size: 0.9rem;">${formatNotificationDescription(key)}</div>
                                </div>
                                <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                    <input type="checkbox" ${value ? 'checked' : ''} onchange="toggleNotification('${key}')" style="opacity: 0; width: 0; height: 0;">
                                    <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${value ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                        <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${value ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                    </span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Get preferences content
function getPreferencesContent() {
    return `
        <div class="preferences-settings">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- Dashboard Preferences -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Dashboard Preferences</h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Default View</label>
                            <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="overview" selected>Overview</option>
                                <option value="sprint-status">Sprint Status</option>
                                <option value="complexity-analysis">Complexity Analysis</option>
                                <option value="performance">Performance Metrics</option>
                            </select>
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Refresh Interval (seconds)</label>
                            <input type="number" value="${settingsData.userSettings.preferences.dashboard.refreshInterval}" min="10" max="300" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Auto Refresh</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Automatically refresh dashboard data</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                <input type="checkbox" ${settingsData.userSettings.preferences.dashboard.autoRefresh ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settingsData.userSettings.preferences.dashboard.autoRefresh ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${settingsData.userSettings.preferences.dashboard.autoRefresh ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                </span>
                            </label>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Compact Mode</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Use compact layout for dashboard</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                <input type="checkbox" ${settingsData.userSettings.preferences.dashboard.compactMode ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settingsData.userSettings.preferences.dashboard.compactMode ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${settingsData.userSettings.preferences.dashboard.compactMode ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- Data Preferences -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Data Preferences</h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Date Format</label>
                            <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="MM/DD/YYYY" selected>MM/DD/YYYY</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                <option value="DD-MMM-YYYY">DD-MMM-YYYY</option>
                            </select>
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Time Format</label>
                            <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="12-hour" selected>12-hour</option>
                                <option value="24-hour">24-hour</option>
                            </select>
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Currency</label>
                            <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="USD" selected>USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="JPY">JPY (¥)</option>
                            </select>
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Number Format</label>
                            <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="en-US" selected>English (US)</option>
                                <option value="en-GB">English (UK)</option>
                                <option value="de-DE">German</option>
                                <option value="fr-FR">French</option>
                            </select>
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Decimal Places</label>
                            <input type="number" value="${settingsData.userSettings.preferences.data.decimalPlaces}" min="0" max="6" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Privacy Settings -->
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-top: 2rem;">
                <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Privacy Settings</h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                    ${Object.entries(settingsData.userSettings.preferences.privacy).map(([key, value]) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">${formatPrivacyLabel(key)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">${formatPrivacyDescription(key)}</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                <input type="checkbox" ${value ? 'checked' : ''} onchange="togglePrivacy('${key}')" style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${value ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${value ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                </span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Get security content
function getSecurityContent() {
    return `
        <div class="security-settings">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- Security Settings -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Security Settings</h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Two-Factor Authentication</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Add an extra layer of security</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                <input type="checkbox" ${settingsData.userSettings.security.twoFactorAuth ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settingsData.userSettings.security.twoFactorAuth ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${settingsData.userSettings.security.twoFactorAuth ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                </span>
                            </label>
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Session Timeout (minutes)</label>
                            <input type="number" value="${settingsData.userSettings.security.sessionTimeout}" min="10" max="480" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Password Expiry (days)</label>
                            <input type="number" value="${settingsData.userSettings.security.passwordExpiry}" min="30" max="365" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Max Login Attempts</label>
                            <input type="number" value="${settingsData.userSettings.security.loginAttempts}" min="3" max="10" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Require Strong Password</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Enforce strong password requirements</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                <input type="checkbox" ${settingsData.userSettings.security.requireStrongPassword ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settingsData.userSettings.security.requireStrongPassword ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${settingsData.userSettings.security.requireStrongPassword ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- Password Change -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Password Change</h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Current Password</label>
                            <input type="password" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">New Password</label>
                            <input type="password" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Confirm New Password</label>
                            <input type="password" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">
                            Last password change: ${formatDate(settingsData.userSettings.security.lastPasswordChange)}
                        </div>
                        <button class="btn btn-primary" onclick="changePassword()">
                            <i class="fas fa-key"></i> Change Password
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Get system content
function getSystemContent() {
    return `
        <div class="system-settings">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- General Settings -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">General Settings</h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">System Name</label>
                            <input type="text" value="${settingsData.systemSettings.general.systemName}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Version</label>
                            <input type="text" value="${settingsData.systemSettings.general.version}" readonly style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-secondary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Environment</label>
                            <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="production" selected>Production</option>
                                <option value="staging">Staging</option>
                                <option value="development">Development</option>
                            </select>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Maintenance Mode</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Temporarily disable dashboard</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                <input type="checkbox" ${settingsData.systemSettings.general.maintenanceMode ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settingsData.systemSettings.general.maintenanceMode ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${settingsData.systemSettings.general.maintenanceMode ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                </span>
                            </label>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Debug Mode</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Enable debug logging</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                <input type="checkbox" ${settingsData.systemSettings.general.debugMode ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settingsData.systemSettings.general.debugMode ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${settingsData.systemSettings.general.debugMode ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- Performance Settings -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Performance Settings</h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Max Concurrent Users</label>
                            <input type="number" value="${settingsData.systemSettings.performance.maxConcurrentUsers}" min="10" max="1000" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Session Timeout (minutes)</label>
                            <input type="number" value="${settingsData.systemSettings.performance.sessionTimeout}" min="10" max="480" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Cache Timeout (seconds)</label>
                            <input type="number" value="${settingsData.systemSettings.performance.cacheTimeout}" min="60" max="3600" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Compression Enabled</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Enable response compression</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                <input type="checkbox" ${settingsData.systemSettings.performance.compressionEnabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settingsData.systemSettings.performance.compressionEnabled ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${settingsData.systemSettings.performance.compressionEnabled ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- System Limits -->
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-top: 2rem;">
                <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">System Limits</h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    ${Object.entries(settingsData.systemSettings.limits).map(([key, value]) => `
                        <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">${value}</div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">${formatLimitLabel(key)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Get integrations content
function getIntegrationsContent() {
    return `
        <div class="integrations-settings">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- Slack Integration -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">
                        <i class="fab fa-slack" style="color: var(--primary-color);"></i> Slack Integration
                    </h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Enable Slack</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Send notifications to Slack</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                <input type="checkbox" ${settingsData.systemSettings.integrations.slack.enabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settingsData.systemSettings.integrations.slack.enabled ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${settingsData.systemSettings.integrations.slack.enabled ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                </span>
                            </label>
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Webhook URL</label>
                            <input type="text" value="${settingsData.systemSettings.integrations.slack.webhookUrl}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Channel</label>
                            <input type="text" value="${settingsData.systemSettings.integrations.slack.channel}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Notification Types</label>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${settingsData.systemSettings.integrations.slack.notifications.map(type => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${type}</span>
                                `).join('')}
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="testSlackIntegration()">
                            <i class="fas fa-paper-plane"></i> Test Connection
                        </button>
                    </div>
                </div>
                
                <!-- Email Integration -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">
                        <i class="fas fa-envelope" style="color: var(--primary-color);"></i> Email Integration
                    </h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Enable Email</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Send email notifications</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                <input type="checkbox" ${settingsData.systemSettings.integrations.email.enabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settingsData.systemSettings.integrations.email.enabled ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${settingsData.systemSettings.integrations.email.enabled ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                                </span>
                            </label>
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">SMTP Server</label>
                            <input type="text" value="${settingsData.systemSettings.integrations.email.smtpServer}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Port</label>
                            <input type="number" value="${settingsData.systemSettings.integrations.email.port}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">Encryption</label>
                            <select style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="tls" selected>TLS</option>
                                <option value="ssl">SSL</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; display: block; margin-bottom: 0.5rem;">From Address</label>
                            <input type="email" value="${settingsData.systemSettings.integrations.email.fromAddress}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <button class="btn btn-primary" onclick="testEmailIntegration()">
                            <i class="fas fa-paper-plane"></i> Test Connection
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- API Integration -->
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-top: 2rem;">
                <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">
                    <i class="fas fa-plug" style="color: var(--primary-color);"></i> API Integration
                </h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                        <div>
                            <div style="color: var(--text-primary); font-weight: 500;">API Enabled</div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">REST API access</div>
                        </div>
                        <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                            <input type="checkbox" ${settingsData.systemSettings.integrations.api.enabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                            <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${settingsData.systemSettings.integrations.api.enabled ? 'var(--primary-color)' : 'var(--border-color)'}; transition: .4s; border-radius: 24px;">
                                <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${settingsData.systemSettings.integrations.api.enabled ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
                            </span>
                        </label>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                        <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">${settingsData.systemSettings.integrations.api.rateLimit}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Rate Limit (req/min)</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                        <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">${settingsData.systemSettings.integrations.api.version}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">API Version</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Get audit content
function getAuditContent() {
    return `
        <div class="audit-log">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Audit Log</h3>
                <div>
                    <select onchange="filterAuditLog(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Categories</option>
                        <option value="configuration">Configuration</option>
                        <option value="security">Security</option>
                        <option value="integrations">Integrations</option>
                        <option value="users">Users</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" onclick="exportAuditLog()">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            </div>
            
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                <div style="display: grid; gap: 1rem;">
                    ${settingsData.auditLog.map(log => `
                        <div class="audit-entry" style="display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--border-color); align-items: center;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="audit-category-badge category-${log.category}">${log.category}</span>
                                <span style="color: var(--text-secondary); font-size: 0.9rem;">${formatTimestamp(log.timestamp)}</span>
                            </div>
                            <div>
                                <p style="color: var(--text-primary); margin: 0; font-weight: 500;">${log.action}</p>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${log.details}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: var(--text-primary); font-weight: 500;">${log.user}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">${log.ipAddress}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function formatNotificationLabel(key) {
    const labels = {
        email: 'Email Notifications',
        push: 'Push Notifications',
        desktop: 'Desktop Notifications',
        reports: 'Report Notifications',
        alerts: 'System Alerts',
        updates: 'Product Updates'
    };
    return labels[key] || key;
}

function formatNotificationDescription(key) {
    const descriptions = {
        email: 'Receive notifications via email',
        push: 'Receive push notifications',
        desktop: 'Show desktop notifications',
        reports: 'Get notified about report generation',
        alerts: 'Receive system alerts and warnings',
        updates: 'Get notified about product updates'
    };
    return descriptions[key] || '';
}

function formatPrivacyLabel(key) {
    const labels = {
        analytics: 'Analytics Tracking',
        crashReports: 'Crash Reports',
        usageData: 'Usage Data Collection',
        personalizedContent: 'Personalized Content'
    };
    return labels[key] || key;
}

function formatPrivacyDescription(key) {
    const descriptions = {
        analytics: 'Help improve our services with anonymous usage data',
        crashReports: 'Automatically send crash reports to help fix issues',
        usageData: 'Collect usage data to improve the dashboard',
        personalizedContent: 'Show personalized content based on your usage'
    };
    return descriptions[key] || '';
}

function formatLimitLabel(key) {
    const labels = {
        maxFileSize: 'Max File Size (MB)',
        maxStorage: 'Max Storage (GB)',
        maxReports: 'Max Reports',
        maxConcurrentExports: 'Concurrent Exports',
        sessionDuration: 'Session Duration (min)'
    };
    return labels[key] || key;
}

// Tab switching
function showSettingsTab(tabName) {
    const content = document.getElementById('settings-tab-content');
    if (!content) return;
    
    // Update tab buttons
    document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });
    
    event.target.classList.add('active');
    event.target.style.color = 'var(--primary-color)';
    event.target.style.borderBottom = '2px solid var(--primary-color)';
    
    // Update content
    switch(tabName) {
        case 'profile':
            content.textContent = getProfileContent();
            break;
        case 'preferences':
            content.textContent = getPreferencesContent();
            break;
        case 'security':
            content.textContent = getSecurityContent();
            break;
        case 'system':
            content.textContent = getSystemContent();
            break;
        case 'integrations':
            content.textContent = getIntegrationsContent();
            break;
        case 'audit':
            content.textContent = getAuditContent();
            break;
    }
}

// Action functions
function saveAllSettings() {
  console.log('Saving all settings...');
  
  // Collect all current settings from the page
  const settings = {
    general: {
      theme: document.querySelector('input[name="theme"]')?.value || 'light',
      language: document.querySelector('select[name="language"]')?.value || 'en',
      timezone: document.querySelector('select[name="timezone"]')?.value || 'UTC',
      dateFormat: document.querySelector('select[name="dateFormat"]')?.value || 'MM/DD/YYYY'
    },
    notifications: {
      email: document.querySelector('input[name="email-notifications"]')?.checked || false,
      push: document.querySelector('input[name="push-notifications"]')?.checked || false,
      desktop: document.querySelector('input[name="desktop-notifications"]')?.checked || false,
      sound: document.querySelector('input[name="sound-notifications"]')?.checked || false
    },
    privacy: {
      dataCollection: document.querySelector('input[name="data-collection"]')?.checked || false,
      analytics: document.querySelector('input[name="analytics"]')?.checked || false,
      marketing: document.querySelector('input[name="marketing"]')?.checked || false,
      cookies: document.querySelector('input[name="cookies"]')?.checked || false
    },
    security: {
      twoFactorAuth: document.querySelector('input[name="2fa"]')?.checked || false,
      sessionTimeout: document.querySelector('input[name="session-timeout"]')?.value || '30',
      passwordExpiry: document.querySelector('input[name="password-expiry"]')?.value || '90'
    },
    integrations: {
      slack: document.querySelector('input[name="slack-enabled"]')?.checked || false,
      email: document.querySelector('input[name="email-enabled"]')?.checked || false,
      api: document.querySelector('input[name="api-enabled"]')?.checked || false
    }
  };
  
  // Save to localStorage
  try {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    console.log('✅ Settings saved to localStorage');
    
    if (window.showNotification) {
      window.showNotification('All settings saved successfully!', 'success');
    } else {
      alert('All settings saved successfully!');
    }
  } catch (error) {
    console.error('❌ Failed to save settings:', error);
    if (window.showNotification) {
      window.showNotification('Failed to save settings', 'error');
    } else {
      alert('Failed to save settings');
    }
  }
}

function resetSettings() {
  console.log('Resetting settings...');
  
  // Create confirmation modal
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
        <h3 style="color: var(--text-primary); margin: 0;">⚠️ Reset Settings?</h3>
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
          ✕
        </button>
      </div>
      
      <p style="color: var(--text-secondary); margin-bottom: 2rem;">This will reset all settings to their default values. This action cannot be undone.</p>
      
      <div style="background: var(--bg-primary); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Settings that will be reset:</h4>
        <div style="display: grid; gap: 0.5rem;">
          <div style="color: var(--text-secondary);">• Theme and language preferences</div>
          <div style="color: var(--text-secondary);">• Notification settings</div>
          <div style="color: var(--text-secondary);">• Privacy and security options</div>
          <div style="color: var(--text-secondary);">• Integration configurations</div>
        </div>
      </div>
      
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
        <input type="checkbox" id="confirmReset" style="cursor: pointer;">
        <label for="confirmReset" style="color: var(--text-primary); cursor: pointer;">I understand this action cannot be undone</label>
      </div>
      
      <div style="display: flex; gap: 1rem; justify-content: flex-end;">
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
          Cancel
        </button>
        <button onclick="confirmResetSettings()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--danger-color); color: white; cursor: pointer;">
          Reset Settings
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
}

function confirmResetSettings() {
  const checkbox = document.getElementById('confirmReset');
  if (!checkbox || !checkbox.checked) {
    if (window.showNotification) {
      window.showNotification('Please confirm you understand this action cannot be undone', 'warning');
    } else {
      alert('Please confirm you understand this action cannot be undone');
    }
    return;
  }
  
  // Reset settings to defaults
  const defaultSettings = {
    general: {
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY'
    },
    notifications: {
      email: true,
      push: true,
      desktop: true,
      sound: false
    },
    privacy: {
      dataCollection: false,
      analytics: false,
      marketing: false,
      cookies: true
    },
    security: {
      twoFactorAuth: false,
      sessionTimeout: '30',
      passwordExpiry: '90'
    },
    integrations: {
      slack: false,
      email: false,
      api: false
    }
  };
  
  // Save defaults to localStorage
  try {
    localStorage.setItem('appSettings', JSON.stringify(defaultSettings));
    console.log('✅ Settings reset to defaults');
    
    if (window.showNotification) {
      window.showNotification('Settings have been reset to default values!', 'success');
    } else {
      alert('Settings have been reset to default values!');
    }
    
    // Reload page to apply changes
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    console.error('❌ Failed to reset settings:', error);
    if (window.showNotification) {
      window.showNotification('Failed to reset settings', 'error');
    } else {
      alert('Failed to reset settings');
    }
  }
  
  // Close modal
  const modal = document.querySelector('[style*="position: fixed"]');
  if (modal) modal.remove();
}

function exportSettings() {
  console.log('Exporting settings...');
  
  // Get current settings from localStorage
  let settings;
  try {
    const saved = localStorage.getItem('appSettings');
    settings = saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Failed to load settings:', error);
    settings = {};
  }
  
  // Create comprehensive export data
  const exportData = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    settings: settings,
    metadata: {
      exportedBy: 'AI Dashboard Settings Module',
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      exportDate: new Date().toISOString()
    }
  };
  
  // Create and download JSON file
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `settings-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  // Show success message
  if (window.showNotification) {
    window.showNotification('Settings exported successfully!', 'success');
  } else {
    alert('Settings exported successfully!');
  }
}

function changeAvatar() {
    console.log('Changing avatar...');
    alert('Avatar upload dialog would be shown here');
}

function toggleNotification(key) {
    console.log('Toggling notification:', key);
    alert(`Notification setting for ${key} would be updated`);
}

function togglePrivacy(key) {
    console.log('Toggling privacy:', key);
    alert(`Privacy setting for ${key} would be updated`);
}

function changePassword() {
    console.log('Changing password...');
    alert('Password change process would be initiated here');
}

function testSlackIntegration() {
    console.log('Testing Slack integration...');
    alert('Test message would be sent to Slack to verify connection');
}

function testEmailIntegration() {
    console.log('Testing email integration...');
    alert('Test email would be sent to verify SMTP configuration');
}

function filterAuditLog(filter) {
    console.log('Filtering audit log:', filter);
    alert(`Audit log would be filtered to show only ${filter} categories`);
}

function exportAuditLog() {
    console.log('Exporting audit log...');
    alert('Audit log would be exported as CSV/JSON file');
}

// Add styles for settings
const settingsStyle = document.createElement('style');
settingsStyle.textContent = `
.audit-category-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.category-configuration {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.category-security {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.category-integrations {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.category-users {
    background: rgba(168, 85, 247, 0.1);
    color: var(--purple-color);
}

.category-system {
    background: rgba(107, 114, 128, 0.1);
    color: var(--text-secondary);
}

.toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .4s;
    border-radius: 24px;
}

.toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
}

input:checked + .toggle-slider {
    background-color: var(--primary-color);
}

input:checked + .toggle-slider:before {
    transform: translateX(26px);
}

.avatar-preview:hover {
    cursor: pointer;
    opacity: 0.8;
}

.audit-entry:hover {
    background: var(--bg-primary);
}
`;
document.head.appendChild(settingsStyle);

console.log('✅ Settings module loaded');
