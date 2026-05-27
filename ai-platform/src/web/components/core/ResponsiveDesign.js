/**
 * Responsive Design - Mobile compatibility and responsive layout management
 */

export class ResponsiveDesign {
    constructor() {
        this.breakpoints = {
            mobile: 480,
            tablet: 768,
            desktop: 1024,
            wide: 1200
        };
        this.currentBreakpoint = this.getCurrentBreakpoint();
        this.isMobile = this.currentBreakpoint === 'mobile';
        this.isTablet = this.currentBreakpoint === 'tablet';
        this.init();
    }

    init() {
        console.log('📱 Responsive Design initialized');
        this.setupEventListeners();
        this.applyResponsiveStyles();
        this.createMobileNavigation();
        this.optimizeForMobile();
        this.setupTouchSupport();
    }

    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', this.debounce(() => {
            const newBreakpoint = this.getCurrentBreakpoint();
            if (newBreakpoint !== this.currentBreakpoint) {
                this.currentBreakpoint = newBreakpoint;
                this.isMobile = newBreakpoint === 'mobile';
                this.isTablet = newBreakpoint === 'tablet';
                this.onBreakpointChange(newBreakpoint);
            }
        }, 250));

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });

        // Handle touch events
        if ('ontouchstart' in window) {
            document.addEventListener('touchstart', this.handleTouchStart, { passive: true });
            document.addEventListener('touchmove', this.handleTouchMove, { passive: true });
            document.addEventListener('touchend', this.handleTouchEnd, { passive: true });
        }
    }

    getCurrentBreakpoint() {
        const width = window.innerWidth;

        if (width < this.breakpoints.mobile) {
            return 'mobile';
        }
        if (width < this.breakpoints.tablet) {
            return 'tablet';
        }
        if (width < this.breakpoints.desktop) {
            return 'desktop';
        }
        if (width < this.breakpoints.wide) {
            return 'wide';
        }

        return 'ultra-wide';
    }

    onBreakpointChange(breakpoint) {
        console.log(`📱 Breakpoint changed to: ${breakpoint}`);
        this.applyResponsiveStyles();
        this.adjustLayout(breakpoint);
        this.emitBreakpointChange(breakpoint);
    }

    applyResponsiveStyles() {
        const style = document.getElementById('responsive-styles') || document.createElement('style');
        style.id = 'responsive-styles';
        style.textContent = `
            /* Mobile Styles */
            @media (max-width: ${this.breakpoints.mobile - 1}px) {
                .dashboard {
                    padding: 10px;
                }
                
                .header {
                    padding: 15px 10px;
                }
                
                .header h1 {
                    font-size: 20px;
                }
                
                .header p {
                    font-size: 12px;
                    margin: 5px 0;
                }
                
                .header-controls {
                    margin-top: 10px;
                }
                
                .dashboard-navigation {
                    flex-wrap: wrap;
                    gap: 5px;
                }
                
                .nav-btn {
                    font-size: 12px;
                    padding: 8px 12px;
                    min-width: auto;
                }
                
                .nav-btn span {
                    display: none;
                }
                
                .tab-content {
                    padding: 15px;
                }
                
                .metrics-grid {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }
                
                .metric-card {
                    padding: 10px;
                }
                
                .metric-value {
                    font-size: 18px;
                }
                
                .metric-label {
                    font-size: 10px;
                }
                
                .analysis-results {
                    padding: 15px;
                }
                
                .analytics-tabs {
                    flex-wrap: wrap;
                    gap: 5px;
                }
                
                .analytics-tab {
                    font-size: 12px;
                    padding: 6px 12px;
                }
                
                .insights-grid {
                    grid-template-columns: 1fr;
                }
                
                .export-buttons {
                    flex-direction: column;
                    gap: 5px;
                }
                
                .btn-secondary {
                    font-size: 12px;
                    padding: 6px 12px;
                }
                
                .keyboard-shortcuts-modal .help-content {
                    padding: 20px;
                    max-width: 95vw;
                    max-height: 90vh;
                }
                
                .keyboard-shortcuts-modal .shortcuts-grid {
                    grid-template-columns: 1fr;
                }
                
                /* Mobile Navigation */
                .mobile-nav-toggle {
                    display: block;
                }
                
                .mobile-nav-menu {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.9);
                    z-index: 10000;
                    flex-direction: column;
                    padding: 20px;
                }
                
                .mobile-nav-menu.active {
                    display: flex;
                }
                
                .mobile-nav-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .mobile-nav-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: white;
                    cursor: pointer;
                }
                
                .mobile-nav-items {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .mobile-nav-item {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    padding: 15px;
                    border-radius: 8px;
                    color: white;
                    text-decoration: none;
                    text-align: center;
                    font-size: 16px;
                }
                
                .mobile-nav-item:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                
                /* Touch-friendly interactions */
                button,
                .btn-primary,
                .btn-secondary {
                    min-height: 44px;
                    min-width: 44px;
                }
                
                input, select, textarea {
                    min-height: 44px;
                    font-size: 16px; /* Prevent zoom on iOS */
                }
                
                /* Mobile charts */
                .chart-container {
                    height: 300px;
                }
                
                /* Mobile tables */
                table {
                    font-size: 12px;
                }
                
                table th, table td {
                    padding: 8px 4px;
                }
                
                /* Mobile modals */
                .modal, .popup, .dialog {
                    width: 95vw;
                    max-width: 95vw;
                    margin: 10px;
                }
                
                /* Mobile scrolling */
                .tab-content {
                    overflow-x: auto;
                }
            }
            
            /* Tablet Styles */
            @media (min-width: ${this.breakpoints.mobile}px) and (max-width: ${this.breakpoints.tablet - 1}px) {
                .dashboard {
                    padding: 15px;
                }
                
                .header {
                    padding: 20px 15px;
                }
                
                .header h1 {
                    font-size: 24px;
                }
                
                .dashboard-navigation {
                    flex-wrap: wrap;
                }
                
                .nav-btn {
                    font-size: 13px;
                    padding: 10px 15px;
                }
                
                .metrics-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
                
                .insights-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .analytics-tabs {
                    flex-wrap: wrap;
                }
                
                .keyboard-shortcuts-modal .shortcuts-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                /* Tablet navigation */
                .mobile-nav-toggle {
                    display: none;
                }
                
                .mobile-nav-menu {
                    display: none;
                }
            }
            
            /* Desktop Styles */
            @media (min-width: ${this.breakpoints.tablet}px) {
                .mobile-nav-toggle {
                    display: none;
                }
                
                .mobile-nav-menu {
                    display: none;
                }
                
                .dashboard-navigation {
                    flex-wrap: nowrap;
                    overflow-x: auto;
                }
            }
            
            /* Hide mobile elements on desktop */
            @media (min-width: ${this.breakpoints.tablet}px) {
                .mobile-only {
                    display: none !important;
                }
            }
            
            /* Show mobile elements only on mobile */
            @media (max-width: ${this.breakpoints.mobile - 1}px) {
                .desktop-only {
                    display: none !important;
                }
            }
            
            /* Responsive typography */
            @media (max-width: ${this.breakpoints.mobile - 1}px) {
                h1 { font-size: 20px; }
                h2 { font-size: 18px; }
                h3 { font-size: 16px; }
                h4 { font-size: 14px; }
                p { font-size: 14px; }
            }
            
            @media (min-width: ${this.breakpoints.mobile}px) and (max-width: ${this.breakpoints.tablet - 1}px) {
                h1 { font-size: 24px; }
                h2 { font-size: 20px; }
                h3 { font-size: 18px; }
                h4 { font-size: 16px; }
                p { font-size: 15px; }
            }
            
            /* Responsive animations */
            @media (prefers-reduced-motion: reduce) {
                * {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            }
        `;

        if (!document.getElementById('responsive-styles')) {
            document.head.appendChild(style);
        }
    }

    createMobileNavigation() {
        // Create mobile navigation toggle
        const mobileToggle = document.createElement('button');
        mobileToggle.className = 'mobile-nav-toggle mobile-only';
        mobileToggle.textContent = '☰' /* Replaced innerHTML with textContent for safety */
        mobileToggle.style.cssText = `
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            padding: 5px;
            margin-left: auto;
        `;

        mobileToggle.addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Add to header
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            headerControls.appendChild(mobileToggle);
        }

        // Create mobile navigation menu
        const mobileMenu = document.createElement('div');
        mobileMenu.className = 'mobile-nav-menu';
        mobileMenu.textContent = `
            <div class="mobile-nav-header">
                <h3 style="color: white /* Replaced innerHTML with textContent for safety */ margin: 0;">Navigation</h3>
                <button class="mobile-nav-close">×</button>
            </div>
            <div class="mobile-nav-items">
                <a href="#" class="mobile-nav-item" data-tab="overview">📊 Overview</a>
                <a href="#" class="mobile-nav-item" data-tab="analysis">📈 Analysis</a>
                <a href="#" class="mobile-nav-item" data-tab="directory">📁 Directory</a>
                <a href="#" class="mobile-nav-item" data-tab="exports">📤 Exports</a>
                <a href="#" class="mobile-nav-item" data-tab="ai-analysis">🤖 AI Analysis</a>
                <a href="#" class="mobile-nav-item" data-tab="analytics">📊 Analytics</a>
                <a href="#" class="mobile-nav-item" data-tab="predictions">🔮 Predictions</a>
                <a href="#" class="mobile-nav-item" data-tab="realtime">⚡ Realtime</a>
                <a href="#" class="mobile-nav-item" data-tab="scheduling">📅 Scheduling</a>
                <a href="#" class="mobile-nav-item" data-tab="dir-analysis">🔍 DIR Analysis</a>
            </div>
        `;

        document.body.appendChild(mobileMenu);

        // Setup mobile menu handlers
        mobileMenu.querySelector('.mobile-nav-close').addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        mobileMenu.querySelectorAll('.mobile-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = item.getAttribute('data-tab');
                this.switchToTab(tabName);
                this.toggleMobileMenu();
            });
        });

        // Close menu when clicking outside
        mobileMenu.addEventListener('click', (e) => {
            if (e.target === mobileMenu) {
                this.toggleMobileMenu();
            }
        });
    }

    toggleMobileMenu() {
        const mobileMenu = document.querySelector('.mobile-nav-menu');
        if (mobileMenu) {
            mobileMenu.classList.toggle('active');
        }
    }

    switchToTab(tabName) {
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.click();
        }
    }

    optimizeForMobile() {
        // Optimize images for mobile
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (!img.getAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }
        });

        // Optimize videos for mobile
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
        });

        // Add touch-friendly classes
        const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
        interactiveElements.forEach(element => {
            element.classList.add('touch-friendly');
        });
    }

    setupTouchSupport() {
        // Add touch-friendly classes
        document.body.classList.add('touch-enabled');

        // Setup swipe gestures for navigation
        this.setupSwipeGestures();

        // Setup long press for context menus
        this.setupLongPress();
    }

    setupSwipeGestures() {
        let touchStartX = 0;
        let touchEndX = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });

        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].clientX;
            this.handleSwipe(touchStartX, touchEndX);
        });
    }

    handleSwipe(startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - next tab
                this.navigateTabs('next');
            } else {
                // Swipe right - previous tab
                this.navigateTabs('prev');
            }
        }
    }

    navigateTabs(direction) {
        const tabs = document.querySelectorAll('.nav-btn');
        const activeTab = document.querySelector('.nav-btn.active');

        if (!activeTab || tabs.length === 0) {
            return;
        }

        const currentIndex = Array.from(tabs).indexOf(activeTab);
        let nextIndex;

        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % tabs.length;
        } else {
            nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        }

        tabs[nextIndex].click();
    }

    setupLongPress() {
        let pressTimer;

        document.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                this.handleLongPress(e.target);
            }, 500);
        });

        document.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });

        document.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        });
    }

    handleLongPress(element) {
        // Show context menu or perform long press action
        if (element.classList.contains('nav-btn')) {
            this.showTabContextMenu(element);
        }
    }

    showTabContextMenu(element) {
        // Create context menu for tab
        const menu = document.createElement('div');
        menu.className = 'mobile-context-menu';
        menu.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10001;
            min-width: 150px;
        `;

        const tabName = element.getAttribute('data-tab');
        menu.textContent = `
            <div class="context-menu-item" data-action="open">Open ${tabName}</div>
            <div class="context-menu-item" data-action="open-new">Open in New Tab</div>
            <div class="context-menu-item" data-action="close">Close</div>
        ` /* Replaced innerHTML with textContent for safety */

        document.body.appendChild(menu);

        // Position menu
        const rect = element.getBoundingClientRect();
        menu.style.left = rect.left + 'px';
        menu.style.top = (rect.bottom + 5) + 'px';

        // Setup menu handlers
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (_e) => {
                const action = item.getAttribute('data-action');
                this.handleContextMenuAction(action, element);
                menu.remove();
            });
        });

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
            }, { once: true });
        }, 100);
    }

    handleContextMenuAction(action, element) {
        switch (action) {
        case 'open':
            element.click();
            break;
        case 'open-new':
            // Open in new tab (would require backend support)
            console.log('Open in new tab:', element.getAttribute('data-tab'));
            break;
        case 'close':
            // Close functionality would require backend support
            console.log('Close tab:', element.getAttribute('data-tab'));
            break;
        }
    }

    handleOrientationChange() {
        const orientation = window.orientation ? window.orientation.angle : 0;
        console.log(`📱 Orientation changed: ${orientation}°`);

        // Adjust layout for landscape/portrait
        if (Math.abs(orientation) === 90) {
            document.body.classList.add('landscape');
            document.body.classList.remove('portrait');
        } else {
            document.body.classList.add('portrait');
            document.body.classList.remove('landscape');
        }
    }

    handleTouchStart(e) {
        // Add touch start effects
        if (e.target.classList.contains('touch-friendly')) {
            e.target.classList.add('touch-active');
        }
    }

    handleTouchMove(e) {
        // Handle touch move for scrolling or gestures
        if (e.target.classList.contains('touch-active')) {
            e.target.classList.remove('touch-active');
        }
    }

    handleTouchEnd(_e) {
        // Remove touch effects
        document.querySelectorAll('.touch-active').forEach(element => {
            element.classList.remove('touch-active');
        });
    }

    adjustLayout(breakpoint) {
        // Adjust layout based on breakpoint
        switch (breakpoint) {
        case 'mobile':
            this.applyMobileLayout();
            break;
        case 'tablet':
            this.applyTabletLayout();
            break;
        case 'desktop':
            this.applyDesktopLayout();
            break;
        case 'wide':
            this.applyWideLayout();
            break;
        }
    }

    applyMobileLayout() {
        // Mobile-specific adjustments
        document.body.classList.add('mobile-layout');
        document.body.classList.remove('tablet-layout', 'desktop-layout', 'wide-layout');

        // Hide desktop-only elements
        document.querySelectorAll('.desktop-only').forEach(el => {
            el.style.display = 'none';
        });

        // Show mobile-only elements
        document.querySelectorAll('.mobile-only').forEach(el => {
            el.style.display = '';
        });
    }

    applyTabletLayout() {
        // Tablet-specific adjustments
        document.body.classList.add('tablet-layout');
        document.body.classList.remove('mobile-layout', 'desktop-layout', 'wide-layout');
    }

    applyDesktopLayout() {
        // Desktop-specific adjustments
        document.body.classList.add('desktop-layout');
        document.body.classList.remove('mobile-layout', 'tablet-layout', 'wide-layout');

        // Hide mobile-only elements
        document.querySelectorAll('.mobile-only').forEach(el => {
            el.style.display = 'none';
        });

        // Show desktop-only elements
        document.querySelectorAll('.desktop-only').forEach(el => {
            el.style.display = '';
        });
    }

    applyWideLayout() {
        // Wide screen adjustments
        document.body.classList.add('wide-layout');
        document.body.classList.remove('mobile-layout', 'tablet-layout', 'desktop-layout');
    }

    emitBreakpointChange(breakpoint) {
        // Emit custom event for other components to listen to
        document.dispatchEvent(new CustomEvent('breakpointChange', {
            detail: { breakpoint, isMobile: this.isMobile, isTablet: this.isTablet }
        }));
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public methods
    isMobileDevice() {
        return this.isMobile;
    }

    isTabletDevice() {
        return this.isTablet;
    }

    getStoredBreakpoint() {
        return this.currentBreakpoint;
    }

    forceMobileLayout() {
        this.applyMobileLayout();
    }

    forceDesktopLayout() {
        this.applyDesktopLayout();
    }

    // Add touch-friendly styles
    addTouchStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .touch-friendly {
                min-height: 44px;
                min-width: 44px;
                touch-action: manipulation;
            }
            
            .touch-active {
                opacity: 0.7;
                transform: scale(0.98);
            }
            
            .mobile-context-menu {
                font-size: 14px;
            }
            
            .context-menu-item {
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
            }
            
            .context-menu-item:hover {
                background: #f5f5f5;
            }
            
            .context-menu-item:last-child {
                border-bottom: none;
            }
            
            /* Touch-friendly button styles */
            @media (hover: none) and (pointer: coarse) {
                button:hover,
                .btn-primary:hover,
                .btn-secondary:hover {
                    background: inherit;
                    color: inherit;
                }
                
                button:active,
                .btn-primary:active,
                .btn-secondary:active {
                    opacity: 0.8;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize touch styles
const responsiveDesign = new ResponsiveDesign();
responsiveDesign.addTouchStyles();

// Export for use in dashboard
window.ResponsiveDesign = ResponsiveDesign;
