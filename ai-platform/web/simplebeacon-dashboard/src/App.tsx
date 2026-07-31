import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { getCurrentRoute, navigate } from './router/HashRouter';
import { AppShell } from './layout/AppShell';
import { ToastProvider } from './components/ToastProvider';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { isTokenExpired } from './config';

// P1 views
import { DashboardView } from './views/DashboardView';
import { AnalyzeView } from './views/AnalyzeView';
import { ResultsView } from './views/ResultsView';

// P2 views
import { SettingsView } from './views/SettingsView';
import { AuditView } from './views/AuditView';
import { SecurityView } from './views/SecurityView';
import { QualityView } from './views/QualityView';
import { ChatbotView } from './views/ChatbotView';

// P3 views
import { TrustView } from './views/TrustView';
import { RemediationView } from './views/RemediationView';
import { ProfileView } from './views/ProfileView';
import { PlatformView } from './views/PlatformView';
import { ToolsView } from './views/ToolsView';
import { RepoHealthView } from './views/RepoHealthView';
import { SignInView } from './views/SignInView';
import { AdminView } from './views/AdminView';
import { UploadView } from './views/UploadView';
import { HelpView } from './views/HelpView';
import { AssessmentView } from './views/AssessmentView';
import { AboutView } from './views/AboutView';
import { GettingStartedView } from './views/GettingStartedView';
import { ComplianceView } from './views/ComplianceView';
import { OrganizationView } from './views/OrganizationView';
import { EnterpriseView } from './views/EnterpriseView';

// Lazy-loaded views — code-split to keep initial bundle small
const TeamMetricsView = lazy(() => import('./views/TeamMetricsView').then(m => ({ default: m.TeamMetricsView })));

const PUBLIC_VIEWS = new Set(['signin', 'register', 'about', 'getting-started']);
const AUTH_REQUIRED_VIEWS = new Set(['organization']);
const WRITE_HEAVY_VIEWS = new Set(['dashboard', 'analyze', 'upload', 'settings', 'admin', 'chatbot']);

function isHostedDashboard(): boolean {
  if (typeof window === 'undefined') return false;
  return !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function isIdeEmbedSurface(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.__SB_IDE_EMBED__) return true;
    if (document.documentElement.hasAttribute('data-ide-embed')) return true;
    if (typeof win.acquireVsCodeApi === 'function') return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('sb_api_base') || params.get('sb_notify_base')) return true;
  } catch { /* ignore */ }
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
};

const viewMap: Record<string, React.ComponentType> = {
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
};

export default function App() {
  const [route, setRoute] = useState(getCurrentRoute());
  const { isAuthenticated, isFreeTier, user } = useAuth();
  useTheme();

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
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
    <ToastProvider>
      <AppShell
        currentView={route.view}
        onNavigate={handleNavigate}
        isAuthenticated={isAuthenticated}
        isFreeTier={isFreeTier}
        user={user}
      >
        <Suspense fallback={<div className="flex items-center justify-center p-20 text-sm text-foreground-muted">Loading...</div>}>
          <CurrentView />
        </Suspense>
      </AppShell>
    </ToastProvider>
  );
}
