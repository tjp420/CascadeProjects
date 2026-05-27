/**
 * File Event Handler - Event management for file browser interactions
 * Extracted from FileBrowser for single responsibility principle
 */

class FileEventHandler {
    constructor(fileManager, fileRenderer) {
        this.fileManager = fileManager;
        this.fileRenderer = fileRenderer;
        this.eventListeners = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize event handlers
     */
    init() {
        if (this.isInitialized) {
            console.warn('FileEventHandler already initialized');
            return;
        }

        this.setupEventListeners();
        this.isInitialized = true;
        console.log('File event handlers initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Setup click handlers for file items
        this.setupFileItemClickHandlers();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Setup context menu
        this.setupContextMenuHandlers();
    }

    /**
     * Setup click handlers for file items
     */
    setupFileItemClickHandlers() {
        const container = this.fileRenderer.getContainer();
        if (!container) {
            return;
        }

        // Use event delegation for better performance
        const clickHandler = (event) => {
            const fileItem = event.target.closest('.file-item, .directory-item');
            if (fileItem) {
                this.handleFileItemClick(event, fileItem);
            }
        };

        container.addEventListener('click', clickHandler);
        this.eventListeners.set('click', clickHandler);

        // Setup double-click for opening files
        const doubleClickHandler = (event) => {
            const fileItem = event.target.closest('.file-item, .directory-item');
            if (fileItem) {
                this.handleFileItemDoubleClick(event, fileItem);
            }
        };

        container.addEventListener('dblclick', doubleClickHandler);
        this.eventListeners.set('dblclick', doubleClickHandler);
    }

    /**
     * Handle single click on file item
     */
    handleFileItemClick(event, fileItem) {
        const fileName = fileItem.dataset.name;
        const fileType = fileItem.dataset.type;
        const index = parseInt(fileItem.dataset.index) || 0;

        const item = this.getFileItemByIndex(index);
        if (!item) {
            return;
        }

        // Prevent default behavior
        event.preventDefault();

        // Handle selection
        this.handleFileSelection(item);

        // Handle preview
        this.handleFilePreview(item);

        // Trigger custom event
        this.triggerFileEvent('fileSelected', {
            item,
            fileName,
            fileType,
            index,
            event
        });
    }

    /**
     * Handle double click on file item
     */
    handleFileItemDoubleClick(event, fileItem) {
        const fileName = fileItem.dataset.name;
        const fileType = fileItem.dataset.type;
        const index = parseInt(fileItem.dataset.index) || 0;

        const item = this.getFileItemByIndex(index);
        if (!item) {
            return;
        }

        // Prevent default behavior
        event.preventDefault();

        // Handle file opening
        this.handleFileOpen(item);

        // Trigger custom event
        this.triggerFileEvent('fileOpened', {
            item,
            fileName,
            fileType,
            index,
            event
        });
    }

    /**
     * Handle file selection logic
     */
    handleFileSelection(item) {
        const selectedItems = this.fileManager.selectItem(item);
        
        // Update UI
        this.fileRenderer.updateFileSelection(item.name, selectedItems.includes(item.name));

        // Trigger selection change event
        this.triggerFileEvent('selectionChanged', {
            selectedItems,
            item,
            action: selectedItems.includes(item.name) ? 'selected' : 'deselected'
        });
    }

    /**
     * Handle file preview
     */
    handleFilePreview(item) {
        const success = this.fileRenderer.renderFileDetails(item);
        
        if (success) {
            this.triggerFileEvent('filePreviewed', { item });
        } else {
            console.warn('Failed to render file details for:', item.name);
        }
    }

    /**
     * Handle file opening
     */
    handleFileOpen(item) {
        console.log('Opening file:', item.name);
        
        // Different behavior based on file type
        if (item.type === 'directory') {
            this.openDirectory(item);
        } else {
            this.openFile(item);
        }

        this.triggerFileEvent('fileAction', {
            action: 'open',
            item
        });
    }

    /**
     * Open directory
     */
    openDirectory(directory) {
        console.log('Opening directory:', directory.name);
        // Implementation would navigate into directory
        // For now, just log the action
    }

    /**
     * Open file
     */
    openFile(file) {
        console.log('Opening file:', file.name);
        // Implementation would open file in editor or viewer
        // For now, just log the action
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        const keydownHandler = (event) => {
            this.handleKeyboardShortcut(event);
        };

        document.addEventListener('keydown', keydownHandler);
        this.eventListeners.set('keydown', keydownHandler);
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcut(event) {
        // Only handle shortcuts when file browser has focus
        if (!this.isFileBrowserActive()) {
            return;
        }

        const key = event.key.toLowerCase();
        const ctrlKey = event.ctrlKey || event.metaKey;
        const shiftKey = event.shiftKey;

        // Ctrl+A: Select all
        if (ctrlKey && key === 'a') {
            event.preventDefault();
            this.selectAllFiles();
        }

        // Delete: Remove selected files
        if (key === 'delete') {
            event.preventDefault();
            this.deleteSelectedFiles();
        }

        // Enter: Open selected file
        if (key === 'enter') {
            event.preventDefault();
            this.openSelectedFile();
        }

        // Escape: Clear selection
        if (key === 'escape') {
            event.preventDefault();
            this.clearSelection();
        }
    }

    /**
     * Setup context menu handlers
     */
    setupContextMenuHandlers() {
        const contextMenuHandler = (event) => {
            const fileItem = event.target.closest('.file-item, .directory-item');
            if (fileItem) {
                this.handleContextMenu(event, fileItem);
            }
        };

        const container = this.fileRenderer.getContainer();
        if (container) {
            container.addEventListener('contextmenu', contextMenuHandler);
            this.eventListeners.set('contextmenu', contextMenuHandler);
        }
    }

    /**
     * Handle context menu
     */
    handleContextMenu(event, fileItem) {
        event.preventDefault();
        
        const fileName = fileItem.dataset.name;
        const index = parseInt(fileItem.dataset.index) || 0;
        const item = this.getFileItemByIndex(index);
        
        if (!item) {
            return;
        }

        // Show context menu (implementation would show actual menu)
        console.log('Context menu for:', item.name);
        
        this.triggerFileEvent('contextMenu', {
            item,
            fileName,
            index,
            x: event.clientX,
            y: event.clientY
        });
    }

    /**
     * Select all files
     */
    selectAllFiles() {
        const fileData = this.fileManager.getFileData();
        const allFileNames = fileData.map(file => file.name);
        
        // Update manager
        this.fileManager.selectedItems = allFileNames;
        
        // Update UI
        this.updateAllFileSelections(true);
        
        this.triggerFileEvent('selectAll', { selectedItems: allFileNames });
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.fileManager.clearSelection();
        this.updateAllFileSelections(false);
        
        this.triggerFileEvent('selectionCleared');
    }

    /**
     * Delete selected files
     */
    deleteSelectedFiles() {
        const selectedItems = this.fileManager.getSelectedItems();
        
        if (selectedItems.length === 0) {
            console.warn('No files selected for deletion');
            return;
        }

        // Confirm deletion (in real implementation)
        if (confirm(`Delete ${selectedItems.length} selected file(s)?`)) {
            console.log('Deleting files:', selectedItems);
            
            this.triggerFileEvent('filesDeleted', { 
                fileNames: selectedItems 
            });
            
            this.clearSelection();
        }
    }

    /**
     * Open selected file
     */
    openSelectedFile() {
        const selectedItems = this.fileManager.getSelectedItems();
        
        if (selectedItems.length === 1) {
            const item = this.fileManager.getFileByName(selectedItems[0]);
            if (item) {
                this.handleFileOpen(item);
            }
        } else if (selectedItems.length > 1) {
            console.warn('Cannot open multiple files at once');
        } else {
            console.warn('No file selected');
        }
    }

    /**
     * Update all file selections in UI
     */
    updateAllFileSelections(isSelected) {
        const container = this.fileRenderer.getContainer();
        if (!container) {
            return;
        }

        const fileItems = container.querySelectorAll('.file-item, .directory-item');
        fileItems.forEach(item => {
            if (isSelected) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * Get file item by index
     */
    getFileItemByIndex(index) {
        const fileData = this.fileManager.getFileData();
        return fileData[index] || null;
    }

    /**
     * Check if file browser is active
     */
    isFileBrowserActive() {
        const container = this.fileRenderer.getContainer();
        return container && container.offsetParent !== null;
    }

    /**
     * Trigger custom file event
     */
    triggerFileEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    /**
     * Add custom event listener
     */
    addEventListener(eventName, handler) {
        document.addEventListener(eventName, handler);
    }

    /**
     * Remove custom event listener
     */
    removeEventListener(eventName, handler) {
        document.removeEventListener(eventName, handler);
    }

    /**
     * Destroy event handlers and clean up
     */
    destroy() {
        // Remove all event listeners
        this.eventListeners.forEach((handler, event) => {
            const element = event === 'keydown' || event === 'dblclick' ? document : this.fileRenderer.getContainer();
            if (element) {
                element.removeEventListener(event, handler);
            }
        });

        this.eventListeners.clear();
        this.isInitialized = false;
        
        console.log('File event handlers destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileEventHandler;
}

// Global assignment for browser compatibility
window.FileEventHandler = window.FileEventHandler || FileEventHandler;
