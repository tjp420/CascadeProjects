import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { getCurrentRoute, navigate } from './router/HashRouter';
import { AppShell } from './layout/AppShell';
import { ToastProvider } from './components/ToastProvider';
import { BrandProvider } from './contexts/BrandContext';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { isTokenExpired } from './config';

// P1 views — Dashboard is always needed, keep eager
import { DashboardView } from './views/DashboardView';
import { SignInView } from './views/SignInView';
import { PermissionGuard } from './components/PermissionGuard';

// Lazy-loaded views — code-split to keep initial bundle small
const AnalyzeView = lazy(() => import('./views/AnalyzeView').then((m) => ({ default: m.AnalyzeView })));
const ResultsView = lazy(() => import('./views/ResultsView').then((m) => ({ default: m.ResultsView })));
const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));
const AuditView = lazy(() => import('./views/AuditView').then((m) => ({ default: m.AuditView })));
const SecurityView = lazy(() => import('./views/SecurityView').then((m) => ({ default: m.SecurityView })));
const QualityView = lazy(() => import('./views/QualityView').then((m) => ({ default: m.QualityView })));
const ChatbotView = lazy(() => import('./views/ChatbotView').then((m) => ({ default: m.ChatbotView })));
const TrustView = lazy(() => import('./views/TrustView').then((m) => ({ default: m.TrustView })));
const RemediationView = lazy(() => import('./views/RemediationView').then((m) => ({ default: m.RemediationView })));
const ProfileView = lazy(() => import('./views/ProfileView').then((m) => ({ default: m.ProfileView })));
const PlatformView = lazy(() => import('./views/PlatformView').then((m) => ({ default: m.PlatformView })));
const ToolsView = lazy(() => import('./views/ToolsView').then((m) => ({ default: m.ToolsView })));
const RepoHealthView = lazy(() => import('./views/RepoHealthView').then((m) => ({ default: m.RepoHealthView })));
const AdminView = lazy(() => import('./views/AdminView').then((m) => ({ default: m.AdminView })));
const UploadView = lazy(() => import('./views/UploadView').then((m) => ({ default: m.UploadView })));
const HelpView = lazy(() => import('./views/HelpView').then((m) => ({ default: m.HelpView })));
const AssessmentView = lazy(() => import('./views/AssessmentView').then((m) => ({ default: m.AssessmentView })));
const AboutView = lazy(() => import('./views/AboutView').then((m) => ({ default: m.AboutView })));
const GettingStartedView = lazy(() => import('./views/GettingStartedView').then((m) => ({ default: m.GettingStartedView })));
const ComplianceView = lazy(() => import('./views/ComplianceView').then((m) => ({ default: m.ComplianceView })));
const OrganizationView = lazy(() => import('./views/OrganizationView').then((m) => ({ default: m.OrganizationView })));
const EnterpriseView = lazy(() => import('./views/EnterpriseView').then((m) => ({ default: m.EnterpriseView })));
const OutreachAnalyticsView = lazy(() => import('./views/OutreachAnalyticsView').then((m) => ({ default: m.OutreachAnalyticsView })));
const TeamMetricsView = lazy(() => import('./views/TeamMetricsView').then((m) => ({ default: m.TeamMetricsView })));
const AnalyticsDashboardView = lazy(() => import('./views/AnalyticsDashboardView').then((m) => ({ default: m.AnalyticsDashboardView })));

const PUBLIC_VIEWS = new Set(['signin', 'register', 'about', 'getting-started']);
const AUTH_REQUIRED_VIEWS = new Set(['organization']);
const WRITE_HEAVY_VIEWS = new Set([
  'dashboard',
  'analyze',
  'upload',
  'settings',
  'admin',
  'chatbot',
]);

function isHostedDashboard(): boolean {
  if (typeof window === 'undefined') return false;
  return !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function isIdeEmbedSurface(): boolean {
  if (typeof window === 'undefined') return false;
  try {
     
    const win = window as any;
    if (win.__SB_IDE_EMBED__) return true;
    if (document.documentElement.hasAttribute('data-ide-embed')) return true;
    if (typeof win.acquireVsCodeApi === 'function') return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('sb_api_base') || params.get('sb_notify_base')) return true;
  } catch {
    /* ignore */
  }
  return window.self !== window.top;
}

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  analyze: 'Analyze',
  results: 'Results',
  settings: 'Settings',
  audit: 'Audit Report',
  security: 'Security',
  quality: 'Quality',
  chatbot: 'Chatbot',
  trust: 'Trust',
  remediation: 'Remediation',
  roadmap: 'Remediation Roadmap',
  profile: 'Profile',
  platform: 'Platform',
  tools: 'Tools',
  'repository-health': 'Repo Health',
  signin: 'Sign In',
  register: 'Create Account',
  admin: 'Admin',
  upload: 'Upload',
  help: 'Help',
  features: 'Features',
  assessments: 'Assessments',
  about: 'About',
  'getting-started': 'Getting Started',
  compliance: 'Compliance',
  organization: 'Organization',
  enterprise: 'Enterprise',
  'team-metrics': 'Team Metrics',
  'outreach-analytics': 'Outreach Analytics',
  'analytics-dashboard': 'Audit Analytics',
};

