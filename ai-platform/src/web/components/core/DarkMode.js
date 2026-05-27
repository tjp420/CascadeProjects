/**
 * Dark Mode - Complete dark mode implementation with system preference detection
 */

export class DarkMode {
    constructor() {
        this.isDarkMode = false;
        this.systemPreference = null;
        this.storageKey = 'dashboard-dark-mode';
        this.init();
    }

    init() {
        console.log('🌙 Dark Mode initialized');
        this.detectSystemPreference();
        this.loadUserPreference();
        this.applyTheme();
        this.setupEventListeners();
        this.createThemeToggle();
    }

    detectSystemPreference() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.systemPreference = 'dark';
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            this.systemPreference = 'light';
        } else {
            this.systemPreference = 'light';
        }

        // Listen for system preference changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                this.systemPreference = e.matches ? 'dark' : 'light';
                this.onSystemPreferenceChange();
            });
        }
    }

    loadUserPreference() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved !== null) {
            this.isDarkMode = saved === 'true';
        } else {
            // Use system preference if no user preference saved
            this.isDarkMode = this.systemPreference === 'dark';
        }
    }

    saveUserPreference() {
        localStorage.setItem(this.storageKey, this.isDarkMode.toString());
    }

    setupEventListeners() {
        // Listen for custom theme change events
        document.addEventListener('themeChange', (event) => {
            if (event.detail.theme === 'dark') {
                this.enable();
            } else if (event.detail.theme === 'light') {
                this.disable();
            }
        });

        // Listen for OS-level theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem(this.storageKey)) {
                    // Only auto-switch if user hasn't set explicit preference
                    this.isDarkMode = e.matches;
                    this.applyTheme();
                }
            });
        }
    }

    createThemeToggle() {
        // Create enhanced theme toggle button
        const existingToggle = document.getElementById('dark-mode-toggle');
        if (existingToggle) {
            // Enhance existing toggle
            this.enhanceThemeToggle(existingToggle);
        } else {
            // Create new toggle if it doesn't exist
            this.createNewThemeToggle();
        }
    }

    enhanceThemeToggle(existingToggle) {
        existingToggle.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggle();
        });

        this.updateToggleIcon(existingToggle);
    }

    createNewThemeToggle() {
        const toggle = document.createElement('button');
        toggle.id = 'dark-mode-toggle';
        toggle.className = 'btn-secondary theme-toggle';
        toggle.setAttribute('title', 'Toggle Dark Mode (Ctrl+D)');
        toggle.textContent = this.isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode' /* Replaced innerHTML with textContent for safety */

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggle();
        });

        // Add to header controls
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            headerControls.appendChild(toggle);
        }

        this.updateToggleIcon(toggle);
    }

    updateToggleIcon(toggle) {
        if (toggle) {
            toggle.textContent = this.isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode' /* Replaced innerHTML with textContent for safety */
            toggle.setAttribute('title', this.isDarkMode ? 'Switch to Light Mode (Ctrl+D)' : 'Switch to Dark Mode (Ctrl+D)');
        }
    }

    toggle() {
        this.isDarkMode = !this.isDarkMode;
        this.saveUserPreference();
        this.applyTheme();
        this.showNotification(this.isDarkMode ? 'Dark mode enabled' : 'Light mode enabled', 'info');
    }

    enable() {
        this.isDarkMode = true;
        this.saveUserPreference();
        this.applyTheme();
    }

    disable() {
        this.isDarkMode = false;
        this.saveUserPreference();
        this.applyTheme();
    }

    applyTheme() {
        const root = document.documentElement;

        if (this.isDarkMode) {
            root.classList.add('dark-mode');
            root.classList.remove('light-mode');
            this.applyDarkModeStyles();
        } else {
            root.classList.add('light-mode');
            root.classList.remove('dark-mode');
            this.applyLightModeStyles();
        }

        this.updateToggleIcon(document.getElementById('dark-mode-toggle'));
        this.updateComponentThemes();

        // Emit theme change event
        document.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme: this.isDarkMode ? 'dark' : 'light' }
        }));
    }

    applyDarkModeStyles() {
        const style = document.getElementById('dark-mode-styles') || document.createElement('style');
        style.id = 'dark-mode-styles';
        style.textContent = `
            /* Dark Mode Base Styles */
            :root.dark-mode {
                --bg-primary: #1a1a1a;
                --bg-secondary: #2d2d2d;
                --bg-tertiary: #404040;
                --text-primary: #e4e4e4;
                --text-secondary: #b0b0b0;
                --text-tertiary: #808080;
                --border-primary: #404040;
                --border-secondary: #555555;
                --accent-primary: #4a9eff;
                --accent-secondary: #66b3ff;
                --success: #28a745;
                --warning: #ffc107;
                --error: #dc3545;
                --info: #17a2b8;
            }

            /* Dark Mode Component Styles */
            :root.dark-mode body {
                background-color: var(--bg-primary);
                color: var(--text-primary);
            }

            :root.dark-mode .dashboard {
                background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
            }

            :root.dark-mode .header {
                background: var(--bg-secondary);
                border-bottom: 1px solid var(--border-primary);
            }

            :root.dark-mode .header h1 {
                color: var(--text-primary);
            }

            :root.dark-mode .header p {
                color: var(--text-secondary);
            }

            :root.dark-mode .btn-primary {
                background: var(--accent-primary);
                border-color: var(--accent-primary);
                color: white;
            }

            :root.dark-mode .btn-primary:hover {
                background: var(--accent-secondary);
                border-color: var(--accent-secondary);
            }

            :root.dark-mode .btn-secondary {
                background: var(--bg-tertiary);
                border-color: var(--border-primary);
                color: var(--text-primary);
            }

            :root.dark-mode .btn-secondary:hover {
                background: var(--bg-secondary);
                border-color: var(--border-secondary);
            }

            :root.dark-mode .nav-btn {
                background: var(--bg-tertiary);
                border-color: var(--border-primary);
                color: var(--text-primary);
            }

            :root.dark-mode .nav-btn:hover {
                background: var(--bg-secondary);
                border-color: var(--border-secondary);
            }

            :root.dark-mode .nav-btn.active {
                background: var(--accent-primary);
                border-color: var(--accent-primary);
                color: white;
            }

            :root.dark-mode .tab-content {
                background: var(--bg-secondary);
                border: 1px solid var(--border-primary);
            }

            :root.dark-mode .metric-card {
                background: var(--bg-tertiary);
                border-color: var(--border-primary);
            }

            :root.dark-mode .metric-value {
                color: var(--text-primary);
            }

            :root.dark-mode .metric-label {
                color: var(--text-secondary);
            }

            :root.dark-mode .analysis-results {
                background: var(--bg-secondary);
                border-color: var(--border-primary);
            }

            :root.dark-mode .results-header {
                border-bottom-color: var(--border-primary);
            }

            :root.dark-mode .analysis-meta {
                color: var(--text-secondary);
            }

            :root.dark-mode .file-types,
            :root.dark-mode .project-analysis,
            :root.dark-mode .insights {
                background: var(--bg-tertiary);
                border-color: var(--border-primary);
            }

            :root.dark-mode .file-type-item,
            :root.dark-mode .insight-item {
                border-bottom-color: var(--border-primary);
            }

            :root.dark-mode .analytics-tab {
                background: var(--bg-tertiary);
                border-color: var(--border-primary);
                color: var(--text-primary);
            }

            :root.dark-mode .analytics-tab:hover {
                background: var(--bg-secondary);
                border-color: var(--border-secondary);
            }

            :root.dark-mode .analytics-tab.active {
                background: var(--accent-primary);
                border-color: var(--accent-primary);
                color: white;
            }

            :root.dark-mode .insight-card {
                background: var(--bg-tertiary);
                border-color: var(--border-primary);
            }

            :root.dark-mode .insight-card:hover {
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }

            :root.dark-mode .insight-text {
                color: var(--text-primary);
            }

            :root.dark-mode .loading-placeholder {
                color: var(--text-secondary);
            }

            :root.dark-mode .error-message {
                background: #721c24;
                color: #f8d7da;
                border-color: #f5c6cb;
            }

            :root.dark-mode .status-indicator {
                color: var(--success);
            }

            :root.dark-mode .status-dot {
                background: var(--success);
            }

            /* Chart.js Dark Mode */
            :root.dark-mode .chart-container {
                background: var(--bg-secondary);
                border-color: var(--border-primary);
            }

            /* Modal Dark Mode */
            :root.dark-mode .modal,
            :root.dark-mode .popup,
            :root.dark-mode .dialog {
                background: var(--bg-secondary);
                border-color: var(--border-primary);
                color: var(--text-primary);
            }

            /* Form Elements */
            :root.dark-mode input,
            :root.dark-mode select,
            :root.dark-mode textarea {
                background: var(--bg-tertiary);
                border-color: var(--border-primary);
                color: var(--text-primary);
            }

            :root.dark-mode input:focus,
            :root.dark-mode select:focus,
            :root.dark-mode textarea:focus {
                border-color: var(--accent-primary);
                box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
            }

            /* Scrollbar Dark Mode - using standard scrollbar-width property */
            :root.dark-mode {
                scrollbar-width: thin;
                scrollbar-color: var(--border-secondary) var(--bg-tertiary);
            }

            /* Code Blocks */
            :root.dark-mode pre,
            :root.dark-mode code {
                background: var(--bg-tertiary);
                border-color: var(--border-primary);
                color: var(--text-primary);
            }

            /* Tables */
            :root.dark-mode table {
                border-color: var(--border-primary);
            }

            :root.dark-mode th,
            :root.dark-mode td {
                border-color: var(--border-primary);
            }

            :root.dark-mode th {
                background: var(--bg-tertiary);
            }

            /* Tooltips */
            :root.dark-mode .tooltip {
                background: var(--bg-tertiary);
                border-color: var(--border-primary);
                color: var(--text-primary);
            }
        `;

        if (!document.getElementById('dark-mode-styles')) {
            document.head.appendChild(style);
        }
    }

    applyLightModeStyles() {
        const style = document.getElementById('dark-mode-styles');
        if (style) {
            style.remove();
        }
    }

    updateComponentThemes() {
        // Update Chart.js charts if they exist
        if (window.Chart && window.Chart.instances) {
            Object.values(window.Chart.instances).forEach(chart => {
                if (chart.options.plugins && chart.options.plugins.legend) {
                    chart.options.plugins.legend.labels.color = this.isDarkMode ? '#e4e4e4' : '#333';
                }
                if (chart.options.scales) {
                    Object.values(chart.options.scales).forEach(scale => {
                        if (scale.ticks) {
                            scale.ticks.color = this.isDarkMode ? '#e4e4e4' : '#333';
                        }
                        if (scale.grid) {
                            scale.grid.color = this.isDarkMode ? '#404040' : '#e5e7eb';
                        }
                    });
                }
                chart.update();
            });
        }

        // Update any custom components that need theme updates
        this.updateCustomComponents();
    }

    updateCustomComponents() {
        // Update interactive components
        const components = document.querySelectorAll('[data-theme-aware]');
        components.forEach(component => {
            if (this.isDarkMode) {
                component.classList.add('dark-theme');
                component.classList.remove('light-theme');
            } else {
                component.classList.add('light-theme');
                component.classList.remove('dark-theme');
            }
        });
    }

    onSystemPreferenceChange() {
        // Only auto-switch if user hasn't set explicit preference
        if (!localStorage.getItem(this.storageKey)) {
            this.isDarkMode = this.systemPreference === 'dark';
            this.applyTheme();
            this.showNotification(`System theme changed to ${this.systemPreference} mode`, 'info');
        }
    }

    showNotification(message, type = 'info', duration = 2000) {
        const notification = document.createElement('div');
        notification.className = 'dark-mode-notification';
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

        // Set color based on type and theme
        if (this.isDarkMode) {
            if (type === 'success') {
                notification.style.background = '#1e3a1e';
                notification.style.color = '#4caf50';
                notification.style.border = '1px solid #2e4a2e';
            } else if (type === 'error') {
                notification.style.background = '#3a1e1e';
                notification.style.color = '#f44336';
                notification.style.border = '1px solid #4a2e2e';
            } else {
                notification.style.background = '#1e2a3a';
                notification.style.color = '#64b5f6';
                notification.style.border = '1px solid #2e3a4a';
            }
        } else {
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
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    // Get current theme
    getCurrentTheme() {
        return this.isDarkMode ? 'dark' : 'light';
    }

    // Get system preference
    getSystemPreference() {
        return this.systemPreference;
    }

    // Check if dark mode is active
    isActive() {
        return this.isDarkMode;
    }

    // Reset to system preference
    resetToSystemPreference() {
        localStorage.removeItem(this.storageKey);
        this.isDarkMode = this.systemPreference === 'dark';
        this.applyTheme();
        this.showNotification('Reset to system preference', 'info');
    }

    // Export theme settings
    exportThemeSettings() {
        const settings = {
            currentTheme: this.getCurrentTheme(),
            systemPreference: this.getSystemPreference(),
            userPreference: localStorage.getItem(this.storageKey),
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'theme-settings.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Theme settings exported', 'success');
    }

    // Import theme settings
    importThemeSettings(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);

                if (settings.userPreference !== null) {
                    localStorage.setItem(this.storageKey, settings.userPreference);
                    this.loadUserPreference();
                    this.applyTheme();
                    this.showNotification('Theme settings imported', 'success');
                } else {
                    this.showNotification('Invalid theme settings file', 'error');
                }
            } catch (error) {
                this.showNotification('Failed to import theme settings', 'error');
            }
        };
        reader.readAsText(file);
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
    
    .dark-mode-notification {
        animation: slideIn 0.3s ease-out;
    }
`;
document.head.appendChild(animationStyle);

// Export for use in dashboard
window.DarkMode = DarkMode;
