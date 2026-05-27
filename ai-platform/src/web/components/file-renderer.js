/**
 * File Renderer - DOM manipulation and UI rendering for file browser
 * Extracted from FileBrowser for single responsibility principle
 */

class FileRenderer {
    constructor(containerId = 'file-tree') {
        this.containerId = containerId;
        this.container = null;
    }

    /**
     * Initialize renderer
     */
    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.warn(`Container with id '${this.containerId}' not found`);
        }
    }

    /**
     * Render file tree from file data
     */
    renderFileTree(fileData) {
        if (!this.container) {
            console.error('File renderer container not initialized');
            return false;
        }

        this.clearContainer();
        
        fileData.forEach((item, index) => {
            if (this.validateFileItem(item)) {
                const fileItem = this.createFileItem(item, index);
                this.container.appendChild(fileItem);
            }
        });

        console.log('File tree rendered successfully with', fileData.length, 'items');
        return true;
    }

    /**
     * Clear container content
     */
    clearContainer() {
        if (this.container) {
            this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        }
    }

    /**
     * Create DOM element for file item
     */
    createFileItem(item, index) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.dataset.name = item.name;
        div.dataset.type = item.type;
        div.dataset.index = index;

        this.setFileItemContent(div, item);
        this.addFileItemStyles(div, item);

        return div;
    }

    /**
     * Set content for file item
     */
    setFileItemContent(element, item) {
        const fileManager = this.getFileManager();
        const text = fileManager ? fileManager.formatFileItemText(item) : this.formatFileItemText(item);
        element.textContent = text /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Add styles to file item based on type
     */
    addFileItemStyles(element, item) {
        // Add type-specific classes
        if (item.type === 'directory') {
            element.classList.add('directory-item');
        } else {
            element.classList.add('file-item');
        }

        // Add selection state styles
        if (this.isFileSelected(item.name)) {
            element.classList.add('selected');
        }
    }

    /**
     * Format file item text (fallback)
     */
    formatFileItemText(item) {
        const icon = this.getFileIcon(item);
        const size = item.size || 'Unknown';
        const modified = item.modified ? '• ' + item.modified : '';
        
        return `${icon} ${item.name} ${size} ${modified}`;
    }

    /**
     * Get file icon (fallback)
     */
    getFileIcon(item) {
        if (item.type === 'directory') {
            return '📁';
        }
        
        const extension = this.getFileExtension(item.name);
        const icons = {
            'js': '🟨', 'py': '🐍', 'html': '🌐', 'css': '🎨',
            'json': '📋', 'md': '📝', 'yml': '📄', 'txt': '📄'
        };
        
        return icons[extension] || '📄';
    }

    /**
     * Extract file extension from filename
     */
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    /**
     * Check if file is selected
     */
    isFileSelected(fileName) {
        const fileManager = this.getFileManager();
        return fileManager ? fileManager.getSelectedItems().includes(fileName) : false;
    }

    /**
     * Get file manager instance
     */
    getFileManager() {
        return window.fileManager || null;
    }

    /**
     * Update file item selection state
     */
    updateFileSelection(fileName, isSelected) {
        const fileItem = this.container.querySelector(`[data-name="${fileName}"]`);
        if (fileItem) {
            if (isSelected) {
                fileItem.classList.add('selected');
            } else {
                fileItem.classList.remove('selected');
            }
        }
    }

    /**
     * Render file details in details panel
     */
    renderFileDetails(item) {
        const detailsContent = document.getElementById('file-details-content');
        if (!detailsContent) {
            return false;
        }

        const detailsHTML = this.createFileDetailsHTML(item);
        detailsContent.textContent = detailsHTML /* Replaced innerHTML with textContent for safety */
        
        console.log('File details updated for:', item.name);
        return true;
    }

    /**
     * Create HTML for file details
     */
    createFileDetailsHTML(item) {
        return `
            <div class="file-details">
                <div class="detail-row">
                    <strong>Name:</strong> ${this.escapeHtml(item.name)}
                </div>
                <div class="detail-row">
                    <strong>Size:</strong> ${item.size || 'Unknown'}
                </div>
                <div class="detail-row">
                    <strong>Modified:</strong> ${item.modified || 'Unknown'}
                </div>
                <div class="detail-row">
                    <strong>Type:</strong> ${this.escapeHtml(item.type)}
                </div>
                ${item.items ? `<div class="detail-row"><strong>Items:</strong> ${item.items}</div>` : ''}
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Add loading state to container
     */
    showLoading() {
        if (!this.container) {
            return;
        }

        this.container.textContent = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading files...</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Add empty state to container
     */
    showEmptyState(message = 'No files found') {
        if (!this.container) {
            return;
        }

        this.container.textContent = `
            <div class="empty-state">
                <div class="empty-icon">📁</div>
                <div class="empty-message">${this.escapeHtml(message)}</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Add error state to container
     */
    showErrorState(error) {
        if (!this.container) {
            return;
        }

        this.container.textContent = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <div class="error-message">${this.escapeHtml(error)}</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Validate file item
     */
    validateFileItem(item) {
        return item && 
               typeof item.name === 'string' && 
               typeof item.type === 'string' &&
               item.name.length > 0;
    }

    /**
     * Get container element
     */
    getContainer() {
        return this.container;
    }

    /**
     * Set container element
     */
    setContainer(element) {
        this.container = element;
    }

    /**
     * Destroy renderer and clean up
     */
    destroy() {
        if (this.container) {
            this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        }
        this.container = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileRenderer;
}

// Global assignment for browser compatibility
window.FileRenderer = window.FileRenderer || FileRenderer;