const viewMap: Record<string, ComponentType> = {
  dashboard: DashboardView,
  analyze: AnalyzeView,
  results: ResultsView,
  settings: SettingsView,
  audit: AuditView,
  security: SecurityView,
  quality: QualityView,
  chatbot: ChatbotView,
  trust: TrustView,
  remediation: RemediationView,
  roadmap: RemediationView,
  profile: ProfileView,
  platform: PlatformView,
  tools: ToolsView,
  'repository-health': RepoHealthView,
  signin: SignInView,
  register: SignInView,
  admin: AdminView,
  upload: UploadView,
  help: HelpView,
  features: HelpView,
  assessments: AssessmentView,
  about: AboutView,
  'getting-started': GettingStartedView,
  compliance: ComplianceView,
  organization: OrganizationView,
  enterprise: EnterpriseView,
  'team-metrics': TeamMetricsView,
  'outreach-analytics': OutreachAnalyticsView,
  'analytics-dashboard': AnalyticsDashboardView,
};

// Route-level permission requirements — mirrors the sidebar permission declarations.
// Views not listed here are accessible to all authenticated users.
const VIEW_PERMISSIONS: Record<string, string> = {
  analyze: 'write:scans',
  results: 'read:all',
  'repository-health': 'read:all',
  audit: 'read:audit',
  security: 'read:all',
  quality: 'read:all',
  trust: 'read:all',
  assessments: 'read:all',
  remediation: 'read:all',
  platform: 'read:analytics',
  'analytics-dashboard': 'read:analytics',
  'team-metrics': 'read:analytics',
  'outreach-analytics': 'read:analytics',
  organization: 'admin:all',
  enterprise: 'admin:all',
  admin: 'admin:all',
  tools: 'write:all',
  settings: 'admin:all',
};

export default function App() {
  const [route, setRoute] = useState(getCurrentRoute());
  const { isAuthenticated, isFreeTier, user } = useAuth();
  useTheme();

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search || '');
      if (params.get('sb_force_signin') === '1') {
        navigate('signin');
        setRoute(getCurrentRoute());
        return;
      }
    } catch (_) {}
    const onHashChange = () => setRoute(getCurrentRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    const label = VIEW_TITLES[route.view] || 'Dashboard';
    document.title = `${label} — SimpleBeacon`;
  }, [route.view]);

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    if (PUBLIC_VIEWS.has(route.view)) return;
    if (AUTH_REQUIRED_VIEWS.has(route.view) && !isAuthenticated) {
      navigate('signin');
      setRoute(getCurrentRoute());
      return;
    }
    if (!WRITE_HEAVY_VIEWS.has(route.view)) return;
    if (!isHostedDashboard() || isIdeEmbedSurface()) return;
    if (!isTokenExpired()) return;
    navigate('signin');
    setRoute(getCurrentRoute());
  }, [route.view, isAuthenticated]);

  const handleNavigate = useCallback((view: string) => {
    navigate(view);
    setRoute(getCurrentRoute());
  }, []);

  const CurrentView = viewMap[route.view] || DashboardView;
  const isPublic = PUBLIC_VIEWS.has(route.view);

  return (
    <BrandProvider>
      <ToastProvider>
        <AppShell
          currentView={route.view}
          onNavigate={handleNavigate}
          isAuthenticated={isAuthenticated}
          isFreeTier={isFreeTier}
          user={user}
        >
          <PermissionGuard requiredPermission={VIEW_PERMISSIONS[route.view]}>
            <Suspense
              fallback={
                <div className="flex items-center justify-center p-20 text-sm text-foreground-muted">
                  Loading...
                </div>
              }
            >
              <CurrentView />
            </Suspense>
          </PermissionGuard>
        </AppShell>
      </ToastProvider>
    </BrandProvider>
  );
}
