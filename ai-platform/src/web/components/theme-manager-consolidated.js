/**
 * Consolidated Theme Manager - Merges theme-manager.js and theme-system.js
 * Single responsibility: Handle all theme-related functionality
 */

export class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'light';
        this.availableThemes = ['light', 'dark', 'auto'];
        this.themeVariables = new Map();
        this.transitionDuration = 300;
        this.observers = new Set();
    }

    init() {
        this.setupThemeVariables();
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
        this.setupSystemThemeListener();
        console.log(`Theme manager initialized with theme: ${this.currentTheme}`);
    }

    setupThemeVariables() {
        // Define theme color schemes
        this.themeVariables.set('light', {
            '--bg-primary': '#ffffff',
            '--bg-secondary': '#f8fafc',
            '--bg-tertiary': '#e9ecef',
            '--text-primary': '#212529',
            '--text-secondary': '#6c757d',
            '--accent-color': '#6366f1',
            '--accent-hover': '#4f46e5',
            '--border-color': '#e5e7eb',
            '--shadow-color': 'rgba(0, 0, 0, 0.1)',
            '--primary': '#6366f1',
            '--primary-dark': '#4f46e5',
            '--secondary': '#8b5cf6',
            '--success': '#10b981',
            '--warning': '#f59e0b',
            '--danger': '#ef4444',
            '--dark': '#1f2937',
            '--light': '#f8fafc',
            '--white': '#ffffff',
            '--gray': '#6b7280'
        });

        this.themeVariables.set('dark', {
            '--bg-primary': '#1a1d23',
            '--bg-secondary': '#2d3139',
            '--bg-tertiary': '#404654',
            '--text-primary': '#e9ecef',
            '--text-secondary': '#adb5bd',
            '--accent-color': '#4dabf7',
            '--accent-hover': '#339af0',
            '--border-color': '#495057',
            '--shadow-color': 'rgba(0, 0, 0, 0.3)',
            '--primary': '#4dabf7',
            '--primary-dark': '#339af0',
            '--secondary': '#9775fa',
            '--success': '#51cf66',
            '--warning': '#ffd43b',
            '--danger': '#ff6b6b',
            '--dark': '#1a1d23',
            '--light': '#2d3139',
            '--white': '#e9ecef',
            '--gray': '#adb5bd'
        });
    }

    setupEventListeners() {
        // Handle toggle button if it exists in the header
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => this.toggleTheme());
            this.updateToggleButton();
        }
        
        // Add keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    getThemeIcon() {
        return this.currentTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        if (!this.availableThemes.includes(theme)) {
            console.warn(`Theme "${theme}" is not available`);
            return;
        }

        this.currentTheme = theme;
        this.applyTheme(theme);
        this.storeTheme(theme);
        this.updateToggleButton();
        this.notifyObservers(theme);
        
        console.log(`Theme changed to: ${theme}`);
    }

    applyTheme(theme) {
        const root = document.documentElement;
        const variables = this.themeVariables.get(theme);
        
        if (variables) {
            // Apply CSS variables with smooth transition
            root.style.transition = `all ${this.transitionDuration}ms ease`;
            
            Object.entries(variables).forEach(([key, value]) => {
                root.style.setProperty(key, value);
            });
            
            // Update body class for CSS-based dark mode
            if (theme === 'dark') {
                document.body.classList.add('dark-mode');
                document.body.setAttribute('data-theme', 'dark');
            } else {
                document.body.classList.remove('dark-mode');
                document.body.setAttribute('data-theme', 'light');
            }
        }
    }

    updateToggleButton() {
        const toggle = document.getElementById('dark-mode-toggle') || document.getElementById('theme-toggle');
        if (toggle) {
            toggle.textContent = this.getThemeIcon() /* Replaced innerHTML with textContent for safety */
            toggle.title = `Switch to ${this.currentTheme === 'light' ? 'dark' : 'light'} mode`;
        }
    }

    setupSystemThemeListener() {
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (this.getStoredTheme() === 'auto') {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    getStoredTheme() {
        try {
            return localStorage.getItem('dashboard_theme') || 'light';
        } catch (error) {
            console.warn('Failed to get stored theme:', error);
            return 'light';
        }
    }

    storeTheme(theme) {
        try {
            localStorage.setItem('dashboard_theme', theme);
        } catch (error) {
            console.warn('Failed to store theme:', error);
        }
    }

    // Observer pattern for theme changes
    subscribe(callback) {
        this.observers.add(callback);
        return () => this.observers.delete(callback);
    }

    notifyObservers(theme) {
        this.observers.forEach(callback => {
            try {
                callback(theme);
            } catch (error) {
                console.error('Error in theme observer:', error);
            }
        });
    }

    // Public API
    getCurrentTheme() {
        return this.currentTheme;
    }

    getAvailableThemes() {
        return [...this.availableThemes];
    }

    addCustomTheme(name, variables) {
        this.themeVariables.set(name, variables);
        this.availableThemes.push(name);
    }

    removeTheme(name) {
        if (name === 'light' || name === 'dark') {
            console.warn('Cannot remove built-in themes');
            return false;
        }
        
        const index = this.availableThemes.indexOf(name);
        if (index > -1) {
            this.availableThemes.splice(index, 1);
            this.themeVariables.delete(name);
            return true;
        }
        return false;
    }

    destroy() {
        this.observers.clear();
    }
}
