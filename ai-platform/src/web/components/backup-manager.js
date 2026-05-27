/**
 * Backup Manager - Enhanced Backup and Recovery System
 * Integrates with Python backup API and provides comprehensive backup management
 */

class BackupManager {
  constructor() {
    this.backupApi = 'http://localhost:8002/api/backup';
    this.currentBackups = [];
    this.backupJobs = new Map();
    this.backupConfig = null;
    this.isRefreshing = false;

    // Configuration
    this.config = {
      autoRefresh: true,
      refreshInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 2000,
    };

    this.init();
  }

  async init() {
    console.log('Initializing backup manager...');
    try {
      await this.loadBackupConfig();
      await this.loadBackupList();
      this.setupEventListeners();
      this.startAutoRefresh();
      console.log('Backup manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize backup manager:', error);
    }
  }

  async loadBackupConfig() {
    try {
      const response = await fetch(`${this.backupApi}/config`);
      if (!response.ok) {
        console.warn('Backup API not available - using default config');
        this.backupConfig = this.getDefaultConfig();
        return;
      }
      const data = await response.json();
      if (data.success) {
        this.backupConfig = data.config;
      }
    } catch (error) {
      console.warn('Backup API not available - using default config');
      this.backupConfig = this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      backup_dir: './backups',
      max_backups: 10,
      compression: true,
      include_patterns: ['*.py', '*.js', '*.json', '*.md'],
      exclude_patterns: ['node_modules', '__pycache__', '.git'],
      schedule: {
        enabled: false,
        interval: 'daily',
        time: '02:00',
      },
    };
  }

  async loadBackupList() {
    try {
      const response = await fetch(`${this.backupApi}/list`);
      if (!response.ok) {
        console.warn('Backup API not available - using empty backup list');
        this.currentBackups = [];
        this.updateBackupList();
        return;
      }
      const data = await response.json();
      if (data.success) {
        this.currentBackups = data.backups;
        this.updateBackupList();
      }
    } catch (error) {
      console.warn('Backup API not available - using empty backup list');
      this.currentBackups = [];
      this.updateBackupList();
    }
  }

