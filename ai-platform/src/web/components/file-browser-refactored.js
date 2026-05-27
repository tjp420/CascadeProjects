/**
 * Refactored FileBrowser - Orchestrates file management components
 * Implements dependency injection and single responsibility principle
 */

// Use conditional declaration to avoid redeclaration errors
if (typeof FileBrowser === 'undefined') {
    const FileBrowser = class {
        constructor(dependencies = {}) {
        // Dependency injection
            this.fileManager = dependencies.fileManager || new window.FileManager();
            this.fileRenderer = dependencies.fileRenderer || new window.FileRenderer();
            this.eventHandler = dependencies.eventHandler || new window.FileEventHandler(this.fileManager, this.fileRenderer);
        
            // Configuration
            this.config = dependencies.config || {
                containerId: 'file-tree',
                detailsContainerId: 'file-details-content',
                enableKeyboardShortcuts: true,
                enableContextMenu: true
            };

            // State
            this.isInitialized = false;
            this.errorHandler = dependencies.errorHandler || this.createDefaultErrorHandler();
        }

        /**
     * Initialize file browser with all components
     */
        async init() {
            if (this.isInitialized) {
                console.warn('FileBrowser already initialized');
                return;
            }

            try {
            // Initialize components in order
                await this.initializeComponents();
            
                // Setup component relationships
                this.setupComponentRelationships();
            
                // Load initial data
                await this.loadInitialData();
            
                // Render initial UI
                this.renderInitialUI();
            
                this.isInitialized = true;
                console.log('FileBrowser initialized successfully');
            
            } catch (error) {
                this.errorHandler.handleError('FileBrowser initialization failed', error);
            }
        }

        /**
     * Initialize all components
     */
        async initializeComponents() {
        // Initialize file manager
            this.fileManager.init();
        
            // Initialize renderer
            this.fileRenderer.init();
        
            // Initialize event handlers
            this.eventHandler.init();
        }

        /**
     * Setup relationships between components
     */
        setupComponentRelationships() {
        // Set up event listeners for component communication
            this.setupEventListeners();
        
            // Configure renderer with manager
            this.fileRenderer.setContainer(document.getElementById(this.config.containerId));
        }

        /**
     * Setup event listeners for component communication
     */
        setupEventListeners() {
        // Listen to file selection events
            this.eventHandler.addEventListener('selectionChanged', (event) => {
                this.handleSelectionChanged(event.detail);
            });

            // Listen to file preview events
            this.eventHandler.addEventListener('filePreviewed', (event) => {
                this.handleFilePreviewed(event.detail);
            });

            // Listen to file open events
            this.eventHandler.addEventListener('fileOpened', (event) => {
                this.handleFileOpened(event.detail);
            });

            // Listen to error events
            this.eventHandler.addEventListener('error', (event) => {
                this.errorHandler.handleError('FileBrowser error', event.detail);
            });
        }

        /**
     * Load initial data
     */
        async loadInitialData() {
            try {
            // Try to load real data if available
                if (window.realDataCollector) {
                    const realData = await window.realDataCollector.collectFileData();
                    this.fileManager.setFileData(realData);
                } else {
                // Use fallback data
                    console.log('Using fallback file data');
                }
            } catch (error) {
                console.warn('Failed to load real data, using fallback:', error);
            }
        }

        /**
     * Render initial UI
     */
        renderInitialUI() {
            const fileData = this.fileManager.getFileData();
        
            if (fileData.length === 0) {
                this.fileRenderer.showEmptyState('No files available');
            } else {
                this.fileRenderer.renderFileTree(fileData);
            }
        }

        /**
     * Handle selection changes
     */
        handleSelectionChanged(detail) {
            console.log('Selection changed:', detail);
        
            // Update UI if needed
            if (detail.selectedItems.length === 0) {
                this.clearFileDetails();
            }
        
            // Trigger custom event
            this.triggerBrowserEvent('selectionChanged', detail);
        }

        /**
     * Handle file preview
     */
        handleFilePreviewed(detail) {
            console.log('File previewed:', detail.item.name);
            this.triggerBrowserEvent('filePreviewed', detail);
        }

        /**
     * Handle file opened
     */
        handleFileOpened(detail) {
            console.log('File opened:', detail.item.name);
            this.triggerBrowserEvent('fileOpened', detail);
        }

        /**
     * Clear file details panel
     */
        clearFileDetails() {
            const detailsContainer = document.getElementById(this.config.detailsContainerId);
            if (detailsContainer) {
                detailsContainer.textContent = '' /* Replaced innerHTML with textContent for safety */
            }
        }

        /**
     * Refresh file browser
     */
        async refresh() {
            try {
                this.fileRenderer.showLoading();
            
                // Reload data
                await this.loadInitialData();
            
                // Re-render UI
                this.renderInitialUI();
            
                this.triggerBrowserEvent('refreshed', { timestamp: Date.now() });
            
            } catch (error) {
                this.fileRenderer.showErrorState('Failed to refresh file browser');
                this.errorHandler.handleError('Refresh failed', error);
            }
        }

        /**
     * Set file data from external source
     */
        setFileData(fileData) {
            this.fileManager.setFileData(fileData);
            this.renderInitialUI();
        }

        /**
     * Get current file data
     */
        getFileData() {
            return this.fileManager.getFileData();
        }

        /**
     * Get selected items
     */
        getSelectedItems() {
            return this.fileManager.getSelectedItems();
        }

        /**
     * Search files
     */
        searchFiles(query) {
            const results = this.fileManager.searchFiles(query);
            this.fileRenderer.renderFileTree(results);
            return results;
        }

        /**
     * Filter files by type
     */
        filterFilesByType(type) {
            const results = this.fileManager.filterFilesByType(type);
            this.fileRenderer.renderFileTree(results);
            return results;
        }

        /**
     * Sort files
     */
        sortFiles(property, direction = 'asc') {
            const sortedFiles = this.fileManager.sortFiles(property, direction);
            this.fileRenderer.renderFileTree(sortedFiles);
            return sortedFiles;
        }

        /**
     * Create default error handler
     */
        createDefaultErrorHandler() {
            return {
                handleError: (message, error) => {
                    console.error(message, error);
                
                    // Show error in UI if possible
                    if (this.fileRenderer) {
                        this.fileRenderer.showErrorState(message);
                    }
                }
            };
        }

        /**
     * Trigger custom browser events
     */
        triggerBrowserEvent(eventName, detail) {
            const event = new CustomEvent(`fileBrowser:${eventName}`, { detail });
            document.dispatchEvent(event);
        }

        /**
     * Add event listener
     */
        addEventListener(eventName, handler) {
            document.addEventListener(`fileBrowser:${eventName}`, handler);
        }

        /**
     * Remove event listener
     */
        removeEventListener(eventName, handler) {
            document.removeEventListener(`fileBrowser:${eventName}`, handler);
        }

        /**
     * Get browser configuration
     */
        getConfig() {
            return { ...this.config };
        }

        /**
     * Update configuration
     */
        updateConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
        }

        /**
     * Get component instances
     */
        getComponents() {
            return {
                fileManager: this.fileManager,
                fileRenderer: this.fileRenderer,
                eventHandler: this.eventHandler
            };
        }

        /**
     * Initialize file browser (legacy compatibility)
     */
        initSync() {
            if (!this.isInitialized) {
                return this.init();
            }
            return Promise.resolve(this);
        }

        /**
     * Check if browser is initialized
     */
        isReady() {
            return this.isInitialized;
        }

        /**
     * Destroy file browser and clean up components
     */
        destroy() {
        // Destroy components
            this.eventHandler.destroy();
            this.fileRenderer.destroy();
        
            // Clear references
            this.fileManager = null;
            this.fileRenderer = null;
            this.eventHandler = null;
        
            this.isInitialized = false;
        
            console.log('FileBrowser destroyed');
        }
    };

    // Factory function for creating FileBrowser with default dependencies
    function createFileBrowser(options = {}) {
        const dependencies = {
            fileManager: options.fileManager || new window.FileManager(),
            fileRenderer: options.fileRenderer || new window.FileRenderer(options.containerId),
            eventHandler: options.eventHandler || null,
            config: options.config || {},
            errorHandler: options.errorHandler || null
        };

        // Create event handler if not provided
        if (!dependencies.eventHandler) {
            dependencies.eventHandler = new window.FileEventHandler(
                dependencies.fileManager,
                dependencies.fileRenderer
            );
        }

        return new FileBrowser(dependencies);
    }
    
    // Global assignment
    window.FileBrowser = FileBrowser;
    window.createFileBrowser = createFileBrowser;
}
if (typeof FileBrowser !== 'undefined') {
    window.FileBrowser = window.FileBrowser || FileBrowser;
    window.createFileBrowser = window.createFileBrowser || createFileBrowser;
    console.log('FileBrowser class assigned to window');
} else {
    console.error('FileBrowser class not defined');
}
