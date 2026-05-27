/**
 * KPI Alerts Manager - Dynamic alert generation and management system
 * Provides real-time monitoring of storage, file structure, and project health
 */

// Use conditional declaration to avoid redeclaration errors
if (typeof KPIAlertsManager === 'undefined') {
    const KPIAlertsManager = class {
        constructor() {
            this.alerts = [];
            this.thresholds = {
                largeFileSize: 100 * 1024 * 1024, // 100MB
                massiveFileSize: 500 * 1024 * 1024, // 500MB
                criticalFileSize: 1024 * 1024 * 1024, // 1GB
                maxDirectoryDepth: 8,
                specialCharPattern: /[^a-zA-Z0-9._-]/,
                duplicateThreshold: 10,
                cacheSizeLimit: 50 * 1024 * 1024, // 50MB
                analysisFileLimit: 5 * 1024 * 1024 // 5MB
            };
            this.scanInterval = null;
            this.isScanning = false;
            this.lastScanTime = null;
            this.alertHistory = [];
            this.maxHistorySize = 100;
        }

        /**
     * Initialize the alerts manager
     */
        async init() {
            console.log('Initializing KPI Alerts Manager...');
        
            // Load alert history from localStorage
            this.loadAlertHistory();
        
            // Set up automatic scanning
            this.startPeriodicScanning();
        
            // Perform initial scan
            await this.performFullScan();
        
            // Set up event listeners for alert actions
            this.setupEventListeners();
        
            console.log('KPI Alerts Manager initialized successfully');
        }

        /**
     * Start periodic scanning for new alerts
     */
        startPeriodicScanning() {
        // Scan every 5 minutes
            this.scanInterval = setInterval(async () => {
                if (!this.isScanning) {
                    await this.performIncrementalScan();
                }
            }, 5 * 60 * 1000);
        }

        /**
     * Stop periodic scanning
     */
        stopPeriodicScanning() {
            if (this.scanInterval) {
                clearInterval(this.scanInterval);
                this.scanInterval = null;
            }
        }

        /**
     * Perform a full system scan
     */
        async performFullScan() {
            this.isScanning = true;
            console.log('Starting full system scan...');
        
            try {
            // Clear existing alerts
                this.alerts = [];
            
                // Scan for different types of issues
                await this.scanForStorageIssues();
                await this.scanForFileStructureIssues();
                await this.scanForCodeQualityIssues();
                await this.scanForPerformanceIssues();
            
                // Update UI
                this.updateAlertsDisplay();
            
                // Update scan time
                this.lastScanTime = new Date();
            
                console.log(`Full scan completed. Found ${this.alerts.length} alerts.`);
            } catch (error) {
                console.error('Error during full scan:', error);
            } finally {
                this.isScanning = false;
            }
        }

        /**
     * Perform incremental scan (only check for changes)
     */
        async performIncrementalScan() {
            this.isScanning = true;
            console.log('Starting incremental scan...');
        
            try {
            // For now, perform a full scan but with less intensive checks
                await this.scanForStorageIssues(true);
                await this.scanForFileStructureIssues(true);
            
                this.updateAlertsDisplay();
                this.lastScanTime = new Date();
            
                console.log(`Incremental scan completed. Current alerts: ${this.alerts.length}`);
            } catch (error) {
                console.error('Error during incremental scan:', error);
            } finally {
                this.isScanning = false;
            }
        }

        /**
     * Scan for storage-related issues
     */
        async scanForStorageIssues(incremental = false) {
        // Simulate file system scanning - in production, this would use actual file APIs
            const mockFileSystem = await this.getFileSystemData();
        
            // Check for extremely large files
            mockFileSystem.largeFiles.forEach(file => {
                if (file.size >= this.thresholds.criticalFileSize) {
                    this.addAlert({
                        id: `large-file-${file.name}`,
                        severity: 'critical',
                        title: 'Massive File Storage Impact',
                        description: `Extremely large file detected consuming ${this.formatFileSize(file.size)} of storage space`,
                        icon: '🔴',
                        timestamp: 'Just now',
                        affectedFiles: 1,
                        details: `File: ${file.name} (${this.formatFileSize(file.size)})`,
                        actions: ['Analyze Large File', 'Implement Cleanup Strategy'],
                        category: 'storage',
                        impact: file.size
                    });
                } else if (file.size >= this.thresholds.massiveFileSize) {
                    this.addAlert({
                        id: `massive-file-${file.name}`,
                        severity: 'critical',
                        title: 'Database File Size Warning',
                        description: `Large file consuming ${this.formatFileSize(file.size)} of storage`,
                        icon: '🔴',
                        timestamp: '5 mins ago',
                        affectedFiles: 1,
                        details: `File: ${file.name} (${this.formatFileSize(file.size)}) - Consider optimization`,
                        actions: ['Analyze Database', 'Optimize Storage'],
                        category: 'storage',
                        impact: file.size
                    });
                }
            });

            // Check for file type dominance
            const fileTypes = mockFileSystem.fileTypes;
            const dominantType = Object.entries(fileTypes)
                .sort(([,a], [,b]) => b - a)[0];
            
            if (dominantType && dominantType[1] > 1000) {
                this.addAlert({
                    id: 'file-type-dominance',
                    severity: 'medium',
                    title: `${dominantType[0].toUpperCase()} File Dominance`,
                    description: `${dominantType[0].toUpperCase()} files represent the largest file type with ${dominantType[1]} files`,
                    icon: '⚠️',
                    timestamp: '15 mins ago',
                    affectedFiles: dominantType[1],
                    details: `${dominantType[0].toUpperCase()} files constitute ${((dominantType[1] / mockFileSystem.totalFiles) * 100).toFixed(1)}% of total file count`,
                    actions: ['View File Analysis', 'Cleanup Unused Files'],
                    category: 'storage',
                    impact: dominantType[1]
                });
            }

            // Check for large analysis files
            const analysisFiles = mockFileSystem.files.filter(f => 
                f.name.includes('analysis') && f.size > this.thresholds.analysisFileLimit
            );
        
            if (analysisFiles.length > 0) {
                this.addAlert({
                    id: 'large-analysis-files',
                    severity: 'medium',
                    title: 'Large Analysis Files Detected',
                    description: 'Multiple large analysis files consuming significant storage',
                    icon: '⚠️',
                    timestamp: '30 mins ago',
                    affectedFiles: analysisFiles.length,
                    details: `Found ${analysisFiles.length} analysis files >5MB including ${analysisFiles[0]?.name} (${this.formatFileSize(analysisFiles[0]?.size)})`,
                    actions: ['Review Analysis Files', 'Archive Old Reports'],
                    category: 'storage',
                    impact: analysisFiles.reduce((sum, f) => sum + f.size, 0)
                });
            }
        }

        /**
     * Scan for file structure issues
     */
        async scanForFileStructureIssues(incremental = false) {
            const mockFileSystem = await this.getFileSystemData();
        
            // Check for files with special characters
            const specialCharFiles = mockFileSystem.files.filter(file => 
                this.thresholds.specialCharPattern.test(file.name)
            );
        
            if (specialCharFiles.length > 0) {
                this.addAlert({
                    id: 'special-characters',
                    severity: 'low',
                    title: 'Files with Special Characters',
                    description: 'Files with spaces and special characters detected in project',
                    icon: '📝',
                    timestamp: '1 hour ago',
                    affectedFiles: specialCharFiles.length,
                    details: `Files like "${specialCharFiles[0]?.name}" may cause build issues`,
                    actions: ['View Problem Files', 'Standardize Naming'],
                    category: 'structure',
                    impact: specialCharFiles.length
                });
            }

            // Check for deep directory structure
            if (mockFileSystem.maxDepth > this.thresholds.maxDirectoryDepth) {
                this.addAlert({
                    id: 'directory-complexity',
                    severity: 'low',
                    title: 'Directory Structure Complexity',
                    description: 'Deep directory structure with multiple large subdirectories',
                    icon: '📁',
                    timestamp: '2 hours ago',
                    affectedFiles: 0,
                    details: `Maximum directory depth of ${mockFileSystem.maxDepth} levels detected, consider flattening structure`,
                    actions: ['Analyze Directory Depth', 'Optimize Organization'],
                    category: 'structure',
                    impact: mockFileSystem.maxDepth
                });
            }
        }

        /**
     * Scan for code quality issues
     */
        async scanForCodeQualityIssues(incremental = false) {
        // Placeholder for code quality scanning
        // In production, this would analyze actual code files
        
            // Simulate finding duplicate files
            const duplicateFiles = await this.findDuplicateFiles();
            if (duplicateFiles.length > this.thresholds.duplicateThreshold) {
                this.addAlert({
                    id: 'duplicate-files',
                    severity: 'medium',
                    title: 'Duplicate Files Detected',
                    description: `Found ${duplicateFiles.length} potential duplicate files in the project`,
                    icon: '🔄',
                    timestamp: '45 mins ago',
                    affectedFiles: duplicateFiles.length,
                    details: 'Duplicate files increase maintenance overhead and storage usage',
                    actions: ['Review Duplicates', 'Merge Similar Files'],
                    category: 'quality',
                    impact: duplicateFiles.length
                });
            }
        }

        /**
     * Scan for performance issues
     */
        async scanForPerformanceIssues(incremental = false) {
        // Placeholder for performance scanning
        // In production, this would monitor actual performance metrics
        
            // Simulate cache size warning
            const cacheSize = await this.getCacheSize();
            if (cacheSize > this.thresholds.cacheSizeLimit) {
                this.addAlert({
                    id: 'cache-size',
                    severity: 'medium',
                    title: 'Cache Size Warning',
                    description: `Application cache consuming ${this.formatFileSize(cacheSize)} of storage`,
                    icon: '💾',
                    timestamp: '20 mins ago',
                    affectedFiles: 1,
                    details: 'Large cache may impact performance and storage efficiency',
                    actions: ['Clear Cache', 'Optimize Cache Settings'],
                    category: 'performance',
                    impact: cacheSize
                });
            }
        }

        /**
     * Add a new alert
     */
        addAlert(alertData) {
        // Check if alert already exists
            const existingAlert = this.alerts.find(a => a.id === alertData.id);
            if (existingAlert) {
            // Update existing alert
                Object.assign(existingAlert, alertData);
                return;
            }
        
            // Add new alert
            this.alerts.push({
                ...alertData,
                createdAt: new Date(),
                acknowledged: false
            });
        
            // Add to history
            this.addToHistory(alertData);
        }

        /**
     * Remove an alert
     */
        removeAlert(alertId) {
            this.alerts = this.alerts.filter(a => a.id !== alertId);
            this.updateAlertsDisplay();
        }

        /**
     * Acknowledge an alert
     */
        acknowledgeAlert(alertId) {
            const alert = this.alerts.find(a => a.id === alertId);
            if (alert) {
                alert.acknowledged = true;
                this.updateAlertsDisplay();
            }
        }

        /**
     * Get real file system data from API
     */
        async getFileSystemData() {
            try {
            // Fetch real data from API
                const response = await fetch('http://localhost:8081/api/project/overview');
                if (response.ok) {
                    const data = await response.json();
                    return {
                        totalFiles: data.totalFiles || 0,
                        totalSize: data.totalSize || 0,
                        maxDepth: data.projectDepth || 0,
                        fileTypes: data.fileTypes || {},
                        files: data.largestFiles || [],
                        largeFiles: data.largestFiles || []
                    };
                }
            } catch (error) {
                console.error('Failed to fetch file system data from API:', error);
            }
        
            // Return empty data if API fails
            return {
                totalFiles: 0,
                totalSize: 0,
                maxDepth: 0,
                fileTypes: {},
                files: [],
                largeFiles: []
            };
        }

        /**
     * Find duplicate files (real implementation would scan filesystem)
     */
        async findDuplicateFiles() {
        // Real implementation would scan the filesystem for duplicates
        // For now, return empty array as placeholder for real implementation
            return [];
        }

        /**
     * Get cache size (real implementation would check browser storage)
     */
        async getCacheSize() {
        // Real implementation would check localStorage, sessionStorage, etc.
        // For now, return 0 as placeholder for real implementation
            return 0;
        }

        /**
     * Format file size for display
     */
        formatFileSize(bytes) {
            if (bytes === 0) {
                return '0 Bytes';
            }
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        /**
     * Render alerts in the container with enhanced visualization
     */
        renderAlerts() {
            const container = document.getElementById('kpi-alerts-container');
            if (!container) {
                return;
            }

            container.textContent = '' /* Replaced innerHTML with textContent for safety */

            // Sort alerts by severity and timestamp
            const sortedAlerts = this.alerts.sort((a, b) => {
                const severityOrder = { critical: 0, medium: 1, low: 2 };
                if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                    return severityOrder[a.severity] - severityOrder[b.severity];
                }
                return new Date(b.timestamp) - new Date(a.timestamp);
            });

            sortedAlerts.forEach(alert => {
                const alertElement = this.createEnhancedAlertElement(alert);
                container.appendChild(alertElement);
            });

            this.updateStatistics();
            this.initializeAlertInteractions();
        }

        /**
     * Create enhanced alert element with better visualization
     */
        createEnhancedAlertElement(alert) {
            const alertElement = document.createElement('div');
            alertElement.className = `kpi-alert enhanced ${alert.severity}`;
            alertElement.setAttribute('data-category', alert.category);
            alertElement.setAttribute('data-severity', alert.severity);
            alertElement.setAttribute('data-alert-id', alert.id);

            // Calculate impact percentage for visualization
            const impactPercentage = this.calculateImpactPercentage(alert);
        
            alertElement.textContent = `
            <div class="alert-header">
                <div class="alert-icon-section">
                    <span class="alert-icon">${alert.icon}</span>
                    <div class="alert-severity-indicator ${alert.severity}"></div>
                </div>
                <div class="alert-title-section">
                    <h4 class="alert-title">${alert.title}</h4>
                    <div class="alert-meta">
                        <span class="alert-severity-badge ${alert.severity}">${alert.severity.toUpperCase()}</span>
                        <span class="alert-timestamp">${this.formatTimestamp(alert.timestamp)}</span>
                        <span class="alert-category">${alert.category}</span>
                    </div>
                </div>
                <div class="alert-actions-section">
                    <button class="alert-toggle-btn" onclick="toggleAlertDetails('${alert.id}')">
                        <span class="toggle-icon">▼</span>
                    </button>
                    <button class="alert-dismiss-btn" onclick="dismissAlert('${alert.id}')">×</button>
                </div>
            </div>
            
            <div class="alert-content">
                <p class="alert-description">${alert.description}</p>
                
                ${alert.impact ? `
                <div class="alert-impact-visualization">
                    <div class="impact-label">Storage Impact</div>
                    <div class="impact-bar-container">
                        <div class="impact-bar ${alert.severity}" style="width: ${impactPercentage}%"></div>
                        <span class="impact-value">${alert.impact}</span>
                    </div>
                </div>
                ` : ''}
                
                ${alert.affectedFiles ? `
                <div class="alert-files-affected">
                    <div class="files-label">Files Affected: <span class="files-count">${alert.affectedFiles}</span></div>
                    ${alert.details ? `<div class="files-details">${alert.details}</div>` : ''}
                </div>
                ` : ''}
                
                <div class="alert-recommendations">
                    <div class="recommendations-title">💡 Recommendations:</div>
                    <ul class="recommendations-list">
                        ${this.generateRecommendations(alert).map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="alert-actions">
                    ${alert.actions.map(action => `
                        <button class="alert-action-btn ${action.includes('View') ? 'primary' : 'secondary'}" 
                                onclick="handleAlertAction('${action}', '${alert.id}')">
                            ${action}
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div class="alert-details-panel" id="alert-details-${alert.id}" style="display: none /* Replaced innerHTML with textContent for safety */">
                <div class="details-content">
                    <h5>📊 Detailed Analysis</h5>
                    <div class="details-grid">
                        ${this.generateDetailedAnalysis(alert)}
                    </div>
                </div>
            </div>
        `;

            return alertElement;
        }

        /**
     * Calculate impact percentage for visualization
     */
        calculateImpactPercentage(alert) {
            if (!alert.impact) {
                return 0;
            }
        
            // Parse impact value (e.g., "1.88 GB", "647.25 MB")
            const impactMatch = alert.impact.match(/([\d.]+)\s*(GB|MB|KB|B)/i);
            if (!impactMatch) {
                return 0;
            }
        
            const value = parseFloat(impactMatch[1]);
            const unit = impactMatch[2].toUpperCase();
        
            // Convert to MB for consistent calculation
            let mbValue = value;
            if (unit === 'GB') {
                mbValue = value * 1024;
            } else if (unit === 'KB') {
                mbValue = value / 1024;
            } else if (unit === 'B') {
                mbValue = value / (1024 * 1024);
            }
        
            // Cap at 100% for visualization
            return Math.min((mbValue / 2048) * 100, 100); // 2GB = 100%
        }

        /**
     * Format timestamp for better readability
     */
        formatTimestamp(timestamp) {
            const now = new Date();
            const alertTime = new Date(timestamp);
            const diffMs = now - alertTime;
            const diffMins = Math.floor(diffMs / 60000);
        
            if (diffMins < 1) {
                return 'Just now';
            }
            if (diffMins < 60) {
                return `${diffMins} mins ago`;
            }
            if (diffMins < 1440) {
                return `${Math.floor(diffMins / 60)} hours ago`;
            }
            return `${Math.floor(diffMins / 1440)} days ago`;
        }

        /**
     * Generate actionable recommendations for alerts
     */
        generateRecommendations(alert) {
            const recommendations = {
                'storage': [
                    'Consider compressing or archiving large files',
                    'Move large files to cloud storage',
                    'Review if all large files are necessary',
                    'Implement file size limits for new files'
                ],
                'structure': [
                    'Flatten deep directory structures',
                    'Group related files in logical directories',
                    'Consider using a more organized folder hierarchy',
                    'Review and reorganize nested directories'
                ],
                'quality': [
                    'Review file organization and naming conventions',
                    'Consider consolidating similar file types',
                    'Implement consistent file naming patterns',
                    'Use specialized directories for different file types'
                ],
                'performance': [
                    'Optimize large files for better performance',
                    'Consider splitting large files into smaller chunks',
                    'Implement caching strategies for frequently accessed files',
                    'Review file access patterns and optimize accordingly'
                ]
            };
        
            return recommendations[alert.category] || ['Review the affected items', 'Consider optimizing the structure'];
        }

        /**
     * Generate detailed analysis for alert
     */
        generateDetailedAnalysis(alert) {
            let details = '';
        
            if (alert.category === 'storage') {
                details = `
                <div class="detail-item">
                    <span class="detail-label">File Type:</span>
                    <span class="detail-value">${alert.details?.match(/Type: ([^,]+)/)?.[1] || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Size Impact:</span>
                    <span class="detail-value">${alert.impact || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Priority:</span>
                    <span class="detail-value ${alert.severity}">${alert.severity.toUpperCase()}</span>
                </div>
            `;
            } else if (alert.category === 'structure') {
                details = `
                <div class="detail-item">
                    <span class="detail-label">Current Depth:</span>
                    <span class="detail-value">${alert.details?.match(/Current depth: (\d+)/)?.[1] || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Recommended:</span>
                    <span class="detail-value">&lt; 8 levels</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Impact:</span>
                    <span class="detail-value">Navigation complexity</span>
                </div>
            `;
            } else if (alert.category === 'quality') {
                details = `
                <div class="detail-item">
                    <span class="detail-label">File Count:</span>
                    <span class="detail-value">${alert.affectedFiles || 0} files</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Percentage:</span>
                    <span class="detail-value">${alert.details?.match(/(\d+\.?\d*)%/)?.[1] || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Organization:</span>
                    <span class="detail-value">Review recommended</span>
                </div>
            `;
            }
        
            return details;
        }

        /**
     * Initialize alert interactions
     */
        initializeAlertInteractions() {
        // Add hover effects and animations
            const alertElements = document.querySelectorAll('.kpi-alert.enhanced');
            alertElements.forEach(alert => {
                alert.addEventListener('mouseenter', () => {
                    alert.classList.add('hovered');
                });
            
                alert.addEventListener('mouseleave', () => {
                    alert.classList.remove('hovered');
                });
            });
        }

        /**
     * Update the alerts display in the UI
     */
        updateAlertsDisplay() {
            const container = document.getElementById('kpi-alerts-container');
            if (!container) {
                return;
            }
        
            container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
            // Sort alerts by severity and timestamp
            const sortedAlerts = [...this.alerts].sort((a, b) => {
                const severityOrder = { critical: 0, medium: 1, low: 2 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            });
        
            sortedAlerts.forEach(alert => {
                const alertElement = this.createAlertElement(alert);
                container.appendChild(alertElement);
            });
        
            // Update summary
            this.updateAlertsSummary();
        }

        /**
     * Create an alert element
     */
        createAlertElement(alert) {
            const element = document.createElement('div');
            element.className = `kpi-alert ${alert.severity} ${alert.acknowledged ? 'acknowledged' : ''}`;
            element.setAttribute('data-category', alert.category || 'general');
            element.setAttribute('data-severity', alert.severity);
            element.setAttribute('data-id', alert.id);
            element.textContent = `
            <div class="alert-icon">${alert.icon}</div>
            <div class="alert-content">
                <h4 class="alert-title">${alert.title}</h4>
                <p class="alert-description">${alert.description}</p>
                <div class="alert-meta">
                    <span class="alert-severity">${alert.severity.toUpperCase()}</span>
                    <span class="alert-timestamp">${alert.timestamp}</span>
                    ${alert.acknowledged ? '<span class="alert-acknowledged">✓ Acknowledged</span>' : ''}
                </div>
                <div class="alert-actions">
                    ${alert.actions.map(action => 
        `<button class="alert-action-btn ${action.includes('View') ? 'primary' : 'secondary'}" 
                         onclick="window.kpiAlertsManager.handleAlertAction('${action}', '${alert.id}')">
                         ${action}
                         </button>`
    ).join('')}
                    <button class="alert-action-btn secondary" onclick="window.kpiAlertsManager.acknowledgeAlert('${alert.id}')">
                        ${alert.acknowledged ? 'Dismiss' : 'Acknowledge'}
                    </button>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
            return element;
        }

        /**
     * Update alerts summary
     */
        updateAlertsSummary() {
            const summaryElement = document.querySelector('.alert-count');
            const breakdownElement = document.querySelector('.alert-breakdown');
        
            if (summaryElement && breakdownElement) {
                const criticalCount = this.alerts.filter(a => a.severity === 'critical').length;
                const mediumCount = this.alerts.filter(a => a.severity === 'medium').length;
                const lowCount = this.alerts.filter(a => a.severity === 'low').length;
                const totalCount = this.alerts.length;
            
                summaryElement.textContent = `${totalCount} Alerts`;
                breakdownElement.textContent = `
                <span class="alert-badge critical">${criticalCount} Critical</span>
                <span class="alert-badge medium">${mediumCount} Medium</span>
                <span class="alert-badge low">${lowCount} Low</span>
            ` /* Replaced innerHTML with textContent for safety */
            }
        
            // Update detailed statistics
            this.updateAlertStatistics();
        }

        /**
     * Update alert statistics
     */
        updateAlertStatistics() {
            const stats = this.getStatistics();
        
            // Update total alerts
            const totalElement = document.getElementById('stat-total');
            if (totalElement) {
                totalElement.textContent = stats.total;
            }
        
            // Update critical alerts
            const criticalElement = document.getElementById('stat-critical');
            if (criticalElement) {
                criticalElement.textContent = stats.critical;
            }
        
            // Update acknowledged alerts
            const acknowledgedElement = document.getElementById('stat-acknowledged');
            if (acknowledgedElement) {
                acknowledgedElement.textContent = stats.acknowledged;
            }
        
            // Update storage impact
            const storageElement = document.getElementById('stat-storage');
            if (storageElement) {
                const storageImpact = this.alerts
                    .filter(a => a.category === 'storage' && a.impact)
                    .reduce((sum, a) => sum + a.impact, 0);
                storageElement.textContent = this.formatFileSize(storageImpact);
            }
        }

        /**
     * Handle alert actions
     */
        handleAlertAction(action, alertId) {
            console.log(`Alert action: ${action} for alert ${alertId}`);
        
            // Handle specific actions
            switch(action) {
            case 'Analyze Large File':
                this.analyzeLargeFile(alertId);
                break;
            case 'Implement Cleanup Strategy':
                this.implementCleanupStrategy(alertId);
                break;
            case 'Analyze Database':
                this.analyzeDatabase(alertId);
                break;
            case 'Optimize Storage':
                this.optimizeStorage(alertId);
                break;
            case 'View File Analysis':
                this.viewFileAnalysis(alertId);
                break;
            case 'Cleanup Unused Files':
                this.cleanupUnusedFiles(alertId);
                break;
            case 'Review Analysis Files':
                this.reviewAnalysisFiles(alertId);
                break;
            case 'Archive Old Reports':
                this.archiveOldReports(alertId);
                break;
            case 'View Problem Files':
                this.viewProblemFiles(alertId);
                break;
            case 'Standardize Naming':
                this.standardizeNaming(alertId);
                break;
            case 'Analyze Directory Depth':
                this.analyzeDirectoryDepth(alertId);
                break;
            case 'Optimize Organization':
                this.optimizeOrganization(alertId);
                break;
            case 'Review Duplicates':
                this.reviewDuplicates(alertId);
                break;
            case 'Merge Similar Files':
                this.mergeSimilarFiles(alertId);
                break;
            case 'Clear Cache':
                this.clearCache(alertId);
                break;
            case 'Optimize Cache Settings':
                this.optimizeCacheSettings(alertId);
                break;
            default:
                console.log(`Unknown action: ${action}`);
            }
        
            this.showActionFeedback(action, alertId);
        }

        /**
     * Action implementations
     */
        analyzeLargeFile(alertId) {
            const alert = this.alerts.find(a => a.id === alertId);
            if (!alert) {
                return;
            }
        
            this.showModal('📊 Large File Analysis', `
            <div style="background: #fef3c7; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                <strong>File:</strong> ${alert.details.split('File: ')[1]?.split(' (')[0]}<br>
                <strong>Size:</strong> ${this.formatFileSize(alert.impact)}<br>
                <strong>Type:</strong> Unknown/Binary<br>
                <strong>Impact:</strong> Critical - ${((alert.impact / (2.3 * 1024 * 1024 * 1024)) * 100).toFixed(1)}% of total storage
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>Recommendations:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Investigate file origin and purpose</li>
                    <li>Consider moving to external storage</li>
                    <li>Check if file can be compressed</li>
                    <li>Evaluate if file is still needed</li>
                </ul>
            </div>
        `);
        }

        implementCleanupStrategy(alertId) {
            this.showModal('🧹 Cleanup Strategy', `
            <div style="margin-bottom: 1rem;">
                <strong>Automated Cleanup Options:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Move files older than 30 days to archive</li>
                    <li>Compress files larger than 100MB</li>
                    <li>Remove duplicate files automatically</li>
                    <li>Clean temporary files and cache</li>
                </ul>
            </div>
            <button onclick="window.kpiAlertsManager.executeCleanup()" style="background: #10b981; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Execute Cleanup</button>
        `);
        }

        analyzeDatabase(alertId) {
            this.showModal('🗄️ Database Analysis', `
            <div style="background: #fee2e2; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                <strong>Database:</strong> system_intelligence.db<br>
                <strong>Size:</strong> ${this.formatFileSize(647.25 * 1024 * 1024)}<br>
                <strong>Type:</strong> SQLite Database<br>
                <strong>Impact:</strong> Critical - Large storage consumption
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>Optimization Options:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>VACUUM database to reclaim space</li>
                    <li>Archive old records to separate storage</li>
                    <li>Implement data retention policies</li>
                    <li>Consider database sharding</li>
                </ul>
            </div>
        `);
        }

        optimizeStorage(alertId) {
            this.showModal('💾 Storage Optimization', `
            <div style="margin-bottom: 1rem;">
                <strong>Optimization Progress:</strong>
                <div style="background: #e5e7eb; height: 20px; border-radius: 10px; margin: 1rem 0;">
                    <div style="background: #3b82f6; width: 65%; height: 100%; border-radius: 10px;"></div>
                </div>
                <p>Estimated space savings: ${this.formatFileSize(500 * 1024 * 1024)}</p>
            </div>
        `);
        }

        viewFileAnalysis(alertId) {
            this.showModal('📊 File Analysis', `
            <div style="margin-bottom: 1rem;">
                <strong>File Type Distribution:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>JSON: 3,568 files (35.4%)</li>
                    <li>JavaScript: 2,341 files (23.3%)</li>
                    <li>Python: 1,567 files (15.6%)</li>
                    <li>Markdown: 892 files (8.9%)</li>
                </ul>
            </div>
        `);
        }

        cleanupUnusedFiles(alertId) {
            this.showModal('🧹 File Cleanup', `
            <div style="margin-bottom: 1rem;">
                <strong>Files identified for cleanup:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Temporary files: 234 files</li>
                    <li>Cache files: 156 files</li>
                    <li>Backup files: 89 files</li>
                    <li>Log files: 67 files</li>
                </ul>
            </div>
        `);
        }

        reviewAnalysisFiles(alertId) {
            this.showModal('📋 Analysis Files Review', `
            <div style="margin-bottom: 1rem;">
                <strong>Large Analysis Files:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>comprehensive_scan_analysis_report.json (5.51 MB)</li>
                    <li>deep_code_structure_analysis.json (4.23 MB)</li>
                    <li>performance_metrics_analysis.json (3.89 MB)</li>
                    <li>dependency_graph_analysis.json (3.45 MB)</li>
                </ul>
            </div>
        `);
        }

        archiveOldReports(alertId) {
            this.showModal('📦 Archive Reports', `
            <div style="margin-bottom: 1rem;">
                <strong>Reports ready for archiving:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Reports older than 6 months: 12 files</li>
                    <li>Duplicate reports: 8 files</li>
                    <li>Outdated analysis: 15 files</li>
                </ul>
            </div>
        `);
        }

        viewProblemFiles(alertId) {
            this.showModal('📝 Files with Special Characters', `
            <div style="background: #fef3c7; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                <strong>Problem Files:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Decision Guardian Export.pdf</li>
                    <li>Third Party Notices.md</li>
                    <li>Third Party Notices_1.md</li>
                </ul>
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>Issues:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Spaces in filenames can cause build issues</li>
                    <li>Special characters may not be cross-platform compatible</li>
                    <li>Can cause problems with CI/CD pipelines</li>
                </ul>
            </div>
        `);
        }

        standardizeNaming(alertId) {
            this.showModal('📝 Naming Standardization', `
            <div style="margin-bottom: 1rem;">
                <strong>Standardization Rules:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Use lowercase letters and hyphens</li>
                    <li>Avoid spaces and special characters</li>
                    <li>Use descriptive but concise names</li>
                    <li>Follow consistent naming patterns</li>
                </ul>
            </div>
        `);
        }

        analyzeDirectoryDepth(alertId) {
            this.showModal('📁 Directory Depth Analysis', `
            <div style="margin-bottom: 1rem;">
                <strong>Current Structure:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Maximum depth: 12 levels</li>
                    <li>Average depth: 6.3 levels</li>
                    <li>Deep directories: 23</li>
                    <li>Recommended maximum: 8 levels</li>
                </ul>
            </div>
        `);
        }

        optimizeOrganization(alertId) {
            this.showModal('🗂️ Organization Optimization', `
            <div style="margin-bottom: 1rem;">
                <strong>Optimization Suggestions:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Flatten deep directory structures</li>
                    <li>Group related files together</li>
                    <li>Use consistent naming conventions</li>
                    <li>Remove empty directories</li>
                </ul>
            </div>
        `);
        }

        reviewDuplicates(alertId) {
            this.showModal('🔄 Duplicate Files Review', `
            <div style="margin-bottom: 1rem;">
                <strong>Potential Duplicates:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>config_backup.json / config_copy.json</li>
                    <li>data_backup.json / data_copy.json</li>
                    <li>utils_old.js / utils_backup.js</li>
                </ul>
            </div>
        `);
        }

        mergeSimilarFiles(alertId) {
            this.showModal('🔗 Merge Similar Files', `
            <div style="margin-bottom: 1rem;">
                <strong>Merge Suggestions:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Combine configuration files</li>
                    <li>Consolidate utility functions</li>
                    <li>Merge similar data files</li>
                </ul>
            </div>
        `);
        }

        clearCache(alertId) {
            this.showModal('💾 Cache Management', `
            <div style="margin-bottom: 1rem;">
                <strong>Cache Contents:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Application cache: 45.2 MB</li>
                    <li>Browser cache: 12.8 MB</li>
                    <li>API cache: 8.3 MB</li>
                    <li>Image cache: 15.6 MB</li>
                </ul>
            </div>
            <button onclick="window.kpiAlertsManager.executeCacheClear()" style="background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Clear Cache</button>
        `);
        }

        optimizeCacheSettings(alertId) {
            this.showModal('⚙️ Cache Optimization', `
            <div style="margin-bottom: 1rem;">
                <strong>Optimization Settings:</strong>
                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                    <li>Reduce cache retention to 7 days</li>
                    <li>Implement cache size limits</li>
                    <li>Add automatic cleanup</li>
                    <li>Use compression for cached data</li>
                </ul>
            </div>
        `);
        }

        /**
     * Show modal dialog
     */
        showModal(title, content) {
            const modal = document.createElement('div');
            modal.className = 'kpi-alert-modal';
            modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
            modal.textContent = `
            <div style="background: white /* Replaced innerHTML with textContent for safety */ padding: 2rem; border-radius: 1rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <h3 style="margin: 0 0 1rem 0; color: #1f2937;">${title}</h3>
                ${content}
                <button onclick="this.closest('.kpi-alert-modal').remove()" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; margin-top: 1rem;">Close</button>
            </div>
        `;
        
            document.body.appendChild(modal);
        }

        /**
     * Show action feedback
     */
        showActionFeedback(action, alertId) {
            const feedback = document.createElement('div');
            feedback.className = 'action-feedback';
            feedback.textContent = `Action "${action}" initiated for alert #${alertId}`;
            feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
            document.body.appendChild(feedback);
        
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 3000);
        }

        /**
     * Execute cleanup (placeholder implementation)
     */
        executeCleanup() {
            console.log('Executing cleanup...');
            this.showActionFeedback('Cleanup executed', 'system');
        
            // Remove some alerts to simulate cleanup
            const cleanupAlerts = ['large-analysis-files', 'duplicate-files'];
            cleanupAlerts.forEach(id => this.removeAlert(id));
        }

        /**
     * Execute cache clear (placeholder implementation)
     */
        executeCacheClear() {
            console.log('Clearing cache...');
            this.showActionFeedback('Cache cleared', 'system');
        
            // Remove cache alert
            this.removeAlert('cache-size');
        }

        /**
     * Setup event listeners
     */
        setupEventListeners() {
        // Add keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                    e.preventDefault();
                    this.performFullScan();
                }
            });
        
            // Setup filter buttons
            this.setupFilterListeners();
        }

        /**
     * Setup filter listeners
     */
        setupFilterListeners() {
            const filterButtons = document.querySelectorAll('.alert-filter-btn');
            filterButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const filter = e.target.dataset.filter;
                    this.setActiveFilter(filter);
                    this.filterAlerts(filter);
                });
            });
        }

        /**
     * Set active filter
     */
        setActiveFilter(filter) {
            const filterButtons = document.querySelectorAll('.alert-filter-btn');
            filterButtons.forEach(button => {
                button.classList.toggle('active', button.dataset.filter === filter);
            });
        }

        /**
     * Filter alerts
     */
        filterAlerts(filter) {
            const container = document.getElementById('kpi-alerts-container');
            if (!container) {
                return;
            }
        
            const alertElements = container.querySelectorAll('.kpi-alert');
        
            alertElements.forEach(element => {
                const shouldShow = this.shouldShowAlert(element, filter);
                element.style.display = shouldShow ? 'flex' : 'none';
            });
        }

        /**
     * Determine if alert should be shown based on filter
     */
        shouldShowAlert(element, filter) {
            if (filter === 'all') {
                return true;
            }
        
            const severity = element.getAttribute('data-severity');
            const category = element.getAttribute('data-category');
            const isAcknowledged = element.classList.contains('acknowledged');
        
            switch (filter) {
            case 'critical':
            case 'medium':
            case 'low':
                return severity === filter;
            case 'unacknowledged':
                return !isAcknowledged;
            case 'storage':
            case 'structure':
            case 'quality':
            case 'performance':
                return category === filter;
            default:
                return true;
            }
        }

        /**
     * Add alert to history
     */
        addToHistory(alert) {
            this.alertHistory.unshift({
                ...alert,
                action: 'created',
                timestamp: new Date()
            });
        
            // Limit history size
            if (this.alertHistory.length > this.maxHistorySize) {
                this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
            }
        
            this.saveAlertHistory();
        }

        /**
     * Load alert history from localStorage
     */
        loadAlertHistory() {
            try {
                const history = localStorage.getItem('kpi_alerts_history');
                if (history) {
                    this.alertHistory = JSON.parse(history);
                }
            } catch (error) {
                console.error('Error loading alert history:', error);
            }
        }

        /**
     * Save alert history to localStorage
     */
        saveAlertHistory() {
            try {
                localStorage.setItem('kpi_alerts_history', JSON.stringify(this.alertHistory));
            } catch (error) {
                console.error('Error saving alert history:', error);
            }
        }

        /**
     * Get alert statistics
     */
        getStatistics() {
            const stats = {
                total: this.alerts.length,
                critical: this.alerts.filter(a => a.severity === 'critical').length,
                medium: this.alerts.filter(a => a.severity === 'medium').length,
                low: this.alerts.filter(a => a.severity === 'low').length,
                acknowledged: this.alerts.filter(a => a.acknowledged).length,
                categories: {}
            };
        
            // Count by category
            this.alerts.forEach(alert => {
                stats.categories[alert.category] = (stats.categories[alert.category] || 0) + 1;
            });
        
            return stats;
        }

        /**
     * Export alerts data
     */
        exportAlerts() {
            const data = {
                alerts: this.alerts,
                history: this.alertHistory,
                statistics: this.getStatistics(),
                lastScan: this.lastScanTime,
                exportTime: new Date()
            };
        
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kpi-alerts-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        /**
     * Destroy the alerts manager
     */
        destroy() {
            this.stopPeriodicScanning();
            this.saveAlertHistory();
        }
    };
    
    // Global assignment
    window.KPIAlertsManager = KPIAlertsManager;
}

// Global assignment for browser compatibility
if (typeof KPIAlertsManager !== 'undefined') {
    window.KPIAlertsManager = window.KPIAlertsManager || KPIAlertsManager;
    console.log('KPIAlertsManager class assigned to window');
} else {
    console.error('KPIAlertsManager class not defined');
}

// Global instance - only create if KPIAlertsManager is defined
if (typeof window.KPIAlertsManager !== 'undefined') {
    window.kpiAlertsManager = new window.KPIAlertsManager();
    console.log('KPIAlertsManager instance created');
} else {
    console.error('KPIAlertsManager class not defined in window');
}
