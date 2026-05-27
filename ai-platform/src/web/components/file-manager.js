/**
 * File Manager - Core file operations and data management
 * Extracted from FileBrowser for single responsibility principle
 */

class FileManager {
    constructor() {
        this.currentPath = '.';
        this.fileData = [];
        this.selectedItems = [];
    }

    /**
     * Initialize file manager with default data
     */
    init() {
        console.log('Initializing File Manager...');
        this.loadFileStructure();
    }

    /**
     * Load file structure data
     */
    loadFileStructure() {
        console.log('Loading file structure...');
        this.fileData = this.getDefaultFileStructure();
        console.log('File structure loaded:', this.fileData.length, 'items');
    }

    /**
     * Get default file structure for fallback
     */
    getDefaultFileStructure() {
        return [
            { name: 'README.md', type: 'file', size: '4.2KB', modified: '2026-05-14' },
            { name: 'package.json', type: 'file', size: '2.1KB', modified: '2026-05-15' },
            { name: 'src', type: 'directory', size: '1.2MB', items: 45 }
        ];
    }

    /**
     * Set file data from external source
     */
    setFileData(fileData) {
        this.fileData = fileData || [];
    }

    /**
     * Get current file data
     */
    getFileData() {
        return this.fileData;
    }

    /**
     * Get file by name
     */
    getFileByName(name) {
        return this.fileData.find(file => file.name === name);
    }

    /**
     * Select/deselect file item
     */
    selectItem(item) {
        const itemName = item.name;
        const index = this.selectedItems.indexOf(itemName);
        
        if (index > -1) {
            this.selectedItems.splice(index, 1);
        } else {
            this.selectedItems.push(itemName);
        }
        
        console.log('Selected items:', this.selectedItems);
        return this.selectedItems;
    }

    /**
     * Get selected items
     */
    getSelectedItems() {
        return this.selectedItems;
    }

    /**
     * Clear selected items
     */
    clearSelection() {
        this.selectedItems = [];
    }

    /**
     * Get file icon based on type and extension
     */
    getFileIcon(item) {
        if (item.type === 'directory') {
            return '📁';
        }
        
        const extension = this.getFileExtension(item.name);
        const icons = {
            'js': '🟨', 'py': '🐍', 'html': '🌐', 'css': '🎨',
            'json': '📋', 'md': '📝', 'yml': '📄', 'txt': '📄',
            'ts': '🔷', 'jsx': '⚛️', 'tsx': '⚛️', 'vue': '💚'
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
     * Format file item display text
     */
    formatFileItemText(item) {
        const icon = this.getFileIcon(item);
        const size = item.size || 'Unknown';
        const modified = item.modified ? '• ' + item.modified : '';
        
        return `${icon} ${item.name} ${size} ${modified}`;
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
     * Filter files by type
     */
    filterFilesByType(type) {
        return this.fileData.filter(file => file.type === type);
    }

    /**
     * Search files by name
     */
    searchFiles(query) {
        const searchTerm = query.toLowerCase();
        return this.fileData.filter(file => 
            file.name.toLowerCase().includes(searchTerm)
        );
    }

    /**
     * Sort files by property
     */
    sortFiles(property = 'name', direction = 'asc') {
        return this.fileData.sort((a, b) => {
            const aValue = a[property];
            const bValue = b[property];
            
            if (aValue < bValue) {
                return direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileManager;
}

// Global assignment for browser compatibility
window.FileManager = window.FileManager || FileManager;
