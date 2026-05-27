/**
 * Keyboard Shortcuts - Enhanced navigation and accessibility
 */

export class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.enabled = true;
        this.helpVisible = false;
        this.init();
    }

    init() {
        console.log('⌨️ Keyboard Shortcuts initialized');
        this.setupDefaultShortcuts();
        this.attachEventListeners();
        this.createHelpModal();
    }

    setupDefaultShortcuts() {
        // Navigation shortcuts
        this.addShortcut('Ctrl+1', () => this.switchToTab('overview'), 'Overview Tab');
        this.addShortcut('Ctrl+2', () => this.switchToTab('analysis'), 'Analysis Tab');
        this.addShortcut('Ctrl+3', () => this.switchToTab('directory'), 'Directory Tab');
        this.addShortcut('Ctrl+4', () => this.switchToTab('exports'), 'Exports Tab');
        this.addShortcut('Ctrl+5', () => this.switchToTab('ai-analysis'), 'AI Analysis Tab');
        this.addShortcut('Ctrl+6', () => this.switchToTab('analytics'), 'Analytics Tab');
        this.addShortcut('Ctrl+7', () => this.switchToTab('predictions'), 'Predictions Tab');
        this.addShortcut('Ctrl+8', () => this.switchToTab('realtime'), 'Realtime Tab');
        this.addShortcut('Ctrl+9', () => this.switchToTab('scheduling'), 'Scheduling Tab');
        this.addShortcut('Ctrl+0', () => this.switchToTab('dir-analysis'), 'DIR Analysis Tab');

        // Action shortcuts
        this.addShortcut('Ctrl+A', () => this.analyzeCurrent(), 'Analyze Current');
        this.addShortcut('Ctrl+R', () => this.refreshData(), 'Refresh Data');
        this.addShortcut('Ctrl+E', () => this.exportReport(), 'Export Report');
        this.addShortcut('Ctrl+D', () => this.toggleDarkMode(), 'Toggle Dark Mode');
        this.addShortcut('Ctrl+F', () => this.focusSearch(), 'Focus Search');
        this.addShortcut('Ctrl+H', () => this.toggleHelp(), 'Toggle Help');

        // Advanced analytics shortcuts
        this.addShortcut('Ctrl+Shift+T', () => this.switchToAnalyticsTab('tree'), 'Directory Tree');
        this.addShortcut('Ctrl+Shift+G', () => this.switchToAnalyticsTab('graph'), 'Dependencies Graph');
        this.addShortcut('Ctrl+Shift+I', () => this.switchToAnalyticsTab('insights'), 'AI Insights');
        this.addShortcut('Ctrl+Shift+O', () => this.switchToAnalyticsTab('overview'), 'Analytics Overview');

        // Export shortcuts
        this.addShortcut('Ctrl+Shift+M', () => this.exportMarkdown(), 'Export Markdown');
        this.addShortcut('Ctrl+Shift+P', () => this.exportPDF(), 'Export PDF');
        this.addShortcut('Ctrl+Shift+X', () => this.exportExcel(), 'Export Excel');

        // Utility shortcuts
        this.addShortcut('Escape', () => this.closeModals(), 'Close Modals');
        this.addShortcut('Ctrl+/', () => this.toggleHelp(), 'Toggle Help');
        this.addShortcut('Ctrl+?', () => this.toggleHelp(), 'Toggle Help');
    }

    addShortcut(key, callback, description) {
        this.shortcuts.set(key, {
            callback: callback,
            description: description,
            key: key
        });
    }

    attachEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (!this.enabled) {
                return;
            }

            const key = this.getKeyString(event);
            const shortcut = this.shortcuts.get(key);

            if (shortcut) {
                event.preventDefault();
                event.stopPropagation();

                try {
                    shortcut.callback();
                    this.showShortcutFeedback(key);
                } catch (error) {
                    console.error(`❌ Shortcut error (${key}):`, error);
                }
            }
        });

        // Global keyboard shortcut hint
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.key === '?' && !event.shiftKey) {
                event.preventDefault();
                this.toggleHelp();
            }
        });
    }

    getKeyString(event) {
        let key = '';

        if (event.ctrlKey) {
            key += 'Ctrl+';
        }
        if (event.altKey) {
            key += 'Alt+';
        }
        if (event.shiftKey) {
            key += 'Shift+';
        }
        if (event.metaKey) {
            key += 'Meta+';
        }

        // Handle special keys
        if (event.key === ' ') {
            key += 'Space';
        } else if (event.key === 'Escape') {
            key += 'Escape';
        } else if (event.key === 'Enter') {
            key += 'Enter';
        } else if (event.key === 'Tab') {
            key += 'Tab';
        } else if (event.key === 'Backspace') {
            key += 'Backspace';
        } else if (event.key === 'Delete') {
            key += 'Delete';
        } else if (event.key === 'ArrowUp') {
            key += 'ArrowUp';
        } else if (event.key === 'ArrowDown') {
            key += 'ArrowDown';
        } else if (event.key === 'ArrowLeft') {
            key += 'ArrowLeft';
        } else if (event.key === 'ArrowRight') {
            key += 'ArrowRight';
        } else if (event.key.length === 1) {
            key += event.key.toUpperCase();
        } else {
            key += event.key;
        }

        return key;
    }

    switchToTab(tabName) {
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.click();
            this.showNotification(`Switched to ${tabName} tab`, 'info');
        }
    }

    switchToAnalyticsTab(tabName) {
        // First switch to DIR Analysis tab
        this.switchToTab('dir-analysis');

        // Then switch to the specific analytics tab
        setTimeout(() => {
            const analyticsTab = document.querySelector(`[data-tab="${tabName}"]`);
            if (analyticsTab) {
                analyticsTab.click();
                this.showNotification(`Switched to ${tabName} analytics`, 'info');
            }
        }, 100);
    }

    analyzeCurrent() {
        const analyzeButton = document.querySelector('button[onclick*="analyzeCurrentDirectory"]');
        if (analyzeButton) {
            analyzeButton.click();
            this.showNotification('Analysis started', 'success');
        }
    }

    refreshData() {
        const refreshButton = document.querySelector('button[onclick*="refresh"]');
        if (refreshButton) {
            refreshButton.click();
            this.showNotification('Data refreshed', 'success');
        }
    }

    exportReport() {
        const exportButton = document.querySelector('button[onclick*="downloadReport"]');
        if (exportButton) {
            exportButton.click();
            this.showNotification('Export dialog opened', 'info');
        }
    }

    exportMarkdown() {
        if (window.dashboard && window.dashboard.ai && window.lastAnalysis) {
            window.dashboard.ai.downloadReport(window.lastAnalysis.data, window.lastAnalysis.analysis, 'markdown');
            this.showNotification('Markdown report exported', 'success');
        }
    }

    exportPDF() {
        if (window.dashboard && window.dashboard.ai && window.lastAnalysis) {
            window.dashboard.ai.downloadReport(window.lastAnalysis.data, window.lastAnalysis.analysis, 'pdf');
            this.showNotification('PDF report exported', 'success');
        }
    }

    exportExcel() {
        if (window.dashboard && window.dashboard.ai && window.lastAnalysis) {
            window.dashboard.ai.downloadReport(window.lastAnalysis.data, window.lastAnalysis.analysis, 'excel');
            this.showNotification('Excel report exported', 'success');
        }
    }

    toggleDarkMode() {
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.click();
            this.showNotification('Dark mode toggled', 'info');
        }
    }

    focusSearch() {
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]');
        if (searchInput) {
            searchInput.focus();
            this.showNotification('Search focused', 'info');
        }
    }

    closeModals() {
        // Close any open modals
        const modals = document.querySelectorAll('.modal, .popup, .dialog');
        modals.forEach(modal => {
            if (modal.style.display !== 'none') {
                modal.style.display = 'none';
            }
        });

        // Close help modal if open
        if (this.helpVisible) {
            this.toggleHelp();
        }

        this.showNotification('Modals closed', 'info');
    }

    createHelpModal() {
        const modal = document.createElement('div');
        modal.id = 'keyboard-shortcuts-help';
        modal.className = 'keyboard-shortcuts-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            z-index: 10000;
            align-items: center;
            justify-content: center;
        `;

        const content = document.createElement('div');
        content.className = 'help-content';
        content.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            position: relative;
        `;

        content.textContent = `
            <button class="close-help" style="position: absolute /* Replaced innerHTML with textContent for safety */ top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
            <h2 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 24px;">⌨️ Keyboard Shortcuts</h2>
            
            <div class="shortcuts-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                <div class="shortcut-category">
                    <h3 style="color: #007bff; margin: 0 0 15px 0;">📊 Navigation</h3>
                    <div class="shortcut-list">
                        <div class="shortcut-item">
                            <kbd>Ctrl+1</kbd> - Overview Tab
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+2</kbd> - Analysis Tab
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+3</kbd> - Directory Tab
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+4</kbd> - Exports Tab
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+5</kbd> - AI Analysis Tab
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+6</kbd> - Analytics Tab
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+7</kbd> - Predictions Tab
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+8</kbd> - Realtime Tab
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+9</kbd> - Scheduling Tab
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+0</kbd> - DIR Analysis Tab
                        </div>
                    </div>
                </div>
                
                <div class="shortcut-category">
                    <h3 style="color: #007bff; margin: 0 0 15px 0;">🎯 Actions</h3>
                    <div class="shortcut-list">
                        <div class="shortcut-item">
                            <kbd>Ctrl+A</kbd> - Analyze Current
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+R</kbd> - Refresh Data
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+E</kbd> - Export Report
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+D</kbd> - Toggle Dark Mode
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+F</kbd> - Focus Search
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+H</kbd> - Toggle Help
                        </div>
                        <div class="shortcut-item">
                            <kbd>Escape</kbd> - Close Modals
                        </div>
                    </div>
                </div>
                
                <div class="shortcut-category">
                    <h3 style="color: #007bff; margin: 0 0 15px 0;">📈 Advanced Analytics</h3>
                    <div class="shortcut-list">
                        <div class="shortcut-item">
                            <kbd>Ctrl+Shift+T</kbd> - Directory Tree
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+Shift+G</kbd> - Dependencies Graph
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+Shift+I</kbd> - AI Insights
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+Shift+O</kbd> - Analytics Overview
                        </div>
                    </div>
                </div>
                
                <div class="shortcut-category">
                    <h3 style="color: #007bff; margin: 0 0 15px 0;">📤 Export Formats</h3>
                    <div class="shortcut-list">
                        <div class="shortcut-item">
                            <kbd>Ctrl+Shift+M</kbd> - Export Markdown
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+Shift+P</kbd> - Export PDF
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+Shift+X</kbd> - Export Excel
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 14px;">
                <p style="margin: 0;">Press <kbd>Escape</kbd> or <kbd>Ctrl+?</kbd> to close this help</p>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .keyboard-shortcuts-modal .shortcut-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .keyboard-shortcuts-modal .shortcut-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .keyboard-shortcuts-modal .shortcut-item:last-child {
                border-bottom: none;
            }
            
            .keyboard-shortcuts-modal kbd {
                background: #f8f9fa;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                padding: 4px 8px;
                font-family: monospace;
                font-size: 12px;
                color: #2c3e50;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .keyboard-shortcuts-modal .close-help:hover {
                color: #333;
                background: #f8f9fa;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
            
            .keyboard-shortcuts-modal.show {
                animation: fadeIn 0.2s ease-out;
            }
        `;

        modal.appendChild(content);
        document.head.appendChild(style);
        document.body.appendChild(modal);

        // Close button handler
        modal.querySelector('.close-help').addEventListener('click', () => {
            this.toggleHelp();
        });

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.toggleHelp();
            }
        });
    }

    toggleHelp() {
        const modal = document.getElementById('keyboard-shortcuts-help');
        if (modal) {
            this.helpVisible = !this.helpVisible;
            modal.style.display = this.helpVisible ? 'flex' : 'none';

            if (this.helpVisible) {
                modal.classList.add('show');
                this.showNotification('Keyboard shortcuts help opened', 'info');
            } else {
                modal.classList.remove('show');
                this.showNotification('Keyboard shortcuts help closed', 'info');
            }
        }
    }

    showShortcutFeedback(key) {
        const shortcut = this.shortcuts.get(key);
        if (shortcut) {
            this.showNotification(`Shortcut: ${shortcut.description}`, 'success', 1000);
        }
    }

    showNotification(message, type = 'info', duration = 2000) {
        const notification = document.createElement('div');
        notification.className = 'keyboard-shortcut-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 14px;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
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
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    enable() {
        this.enabled = true;
        this.showNotification('Keyboard shortcuts enabled', 'success');
    }

    disable() {
        this.enabled = false;
        this.showNotification('Keyboard shortcuts disabled', 'info');
    }

    getShortcutList() {
        return Array.from(this.shortcuts.entries()).map(([key, shortcut]) => ({
            key: key,
            description: shortcut.description
        }));
    }

    // Add custom shortcut
    addCustomShortcut(key, callback, description) {
        this.addShortcut(key, callback, description);
        this.showNotification(`Custom shortcut added: ${key}`, 'success');
    }

    // Remove shortcut
    removeShortcut(key) {
        if (this.shortcuts.has(key)) {
            this.shortcuts.delete(key);
            this.showNotification(`Shortcut removed: ${key}`, 'info');
        }
    }

    // Export shortcuts
    exportShortcuts() {
        const shortcuts = this.getShortcutList();
        const csv = 'Key,Description\n' + shortcuts.map(s => `"${s.key}","${s.description}"`).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'keyboard-shortcuts.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Keyboard shortcuts exported', 'success');
    }
}

// Add animations
const animationStyle = document.createElement('style');
animationStyle.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .keyboard-shortcut-notification {
        animation: slideIn 0.3s ease-out;
    }
`;
document.head.appendChild(animationStyle);

// Export for use in dashboard
window.KeyboardShortcuts = KeyboardShortcuts;