  async createBackup(options = {}) {
    const backupName = options.name || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;

    try {
      // Show loading state
      this.showBackupProgress(backupName, 0);

      const payload = {
        backup_name: backupName,
        include_patterns: options.includePatterns,
        exclude_patterns: options.excludePatterns,
        compression: options.compression !== false,
      };

      const response = await fetch(`${this.backupApi}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        this.showBackupSuccess(backupName, result);
        // Refresh backup list asynchronously to avoid blocking
        this.loadBackupList().catch((error) =>
          console.warn('Failed to refresh backup list:', error)
        );
      } else {
        this.showBackupError(backupName, result.error);
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      this.showBackupError(backupName, error.message);
    }
  }

  async restoreBackup(backupName, targetDir = null) {
    try {
      const confirmed = await this.confirmRestore(backupName);
      if (!confirmed) {
        return;
      }

      this.showRestoreProgress(backupName, 0);

      const payload = targetDir ? { target_dir: targetDir } : {};

      const response = await fetch(`${this.backupApi}/restore/${backupName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        this.showRestoreSuccess(backupName, result);
      } else {
        this.showRestoreError(backupName, result.error);
      }
    } catch (error) {
      console.error('Failed to restore backup:', error);
      this.showRestoreError(backupName, error.message);
    }
  }

  async deleteBackup(backupName) {
    try {
      const confirmed = await this.confirmDelete(backupName);
      if (!confirmed) {
        return;
      }

      const response = await fetch(`${this.backupApi}/delete/${backupName}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        this.showDeleteSuccess(backupName);
        await this.loadBackupList(); // Refresh backup list
      } else {
        this.showDeleteError(backupName, result.error);
      }
    } catch (error) {
      console.error('Failed to delete backup:', error);
      this.showDeleteError(backupName, error.message);
    }
  }

  async downloadBackup(backupName) {
    try {
      const response = await fetch(`${this.backupApi}/download/${backupName}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${backupName}.tar.gz`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Failed to download backup:', error);
      this.showNotification(`Failed to download backup: ${error.message}`, 'error');
    }
  }

  async getBackupStats() {
    try {
      const response = await fetch(`${this.backupApi}/stats`);
      const data = await response.json();
      return data.success ? data.stats : null;
    } catch (error) {
      console.error('Failed to get backup stats:', error);
      return null;
    }
  }

  setupEventListeners() {
    // Backup form submission
    document.addEventListener('submit', async (e) => {
      if (e.target.id === 'backup-form') {
        e.preventDefault();
        await this.handleBackupSubmit(e.target);
      }
    });

    // Backup action buttons
    document.addEventListener('click', async (e) => {
      if (e.target.matches('[data-backup-action]')) {
        const action = e.target.dataset.backupAction;
        const backupName = e.target.dataset.backupName;

        switch (action) {
          case 'restore':
            await this.restoreBackup(backupName);
            break;
          case 'delete':
            await this.deleteBackup(backupName);
            break;
          case 'download':
            await this.downloadBackup(backupName);
            break;
          case 'details':
            await this.showBackupDetails(backupName);
            break;
        }
      }
    });
  }

  async handleBackupSubmit(form) {
    const formData = new FormData(form);
    const options = {
      name: formData.get('backup_name'),
      includePatterns: this.getSelectedPatterns('include'),
      excludePatterns: this.getSelectedPatterns('exclude'),
      compression: formData.get('compression') === 'on',
    };

    await this.createBackup(options);
  }

  getSelectedPatterns(type) {
    const checkboxes = document.querySelectorAll(`input[name="${type}_patterns[]"]:checked`);
    return Array.from(checkboxes).map((cb) => cb.value);
  }

  showBackupProgress(backupName, progress) {
    const jobId = `backup-${backupName}`;
    this.backupJobs.set(jobId, {
      name: backupName,
      progress: progress,
      status: 'running',
    });
    this.updateBackupProgress();
  }

  showBackupSuccess(backupName, result) {
    const jobId = `backup-${backupName}`;
    this.backupJobs.set(jobId, {
      name: backupName,
      progress: 100,
      status: 'completed',
    });
    this.updateBackupProgress();

    this.showNotification(
      `Backup "${backupName}" created successfully! Size: ${this.formatFileSize(result.metadata.size)}`,
      'success'
    );
  }

  showBackupError(backupName, error) {
    const jobId = `backup-${backupName}`;
    this.backupJobs.set(jobId, {
      name: backupName,
      progress: 0,
      status: 'failed',
      error: error,
    });
    this.updateBackupProgress();

    this.showNotification(`Backup "${backupName}" failed: ${error}`, 'error');
  }

  showRestoreProgress(backupName, progress) {
    this.showNotification(`Restoring backup "${backupName}"...`, 'info');
  }

  showRestoreSuccess(backupName, result) {
    this.showNotification(
      `Backup "${backupName}" restored successfully to: ${result.target_directory}`,
      'success'
    );
  }

  showRestoreError(backupName, error) {
    this.showNotification(`Failed to restore backup "${backupName}": ${error}`, 'error');
  }

  showDeleteSuccess(backupName) {
    this.showNotification(`Backup "${backupName}" deleted successfully`, 'success');
  }

  showDeleteError(backupName, error) {
    this.showNotification(`Failed to delete backup "${backupName}": ${error}`, 'error');
  }

  async confirmRestore(backupName) {
    return confirm(
      `Are you sure you want to restore backup "${backupName}"?\n\nThis will overwrite existing files in the target directory.`
    );
  }

  async confirmDelete(backupName) {
    return confirm(
      `Are you sure you want to delete backup "${backupName}"?\n\nThis action cannot be undone.`
    );
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  getNotificationIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      info: 'info-circle',
      warning: 'exclamation-triangle',
    };
    return icons[type] || 'info-circle';
  }

  formatFileSize(bytes) {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  updateBackupList() {
    const container = document.getElementById('backup-list');
    if (!container) {
      return;
    }

    if (this.currentBackups.length === 0) {
      container.textContent = `
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <h3>No backups available</h3>
                    <p>Create your first backup to get started.</p>
                </div>
            ` /* Replaced innerHTML with textContent for safety */
      return;
    }

    container.textContent = this.currentBackups
      .map(
        (backup) => `
            <div class="backup-item" data-backup-name="${backup.name}">
                <div class="backup-header">
                    <div class="backup-info">
                        <h4 class="backup-name">${backup.name}</h4>
                        <p class="backup-date">${this.formatTimestamp(backup.timestamp)}</p>
                    </div>
                    <div class="backup-stats">
                        <span class="backup-size">${this.formatFileSize(backup.size)}</span>
                        <span class="backup-files">${backup.files_count} files</span>
                    </div>
                </div>
                <div class="backup-actions">
                    <button class="btn btn-sm btn-primary" data-backup-action="download" data-backup-name="${backup.name}">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button class="btn btn-sm btn-success" data-backup-action="restore" data-backup-name="${backup.name}">
                        <i class="fas fa-undo"></i> Restore
                    </button>
                    <button class="btn btn-sm btn-info" data-backup-action="details" data-backup-name="${backup.name}">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    <button class="btn btn-sm btn-danger" data-backup-action="delete" data-backup-name="${backup.name}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `
      )
      .join('') /* Replaced innerHTML with textContent for safety */
  }

  updateBackupProgress() {
    const container = document.getElementById('backup-progress');
    if (!container) {
      return;
    }

    const activeJobs = Array.from(this.backupJobs.values()).filter(
      (job) => job.status === 'running'
    );

    if (activeJobs.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.textContent = activeJobs
      .map(
        (job) => `
            <div class="progress-item">
                <div class="progress-info">
                    <span class="progress-name">${job.name}</span>
                    <span class="progress-status">${job.status}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${job.progress}%"></div>
                </div>
            </div>
        `
      )
      .join('') /* Replaced innerHTML with textContent for safety */
  }

  startAutoRefresh() {
    if (!this.config.autoRefresh) {
      return;
    }

    setInterval(async () => {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        await this.loadBackupList();
        await this.updateBackupStatus();
        this.isRefreshing = false;
      }
    }, this.config.refreshInterval);
  }

  async updateBackupStatus() {
    // Update real-time status indicators
    const statusElements = document.querySelectorAll('[data-backup-status]');

    for (const element of statusElements) {
      const backupName = element.dataset.backupStatus;
      if (backupName) {
        const status = await this.getBackupStatus(backupName);
        this.updateStatusIndicator(element, status);
      }
    }
  }

  async getBackupStatus(backupName) {
    try {
      const response = await fetch(`${this.backupApi}/status/${backupName}`);
      const data = await response.json();
      return data.success ? data.metadata : null;
    } catch (error) {
      console.error('Failed to get backup status:', error);
      return null;
    }
  }

  updateStatusIndicator(element, status) {
    if (!status) {
      return;
    }

    const statusBadge = element.querySelector('.status-badge');
    const progressBar = element.querySelector('.progress-fill');

    if (statusBadge) {
      statusBadge.className = `status-badge status-${status.status}`;
      statusBadge.textContent = status.status.charAt(0).toUpperCase() + status.status.slice(1);
    }

    if (progressBar && status.progress !== undefined) {
      progressBar.style.width = `${status.progress}%`;
    }

    // Add timestamp update
    const timestampElement = element.querySelector('.backup-timestamp');
    if (timestampElement) {
      timestampElement.textContent = this.formatTimestamp(status.timestamp);
    }
  }

  showBackupProgress(backupName, progress) {
    const jobId = `backup-${backupName}`;
    this.backupJobs.set(jobId, {
      name: backupName,
      progress: progress,
      status: 'running',
    });
    this.updateBackupProgress();

    // Show real-time progress indicator
    this.showRealtimeProgress(backupName, progress);
  }

  showRealtimeProgress(backupName, progress) {
    // Create or update progress notification
    let progressElement = document.getElementById(`progress-${backupName}`);

    if (!progressElement) {
      progressElement = document.createElement('div');
      progressElement.id = `progress-${backupName}`;
      progressElement.className = 'backup-progress-notification';
      document.body.appendChild(progressElement);
    }

    progressElement.textContent = `
            <div class="progress-content">
                <div class="progress-header">
                    <i class="fas fa-database"></i>
                    <span>Creating Backup: ${backupName}</span>
                    <button class="progress-close" onclick="this.closest('.backup-progress-notification').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <div class="progress-details">
                    <span class="progress-percentage">${progress}%</span>
                    <span class="progress-status">Processing...</span>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

    // Auto-remove when complete
    if (progress >= 100) {
      setTimeout(() => {
        if (progressElement && progressElement.parentNode) {
          progressElement.remove();
        }
      }, 3000);
    }
  }

  async showBackupDetails(backupName) {
    try {
      const response = await fetch(`${this.backupApi}/status/${backupName}`);
      const data = await response.json();

      if (data.success) {
        this.displayBackupDetails(data.metadata);
      } else {
        this.showNotification('Failed to load backup details', 'error');
      }
    } catch (error) {
      console.error('Failed to get backup details:', error);
      this.showNotification('Failed to load backup details', 'error');
    }
  }

  displayBackupDetails(metadata) {
    // Create modal or expandable section with backup details
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.textContent = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Backup Details: ${metadata.name}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="backup-details">
                        <div class="detail-section">
                            <h4>Basic Information</h4>
                            <p><strong>Name:</strong> ${metadata.name}</p>
                            <p><strong>Created:</strong> ${this.formatTimestamp(metadata.timestamp)}</p>
                            <p><strong>Size:</strong> ${this.formatFileSize(metadata.size)}</p>
                            <p><strong>Files:</strong> ${metadata.files_count}</p>
                            <p><strong>Checksum:</strong> <code>${metadata.checksum}</code></p>
                        </div>
                        <div class="detail-section">
                            <h4>Configuration</h4>
                            <p><strong>Compression:</strong> ${metadata.compression ? 'Enabled' : 'Disabled'}</p>
                            <p><strong>Encryption:</strong> ${metadata.encryption}</p>
                            <p><strong>Project Root:</strong> <code>${metadata.project_root}</code></p>
                        </div>
                        ${
                          metadata.git_info
                            ? `
                        <div class="detail-section">
                            <h4>Git Information</h4>
                            <p><strong>Branch:</strong> ${metadata.git_info.branch || 'N/A'}</p>
                            <p><strong>Commit:</strong> <code>${metadata.git_info.commit || 'N/A'}</code></p>
                            <p><strong>Status:</strong> ${metadata.git_info.status || 'N/A'}</p>
                        </div>
                        `
                            : ''
                        }
                        <div class="detail-section">
                            <h4>Status</h4>
                            <p><strong>Status:</strong> <span class="status-badge status-${metadata.status}">${metadata.status}</span></p>
                            <p><strong>Cloud Synced:</strong> ${metadata.cloud_synced ? 'Yes' : 'No'}</p>
                            ${metadata.error_message ? `<p><strong>Error:</strong> ${metadata.error_message}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

    document.body.appendChild(modal);
  }
}

// Initialize backup manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.backupManager = new BackupManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackupManager;
}
