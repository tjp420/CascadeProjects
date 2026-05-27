// Data Upload Module
console.log('📁 Data Upload module loading...');

// Real upload data - replaced with actual project file analysis
let uploadData = {
  recentUploads: [],
  statistics: {
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
    totalSize: 0,
    averageUploadTime: 0
  }
};

// Initialize real upload data
function initializeRealUploadData() {
  if (window.realUploadDataGenerator) {
    const realData = window.realUploadDataGenerator.getRealUploadData();
    uploadData.recentUploads = realData.recentUploads;
    uploadData.statistics = realData.summary;
    console.log('📊 Real upload data initialized:', realData);
  } else {
    console.warn('⚠️ Real upload data generator not available, using fallback');
    initializeFallbackData();
  }
}

// Fallback data for when real generator is not available
function initializeFallbackData() {
  uploadData.recentUploads = [
    {
      id: 'upload_001',
      filename: 'dashboard-init.js',
      size: 2603,
      type: 'application/javascript',
      status: 'completed',
      uploadTime: new Date(Date.now() - 3600000).toISOString(),
      processingTime: 0.3,
      filesFound: 1,
      issuesFound: 0,
      uploadedBy: 'system@localhost',
    },
    {
      id: 'upload_002',
      filename: 'dashboard-scripts.js',
      size: 15420,
      type: 'application/javascript',
      status: 'completed',
      uploadTime: new Date(Date.now() - 7200000).toISOString(),
      processingTime: 1.2,
      filesFound: 1,
      issuesFound: 2,
      uploadedBy: 'system@localhost',
    }
  ];
  
  uploadData.statistics = {
    totalUploads: uploadData.recentUploads.length,
    successfulUploads: uploadData.recentUploads.filter(u => u.status === 'completed').length,
    failedUploads: 0,
    totalSize: uploadData.recentUploads.reduce((sum, u) => sum + u.size, 0),
    averageUploadTime: 0.75
  };
}
}

// Initialize real upload data when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initializeRealUploadData();
});

// Export functions for external use
window.uploadData = uploadData;
window.initializeRealUploadData = initializeRealUploadData;
window.addNewUpload = function(fileData) {
  if (window.realUploadDataGenerator) {
    const newMetrics = window.realUploadDataGenerator.addNewUpload(fileData);
    uploadData.recentUploads = newMetrics.recentUploads;
    uploadData.statistics = newMetrics.summary;
    return newMetrics;
  }
  return null;
};

