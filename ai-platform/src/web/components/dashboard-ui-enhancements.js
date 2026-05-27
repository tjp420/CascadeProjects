/**
 * Enhanced Dashboard UI Components
 * 
 * Modern UI components with improved UX, accessibility, and responsiveness
 */

import { EventManagerEnhanced } from './core/EventManagerEnhanced.js';

export class DashboardUIEnhancer {
    constructor() {
        this.eventManager = new EventManagerEnhanced();
        this.theme = this.detectTheme();
        this.init();
    }

    init() {
        this.setupThemeToggle();
        this.setupResponsiveNavigation();
        this.setupSmoothScrolling();
        this.setupLoadingStates();
        this.setupTooltips();
        this.setupModalEnhancements();
        this.setupFormEnhancements();
        this.setupAccessibilityFeatures();
        console.log('✨ Dashboard UI Enhancer initialized');
    }

    /**
     * Detect user's preferred color scheme
     */
    detectTheme() {
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    }

    /**
     * Setup theme toggle functionality
     */
    setupThemeToggle() {
        const themeToggle = document.querySelector('[data-theme-toggle]');
        if (!themeToggle) {
            return;
        }

        const updateTheme = (isDark) => {
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            this.theme = isDark ? 'dark' : 'light';
            localStorage.setItem('dashboard-theme', this.theme);
            this.updateThemeIcon(isDark);
        };

        // Check saved theme or system preference
        const savedTheme = localStorage.getItem('dashboard-theme');
        if (savedTheme) {
            updateTheme(savedTheme === 'dark');
        } else {
            updateTheme(this.detectTheme() === 'dark');
        }

        // Toggle theme on click
        this.eventManager.addListener(themeToggle, 'click', () => {
            updateTheme(this.theme === 'light');
        });

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('dashboard-theme')) {
                    updateTheme(e.matches);
                }
            });
        }
    }

    /**
     * Update theme toggle icon
     */
    updateThemeIcon(isDark) {
        const icon = document.querySelector('[data-theme-toggle] i, [data-theme-toggle] svg');
        if (!icon) {
            return;
        }

        // You can implement icon switching logic here
        // For example, switching between sun and moon icons
    }

    /**
     * Setup responsive navigation
     */
    setupResponsiveNavigation() {
        const mobileToggle = document.querySelector('[data-mobile-toggle]');
        const mobileMenu = document.querySelector('[data-mobile-menu]');
        
        if (!mobileToggle || !mobileMenu) {
            return;
        }

        let isMenuOpen = false;

        const toggleMenu = () => {
            isMenuOpen = !isMenuOpen;
            mobileMenu.setAttribute('aria-expanded', isMenuOpen);
            mobileMenu.classList.toggle('open', isMenuOpen);
            mobileToggle.setAttribute('aria-expanded', isMenuOpen);
            document.body.style.overflow = isMenuOpen ? 'hidden' : '';
        };

        this.eventManager.addListener(mobileToggle, 'click', toggleMenu);

        // Close menu when clicking outside
        this.eventManager.addListener(document, 'click', (e) => {
            if (isMenuOpen && !mobileMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
                toggleMenu();
            }
        });

        // Close menu on escape key
        this.eventManager.addListener(document, 'keydown', (e) => {
            if (e.key === 'Escape' && isMenuOpen) {
                toggleMenu();
            }
        });
    }

    /**
     * Setup smooth scrolling for anchor links
     */
    setupSmoothScrolling() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            this.eventManager.addListener(anchor, 'click', (e) => {
                const targetId = anchor.getAttribute('href');
                if (targetId === '#') {
                    return;
                }

                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    /**
     * Setup loading states for buttons and forms
     */
    setupLoadingStates() {
        // Button loading states
        document.querySelectorAll('[data-loading]').forEach(button => {
            const originalText = button.textContent;
            const loadingText = button.getAttribute('data-loading');

            this.eventManager.addListener(button, 'click', () => {
                button.disabled = true;
                button.textContent = `<span class="loading-enhanced"></span> ${loadingText}` /* Replaced innerHTML with textContent for safety */
                
                // Re-enable after 2 seconds (customize as needed)
                setTimeout(() => {
                    button.disabled = false;
                    button.textContent = originalText;
                }, 2000);
            });
        });
    }

    /**
     * Setup enhanced tooltips
     */
    setupTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            const tooltipText = element.getAttribute('data-tooltip');
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip-enhanced';
            tooltip.textContent = tooltipText;
            tooltip.setAttribute('role', 'tooltip');
            document.body.appendChild(tooltip);

            const showTooltip = (e) => {
                const rect = element.getBoundingClientRect();
                tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
                tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
                tooltip.classList.add('visible');
            };

            const hideTooltip = () => {
                tooltip.classList.remove('visible');
            };

            this.eventManager.addListener(element, 'mouseenter', showTooltip);
            this.eventManager.addListener(element, 'mouseleave', hideTooltip);
            this.eventManager.addListener(element, 'focus', showTooltip);
            this.eventManager.addListener(element, 'blur', hideTooltip);
        });
    }

    /**
     * Setup modal enhancements
     */
    setupModalEnhancements() {
        document.querySelectorAll('[data-modal]').forEach(trigger => {
            const modalId = trigger.getAttribute('data-modal');
            const modal = document.getElementById(modalId);
            
            if (!modal) {
                return;
            }

            const openModal = () => {
                modal.classList.add('open');
                modal.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';
                
                // Focus trap
                const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (focusableElements.length) {
                    focusableElements[0].focus();
                }
            };

            const closeModal = () => {
                modal.classList.remove('open');
                modal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
                trigger.focus();
            };

            this.eventManager.addListener(trigger, 'click', openModal);

            // Close on background click
            this.eventManager.addListener(modal, 'click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });

            // Close on escape key
            this.eventManager.addListener(document, 'keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('open')) {
                    closeModal();
                }
            });

            // Close button
            const closeBtn = modal.querySelector('[data-modal-close]');
            if (closeBtn) {
                this.eventManager.addListener(closeBtn, 'click', closeModal);
            }
        });
    }

    /**
     * Setup form enhancements
     */
    setupFormEnhancements() {
        // Floating labels
        document.querySelectorAll('.form-group-enhanced').forEach(group => {
            const input = group.querySelector('input, textarea, select');
            const label = group.querySelector('label');
            
            if (!input || !label) {
                return;
            }

            const updateLabel = () => {
                const hasValue = input.value.length > 0;
                label.classList.toggle('floating', hasValue || document.activeElement === input);
            };

            this.eventManager.addListener(input, 'focus', updateLabel);
            this.eventManager.addListener(input, 'blur', updateLabel);
            this.eventManager.addListener(input, 'input', updateLabel);
            updateLabel();
        });

        // Form validation
        document.querySelectorAll('form[data-validate]').forEach(form => {
            this.eventManager.addListener(form, 'submit', (e) => {
                if (!this.validateForm(form)) {
                    e.preventDefault();
                }
            });
        });
    }

    /**
     * Validate form
     */
    validateForm(form) {
        let isValid = true;
        const inputs = form.querySelectorAll('input, textarea, select');

        inputs.forEach(input => {
            if (input.hasAttribute('required') && !input.value.trim()) {
                this.showInputError(input, 'This field is required');
                isValid = false;
            } else if (input.type === 'email' && input.value && !this.isValidEmail(input.value)) {
                this.showInputError(input, 'Please enter a valid email address');
                isValid = false;
            } else {
                this.clearInputError(input);
            }
        });

        return isValid;
    }

    /**
     * Show input error
     */
    showInputError(input, message) {
        input.classList.add('error');
        
        let errorElement = input.parentNode.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            input.parentNode.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
    }

    /**
     * Clear input error
     */
    clearInputError(input) {
        input.classList.remove('error');
        const errorElement = input.parentNode.querySelector('.error-message');
        if (errorElement) {
            errorElement.remove();
        }
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Setup accessibility features
     */
    setupAccessibilityFeatures() {
        // Skip to main content link
        this.setupSkipLink();
        
        // Focus visible indicators
        this.setupFocusIndicators();
        
        // ARIA live regions for dynamic content
        this.setupLiveRegions();
        
        // Keyboard navigation enhancements
        this.setupKeyboardNavigation();
    }

    /**
     * Setup skip to main content link
     */
    setupSkipLink() {
        let skipLink = document.querySelector('[data-skip-link]');
        
        if (!skipLink) {
            skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.setAttribute('data-skip-link', '');
            skipLink.className = 'skip-link';
            skipLink.textContent = 'Skip to main content';
            document.body.insertBefore(skipLink, document.body.firstChild);
        }

        this.eventManager.addListener(skipLink, 'click', (e) => {
            const mainContent = document.querySelector('#main-content');
            if (mainContent) {
                e.preventDefault();
                mainContent.focus();
                mainContent.scrollIntoView();
            }
        });
    }

    /**
     * Setup focus indicators
     */
    setupFocusIndicators() {
        // Add focus-visible class for keyboard navigation
        document.body.addEventListener('keydown', () => {
            document.body.classList.add('keyboard-nav');
        });

        document.body.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-nav');
        });
    }

    /**
     * Setup ARIA live regions
     */
    setupLiveRegions() {
        let liveRegion = document.querySelector('[data-live-region]');
        
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.setAttribute('data-live-region', '');
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'visually-hidden';
            document.body.appendChild(liveRegion);
        }

        this.liveRegion = liveRegion;
    }

    /**
     * Announce message to screen readers
     */
    announce(message) {
        if (this.liveRegion) {
            this.liveRegion.textContent = message;
            setTimeout(() => {
                this.liveRegion.textContent = '';
            }, 1000);
        }
    }

    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        // Enhanced keyboard navigation for interactive elements
        document.querySelectorAll('[data-keyboard-nav]').forEach(container => {
            const items = container.querySelectorAll('[data-keyboard-item]');
            
            this.eventManager.addListener(container, 'keydown', (e) => {
                const currentIndex = Array.from(items).indexOf(document.activeElement);
                
                switch (e.key) {
                case 'ArrowDown':
                case 'ArrowRight':
                    e.preventDefault();
                    const nextIndex = (currentIndex + 1) % items.length;
                    items[nextIndex].focus();
                    break;
                case 'ArrowUp':
                case 'ArrowLeft':
                    e.preventDefault();
                    const prevIndex = (currentIndex - 1 + items.length) % items.length;
                    items[prevIndex].focus();
                    break;
                case 'Home':
                    e.preventDefault();
                    items[0].focus();
                    break;
                case 'End':
                    e.preventDefault();
                    items[items.length - 1].focus();
                    break;
                }
            });
        });
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast-enhanced toast-${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        
        document.body.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        // Announce to screen readers
        this.announce(message);

        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.eventManager.cleanupAll();
    }
}

// Initialize on DOM ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.dashboardUI = new DashboardUIEnhancer();
        });
    } else {
        window.dashboardUI = new DashboardUIEnhancer();
    }
}

export default DashboardUIEnhancer;