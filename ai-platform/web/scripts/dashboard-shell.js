/**
 * Dashboard shell — navigation, headers, notifications, GGUF compatibility wrappers
 */
(function () {
        let notificationHideTimer = null;
        let notificationCleanupTimer = null;

        function ensureNotificationStyles() {
            if (typeof document === 'undefined' || document.getElementById('dashboard-notification-styles')) {
                return;
            }
            const style = document.createElement('style');
            style.id = 'dashboard-notification-styles';
            style.textContent = `
                #notification {
                    transform: translateX(calc(100% + 24px));
                    max-width: min(520px, calc(100vw - 40px));
                }
                #notification.show {
                    transform: translateX(0);
                    visibility: visible;
                    pointer-events: auto;
                }
                #notification:not(.show) {
                    visibility: hidden;
                    pointer-events: none;
                }
                #notification .notification-text {
                    flex: 1;
                    line-height: 1.4;
                }
                #notification .btn-close {
                    margin-left: auto;
                    background: none;
                    border: none;
                    color: white;
                    opacity: 0.75;
                    font-size: 1.25rem;
                    line-height: 1;
                    cursor: pointer;
                    padding: 0 0.25rem;
                }
                #notification .btn-close:hover {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);
        }

        function dismissNotification(notification) {
            if (!notification) return;
            notification.classList.remove('show');
            if (notificationCleanupTimer) {
                clearTimeout(notificationCleanupTimer);
            }
            notificationCleanupTimer = setTimeout(() => {
                notification.replaceChildren();
                notification.className = 'notification';
                notificationCleanupTimer = null;
            }, 350);
        }

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            window.initializeCharts?.();
            initializeSidebarNavSearch();
            bindSectionBreadcrumb();

            const hashSection = window.location.hash.replace(/^#/, '');
            if (hashSection) {
                navigatingFromHistory = true;
                showSection(hashSection, resolveNavLink(hashSection, null));
                navigatingFromHistory = false;
            } else if (typeof initializeDashboardHomePage === 'function') {
                initializeDashboardHomePage();
            }

            window.addEventListener('popstate', () => syncSectionFromLocation());
            window.addEventListener('hashchange', () => {
                if (!navigatingFromHistory) syncSectionFromLocation();
            });
        });

        function initializeSidebarNavSearch() {
            const input = document.getElementById('sidebar-nav-search');
            if (!input) return;

            input.title = 'Search tools (Ctrl+K)';

            input.addEventListener('input', () => {
                const query = input.value.trim().toLowerCase();
                document.querySelectorAll('.sidebar .nav-item').forEach((item) => {
                    const label = item.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
                    item.hidden = Boolean(query) && !label.includes(query);
                });
            });

            document.addEventListener('keydown', (event) => {
                if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
                const tag = event.target?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) {
                    return;
                }
                event.preventDefault();
                input.focus();
                input.select();
            });
        }

        const SECTION_TO_NAV = {
            dashboard: 'dashboard',
            'ai-tools': 'ai-tools',
            'ai-analysis': 'ai-tools',
            'local-models': 'ai-tools',
            'gguf-analysis': 'ai-tools',
            'code-generation': 'ai-tools',
            'issue-resolution': 'ai-tools',
            'analytics-hub': 'analytics-hub',
            reports: 'analytics-hub',
            analytics: 'analytics-hub',
            performance: 'analytics-hub',
            quality: 'analytics-hub',
            security: 'analytics-hub',
            support: 'analytics-hub',
            'dev-tools': 'dev-tools',
            database: 'dev-tools',
            api: 'dev-tools',
            'merger-tool': 'dev-tools',
            'roadmap-hub': 'roadmap-hub',
            roadmap: 'roadmap-hub',
            'ai-roadmap': 'roadmap-hub',
            'release-timeline': 'roadmap-hub',
            'implementation-plan': 'roadmap-hub',
            'feature-backlog': 'roadmap-hub',
            'resources-hub': 'resources-hub',
            'debt-calculator': 'resources-hub',
            'debt-reduction': 'resources-hub',
            'debt-analytics': 'resources-hub',
            'billing-system': 'resources-hub',
            'project-reports': 'resources-hub',
            'assets-library': 'resources-hub',
            'code-templates': 'resources-hub',
            'coverage-reports': 'resources-hub',
            help: 'resources-hub',
            settings: 'settings'
        };

        const TOP_LEVEL_SECTIONS = new Set([
            'dashboard',
            'ai-tools',
            'analytics-hub',
            'dev-tools',
            'roadmap-hub',
            'resources-hub',
            'settings'
        ]);

        function getSectionDisplayLabel(sectionName) {
            const section = document.getElementById(`${sectionName}-section`);
            const h1 = section?.querySelector('.header h1, .nav-hub-page .header h1, h1');
            if (h1?.textContent) {
                return h1.textContent.replace(/^[^\w]+/, '').replace(/\s+/g, ' ').trim();
            }
            return sectionName
                .split('-')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
        }

        function updateSectionBreadcrumb(sectionName) {
            const nav = document.getElementById('section-breadcrumb');
            const hubBtn = document.getElementById('breadcrumb-hub-link');
            const currentEl = document.getElementById('breadcrumb-current');
            if (!nav || !hubBtn || !currentEl) return;

            if (TOP_LEVEL_SECTIONS.has(sectionName)) {
                nav.hidden = true;
                return;
            }

            const hubId = SECTION_TO_NAV[sectionName];
            if (!hubId || hubId === sectionName) {
                nav.hidden = true;
                return;
            }

            const hubLink = document.querySelector(`.nav-link[data-nav-section="${hubId}"]`);
            const hubLabel = hubLink?.querySelector('span:last-child')?.textContent?.trim()
                || hubLink?.textContent?.replace(/\s+/g, ' ').trim()
                || getSectionDisplayLabel(hubId);

            hubBtn.textContent = hubLabel;
            hubBtn.dataset.hubTarget = hubId;
            currentEl.textContent = getSectionDisplayLabel(sectionName);
            nav.hidden = false;
        }

        function bindSectionBreadcrumb() {
            document.getElementById('section-breadcrumb')?.addEventListener('click', (event) => {
                const hubBtn = event.target.closest('.breadcrumb-hub-link');
                if (!hubBtn?.dataset.hubTarget) return;
                event.preventDefault();
                const hubId = hubBtn.dataset.hubTarget;
                const navLink = document.querySelector(`.nav-link[data-nav-section="${hubId}"]`);
                showSection(hubId, navLink);
            });
        }

        function resolveNavLink(sectionName, linkElement) {
            if (linkElement) return linkElement;
            const navKey = SECTION_TO_NAV[sectionName] || sectionName;
            return document.querySelector(`.nav-link[data-nav-section="${navKey}"]`);
        }

        function scheduleEmptyStateCheck(sectionName) {
            if (typeof window.PageEmptyState?.syncSection !== 'function') return;
            window.PageEmptyState.syncSection(sectionName);
            setTimeout(() => window.PageEmptyState.syncSection(sectionName), 700);
            setTimeout(() => window.PageEmptyState.syncSection(sectionName), 2200);
        }

        let navigatingFromHistory = false;

        function syncSectionFromLocation() {
            const sectionName = window.location.hash.replace(/^#/, '') || 'dashboard';
            navigatingFromHistory = true;
            showSection(sectionName, resolveNavLink(sectionName, null));
            navigatingFromHistory = false;
        }

        // Section navigation
        function showSection(sectionName, linkElement) {
            if (sectionName === 'mock-data-analyzer') {
                sectionName = 'gguf-analysis';
                if (!linkElement) {
                    linkElement = document.querySelector('.nav-link[data-nav-section="ai-tools"]');
                }
            }
            // Hide all sections
            const sections = document.querySelectorAll('.content-section');
            sections.forEach(section => section.classList.remove('active'));

            // Remove active class from all nav links
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => link.classList.remove('active'));

            // Show selected section
            const targetSection = document.getElementById(sectionName + '-section');
            if (targetSection) {
                targetSection.classList.add('active');
            }

            // Add active class to clicked link (or parent hub for deep links)
            const activeLink = resolveNavLink(sectionName, linkElement);
            if (activeLink) {
                activeLink.classList.add('active');
            }

            const deferSectionInit = window.__deferredSampleInit instanceof Set
                && window.__deferredSampleInit.has(sectionName);

            // Initialize GGUF Analysis page
            if (!deferSectionInit && sectionName === 'gguf-analysis') {
                if (typeof initializeGgufAnalysisPage === 'function') {
                    initializeGgufAnalysisPage();
                }
            }

            // Legacy GGUF component loader (other sections)
            if (sectionName === 'gguf-analysis-legacy') {
                if (!window.ggufComponentsLoaded) {
                    loadGGUFScripts();
                    window.ggufComponentsLoaded = true;
                    setTimeout(() => {
                        initializeGGUFComponents();
                    }, 500);
                }
            }

            // Initialize component-based sections
            if (!deferSectionInit && sectionName === 'dashboard') {
                if (typeof initializeDashboardHomePage === 'function') {
                    initializeDashboardHomePage();
                }
            } else if (!deferSectionInit && sectionName === 'analytics') {
                if (typeof initializeAnalyticsPage === 'function') {
                    initializeAnalyticsPage();
                }
            } else if (!deferSectionInit && sectionName === 'ai-tools') {
                if (typeof initializeAIToolsPage === 'function') {
                    initializeAIToolsPage();
                }
            } else if (!deferSectionInit && sectionName === 'ai-analysis') {
                if (typeof initializeAIAnalysisPage === 'function') {
                    initializeAIAnalysisPage();
                }
            } else if (!deferSectionInit && sectionName === 'database') {
                if (typeof initializeDatabasePage === 'function') {
                    initializeDatabasePage();
                }
            } else if (!deferSectionInit && sectionName === 'performance') {
                if (typeof initializePerformancePage === 'function') {
                    initializePerformancePage();
                }
            } else if (!deferSectionInit && sectionName === 'quality') {
                if (typeof initializeQualityPage === 'function') {
                    initializeQualityPage();
                }
            } else if (!deferSectionInit && sectionName === 'security') {
                if (typeof initializeSecurityPage === 'function') {
                    initializeSecurityPage();
                }
            } else if (!deferSectionInit && sectionName === 'support') {
                if (typeof initializeSupportPage === 'function') {
                    initializeSupportPage();
                }
            } else if (!deferSectionInit && sectionName === 'reports') {
                if (typeof initializeReportsPage === 'function') {
                    initializeReportsPage();
                }
            } else if (!deferSectionInit && sectionName === 'api') {
                if (typeof initializeAPIPage === 'function') {
                    initializeAPIPage();
                }
            } else if (!deferSectionInit && sectionName === 'merger-tool') {
                if (typeof initializeMergerToolPage === 'function') {
                    initializeMergerToolPage();
                }
            } else if (!deferSectionInit && sectionName === 'ai-roadmap') {
                if (typeof initializeAIRoadmapPage === 'function') {
                    initializeAIRoadmapPage();
                }
            } else if (!deferSectionInit && sectionName === 'debt-calculator') {
                if (typeof initializeDebtCalculatorPage === 'function') {
                    initializeDebtCalculatorPage();
                }
            } else if (!deferSectionInit && sectionName === 'debt-reduction') {
                if (typeof initializeDebtReductionPage === 'function') {
                    initializeDebtReductionPage();
                }
            } else if (!deferSectionInit && sectionName === 'debt-analytics') {
                if (typeof initializeDebtAnalyticsPage === 'function') {
                    initializeDebtAnalyticsPage();
                }
            } else if (!deferSectionInit && sectionName === 'feature-backlog') {
                if (typeof initializeFeatureBacklogPage === 'function') {
                    initializeFeatureBacklogPage();
                }
            } else if (!deferSectionInit && sectionName === 'roadmap') {
                if (typeof initializeRoadmapPage === 'function') {
                    initializeRoadmapPage();
                }
            } else if (!deferSectionInit && sectionName === 'release-timeline') {
                if (typeof initializeReleaseTimelinePage === 'function') {
                    initializeReleaseTimelinePage();
                }
            } else if (!deferSectionInit && sectionName === 'billing-system') {
                if (typeof initializeBillingSystemPage === 'function') {
                    initializeBillingSystemPage();
                }
            } else if (!deferSectionInit && sectionName === 'project-reports') {
                if (typeof initializeProjectReportsPage === 'function') {
                    initializeProjectReportsPage();
                }
            } else if (!deferSectionInit && sectionName === 'assets-library') {
                if (typeof initializeAssetsLibraryPage === 'function') {
                    initializeAssetsLibraryPage();
                }
            } else if (!deferSectionInit && sectionName === 'code-templates') {
                if (typeof initializeCodeTemplatesPage === 'function') {
                    initializeCodeTemplatesPage();
                }
            } else if (!deferSectionInit && sectionName === 'coverage-reports') {
                if (typeof initializeCoverageReportsPage === 'function') {
                    initializeCoverageReportsPage();
                }
            } else if (!deferSectionInit && sectionName === 'settings') {
                if (typeof initializeSettingsPage === 'function') {
                    initializeSettingsPage();
                }
            } else if (!deferSectionInit && sectionName === 'implementation-plan') {
                if (typeof initializeImplementationPlanPage === 'function') {
                    initializeImplementationPlanPage();
                }
            } else if (!deferSectionInit && sectionName === 'help') {
                if (typeof initializeHelpPage === 'function') {
                    initializeHelpPage();
                }
            } else if (!deferSectionInit && sectionName === 'code-generation') {
                if (typeof initializeCodeGenerationPage === 'function') {
                    initializeCodeGenerationPage();
                }
            } else if (!deferSectionInit && sectionName === 'issue-resolution') {
                if (typeof initializeIssueResolutionPage === 'function') {
                    initializeIssueResolutionPage();
                }
            } else if (!deferSectionInit && sectionName === 'local-models') {
                if (typeof initializeLocalModelsPage === 'function') {
                    initializeLocalModelsPage();
                }
            } else if (!deferSectionInit && sectionName === 'dev-tools') {
                if (typeof initializeDevToolsPage === 'function') {
                    initializeDevToolsPage();
                }
            }

            // Update header based on section
            updateHeader(sectionName);
            updateSectionBreadcrumb(sectionName);
            scheduleEmptyStateCheck(sectionName);

            if (!navigatingFromHistory) {
                const hash = `#${sectionName}`;
                if (window.location.hash !== hash) {
                    if (window.history?.pushState) {
                        window.history.pushState({ section: sectionName }, '', hash);
                    } else {
                        window.location.hash = sectionName;
                    }
                }
            }

            console.log(`📍 Showing section: ${sectionName}`);
        }

        
        // Update header for legacy sections only — self-contained pages own their .header blocks
        const SELF_CONTAINED_SECTIONS = new Set([
            'dashboard', 'analytics-hub', 'roadmap-hub', 'resources-hub',
            'ai-roadmap', 'ai-tools', 'ai-analysis', 'local-models', 'gguf-analysis', 'code-generation',
            'issue-resolution', 'reports', 'analytics', 'performance', 'quality', 'security', 'support', 'dev-tools', 'roadmap',
            'database', 'api', 'merger-tool', 'debt-calculator', 'debt-reduction', 'debt-analytics', 'feature-backlog', 'release-timeline', 'implementation-plan', 'billing-system', 'project-reports', 'assets-library', 'code-templates', 'coverage-reports', 'settings', 'help'
        ]);

        function updateHeader(sectionName) {
            if (SELF_CONTAINED_SECTIONS.has(sectionName)) return;

            const headers = {
                'dashboard': {
                    title: '🤖 AI Data Processing Platform',
                    lead: 'Advanced Data Analysis & Processing',
                    muted: 'AI-Powered Data Processing • Analysis • Optimization'
                },
                'ai-roadmap': {
                    title: '🤖 AI-Powered Roadmap Report',
                    lead: 'Comprehensive AI-generated project insights and executive analysis',
                    muted: 'Project metrics • Development phases • AI recommendations'
                },
                'ai-tools': {
                    title: '🛠️ AI Tools',
                    lead: 'Advanced AI-powered development tools',
                    muted: 'Code analysis • Security • Performance optimization'
                },
                'ai-analysis': {
                    title: '🔍 AI Analysis',
                    lead: 'Deep codebase analysis with AI',
                    muted: 'Automated analysis • Insights • Recommendations'
                },
                'gguf-analysis': {
                    title: '🧠 GGUF AI Analysis',
                    lead: 'Advanced mock data analysis with GGUF AI models',
                    muted: 'Mock data quality • Issues • AI recommendations'
                },
                'code-generation': {
                    title: '💻 Code Generation',
                    lead: 'AI-powered code generation and automation',
                    muted: 'Code generation • Templates • Automation'
                },
                'issue-resolution': {
                    title: '🔧 Issue Resolution',
                    lead: 'Automated issue detection and resolution',
                    muted: 'Issue detection • Auto-fix • Progress tracking'
                },
                'reports': {
                    title: '📄 Reports',
                    lead: 'Generated reports and documentation',
                    muted: 'Analysis reports • Documentation • Export'
                },
                'analytics': {
                    title: '📊 Analytics',
                    lead: 'Platform analytics and insights',
                    muted: 'Performance metrics • Usage statistics • Trends'
                },
                'performance': {
                    title: '⚡ Performance',
                    lead: 'System performance monitoring and optimization',
                    muted: 'Performance metrics • Monitoring • Optimization'
                },
                'dev-tools': {
                    title: '🔧 Dev Tools',
                    lead: 'Development tools and utilities',
                    muted: 'Development utilities • Tools • Automation'
                },
                'database': {
                    title: '🗄️ Database',
                    lead: 'Database management and operations',
                    muted: 'Database management • Queries • Operations'
                },
                'api': {
                    title: '🔌 API',
                    lead: 'API documentation and testing tools',
                    muted: 'API documentation • Testing • Integration'
                },
                'merger-tool': {
                    title: '🔄 Merger Tool',
                    lead: 'File and project merging tools',
                    muted: 'File merging • Project integration • Tools'
                },
                'roadmap': {
                    title: '🗺️ Project Roadmap',
                    lead: 'Project development timeline and milestones',
                    muted: 'Feature planning • Progress tracking • Timeline'
                },
                'release-timeline': {
                    title: '📅 Release Timeline',
                    lead: 'Product release schedule and milestones',
                    muted: 'Release planning • Schedule • Milestones'
                },
                'feature-backlog': {
                    title: '📋 Feature Backlog',
                    lead: 'Feature planning and backlog management',
                    muted: 'Feature planning • Backlog management • Prioritization'
                },
                'debt-calculator': {
                    title: '🧮 Debt Calculator',
                    lead: 'Technical debt calculation and analysis',
                    muted: 'Debt calculation • Analysis • Metrics'
                },
                'debt-reduction': {
                    title: '🔨 Debt Reduction',
                    lead: 'Technical debt reduction strategies and tools',
                    muted: 'Debt reduction • Strategies • Tools'
                },
                'debt-analytics': {
                    title: '📊 Debt Analytics',
                    lead: 'Technical debt analytics and reporting',
                    muted: 'Debt analytics • Reporting • Insights'
                },
                'billing-system': {
                    title: '💰 Billing System',
                    lead: 'Billing and subscription management',
                    muted: 'Billing management • Subscriptions • Payments'
                },
                'project-reports': {
                    title: '📄 Project Reports',
                    lead: 'Project documentation and reports',
                    muted: 'Project documentation • Reports • Analysis'
                },
                'assets-library': {
                    title: '🎨 Assets Library',
                    lead: 'Digital assets and media library',
                    muted: 'Asset management • Media library • Resources'
                },
                'code-templates': {
                    title: '📝 Code Templates',
                    lead: 'Reusable code templates and snippets',
                    muted: 'Code templates • Snippets • Reusability'
                },
                'coverage-reports': {
                    title: '🛡️ Coverage Reports',
                    lead: 'Code coverage analysis and reporting',
                    muted: 'Code coverage • Analysis • Reporting'
                },
                'implementation-plan': {
                    title: '🚀 Implementation Plan',
                    lead: 'Project execution plan and milestone tracking',
                    muted: 'Phases • KPIs • Milestones • Resources'
                },
                'settings': {
                    title: '⚙️ Settings',
                    lead: 'Platform configuration and preferences',
                    muted: 'Configuration • Preferences • Settings'
                },
                'help': {
                    title: '❓ Help',
                    lead: 'Documentation, tutorials, and support',
                    muted: 'Documentation • Tutorials • Support'
                }
            };

            const header = headers[sectionName];
            if (!header) return;

            const section = document.getElementById(`${sectionName}-section`);
            if (!section) return;

            const headerElement = section.querySelector('.header h1');
            const leadElement = section.querySelector('.header .lead');
            const mutedElement = section.querySelector('.header .text-muted');

            if (headerElement) headerElement.textContent = header.title;
            if (leadElement) leadElement.textContent = header.lead;
            if (mutedElement) mutedElement.textContent = header.muted;
        }

        // GGUF mock data compatibility wrappers (delegates to gguf-analysis-page.js)
        async function downloadMockDataReport() {
            if (window.__ggufAnalysisReport) {
                const blob = new Blob([JSON.stringify(window.__ggufAnalysisReport, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'gguf-mock-data-analysis-report-' + new Date().toISOString().split('T')[0] + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showNotification('✅ GGUF Mock Data Analysis Report downloaded successfully', 'success');
                return;
            }
            document.getElementById('gguf-export-json')?.click();
        }

        async function applyImportedMockAnalysisJson(rawJson, sourceLabel) {
            const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
            if (typeof applyGgufAnalysisReport === 'function') {
                await applyGgufAnalysisReport(parsed, sourceLabel);
            }
        }

        async function loadGgufMockAnalysisSample() {
            if (typeof loadGgufAnalysisSample === 'function') {
                await loadGgufAnalysisSample();
            }
        }

        async function loadGGUFModelAnalysis() {
            if (typeof initializeGgufAnalysisPage === 'function') {
                await initializeGgufAnalysisPage(true);
            }
        }

        window.applyImportedMockAnalysisJson = applyImportedMockAnalysisJson;
        window.loadGgufMockAnalysisSample = loadGgufMockAnalysisSample;
        window.loadGGUFModelAnalysis = loadGGUFModelAnalysis;
        window.downloadMockDataReport = downloadMockDataReport;

        // Notification system - exposed to global scope
        window.showNotification = function(message, type = 'info') {
            try {
                ensureNotificationStyles();
                const notification = document.getElementById('notification');
                if (!notification) {
                    console.warn('⚠️ Notification element not found, using console instead');
                    console.log(`${type.toUpperCase()}: ${message}`);
                    return;
                }

                if (notificationHideTimer) {
                    clearTimeout(notificationHideTimer);
                    notificationHideTimer = null;
                }
                if (notificationCleanupTimer) {
                    clearTimeout(notificationCleanupTimer);
                    notificationCleanupTimer = null;
                }

                notification.replaceChildren();
                const textSpan = document.createElement('span');
                textSpan.className = 'notification-text';
                textSpan.textContent = message;

                const closeBtn = document.createElement('button');
                closeBtn.type = 'button';
                closeBtn.className = 'btn-close';
                closeBtn.setAttribute('aria-label', 'Dismiss notification');
                closeBtn.textContent = '\u00d7';

                notification.append(textSpan, closeBtn);
                notification.className = `notification ${type}`;
                requestAnimationFrame(() => notification.classList.add('show'));

                const dismiss = () => dismissNotification(notification);
                closeBtn.addEventListener('click', dismiss, { once: true });

                const duration = type === 'error' ? 8000 : (type === 'warning' ? 6000 : 4000);
                notificationHideTimer = setTimeout(() => {
                    notificationHideTimer = null;
                    dismiss();
                }, duration);
            } catch (error) {
                console.error('❌ Error in showNotification:', error);
                console.log(`${type.toUpperCase()}: ${message}`);
            }
        };

        // Mobile sidebar toggle
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('open');
        }

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(event) {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.querySelector('.sidebar-toggle');
            
            if (window.innerWidth <= 768 && 
                !sidebar.contains(event.target) && 
                !toggle.contains(event.target) &&
                sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });

    window.showSection = showSection;
    window.toggleSidebar = toggleSidebar;
    window.updateHeader = updateHeader;
    window.SECTION_TO_NAV = SECTION_TO_NAV;
    window.SELF_CONTAINED_SECTIONS = SELF_CONTAINED_SECTIONS;
    window.applyImportedMockAnalysisJson = applyImportedMockAnalysisJson;
    window.loadGgufMockAnalysisSample = loadGgufMockAnalysisSample;
    window.loadGGUFModelAnalysis = loadGGUFModelAnalysis;
    window.downloadMockDataReport = downloadMockDataReport;

    if (typeof window.loadBlobDrivenRoadmap !== 'function') {
        window.loadBlobDrivenRoadmap = async function loadBlobDrivenRoadmapFallback() {
            if (typeof window.loadSampleRoadmapJson === 'function') {
                await window.loadSampleRoadmapJson();
                return;
            }
            window.showNotification?.('Roadmap modules still loading — try again in a moment', 'info');
        };
    }

    if (typeof window.initializeRoadmapWhenReady !== 'function') {
        window.initializeRoadmapWhenReady = async function initializeRoadmapWhenReadyFallback() {
            if (typeof window.loadSampleRoadmapJson === 'function') {
                await window.loadSampleRoadmapJson();
            }
            return true;
        };
    }
})();