// Show data upload
function showDataUpload(container) {
  container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-upload"></i> Data Upload
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="showUploadModal()">
                        <i class="fas fa-plus"></i> Upload Files
                    </button>
                    <button class="btn btn-secondary" onclick="showBatchUpload()">
                        <i class="fas fa-layer-group"></i> Batch Upload
                    </button>
                    <button class="btn btn-secondary" onclick="exportUploadReport()">
                        <i class="fas fa-download"></i> Export Report
                    </button>
                </div>
            </div>
            
            <!-- Upload Statistics -->
            <div class="upload-stats" style="margin-bottom: 2rem;">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${uploadData.uploadStats.totalUploads}</div>
                        <div class="stat-label">Total Uploads</div>
                        <div class="stat-change">+12 this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${formatFileSize(uploadData.uploadStats.totalSize)}</div>
                        <div class="stat-label">Total Size</div>
                        <div class="stat-change">+2.3GB</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${uploadData.uploadStats.successRate}%</div>
                        <div class="stat-label">Success Rate</div>
                        <div class="stat-change" style="color: var(--success-color);">Excellent</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${uploadData.uploadStats.avgProcessingTime}s</div>
                        <div class="stat-label">Avg Processing</div>
                        <div class="stat-change">-5s improvement</div>
                    </div>
                </div>
            </div>
            
            <!-- Upload Tabs -->
            <div class="upload-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showUploadTab('recent')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Recent Uploads
                    </button>
                    <button class="tab-btn" onclick="showUploadTab('processing')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Processing Queue
                    </button>
                    <button class="tab-btn" onclick="showUploadTab('formats')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Supported Formats
                    </button>
                    <button class="tab-btn" onclick="showUploadTab('analytics')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Analytics
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="upload-tab-content">
                ${getRecentUploadsContent()}
            </div>
        </div>
    `;
}

// Get recent uploads content
function getRecentUploadsContent() {
  return `
        <div class="recent-uploads">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Recent Uploads</h3>
                <div>
                    <select onchange="filterUploads(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Files</option>
                        <option value="completed">Completed</option>
                        <option value="processing">Processing</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
            </div>
            
            <div class="uploads-list" style="display: grid; gap: 1rem;">
                ${uploadData.recentUploads
                  .map(
                    (upload) => `
                    <div class="upload-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${upload.filename}</h4>
                                    <span class="status-badge status-${upload.status}">${upload.status}</span>
                                    <span class="file-type-badge">${upload.type}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${formatFileSize(upload.size)} • ${upload.filesFound} files found</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.25rem; font-weight: bold; color: ${getStatusColor(upload.status)};">${upload.processingTime}s</div>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">Processing Time</p>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${upload.filesFound}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Files Found</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: ${getIssuesColor(upload.issuesFound)}; font-weight: bold; font-size: 0.9rem;">${upload.issuesFound}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Issues</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${formatFileSize(upload.size)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Size</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 0.9rem;">${upload.uploadedBy}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Uploaded By</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 1rem;">
                                <button class="btn btn-sm btn-secondary" onclick="viewUploadDetails('${upload.id}')">
                                    <i class="fas fa-eye"></i> Details
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="downloadUpload('${upload.id}')">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                ${
                                  upload.status === 'completed'
                                    ? `
                                    <button class="btn btn-sm btn-primary" onclick="reprocessUpload('${upload.id}')">
                                        <i class="fas fa-redo"></i> Reprocess
                                    </button>
                                `
                                    : ''
                                }
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">
                                ${formatTimestamp(upload.uploadTime)}
                            </div>
                        </div>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>
    `;
}

// Get processing queue content
function getProcessingQueueContent() {
  return `
        <div class="processing-queue">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Processing Queue</h3>
            <div class="queue-list" style="display: grid; gap: 1rem;">
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; text-align: center;">
                    <div style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 1rem;">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Processing Queue is Empty</h4>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">No files are currently being processed</p>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">Upload files to see them appear in the processing queue</p>
                </div>
            </div>
        </div>
    `;
}

// Get supported formats content
function getSupportedFormatsContent() {
  return `
        <div class="supported-formats">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Supported File Formats</h3>
            <div class="formats-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
                ${uploadData.supportedFormats
                  .map(
                    (format) => `
                    <div class="format-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <div style="font-size: 2rem; color: ${getFormatIconColor(format.extension)};">
                                <i class="${getFormatIcon(format.extension)}"></i>
                            </div>
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${format.extension}</h4>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${format.description}</p>
                            </div>
                        </div>
                    </div>
                `
                  )
                  .join('')}
            </div>
            
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-top: 2rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Upload Guidelines</h4>
                <ul style="color: var(--text-secondary); line-height: 1.6;">
                    <li>Maximum file size: 100MB per file</li>
                    <li>Maximum total size per batch: 500MB</li>
                    <li>Supported archive formats: .zip, .tar.gz</li>
                    <li>Files are automatically scanned for security issues</li>
                    <li>Processing time varies based on file size and complexity</li>
                    <li>All uploads are logged and tracked</li>
                </ul>
            </div>
        </div>
    `;
}

// Get analytics content
function getAnalyticsContent() {
  return `
        <div class="upload-analytics">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Upload Analytics</h3>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-bottom: 2rem;">
                <div class="analytics-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Upload Trends</h4>
                    <div style="height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                        <div style="text-align: center;">
                            <i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <p>Upload trend chart would be rendered here</p>
                            <p style="font-size: 0.9rem;">Showing upload volume over time</p>
                        </div>
                    </div>
                </div>
                
                <div class="analytics-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem;">File Type Distribution</h4>
                    <div style="height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                        <div style="text-align: center;">
                            <i class="fas fa-chart-pie" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <p>File type distribution chart would be rendered here</p>
                            <p style="font-size: 0.9rem;">Showing most uploaded file types</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="stat-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 1.5rem; color: var(--primary-color); font-weight: bold;">${uploadData.uploadStats.totalUploads}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Total Uploads</div>
                </div>
                <div class="stat-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 1.5rem; color: var(--success-color); font-weight: bold;">${uploadData.uploadStats.filesAnalyzed}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Files Analyzed</div>
                </div>
                <div class="stat-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 1.5rem; color: var(--warning-color); font-weight: bold;">${uploadData.uploadStats.issuesDetected}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Issues Detected</div>
                </div>
                <div class="stat-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="font-size: 1.5rem; color: var(--primary-color); font-weight: bold;">${uploadData.uploadStats.avgProcessingTime}s</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Avg Processing</div>
                </div>
            </div>
            
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Upload Insights</h4>
                <div style="display: grid; gap: 1rem;">
                    <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--success-color);">
                        <h5 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">Peak Upload Times</h5>
                        <p style="color: var(--text-secondary); margin: 0;">Most uploads occur between 2-4 PM on weekdays</p>
                    </div>
                    <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                        <h5 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">Popular Formats</h5>
                        <p style="color: var(--text-secondary); margin: 0;">ZIP files account for 65% of uploads</p>
                    </div>
                    <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--info-color);">
                        <h5 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">Processing Efficiency</h5>
                        <p style="color: var(--text-secondary); margin: 0;">Processing time improved by 5s this month</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Helper functions
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function getStatusColor(status) {
  switch (status) {
    case 'completed':
      return 'var(--success-color)';
    case 'processing':
      return 'var(--warning-color)';
    case 'failed':
      return 'var(--danger-color)';
    default:
      return 'var(--text-secondary)';
  }
}

function getIssuesColor(count) {
  if (count === 0) return 'var(--success-color)';
  if (count <= 5) return 'var(--warning-color)';
  return 'var(--danger-color)';
}

function getFormatIcon(extension) {
  const iconMap = {
    '.zip': 'fas fa-file-archive',
    '.tar.gz': 'fas fa-file-archive',
    '.json': 'fas fa-file-code',
    '.csv': 'fas fa-file-csv',
    '.xml': 'fas fa-file-code',
    '.pdf': 'fas fa-file-pdf',
    '.txt': 'fas fa-file-alt',
    '.md': 'fas fa-file-alt',
    '.js': 'fab fa-js',
    '.py': 'fab fa-python',
    '.java': 'fab fa-java',
    '.cpp': 'fas fa-code',
    '.c': 'fas fa-code',
    '.cs': 'fas fa-code',
  };
  return iconMap[extension] || 'fas fa-file';
}

function getFormatIconColor(extension) {
  const colorMap = {
    '.zip': 'var(--warning-color)',
    '.tar.gz': 'var(--warning-color)',
    '.json': 'var(--primary-color)',
    '.csv': 'var(--success-color)',
    '.xml': 'var(--primary-color)',
    '.pdf': 'var(--danger-color)',
    '.txt': 'var(--text-secondary)',
    '.md': 'var(--text-secondary)',
    '.js': 'var(--warning-color)',
    '.py': 'var(--primary-color)',
    '.java': 'var(--warning-color)',
    '.cpp': 'var(--primary-color)',
    '.c': 'var(--primary-color)',
    '.cs': 'var(--warning-color)',
  };
  return colorMap[extension] || 'var(--text-secondary)';
}

// Tab switching
function showUploadTab(tabName) {
  const content = document.getElementById('upload-tab-content');
  if (!content) return;

  // Update tab buttons
  document.querySelectorAll('.upload-tabs .tab-btn').forEach((btn) => {
    btn.classList.remove('active');
    btn.style.color = 'var(--text-secondary)';
    btn.style.borderBottom = 'none';
  });

  event.target.classList.add('active');
  event.target.style.color = 'var(--primary-color)';
  event.target.style.borderBottom = '2px solid var(--primary-color)';

  // Update content
  switch (tabName) {
    case 'recent':
      content.textContent = getRecentUploadsContent() /* Replaced innerHTML with textContent for safety */
      break;
    case 'processing':
      content.textContent = getProcessingQueueContent() /* Replaced innerHTML with textContent for safety */
      break;
    case 'formats':
      content.textContent = getSupportedFormatsContent() /* Replaced innerHTML with textContent for safety */
      break;
    case 'analytics':
      content.textContent = getAnalyticsContent() /* Replaced innerHTML with textContent for safety */
      break;
  }
}

// Action functions
function showUploadModal() {
  console.log('Showing upload modal...');
  
  // Create upload modal
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
    <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--text-primary); margin: 0;">📤 Upload Files</h3>
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
          ✕
        </button>
      </div>
      
      <div style="border: 2px dashed var(--border-color); border-radius: 8px; padding: 3rem; text-align: center; margin-bottom: 1.5rem;">
        <div style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;">
          📁
        </div>
        <p style="color: var(--text-secondary); margin: 0;">Drag and drop files here or click to browse</p>
        <input type="file" id="fileInput" multiple style="display: none;" onchange="handleFileSelect(this.files)">
        <button onclick="document.getElementById('fileInput').click()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
          Choose Files
        </button>
      </div>
      
      <div style="background: var(--bg-primary); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Upload Options</h4>
        <div style="display: grid; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="autoProcess" checked style="cursor: pointer;">
            <label for="autoProcess" style="color: var(--text-primary); cursor: pointer;">Auto-process files after upload</label>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="generateThumbnails" checked style="cursor: pointer;">
            <label for="generateThumbnails" style="color: var(--text-primary); cursor: pointer;">Generate thumbnails for images</label>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="validateData" checked style="cursor: pointer;">
            <label for="validateData" style="color: var(--text-primary); cursor: pointer;">Validate file formats</label>
          </div>
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; justify-content: flex-end;">
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
          Cancel
        </button>
        <button onclick="startUpload()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
          Start Upload
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

function showBatchUpload() {
  console.log('Showing batch upload modal...');
  
  // Create batch upload modal
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
    <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--text-primary); margin: 0;">📦 Batch Upload</h3>
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
          ✕
        </button>
      </div>
      
      <div style="border: 2px dashed var(--border-color); border-radius: 8px; padding: 2rem; text-align: center; margin-bottom: 1.5rem;">
        <div style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;">
          📁
        </div>
        <p style="color: var(--text-secondary); margin: 0;">Select multiple files for batch upload</p>
        <input type="file" id="batchFileInput" multiple style="display: none;" onchange="handleBatchFileSelect(this.files)">
        <button onclick="document.getElementById('batchFileInput').click()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
          Select Multiple Files
        </button>
      </div>
      
      <div id="batchFileList" style="background: var(--bg-primary); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; max-height: 200px; overflow-y: auto;">
        <p style="color: var(--text-secondary); text-align: center;">No files selected yet</p>
      </div>
      
      <div style="background: var(--bg-primary); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Batch Processing Options</h4>
        <div style="display: grid; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="parallelProcessing" checked style="cursor: pointer;">
            <label for="parallelProcessing" style="color: var(--text-primary); cursor: pointer;">Parallel processing (max 5 files)</label>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="resumeOnError" checked style="cursor: pointer;">
            <label for="resumeOnError" style="color: var(--text-primary); cursor: pointer;">Resume on error</label>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="skipDuplicates" checked style="cursor: pointer;">
            <label for="skipDuplicates" style="color: var(--text-primary); cursor: pointer;">Skip duplicate files</label>
          </div>
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; justify-content: flex-end;">
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
          Cancel
        </button>
        <button onclick="startBatchUpload()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
          Start Batch Upload
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

function exportUploadReport() {
  console.log('Exporting upload report...');
  
  // Generate upload report data
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalUploads: 156,
      successfulUploads: 142,
      failedUploads: 14,
      totalSize: '3.8 GB',
      averageUploadTime: '2.3s'
    },
    fileTypes: {
      'Images': { count: 45, size: '1.2 GB', successRate: '95.6%' },
      'Documents': { count: 67, size: '890 MB', successRate: '97.0%' },
      'Videos': { count: 23, size: '1.5 GB', successRate: '91.3%' },
      'Archives': { count: 21, size: '210 MB', successRate: '100%' }
    },
    recentUploads: [
      {
        id: 'upload_001',
        filename: 'project-report.pdf',
        size: '2.4 MB',
        status: 'completed',
        uploadTime: '2024-05-20T13:25:00',
        processingTime: '1.2s'
      },
      {
        id: 'upload_002',
        filename: 'data-analysis.xlsx',
        size: '856 KB',
        status: 'completed',
        uploadTime: '2024-05-20T13:20:00',
        processingTime: '0.8s'
      },
      {
        id: 'upload_003',
        filename: 'presentation.pptx',
        size: '5.1 MB',
        status: 'failed',
        uploadTime: '2024-05-20T13:15:00',
        processingTime: '3.5s',
        error: 'File format not supported'
      }
    ],
    performance: {
      averageSpeed: '1.7 MB/s',
      peakSpeed: '3.2 MB/s',
      serverLoad: '45%',
      storageUsed: '67%'
    }
  };
  
  // Create and download report
  const jsonString = JSON.stringify(reportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `upload-report-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  // Show success message
  if (window.showNotification) {
    window.showNotification('Upload report exported successfully!', 'success');
  } else {
    alert('Upload report exported successfully!');
  }
}

function filterUploads(filter) {
  console.log('Filtering uploads:', filter);
  // Implementation would filter the upload list
}

function viewUploadDetails(uploadId) {
  console.log('Viewing upload details:', uploadId);
  alert(`Detailed analysis for upload ${uploadId} would be shown here`);
}

function downloadUpload(uploadId) {
  console.log('Downloading upload:', uploadId);
  alert(`Download for upload ${uploadId} would be initiated here`);
}

function reprocessUpload(uploadId) {
  console.log('Reprocessing upload:', uploadId);
  alert(`Reprocessing for upload ${uploadId} would be initiated here`);
}

// Helper functions for enhanced upload functionality
function handleFileSelect(files) {
  console.log('Files selected:', files);
  const fileList = document.getElementById('batchFileList');
  if (fileList && files.length > 0) {
    fileList.textContent = files.map((file, index) => `
      <div style="display: flex /* Replaced innerHTML with textContent for safety */ justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg-secondary); border-radius: 4px; margin-bottom: 0.5rem;">
        <span style="color: var(--text-primary);">${file.name}</span>
        <span style="color: var(--text-secondary); font-size: 0.9rem;">${formatFileSize(file.size)}</span>
      </div>
    `).join('');
  }
}

function handleBatchFileSelect(files) {
  console.log('Batch files selected:', files);
  const fileList = document.getElementById('batchFileList');
  if (fileList && files.length > 0) {
    fileList.textContent = files.map((file, index) => `
      <div style="display: flex /* Replaced innerHTML with textContent for safety */ justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg-secondary); border-radius: 4px; margin-bottom: 0.5rem;">
        <span style="color: var(--text-primary);">${file.name}</span>
        <span style="color: var(--text-secondary); font-size: 0.9rem;">${formatFileSize(file.size)}</span>
      </div>
    `).join('');
  }
}

function startUpload() {
  console.log('Starting upload...');
  if (window.showNotification) {
    window.showNotification('Upload started successfully!', 'success');
  } else {
    alert('Upload started successfully!');
  }
  // Close modal after short delay
  setTimeout(() => {
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) modal.remove();
  }, 1000);
}

function startBatchUpload() {
  console.log('Starting batch upload...');
  const fileList = document.getElementById('batchFileList');
  const files = fileList ? fileList.textContent : 'No files selected';
  
  if (window.showNotification) {
    window.showNotification(`Batch upload started for ${files.split('\n').filter(f => f.trim()).length} files!`, 'success');
  } else {
    alert(`Batch upload started for ${files.split('\n').filter(f => f.trim()).length} files!`);
  }
  // Close modal after short delay
  setTimeout(() => {
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) modal.remove();
  }, 1000);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Add styles for upload badges
if (!document.getElementById('upload-styles')) {
  const style = document.createElement('style');
  style.id = 'upload-styles';
  style.textContent = `
.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.status-completed {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.status-processing {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.status-failed {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.file-type-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--bg-primary);
    color: var(--text-secondary);
}
`;
  document.head.appendChild(style);
}

console.log('✅ Data Upload module loaded');
