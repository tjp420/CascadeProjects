// Centralized Navigation Loader
// This script loads the navigation sidebar into all HTML pages

class NavigationLoader {
    constructor() {
        this.navigationUrl = '/components/navigation-sidebar.html';
        this.init();
    }

    async init() {
        // Load navigation when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.loadNavigation());
        } else {
            this.loadNavigation();
        }
    }

    async loadNavigation() {
        try {
            // Fetch the navigation component
            const response = await fetch(this.navigationUrl);
            if (!response.ok) {
                throw new Error(`Failed to load navigation: ${response.status}`);
            }

            const navigationHTML = await response.text();

            // Find all navigation containers in the page
            const navigationContainers = document.querySelectorAll('.navigation-container');
            
            if (navigationContainers.length === 0) {
                console.warn('No navigation containers found. Make sure to add <div class="navigation-container"></div> to your HTML files.');
                return;
            }

            // Insert navigation into each container
            navigationContainers.forEach(container => {
                container.textContent = navigationHTML /* Replaced innerHTML with textContent for safety */
            });

            // Initialize navigation functionality
            this.initializeNavigation();

        } catch (error) {
            console.error('Error loading navigation:', error);
            // Fallback: create a simple navigation if the component fails to load
            this.createFallbackNavigation();
        }
    }

    initializeNavigation() {
        // Set active navigation based on current page
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link-modern');
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPath || 
                (currentPath === '/' && href === '/dashboard') ||
                (currentPath.endsWith('.html') && href === currentPath.replace('.html', ''))) {
                link.classList.add('active');
            }
        });

        // Initialize sidebar state
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar) {
            const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            if (isCollapsed) {
                sidebar.classList.add('collapsed');
            }
        }

        // Add resize handler
        this.addResizeHandler();
    }

    createFallbackNavigation() {
        const navigationContainers = document.querySelectorAll('.navigation-container');
        const fallbackNav = `
            <nav class="sidebar-modern" id="main-sidebar">
                <div class="sidebar-header">
                    <div class="logo-container">
                        <div class="logo">
                            <i class="fas fa-brain"></i>
                            <span>Cascade AI</span>
                        </div>
                    </div>
                </div>
                <div class="nav-container">
                    <div class="nav-section-modern">
                        <div class="nav-item-modern">
                            <a href="/dashboard" class="nav-link-modern">
                                <span class="nav-icon-modern"><i class="fas fa-home"></i></span>
                                <span>Dashboard</span>
                            </a>
                        </div>
                    </div>
                </div>
            </nav>
        `;

        navigationContainers.forEach(container => {
            container.textContent = fallbackNav /* Replaced innerHTML with textContent for safety */
        });
    }

    addResizeHandler() {
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                const sidebar = document.getElementById('main-sidebar');
                if (sidebar) {
                    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
                    if (isCollapsed) {
                        sidebar.classList.add('collapsed');
                    } else {
                        sidebar.classList.remove('collapsed');
                    }
                }
            }
        });
    }
}

// Global navigation functions (for backward compatibility)
window.setActiveNav = function(element) {
    document.querySelectorAll('.nav-link-modern').forEach(link => {
        link.classList.remove('active');
    });
    element.classList.add('active');
    
    if (window.innerWidth <= 768) {
        window.toggleSidebar();
    }
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    }
};

// Initialize the navigation loader
new NavigationLoader();
